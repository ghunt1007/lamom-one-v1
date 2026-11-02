import { describe, it, expect, vi, afterEach } from 'vitest'
import { handleSheetPull, sheetFileId, serviceAccountEmail, SHEET_FILE_ID_DEFAULT } from './sheet-pull.js'

const env = { FIRESTORE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: 'bot@proj.iam.gserviceaccount.com' }) }
const deps = { getToken: async () => 'tok' }
const cors = { 'Access-Control-Allow-Origin': 'https://x' }
afterEach(() => vi.unstubAllGlobals())

describe('sheet pull', () => {
  it('uses the default file id unless one is set', () => {
    expect(sheetFileId({})).toBe(SHEET_FILE_ID_DEFAULT)
    expect(sheetFileId({ SHEET_FILE_ID: ' abc ' })).toBe('abc')
    expect(serviceAccountEmail(env)).toBe('bot@proj.iam.gserviceaccount.com')
    expect(serviceAccountEmail({})).toBe('')
  })

  it('returns only the modified time for /sheet/status', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ name: 'DATA.xlsx', mimeType: 'x', modifiedTime: '2026-11-02T10:00:00Z' })))
    vi.stubGlobal('fetch', f)
    const r = await handleSheetPull(env, deps, cors, { metaOnly: true })
    expect(await r.json()).toEqual({ name: 'DATA.xlsx', modifiedTime: '2026-11-02T10:00:00Z' })
    expect(f).toHaveBeenCalledTimes(1)
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer tok')
  })

  it('downloads an uploaded xlsx with alt=media and exposes name + modified time', async () => {
    const f = vi.fn(async url => url.includes('alt=media')
      ? new Response(new Uint8Array([1, 2, 3]))
      : new Response(JSON.stringify({ name: 'DATA Booking.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', modifiedTime: '2026-11-02T10:00:00Z' })))
    vi.stubGlobal('fetch', f)
    const r = await handleSheetPull(env, deps, cors)
    expect(r.status).toBe(200)
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
    expect(decodeURIComponent(r.headers.get('X-Sheet-Name'))).toBe('DATA Booking.xlsx')
    expect(r.headers.get('X-Sheet-Modified')).toBe('2026-11-02T10:00:00Z')
    expect(r.headers.get('Access-Control-Expose-Headers')).toContain('X-Sheet-Modified')
  })

  it('exports a native Google Sheet as xlsx', async () => {
    const f = vi.fn(async url => url.includes('/export')
      ? new Response('x')
      : new Response(JSON.stringify({ name: 'DATA', mimeType: 'application/vnd.google-apps.spreadsheet', modifiedTime: '2026-11-02T10:00:00Z' })))
    vi.stubGlobal('fetch', f)
    await handleSheetPull(env, deps, cors)
    expect(f.mock.calls[1][0]).toContain('/export?mimeType=application%2Fvnd.openxmlformats')
  })

  it('tells the owner which email to share the file with when Drive says no', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'File not found' } }), { status: 404 })))
    const r = await handleSheetPull(env, deps, cors)
    expect(r.status).toBe(409)
    expect(await r.json()).toMatchObject({ error: 'not_shared', shareWith: 'bot@proj.iam.gserviceaccount.com', fileId: SHEET_FILE_ID_DEFAULT })
  })

  it('spots a disabled Drive API and passes the enable link', async () => {
    const body = { error: { message: 'Google Drive API has not been used in project 123 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=123 then retry.', errors: [{ reason: 'accessNotConfigured' }] } }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 403 })))
    const r = await handleSheetPull(env, deps, cors)
    expect(await r.json()).toMatchObject({ error: 'drive_api_off', link: 'https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=123' })
  })

  it('fails clearly without a token', async () => {
    const r = await handleSheetPull(env, { getToken: async () => null }, cors)
    expect(r.status).toBe(500)
  })
})
