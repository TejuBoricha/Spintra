import { test as defaultTest } from '@playwright/test';

type Skippable = { skip: (condition: boolean, reason?: string) => void };

/**
 * Skips pure frontend, layout, visual, or algorithm test suites in CI during
 * the `db-integration` job when NEXT_PUBLIC_SUPABASE_URL is set.
 *
 * Those suites are comprehensively executed by the `validate` job in demo-mode;
 * repeating them in `db-integration` alongside ~10 Supabase Docker containers
 * wastes 25+ minutes of runner compute with zero additional coverage.
 */
export function skipInDbIntegration(
  testOrReason?: Skippable | string,
  maybeReason?: string
) {
  const reason = typeof testOrReason === 'string'
    ? testOrReason
    : (maybeReason ?? 'pure UI or offline test; covered by validate job (see .github/workflows/ci.yml)');
  const t = (testOrReason && typeof testOrReason === 'object' && 'skip' in testOrReason && typeof testOrReason.skip === 'function')
    ? testOrReason
    : defaultTest;
  t.skip(Boolean(process.env.CI && process.env.NEXT_PUBLIC_SUPABASE_URL), reason);
}
