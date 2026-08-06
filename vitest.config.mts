import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

/**
 * Unit tests for the pure logic — money, coupons, credentials, parsing.
 *
 * Deliberately scoped to functions with no Firestore or network dependency, so
 * the suite needs no emulator, no credentials and no network, and runs in about
 * a second. Anything transactional (grantEntitlementIdempotent above all) needs
 * the Firestore emulator and belongs in a separate integration suite.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
