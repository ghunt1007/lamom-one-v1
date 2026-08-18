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
    // groupWide:true — this test is about accessExpiresAt, not company scoping (see v1.0.453
    // "company scoping — core mechanism" describe block below for that).
    await seedUser('u1', { role: 'sales', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('u1').firestore()
    await assertSucceeds(db.collection('customers').get())
  })

  it('a sales user whose accessExpiresAt is in the future can still read customers', async () => {
    await seedUser('u2', { role: 'sales', active: true, accessExpiresAt: futureDate(), groupWide: true })
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

describe('canAssignRole() — role-hierarchy privilege escalation fix (v1.0.305)', () => {
  it('a manager CANNOT create a new user with role owner (self-escalation via account creation)', async () => {
    await seedUser('mgr4', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('mgr4').firestore()
    await assertFails(db.doc('users/newOwner').set({ role: 'owner', active: true, displayName: 'x' }))
  })

  it('a manager CANNOT create a new user with role admin', async () => {
    await seedUser('mgr5', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('mgr5').firestore()
    await assertFails(db.doc('users/newAdmin').set({ role: 'admin', active: true, displayName: 'x' }))
  })

  it('a manager CAN still create a new user with role sales (below their own level — unaffected)', async () => {
    await seedUser('mgr6', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('mgr6').firestore()
    await assertSucceeds(db.doc('users/newSales').set({ role: 'sales', active: true, displayName: 'x' }))
  })

  it('a manager CANNOT self-escalate by updating their own doc role to owner via the isManager() branch', async () => {
    await seedUser('mgr7', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('mgr7').firestore()
    await assertFails(db.doc('users/mgr7').update({ role: 'owner' }))
  })

  it('a manager CANNOT promote another manager to owner', async () => {
    await seedUser('mgr8', { role: 'manager', active: true })
    await seedUser('mgr9', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('mgr8').firestore()
    await assertFails(db.doc('users/mgr9').update({ role: 'owner' }))
  })

  it('a manager CANNOT touch an existing admin account at all (e.g. toggling active), even for non-role fields', async () => {
    await seedUser('mgr10', { role: 'manager', active: true })
    await seedUser('admin1', { role: 'admin', active: true })
    const db = testEnv.authenticatedContext('mgr10').firestore()
    await assertFails(db.doc('users/admin1').update({ active: false }))
  })

  it('an admin CANNOT create a peer admin account', async () => {
    await seedUser('admin2', { role: 'admin', active: true })
    const db = testEnv.authenticatedContext('admin2').firestore()
    await assertFails(db.doc('users/newAdmin2').set({ role: 'admin', active: true, displayName: 'x' }))
  })

  it('an admin CAN create a manager account (below their own level)', async () => {
    await seedUser('admin3', { role: 'admin', active: true })
    const db = testEnv.authenticatedContext('admin3').firestore()
    await assertSucceeds(db.doc('users/newMgr').set({ role: 'manager', active: true, displayName: 'x' }))
  })

  it('an owner CANNOT create a second owner account (matches UI — owner role only ever set via bootstrap)', async () => {
    await seedUser('owner2', { role: 'owner', active: true })
    const db = testEnv.authenticatedContext('owner2').firestore()
    await assertFails(db.doc('users/newOwner2').set({ role: 'owner', active: true, displayName: 'x' }))
  })

  it('an owner CAN create an admin account (below owner level)', async () => {
    await seedUser('owner3', { role: 'owner', active: true })
    const db = testEnv.authenticatedContext('owner3').firestore()
    await assertSucceeds(db.doc('users/newAdmin3').set({ role: 'admin', active: true, displayName: 'x' }))
  })

  it('a manager can still legitimately promote a pending user to sales (unaffected regression check)', async () => {
    await seedUser('mgr11', { role: 'manager', active: true })
    await seedUser('pending2', { role: 'pending', active: false })
    const db = testEnv.authenticatedContext('mgr11').firestore()
    await assertSucceeds(db.doc('users/pending2').update({ role: 'sales', active: true }))
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
    // groupWide:true — this test is about the catch-all-vs-narrower-rule interaction, not
    // company scoping (see v1.0.453 "company scoping — core mechanism" describe block below).
    await seedUser('salesD', { role: 'sales', active: true, groupWide: true })
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
    await seedUser('hrA', { role: 'hr', active: true, groupWide: true })
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

  // (v1.0.350) IP Whitelist ต้องให้ทุกคนที่ login เขียน session ของตัวเองได้ (ไม่ใช่แค่แอดมิน) — เปิดให้
  // signed-in สร้าง/แก้ไข "เฉพาะ doc ของตัวเอง" เท่านั้น จับคู่ uid ตรงกับผู้เรียก
  it('plain staff can create their own security_sessions doc (uid matches)', async () => {
    await seedUser('secGap5', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('secGap5').firestore()
    await assertSucceeds(db.collection('security_sessions').add({ uid: 'secGap5', user: 'Test', ip: '1.2.3.4' }))
  })

  it('plain staff cannot create a security_sessions doc claiming someone else\'s uid', async () => {
    await seedUser('secGap6', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('secGap6').firestore()
    await assertFails(db.collection('security_sessions').add({ uid: 'someone-else', user: 'Test', ip: '1.2.3.4' }))
  })

  it('plain staff still cannot delete (kick) a security_sessions doc, even their own', async () => {
    await seedUser('secGap7', { role: 'sales', active: true })
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().doc('security_sessions/mySession').set({ uid: 'secGap7', user: 'Test', ip: '1.2.3.4' })
    })
    const db = testEnv.authenticatedContext('secGap7').firestore()
    await assertFails(db.doc('security_sessions/mySession').delete())
  })

  it('plain staff cannot update (soft-delete/kick) another user\'s security_sessions doc', async () => {
    await seedUser('secGap8', { role: 'sales', active: true })
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().doc('security_sessions/otherSession').set({ uid: 'someone-else', user: 'Other', ip: '1.2.3.4' })
    })
    const db = testEnv.authenticatedContext('secGap8').firestore()
    await assertFails(db.doc('security_sessions/otherSession').update({ deleted: true }))
  })

  it('admin can update (soft-delete/kick) another user\'s security_sessions doc', async () => {
    await seedUser('secGap9', { role: 'admin', active: true })
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().doc('security_sessions/otherSession2').set({ uid: 'someone-else', user: 'Other', ip: '1.2.3.4' })
    })
    const db = testEnv.authenticatedContext('secGap9').firestore()
    await assertSucceeds(db.doc('security_sessions/otherSession2').update({ deleted: true }))
  })
})

describe('ip_whitelist + security_alerts (v1.0.350) — IP Whitelist is monitor-only, never a hard login block', () => {
  it('plain staff can read ip_whitelist but not write it', async () => {
    await seedUser('ipwl1', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('ipwl1').firestore()
    await assertSucceeds(db.collection('ip_whitelist').get())
    await assertFails(db.collection('ip_whitelist').add({ label: 'Office', ip: '203.0.113.5' }))
  })

  it('admin can write ip_whitelist', async () => {
    await seedUser('ipwl2', { role: 'admin', active: true })
    const db = testEnv.authenticatedContext('ipwl2').firestore()
    await assertSucceeds(db.collection('ip_whitelist').add({ label: 'Office', ip: '203.0.113.5' }))
  })

  it('any signed-in staff can create a security_alerts entry (fired at their own login)', async () => {
    await seedUser('ipwl3', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('ipwl3').firestore()
    await assertSucceeds(db.collection('security_alerts').add({ level: 'warning', msg: 'login from non-whitelisted IP', uid: 'ipwl3' }))
  })

  it('plain staff cannot read or manage security_alerts (only admin)', async () => {
    await seedUser('ipwl4', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('ipwl4').firestore()
    await assertFails(db.collection('security_alerts').get())
  })

  it('admin can read security_alerts', async () => {
    await seedUser('ipwl5', { role: 'admin', active: true })
    const db = testEnv.authenticatedContext('ipwl5').firestore()
    await assertSucceeds(db.collection('security_alerts').get())
  })
})

describe('data_retention_policies (v1.0.351) — presets only, same pattern as security_policies', () => {
  it('plain staff can read data_retention_policies but not write it', async () => {
    await seedUser('drp1', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('drp1').firestore()
    await assertSucceeds(db.collection('data_retention_policies').get())
    await assertFails(db.collection('data_retention_policies').add({ collection: 'error_log', days: 90 }))
  })

  it('admin can write data_retention_policies', async () => {
    await seedUser('drp2', { role: 'admin', active: true })
    const db = testEnv.authenticatedContext('drp2').firestore()
    await assertSucceeds(db.collection('data_retention_policies').add({ collection: 'error_log', days: 90 }))
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

  it('a plain staff member can mark an announcement as read (readByUids) and toggle pinned', async () => {
    await seedUser('auditGap53', { role: 'sales', active: true })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('announcements_hr').doc('a1').set({ title: 'x', body: 'y', scope: 'org', pinned: false, readByUids: [] })
    })
    const db = testEnv.authenticatedContext('auditGap53').firestore()
    await assertSucceeds(db.collection('announcements_hr').doc('a1').update({ readByUids: ['auditGap53'] }))
    await assertSucceeds(db.collection('announcements_hr').doc('a1').update({ pinned: true }))
  })

  it('a plain staff member cannot rewrite the announcement content while updating', async () => {
    await seedUser('auditGap54', { role: 'sales', active: true })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('announcements_hr').doc('a2').set({ title: 'x', body: 'y', scope: 'org', pinned: false, readByUids: [] })
    })
    const db = testEnv.authenticatedContext('auditGap54').firestore()
    await assertFails(db.collection('announcements_hr').doc('a2').update({ title: 'hacked' }))
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

describe('greeting_sends — birthday/anniversary send log', () => {
  it('a staff member can log and read a greeting send', async () => {
    await seedUser('auditGap58', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap58').firestore()
    await assertSucceeds(db.collection('greeting_sends').add({ customer: 'x', phone: '0800000000', eventDate: '2026-07-27', channel: 'SMS' }))
    await assertSucceeds(db.collection('greeting_sends').get())
  })
})

describe('tax_filings — persisted filing status log', () => {
  it('a staff member can log and read a filing status change', async () => {
    await seedUser('auditGap59', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('auditGap59').firestore()
    await assertSucceeds(db.collection('tax_filings').add({ baseId: 'TX001', status: 'filed', filedDate: '2026-07-28' }))
    await assertSucceeds(db.collection('tax_filings').get())
  })
})

describe('feedback_responses — persisted customer feedback replies', () => {
  it('a staff member can log and read a feedback response', async () => {
    await seedUser('auditGap60', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap60').firestore()
    await assertSucceeds(db.collection('feedback_responses').add({ feedbackId: 'FB001', customerName: 'x', response: 'ขอบคุณครับ' }))
    await assertSucceeds(db.collection('feedback_responses').get())
  })
})

describe('customer_feedback — manually-added feedback entries', () => {
  it('a staff member can log and read a manual feedback entry', async () => {
    await seedUser('auditGap61', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap61').firestore()
    await assertSucceeds(db.collection('customer_feedback').add({ customerName: 'x', type: 'csat', score: 5 }))
    await assertSucceeds(db.collection('customer_feedback').get())
  })
})

describe('price_negotiations — discount approval requires a manager', () => {
  it('plain sales staff can request a discount but cannot approve their own', async () => {
    await seedUser('auditGap62', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap62').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('price_negotiations/pn1').set({ customer: 'x', status: 'pending' })
    })
    await assertSucceeds(db.collection('price_negotiations').add({ customer: 'y', status: 'pending' }))
    await assertFails(db.collection('price_negotiations').doc('pn1').update({ status: 'approved' }))
  })

  it('a manager can approve a discount request', async () => {
    await seedUser('auditGap63', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('auditGap63').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('price_negotiations/pn2').set({ customer: 'x', status: 'pending' })
    })
    await assertSucceeds(db.collection('price_negotiations').doc('pn2').update({ status: 'approved' }))
  })
})

describe('invoices — marking paid requires finance/manager', () => {
  it('plain sales staff can create an invoice but cannot mark it paid', async () => {
    await seedUser('auditGap64', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap64').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('invoices/inv1').set({ custName: 'x', status: 'draft' })
    })
    await assertSucceeds(db.collection('invoices').add({ custName: 'y', status: 'draft' }))
    await assertFails(db.collection('invoices').doc('inv1').update({ status: 'paid' }))
  })

  it('finance can mark an invoice paid', async () => {
    await seedUser('auditGap65', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('auditGap65').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('invoices/inv2').set({ custName: 'x', status: 'draft' })
    })
    await assertSucceeds(db.collection('invoices').doc('inv2').update({ status: 'paid' }))
  })
})

describe('referrers — paying commission requires finance/manager', () => {
  it('plain sales staff can create a referrer but cannot mark commission paid', async () => {
    await seedUser('auditGap66', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap66').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('referrers/ref1').set({ name: 'x', commission: 5000, paid: 0 })
    })
    await assertSucceeds(db.collection('referrers').add({ name: 'y', commission: 5000, paid: 0 }))
    await assertFails(db.collection('referrers').doc('ref1').update({ paid: 5000 }))
  })

  it('finance can mark referrer commission paid', async () => {
    await seedUser('auditGap67', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('auditGap67').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('referrers/ref2').set({ name: 'x', commission: 5000, paid: 0 })
    })
    await assertSucceeds(db.collection('referrers').doc('ref2').update({ paid: 5000 }))
  })
})

describe('referrals — qualifying/paying a referral requires finance/manager', () => {
  it('plain sales staff can log a referral but cannot approve or pay it', async () => {
    await seedUser('auditGap68', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('auditGap68').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('referrals/rl1').set({ referrer: 'x', status: 'pending' })
    })
    await assertSucceeds(db.collection('referrals').add({ referrer: 'y', status: 'pending' }))
    await assertFails(db.collection('referrals').doc('rl1').update({ status: 'paid' }))
  })

  it('a manager can qualify and pay a referral', async () => {
    await seedUser('auditGap69', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('auditGap69').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('referrals/rl2').set({ referrer: 'x', status: 'pending' })
    })
    await assertSucceeds(db.collection('referrals').doc('rl2').update({ status: 'paid' }))
  })
})

// v1.0.291 — เดิม rules ไม่เคยตรวจ "ค่าที่เขียนสมเหตุสมผลหรือไม่" เลยแม้แต่ field เดียว (เช็คแค่สิทธิ์ผู้เขียน)
// เพิ่มเช็คขั้นต่ำสำหรับ field เงิน/จำนวนที่ไม่มีเหตุผลทางธุรกิจให้ติดลบได้ — ทดสอบทั้งด้าน "ค่าถูกต้องผ่าน
// ได้ตามปกติ" และ "ค่าที่ไม่สมเหตุสมผลถูกบล็อกแม้ role ถูกต้อง"
describe('numeric bounds — money/quantity fields cannot be written negative even by an authorized role', () => {
  // groupWide:true throughout this block — these tests are about the price/cost non-negative
  // guard, not company scoping (see v1.0.453 "company scoping — core mechanism" block below);
  // without it every write would fail for the unrelated reason of missing companyId.
  it('vehicles: staff can write a normal non-negative price/cost', async () => {
    await seedUser('numBounds1', { role: 'staff', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('numBounds1').firestore()
    await assertSucceeds(db.collection('vehicles').add({ brand: 'BYD', model: 'Atto 3', price: 899000, cost: 750000 }))
  })

  it('vehicles: staff cannot write a negative price even with an otherwise-valid write', async () => {
    await seedUser('numBounds2', { role: 'staff', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('numBounds2').firestore()
    await assertFails(db.collection('vehicles').add({ brand: 'BYD', model: 'Atto 3', price: -1, cost: 750000 }))
  })

  it('vehicles: staff cannot write a negative cost', async () => {
    await seedUser('numBounds3', { role: 'staff', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('numBounds3').firestore()
    await assertFails(db.collection('vehicles').add({ brand: 'BYD', model: 'Atto 3', price: 899000, cost: -1 }))
  })

  it('bookings: staff can write a normal booking with non-negative price/down/refundAmount', async () => {
    await seedUser('numBounds4', { role: 'sales', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('numBounds4').firestore()
    await assertSucceeds(db.collection('bookings').add({ custName: 'A', price: 500000, down: 50000, financeAmount: 450000, refundAmount: 0 }))
  })

  it('bookings: staff cannot write a negative down payment', async () => {
    await seedUser('numBounds5', { role: 'sales', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('numBounds5').firestore()
    await assertFails(db.collection('bookings').add({ custName: 'A', price: 500000, down: -1000 }))
  })

  it('bookings: staff cannot write a negative refundAmount', async () => {
    await seedUser('numBounds6', { role: 'sales', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('numBounds6').firestore()
    await assertFails(db.collection('bookings').add({ custName: 'A', price: 500000, refundAmount: -500 }))
  })

  it('bookings: a negative discount/margin is still allowed (legitimate loss-making deal, not bounded)', async () => {
    await seedUser('numBounds7', { role: 'sales', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('numBounds7').firestore()
    await assertSucceeds(db.collection('bookings').add({ custName: 'A', price: 500000, margin: -2000 }))
  })

  it('payroll_records: finance cannot write a negative base salary for a payroll run', async () => {
    await seedUser('numBounds8', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('numBounds8').firestore()
    await assertFails(db.collection('payroll_records').add({ staffId: 's1', month: '2026-07', base: -1000 }))
  })

  it('payroll_records: finance CAN write a negative deduction (legitimate correction/refund of an over-deduction)', async () => {
    await seedUser('numBounds9', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('numBounds9').firestore()
    await assertSucceeds(db.collection('payroll_records').add({ staffId: 's1', month: '2026-07', base: 20000, deduction: -500 }))
  })

  it('staff: HR cannot write a negative salary', async () => {
    await seedUser('numBounds10', { role: 'hr', active: true })
    const db = testEnv.authenticatedContext('numBounds10').firestore()
    await assertFails(db.collection('staff').add({ firstName: 'A', lastName: 'B', salary: -100 }))
  })

  it('commission_rules: finance cannot set a percent-type rule above 100', async () => {
    await seedUser('numBounds11', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('numBounds11').firestore()
    await assertFails(db.collection('commission_rules').add({ name: 'x', type: 'percent', value: 150 }))
  })

  it('commission_rules: finance can set a flat-amount (non-percent) rule above 100 with no cap', async () => {
    await seedUser('numBounds12', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('numBounds12').firestore()
    await assertSucceeds(db.collection('commission_rules').add({ name: 'x', type: 'per_unit', value: 5000 }))
  })

  it('staff_loans: a staff member cannot request a zero or negative loan amount', async () => {
    await seedUser('numBounds13', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('numBounds13').firestore()
    await assertFails(db.collection('staff_loans').add({ staffId: 'numBounds13', amount: 0 }))
  })

  it('staff_loans: a staff member can request a normal positive loan amount', async () => {
    await seedUser('numBounds14', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('numBounds14').firestore()
    await assertSucceeds(db.collection('staff_loans').add({ staffId: 'numBounds14', amount: 10000 }))
  })
})

// v1.0.299 — พบระหว่างตรวจสอบไฟล์ rules ทั้งหมดอย่างเป็นระบบว่า 9 collection นี้มีการอนุมัติ/ปฏิเสธเงินจริง
// (แบบเดียวกับ price_negotiations/invoices/referrals ที่มีเทสอยู่แล้วด้านบน) แต่ไม่เคยมี match block
// เจาะจงมาก่อนเลย ตกอยู่ใต้ catch-all isStaff() กว้างเกินไปมาตลอด — เทสยืนยันว่าพนักงานทั่วไปสร้างคำขอได้
// (create) แต่อนุมัติ/ปฏิเสธ (update) ต้องผ่านการเงิน/ผู้จัดการเท่านั้น
describe('newly-scoped approval collections (v1.0.299) — staff can create but not approve/reject', () => {
  it('refund_requests: staff can create a refund request but cannot approve it', async () => {
    await seedUser('scopeGap1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('scopeGap1').firestore()
    await assertSucceeds(db.collection('refund_requests').add({ customer: 'x', amount: 1000, status: 'pending' }))
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('refund_requests/r1').set({ customer: 'x', amount: 1000, status: 'pending' })
    })
    await assertFails(db.collection('refund_requests').doc('r1').update({ status: 'approved' }))
  })

  it('refund_requests: finance can approve a refund request', async () => {
    await seedUser('scopeGap2', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('scopeGap2').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('refund_requests/r2').set({ customer: 'x', amount: 1000, status: 'pending' })
    })
    await assertSucceeds(db.collection('refund_requests').doc('r2').update({ status: 'approved' }))
  })

  it('purchase_orders: a plain staff member cannot approve a purchase order', async () => {
    await seedUser('scopeGap3', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('scopeGap3').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('purchase_orders/p1').set({ status: 'pending' })
    })
    await assertFails(db.collection('purchase_orders').doc('p1').update({ status: 'approved' }))
  })

  it('purchase_orders: a manager can approve a purchase order', async () => {
    await seedUser('scopeGap4', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('scopeGap4').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('purchase_orders/p2').set({ status: 'pending' })
    })
    await assertSucceeds(db.collection('purchase_orders').doc('p2').update({ status: 'approved' }))
  })

  it('supplier_pos: a plain staff member cannot mark a supplier PO received', async () => {
    await seedUser('scopeGap5', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('scopeGap5').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('supplier_pos/sp1').set({ status: 'pending' })
    })
    await assertFails(db.collection('supplier_pos').doc('sp1').update({ status: 'received' }))
  })

  it('debts: a plain staff member cannot mark a debt as paid', async () => {
    await seedUser('scopeGap6', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('scopeGap6').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('debts/d1').set({ amount: 5000, status: 'pending' })
    })
    await assertFails(db.collection('debts').doc('d1').update({ status: 'paid' }))
  })

  it('debts: finance can mark a debt as paid', async () => {
    await seedUser('scopeGap7', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('scopeGap7').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('debts/d2').set({ amount: 5000, status: 'pending' })
    })
    await assertSucceeds(db.collection('debts').doc('d2').update({ status: 'paid' }))
  })

  it('deposits: a plain staff member cannot change a deposit status', async () => {
    await seedUser('scopeGap8', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('scopeGap8').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('deposits/dp1').set({ amount: 20000, status: 'held' })
    })
    await assertFails(db.collection('deposits').doc('dp1').update({ status: 'forfeited' }))
  })

  it('trade_ins: a plain staff member cannot approve a trade-in offer', async () => {
    await seedUser('scopeGap9', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('scopeGap9').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('trade_ins/t1').set({ status: 'appraisal', offerPrice: 300000 })
    })
    await assertFails(db.collection('trade_ins').doc('t1').update({ status: 'offered' }))
  })

  it('warranty_claims: a plain staff member cannot approve a warranty claim', async () => {
    await seedUser('scopeGap10', { role: 'service', active: true })
    const db = testEnv.authenticatedContext('scopeGap10').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('warranty_claims/w1').set({ status: 'submitted', partCost: 5000 })
    })
    await assertFails(db.collection('warranty_claims').doc('w1').update({ status: 'approved' }))
  })

  it('warranty_service_claims: a plain staff member cannot approve a warranty service claim', async () => {
    await seedUser('scopeGap11', { role: 'service', active: true })
    const db = testEnv.authenticatedContext('scopeGap11').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('warranty_service_claims/w2').set({ status: 'submitted' })
    })
    await assertFails(db.collection('warranty_service_claims').doc('w2').update({ status: 'approved' }))
  })

  it('finance_rate_sheets: a plain staff member cannot confirm a bank rate sheet', async () => {
    await seedUser('scopeGap12', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('scopeGap12').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('finance_rate_sheets/f1').set({ status: 'draft' })
    })
    await assertFails(db.collection('finance_rate_sheets').doc('f1').update({ status: 'confirmed' }))
  })

  it('finance_rate_sheets: finance can confirm a bank rate sheet', async () => {
    await seedUser('scopeGap13', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('scopeGap13').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('finance_rate_sheets/f2').set({ status: 'draft' })
    })
    await assertSucceeds(db.collection('finance_rate_sheets').doc('f2').update({ status: 'confirmed' }))
  })
})

// v1.0.300 — ตรวจสอบต่อ 4 จุดที่คลุมเครือจาก v1.0.299: finance_applications/finance_tracker เป็นเครื่องมือ
// ที่เซลส์เจ้าของดีลใช้ประจำ (ติ๊กเอกสาร/เลื่อนสถานะระหว่างทาง) จึงล็อกเฉพาะการเปลี่ยนสถานะเป็น
// "อนุมัติ/ปฏิเสธ" (ผลจริงจากธนาคาร) ไม่ล็อกทั้ง collection — ส่วน cashier_payments/cashier_pending_bills
// (จุดรับชำระเงินสด) ล็อกทั้งการเขียนให้การเงิน/ผู้จัดการเท่านั้น (ป้องกันปลอมบันทึกรับเงิน)
describe('finance application/tracker + cashier desk (v1.0.300) — lock only the money-deciding action', () => {
  it('finance_applications: staff can create a new application', async () => {
    await seedUser('scopeGap14', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('scopeGap14').firestore()
    await assertSucceeds(db.collection('finance_applications').add({ custName: 'x', loanAmount: 500000, status: 'submitted' }))
  })

  it('finance_applications: staff can update non-status fields (e.g. the document checklist) on their own tracked deal', async () => {
    await seedUser('scopeGap15', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('scopeGap15').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('finance_applications/fa1').set({ custName: 'x', status: 'submitted', documents: [] })
    })
    await assertSucceeds(db.collection('finance_applications').doc('fa1').update({ documents: ['บัตรประชาชน'] }))
  })

  it('finance_applications: staff can move a non-terminal status forward (e.g. submitted -> pending)', async () => {
    await seedUser('scopeGap16', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('scopeGap16').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('finance_applications/fa2').set({ custName: 'x', status: 'submitted' })
    })
    await assertSucceeds(db.collection('finance_applications').doc('fa2').update({ status: 'pending' }))
  })

  it('finance_applications: a plain staff member cannot flip status to approved', async () => {
    await seedUser('scopeGap17', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('scopeGap17').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('finance_applications/fa3').set({ custName: 'x', status: 'pending' })
    })
    await assertFails(db.collection('finance_applications').doc('fa3').update({ status: 'approved' }))
  })

  it('finance_applications: finance can flip status to approved', async () => {
    await seedUser('scopeGap18', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('scopeGap18').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('finance_applications/fa4').set({ custName: 'x', status: 'pending' })
    })
    await assertSucceeds(db.collection('finance_applications').doc('fa4').update({ status: 'approved' }))
  })

  it('finance_tracker: staff can move a non-terminal status forward (e.g. submitted -> reviewing)', async () => {
    await seedUser('scopeGap19', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('scopeGap19').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('finance_tracker/ft1').set({ customerName: 'x', status: 'submitted' })
    })
    await assertSucceeds(db.collection('finance_tracker').doc('ft1').update({ status: 'reviewing' }))
  })

  it('finance_tracker: a plain staff member cannot flip status to approved', async () => {
    await seedUser('scopeGap20', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('scopeGap20').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('finance_tracker/ft2').set({ customerName: 'x', status: 'reviewing' })
    })
    await assertFails(db.collection('finance_tracker').doc('ft2').update({ status: 'approved' }))
  })

  it('finance_tracker: a manager can flip status to rejected', async () => {
    await seedUser('scopeGap21', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('scopeGap21').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('finance_tracker/ft3').set({ customerName: 'x', status: 'reviewing' })
    })
    await assertSucceeds(db.collection('finance_tracker').doc('ft3').update({ status: 'rejected' }))
  })

  it('cashier_payments: a plain staff member cannot record a cash payment', async () => {
    await seedUser('scopeGap22', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('scopeGap22').firestore()
    await assertFails(db.collection('cashier_payments').add({ customer: 'x', amount: 5000, method: 'cash' }))
  })

  it('cashier_payments: finance can record a cash payment', async () => {
    await seedUser('scopeGap23', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('scopeGap23').firestore()
    await assertSucceeds(db.collection('cashier_payments').add({ customer: 'x', amount: 5000, method: 'cash' }))
  })

  it('cashier_pending_bills: a plain staff member cannot delete a pending bill', async () => {
    await seedUser('scopeGap24', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('scopeGap24').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('cashier_pending_bills/b1').set({ customer: 'x', amount: 5000 })
    })
    await assertFails(db.collection('cashier_pending_bills').doc('b1').delete())
  })

  it('cashier_pending_bills: finance can delete a pending bill once paid', async () => {
    await seedUser('scopeGap25', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('scopeGap25').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('cashier_pending_bills/b2').set({ customer: 'x', amount: 5000 })
    })
    await assertSucceeds(db.collection('cashier_pending_bills').doc('b2').delete())
  })
})

// v1.0.301 — พบระหว่างตรวจสอบช่องทางนำเข้าไฟล์ CSV/Excel/JSON ทั่วแอปว่า vehicle_catalog_overrides/
// _additions (ใช้เก็บการแก้ไข/เพิ่มรุ่นรถ รวมถึงตอนนำเข้าไฟล์ .json สำรอง/กู้คืนข้อมูลในหน้า Vehicle
// Database) ไม่เคยมี match block มาก่อนเลย ทำให้ค่าที่แก้ไขผ่านช่องทางนี้ (ซึ่งไปทับข้อมูลรถจริงที่แสดงผล
// ทั่วทั้งแอป) ไม่ผ่านการเช็คราคา/ต้นทุนติดลบแบบเดียวกับ collection vehicles หลักเลย
describe('vehicle_catalog_overrides/_additions (v1.0.301) — same numeric bounds as vehicles', () => {
  it('vehicle_catalog_overrides: staff cannot write a negative price via an override', async () => {
    await seedUser('scopeGap26', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('scopeGap26').firestore()
    await assertFails(db.collection('vehicle_catalog_overrides').add({ price: -1, cost: 500000 }))
  })

  it('vehicle_catalog_additions: staff cannot write a negative cost via a JSON import', async () => {
    await seedUser('scopeGap27', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('scopeGap27').firestore()
    await assertFails(db.collection('vehicle_catalog_additions').add({ brand: 'BYD', model: 'Atto 3', price: 899000, cost: -1 }))
  })

  it('vehicle_catalog_overrides: staff can still write a normal non-negative override', async () => {
    await seedUser('scopeGap28', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('scopeGap28').firestore()
    await assertSucceeds(db.collection('vehicle_catalog_overrides').add({ price: 899000, cost: 750000 }))
  })
})

// v1.0.303 — เงินเดือนย้ายออกจาก staff/{docId} (ที่ isStaff() อ่านได้กว้างมาก) ไปเก็บที่ staff_salaries
// แยกต่างหาก (จำกัด HR/การเงิน/ผู้จัดการเท่านั้น) เดิม field salary ฝังอยู่ในเอกสารเดียวกับชื่อ/แผนก/เบอร์
// โทรที่ทุกคนอ่านได้ ทำให้พนักงานทุกคนดึงเงินเดือนของเพื่อนร่วมงานผ่าน Firestore SDK ตรงๆได้ แม้ v1.0.302
// จะซ่อนที่ UI ไปแล้วก็ตาม (แค่ปิดที่ UI ไม่ได้ปิดที่ข้อมูลจริง)
describe('staff_salaries (v1.0.303) — salary moved out of the broadly-readable staff collection', () => {
  it('staff_salaries: a plain staff member cannot read anyone\'s salary', async () => {
    await seedUser('salScope1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('salScope1').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('staff_salaries/emp1').set({ salary: 25000 })
    })
    await assertFails(db.collection('staff_salaries').doc('emp1').get())
  })

  it('staff_salaries: HR can read a salary', async () => {
    await seedUser('salScope2', { role: 'hr', active: true })
    const db = testEnv.authenticatedContext('salScope2').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('staff_salaries/emp2').set({ salary: 25000 })
    })
    await assertSucceeds(db.collection('staff_salaries').doc('emp2').get())
  })

  it('staff_salaries: HR can set a salary, but not a negative one', async () => {
    await seedUser('salScope3', { role: 'hr', active: true })
    const db = testEnv.authenticatedContext('salScope3').firestore()
    await assertSucceeds(db.collection('staff_salaries').doc('emp3').set({ salary: 30000 }))
    await assertFails(db.collection('staff_salaries').doc('emp3').set({ salary: -1 }))
  })

  it('staff_salaries: a plain staff member cannot write a salary', async () => {
    await seedUser('salScope4', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('salScope4').firestore()
    await assertFails(db.collection('staff_salaries').doc('emp4').set({ salary: 30000 }))
  })

  it('staff: HR cannot create a brand-new staff record with a salary field on it', async () => {
    await seedUser('salScope5', { role: 'hr', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('salScope5').firestore()
    await assertFails(db.collection('staff').add({ firstName: 'A', lastName: 'B', salary: 20000 }))
  })

  it('staff: HR can still create a new staff record with no salary field at all', async () => {
    await seedUser('salScope6', { role: 'hr', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('salScope6').firestore()
    await assertSucceeds(db.collection('staff').add({ firstName: 'A', lastName: 'B' }))
  })

  it('staff: HR can still edit other fields on a legacy record that still has an embedded salary, as long as the salary value itself is left unchanged', async () => {
    await seedUser('salScope7', { role: 'hr', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('salScope7').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('staff/legacy1').set({ firstName: 'A', lastName: 'B', salary: 22000 })
    })
    await assertSucceeds(db.collection('staff').doc('legacy1').update({ phone: '0812345678' }))
  })

  it('staff: HR cannot change the salary value on a legacy record via the staff doc anymore', async () => {
    await seedUser('salScope8', { role: 'hr', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('salScope8').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('staff/legacy2').set({ firstName: 'A', lastName: 'B', salary: 22000 })
    })
    await assertFails(db.collection('staff').doc('legacy2').update({ salary: 99999 }))
  })
})

// v1.0.444 — เก็บ PII อ่อนไหวสูงของพนักงาน (เลขบัตรประชาชน/วันเกิด/ที่อยู่/ผู้ติดต่อฉุกเฉิน/บัญชีธนาคาร)
// แยกออกจาก staff/{docId} เหมือน pattern เดียวกับ staff_salaries (v1.0.303) เป๊ะ — กันไม่ให้พนักงานทุกคน
// (isStaff() อ่าน staff doc ได้กว้าง) เห็นเลขบัตรประชาชน/บัญชีธนาคารของเพื่อนร่วมงานได้ถ้าเผลอฝัง field
// พวกนี้ไว้ใน staff doc ตรงๆ
describe('staff_pii (v1.0.444) — sensitive PII scoped to HR/finance/manager only', () => {
  it('a plain staff member cannot read a colleague\'s national ID/PII record', async () => {
    await seedUser('piiScope1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('piiScope1').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('staff_pii/emp1').set({ nationalId: '1234567890123' })
    })
    await assertFails(db.collection('staff_pii').doc('emp1').get())
  })

  it('HR can read a staff PII record', async () => {
    await seedUser('piiScope2', { role: 'hr', active: true })
    const db = testEnv.authenticatedContext('piiScope2').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('staff_pii/emp2').set({ nationalId: '1234567890123' })
    })
    await assertSucceeds(db.collection('staff_pii').doc('emp2').get())
  })

  it('a plain staff member cannot write a colleague\'s PII record', async () => {
    await seedUser('piiScope3', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('piiScope3').firestore()
    await assertFails(db.collection('staff_pii').doc('emp3').set({ nationalId: '1234567890123' }))
  })

  it('HR can write a staff PII record', async () => {
    await seedUser('piiScope4', { role: 'hr', active: true })
    const db = testEnv.authenticatedContext('piiScope4').firestore()
    await assertSucceeds(db.collection('staff_pii').doc('emp4').set({ nationalId: '1234567890123', bankAccount: '1112223334' }))
  })
})

// v1.0.304 — สานต่อการตรวจสอบ PII ที่เข้าถึงได้กว้างเกินไป: เลขบัตรประชาชนลูกค้าใน bookings, ที่อยู่ลูกค้า
// ในบริการรับ-ส่งรถ, และเงินเดือนใน staff_profiles (collection คู่ขนานของ staff ที่หลุดรอดจากการแก้ v1.0.303)
describe('booking_national_ids (v1.0.304) — customer national ID scoped to sales/finance/manager only', () => {
  it('a service-role staff member cannot read a customer national ID', async () => {
    await seedUser('pii1', { role: 'service', active: true })
    const db = testEnv.authenticatedContext('pii1').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('booking_national_ids/bk1').set({ nid: '1234567890123' })
    })
    await assertFails(db.collection('booking_national_ids').doc('bk1').get())
  })

  it('a sales-role staff member can read a customer national ID', async () => {
    await seedUser('pii2', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('pii2').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('booking_national_ids/bk2').set({ nid: '1234567890123' })
    })
    await assertSucceeds(db.collection('booking_national_ids').doc('bk2').get())
  })

  it('bookings: staff cannot create a booking with a national ID field on it', async () => {
    await seedUser('pii3', { role: 'sales', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('pii3').firestore()
    await assertFails(db.collection('bookings').add({ custName: 'x', nid: '1234567890123' }))
  })

  it('bookings: staff can still create a booking with no national ID field at all', async () => {
    await seedUser('pii4', { role: 'sales', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('pii4').firestore()
    await assertSucceeds(db.collection('bookings').add({ custName: 'x' }))
  })

  it('bookings: staff can still edit other fields on a legacy booking that still has an embedded nid, as long as nid itself is left unchanged', async () => {
    await seedUser('pii5', { role: 'sales', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('pii5').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('bookings/legacyBk1').set({ custName: 'x', nid: '1234567890123' })
    })
    await assertSucceeds(db.collection('bookings').doc('legacyBk1').update({ phone: '0812345678' }))
  })

  it('bookings: staff cannot change the nid value on a legacy booking via the bookings doc anymore', async () => {
    await seedUser('pii6', { role: 'sales', active: true, groupWide: true })
    const db = testEnv.authenticatedContext('pii6').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('bookings/legacyBk2').set({ custName: 'x', nid: '1234567890123' })
    })
    await assertFails(db.collection('bookings').doc('legacyBk2').update({ nid: '9999999999999' }))
  })
})

// v1.0.455 — Phase 0.5: canSeeCompanyDoc() เปิดใช้งานจริงกับ tasks เป็น collection แรก (ผู้อ่านน้อยสุดใน
// บรรดา 6 collection ของ Phase 0 — v1.0.453 — แก้ query ครบทุกหน้าแล้วก่อนปิด rule ดูรายละเอียดที่ไฟล์แผน
// C:\Users\ghunt\.claude\plans\inherited-shimmying-leaf.md) — 5 เคสนี้พิสูจน์ว่ากลไกบังคับจริง ไม่ใช่แค่กรองผิว
// (ดู list-query เคสที่ 4/5 โดยเฉพาะ — Firestore ปฏิเสธทั้ง query ถ้า where ไม่ตรงกับ rule ไม่ใช่กรองผลลัพธ์
// บางส่วนออกเงียบๆ)
describe('company scoping — core mechanism, first real collection: tasks (v1.0.455)', () => {
  // (v1.0.465) นโยบายที่เจ้าของระบบยืนยันชัดเจน: "แอดมิน/เจ้าของบริษัทเห็นได้เฉพาะบริษัทตัวเองเท่านั้น
  // ยกเว้นฉันซึ่งเป็นเจ้าของโปรแกรม" — canSeeCompanyDoc() เปลี่ยนจาก isAdmin() (role owner/admin ใครก็ได้)
  // เป็น isProgramOwner() (ผูกกับอีเมลบัญชีเดียวเท่านั้น) เทสนี้เดิมชื่อ "owner sees..." ทดสอบด้วย role='owner'
  // เฉยๆ (ไม่ผูกอีเมล) ซึ่งตอนนี้ "ไม่ควร" ข้ามบริษัทได้อีกต่อไป — แก้เทสให้ตรงกับพฤติกรรมใหม่ที่ตั้งใจ
  it('the program-owner account (by email) sees a task from a company they are not a member of', async () => {
    await seedUser('csProgOwner', { role: 'owner', active: true })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('tasks/csT1').set({ title: 'x', companyId: 'companyB' })
    })
    const db = testEnv.authenticatedContext('csProgOwner', { email: 'ghunt1007@gmail.com' }).firestore()
    await assertSucceeds(db.doc('tasks/csT1').get())
    await assertSucceeds(db.collection('tasks').get())
  })

  it('a plain owner-role account that is NOT the program-owner email is company-scoped like anyone else (the actual policy change)', async () => {
    await seedUser('csOwner1', { role: 'owner', active: true, companyIds: ['companyA'] })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('tasks/csT1b').set({ title: 'x', companyId: 'companyB' })
    })
    const db = testEnv.authenticatedContext('csOwner1', { email: 'somsak@lamom.one' }).firestore()
    await assertFails(db.doc('tasks/csT1b').get())
    await assertFails(db.collection('tasks').get())
    await assertSucceeds(db.collection('tasks').where('companyId', 'in', ['companyA']).get())
  })

  it('a groupWide:true user sees a task from a company they are not a member of', async () => {
    await seedUser('csHr1', { role: 'hr', active: true, companyIds: ['companyA'], groupWide: true })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('tasks/csT2').set({ title: 'x', companyId: 'companyB' })
    })
    const db = testEnv.authenticatedContext('csHr1').firestore()
    await assertSucceeds(db.doc('tasks/csT2').get())
    await assertSucceeds(db.collection('tasks').get())
  })

  it('a company-scoped sales user CANNOT open a task belonging to a different company directly', async () => {
    await seedUser('csSales1', { role: 'sales', active: true, companyIds: ['companyA'] })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('tasks/csT3').set({ title: 'x', companyId: 'companyB' })
    })
    const db = testEnv.authenticatedContext('csSales1').firestore()
    await assertFails(db.doc('tasks/csT3').get())
  })

  it('a company-scoped sales user CAN list tasks when the query is properly scoped with a matching where clause', async () => {
    await seedUser('csSales2', { role: 'sales', active: true, companyIds: ['companyA'] })
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('tasks/csT4').set({ title: 'x', companyId: 'companyA' })
    })
    const db = testEnv.authenticatedContext('csSales2').firestore()
    await assertSucceeds(db.collection('tasks').where('companyId', 'in', ['companyA']).get())
  })

  it('a company-scoped sales user CANNOT list tasks with no where clause at all — proves enforcement is real, not cosmetic', async () => {
    await seedUser('csSales3', { role: 'sales', active: true, companyIds: ['companyA'] })
    const db = testEnv.authenticatedContext('csSales3').firestore()
    await assertFails(db.collection('tasks').get())
  })
})

describe('courtesy_car_jobs (v1.0.304) — pickup/delivery customer address scoped to service/manager', () => {
  it('an HR-role staff member cannot read a customer pickup address', async () => {
    await seedUser('pii7', { role: 'hr', active: true })
    const db = testEnv.authenticatedContext('pii7').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('courtesy_car_jobs/j1').set({ customer: 'x', address: '123 ถนนสุขุมวิท' })
    })
    await assertFails(db.collection('courtesy_car_jobs').doc('j1').get())
  })

  it('a service-role staff member can read and create a pickup job', async () => {
    await seedUser('pii8', { role: 'service', active: true })
    const db = testEnv.authenticatedContext('pii8').firestore()
    await assertSucceeds(db.collection('courtesy_car_jobs').add({ customer: 'x', address: '123 ถนนสุขุมวิท' }))
  })
})

describe('staff_profile_salaries (v1.0.304) — salary in the parallel staff_profiles directory', () => {
  it('a plain staff member cannot read a salary from staff_profile_salaries', async () => {
    await seedUser('pii9', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('pii9').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('staff_profile_salaries/sp1').set({ salary: 25000 })
    })
    await assertFails(db.collection('staff_profile_salaries').doc('sp1').get())
  })

  it('staff_profiles: HR cannot create a new profile with a salary field on it', async () => {
    await seedUser('pii10', { role: 'hr', active: true })
    const db = testEnv.authenticatedContext('pii10').firestore()
    await assertFails(db.collection('staff_profiles').add({ name: 'A', salary: 20000 }))
  })

  it('staff_profiles: HR can still create a new profile with no salary field at all', async () => {
    await seedUser('pii11', { role: 'hr', active: true })
    const db = testEnv.authenticatedContext('pii11').firestore()
    await assertSucceeds(db.collection('staff_profiles').add({ name: 'A' }))
  })
})

describe('payment_transactions + installment_plans (v1.0.306) — lock only the money-confirming action', () => {
  it('payment_transactions: a plain sales staff can create a pending payment QR request', async () => {
    await seedUser('payGap1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('payGap1').firestore()
    await assertSucceeds(db.collection('payment_transactions').add({ ref: 'INV-1', customer: 'x', amount: 5000, status: 'pending' }))
  })

  it('payment_transactions: a plain sales staff CANNOT confirm a payment as success (the real exploit)', async () => {
    await seedUser('payGap2', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('payGap2').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('payment_transactions/tx1').set({ ref: 'INV-1', customer: 'x', amount: 5000, status: 'pending' })
    })
    await assertFails(db.collection('payment_transactions').doc('tx1').update({ status: 'success' }))
  })

  it('payment_transactions: finance can confirm a payment as success', async () => {
    await seedUser('payGap3', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('payGap3').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('payment_transactions/tx2').set({ ref: 'INV-1', customer: 'x', amount: 5000, status: 'pending' })
    })
    await assertSucceeds(db.collection('payment_transactions').doc('tx2').update({ status: 'success' }))
  })

  it('installment_plans: a plain sales staff cannot create a new installment plan', async () => {
    await seedUser('payGap4', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('payGap4').firestore()
    await assertFails(db.collection('installment_plans').add({ customer: 'x', total: 500000, totalInst: 36, monthly: 15000, paid: 0, status: 'current' }))
  })

  it('installment_plans: a plain sales staff cannot record a fake paid installment (the real exploit)', async () => {
    await seedUser('payGap5', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('payGap5').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('installment_plans/p1').set({ customer: 'x', total: 500000, totalInst: 36, monthly: 15000, paid: 0, status: 'current' })
    })
    await assertFails(db.collection('installment_plans').doc('p1').update({ paid: 1, status: 'current' }))
  })

  it('installment_plans: finance can record a paid installment', async () => {
    await seedUser('payGap6', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('payGap6').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('installment_plans/p2').set({ customer: 'x', total: 500000, totalInst: 36, monthly: 15000, paid: 0, status: 'current' })
    })
    await assertSucceeds(db.collection('installment_plans').doc('p2').update({ paid: 1, status: 'current' }))
  })
})

describe('insurance_claims + tax_filings (v1.0.307) — lock only the money/compliance decision', () => {
  it('insurance_claims: a plain service staff can file a new claim', async () => {
    await seedUser('insGap1', { role: 'service', active: true })
    const db = testEnv.authenticatedContext('insGap1').firestore()
    await assertSucceeds(db.collection('insurance_claims').add({ customer: 'x', plate: 'x', estimate: 20000, approved: 0, status: 'reported' }))
  })

  it('insurance_claims: a plain service staff can advance status through non-money stages (reported -> surveying)', async () => {
    await seedUser('insGap2', { role: 'service', active: true })
    const db = testEnv.authenticatedContext('insGap2').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('insurance_claims/c1').set({ customer: 'x', estimate: 20000, approved: 0, status: 'reported' })
    })
    await assertSucceeds(db.collection('insurance_claims').doc('c1').update({ status: 'surveying' }))
  })

  it('insurance_claims: a plain service staff CANNOT approve a claim (set status + payout amount)', async () => {
    await seedUser('insGap3', { role: 'service', active: true })
    const db = testEnv.authenticatedContext('insGap3').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('insurance_claims/c2').set({ customer: 'x', estimate: 20000, approved: 0, status: 'surveying' })
    })
    await assertFails(db.collection('insurance_claims').doc('c2').update({ status: 'approved', approved: 20000 }))
  })

  it('insurance_claims: a plain service staff CANNOT inflate the approved payout amount without touching status', async () => {
    await seedUser('insGap4', { role: 'service', active: true })
    const db = testEnv.authenticatedContext('insGap4').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('insurance_claims/c3').set({ customer: 'x', estimate: 20000, approved: 20000, status: 'approved' })
    })
    await assertFails(db.collection('insurance_claims').doc('c3').update({ approved: 999999 }))
  })

  it('insurance_claims: manager can approve a claim', async () => {
    await seedUser('insGap5', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('insGap5').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('insurance_claims/c4').set({ customer: 'x', estimate: 20000, approved: 0, status: 'surveying' })
    })
    await assertSucceeds(db.collection('insurance_claims').doc('c4').update({ status: 'approved', approved: 20000 }))
  })

  it('tax_filings: a plain sales staff cannot mark a filing as filed', async () => {
    await seedUser('taxGap1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('taxGap1').firestore()
    await assertFails(db.collection('tax_filings').add({ baseId: 'vat-2026-07', status: 'filed', filedDate: '2026-07-30' }))
  })

  it('tax_filings: finance can mark a filing as filed', async () => {
    await seedUser('taxGap2', { role: 'finance', active: true })
    const db = testEnv.authenticatedContext('taxGap2').firestore()
    await assertSucceeds(db.collection('tax_filings').add({ baseId: 'vat-2026-07', status: 'filed', filedDate: '2026-07-30' }))
  })
})

describe('gov_docs (v1.0.308) — no dedicated rule existed at all, fell to the open catch-all', () => {
  it('a plain staff member can create a new gov doc tracking record', async () => {
    await seedUser('govGap1', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('govGap1').firestore()
    await assertSucceeds(db.collection('gov_docs').add({ type: 'โอนกรรมสิทธิ์', customer: 'x', vin: 'x', status: 'รอดำเนินการ' }))
  })

  it('a plain staff member can advance status through non-final stages', async () => {
    await seedUser('govGap2', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('govGap2').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('gov_docs/g1').set({ type: 'โอนกรรมสิทธิ์', customer: 'x', status: 'รอดำเนินการ' })
    })
    await assertSucceeds(db.collection('gov_docs').doc('g1').update({ status: 'กำลังดำเนินการ' }))
  })

  it('a plain staff member CANNOT mark a gov doc as เสร็จสิ้น (fake-certify government paperwork done)', async () => {
    await seedUser('govGap3', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('govGap3').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('gov_docs/g2').set({ type: 'โอนกรรมสิทธิ์', customer: 'x', status: 'กำลังดำเนินการ' })
    })
    await assertFails(db.collection('gov_docs').doc('g2').update({ status: 'เสร็จสิ้น' }))
  })

  it('a manager can mark a gov doc as เสร็จสิ้น', async () => {
    await seedUser('govGap4', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('govGap4').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('gov_docs/g3').set({ type: 'โอนกรรมสิทธิ์', customer: 'x', status: 'กำลังดำเนินการ' })
    })
    await assertSucceeds(db.collection('gov_docs').doc('g3').update({ status: 'เสร็จสิ้น' }))
  })
})

describe('parts_rma + custom_orders + compliance_events + gov_bids (v1.0.312) — no dedicated rule existed at all', () => {
  it('parts_rma: a plain service staff can create a new RMA request', async () => {
    await seedUser('rmaGap1', { role: 'service', active: true })
    const db = testEnv.authenticatedContext('rmaGap1').firestore()
    await assertSucceeds(db.collection('parts_rma').add({ partName: 'x', cost: 5000, status: 'pending' }))
  })

  it('parts_rma: a plain service staff CANNOT approve a supplier return credit', async () => {
    await seedUser('rmaGap2', { role: 'service', active: true })
    const db = testEnv.authenticatedContext('rmaGap2').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('parts_rma/r1').set({ partName: 'x', cost: 5000, status: 'pending' })
    })
    await assertFails(db.collection('parts_rma').doc('r1').update({ status: 'approved', refNo: 'REF-1' }))
  })

  it('parts_rma: manager can approve a supplier return credit', async () => {
    await seedUser('rmaGap3', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('rmaGap3').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('parts_rma/r2').set({ partName: 'x', cost: 5000, status: 'pending' })
    })
    await assertSucceeds(db.collection('parts_rma').doc('r2').update({ status: 'approved', refNo: 'REF-2' }))
  })

  it('custom_orders: a plain sales staff can create a new custom order', async () => {
    await seedUser('coGap1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('coGap1').firestore()
    await assertSucceeds(db.collection('custom_orders').add({ customerName: 'x', vehicleModel: 'x', status: 'new' }))
  })

  it('custom_orders: a plain sales staff CANNOT mark a custom order as delivered', async () => {
    await seedUser('coGap2', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('coGap2').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('custom_orders/c1').set({ customerName: 'x', status: 'ready' })
    })
    await assertFails(db.collection('custom_orders').doc('c1').update({ status: 'delivered' }))
  })

  it('custom_orders: manager can mark a custom order as delivered', async () => {
    await seedUser('coGap3', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('coGap3').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('custom_orders/c2').set({ customerName: 'x', status: 'ready' })
    })
    await assertSucceeds(db.collection('custom_orders').doc('c2').update({ status: 'delivered' }))
  })

  it('compliance_events: a plain staff member CANNOT mark a compliance deadline as done', async () => {
    await seedUser('ceGap1', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('ceGap1').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('compliance_events/e1').set({ title: 'x', status: 'pending' })
    })
    await assertFails(db.collection('compliance_events').doc('e1').update({ status: 'done' }))
  })

  it('compliance_events: manager can mark a compliance deadline as done', async () => {
    await seedUser('ceGap2', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('ceGap2').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('compliance_events/e2').set({ title: 'x', status: 'pending' })
    })
    await assertSucceeds(db.collection('compliance_events').doc('e2').update({ status: 'done' }))
  })

  it('gov_bids: a plain sales staff CANNOT submit a binding bid amount to the government', async () => {
    await seedUser('gbGap1', { role: 'sales', active: true })
    const db = testEnv.authenticatedContext('gbGap1').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('gov_bids/b1').set({ title: 'x', budget: 1000000, status: 'preparing' })
    })
    await assertFails(db.collection('gov_bids').doc('b1').update({ ourBid: 950000, status: 'submitted' }))
  })

  it('gov_bids: manager can submit a binding bid amount to the government', async () => {
    await seedUser('gbGap2', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('gbGap2').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('gov_bids/b2').set({ title: 'x', budget: 1000000, status: 'preparing' })
    })
    await assertSucceeds(db.collection('gov_bids').doc('b2').update({ ourBid: 950000, status: 'submitted' }))
  })
})

describe('system_backup_config (v1.0.316) — same sensitivity level as system_backups', () => {
  it('a plain staff member cannot read backup schedule config', async () => {
    await seedUser('bkGap1', { role: 'staff', active: true })
    const db = testEnv.authenticatedContext('bkGap1').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('system_backup_config/default').set({ schedule: 'daily', retention: 30 })
    })
    await assertFails(db.collection('system_backup_config').doc('default').get())
  })

  it('a plain manager cannot write backup schedule config (isAdmin() only, not isManager())', async () => {
    await seedUser('bkGap2', { role: 'manager', active: true })
    const db = testEnv.authenticatedContext('bkGap2').firestore()
    await assertFails(db.collection('system_backup_config').doc('default').set({ schedule: 'daily', retention: 30 }))
  })

  it('admin can read and write backup schedule config', async () => {
    await seedUser('bkGap3', { role: 'admin', active: true })
    const db = testEnv.authenticatedContext('bkGap3').firestore()
    await assertSucceeds(db.collection('system_backup_config').doc('default').set({ schedule: 'daily', retention: 30 }))
    await assertSucceeds(db.collection('system_backup_config').doc('default').get())
  })
})
