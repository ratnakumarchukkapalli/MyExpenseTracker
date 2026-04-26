import { test, expect } from '@playwright/test';

/**
 * Regression test: homepage must not make excessive API calls on load.
 *
 * Before the fix: ~12–15 calls (duplicate bootstrap + 5 Dashboard fetches each time).
 * After the fix: bootstrap (1) + wealth/total (1–2) = 2–3 max.
 *
 * Threshold is set to 5 to give headroom for auth callbacks, but catch regressions.
 */
test('dashboard loads with ≤5 API calls on fresh page visit', async ({ page }) => {
  const apiCalls: string[] = [];

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/') && req.resourceType() === 'fetch') {
      apiCalls.push(url);
    }
  });

  // Go to the app — it will redirect to login if not authenticated.
  // This test verifies the call count from the logged-in dashboard.
  // To run against production you need a valid session cookie; see README.
  await page.goto('/');

  // Wait for the dashboard to settle (bootstrap + wealth call complete)
  await page.waitForLoadState('networkidle');

  console.log('API calls intercepted:', apiCalls);

  expect(
    apiCalls.length,
    `Expected ≤5 API calls but got ${apiCalls.length}:\n${apiCalls.join('\n')}`
  ).toBeLessThanOrEqual(5);
});

/**
 * Regression test: navigating months must not fire duplicate calls.
 * Each month change should produce exactly 1 bootstrap call.
 */
test('month navigation fires exactly 1 bootstrap call per navigation', async ({ page, context }) => {
  // Intercept bootstrap calls only
  const bootstrapCalls: string[] = [];

  page.on('request', (req) => {
    if (req.url().includes('/api/bootstrap')) {
      bootstrapCalls.push(req.url());
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const initialCount = bootstrapCalls.length;

  // Click the previous-month button (works on both desktop sidebar and mobile strip)
  const prevBtn = page.locator('button[aria-label="Previous month"], .month-prev-btn').first();
  if (await prevBtn.isVisible()) {
    bootstrapCalls.length = 0; // reset counter
    await prevBtn.click();
    await page.waitForLoadState('networkidle');
    expect(
      bootstrapCalls.length,
      `Month nav should fire 1 bootstrap call, got ${bootstrapCalls.length}`
    ).toBe(1);
  } else {
    // Skip if nav button not visible (login redirect)
    test.skip();
  }

  void context; void initialCount;
});
