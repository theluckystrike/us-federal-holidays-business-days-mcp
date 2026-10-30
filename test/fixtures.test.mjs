// Fixtures. Each expected value is copied from a published table fetched 2026-10-30
// (OPM federal holidays page, Federal Reserve K.8, 5 U.S.C. 6103 notes) or is hand-checked
// arithmetic on a printed calendar. See DATA_SOURCES.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listFederalHolidays,
  isBusinessDay,
  addBusinessDays,
  countBusinessDays,
  invoiceDueDate,
  daysFromCivil,
  toIso,
  weekday,
} from "../dist/core.js";

const F = { calendar: "federal" };
const B = { calendar: "fed_banking" };
const obs = (year, name) => listFederalHolidays(year).find((h) => h.name.startsWith(name));

// ---------- OPM published tables ----------

test("OPM 2021: Juneteenth (Sat) observed Fri 2021-06-18", () => {
  assert.equal(obs(2021, "Juneteenth").observed_federal, "2021-06-18");
});

test("OPM 2022: New Year's Day observed Fri 2021-12-31, in the previous year", () => {
  const h = obs(2022, "New Year");
  assert.equal(h.observed_federal, "2021-12-31");
  assert.equal(h.observed_in_previous_year, true);
});

test("OPM 2022: Juneteenth Mon 06-20 and Christmas Mon 12-26 (Sunday holidays)", () => {
  assert.equal(obs(2022, "Juneteenth").observed_federal, "2022-06-20");
  assert.equal(obs(2022, "Christmas").observed_federal, "2022-12-26");
});

test("OPM 2021: Independence Day Mon 07-05, Christmas Fri 12-24", () => {
  assert.equal(obs(2021, "Independence").observed_federal, "2021-07-05");
  assert.equal(obs(2021, "Christmas").observed_federal, "2021-12-24");
});

test("OPM 2020: Independence Day Fri 07-03 and no Juneteenth before 2021", () => {
  assert.equal(obs(2020, "Independence").observed_federal, "2020-07-03");
  assert.equal(obs(2020, "Juneteenth"), undefined);
  assert.equal(listFederalHolidays(2020).length, 10);
});

test("OPM 2023: New Year Mon 01-02, Veterans Day Fri 11-10", () => {
  assert.equal(obs(2023, "New Year").observed_federal, "2023-01-02");
  assert.equal(obs(2023, "Veterans").observed_federal, "2023-11-10");
});

test("OPM 2026: Independence Day observed Fri 2026-07-03, MLK 01-19, Thanksgiving 11-26", () => {
  assert.equal(obs(2026, "Independence").observed_federal, "2026-07-03");
  assert.equal(obs(2026, "Birthday of Martin").observed_federal, "2026-01-19");
  assert.equal(obs(2026, "Thanksgiving").observed_federal, "2026-11-26");
});

test("OPM 2028: New Year observed Fri 2027-12-31, Veterans Day Fri 2028-11-10", () => {
  assert.equal(obs(2028, "New Year").observed_federal, "2027-12-31");
  assert.equal(obs(2028, "Veterans").observed_federal, "2028-11-10");
});

test("OPM 2011: New Year observed Fri 2010-12-31; OPM 2017 New Year Mon 01-02; 2018 Veterans Mon 11-12", () => {
  assert.equal(obs(2011, "New Year").observed_federal, "2010-12-31");
  assert.equal(obs(2017, "New Year").observed_federal, "2017-01-02");
  assert.equal(obs(2018, "Veterans").observed_federal, "2018-11-12");
});

test("OPM 2025: Inauguration Day Mon 01-20, DC area only", () => {
  const h = obs(2025, "Inauguration");
  assert.equal(h.observed_federal, "2025-01-20");
  assert.equal(h.optional_dc_area_only, true);
  assert.equal(h.observed_fed_banking, null);
});

test("OPM 2029 note: Inauguration Day Sat 01-20 has no in-lieu-of day", () => {
  const h = obs(2029, "Inauguration");
  assert.equal(h.legal_date, "2029-01-20");
  assert.equal(h.observed_federal, null);
  assert.equal(isBusinessDay("2029-01-19", { calendar: "federal", includeInaugurationDay: true }).is_business_day, true);
});

test("OPM 2013 note: Inauguration Day Mon 01-21 (Jan 20 a Sunday), same day as MLK Day", () => {
  assert.equal(obs(2013, "Inauguration").legal_date, "2013-01-21");
  assert.equal(obs(2013, "Birthday of Martin").observed_federal, "2013-01-21");
});

test("Inauguration Day is excluded from business-day math unless asked", () => {
  assert.equal(isBusinessDay("2021-01-20", F).is_business_day, true);
  assert.equal(isBusinessDay("2021-01-20", { calendar: "federal", includeInaugurationDay: true }).is_business_day, false);
});

// ---------- 5 U.S.C. 6103 amendment history ----------

test("Pub. L. 90-363 / 94-97: Veterans Day 4th Monday of October 1975, November 11 from 1978", () => {
  assert.equal(obs(1975, "Veterans").legal_date, "1975-10-27");
  assert.equal(obs(1978, "Veterans").legal_date, "1978-11-11");
  assert.equal(obs(1978, "Veterans").observed_federal, "1978-11-10");
});

test("Pub. L. 98-144: MLK Day absent in 1985, first observed Mon 1986-01-20", () => {
  assert.equal(obs(1985, "Birthday of Martin"), undefined);
  assert.equal(obs(1986, "Birthday of Martin").legal_date, "1986-01-20");
});

// ---------- Federal Reserve K.8 (2026-2030) ----------

test("K.8 2026-2030: legal dates match the published table", () => {
  const k8 = {
    "Birthday of Martin": ["01-19", "01-18", "01-17", "01-15", "01-21"],
    "Washington": ["02-16", "02-15", "02-21", "02-19", "02-18"],
    "Memorial": ["05-25", "05-31", "05-29", "05-28", "05-27"],
    "Labor": ["09-07", "09-06", "09-04", "09-03", "09-02"],
    "Columbus": ["10-12", "10-11", "10-09", "10-08", "10-14"],
    "Thanksgiving": ["11-26", "11-25", "11-23", "11-22", "11-28"],
  };
  for (const [name, dates] of Object.entries(k8)) {
    dates.forEach((md, i) => assert.equal(obs(2026 + i, name).legal_date, `${2026 + i}-${md}`, `${name} ${2026 + i}`));
  }
});

test("K.8: Reserve Banks open Fri 2026-07-03 although it is the OPM holiday", () => {
  assert.equal(isBusinessDay("2026-07-03", B).is_business_day, true);
  assert.equal(isBusinessDay("2026-07-03", F).is_business_day, false);
});

test("K.8: Reserve Banks open 2027-06-18, 2027-12-24, 2027-12-31 and 2028-11-10 (Saturday holidays)", () => {
  for (const d of ["2027-06-18", "2027-12-24", "2027-12-31", "2028-11-10"]) {
    assert.equal(isBusinessDay(d, B).is_business_day, true, d);
    assert.equal(isBusinessDay(d, F).is_business_day, false, d);
  }
});

test("K.8: Reserve Banks closed Mon 2027-07-05 and Mon 2029-11-12 (Sunday holidays)", () => {
  assert.equal(isBusinessDay("2027-07-05", B).is_business_day, false);
  assert.equal(isBusinessDay("2029-11-12", B).is_business_day, false);
});

test("K.8 rule for 2022-01-01 (Saturday): Fed open Fri 2021-12-31, OPM closed", () => {
  assert.equal(obs(2022, "New Year").observed_fed_banking, null);
  assert.equal(isBusinessDay("2021-12-31", B).is_business_day, true);
  const r = isBusinessDay("2021-12-31", F);
  assert.equal(r.is_business_day, false);
  assert.equal(r.holiday, "New Year's Day");
});

// ---------- hand-checked arithmetic ----------

test("add_business_days: 2026-07-02 +1 is 07-06 federal, 07-03 Fed", () => {
  assert.equal(addBusinessDays("2026-07-02", 1, F).result_date, "2026-07-06");
  assert.equal(addBusinessDays("2026-07-02", 1, B).result_date, "2026-07-03");
});

test("add_business_days across a year: 2021-12-30 +1 is 2022-01-03 federal, 2021-12-31 Fed", () => {
  const r = addBusinessDays("2021-12-30", 1, F);
  assert.equal(r.result_date, "2022-01-03");
  assert.deepEqual(r.holidays_skipped.map((h) => h.date), ["2021-12-31"]);
  assert.equal(addBusinessDays("2021-12-30", 1, B).result_date, "2021-12-31");
});

test("add_business_days negative and zero", () => {
  assert.equal(addBusinessDays("2026-01-02", -1, F).result_date, "2025-12-31");
  assert.equal(addBusinessDays("2026-07-04", 0, F).result_date, "2026-07-06");
  assert.equal(addBusinessDays("2026-07-01", 0, F).result_date, "2026-07-01");
});

test("count_business_days: November 2026 has 19 federal business days", () => {
  const r = countBusinessDays("2026-11-01", "2026-11-30", true, true, F);
  assert.equal(r.business_days, 19);
  assert.equal(r.weekend_days, 9);
  assert.deepEqual(r.holidays_on_weekdays.map((h) => h.date), ["2026-11-11", "2026-11-26"]);
});

test("count_business_days: inclusive flags and reversed range", () => {
  assert.equal(countBusinessDays("2026-07-02", "2026-07-06", false, true, F).business_days, 1);
  assert.equal(countBusinessDays("2026-07-02", "2026-07-06", false, true, B).business_days, 2);
  assert.equal(countBusinessDays("2026-11-30", "2026-11-01", true, true, F).business_days, -19);
});

test("invoice_due_date: Net 30 from 2026-06-03 lands Fri 07-03; Fed keeps it, OPM rolls to 07-06", () => {
  const b = invoiceDueDate("2026-06-03", 30, "following", B);
  assert.equal(b.due_date, "2026-07-03");
  assert.equal(b.rolled, false);
  const f = invoiceDueDate("2026-06-03", 30, "following", F);
  assert.equal(f.nominal_due_date, "2026-07-03");
  assert.equal(f.due_date, "2026-07-06");
});

test("invoice_due_date: Thanksgiving rolls forward; modified_following stays in month", () => {
  assert.equal(invoiceDueDate("2026-10-27", 30, "following", B).due_date, "2026-11-27");
  assert.equal(invoiceDueDate("2026-04-30", 31, "modified_following", B).due_date, "2026-05-29");
  assert.equal(invoiceDueDate("2026-04-30", 31, "following", B).due_date, "2026-06-01");
  assert.equal(invoiceDueDate("2026-04-30", 31, "none", B).due_date, "2026-05-31");
});

test("errors: impossible dates, out-of-range years, bad terms", () => {
  assert.throws(() => isBusinessDay("2026-02-30", F), /not a real calendar date/);
  assert.throws(() => listFederalHolidays(1970), /1971 to 2100/);
  assert.throws(() => isBusinessDay("2101-01-03", F), /outside the supported range/);
  assert.throws(() => invoiceDueDate("2026-01-01", -5, "following", F), /net_days/);
});

test("day arithmetic agrees with JavaScript Date across 1971-2100", () => {
  for (let day = daysFromCivil(1971, 1, 1); day <= daysFromCivil(2100, 12, 31); day += 37) {
    const d = new Date(day * 86400000);
    assert.equal(toIso(day), d.toISOString().slice(0, 10));
    assert.equal(weekday(day), d.getUTCDay());
  }
});
