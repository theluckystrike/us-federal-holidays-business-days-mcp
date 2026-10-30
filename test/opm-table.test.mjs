// Parses every row of the OPM holiday tables (2011-2030) from the snapshot fetched
// 2026-10-30 and checks that the core produces the same observed date.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { listFederalHolidays } from "../dist/core.js";

const MONTHS = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
const lines = fs.readFileSync(new URL("../sources/opm-federal-holidays-2026-10-30.txt", import.meta.url), "utf8").split("\n").map((s) => s.trim());

test("every OPM table row 2011-2030 matches the computed observed date", () => {
  let year = null;
  let rows = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    const ym = /^(\d{4}) Holiday Schedule$/.exec(lines[i]);
    if (ym) { year = Number(ym[1]); continue; }
    const dm = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\w+) (\d{1,2})(, (\d{4}))?/.exec(lines[i]);
    if (!dm || !year) continue;
    const name = lines[i + 1].replace(/’/g, "'");
    const m = MONTHS[dm[2]];
    let y = dm[5] ? Number(dm[5]) : year;
    if (m === 12 && /New Year/.test(name)) y = year - 1;
    const want = `${y}-${String(m).padStart(2, "0")}-${String(Number(dm[3])).padStart(2, "0")}`;
    const h = listFederalHolidays(year).find((x) => x.name.toLowerCase().startsWith(name.toLowerCase().slice(0, 12)));
    assert.ok(h, `${year} ${name} missing`);
    assert.equal(h.observed_federal ?? h.legal_date, want, `${year} ${name}`);
    rows++;
  }
  assert.equal(rows, 212);
});
