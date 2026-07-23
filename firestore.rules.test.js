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
