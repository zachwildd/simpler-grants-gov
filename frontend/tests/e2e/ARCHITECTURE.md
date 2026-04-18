# E2E Test Architecture

This document is the single source of truth for writing, generating, and reviewing e2e tests. It is designed to be read by both humans and AI agents.

## Architecture Overview

The e2e test utilities are organized in 4 layers. Each layer only depends on layers below it.

```
Layer 4: WORKFLOW ORCHESTRATION
  authenticate-e2e-user-utils, create-application-utils,
  submit-application-utils, post-submission-utils
  Multi-step user flows that compose lower layers.

Layer 3: DOMAIN AUTOMATION
  forms/* (form filling engine), search/searchSpecUtil (search interactions),
  perform-login-utils (staging MFA), select-local-test-user-utils
  Domain-specific interactions for major feature areas.

Layer 2: GENERIC NAVIGATION
  playwrightUtils, lifecycle-utils, select-dropdown-utils
  Reusable Playwright helpers with no domain knowledge.

Layer 1: INFRASTRUCTURE
  playwright-env, get-opportunityId-utils, loginUtils (JWT spoofing),
  tags, regex-utils, forms/form-defaults, forms/form-number-utils
  Environment config, test data, auth credentials, constants.
```

### Design Properties

- **Stateless functions** — All utilities are pure functions that take a Playwright `Page` (and sometimes `BrowserContext` or `TestInfo`) and return a `Promise`. No classes, no instance state.
- **No circular dependencies** — Each layer only imports from layers below it.
- **Data-driven form automation** — The `fillForm()` engine takes declarative configs (field definitions + fill data), not imperative step sequences. New forms are added by creating fixture files, not new utility code.
- **Environment abstraction** — Single codebase runs against local and staging with conditional logic in `playwright-env.ts`.

## Conventions

### File Naming

- Test specs: `{feature-name}.spec.ts` (kebab-case)
- Utility files: `{purpose}-utils.ts` (kebab-case with `-utils` suffix)
- Fixture field definitions: `{form-name}-field-definitions.ts`
- Fixture fill data: `{form-name}-fill-data.ts`
- Feature files (BDD): `{feature-name}.feature` (kebab-case)

### File Placement

| Type | Location |
|------|----------|
| Search tests | `search/*.spec.ts` |
| Apply/form tests | `apply/*.spec.ts` |
| Login tests | `login/*.spec.ts` |
| Saved opportunity tests | `saved-opportunities/*.spec.ts` |
| Root-level feature tests | `*.spec.ts` (404, index, roadmap, vision, subscribe) |
| Form fixtures | `apply/fixtures/{form}-field-definitions.ts` and `{form}-fill-data.ts` |
| Search utilities | `search/searchSpecUtil.ts` |
| Form utilities | `utils/forms/*.ts` |
| Other utilities | `utils/*.ts` |
| Root-level utilities | `playwrightUtils.ts`, `loginUtils.ts`, `playwright-env.ts` |

### Export Patterns

- Utility functions: Named exports, one function per export
- Fixture field definitions: Named export of `FormFillFieldDefinitions` object + `FillFormConfig` object + optional `FieldError[]` array
- Fixture fill data: Named export as factory function (e.g., `sf424BHappyPathTestData(orgLabel)`) to support parameterization
- Constants: Named exports of constant objects (e.g., `FORM_DEFAULTS`, `VALID_TAGS`)

### When to Create a New Utility vs. Inline

Create a new utility function when:
- The interaction will be used by 2+ tests
- The interaction involves cross-browser workarounds or timing logic
- The interaction represents a complete user action (e.g., "open the filter drawer")

Inline the logic when:
- It's a one-off assertion specific to a single test scenario
- It's a simple Playwright call with no special handling (e.g., `await page.click('button')`)

## Utility Catalog

This catalog is organized by what the user does in the application, not by source file. Use it to find existing utilities before writing new interactions.

### Search Page

Source: `search/searchSpecUtil.ts`

#### Entering a Search Query

When a user types a search term and submits:
- `getSearchInput(page)` — Returns the locator for the main search input field on the search results page.
- `fillSearchInputAndSubmit(term, page, projectName?)` — Clears the search input, types the given search term, and submits the search form. Handles cross-browser differences for Firefox and WebKit.

#### Opening and Closing the Filter Drawer

When a user interacts with the filter sidebar on the search results page:
- `toggleFilterDrawer(page)` — Opens the filter drawer if it's closed, or closes it if it's open.
- `ensureFilterDrawerOpen(page)` — Opens the filter drawer if it isn't already open. Safe to call multiple times — no-op if already open.

#### Selecting and Verifying Filters

When a user checks/unchecks filter options (opportunity status, funding instrument, eligibility, agency):
- `waitForFilterOptions(page, filterType)` — Waits for filter checkbox options to finish loading and become visible in the drawer. Call this after navigation or opening the drawer, before interacting with any filter checkboxes.
- `toggleCheckbox(page, idWithoutHash)` — Checks or unchecks a single filter checkbox by its ID. Includes cross-browser fallback (JavaScript dispatch for WebKit) if the standard click fails.
- `toggleCheckboxes(page, checkboxObject, queryParamName, startingQueryParams?)` — Toggles multiple checkboxes sequentially and verifies URL query parameters accumulate correctly after each toggle.
- `toggleCheckboxGroup(page, checkboxObject)` — Toggles all checkboxes in a group sequentially with a delay between each.
- `expectCheckboxesChecked(page, checkboxObject)` — Asserts that all specified filter checkboxes are currently in the checked state.
- `expectCheckboxIDIsChecked(page, checkboxId)` — Asserts a single checkbox (by ID) is checked.
- `getFirstNonNumericAgencyCheckboxId(page)` — Finds the first unchecked agency checkbox with a non-numeric ID. Useful for tests that need to select an arbitrary agency filter.

#### Selecting and Verifying Top-Level Filter Groups

When a user interacts with filter groups that have "Select All" functionality:
- `getCountOfTopLevelFilterOptions(page, filterType)` — Counts the number of top-level filter options available for a filter type (excluding "any" variants).
- `selectAllTopLevelFilterOptions(page, filterType)` — Clicks the "Select All" button for a filter type and waits for the URL to update with the selections.
- `validateTopLevelAndNestedSelectedFilterCounts(page, filterName, expectedTopLevelCount, expectedNestedCount)` — Asserts that the accordion button displays the correct combined filter count and the nested expander shows the correct nested count.

#### Sorting Search Results

When a user changes the sort order of search results:
- `selectSortBy(page, sortByValue, drawer?, projectName?)` — Selects a sort option from the sort dropdown. Handles cross-browser timing and staging timeout extensions.
- `expectSortBy(page, value, drawer?)` — Asserts the sort dropdown currently shows the expected sort value.
- `selectOppositeSortOption(page)` — Toggles the sort direction between ascending and descending variants (e.g., from "Posted Date (newest)" to "Posted Date (oldest)").

#### Reading Search Results

When verifying the search results displayed on the page:
- `getNumberOfOpportunitySearchResults(page)` — Extracts and returns the total opportunity count from the results header (e.g., "1,234 Opportunities" returns 1234).
- `getFirstSearchResultTitle(page)` — Returns the title text of the first search result on the page.
- `getLastSearchResultTitle(page)` — Returns the title text of the last search result on the page.
- `waitForSearchResultsInitialLoad(page, timeoutOverride?)` — Waits for search results to load by looking for "Opportunities" text. Uses 180s timeout on staging, 60s locally.

#### Navigating Search Result Pages

When a user pages through search results:
- `clickPaginationPageNumber(page, pageNumber)` — Clicks the pagination button for a specific page number and waits for the URL to update with the new page parameter.
- `clickLastPaginationPage(page)` — Clicks the last pagination page button, if multiple pages of results exist.

#### Expanding Filter Accordions

When a user expands or collapses filter category accordions in the drawer:
- `clickAccordionWithTitle(page, accordionTitle)` — Clicks an accordion button matching the given title text.
- `ensureAccordionExpanded(page, accordionTitle)` — Ensures an accordion is in the expanded state, clicking it if collapsed. Uses environment-specific timeout.

#### Saving a Search Query

Source: `search/save-search-utils.ts`

When a user saves their current search criteria using the Save Search modal:
- `openSaveSearchModal(page)` — Clicks the "Save" toggle button on the search page to open the Save Search modal, then waits for the name input to become visible before returning.
- `fillAndSubmitSaveSearchModal(page, name)` — Types the given name into the modal's name input and clicks the Save button inside the modal. Does not wait for the post-save outcome — callers assert the expected result (success heading or validation error) themselves.
- `getSaveSearchSelectOptions(page)` — Returns the visible text of every option in the "Current search query" dropdown (`#save-search-select`), including the disabled placeholder. Returns an empty array if the dropdown is not present (i.e. user has no saved searches).
- `waitForSaveSearchDropdownVisible(page)` — Waits for the "Current search query" dropdown to become visible. The dropdown only appears when the authenticated user has at least one saved search.

#### Waiting for Page State

When waiting for the search page to finish loading or updating:
- `waitForLoaderToBeHidden(page)` — Waits for the loading spinner to disappear, indicating the page has finished updating.

#### Verifying URL Query Parameters (Search Context)

When verifying that search state is reflected in the URL:
- `expectURLContainsQueryParam(page, queryParamName)` — Asserts the current URL contains the given query parameter name. (Note: also available in `playwrightUtils.ts` as `waitForURLContainsQueryParam` with polling.)

### Apply Workflow

#### Creating a New Application

Source: `utils/create-application-utils.ts`

When a user navigates to an opportunity and starts a new application:
- `createApplication(page, opportunityUrl, orgLabel)` — Navigates to the opportunity page, clicks the start-application button, selects the specified organization from the modal dropdown (with retry polling for WebKit compatibility), fills the application name, creates the application, and waits for the forms table to load.

#### Filling Out Forms

Source: `utils/forms/general-forms-filling.ts`

When a user fills out a form within an application:
- `fillForm(testInfo, page, config, data, returnToApplication?)` — Opens the form specified by `config.formName`, fills all fields defined in `config.fields` using the values in `data`, runs an optional `beforeSave()` hook, saves the form, and optionally navigates back to the application page. This is the primary entry point for form automation.
- `fillField(testInfo, page, field, data)` — Fills a single form field based on its type (text, dropdown, file upload, radio button, checkbox, or combo-box). Attaches test artifacts for debugging. Called internally by `fillForm` but can be used directly for partial form fills.
- `verifyFormLinkVisible(page, formName)` — Waits (up to 60s) for a form link or button matching the given name to become visible on the application page.

#### Navigating Between Forms

Source: `utils/forms/form-navigation-utils.ts`

When a user opens a form from the application forms table:
- `getFormLink(page, formName)` — Returns a locator for the form link/button matching the given name (case-insensitive).
- `openForm(page, formMatcher)` — Opens a form from the application page forms table. Searches by regex matcher across multiple selector strategies (data-testid, href, button text) with scrolling fallback. Returns true on success.

#### Saving a Form

Source: `utils/forms/save-form-utils.ts`

When a user saves a form and the system validates it:
- `saveForm(page, expectErrors?)` — Clicks the save button and waits for the "Form was saved" confirmation message. If `expectErrors` is true, expects validation errors instead of the no-errors message.

#### Verifying Form Completion Status

Source: `utils/forms/verify-form-status-utils.ts`

When checking whether a form shows as complete or incomplete on the application page:
- `assertFormRowStatus(page, status, formName)` — Scrolls to the forms table and asserts the form row displays the expected status ("No issues detected" for complete, "Some issues found" for incomplete).
- `verifyFormStatusOnApplication(page, status, formName, applicationUrl)` — Navigates to the application page and verifies the form row status.
- `verifyFormStatusAfterSave(page, status, expectedErrors?)` — Verifies the post-save state: success alert for complete, or error alerts plus inline errors for incomplete (requires `expectedErrors` when status is incomplete).

#### Verifying Form Errors

Source: `utils/forms/verify-form-errors-utils.ts`

When checking for specific validation errors on a form:
- `verifyAlertErrors(page, expectedErrors)` — Asserts that expected error messages appear in the alert list at the top of the form. Each error is a `FieldError` with `fieldId` and `message`.
- `verifyInlineErrors(page, expectedErrors)` — Scrolls through the form and asserts that inline error messages appear below their respective fields (located by `#error-for-{fieldId}`).

#### Including or Excluding Forms

Source: `utils/forms/select-form-inclusion-utils.ts`

When a user marks a form as included or excluded from the application submission:
- `selectFormInclusionOption(page, formName, option?)` — Selects the Yes/No radio button for including a form in the submission and waits for the API response.

#### Submitting an Application

Source: `utils/submit-application-utils.ts`

When a user submits a completed application:
- `submitApplicationAndVerify(page, outcome, expectedErrors?)` — Clicks the submit button, waits for the outcome ("success" heading or "validationError" heading), verifies alerts and error lists if applicable, and returns the application ID on success.

#### Verifying Post-Submission State

Source: `utils/post-submission-utils.ts`

When verifying the application state after successful submission:
- `verifyPostSubmission(page, expectedHistoryEntries)` — Asserts the application status card shows "Submitted" and verifies history entries appear in chronological order (most recent first).
- `verifyFormFieldsAreReadonlyAfterSubmission(page, formMatcher, formName, fields)` — Opens a form and verifies that specified fields are disabled and contain expected values. Each field is a `ReadonlyFieldCheck` with `fieldId` and `expectedValue`.

### Authentication

#### Logging In (High-Level)

Source: `utils/authenticate-e2e-user-utils.ts`

The primary entry point for test authentication — call this at the start of any test that requires a logged-in user:
- `authenticateE2eUser(page, context, isMobile)` — Authenticates the test user based on environment. On local: creates a spoofed JWT session cookie and selects the test organization from the dev dropdown. On staging: checks for an existing session (sign-out button visible), performs full MFA login if needed, and opens mobile nav after auth if on a mobile viewport.

#### Local Session Spoofing

Source: `loginUtils.ts`

Used internally by `authenticateE2eUser` for local test runs. These functions create a fake JWT session cookie so tests don't need to go through a real login flow:
- `initializePlaywrightSessionSecrets()` — Reads the `SESSION_SECRET` environment variable and initializes the JWT encryption key. Called once during test setup.
- `generateSpoofedSession()` — Encrypts the fake server token into an HS256-signed JWT for the client-side session cookie.
- `createSpoofedSessionCookie(context)` — Generates a spoofed session JWT and adds it to the browser context as a "session" cookie. This is the function called by `authenticateE2eUser` on local.
- `newExpirationDate()` — Returns a date 12 hours in the future for token expiration (prevents mid-test expiry).

#### Local Test User Selection

Source: `utils/select-local-test-user-utils.ts`

Used internally by `authenticateE2eUser` for local test runs:
- `selectLocalTestUser(page, userLabel)` — Selects a test user from the dev-only quick-login dropdown by label text. No-op if the dropdown isn't present (CI environments where it's disabled).

#### Staging MFA Login

Source: `utils/perform-login-utils.ts`

Used internally by `authenticateE2eUser` for staging test runs. These handle the full login.gov authentication flow with MFA:
- `performStagingLogin(page, isMobileProject)` — Complete staging login flow: opens mobile nav if needed, detects existing session, fills email/password form, handles MFA with retry logic (up to 3 attempts with fresh TOTP codes), returns the Sign Out button locator on success.
- `clickSignIn(page)` — Clicks the Sign In button (handles both button and link variants) and returns true if found and clicked.
- `fillSignInForm(page)` — Fills the email and password fields on the login.gov sign-in form and clicks submit.
- `locateMfaInput(page)` — Finds the MFA/TOTP input field, checking both the main page and within iframes.
- `generateMfaAndSubmit(page, mfaInput)` — Waits for a fresh 30-second TOTP window (to avoid code expiration mid-entry), generates the OTP code, fills the MFA input, and clicks submit.
- `findSignOutButton(page, isMobileProject)` — Locates the Sign Out button (opening mobile menu first if needed). Used to verify login succeeded.

### Generic Page Navigation

Source: `playwrightUtils.ts`

#### Waiting for URL Changes

When waiting for the URL to update after a user action (clicking a link, submitting a form, applying a filter):
- `waitForURLChange(page, changeCheck, timeout?)` — Polls the URL at 500ms intervals until the `changeCheck` function returns true or the timeout expires. The base utility for all URL-waiting functions below.
- `waitForUrl(page, url, timeout?)` — Waits for an exact URL match.
- `waitForAnyURLChange(page, initialUrl, timeout?)` — Waits for the URL to change from the given initial value (any new URL is accepted).

#### Waiting for URL Query Parameters

When waiting for specific query parameters to appear in the URL (e.g., after applying filters or search terms):
- `waitForURLContainsQueryParam(page, queryParamName, timeout?)` — Waits for the URL to contain any value for the given query parameter name.
- `waitForURLContainsQueryParamValue(page, queryParamName, queryParamValue, timeoutOverride?)` — Waits for a specific query parameter to have a specific value. Uses environment-aware timeout (300s staging, 60s local).
- `waitForURLContainsQueryParamValues(page, queryParamName, queryParamValues, timeoutOverride?)` — Waits for a comma-separated query parameter to contain multiple values (comparison is sorted).

#### Asserting URL Query Parameters

When synchronously asserting the current URL state (no waiting/polling):
- `expectURLQueryParamValue(page, queryParamName, queryParamValue)` — Asserts a single query parameter has the expected value right now.
- `expectURLQueryParamValues(page, queryParamName, queryParamValues)` — Asserts a comma-separated query parameter contains all expected values (sorted comparison).

#### Mobile Navigation

When interacting with the mobile hamburger menu:
- `openMobileNav(page)` — Opens the mobile navigation menu if it's not already open. Returns the nav locator. Safe to call when already open (detects state and skips).

#### Page Refresh

When reloading the current page:
- `refreshPageWithCurrentURL(page)` — Reloads the page with the current URL using "domcontentloaded" wait strategy (avoids staging timeouts that occur with "networkidle").

#### Random Test Data

When generating random input values for tests:
- `generateRandomString(desiredPattern)` — Generates a random alphabetic string with segments matching the pattern array (e.g., `[3, 5]` produces a 3-letter word, a space, and a 5-letter word).

### Page Lifecycle

Source: `utils/lifecycle-utils.ts`

When managing page and browser context state between tests or test steps:
- `ensurePageClosed(page)` — Safely closes a page if it's still open. No-op if already closed.
- `clearPageState(context)` — Clears all cookies, localStorage, and sessionStorage across all pages in the browser context.
- `gotoWithRetry(page, url, options?)` — Navigates to a URL with 3 retry attempts (3-second delay between). Handles transient network errors in Codespaces environments.

### Dropdown Interaction

Source: `utils/select-dropdown-utils.ts`

When interacting with native HTML `<select>` dropdowns (not custom combo-boxes):
- `selectDropdownByValueOrLabel(page, selector, option)` — Selects a dropdown option by value; falls back to selecting by visible label text if value matching fails.

### Infrastructure & Configuration

#### Environment Configuration

Source: `playwright-env.ts`

Provides environment-specific configuration used throughout all utilities. Key exports:
- `baseUrl` — Target environment URL (`http://127.0.0.1:3000` for local, `https://staging.simpler.grants.gov` for staging)
- `targetEnv` — `"local"` or `"staging"`
- `testUserLabel` — Display name for the test user (environment-specific)
- `testOrgLabel` — Display name for the test organization (environment-specific)
- `isCi` — Whether running in CI
- `fakeServerToken`, `clientSessionSecret` — Auth credentials for local session spoofing
- `testUserEmail`, `testUserPassword`, `testUserAuthKey` — Staging login credentials from environment variables

#### Test Opportunity

Source: `get-opportunityId-utils.ts`

- `getOpportunityId()` — Returns the correct test opportunity ID based on the target environment (different IDs for local vs. staging).

#### Constants

Source: `utils/regex-utils.ts`
- `UUID_REGEX` — Regular expression pattern matching UUIDs (used for application ID assertions).

Source: `utils/forms/form-defaults.ts`
- `FORM_DEFAULTS` — Shared constants for form tests: `saveButtonTestId` ("apply-form-save"), `formSavedHeading` ("Form was saved"), `noErrorsText` ("No errors were detected."), `validationErrorText` ("correct the following errors before submitting").

Source: `utils/forms/form-number-utils.ts`
- `numberToTwoDecimalString(numberToStringify)` — Converts a number to a 2-decimal-place string (used for monetary form field values).

## Fixture Pattern Guide

Form tests use a **definition + data** pattern that separates *how to interact with a form* from *what values to enter*. This makes it easy to add new test scenarios for an existing form (new data file) or new forms (new definition + data pair).

### Structure

Each form has a pair of files in `apply/fixtures/`:

1. **`{form}-field-definitions.ts`** — Declares the form structure: field locators, interaction types, and conditional dependencies. Changes only when the form UI changes.
2. **`{form}-fill-data.ts`** — Provides test values for each field. Can have multiple datasets (happy path, error cases). Changes when test scenarios change.

### Available Form Fixtures

| Form | Field Definitions | Fill Data |
|------|-------------------|-----------|
| SF-424 | `sf424-field-definitions.ts` | `sf424-fill-data.ts` |
| SF-424A | `sf424a-field-definitions.ts` | `sf424a-fill-data.ts` |
| SF-424B | `sf424b-field-definitions.ts` | `sf424b-fill-data.ts` |
| SF-424D | `sf424d-field-definitions.ts` | `sf424d-fill-data.ts` |
| SF-LLL | `sfLLL-field-definitions.ts` | `sfLLL-fill-data.ts` |
| CD-511 | `cd511-field-definitions.ts` | `cd511-fill-data.ts` |
| Grants.gov Lobbying | `grantsgov-lobbying-field-definitions.ts` | `grantsgov-lobbying-fill-data.ts` |
| EPA Key Contacts | `epa-key-contacts-field-definitions.ts` | `epa-key-contacts-fill-data.ts` |
| EPA 4700-4 | `epa4700-4-field-definitions.ts` | `epa4700-4-fill-data.ts` |
| Project Abstract | `project-abstract-field-definitions.ts` | `project-abstract-fill-data.ts` |
| Project Abstract Summary | `project-abstract-summary-field-definitions.ts` | `project-abstract-summary-fill-data.ts` |
| Project Narrative Attachment | `project-narrative-attachment-field-definitions.ts` | `project-narrative-attachment-fill-data.ts` |
| Attachment (Generic) | `attachment-field-definitions.ts` | `attachment-fill-data.ts` |
| Budget Narrative Attachment | `budget-narrative-attachment-field-definitions.ts` | `budget-narrative-attachment-fill-data.ts` |
| Other Narrative Attachment | `other-narrative-attachment-field-definitions.ts` | `other-narrative-attachment-fill-data.ts` |
| Supplemental Cover Sheet (NEH) | `supp-cover-sheet-neh-grantsprogram-field-definitions.ts` | `supp-cover-sheet-neh-grantsprogram-fill-data.ts` |

### Field Definition File Pattern

A field definitions file exports:

```typescript
import { FillFieldDefinition, FormFillFieldDefinitions, FillFormConfig } from "../../utils/forms/general-forms-filling";
import { FORM_DEFAULTS } from "../../utils/forms/form-defaults";
import { FieldError } from "../../utils/forms/verify-form-errors-utils";

// Regex matcher for form name (handles hyphens, en-dashes, em-dashes, spaces)
export const FORM_MATCHER = "SF\\s*[-‑–—]?\\s*424B|Assurances";

// Field definitions: keys are field identifiers, values describe how to interact
export const fieldDefinitions: FormFillFieldDefinitions = {
  title: {
    testId: "title",           // data-testid attribute
    type: "text",              // text | dropdown | file | radiobutton | checkbox | combo-box-input
    field: "Title",            // Human-readable field name
  },
  organization: {
    testId: "applicant_organization",
    type: "text",
    field: "Organization",
    dependsOn: {               // Conditional: only fill if another field has a specific value
      fieldId: "show_org",
      value: "Yes",
    },
  },
};

// Merged config combining field definitions with form defaults
export const FORM_CONFIG: FillFormConfig = {
  ...FORM_DEFAULTS,
  formName: FORM_MATCHER,
  fields: fieldDefinitions,
};

// Expected validation errors when required fields are empty (for failure-path tests)
export const REQUIRED_FIELD_ERRORS: FieldError[] = [
  { fieldId: "title", message: "This field is required" },
];
```

### Fill Data File Pattern

A fill data file exports factory functions that return test values:

```typescript
// Happy-path data — parameterized with orgLabel for environment flexibility
export const happyPathTestData = (orgLabel: string) => ({
  title: "TESTER",
  organization: orgLabel,
});

// Readonly field checks — for post-submission verification
export const readonlyFields = (orgLabel: string) => [
  { fieldId: "title", expectedValue: "TESTER" },
  { fieldId: "applicant_organization", expectedValue: orgLabel },
];
```

### How Tests Consume Fixtures

```typescript
import { FORM_CONFIG, FORM_MATCHER } from "./fixtures/sf424b-field-definitions";
import { sf424BHappyPathTestData } from "./fixtures/sf424b-fill-data";
import { fillForm } from "../utils/forms/general-forms-filling";

// Fill the form using the config (how to interact) and data (what to enter)
await fillForm(testInfo, page, FORM_CONFIG, sf424BHappyPathTestData(testOrgLabel), false);
```

### Creating Fixtures for a New Form

1. Create `apply/fixtures/{form-name}-field-definitions.ts`:
   - Define a `FORM_MATCHER` regex that matches the form name in the UI
   - Map each field to a `FillFieldDefinition` with the correct `testId`, `type`, and optional `dependsOn`
   - Export a `FORM_CONFIG` merging your fields with `FORM_DEFAULTS`
   - Optionally export `REQUIRED_FIELD_ERRORS` for failure-path tests
2. Create `apply/fixtures/{form-name}-fill-data.ts`:
   - Export a `happyPathTestData(orgLabel)` factory function
   - Optionally export `readonlyFields(orgLabel)` for post-submission checks
3. Use `fillForm(testInfo, page, config, data)` in your test — no new utility code needed

## Tagging & Cadence Rules

Source: `tags.ts`

Every test must have exactly **one execution tag** and **one or more feature tags**.

### Execution Tags (When the Test Runs)

| Tag | Runs On | Use When |
|-----|---------|----------|
| `@smoke` | Every PR | The test covers a critical happy path that should never be broken by any change |
| `@core-regression` | Push to main, staging deploy | The test covers important functionality that should be verified before release |
| `@full-regression` | Daily (11am UTC) | The test covers functionality that needs regular verification but not on every PR |
| `@extended` | Weekly (Sunday 11am UTC) | The test covers edge cases or less-critical paths that need periodic verification |

### Feature Tags (What the Test Covers)

| Tag | Domain |
|-----|--------|
| `@grantor` | Grantor-facing features |
| `@grantee` | Grantee-facing features |
| `@opportunity-search` | Search and discovery |
| `@apply` | Application submission workflow |
| `@static` | Static pages (404, roadmap, vision) |
| `@auth` | Authentication and login |
| `@user-management` | User management features |

### How to Apply Tags

Tags are applied in the test title string:

```typescript
import { VALID_TAGS } from "../tags";

test(`${VALID_TAGS.smoke} ${VALID_TAGS.opportunitySearch} should display search results`, async ({ page }) => {
  // ...
});
```

### Choosing an Execution Tag

- Is this a happy path that every PR should validate? → `@smoke`
- Is this important but only needs verification at release boundaries? → `@core-regression`
- Is this thorough coverage that should run daily? → `@full-regression`
- Is this an edge case or long-running test? → `@extended`

When in doubt, start with `@full-regression` and promote to `@core-regression` or `@smoke` if the test proves valuable.

## Known Issues

These are documented for awareness. Fixes should go through separate reviewed PRs.

### searchUtil.ts Duplication

`search/searchUtil.ts` is a legacy file with duplicate functions that also exist in `search/searchSpecUtil.ts` (the production version). Duplicated functions include: `getSearchInput`, `fillSearchInputAndSubmit`, `toggleCheckbox`, `selectSortBy`, `refreshPageWithCurrentURL`, `clickAccordionWithTitle`. **New tests should always use `searchSpecUtil.ts`.** Future cleanup: consolidate `searchUtil.ts` into `searchSpecUtil.ts`.

### refreshPageWithCurrentURL Duplication

`refreshPageWithCurrentURL()` exists in both `playwrightUtils.ts` and `search/searchUtil.ts`. Future cleanup: remove the duplicate from `searchUtil.ts`.

### Workflow Typo: @core-regession

Both `e2e-daily.yml` and `e2e-weekly.yml` reference `@core-regession` (missing 's'). This may cause core-regression tests to be silently skipped in scheduled runs. Future cleanup: fix to `@core-regression`.

### Field Definition / Fill Data Key Coupling

No compile-time validation ensures that keys in field-definitions files match keys in fill-data files. A typo in either file causes a silent test failure (field is skipped, not errored). Future improvement: add TypeScript generic constraints or a validation utility.

## Catalog Maintenance

This catalog is a living document. It stays accurate because maintaining it is embedded in the development workflow.

### When Creating a New Utility

The author (human or agent) adds a catalog entry in the relevant feature section of this document. PR reviewers check: "Is there a catalog entry for this new function?"

The entry should be written in application-domain language — describe what the user does, not what the DOM does. For example:

- Good: "Waits for filter checkbox options (status, funding instrument, eligibility, agency) to finish loading in the drawer"
- Bad: "Waits for elements matching `[data-testid^='filter-option']` to be visible"

### When a Function Is Undocumented

If you encounter a utility function that is not in this catalog:
1. Read the implementation to understand what it does
2. Write a description in application-domain language
3. Add it to the relevant feature section
4. Include the catalog update in the same PR as your test

### Periodic Audit

Periodically verify the catalog against the actual codebase:
- Do all listed functions still exist?
- Do descriptions match current implementations?
- Are there exported functions in utility files that have no catalog entry?

Flag discrepancies and update the catalog accordingly.
