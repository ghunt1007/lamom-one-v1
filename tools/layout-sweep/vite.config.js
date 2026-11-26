import path from 'path'
const R = p => path.resolve(__dirname, p)
export default {
  root: R('../..'),
  server: { port: 5198 },
  logLevel: 'error',
  plugins: [{ name: 'fbstub', enforce: 'pre',
    resolveId(src) { if (/^firebase\//.test(src)) return R('fbstub.js'); return null },
    transformIndexHtml(html) { return html.replace('<head>', '<head><script type="module" src="/tools/layout-sweep/fix.js"></script>') },
  }],
}
