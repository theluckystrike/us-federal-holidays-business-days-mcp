# Data sources

Every rule in `src/core.ts` comes from one of these pages. All were fetched on 2026-10-30.

| Source | URL | Fetched | Used for |
| --- | --- | --- | --- |
| OPM, Federal Holidays (tables 2011-2030 and footnotes) | https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/ | 2026-10-30 | Observed dates, Saturday to Friday and Sunday to Monday rules, Inauguration Day notes for 2013, 2017, 2021, 2025 and 2029 |
| Federal Reserve Board, K.8 Holidays Observed 2026-2030 (last update July 8, 2026) | https://www.federalreserve.gov/aboutthefed/k8.htm | 2026-10-30 | fed_banking calendar. Saturday holiday means Reserve Banks open the Friday before. Sunday holiday means closed the Monday after |
| 5 U.S.C. 6103 with amendment notes (Cornell LII) | https://www.law.cornell.edu/uscode/text/5/6103 | 2026-10-30 | The 11 holidays, 6103(b) Saturday rule, 6103(c) Inauguration Day, effective dates of Pub. L. 90-363 (1971), 94-97 (1978), 98-144 (1986), 117-17 (2021), E.O. 11582 sec. 3(a) Sunday rule |

## Rule history applied

- 1971 onward. Washington's Birthday 3rd Monday in February, Memorial Day last Monday in May, Columbus Day 2nd Monday in October (Pub. L. 90-363, effective January 1, 1971).
- 1971 to 1977. Veterans Day 4th Monday in October. From 1978 it is November 11 (Pub. L. 94-97, effective January 1, 1978).
- 1986 onward. Birthday of Martin Luther King, Jr., 3rd Monday in January (Pub. L. 98-144, effective the first January 1 after two years from November 2, 1983).
- 2021 onward. Juneteenth National Independence Day, June 19 (Pub. L. 117-17, June 17, 2021). In 2021 it fell on Saturday and OPM lists Friday, June 18.
- Inauguration Day. January 20 of each fourth year after 1965, the next day if January 20 is a Sunday, DC-area employees only, no in-lieu-of day when it falls on Saturday (OPM 2029 note).

## Verification

- `test/opm-table.test.mjs`: all 212 holiday rows in the OPM tables for 2011-2030 are parsed from the saved snapshot `sources/opm-federal-holidays-2026-10-30.txt` and compared to the core. 212 matched, 0 differed.
- `test/fixtures.test.mjs`: 29 tests with expected values copied from the OPM tables, the K.8 table and footnotes, the statute notes, and hand-checked calendar arithmetic.
