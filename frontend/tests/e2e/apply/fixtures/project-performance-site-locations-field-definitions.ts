import { FORM_DEFAULTS } from "tests/e2e/utils/forms/form-defaults";
import { FormFillFieldDefinitions } from "tests/e2e/utils/forms/general-forms-filling";

export const PROJECT_PERFORMANCE_SITE_LOCATIONS_FORM_MATCHER =
  /PROJECT\/PERFORMANCE\s+SITE\s+LOCATION\(S\)|Project\/Performance\s+Site\s+Location/i;

export const fieldDefinitionsProjectPerformanceSiteLocations: FormFillFieldDefinitions =
  {
    primary_site_organization_name: {
      testId: "primary_site--organization_name",
      type: "text",
      section: "Project/Performance Site Primary Location",
      field: "Organization Name",
    },
    primary_site_uei: {
      testId: "primary_site--uei",
      type: "text",
      section: "Project/Performance Site Primary Location",
      field: "UEI",
    },
    primary_site_address_street1: {
      testId: "primary_site--address--street1",
      type: "text",
      section: "Project/Performance Site Primary Location",
      field: "Street 1",
    },
    primary_site_address_street2: {
      testId: "primary_site--address--street2",
      type: "text",
      section: "Project/Performance Site Primary Location",
      field: "Street 2",
    },
    primary_site_address_city: {
      testId: "primary_site--address--city",
      type: "text",
      section: "Project/Performance Site Primary Location",
      field: "City",
    },
    primary_site_address_county: {
      testId: "primary_site--address--county",
      type: "text",
      section: "Project/Performance Site Primary Location",
      field: "County",
    },
    primary_site_address_state: {
      selector: "#primary_site--address--state",
      type: "dropdown",
      section: "Project/Performance Site Primary Location",
      field: "State",
    },
    primary_site_address_country: {
      selector: "#primary_site--address--country",
      type: "dropdown",
      section: "Project/Performance Site Primary Location",
      field: "Country",
    },
    primary_site_address_zip_code: {
      testId: "primary_site--address--zip_code",
      type: "text",
      section: "Project/Performance Site Primary Location",
      field: "Zip Code",
    },
    primary_site_congressional_district: {
      testId: "primary_site--congressional_district",
      type: "text",
      section: "Project/Performance Site Primary Location",
      field: "Congressional District",
    },
    additional_locations_attachment: {
      selector: 'input[name="additional_locations_attachment"][type="file"]',
      type: "file",
      section: "Additional Location(s) Attachment",
      field: "Additional Location(s)",
    },
  };

export const PROJECT_PERFORMANCE_SITE_LOCATIONS_FORM_CONFIG = {
  ...FORM_DEFAULTS,
  formName: PROJECT_PERFORMANCE_SITE_LOCATIONS_FORM_MATCHER,
  fields: fieldDefinitionsProjectPerformanceSiteLocations,
} as const;
