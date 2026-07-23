import { defineConfig } from 'vitest/config'

// firestore.rules.test.js needs the Firestore emulator running (see "test:rules" in
// package.json) — it's deliberately outside src/** and workers/** so the fast default
// `npm test` never needs Java/the emulator just to run in CI. Run it directly via
// `npm run test:rules`, which starts the emulator first.
export default defineConfig({
  test: {
    include: ['src/**/*.test.js', 'workers/**/*.test.js'],
  },
})
