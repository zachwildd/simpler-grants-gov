/**
 * Tests for issue #8653: "Filter pills disappearing together"
 *
 * When the search page loads with default status filters (Forecasted + Open),
 * removing one pill must leave the other intact. This must hold even after
 * a search-reset cycle (type a query, clear it, then remove a pill).
 */

import { expect, test } from "@playwright/test";
import {
  waitForURLContainsQueryParamValue,
} from "tests/e2e/playwrightUtils";
import {
  ensureFilterDrawerOpen,
  expectCheckboxIDIsChecked,
  fillSearchInputAndSubmit,
  waitForSearchResultsInitialLoad,
} from "tests/e2e/search/searchSpecUtil";
import { VALID_TAGS } from "tests/e2e/tags";

const { GRANTEE, OPPORTUNITY_SEARCH, FULL_REGRESSION } = VALID_TAGS;

/** Locator helper for the pill-remove button. */
const pillRemoveButton = (page: import("@playwright/test").Page, label: string) =>
  page.getByRole("button", { name: `Remove ${label} pill` });

test.describe("Filter pills disappearing together (#8653)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/search");
    await waitForSearchResultsInitialLoad(page);
  });

  test(
    "removing one default status pill keeps the other visible",
    { tag: [GRANTEE, OPPORTUNITY_SEARCH, FULL_REGRESSION] },
    async ({ page }) => {
      // Both default pills should be visible.
      await expect(pillRemoveButton(page, "Forecasted")).toBeVisible();
      await expect(pillRemoveButton(page, "Open")).toBeVisible();

      // Remove the Forecasted pill.
      await pillRemoveButton(page, "Forecasted").click();
      await waitForURLContainsQueryParamValue(page, "status", "posted");

      // Open pill must still be present.
      await expect(pillRemoveButton(page, "Open")).toBeVisible();
      // Forecasted pill must be gone.
      await expect(pillRemoveButton(page, "Forecasted")).not.toBeVisible();
    },
  );

  test(
    "pills survive a search-reset cycle independently",
    { tag: [GRANTEE, OPPORTUNITY_SEARCH, FULL_REGRESSION] },
    async ({ page }, { project }) => {
      // Perform a search then clear it to create the reset cycle from the bug.
      await fillSearchInputAndSubmit("education", page, project.name);
      await waitForSearchResultsInitialLoad(page);

      await fillSearchInputAndSubmit("", page, project.name);
      await waitForSearchResultsInitialLoad(page);

      // Both default pills should still be visible after the reset.
      await expect(pillRemoveButton(page, "Forecasted")).toBeVisible();
      await expect(pillRemoveButton(page, "Open")).toBeVisible();

      // Remove the Forecasted pill.
      await pillRemoveButton(page, "Forecasted").click();
      await waitForURLContainsQueryParamValue(page, "status", "posted");

      // Open pill must survive.
      await expect(pillRemoveButton(page, "Open")).toBeVisible();
      await expect(pillRemoveButton(page, "Forecasted")).not.toBeVisible();
    },
  );

  test(
    "both default pills can be removed sequentially",
    { tag: [GRANTEE, OPPORTUNITY_SEARCH, FULL_REGRESSION] },
    async ({ page }) => {
      // Remove Forecasted first.
      await pillRemoveButton(page, "Forecasted").click();
      await waitForURLContainsQueryParamValue(page, "status", "posted");
      await expect(pillRemoveButton(page, "Open")).toBeVisible();

      // Remove Open second — no status pills should remain.
      await pillRemoveButton(page, "Open").click();
      await waitForURLContainsQueryParamValue(page, "status", "none");

      await expect(pillRemoveButton(page, "Forecasted")).not.toBeVisible();
      await expect(pillRemoveButton(page, "Open")).not.toBeVisible();
    },
  );

  test(
    "checkbox state syncs with pill removal",
    { tag: [GRANTEE, OPPORTUNITY_SEARCH, FULL_REGRESSION] },
    async ({ page }) => {
      // Remove the Forecasted pill.
      await pillRemoveButton(page, "Forecasted").click();
      await waitForURLContainsQueryParamValue(page, "status", "posted");

      // Open the filter drawer and verify checkbox state.
      await ensureFilterDrawerOpen(page);

      // "status-open" should still be checked.
      await expectCheckboxIDIsChecked(page, "status-open");

      // "status-forecasted" should be unchecked.
      const forecastedCheckbox = page.locator('input[id="status-forecasted"]').first();
      await expect(forecastedCheckbox).not.toBeChecked();
    },
  );
});
