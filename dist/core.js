// Pure calendar core. No I/O. All dates are ISO "YYYY-MM-DD" strings handled as
// whole days since 1970-01-01 (UTC day numbers), so no time zone can shift a date.
//
// Rules (sources fetched 2026-10-30, see DATA_SOURCES.md):
// - 5 U.S.C. 6103(a): the 11 legal public holidays and their dates.
// - Pub. L. 90-363 (eff. 1971-01-01): Monday holidays; Veterans Day 4th Monday of October.
// - Pub. L. 94-97 (eff. 1978-01-01): Veterans Day back to November 11.
// - Pub. L. 98-144 (eff. 1986-01-01): Birthday of Martin Luther King, Jr., 3rd Monday of January.
// - Pub. L. 117-17 (enacted 2021-06-17): Juneteenth National Independence Day, June 19.
// - 5 U.S.C. 6103(b)(1): Saturday holiday -> preceding Friday (Mon-Fri employees).
// - E.O. 11582 sec. 3(a): Sunday holiday -> following Monday.
// - 5 U.S.C. 6103(c): Inauguration Day, January 20 of each fourth year after 1965, DC-area only;
//   if January 20 is a Sunday, the next day; no in-lieu-of day for a Saturday.
// - Federal Reserve K.8: Saturday holiday -> Reserve Banks OPEN the preceding Friday;
//   Sunday holiday -> closed the following Monday.
export const AS_OF = "2026-10-30";
export const MIN_YEAR = 1971;
export const MAX_YEAR = 2100;
export const OPM_URL = "https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/";
export const FED_URL = "https://www.federalreserve.gov/aboutthefed/k8.htm";
export const USC_URL = "https://www.law.cornell.edu/uscode/text/5/6103";
export const MONEY_URL = "https://mcp.zovo.one/?utm_source=mcp&utm_medium=us-federal-holidays-business-days-mcp";
export class CalendarError extends Error {
}
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// ---------- day-number arithmetic (proleptic Gregorian, H. Hinnant's algorithms) ----------
export function daysFromCivil(y, m, d) {
    const yy = m <= 2 ? y - 1 : y;
    const era = Math.floor(yy / 400);
    const yoe = yy - era * 400;
    const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
}
export function civilFromDays(z) {
    const zz = z + 719468;
    const era = Math.floor(zz / 146097);
    const doe = zz - era * 146097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153);
    const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    const m = mp + (mp < 10 ? 3 : -9);
    return [m <= 2 ? era * 400 + yoe + 1 : era * 400 + yoe, m, d];
}
export function weekday(day) {
    return (((day + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday (4)
}
export function toIso(day) {
    const [y, m, d] = civilFromDays(day);
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
export function weekdayName(day) {
    return DOW[weekday(day)];
}
const MIN_DAY = daysFromCivil(MIN_YEAR, 1, 1);
const MAX_DAY = daysFromCivil(MAX_YEAR, 12, 31);
export function parseIso(s, field = "date") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m)
        throw new CalendarError(`${field} must be an ISO date like 2026-07-03, got "${s}".`);
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const day = daysFromCivil(y, mo, d);
    if (toIso(day) !== s)
        throw new CalendarError(`${field} "${s}" is not a real calendar date.`);
    assertInRange(day, field);
    return day;
}
function assertInRange(day, field) {
    if (day < MIN_DAY || day > MAX_DAY) {
        throw new CalendarError(`${field} ${toIso(day)} is outside the supported range ${MIN_YEAR}-01-01 to ${MAX_YEAR}-12-31.`);
    }
}
// ---------- holiday rules ----------
function nthWeekday(y, m, dow, n) {
    const first = daysFromCivil(y, m, 1);
    const offset = (dow - weekday(first) + 7) % 7;
    return first + offset + (n - 1) * 7;
}
function lastWeekday(y, m, dow) {
    const lastDay = m === 12 ? daysFromCivil(y, 12, 31) : daysFromCivil(y, m + 1, 1) - 1;
    return lastDay - ((weekday(lastDay) - dow + 7) % 7);
}
function rawHolidays(y) {
    const MON = 1;
    const THU = 4;
    const list = [{ name: "New Year's Day", day: daysFromCivil(y, 1, 1), rule: "January 1" }];
    if (y >= 1986) {
        list.push({ name: "Birthday of Martin Luther King, Jr.", day: nthWeekday(y, 1, MON, 3), rule: "Third Monday in January (from 1986, Pub. L. 98-144)" });
    }
    list.push({ name: "Washington's Birthday", day: nthWeekday(y, 2, MON, 3), rule: "Third Monday in February" }, { name: "Memorial Day", day: lastWeekday(y, 5, MON), rule: "Last Monday in May" });
    if (y >= 2021) {
        list.push({ name: "Juneteenth National Independence Day", day: daysFromCivil(y, 6, 19), rule: "June 19 (from 2021, Pub. L. 117-17)" });
    }
    list.push({ name: "Independence Day", day: daysFromCivil(y, 7, 4), rule: "July 4" }, { name: "Labor Day", day: nthWeekday(y, 9, MON, 1), rule: "First Monday in September" }, { name: "Columbus Day", day: nthWeekday(y, 10, MON, 2), rule: "Second Monday in October" });
    if (y >= 1978) {
        list.push({ name: "Veterans Day", day: daysFromCivil(y, 11, 11), rule: "November 11 (from 1978, Pub. L. 94-97)" });
    }
    else {
        list.push({ name: "Veterans Day", day: nthWeekday(y, 10, MON, 4), rule: "Fourth Monday in October (1971-1977, Pub. L. 90-363)" });
    }
    list.push({ name: "Thanksgiving Day", day: nthWeekday(y, 11, THU, 4), rule: "Fourth Thursday in November" }, { name: "Christmas Day", day: daysFromCivil(y, 12, 25), rule: "December 25" });
    if ((y - 1965) % 4 === 0 && y > 1965) {
        const jan20 = daysFromCivil(y, 1, 20);
        const day = weekday(jan20) === 0 ? jan20 + 1 : jan20;
        list.push({ name: "Inauguration Day", day, rule: "January 20 of each fourth year after 1965; next day if a Sunday (5 U.S.C. 6103(c))", inauguration: true });
    }
    return list.sort((a, b) => a.day - b.day);
}
function observedFederal(day) {
    const w = weekday(day);
    if (w === 6)
        return day - 1;
    if (w === 0)
        return day + 1;
    return day;
}
function observedFedBanking(day) {
    const w = weekday(day);
    if (w === 6)
        return null;
    if (w === 0)
        return day + 1;
    return day;
}
function toHoliday(r, y) {
    if (r.inauguration) {
        const w = weekday(r.day);
        const sat = w === 6;
        return {
            name: r.name,
            legal_date: toIso(r.day),
            legal_weekday: weekdayName(r.day),
            observed_federal: sat ? null : toIso(r.day),
            observed_fed_banking: null,
            observed_in_previous_year: false,
            optional_dc_area_only: true,
            rule: r.rule,
            note: sat
                ? "Falls on Saturday. No in-lieu-of day (5 U.S.C. 6103(c)). Applies only to federal and DC government employees in DC, Montgomery and Prince George's (MD), Arlington and Fairfax (VA), Alexandria and Falls Church."
                : "Applies only to federal and DC government employees in DC, Montgomery and Prince George's (MD), Arlington and Fairfax (VA), Alexandria and Falls Church. Not a Federal Reserve holiday. Excluded from business-day math unless include_inauguration_day is true.",
        };
    }
    const of = observedFederal(r.day);
    const ob = observedFedBanking(r.day);
    return {
        name: r.name,
        legal_date: toIso(r.day),
        legal_weekday: weekdayName(r.day),
        observed_federal: toIso(of),
        observed_fed_banking: ob === null ? null : toIso(ob),
        observed_in_previous_year: civilFromDays(of)[0] < y,
        optional_dc_area_only: false,
        rule: r.rule,
        note: weekday(r.day) === 6
            ? "Falls on Saturday. Federal employees get the Friday before (5 U.S.C. 6103(b)). Federal Reserve Banks stay open that Friday (K.8)."
            : weekday(r.day) === 0
                ? "Falls on Sunday. Observed the Monday after by federal employees (E.O. 11582) and the Federal Reserve."
                : undefined,
    };
}
function assertYear(y) {
    if (!Number.isInteger(y) || y < MIN_YEAR || y > MAX_YEAR) {
        throw new CalendarError(`year must be an integer from ${MIN_YEAR} to ${MAX_YEAR}, got ${y}.`);
    }
}
export function listFederalHolidays(year) {
    assertYear(year);
    return rawHolidays(year).map((r) => toHoliday(r, year));
}
const closureCache = new Map();
function closuresForYear(y, calendar, inaug) {
    const key = `${y}|${calendar}|${inaug}`;
    const hit = closureCache.get(key);
    if (hit)
        return hit;
    const out = new Map();
    for (const r of rawHolidays(y)) {
        if (r.inauguration) {
            if (calendar === "federal" && inaug && weekday(r.day) !== 6)
                out.set(r.day, { name: r.name, legal_date: toIso(r.day) });
            continue;
        }
        const obs = calendar === "federal" ? observedFederal(r.day) : observedFedBanking(r.day);
        if (obs !== null && !out.has(obs))
            out.set(obs, { name: r.name, legal_date: toIso(r.day) });
    }
    closureCache.set(key, out);
    return out;
}
export function closureOn(day, opts) {
    const [y] = civilFromDays(day);
    const inaug = Boolean(opts.includeInaugurationDay);
    for (const yy of [y, y + 1]) {
        if (yy < MIN_YEAR)
            continue;
        const c = closuresForYear(yy, opts.calendar, inaug).get(day);
        if (c)
            return c;
    }
    if (opts.extraClosedDates?.includes(toIso(day)))
        return { name: "Extra closed date (caller supplied)", legal_date: toIso(day) };
    return null;
}
export function validateExtra(extra) {
    const out = [];
    for (const s of extra ?? []) {
        parseIso(s, "extra_closed_dates item");
        out.push(s);
    }
    return out;
}
export function isBusinessDayNum(day, opts) {
    const w = weekday(day);
    if (w === 0 || w === 6)
        return false;
    return closureOn(day, opts) === null;
}
export function isBusinessDay(date, opts) {
    const day = parseIso(date);
    const w = weekday(day);
    const c = closureOn(day, opts);
    let reason;
    if (w === 0 || w === 6)
        reason = c ? `Weekend (${weekdayName(day)}) and ${c.name}` : `Weekend (${weekdayName(day)})`;
    else if (c)
        reason = c.legal_date === date ? `${c.name}` : `${c.name} observed (legal date ${c.legal_date})`;
    else {
        const fedOnly = opts.calendar === "fed_banking" ? closureOn(day, { calendar: "federal" }) : null;
        reason = fedOnly
            ? `Open. ${fedOnly.name} falls on Saturday ${fedOnly.legal_date}; Federal Reserve Banks stay open the Friday before, although federal (OPM) employees are off today`
            : "Weekday with no holiday on this calendar";
    }
    return {
        date,
        weekday: weekdayName(day),
        calendar: opts.calendar,
        is_business_day: isBusinessDayNum(day, opts),
        reason,
        holiday: c?.name ?? null,
        holiday_legal_date: c?.legal_date ?? null,
        previous_business_day: toIso(step(day, -1, opts)),
        next_business_day: toIso(step(day, 1, opts)),
    };
}
function step(day, dir, opts) {
    let d = day;
    for (let i = 0; i < 30; i++) {
        d += dir;
        assertInRange(d, "result");
        if (isBusinessDayNum(d, opts))
            return d;
    }
    throw new CalendarError("No business day found within 30 days. Check extra_closed_dates.");
}
const MAX_SPAN = 30000;
export function addBusinessDays(start, n, opts) {
    if (!Number.isInteger(n) || Math.abs(n) > 20000)
        throw new CalendarError("business_days must be an integer from -20000 to 20000.");
    const s = parseIso(start, "start_date");
    const skipped = [];
    let d = s;
    if (n === 0) {
        while (!isBusinessDayNum(d, opts)) {
            noteSkip(d, opts, skipped);
            d += 1;
            assertInRange(d, "result");
        }
    }
    else {
        const dir = n > 0 ? 1 : -1;
        let left = Math.abs(n);
        let guard = 0;
        while (left > 0) {
            d += dir;
            assertInRange(d, "result");
            if (isBusinessDayNum(d, opts))
                left--;
            else
                noteSkip(d, opts, skipped);
            if (++guard > MAX_SPAN)
                throw new CalendarError("Span too large.");
        }
    }
    return {
        start_date: start,
        business_days: n,
        calendar: opts.calendar,
        result_date: toIso(d),
        result_weekday: weekdayName(d),
        calendar_days_spanned: d - s,
        holidays_skipped: skipped,
    };
}
function noteSkip(day, opts, out) {
    const w = weekday(day);
    if (w === 0 || w === 6)
        return;
    const c = closureOn(day, opts);
    if (c)
        out.push({ date: toIso(day), reason: c.legal_date === toIso(day) ? c.name : `${c.name} observed (legal ${c.legal_date})` });
}
export function countBusinessDays(start, end, includeStart, includeEnd, opts) {
    const a = parseIso(start, "start_date");
    const b = parseIso(end, "end_date");
    const sign = b >= a ? 1 : -1;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const loInc = sign === 1 ? includeStart : includeEnd;
    const hiInc = sign === 1 ? includeEnd : includeStart;
    let count = 0;
    let weekend = 0;
    let cal = 0;
    const hol = [];
    for (let d = lo; d <= hi; d++) {
        if (d === lo && !loInc)
            continue;
        if (d === hi && !hiInc)
            continue;
        cal++;
        const w = weekday(d);
        if (w === 0 || w === 6)
            weekend++;
        else if (isBusinessDayNum(d, opts))
            count++;
        else
            noteSkip(d, opts, hol);
    }
    return {
        start_date: start,
        end_date: end,
        include_start: includeStart,
        include_end: includeEnd,
        calendar: opts.calendar,
        business_days: sign * count,
        calendar_days: cal,
        weekend_days: weekend,
        holidays_on_weekdays: hol,
    };
}
export function invoiceDueDate(issue, netDays, roll, opts) {
    if (!Number.isInteger(netDays) || netDays < 0 || netDays > 3650)
        throw new CalendarError("net_days must be an integer from 0 to 3650.");
    const i = parseIso(issue, "issue_date");
    const nominal = i + netDays;
    assertInRange(nominal, "nominal due date");
    const nominalOk = isBusinessDayNum(nominal, opts);
    let due = nominal;
    if (!nominalOk && roll !== "none") {
        if (roll === "following")
            due = step(nominal, 1, opts);
        else if (roll === "preceding")
            due = step(nominal, -1, opts);
        else {
            const f = step(nominal, 1, opts);
            due = civilFromDays(f)[1] === civilFromDays(nominal)[1] ? f : step(nominal, -1, opts);
        }
    }
    let rollReason = null;
    if (!nominalOk) {
        const w = weekday(nominal);
        const c = closureOn(nominal, opts);
        rollReason = w === 0 || w === 6 ? `${toIso(nominal)} is a ${weekdayName(nominal)}` : `${toIso(nominal)} is ${c?.name ?? "a holiday"}${c && c.legal_date !== toIso(nominal) ? " observed" : ""}`;
    }
    const bd = countBusinessDays(issue, toIso(due), false, true, opts).business_days;
    return {
        issue_date: issue,
        net_days: netDays,
        roll,
        calendar: opts.calendar,
        nominal_due_date: toIso(nominal),
        nominal_weekday: weekdayName(nominal),
        nominal_is_business_day: nominalOk,
        due_date: toIso(due),
        due_weekday: weekdayName(due),
        rolled: due !== nominal,
        roll_reason: rollReason,
        business_days_from_issue: bd,
    };
}
export function sourceFor(calendar) {
    return calendar === "fed_banking" ? FED_URL : OPM_URL;
}
