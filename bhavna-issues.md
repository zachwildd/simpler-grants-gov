I found **6 open issues currently assigned to `Bhavna-Ramachandran` in `HHS/simpler-grants-gov`** as of May 28, 2026.

| Issue | Test work to help with |
|---|---|
| [#10228 Project/Performance Site Locations form: Create E2E "Happy Path" Test](https://github.com/HHS/simpler-grants-gov/issues/10228) | Create a staging E2E happy path: new application, open form, fill valid fields, save, assert no validation errors. |
| [#10577 SF-424 Form: Add E2E testing of Print Form](https://github.com/HHS/simpler-grants-gov/issues/10577) | Build on the print-form POC for SF-424: fill unique data, save, submit, open print view, verify entered/prepopulated values and print layout. |
| [#10249 POC E2E testing of Print Form](https://github.com/HHS/simpler-grants-gov/issues/10249) | Looks mostly complete in the checklist but still open. Useful as the reference implementation for #10577. |
| [#10457 Search - Audit Confluence regression test cases against existing test coverage](https://github.com/HHS/simpler-grants-gov/issues/10457) | Audit found lots of search test gaps. Best candidates: missing specs for filter drawer behavior, saved searches, sort behavior, saved opportunities, and result navigation. |
| [#5152 Successfully mock external requests for e2e testing](https://github.com/HHS/simpler-grants-gov/issues/5152) | Stabilize newsletter/subscription E2E tests by mocking the external Sendy service or deciding to remove flaky coverage. |
| [#8796 Organize test utils](https://github.com/HHS/simpler-grants-gov/issues/8796) | Refactor old Playwright/search test utility files into the main utils structure; label: `Maintenance`. |

Suggested first-pass priority for helping her: **#10577**, **#10228**, and selected test gaps from **#10457**. **#10249** is worth reading first because it appears to be the POC that #10577 is meant to generalize.