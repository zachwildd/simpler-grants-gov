/**
 * Utilities for interacting with the Save Search feature on the search page.
 *
 * These functions cover opening the save-search modal, submitting a name,
 * reading the dropdown of saved queries, and waiting for the dropdown to appear.
 */

import { expect, Page } from "@playwright/test";
import playwrightEnv from "tests/e2e/playwright-env";

const { targetEnv } = playwrightEnv;

const DEFAULT_TIMEOUT = targetEnv === "staging" ? 30000 : 10000;

/**
 * Opens the Save Search modal by clicking the "Save" toggle button on the
 * search page. The modal must not already be open when this is called.
 */
export async function openSaveSearchModal(page: Page): Promise<void> {
  const openButton = page.getByTestId("open-save-search-modal-button");
  await expect(openButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await openButton.click();
  // Wait for the modal input to appear before returning so callers can
  // interact with it immediately.
  await expect(page.locator("#saved-search-input")).toBeVisible({
    timeout: DEFAULT_TIMEOUT,
  });
}

/**
 * Types the given name into the save-search modal input and clicks the Save
 * button inside the modal. Does not wait for any post-save state — callers
 * should assert the expected outcome (success or error) themselves.
 */
export async function fillAndSubmitSaveSearchModal(
  page: Page,
  name: string,
): Promise<void> {
  const input = page.locator("#saved-search-input");
  await expect(input).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await input.fill(name);
  const saveButton = page.getByTestId("save-search-button");
  await expect(saveButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  await saveButton.click();
}

/**
 * Returns the visible text of every option in the "Current search query"
 * dropdown (#save-search-select) on the search page. The first option is the
 * disabled placeholder ("Select saved query") and is included in the result.
 * Returns an empty array if the dropdown is not present on the page.
 */
export async function getSaveSearchSelectOptions(page: Page): Promise<string[]> {
  const select = page.locator("#save-search-select");
  const isVisible = await select.isVisible().catch(() => false);
  if (!isVisible) {
    return [];
  }
  const options = select.locator("option");
  const count = await options.count();
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await options.nth(i).textContent();
    if (text !== null) {
      texts.push(text.trim());
    }
  }
  return texts;
}

/**
 * Waits for the "Current search query" dropdown (#save-search-select) to
 * become visible on the search page. This dropdown only appears when the
 * authenticated user has at least one saved search. Use this after saving
 * a search and before asserting dropdown contents.
 */
export async function waitForSaveSearchDropdownVisible(
  page: Page,
): Promise<void> {
  await expect(page.locator("#save-search-select")).toBeVisible({
    timeout: DEFAULT_TIMEOUT,
  });
}
