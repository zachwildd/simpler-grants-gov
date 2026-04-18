/**
 * Tests for issue #5536: Delete saved search modal closes on refresh after
 * successful deletion.
 *
 * After deleting a saved search from the workspace page, the success modal
 * ("Query successfully updated") closes prematurely because the component
 * calls router.refresh() immediately after setting the success state. The
 * refresh triggers a re-render that unmounts the modal before the user can
 * see the confirmation.
 *
 * This test verifies the success modal persists after deletion and the saved
 * search is actually removed from the list.
 */

import { expect, test } from "@playwright/test";
import playwrightEnv from "tests/e2e/playwright-env";
import { generateRandomString } from "tests/e2e/playwrightUtils";
import { waitForSearchResultsInitialLoad } from "tests/e2e/search/searchSpecUtil";
import {
  fillAndSubmitSaveSearchModal,
  openSaveSearchModal,
} from "tests/e2e/search/save-search-utils";
import { VALID_TAGS } from "tests/e2e/tags";
import { authenticateE2eUser } from "tests/e2e/utils/authenticate-e2e-user-utils";

const { GRANTEE, OPPORTUNITY_SEARCH, FULL_REGRESSION } = VALID_TAGS;
const { baseUrl, targetEnv } = playwrightEnv;

const GOTO_TIMEOUT = targetEnv === "staging" ? 300_000 : 60_000;
const ACTION_TIMEOUT = targetEnv === "staging" ? 30_000 : 15_000;

test.describe("Delete saved search modal persistence (#5536)", () => {
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
    "success modal stays visible after deleting a saved search",
    { tag: [GRANTEE, OPPORTUNITY_SEARCH, FULL_REGRESSION] },
    async ({ page, context }, testInfo) => {
      // Mark as expected failure until #5536 is fixed — router.refresh()
      // causes the success modal to close prematurely.
      test.fail(
        true,
        "Issue #5536: router.refresh() closes the success modal before user sees it",
      );

      test.setTimeout(180_000);
      const isMobile = !!testInfo.project.name.match(/[Mm]obile/);

      // Step 1: Authenticate
      await authenticateE2eUser(page, context, isMobile);

      // Step 2: Navigate to search page and save a search with a unique name
      await page.goto(`${baseUrl}/search`, {
        waitUntil: "domcontentloaded",
        timeout: GOTO_TIMEOUT,
      });
      await waitForSearchResultsInitialLoad(page);

      const searchName = `Del ${generateRandomString([4, 4])} ${Date.now()}`;

      await openSaveSearchModal(page);
      await fillAndSubmitSaveSearchModal(page, searchName);

      // Wait for the save success confirmation
      await expect(page.getByText("Query successfully saved")).toBeVisible({
        timeout: ACTION_TIMEOUT,
      });

      // Close the save modal
      const closeSaveModal = page.getByRole("button", { name: /close/i });
      await closeSaveModal.click();
      await expect(page.locator("#saved-search-input")).not.toBeVisible({
        timeout: ACTION_TIMEOUT,
      });

      // Step 3: Navigate to the workspace saved-search-queries page
      await page.goto(`${baseUrl}/workspace/saved-search-queries`, {
        waitUntil: "domcontentloaded",
        timeout: GOTO_TIMEOUT,
      });

      // Wait for the saved search list to render
      const savedSearchItem = page
        .locator("ul.usa-list--unstyled > li")
        .filter({ hasText: searchName });
      await expect(savedSearchItem).toBeVisible({ timeout: ACTION_TIMEOUT });

      // Step 4: Click the delete button for this saved search
      const deleteButton = savedSearchItem.getByRole("button", {
        name: /delete/i,
      });
      await deleteButton.click();

      // Confirm the delete modal appeared with the correct title
      const modal = page.getByRole("dialog");
      await expect(
        modal.getByText("Delete saved query?"),
      ).toBeVisible({ timeout: ACTION_TIMEOUT });

      // Click "Yes, delete" to confirm
      const confirmDelete = modal.getByRole("button", {
        name: /yes, delete/i,
      });
      await confirmDelete.click();

      // Step 5: Verify success modal heading appears
      const successHeading = modal.getByRole("heading", {
        name: "Query successfully updated",
      });
      await expect(successHeading).toBeVisible({ timeout: ACTION_TIMEOUT });

      // Wait 2 seconds to detect the premature close caused by router.refresh()
      await page.waitForTimeout(2000);

      // The success modal should STILL be visible after the wait
      await expect(successHeading).toBeVisible();

      // Step 6: Close the success modal
      const closeButton = modal.getByRole("button", { name: /close/i });
      await closeButton.click();

      // Step 7: Verify the saved search is removed from the list
      await expect(savedSearchItem).toHaveCount(0, {
        timeout: ACTION_TIMEOUT,
      });
    },
  );
});
