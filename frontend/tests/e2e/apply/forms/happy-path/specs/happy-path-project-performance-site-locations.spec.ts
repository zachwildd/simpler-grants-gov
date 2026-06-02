/**
 * @feature Apply - Application Form Happy Path
 * @featureFile e2e/apply/forms/happy-path/features/happy-path-forms.feature
 * @scenario Application form completion happy path - Project/Performance Site Locations
 */

import {
  test,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  PROJECT_PERFORMANCE_SITE_LOCATIONS_FORM_CONFIG,
} from "tests/e2e/apply/fixtures/project-performance-site-locations-field-definitions";
import { projectPerformanceSiteLocationsHappyPathTestData } from "tests/e2e/apply/fixtures/project-performance-site-locations-fill-data";
import playwrightEnv from "tests/e2e/playwright-env";
import { VALID_TAGS } from "tests/e2e/tags";
import { authenticateE2eUser } from "tests/e2e/utils/authenticate-e2e-user-utils";
import { createApplication } from "tests/e2e/utils/create-application-utils";
import { fillForm } from "tests/e2e/utils/forms/general-forms-filling";
import { verifyFormStatusAfterSave } from "tests/e2e/utils/forms/verify-form-status-utils";
import { getOpportunityId } from "tests/e2e/utils/get-opportunityId-utils";
import { v5 as uuidv5 } from "uuid";

const { APPLY, APPLY_FORMS, CORE_REGRESSION } = VALID_TAGS;
const { testOrgLabel, targetEnv } = playwrightEnv;

const PROJECT_PERFORMANCE_SITE_LOCATIONS_FORM_ID =
  "6ebd786f-cccf-4ee1-a100-61436975025b";
const formSpecificOpportunityId = uuidv5(
  `simpler-grants-gov.form.${PROJECT_PERFORMANCE_SITE_LOCATIONS_FORM_ID}`,
  uuidv5.DNS,
);

const OPPORTUNITY_URL = `/opportunity/${
  targetEnv === "staging" ? formSpecificOpportunityId : getOpportunityId()
}`;

// Skip non-Chrome browsers in staging
test.beforeEach(({ page: _ }, testInfo) => {
  if (targetEnv === "staging") {
    test.skip(
      testInfo.project.name !== "Chrome",
      "Staging MFA login is limited to Chrome to avoid OTP rate-limiting",
    );
  }
});

test(
  "Application form completion happy path - Project/Performance Site Locations",
  { tag: [APPLY, APPLY_FORMS, CORE_REGRESSION] },
  async (
    { page, context }: { page: Page; context: BrowserContext },
    testInfo: TestInfo,
  ) => {
    test.setTimeout(300_000); // 5 min timeout

    const isMobile = testInfo.project.name.match(/[Mm]obile/);

    // Given the user is logged in
    await authenticateE2eUser(page, context, !!isMobile);

    // Covers creating a new application for this form's opportunity.
    await createApplication(page, OPPORTUNITY_URL, testOrgLabel);

    // Open form, fill with valid data, and save.
    await fillForm(
      testInfo,
      page,
      PROJECT_PERFORMANCE_SITE_LOCATIONS_FORM_CONFIG,
      projectPerformanceSiteLocationsHappyPathTestData,
      false,
    );

    // Validate save success and no validation errors.
    await verifyFormStatusAfterSave(page, "complete");
  },
);
