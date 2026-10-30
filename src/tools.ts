import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  AS_OF,
  CalendarError,
  MONEY_URL,
  OPM_URL,
  FED_URL,
  USC_URL,
  addBusinessDays,
  countBusinessDays,
  invoiceDueDate,
  isBusinessDay,
  listFederalHolidays,
  sourceFor,
  validateExtra,
  type Calendar,
  type Roll,
} from "./core.js";

export const SERVER_NAME = "us-federal-holidays-business-days-mcp";
export const SERVER_VERSION = "1.0.0";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date like 2026-07-03.");
const calendar = z
  .enum(["federal", "fed_banking"])
  .default("federal")
  .describe("federal = OPM observance for federal employees (Saturday holiday -> Friday off). fed_banking = Federal Reserve Banks (Saturday holiday -> open Friday; Sunday -> closed Monday). Use fed_banking for ACH, wire and bank settlement dates.");
const includeInauguration = z
  .boolean()
  .default(false)
  .describe("federal calendar only: also close Inauguration Day (DC-area federal employees only, every 4 years).");
const extraClosed = z
  .array(isoDate)
  .max(100)
  .optional()
  .describe("Extra closed dates to treat as holidays, e.g. a one-off executive order closure such as 2025-01-09.");

type Payload = Record<string, unknown>;

function ok(summary: string, data: Payload, calendarUsed?: Calendar, extraMore?: string) {
  const body: Payload = {
    ...data,
    summary,
    as_of: AS_OF,
    source: calendarUsed ? sourceFor(calendarUsed) : OPM_URL,
    rules_source: USC_URL,
    more: MONEY_URL,
  };
  if (extraMore) body.more_note = extraMore;
  return {
    content: [
      { type: "text" as const, text: summary },
      { type: "text" as const, text: JSON.stringify(body, null, 2) },
    ],
    structuredContent: body,
  };
}

function fail(err: unknown) {
  const msg = err instanceof CalendarError ? err.message : `Unexpected error: ${(err as Error)?.message ?? String(err)}`;
  return { isError: true, content: [{ type: "text" as const, text: msg }] };
}

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function registerTools(server: McpServer): void {
  server.registerTool(
    "list_federal_holidays",
    {
      title: "List U.S. federal holidays for a year",
      description:
        "Exact U.S. federal holidays for any year 1971-2100 under 5 U.S.C. 6103: legal date, OPM observed date (Saturday -> Friday, Sunday -> Monday, so New Year's Day 2022 is observed Friday 2021-12-31) and the Federal Reserve closure date (Fed Banks stay OPEN the Friday before a Saturday holiday). Applies the rule history a model tends to get wrong: Juneteenth from 2021, MLK Day from 1986, Veterans Day on the 4th Monday of October 1971-1977, and Inauguration Day (DC area only, flagged optional). No network calls.",
      inputSchema: { year: z.number().int().min(1971).max(2100).describe("Calendar year, 1971-2100.") },
      annotations: { title: "List federal holidays", ...RO },
    },
    async ({ year }) => {
      try {
        const hol = listFederalHolidays(year);
        const shifted = hol.filter((h) => !h.optional_dc_area_only && h.observed_federal !== h.legal_date);
        const fedDiff = hol.filter((h) => !h.optional_dc_area_only && h.observed_federal !== h.observed_fed_banking);
        const core = hol.filter((h) => !h.optional_dc_area_only).length;
        let s = `${year} has ${core} federal holidays under 5 U.S.C. 6103.`;
        if (shifted.length) s += ` Observed on a different day: ${shifted.map((h) => `${h.name} ${h.legal_date} -> ${h.observed_federal}`).join("; ")}.`;
        if (fedDiff.length) s += ` Federal Reserve differs: ${fedDiff.map((h) => `${h.name} Fed ${h.observed_fed_banking ?? "open (Saturday holiday)"}`).join("; ")}.`;
        const inaug = hol.find((h) => h.optional_dc_area_only);
        if (inaug) s += ` Inauguration Day ${inaug.legal_date} is a holiday only for DC-area federal employees${inaug.observed_federal ? "" : " and has no in-lieu-of day because it falls on Saturday"}.`;
        return ok(s, { year, holidays: hol, fed_source: FED_URL }, "federal");
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "is_business_day",
    {
      title: "Check if a date is a U.S. business day",
      description:
        "Says whether a date (1971-2100) is a business day on the U.S. federal (OPM) calendar or the Federal Reserve banking calendar, names the holiday if any, and returns the previous and next business day. The two calendars differ when a holiday falls on Saturday: 2026-07-03 is a federal holiday but a Fed banking day.",
      inputSchema: { date: isoDate, calendar, include_inauguration_day: includeInauguration, extra_closed_dates: extraClosed },
      annotations: { title: "Is business day", ...RO },
    },
    async ({ date, calendar: cal, include_inauguration_day, extra_closed_dates }) => {
      try {
        const r = isBusinessDay(date, { calendar: cal, includeInaugurationDay: include_inauguration_day, extraClosedDates: validateExtra(extra_closed_dates) });
        const s = `${r.date} (${r.weekday}) is ${r.is_business_day ? "" : "not "}a business day on the ${cal === "federal" ? "federal (OPM)" : "Federal Reserve banking"} calendar. Reason: ${r.reason}. Previous business day ${r.previous_business_day}, next ${r.next_business_day}.`;
        return ok(s, { ...r }, cal);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "add_business_days",
    {
      title: "Add or subtract U.S. business days",
      description:
        "Adds (or with a negative number subtracts) N business days to a date, skipping weekends and observed U.S. federal or Federal Reserve holidays exactly. The start date is not counted. With 0, returns the start date if it is a business day, otherwise the next one. Lists every holiday skipped.",
      inputSchema: {
        start_date: isoDate,
        business_days: z.number().int().min(-20000).max(20000).describe("Business days to add; negative to go back."),
        calendar,
        include_inauguration_day: includeInauguration,
        extra_closed_dates: extraClosed,
      },
      annotations: { title: "Add business days", ...RO },
    },
    async ({ start_date, business_days, calendar: cal, include_inauguration_day, extra_closed_dates }) => {
      try {
        const r = addBusinessDays(start_date, business_days, { calendar: cal, includeInaugurationDay: include_inauguration_day, extraClosedDates: validateExtra(extra_closed_dates) });
        const sk = r.holidays_skipped.length ? ` Holidays skipped: ${r.holidays_skipped.map((h) => `${h.date} ${h.reason}`).join("; ")}.` : " No weekday holidays in the span.";
        const s = `${business_days} business day${Math.abs(business_days) === 1 ? "" : "s"} ${business_days < 0 ? "before" : "after"} ${start_date} on the ${cal} calendar is ${r.result_date} (${r.result_weekday}), ${Math.abs(r.calendar_days_spanned)} calendar days away.${sk}`;
        return ok(s, { ...r }, cal);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "count_business_days",
    {
      title: "Count U.S. business days between two dates",
      description:
        "Counts business days between two dates (1971-2100) on the U.S. federal or Federal Reserve calendar, excluding weekends and observed holidays. include_start and include_end default to true, like Excel NETWORKDAYS. If end is before start the count is negative. Lists the weekday holidays that were excluded.",
      inputSchema: {
        start_date: isoDate,
        end_date: isoDate,
        include_start: z.boolean().default(true),
        include_end: z.boolean().default(true),
        calendar,
        include_inauguration_day: includeInauguration,
        extra_closed_dates: extraClosed,
      },
      annotations: { title: "Count business days", ...RO },
    },
    async ({ start_date, end_date, include_start, include_end, calendar: cal, include_inauguration_day, extra_closed_dates }) => {
      try {
        const r = countBusinessDays(start_date, end_date, include_start, include_end, { calendar: cal, includeInaugurationDay: include_inauguration_day, extraClosedDates: validateExtra(extra_closed_dates) });
        const hol = r.holidays_on_weekdays.length ? ` Excluded weekday holidays: ${r.holidays_on_weekdays.map((h) => `${h.date} ${h.reason}`).join("; ")}.` : "";
        const s = `There are ${r.business_days} business days from ${start_date} to ${end_date} (start ${include_start ? "included" : "excluded"}, end ${include_end ? "included" : "excluded"}) on the ${cal} calendar: ${r.calendar_days} calendar days, ${r.weekend_days} weekend days.${hol}`;
        return ok(s, { ...r }, cal);
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "invoice_due_date",
    {
      title: "Invoice due date from net terms",
      description:
        "Computes an invoice due date from an issue date and net terms in calendar days (Net 30 = 30), then optionally rolls a weekend or U.S. holiday due date: following (next business day), preceding, or modified_following (next business day unless it crosses into the next month). Uses exact observed federal or Federal Reserve holidays.",
      inputSchema: {
        issue_date: isoDate,
        net_days: z.number().int().min(0).max(3650).describe("Net terms in calendar days, e.g. 30 for Net 30."),
        roll: z.enum(["none", "following", "preceding", "modified_following"]).default("following").describe("How to move a due date that is not a business day."),
        calendar: z
          .enum(["federal", "fed_banking"])
          .default("fed_banking")
          .describe("fed_banking (default) matches when banks settle payments; federal uses OPM observance."),
        extra_closed_dates: extraClosed,
      },
      annotations: { title: "Invoice due date", ...RO },
    },
    async ({ issue_date, net_days, roll, calendar: cal, extra_closed_dates }) => {
      try {
        const r = invoiceDueDate(issue_date, net_days, roll as Roll, { calendar: cal, extraClosedDates: validateExtra(extra_closed_dates) });
        let s = `An invoice issued ${issue_date} on Net ${net_days} is nominally due ${r.nominal_due_date} (${r.nominal_weekday}).`;
        s += r.rolled
          ? ` That is not a business day (${r.roll_reason}), so with ${roll} rolling it is due ${r.due_date} (${r.due_weekday}).`
          : r.nominal_is_business_day
            ? " That is a business day, so no roll is needed."
            : ` That is not a business day (${r.roll_reason}); roll is none, so the date stands.`;
        s += ` That is ${r.business_days_from_issue} business days after issue on the ${cal} calendar.`;
        return ok(s, { ...r }, cal, "The invoice and dunning servers in the Zovo MCP back-office bundle use these due dates for reminders and late-fee schedules: " + MONEY_URL);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
