import { describe, it, expect } from 'vitest'
import { identityPatch, PROGRAM_OWNER_EMAIL } from './identitySync.js'

describe('identityPatch', () => {
  it('does nothing when the stored email already matches the login email', () => {
    expect(identityPatch('a@x.com', { email: 'a@x.com' })).toEqual({})
  })
  it('updates the stored email after the user changed their login email', () => {
    expect(identityPatch('new@x.com', { email: 'old@x.com' })).toEqual({ email: 'new@x.com' })
  })
  it('fills a missing stored email', () => {
    expect(identityPatch('a@x.com', {})).toEqual({ email: 'a@x.com' })
  })
  it('marks the program owner by account once, so a later email change keeps the rights', () => {
    expect(identityPatch(PROGRAM_OWNER_EMAIL, { email: PROGRAM_OWNER_EMAIL })).toEqual({ programOwner: true })
    expect(identityPatch(PROGRAM_OWNER_EMAIL.toUpperCase(), { email: PROGRAM_OWNER_EMAIL.toUpperCase(), programOwner: true })).toEqual({})
  })
  it('never marks anyone else as program owner', () => {
    expect(identityPatch('someone@x.com', { email: 'someone@x.com' }).programOwner).toBeUndefined()
  })
  it('ignores a missing login email', () => {
    expect(identityPatch(null, { email: 'a@x.com' })).toEqual({})
  })
})
