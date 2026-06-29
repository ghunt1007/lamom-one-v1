/**
 * Social Media Analytics — วิเคราะห์ Engagement รายแพลตฟอร์ม
 * Route: /marketing/social-analytics
 */
import { showToast } from '../../core/store.js'
import { exportToExcel } from '../../utils/importExport.js'

const PLATFORMS = [
  { id:'fb',  name:'Facebook',  icon:'📘', color:'#1877F2', followers:28400, growth:+380 },
  { id:'ig',  name:'Instagram', icon:'📸', color:'#E1306C', followers:15200, growth:+520 },
  { id:'tt',  name:'TikTok',    icon:'🎵', color:'#010101', followers:42100, growth:+1840 },
  { id:'yt',  name:'YouTube',   icon:'▶️', color:'#FF0000', followers:8900,  growth:+210 },
  { id:'line',name:'LINE OA',   icon:'💚', color:'#06C755', followers:19600, growth:+95  },
]

const MONTHLY = {
  fb:  [{ impressions:82000, reach:41000, engagement:3200, clicks:1800, leads:42 },
        { impressions:91000, reach:46000, engagement:3800, clicks:2100, leads:51 },
        { impressions:88000, reach:44000, engagement:3500, clicks:1950, leads:48 },
        { impressions:95000, reach:48000, engagement:4100, clicks:2300, leads:58 },
        { impressions:103000,reach:52000, engagement:4600, clicks:2600, leads:64 },
        { impressions:98000, reach:49000, engagement:4200, clicks:2400, leads:59 }],
  ig:  [{ impressions:55000, reach:28000, engagement:5100, clicks:980,  leads:22 },
        { impressions:61000, reach:31000, engagement:5800, clicks:1100, leads:28 },
        { impressions:58000, reach:29000, engagement:5400, clicks:1020, leads:24 },
        { impressions:67000, reach:34000, engagement:6200, clicks:1250, leads:31 },
        { impressions:74000, reach:38000, engagement:7100, clicks:1400, leads:36 },
        { impressions:70000, reach:35000, engagement:6600, clicks:1320, leads:33 }],
  tt:  [{ impressions:180000,reach:92000, engagement:18000,clicks:3200, leads:38 },
        { impressions:210000,reach:108000,engagement:22000,clicks:3800, leads:45 },
        { impressions:195000,reach:100000,engagement:20000,clicks:3500, leads:41 },
        { impressions:240000,reach:124000,engagement:26000,clicks:4200, leads:52 },
        { impressions:280000,reach:145000,engagement:31000,clicks:5100, leads:63 },
        { impressions:260000,reach:134000,engagement:28000,clicks:4700, leads:57 }],
  yt:  [{ impressions:21000, reach:11000, engagement:1800, clicks:420,  leads:8  },
        { impressions:24000, reach:12500, engagement:2100, clicks:480,  leads:10 },
        { impressions:22000, reach:11500, engagement:1950, clicks:450,  leads:9  },
        { impressions:28000, reach:14500, engagement:2400, clicks:560,  leads:12 },
        { impressions:32000, reach:16800, engagement:2800, clicks:640,  leads:14 },
        { impressions:30000, reach:15500, engagement:2600, clicks:600,  leads:13 }],
  line:[{ impressions:48000, reach:24000, engagement:8200, clicks:2100, leads:55 },
        { impressions:52000, reach:26000, engagement:9100, clicks:2300, leads:61 },
        { impressions:49000, reach:24500, engagement:8600, clicks:2200, leads:57 },
        { impressions:56000, reach:28000, engagement:9800, clicks:2500, leads:67 },
        { impressions:61000, reach:30500, engagement:10800,clicks:2750, leads:73 },
        { impressions:58000, reach:29000, engagement:10200,clicks:2600, leads:69 }],
}

const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.']

const TOP_POSTS = [
  { platform:'TikTok',  content:'รีวิว BYD Atto 3 สั้น 60 วิ',   views:128000, likes:4200, shares:890 },
  { platform:'Facebook',content:'โปรโมชั่น Mid-Year 2026',        views:52000,  likes:1800, shares:420 },
  { platform:'Instagram',content:'Photo Shoot BYD Seal สีใหม่',    views:38000,  likes:2900, shares:310 },
  { platform:'LINE OA', content:'Flash Deal สิ้นเดือน',            views:31000,  likes:1200, shares:95  },
]

export default async function SocialAnalyticsPage(container) {
  let selPlatform = 'fb'
  let selMonth = 5

  function render() {
    const pd  = PLATFORMS.find(p => p.id === selPlatform)
    const mdata = MONTHLY[selPlatform]?.[selMonth] || {}
    const engRate = mdata.reach > 0 ? ((mdata.engagement / mdata.reach) * 100).toFixed(1) : 0
    const totalLeads = Object.values(MONTHLY).reduce((s, arr) => s + (arr[selMonth]?.leads || 0), 0)
    const totalFollowers = PLATFORMS.reduce((s, p) => s + p.followers, 0)

    container.innerHTML = `
      <div class="page-content animate-slide">
        <div class="page-header">
          <div>
            <div class="page-title">📊 Social Media Analytics</div>
            <div class="page-subtitle">ติดตามผล ${PLATFORMS.length} แพลตฟอร์ม · Engagement · Leads · Growth</div>
          </div>
          <div class="page-actions">
            <div style="display:flex;gap:4px">
              ${MONTHS.map((m,i)=>`<button class="btn btn-xs ${i===selMonth?'btn-primary':'btn-secondary'} mo-btn" data-i="${i}">${m}</button>`).join('')}
            </div>
            <button class="btn btn-primary" id="export-btn" style="margin-left:8px">📥 Export</button>
          </div>
        </div>

        <!-- Platform tabs -->
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
          ${PLATFORMS.map(p => `
            <button class="plat-btn btn btn-xs ${selPlatform===p.id?'btn-primary':'btn-secondary'}" data-p="${p.id}"
              style="display:flex;align-items:center;gap:5px;padding:6px 12px">
              ${p.icon} ${p.name}
              <span style="font-size:0.6rem;opacity:0.8">${(p.followers/1000).toFixed(1)}K</span>
            </button>`).join('')}
        </div>

        <!-- Summary cards -->
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px">
          ${sc('👥 Followers', (pd.followers/1000).toFixed(1)+'K', 'var(--primary)')}
          ${sc('📈 Growth', '+'+pd.growth, 'var(--success)')}
          ${sc('👁 Reach', (mdata.reach/1000).toFixed(1)+'K', 'var(--text)')}
          ${sc('❤️ Engagement', (mdata.engagement/1000).toFixed(1)+'K', 'var(--warning)')}
          ${sc('🎯 Leads', mdata.leads||0, 'var(--success)')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <!-- Platform trend -->
          <div class="card" style="padding:14px">
            <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:12px">
              ${pd.icon} ${pd.name} — Engagement (6 เดือน)
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${MONTHS.map((m,i) => {
                const d = MONTHLY[selPlatform]?.[i] || {}
                const maxEng = Math.max(...(MONTHLY[selPlatform]||[]).map(x => x.engagement||0))
                const w = maxEng > 0 ? Math.round((d.engagement||0)/maxEng*100) : 0
                return `<div>
                  <div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:3px">
                    <span style="color:${i===selMonth?'var(--primary)':'var(--text-muted)'};font-weight:${i===selMonth?700:400}">${m}</span>
                    <span style="color:var(--text-muted)">Eng ${((d.engagement||0)/1000).toFixed(1)}K · Leads ${d.leads||0}</span>
                  </div>
                  <div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden">
                    <div style="height:100%;width:${w}%;background:${i===selMonth?'var(--primary)':'var(--primary)55'};border-radius:4px"></div>
                  </div>
                </div>`
              }).join('')}
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:0.72rem;color:var(--text-muted)">
              <span>Engagement Rate: <b style="color:var(--primary)">${engRate}%</b></span>
              <span>Clicks: ${(mdata.clicks||0).toLocaleString()}</span>
            </div>
          </div>

          <!-- Right side -->
          <div style="display:flex;flex-direction:column;gap:12px">
            <!-- All platforms comparison -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">
                🏆 Leads ทุกแพลตฟอร์ม (${MONTHS[selMonth]}) รวม ${totalLeads}
              </div>
              ${PLATFORMS.map(p => {
                const leads = MONTHLY[p.id]?.[selMonth]?.leads || 0
                const pct = totalLeads > 0 ? Math.round(leads/totalLeads*100) : 0
                return `<div style="margin-bottom:8px">
                  <div style="display:flex;justify-content:space-between;font-size:0.74rem;margin-bottom:3px">
                    <span>${p.icon} ${p.name}</span>
                    <span style="font-weight:700">${leads} leads (${pct}%)</span>
                  </div>
                  <div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden">
                    <div style="height:100%;width:${pct}%;background:var(--primary);border-radius:3px"></div>
                  </div>
                </div>`
              }).join('')}
            </div>

            <!-- Top posts -->
            <div class="card" style="padding:14px">
              <div style="font-size:0.76rem;font-weight:700;color:var(--text-muted);margin-bottom:10px">🔥 Top Posts</div>
              ${TOP_POSTS.map(p => `
                <div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:0.76rem">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
                    <span style="font-weight:600">${p.content}</span>
                    <span style="font-size:0.62rem;background:var(--surface-2);padding:1px 6px;border-radius:8px">${p.platform}</span>
                  </div>
                  <div style="font-size:0.68rem;color:var(--text-muted)">
                    👁 ${(p.views/1000).toFixed(0)}K · ❤️ ${p.likes.toLocaleString()} · 🔁 ${p.shares}
                  </div>
                </div>`).join('')}
            </div>

            <!-- Total audience -->
            <div class="card" style="padding:12px 14px;background:var(--primary)11;border:1px solid var(--primary)33">
              <div style="font-size:0.72rem;color:var(--text-muted)">📣 Total Audience</div>
              <div style="font-size:1.6rem;font-weight:900;color:var(--primary)">${(totalFollowers/1000).toFixed(1)}K</div>
              <div style="font-size:0.7rem;color:var(--text-muted)">รวมทุกแพลตฟอร์ม</div>
            </div>
          </div>
        </div>
      </div>`

    container.querySelectorAll('.mo-btn').forEach(b => b.addEventListener('click', () => { selMonth = parseInt(b.dataset.i); render() }))
    container.querySelectorAll('.plat-btn').forEach(b => b.addEventListener('click', () => { selPlatform = b.dataset.p; render() }))
    document.getElementById('export-btn')?.addEventListener('click', () => {
      const monthLabel = MONTHS[selMonth]
      exportToExcel(
        PLATFORMS.map(p => {
          const m = MONTHLY[p.id]?.[selMonth] || {}
          return {
            'แพลตฟอร์ม': p.name,
            'เดือน': monthLabel,
            'Followers': p.followers,
            'Impressions': m.impressions || 0,
            'Reach': m.reach || 0,
            'Engagement': m.engagement || 0,
            'Clicks': m.clicks || 0,
            'Leads': m.leads || 0,
            'Eng Rate %': m.reach > 0 ? parseFloat((m.engagement / m.reach * 100).toFixed(1)) : 0,
          }
        }),
        `Social_Analytics_${monthLabel}.xlsx`,
        'Social'
      )
      showToast('📥 Export Social Analytics แล้ว', 'success')
    })
  }

  function sc(l, v, c) {
    return `<div class="card" style="padding:10px 12px">
      <div style="font-size:0.64rem;color:var(--text-muted)">${l}</div>
      <div style="font-size:1rem;font-weight:900;color:${c};margin-top:1px">${v}</div>
    </div>`
  }

  render()
}
