/**
 * Tests for issue #8063: "Saved Searches allow duplicate names"
 *
 * The Save Search feature must not allow two saved searches with the same
 * name. These tests verify:
 *   1. The save modal rejects a duplicate name with a validation error.
 *   2. The Saved Search Queries workspace page shows no duplicate h2 names.
 *   3. The search-page dropdown shows no duplicate option text.
 *
 * Test 1 is marked `test.fixme()` and will be skipped until duplicate-name
 * validation is implemented (issue #8063). Remove the fixme once the fix
 * lands.
 */

import { expect, test } from "@playwright/test";
import playwrightEnv from "tests/e2e/playwright-env";
import { generateRandomString } from "tests/e2e/playwrightUtils";
import { waitForSearchResultsInitialLoad } from "tests/e2e/search/searchSpecUtil";
import { VALID_TAGS } from "tests/e2e/tags";
import { authenticateE2eUser } from "tests/e2e/utils/authenticate-e2e-user-utils";
import {
  fillAndSubmitSaveSearchModal,
  getSaveSearchSelectOptions,
  openSaveSearchModal,
  waitForSaveSearchDropdownVisible,
} from "tests/e2e/search/save-search-utils";

const { GRANTEE, OPPORTUNITY_SEARCH, FULL_REGRESSION } = VALID_TAGS;
const { baseUrl, targetEnv } = playwrightEnv;

const GOTO_TIMEOUT = targetEnv === "staging" ? 300_000 : 60_000;

test.describe("duplicate saved-search names (#8063)", () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, testInfo) => {
    if (targetEnv === "staging") {
      test.skip(
        testInfo.project.name !== "Chrome",
        "Staging MFA login is limited to Chrome to avoid OTP rate-limiting",
      );
    }
  });

  test(
    "rejects duplicate saved-search name with a validation error",
    { tag: [GRANTEE, OPPORTUNITY_SEARCH, FULL_REGRESSION] },
    async ({ page, context }, { project }) => {
      // Skip until #8063 duplicate-name validation is implemented.
      test.fixme();

      const isMobile = !!project.name.match(/[Mm]obile/);

      await authenticateE2eUser(page, context, isMobile);

      await page.goto(`${baseUrl}/search`, {
        waitUntil: "domcontentloaded",
        timeout: GOTO_TIMEOUT,
      });
      await waitForSearchResultsInitialLoad(page);

      // Unique name per run to avoid cross-run collisions.
      const searchName = `Dup ${generateRandomString([4, 4])}`;

      // --- First save: expect success ---
      await openSaveSearchModal(page);
      await fillAndSubmitSaveSearchModal(page, searchName);

      await expect(
        page.getByRole("heading", { name: "Query successfully saved" }),
      ).toBeVisible({ timeout: 15_000 });

      // Close the success modal via the footer "Close" button (not the X).
      await page
        .locator("#save-search")
        .getByRole("button", { name: "Close", exact: true })
        .click();

      // Wait for the modal input to disappear (modal fully closed).
      await expect(page.locator("#saved-search-input")).not.toBeVisible({
        timeout: 10_000,
      });

      // --- Second save with the same name: expect rejection ---
      await openSaveSearchModal(page);
      await fillAndSubmitSaveSearchModal(page, searchName);

      // The modal should show a USWDS error message for the duplicate name.
      const errorMessage = page
        .locator("#save-search")
        .locator(".usa-error-message");
      await expect(errorMessage).toBeVisible({ timeout: 10_000 });

      // The success heading must NOT appear — the save was rejected.
      await expect(
        page.getByRole("heading", { name: "Query successfully saved" }),
      ).not.toBeVisible();
    },
  );

  test(
    "workspace page has no duplicate saved-search names",
    { tag: [GRANTEE, OPPORTUNITY_SEARCH, FULL_REGRESSION] },
    async ({ page, context }, { project }) => {
      test.setTimeout(120_000);
      const isMobile = !!project.name.match(/[Mm]obile/);

      await authenticateE2eUser(page, context, isMobile);

      await page.goto(`${baseUrl}/workspace/saved-search-queries`, {
        waitUntil: "domcontentloaded",
        timeout: GOTO_TIMEOUT,
      });
      await page.waitForLoadState("domcontentloaded");

      // Collect all saved-search names rendered as <h2> inside list items.
      const listItems = page.locator("ul.usa-list--unstyled > li");
      const count = await listItems.count();

      const names: string[] = [];
      for (let i = 0; i < count; i++) {
        const h2Text = await listItems.nth(i).locator("h2").first().textContent();
        if (h2Text !== null) {
          names.push(h2Text.trim());
        }
      }

      // Find duplicates for a clear failure message.
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const name of names) {
        if (seen.has(name)) {
          duplicates.push(name);
        }
        seen.add(name);
      }

      expect(
        duplicates,
        `Duplicate saved-search names found: ${duplicates.join(", ")}`,
      ).toHaveLength(0);
    },
  );

  test(
    "search-page dropdown has no duplicate saved-search option text",
    { tag: [GRANTEE, OPPORTUNITY_SEARCH, FULL_REGRESSION] },
    async ({ page, context }, { project }) => {
      const isMobile = !!project.name.match(/[Mm]obile/);

      await authenticateE2eUser(page, context, isMobile);

      await page.goto(`${baseUrl}/search`, {
        waitUntil: "domcontentloaded",
        timeout: GOTO_TIMEOUT,
      });
      await waitForSearchResultsInitialLoad(page);

      // Dropdown only appears when the user has saved searches.
      const isDropdownVisible = await page
        .locator("#save-search-select")
        .isVisible()
        .catch(() => false);

      if (!isDropdownVisible) {
        // No saved searches — nothing to validate.
        return;
      }

      await waitForSaveSearchDropdownVisible(page);
      const optionTexts = await getSaveSearchSelectOptions(page);

      // Find duplicates for a clear failure message.
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const text of optionTexts) {
        if (seen.has(text)) {
          duplicates.push(text);
        }
        seen.add(text);
      }

      expect(
        duplicates,
        `Duplicate dropdown options found: ${duplicates.join(", ")}`,
      ).toHaveLength(0);
    },
  );
});
