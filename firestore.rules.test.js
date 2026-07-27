// Firestore Security Rules tests — runs against the local Firestore emulator, never
// touches production. Requires the emulator running (see package.json "test:rules" script,
// which wraps this in `firebase emulators:exec`).
//
// This covers the two things added/fixed on 2026-07-23:
//   1. Time-limited access (accessExpiresAt) — a user with a valid role but a past
//      expiry must be denied everywhere, exactly as if they had no role at all.
//   2. isManager() fix on users/{userId} — the UserManagement UI has always said
//      "manager and above can manage users," but the rules only granted isAdmin()
//      (owner/admin), so a manager account got permission-denied reading the user list.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'

let testEnv

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'lamom-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

// Seeds a users/{uid} doc bypassing all security rules — simulates data that already
// exists, without needing to route the write through the exact rules under test.
async function seedUser(uid, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`users/${uid}`).set(data)
  })
  // meta/init must exist for non-bootstrap behavior in most tests below
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const initSnap = await context.firestore().doc('meta/init').get()
    if (!initSnap.exists) await context.firestore().doc('meta/init').set({ ownerUid: 'owner-uid', ownerEmail: 'owner@example.com' })
  })
}

function futureDate(days = 30) { return new Date(Date.now() + days * 86400000) }
function pastDate(days = 1) { return new Date(Date.now() - days * 86400000) }

describe('accessExpiresAt — time-limited access is enforced at the rules level', () => {
  it('a sales user with no accessExpiresAt (permanent access) can read customers', async () => {
    await seedUser('u1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('u1').firestore()
    await assertSucceeds(db.collection('customers').get())
  })

  it('a sales user whose accessExpiresAt is in the future can still read customers', async () => {
    await seedUser('u2', { role: 'sales', active: true, accessExpiresAt: futureDate() })
    const db = testEnv.authenticatedContext('u2').firestore()
    await assertSucceeds(db.collection('customers').get())
  })

  it('a sales user whose accessExpiresAt is in the past is denied, exactly as if they had no role', async () => {
    await seedUser('u3', { role: 'sales', active: true, accessExpiresAt: pastDate() })
    const db = testEnv.authenticatedContext('u3').firestore()
    await assertFails(db.collection('customers').get())
  })

  it('an expired owner is denied too — expiry overrides role, no exceptions', async () => {
    await seedUser('u4', { role: 'owner', active: true, accessExpiresAt: pastDate() })
    const db = testEnv.authenticatedContext('u4').firestore()
    await assertFails(db.collection('customers').get())
  })

  it('a user cannot clear their own accessExpiresAt via self-update (privilege re-escalation)', async () => {
    await seedUser('u5', { role: 'sales', active: true, accessExpiresAt: pastDate() })
    const db = testEnv.authenticatedContext('u5').firestore()
    await assertFails(db.doc('users/u5').update({ accessExpiresAt: null }))
  })

  it('a user CAN update their own unrelated fields (e.g. displayName) even while expired', async () => {
    await seedUser('u6', { role: 'sales', active: true, accessExpiresAt: pastDate() })
    const db = testEnv.authenticatedContext('u6').firestore()
    // Firestore rules for users/{userId} update don't gate on isStaff()/expiry for self-edits
    // of non-privileged fields — only isManager() OR the affectedKeys restriction applies.
    await assertSucceeds(db.doc('users/u6').update({ displayName: 'New Name' }))
  })
})

describe('isManager() fix — users collection access matches the UI\'s stated "manager and above" design', () => {
  it('a manager can read the users collection (was broken — only isAdmin() before this fix)', async () => {
    await seedUser('mgr1', { role: 'manager', active: true })
    await seedUser('staff1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('mgr1').firestore()
    await assertSucceeds(db.collection('users').get())
  })

  it('a manager can approve a pending user (set role + active + accessExpiresAt)', async () => {
    await seedUser('mgr2', { role: 'manager', active: true })
    await seedUser('pending1', { role: 'pending', active: false })
    const db = testEnv.authenticatedContext('mgr2').firestore()
    await assertSucceeds(db.doc('users/pending1').update({ role: 'sales', active: true, accessExpiresAt: futureDate(7) }))
  })

  it('a plain sales-role user still cannot read the users collection', async () => {
    await seedUser('staff2', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('staff2').firestore()
    await assertFails(db.collection('users').get())
  })

  it('an owner can still delete a user account (unchanged — delete stays isOwner()-only)', async () => {
    await seedUser('owner1', { role: 'owner', active: true })
    await seedUser('toDelete', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('owner1').firestore()
    await assertSucceeds(db.doc('users/toDelete').delete())
  })

  it('a manager cannot delete a user account (delete requires isOwner(), not just isManager())', async () => {
    await seedUser('mgr3', { role: 'manager', active: true })
    await seedUser('toDelete2', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('mgr3').firestore()
    await assertFails(db.doc('users/toDelete2').delete())
  })
})

describe('CRITICAL: the catch-all rule must never grant broader access than a collection\'s own specific rule', () => {
  // Discovered while writing this test suite: Firestore evaluates every matching `match`
  // block and unions the results with OR — it does NOT let a more specific block "win"
  // over a less specific one. The catch-all at the bottom of firestore.rules (isStaff())
  // was therefore silently overriding every narrower rule in the file (payroll, audit_log
  // immutability, users, commissions, HR records, admin-only settings...) for any plain
  // staff-level account, the whole time those narrower rules existed.
  it('a sales-role user cannot read payroll (finance-only, not staff-wide)', async () => {
    await seedUser('salesA', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('salesA').firestore()
    await assertFails(db.collection('payroll').get())
  })

  it('a finance-role user CAN read payroll', async () => {
    await seedUser('finA', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('finA').firestore()
    await assertSucceeds(db.collection('payroll').get())
  })

  it('a sales-role user cannot read commissions (finance/manager-only)', async () => {
    await seedUser('salesB', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('salesB').firestore()
    await assertFails(db.collection('commissions').get())
  })

  it('an admin CAN read audit_log, but nobody — not even admin — can update or delete it (immutability)', async () => {
    await seedUser('adminA', { role: 'admin', active: true })
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('audit_log/entry1').set({ action: 'create', user: 'someone' })
    })
    const db = testEnv.authenticatedContext('adminA').firestore()
    await assertSucceeds(db.doc('audit_log/entry1').get())
    await assertFails(db.doc('audit_log/entry1').update({ action: 'tampered' }))
    await assertFails(db.doc('audit_log/entry1').delete())
  })

  it('a plain staff-role user cannot read audit_log at all (isAdmin()-only read)', async () => {
    await seedUser('staff4', { role: 'staff', active: true })
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('audit_log/entry2').set({ action: 'create', user: 'someone' })
    })
    const db = testEnv.authenticatedContext('staff4').firestore()
    await assertFails(db.doc('audit_log/entry2').get())
  })

  it('a sales-role user cannot write to settings (admin-only)', async () => {
    await seedUser('salesC', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('salesC').firestore()
    await assertFails(db.doc('settings/general').set({ x: 1 }))
  })

  it('sanity check: the fix does not over-restrict genuinely staff-wide collections like customers', async () => {
    await seedUser('salesD', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('salesD').firestore()
    await assertSucceeds(db.collection('customers').get())
    await assertSucceeds(db.doc('bookings/b1').set({ status: 'new' }))
  })

  it('sanity check: an unlisted, made-up collection with no specific rule still falls back to plain isStaff()', async () => {
    await seedUser('salesE', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('salesE').firestore()
    await assertSucceeds(db.collection('some_future_collection_nobody_wrote_a_rule_for_yet').get())
  })

  // A handful more of the 34 protected collections, deliberately chosen to cover the
  // *different* permission shapes in the file (isHR()-only, isService()-only,
  // isOwner()-only, self-scoped-with-impersonation-check) — not exhaustive over all 34,
  // but enough to confirm the guard mechanism itself works correctly regardless of which
  // specific role function a given collection uses, not just the isFinance()/isAdmin()
  // cases already covered above.
  it('a sales-role user cannot write to staff (isHR()-only)', async () => {
    await seedUser('salesF', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('salesF').firestore()
    await assertFails(db.doc('staff/emp1').set({ name: 'x' }))
  })

  it('an hr-role user CAN write to staff', async () => {
    await seedUser('hrA', { role: 'hr', active: true })
    const db = testEnv.authenticatedContext('hrA').firestore()
    await assertSucceeds(db.doc('staff/emp1').set({ name: 'x' }))
  })

  it('a sales-role user cannot read inspections (isService()||isManager()-only)', async () => {
    await seedUser('salesG', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('salesG').firestore()
    await assertFails(db.collection('inspections').get())
  })

  it('a service-role user CAN read inspections', async () => {
    await seedUser('svcA', { role: 'service', active: true })
    const db = testEnv.authenticatedContext('svcA').firestore()
    await assertSucceeds(db.collection('inspections').get())
  })

  it('an admin (not owner) cannot write to roles (isOwner()-only)', async () => {
    await seedUser('adminB', { role: 'admin', active: true })
    const db = testEnv.authenticatedContext('adminB').firestore()
    await assertFails(db.doc('roles/r1').set({ perms: [] }))
  })

  it('the owner CAN write to roles', async () => {
    await seedUser('ownerA', { role: 'owner', active: true })
    const db = testEnv.authenticatedContext('ownerA').firestore()
    await assertSucceeds(db.doc('roles/r1').set({ perms: [] }))
  })

  it('a staff-level user cannot create an ai_officer_chats entry impersonating a different userId', async () => {
    await seedUser('staff5', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('staff5').firestore()
    await assertFails(db.doc('ai_officer_chats/c1').set({ userId: 'someone-else', text: 'hi' }))
  })

  it('a staff-level user CAN create an ai_officer_chats entry scoped to their own userId', async () => {
    await seedUser('staff6', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('staff6').firestore()
    await assertSucceeds(db.doc('ai_officer_chats/c2').set({ userId: 'staff6', text: 'hi' }))
  })
})

describe('pre-existing anti-escalation protections still hold after these changes', () => {
  it('a brand-new signed-in user can self-create only with role=pending (not any elevated role)', async () => {
    // meta/init already exists from seedUser's side effect in a previous test run within
    // this file via clearFirestore() between tests — create it explicitly here for isolation.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('meta/init').set({ ownerUid: 'owner-uid', ownerEmail: 'owner@example.com' })
    })
    const db = testEnv.authenticatedContext('newuser1').firestore()
    await assertFails(db.doc('users/newuser1').set({ role: 'owner', active: true }))
    await assertSucceeds(db.doc('users/newuser1').set({ role: 'pending', active: false }))
  })

  it('a signed-in user cannot escalate their own role via self-update', async () => {
    await seedUser('staff3', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('staff3').firestore()
    await assertFails(db.doc('users/staff3').update({ role: 'owner' }))
  })
})

describe('sop_documents — write restricted to managers, matching legal_references', () => {
  it('a plain staff member cannot create an SOP (the app only lets managers edit SOPs)', async () => {
    await seedUser('sopStaff1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('sopStaff1').firestore()
    await assertFails(db.collection('sop_documents').add({ title: 'x', steps: ['a'] }))
  })

  it('a manager can create an SOP', async () => {
    await seedUser('sopMgr1', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('sopMgr1').firestore()
    await assertSucceeds(db.collection('sop_documents').add({ title: 'x', steps: ['a'] }))
  })

  it('any staff member can still read SOPs (read stays open, only write is restricted)', async () => {
    await seedUser('sopStaff2', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('sopStaff2').firestore()
    await assertSucceeds(db.collection('sop_documents').get())
  })
})

describe('rag_chunks (Phase 3 RAG) — same access as the internal knowledge it is derived from', () => {
  it('staff can read rag_chunks (needed to run retrieval client-side)', async () => {
    await seedUser('ragStaff1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('ragStaff1').firestore()
    await assertSucceeds(db.collection('rag_chunks').get())
  })

  it('staff can write rag_chunks (the fire-and-forget indexing hook writes as the acting user)', async () => {
    await seedUser('ragStaff2', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('ragStaff2').firestore()
    await assertSucceeds(db.doc('rag_chunks/sop_documents_x').set({ sourceCollection: 'sop_documents', sourceId: 'x', text: 't', embedding: [0.1] }))
  })

  it('a pending (not-yet-approved) user cannot read rag_chunks', async () => {
    await seedUser('ragPending1', { role: 'pending', active: false })
    const db = testEnv.authenticatedContext('ragPending1').firestore()
    await assertFails(db.collection('rag_chunks').get())
  })
})

// Second audit pass (2026-07-23) — these collections were added to the app after the original
// catch-all fix and had zero specific rule coverage, so a plain "sales"/"staff" role could read
// and write raw salaries, bank statement lines, and API keys via the catch-all. Same bug class,
// different collections — caught by re-auditing rather than by the rules test suite itself,
// which only ever tests collections someone remembered to write a test for.
describe('finance collections added after the original sweep — now finance-only', () => {
  it('plain staff cannot read bank_transactions (raw bank statement lines)', async () => {
    await seedUser('finGap1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('finGap1').firestore()
    await assertFails(db.collection('bank_transactions').get())
  })

  it('finance role can read bank_transactions', async () => {
    await seedUser('finGap2', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('finGap2').firestore()
    await assertSucceeds(db.collection('bank_transactions').get())
  })

  it('plain staff cannot read payroll_records (raw salaries)', async () => {
    await seedUser('finGap3', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('finGap3').firestore()
    await assertFails(db.collection('payroll_records').get())
  })

  it('a technician can read tech_kpi_bonus_approvals (checking their own bonus status) but cannot create one (that authorizes a real payout)', async () => {
    await seedUser('finGap4', { role: 'service', active: true })
    const db = testEnv.authenticatedContext('finGap4').firestore()
    await assertSucceeds(db.collection('tech_kpi_bonus_approvals').get())
    await assertFails(db.collection('tech_kpi_bonus_approvals').add({ month: '2026-07', totalBonus: 50000 }))
  })

  it('a manager can create a tech_kpi_bonus_approvals record', async () => {
    await seedUser('finGap5', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('finGap5').firestore()
    await assertSucceeds(db.collection('tech_kpi_bonus_approvals').add({ month: '2026-07', totalBonus: 50000 }))
  })
})

describe('system-security collections — admin only', () => {
  it('plain staff cannot read api_keys', async () => {
    await seedUser('secGap1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('secGap1').firestore()
    await assertFails(db.collection('api_keys').get())
  })

  it('admin can read and write api_keys', async () => {
    await seedUser('secGap2', { role: 'admin', active: true })
    const db = testEnv.authenticatedContext('secGap2').firestore()
    await assertSucceeds(db.collection('api_keys').get())
    await assertSucceeds(db.collection('api_keys').add({ name: 'test', key: 'x' }))
  })

  it('plain staff cannot read or terminate security_sessions (other users\' login sessions)', async () => {
    await seedUser('secGap3', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('secGap3').firestore()
    await assertFails(db.collection('security_sessions').get())
  })

  it('admin can read security_sessions', async () => {
    await seedUser('secGap4', { role: 'admin', active: true })
    const db = testEnv.authenticatedContext('secGap4').firestore()
    await assertSucceeds(db.collection('security_sessions').get())
  })
})

describe('disciplinary_records — rule now matches the real collection name (was "disciplinary")', () => {
  it('plain staff cannot read disciplinary_records', async () => {
    await seedUser('hrGap1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('hrGap1').firestore()
    await assertFails(db.collection('disciplinary_records').get())
  })

  it('HR role can read and write disciplinary_records', async () => {
    await seedUser('hrGap2', { role: 'hr', active: true })
    const db = testEnv.authenticatedContext('hrGap2').firestore()
    await assertSucceeds(db.collection('disciplinary_records').get())
  })
})

describe('pdpa_dsr_requests — legal data-subject-request deadlines need manager sign-off to close', () => {
  it('plain staff can read but not close a DSR request', async () => {
    await seedUser('pdpaGap1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('pdpaGap1').firestore()
    await assertSucceeds(db.collection('pdpa_dsr_requests').get())
    await assertFails(db.collection('pdpa_dsr_requests').add({ status: 'processing' }))
  })

  it('a manager can close a DSR request', async () => {
    await seedUser('pdpaGap2', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('pdpaGap2').firestore()
    await assertSucceeds(db.collection('pdpa_dsr_requests').add({ status: 'processing' }))
  })
})

// Third audit pass (2026-07-25) — full cross-reference of every collection name used anywhere in
// src/ against firestore.rules found 7 more with no specific rule: webhook secrets, integration
// configs, backup/restore, and 4 HR collections holding data more sensitive than a regular staff
// member should see (job applicants who aren't even employees yet, succession plans, etc.).
describe('third audit pass — webhooks/integrations/backups admin-only', () => {
  it('plain staff cannot read webhook secrets', async () => {
    await seedUser('auditGap1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap1').firestore()
    await assertFails(db.collection('webhooks').get())
  })

  it('admin can manage webhooks', async () => {
    await seedUser('auditGap2', { role: 'admin', active: true })
    const db = testEnv.authenticatedContext('auditGap2').firestore()
    await assertSucceeds(db.collection('webhooks').add({ name: 'x', secret: 'shh' }))
  })

  it('a manager cannot trigger a system restore (system_backups write)', async () => {
    await seedUser('auditGap3', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('auditGap3').firestore()
    await assertFails(db.collection('system_backups').add({ type: 'full', status: 'success' }))
  })
})

describe('third audit pass — HR data more sensitive than the plain staff/isHR() split', () => {
  it('plain staff cannot read job applicant records', async () => {
    await seedUser('auditGap4', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap4').firestore()
    await assertFails(db.collection('recruitment_applicants').get())
  })

  it('HR role can read job applicant records', async () => {
    await seedUser('auditGap5', { role: 'hr', active: true })
    const db = testEnv.authenticatedContext('auditGap5').firestore()
    await assertSucceeds(db.collection('recruitment_applicants').get())
  })

  it('plain staff cannot read succession plans', async () => {
    await seedUser('auditGap6', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap6').firestore()
    await assertFails(db.collection('succession_plans').get())
  })

  it('plain staff can read the staff directory but cannot edit it', async () => {
    await seedUser('auditGap7', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap7').firestore()
    await assertSucceeds(db.collection('staff_profiles').get())
    await assertFails(db.collection('staff_profiles').add({ name: 'x' }))
  })
})

describe('compliance_audits — plain staff can read audit results but not create/edit them', () => {
  it('plain staff cannot create a compliance audit', async () => {
    await seedUser('qcGap1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('qcGap1').firestore()
    await assertFails(db.collection('compliance_audits').add({ title: 'x' }))
  })

  it('a manager can create a compliance audit', async () => {
    await seedUser('qcGap2', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('qcGap2').firestore()
    await assertSucceeds(db.collection('compliance_audits').add({ title: 'x' }))
  })
})

describe('fourth audit pass — money-adjacent and personal-document collections', () => {
  it('plain sales staff cannot approve their own partner commission payout', async () => {
    await seedUser('auditGap8', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap8').firestore()
    await assertFails(db.collection('partner_commissions').add({ amount: 5000, status: 'approved' }))
  })

  it('finance role can approve a partner commission payout', async () => {
    await seedUser('auditGap9', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('auditGap9').firestore()
    await assertSucceeds(db.collection('partner_commissions').add({ amount: 5000, status: 'approved' }))
  })

  it('plain staff cannot read company financial goals', async () => {
    await seedUser('auditGap10', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap10').firestore()
    await assertFails(db.collection('financial_goals').get())
  })

  it('sales staff can create a contract but cannot edit its value after the fact', async () => {
    await seedUser('auditGap11', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap11').firestore()
    const ref = await assertSucceeds(db.collection('contracts').add({ title: 'x', party: 'y', value: 100000 }))
    await assertFails(ref.update({ value: 999999 }))
  })

  it('plain staff cannot approve their own overtime hours', async () => {
    await seedUser('auditGap12', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap12').firestore()
    const ref = await assertSucceeds(db.collection('overtime_records').add({ staff: 'x', hours: 2, status: 'pending' }))
    await assertFails(ref.update({ status: 'approved' }))
  })

  it('plain staff cannot read another employee\'s uploaded personal documents', async () => {
    await seedUser('auditGap13', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap13').firestore()
    await assertFails(db.collection('staff_documents').get())
  })

  it('HR can manage staff document uploads', async () => {
    await seedUser('auditGap14', { role: 'hr', active: true })
    const db = testEnv.authenticatedContext('auditGap14').firestore()
    await assertSucceeds(db.collection('staff_documents').add({ staff: 'x', type: 'id_card', fileUrl: 'https://x' }))
  })
})

describe('attendance — kiosk-style self check-in, any staff can write (not just HR/manager)', () => {
  it('a plain sales staff member can check themself in (was blocked before this fix)', async () => {
    await seedUser('attStaff1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('attStaff1').firestore()
    await assertSucceeds(db.collection('attendance').add({ staffId: 'S1', staffName: 'x', date: '2026-07-26', checkIn: '08:30', checkOut: null, status: 'present' }))
  })

  it('a plain staff member can read the attendance log', async () => {
    await seedUser('attStaff2', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('attStaff2').firestore()
    await assertSucceeds(db.collection('attendance').get())
  })
})

describe('kb_articles / product_knowledge — the other 2 RAG sources missed when sop_documents/legal_references got their write-restriction rule', () => {
  it('a plain staff member cannot create a KB article (should match sop_documents)', async () => {
    await seedUser('kbStaff1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('kbStaff1').firestore()
    await assertFails(db.collection('kb_articles').add({ title: 'x' }))
  })

  it('a manager can create a KB article', async () => {
    await seedUser('kbMgr1', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('kbMgr1').firestore()
    await assertSucceeds(db.collection('kb_articles').add({ title: 'x' }))
  })

  it('a plain staff member cannot edit product knowledge', async () => {
    await seedUser('pkStaff1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('pkStaff1').firestore()
    await assertFails(db.collection('product_knowledge').add({ model: 'x' }))
  })

  it('staff can still read product knowledge (read stays open)', async () => {
    await seedUser('pkStaff2', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('pkStaff2').firestore()
    await assertSucceeds(db.collection('product_knowledge').get())
  })
})

describe('fifth audit pass — remaining 169 collections, evidence-based restrictions found in code', () => {
  it('plain staff cannot edit the fixed-asset depreciation ledger', async () => {
    await seedUser('auditGap15', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap15').firestore()
    await assertFails(db.collection('assets').add({ cost: 1000000 }))
  })

  it('a staff member can only read their own AI assistant chat, not everyone else\'s', async () => {
    await seedUser('auditGap16', { role: 'sales', active: true })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('chat_ai_assistant').doc('msg1').set({ uid: 'someoneElse', text: 'private' })
    })
    const db = testEnv.authenticatedContext('auditGap16').firestore()
    await assertFails(db.collection('chat_ai_assistant').doc('msg1').get())
  })

  it('a staff member can read their own AI assistant chat', async () => {
    await seedUser('auditGap17', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap17').firestore()
    await db.collection('chat_ai_assistant').doc('msg2').set({ uid: 'auditGap17', text: 'mine' })
    await assertSucceeds(db.collection('chat_ai_assistant').doc('msg2').get())
  })

  it('plain staff cannot edit the company legal/tax profile', async () => {
    await seedUser('auditGap18', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap18').firestore()
    await assertFails(db.collection('companies').add({ taxId: '123', name: 'x' }))
  })

  it('plain staff cannot add a custom field to the form schema', async () => {
    await seedUser('auditGap19', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap19').firestore()
    await assertFails(db.collection('custom_fields').add({ module: 'customers', field: 'x' }))
  })

  it('plain staff cannot read another employee\'s HR contract stored in the shared documents pool', async () => {
    await seedUser('auditGap20', { role: 'sales', active: true })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('documents').doc('hrdoc1').set({ type: 'hr_contract', title: 'x' })
    })
    const db = testEnv.authenticatedContext('auditGap20').firestore()
    await assertFails(db.collection('documents').doc('hrdoc1').get())
  })

  it('plain staff can still read/create an ordinary sales document (booking/contract/quote)', async () => {
    await seedUser('auditGap21', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap21').firestore()
    await assertSucceeds(db.collection('documents').add({ type: 'booking', title: 'x' }))
  })

  it('HR can read an HR contract in the shared documents pool', async () => {
    await seedUser('auditGap22', { role: 'hr', active: true })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('documents').doc('hrdoc2').set({ type: 'hr_contract', title: 'y' })
    })
    const db = testEnv.authenticatedContext('auditGap22').firestore()
    await assertSucceeds(db.collection('documents').doc('hrdoc2').get())
  })

  it('plain staff cannot approve their own expense receipt reimbursement', async () => {
    await seedUser('auditGap23', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap23').firestore()
    const ref = await assertSucceeds(db.collection('expense_receipts').add({ vendor: 'x', status: 'pending' }))
    await assertFails(ref.update({ status: 'approved' }))
  })

  it('finance role can approve an expense receipt', async () => {
    await seedUser('auditGap24', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('auditGap24').firestore()
    const ref = await db.collection('expense_receipts').add({ vendor: 'x', status: 'pending' })
    await assertSucceeds(ref.update({ status: 'approved' }))
  })

  it('plain staff cannot read the dealer\'s floor-plan credit-line balances', async () => {
    await seedUser('auditGap25', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap25').firestore()
    await assertFails(db.collection('floor_plan').get())
  })

  it('plain staff cannot read the month-end financial close ledger', async () => {
    await seedUser('auditGap26', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap26').firestore()
    await assertFails(db.collection('monthly_close_items').get())
  })

  it('a sales staff member cannot read a coworker\'s mood survey response', async () => {
    await seedUser('auditGap27', { role: 'sales', active: true })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('mood_responses').doc('m1').set({ staff: 'someone else', score: 2 })
    })
    const db = testEnv.authenticatedContext('auditGap27').firestore()
    await assertFails(db.collection('mood_responses').doc('m1').get())
  })

  it('a sales staff member can still submit their own mood survey response', async () => {
    await seedUser('auditGap28', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap28').firestore()
    await assertSucceeds(db.collection('mood_responses').add({ staff: 'me', score: 4 }))
  })

  it('a plain staff member can read back their own mood response (by uid)', async () => {
    await seedUser('auditGap28b', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap28b').firestore()
    await db.collection('mood_responses').doc('m2').set({ staff: 'me', uid: 'auditGap28b', score: 4 })
    await assertSucceeds(db.collection('mood_responses').doc('m2').get())
  })

  it('HR can read mood survey responses', async () => {
    await seedUser('auditGap29', { role: 'hr', active: true })
    const db = testEnv.authenticatedContext('auditGap29').firestore()
    await assertSucceeds(db.collection('mood_responses').get())
  })
})

describe('sales_budgets — same access as team_targets, a sales rep cannot edit their own target', () => {
  it('a plain sales staff member cannot edit the company sales budget', async () => {
    await seedUser('auditGap30', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap30').firestore()
    await assertFails(db.collection('sales_budgets').add({ year: 2026, targets: [1] }))
  })

  it('a manager can set the sales budget', async () => {
    await seedUser('auditGap31', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('auditGap31').firestore()
    await assertSucceeds(db.collection('sales_budgets').add({ year: 2026, targets: [1] }))
  })

  it('a plain sales staff member can still read the sales budget', async () => {
    await seedUser('auditGap32', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap32').firestore()
    await assertSucceeds(db.collection('sales_budgets').get())
  })
})

describe('marketing_budgets — same access as sales_budgets', () => {
  it('a plain marketing staff member cannot edit the channel budget', async () => {
    await seedUser('auditGap33', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('auditGap33').firestore()
    await assertFails(db.collection('marketing_budgets').add({ budgets: { fb: 1 } }))
  })

  it('a manager can edit the marketing channel budget', async () => {
    await seedUser('auditGap34', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('auditGap34').firestore()
    await assertSucceeds(db.collection('marketing_budgets').add({ budgets: { fb: 1 } }))
  })
})

describe('commission_rules — a sales rep cannot edit their own commission rate', () => {
  it('a plain sales staff member cannot edit a commission rule', async () => {
    await seedUser('auditGap35', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap35').firestore()
    await assertFails(db.collection('commission_rules').add({ name: 'x', value: 999999 }))
  })

  it('finance role can edit a commission rule', async () => {
    await seedUser('auditGap36', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('auditGap36').firestore()
    await assertSucceeds(db.collection('commission_rules').add({ name: 'x', value: 5000 }))
  })

  it('a plain sales staff member can still read commission rules', async () => {
    await seedUser('auditGap37', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap37').firestore()
    await assertSucceeds(db.collection('commission_rules').get())
  })
})

describe('budget_planning — same access as sales_budgets/commission_rules', () => {
  it('a plain staff member cannot edit the annual budget', async () => {
    await seedUser('auditGap38', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap38').firestore()
    await assertFails(db.collection('budget_planning').add({ year: 2026, revenue: [] }))
  })

  it('a manager can set the annual budget', async () => {
    await seedUser('auditGap39', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('auditGap39').firestore()
    await assertSucceeds(db.collection('budget_planning').add({ year: 2026, revenue: [] }))
  })

  it('a plain staff member can still read the annual budget', async () => {
    await seedUser('auditGap40', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap40').firestore()
    await assertSucceeds(db.collection('budget_planning').get())
  })
})

describe('org_companies — internal legal-entity records (multi-company support)', () => {
  it('a plain staff member cannot create a company record', async () => {
    await seedUser('auditGap41', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap41').firestore()
    await assertFails(db.collection('org_companies').add({ name: 'BYD Bangna', brand: 'BYD' }))
  })

  it('a manager can create a company record', async () => {
    await seedUser('auditGap42', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('auditGap42').firestore()
    await assertSucceeds(db.collection('org_companies').add({ name: 'BYD Bangna', brand: 'BYD' }))
  })

  it('a plain staff member can still read company records', async () => {
    await seedUser('auditGap43', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap43').firestore()
    await assertSucceeds(db.collection('org_companies').get())
  })
})

describe('staff_grievances — internal employee complaints (opposite direction of disciplinary_records)', () => {
  it('a staff member can create a grievance scoped to their own uid', async () => {
    await seedUser('auditGap44', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap44').firestore()
    await assertSucceeds(db.collection('staff_grievances').add({ submittedBy: 'auditGap44', subject: 'x', status: 'pending' }))
  })

  it('a staff member cannot create a grievance impersonating a different submittedBy', async () => {
    await seedUser('auditGap45', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap45').firestore()
    await assertFails(db.collection('staff_grievances').add({ submittedBy: 'someone-else', subject: 'x', status: 'pending' }))
  })

  it('a staff member can read their own grievance', async () => {
    await seedUser('auditGap46', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap46').firestore()
    await db.collection('staff_grievances').doc('g1').set({ submittedBy: 'auditGap46', subject: 'mine', status: 'pending' })
    await assertSucceeds(db.collection('staff_grievances').doc('g1').get())
  })

  it('a staff member cannot read someone else\'s grievance', async () => {
    await seedUser('auditGap47', { role: 'sales', active: true })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('staff_grievances').doc('g2').set({ submittedBy: 'someoneElse', subject: 'private', status: 'pending' })
    })
    const db = testEnv.authenticatedContext('auditGap47').firestore()
    await assertFails(db.collection('staff_grievances').doc('g2').get())
  })

  it('a staff member cannot resolve/update their own grievance', async () => {
    await seedUser('auditGap48', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap48').firestore()
    await db.collection('staff_grievances').doc('g3').set({ submittedBy: 'auditGap48', subject: 'mine', status: 'pending' })
    await assertFails(db.collection('staff_grievances').doc('g3').update({ status: 'resolved' }))
  })

  it('HR can read and resolve any grievance', async () => {
    await seedUser('auditGap49', { role: 'hr', active: true })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('staff_grievances').doc('g4').set({ submittedBy: 'someoneElse', subject: 'case', status: 'pending' })
    })
    const db = testEnv.authenticatedContext('auditGap49').firestore()
    await assertSucceeds(db.collection('staff_grievances').doc('g4').get())
    await assertSucceeds(db.collection('staff_grievances').doc('g4').update({ status: 'resolved', resolution: 'handled' }))
  })
})

describe('announcements_hr — only authorized roles (HR/manager) can post org-wide announcements', () => {
  it('a plain staff member cannot create an announcement', async () => {
    await seedUser('auditGap50', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap50').firestore()
    await assertFails(db.collection('announcements_hr').add({ title: 'x', body: 'y', scope: 'org' }))
  })

  it('HR can create an announcement', async () => {
    await seedUser('auditGap51', { role: 'hr', active: true })
    const db = testEnv.authenticatedContext('auditGap51').firestore()
    await assertSucceeds(db.collection('announcements_hr').add({ title: 'x', body: 'y', scope: 'org' }))
  })

  it('a plain staff member can still read announcements', async () => {
    await seedUser('auditGap52', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap52').firestore()
    await assertSucceeds(db.collection('announcements_hr').get())
  })
})

describe('comm_messages — group channels stay open, DM channels restricted to participants', () => {
  it('any staff can read/write a group channel message', async () => {
    await seedUser('auditGap53', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap53').firestore()
    await assertSucceeds(db.collection('comm_messages').add({ channel: 'general', author: 'x', content: 'hi' }))
    await assertSucceeds(db.collection('comm_messages').get())
  })

  it('a staff member can create a DM message scoped to themselves as a participant', async () => {
    await seedUser('auditGap54', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap54').firestore()
    await assertSucceeds(db.collection('comm_messages').add({ channel: 'dm_auditGap54_someoneElse', author: 'x', content: 'hi', participants: ['auditGap54', 'someoneElse'] }))
  })

  it('a staff member cannot create a DM message impersonating participants that exclude themselves', async () => {
    await seedUser('auditGap55', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap55').firestore()
    await assertFails(db.collection('comm_messages').add({ channel: 'dm_a_b', author: 'x', content: 'hi', participants: ['a', 'b'] }))
  })

  it('a staff member cannot read a DM between two other people', async () => {
    await seedUser('auditGap56', { role: 'sales', active: true })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('comm_messages').doc('dm1').set({ channel: 'dm_personA_personB', author: 'x', content: 'private', participants: ['personA', 'personB'] })
    })
    const db = testEnv.authenticatedContext('auditGap56').firestore()
    await assertFails(db.collection('comm_messages').doc('dm1').get())
  })

  it('a participant can read their own DM', async () => {
    await seedUser('auditGap57', { role: 'sales', active: true })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('comm_messages').doc('dm2').set({ channel: 'dm_auditGap57_other', author: 'other', content: 'hi', participants: ['auditGap57', 'other'] })
    })
    const db = testEnv.authenticatedContext('auditGap57').firestore()
    await assertSucceeds(db.collection('comm_messages').doc('dm2').get())
  })
})
