import path from "path";

const TEST_UPLOAD_DIR = path.resolve(__dirname, "../../test-upload-files");

export const projectPerformanceSiteLocationsHappyPathTestData = {
  primary_site_organization_name: "Project Performance Site Org",
  primary_site_uei: "ABCDEF123456",
  primary_site_address_street1: "123 Performance Lane",
  primary_site_address_street2: "Suite 200",
  primary_site_address_city: "Silver Spring",
  primary_site_address_county: "Montgomery",
  primary_site_address_state: "MD: Maryland",
  primary_site_address_country: "USA: UNITED STATES",
  primary_site_address_zip_code: "20910",
  primary_site_congressional_district: "MD-005",
  additional_locations_attachment: `${TEST_UPLOAD_DIR}/sample-upload-kb.pdf`,
} as const;
