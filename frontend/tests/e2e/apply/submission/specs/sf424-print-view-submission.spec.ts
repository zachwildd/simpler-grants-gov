import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  SF424_FORM_CONFIG,
  SF424_FORM_MATCHER,
} from "tests/e2e/apply/fixtures/sf424-field-definitions";
import { sf424HappyPathTestDataWithUniqueValues } from "tests/e2e/apply/fixtures/sf424-fill-data";
import playwrightEnv from "tests/e2e/playwright-env";
import { VALID_TAGS } from "tests/e2e/tags";
import { authenticateE2eUser } from "tests/e2e/utils/authenticate-e2e-user-utils";
import { createApplication } from "tests/e2e/utils/create-application-utils";
import { fillForm } from "tests/e2e/utils/forms/general-forms-filling";
import {
  verifyFormStatusAfterSave,
  verifyFormStatusOnApplication,
} from "tests/e2e/utils/forms/verify-form-status-utils";
import { getOpportunityId } from "tests/e2e/utils/get-opportunityId-utils";
import { gotoWithRetry } from "tests/e2e/utils/lifecycle-utils";
import { submitApplicationAndVerify } from "tests/e2e/utils/submit-application-utils";

const { APPLY, FULL_REGRESSION, GRANTEE } = VALID_TAGS;
const { baseUrl, targetEnv, testOrgLabel } = playwrightEnv;

const STAGING_SF424_POC_OPPORTUNITY_ID =
  "c5de578a-b5e3-4a70-95ff-c97deb8793a0";
const OPPORTUNITY_URL = `/opportunity/${
  targetEnv === "staging"
    ? STAGING_SF424_POC_OPPORTUNITY_ID
    : getOpportunityId()
}`;

const applicantScenarios = [
  {
    testName:
      "SF-424 print view renders submitted organization applicant data",
    orgLabel: testOrgLabel,
    tokenPrefix: "org",
  },
  {
    testName: "SF-424 print view renders submitted individual applicant data",
    orgLabel: undefined,
    tokenPrefix: "ind",
  },
] as const;

function buildPrintViewUrl(formUrl: string): string {
  const parsed = new URL(formUrl, baseUrl);
  const match = parsed.pathname.match(
    /\/applications\/([a-f0-9-]+)\/form\/([a-f0-9-]+)$/i,
  );

  if (!match) {
    throw new Error(`Unable to parse application/form IDs from URL: ${formUrl}`);
  }

  const applicationId = match[1];
  const appFormId = match[2];
  const printPath = parsed.pathname.replace(
    /\/applications\/[a-f0-9-]+\/form\/[a-f0-9-]+$/i,
    `/print/application/${applicationId}/form/${appFormId}`,
  );

  return `${parsed.origin}${printPath}`;
}

async function verifyPrintViewRendering(
  page: Page,
  formData: ReturnType<typeof sf424HappyPathTestDataWithUniqueValues>,
) {
  await expect(page).toHaveTitle(/application for federal assistance/i);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Application for Federal Assistance (SF-424)",
  );
  await expect(page.locator(".apply-form-print-preview")).toBeVisible();

  await expect(page.getByText("Submission Type", { exact: false })).toBeVisible();
  await expect(page.getByText("Legal Name", { exact: false })).toBeVisible();
  await expect(page.getByText("Project Title", { exact: false })).toBeVisible();
  await expect(
    page.getByText("Authorized Representative", { exact: false }),
  ).toBeVisible();

  await expect(page.getByText(formData.organization_name)).toBeVisible();
  await expect(page.getByText(formData.project_title)).toBeVisible();
  await expect(page.getByText(formData.email)).toBeVisible();
  await expect(
    page.getByText(formData.authorized_representative_email),
  ).toBeVisible();
  await expect(page.getByText("sample-upload-kb.pdf", { exact: false })).toBeVisible();
  await expect(
    page.getByText("Applicant Delinquent on Federal Debt", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Yes", { exact: true })).toBeVisible();
  await expect(page.getByText("Application", { exact: false })).toBeVisible();
  await expect(page.getByText("New", { exact: false })).toBeVisible();

  const interactiveControls = page.locator(
    "input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])",
  );
  await expect(interactiveControls).toHaveCount(0);
}

// Skip non-Chrome browsers in staging
test.beforeEach(({ page: _ }, testInfo) => {
  if (targetEnv === "staging") {
    test.skip(
      testInfo.project.name !== "Chrome",
      "Staging MFA login is limited to Chrome to avoid OTP rate-limiting",
    );
  }
});

for (const { testName, orgLabel, tokenPrefix } of applicantScenarios) {
  test(
    testName,
    { tag: [FULL_REGRESSION, APPLY, GRANTEE] },
    async (
      { page, context }: { page: Page; context: BrowserContext },
      testInfo: TestInfo,
    ) => {
      test.setTimeout(420_000); // 7 minutes for full flow + staging MFA

      const isMobile = testInfo.project.name.match(/[Mm]obile/);
      await authenticateE2eUser(page, context, !!isMobile);

      await createApplication(page, OPPORTUNITY_URL, orgLabel);
      const applicationUrl = page.url();

      const uniqueToken = `${tokenPrefix}${Date.now()}`;
      const sf424Data = sf424HappyPathTestDataWithUniqueValues(uniqueToken);

      await fillForm(testInfo, page, SF424_FORM_CONFIG, sf424Data, false);
      await verifyFormStatusAfterSave(page, "complete");

      const sf424FormUrl = page.url();
      expect(sf424FormUrl).toMatch(
        /\/applications\/[a-f0-9-]+\/form\/[a-f0-9-]+/i,
      );

      await verifyFormStatusOnApplication(
        page,
        "complete",
        SF424_FORM_MATCHER,
        applicationUrl,
      );

      const submittedApplicationId = await submitApplicationAndVerify(
        page,
        "success",
      );

      await expect(
        page.getByRole("heading", {
          name: /your application has been submitted/i,
        }),
      ).toBeVisible();

      if (!submittedApplicationId) {
        throw new Error("Submission succeeded but no application ID was returned");
      }

      await expect(page.getByText(submittedApplicationId)).toBeVisible();

      const printViewUrl = buildPrintViewUrl(sf424FormUrl);
      await gotoWithRetry(page, printViewUrl, { waitUntil: "domcontentloaded" });
      await verifyPrintViewRendering(page, sf424Data);
    },
  );
}