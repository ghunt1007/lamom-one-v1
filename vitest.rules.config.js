import { defineConfig } from 'vitest/config'

// Separate config just for firestore.rules.test.js — needs the Firestore emulator
// running (see "test:rules" in package.json), so it's deliberately excluded from the
// main vitest.config.js used by the fast default `npm test`.
export default defineConfig({
  test: {
    include: ['firestore.rules.test.js'],
  },
})
