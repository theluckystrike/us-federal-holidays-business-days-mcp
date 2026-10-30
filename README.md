# US Federal Holidays and Business Days MCP

Exact U.S. federal holidays and business-day math for any date from 1971 to 2100, as an MCP server for Claude, ChatGPT, Cursor and VS Code.

Models often get calendar arithmetic wrong. They forget that New Year's Day 2022 was observed on Friday, December 31, 2021, or that the Federal Reserve stays open on a Friday the government takes off. This server computes those dates exactly, with no network calls.

Hosted endpoint, no token needed:

```
https://us-federal-holidays-business-days-mcp.lipmichal.workers.dev/mcp
```

## Tools

| Tool | What it does |
| --- | --- |
| `list_federal_holidays` | All holidays for a year 1971-2100. Legal date, OPM observed date, Federal Reserve closure date, and Inauguration Day flagged as DC-area only. |
| `is_business_day` | Says if a date is a business day on the `federal` (OPM) or `fed_banking` (Federal Reserve) calendar. Names the holiday and gives the previous and next business day. |
| `add_business_days` | Adds or subtracts N business days. Lists every holiday it skipped. |
| `count_business_days` | Counts business days between two dates. Start and end are included by default, like Excel NETWORKDAYS. |
| `invoice_due_date` | Due date from an issue date and net terms (Net 30 = 30 calendar days). Rolls a weekend or holiday due date with `following`, `preceding` or `modified_following`. |

Every result has structured JSON, a one-paragraph summary, `as_of`, `source` (OPM or Federal Reserve) and `more`.

## What it knows that your model does not

- The observance rule. A Saturday holiday is observed on Friday by federal employees (5 U.S.C. 6103(b)). A Sunday holiday is observed on Monday (E.O. 11582). The Friday can fall in the previous year.
- The Federal Reserve rule is different. When a holiday falls on Saturday, Reserve Banks are open on Friday (K.8). So 2026-07-03 is a federal holiday but a banking day. Use `calendar: "fed_banking"` for ACH, wire and settlement dates.
- The rule history. Juneteenth from 2021. MLK Day from 1986. Veterans Day was the fourth Monday in October from 1971 to 1977.
- Inauguration Day. It applies only to DC-area federal employees, every four years. It moves to Monday when January 20 is a Sunday and has no substitute day when it is a Saturday (2029).
- All 212 holiday rows in OPM's published tables for 2011-2030 match this server's output. A test checks this.

## Install

### Claude.ai custom connector and ChatGPT developer mode

Paste the hosted URL. No token or sign-in is needed.

```
https://us-federal-holidays-business-days-mcp.lipmichal.workers.dev/mcp
```

### Claude Code

```
claude mcp add --transport http us-federal-holidays https://us-federal-holidays-business-days-mcp.lipmichal.workers.dev/mcp
```

Or run it locally over stdio:

```
claude mcp add us-federal-holidays -- npx -y us-federal-holidays-business-days-mcp
```

### Claude Desktop

Add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "us-federal-holidays": {
      "command": "npx",
      "args": ["-y", "us-federal-holidays-business-days-mcp"]
    }
  }
}
```

### Cursor

Add this to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "us-federal-holidays": {
      "url": "https://us-federal-holidays-business-days-mcp.lipmichal.workers.dev/mcp"
    }
  }
}
```

### VS Code

Add this to `.vscode/mcp.json`:

```json
{
  "servers": {
    "us-federal-holidays": {
      "type": "http",
      "url": "https://us-federal-holidays-business-days-mcp.lipmichal.workers.dev/mcp"
    }
  }
}
```

## Example prompts

- "Which federal holidays in 2027 are observed on a different day than the legal date?"
- "Is July 3, 2026 a banking day? Is it a federal holiday?"
- "What date is 10 business days after December 20, 2027 for a federal agency?"
- "How many business days are there in November 2026?"
- "An invoice was issued on June 3, 2026 on Net 30. When is it due if we roll weekends and bank holidays forward?"

## Try it with curl

```
curl -s https://us-federal-holidays-business-days-mcp.lipmichal.workers.dev/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"is_business_day","arguments":{"date":"2026-07-03","calendar":"fed_banking"}}}'
```

## Data sources

All fetched on 2026-10-30. Details are in [DATA_SOURCES.md](DATA_SOURCES.md).

- OPM Federal Holidays. https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/
- Federal Reserve K.8 Holidays Observed. https://www.federalreserve.gov/aboutthefed/k8.htm
- 5 U.S.C. 6103 and amendment notes. https://www.law.cornell.edu/uscode/text/5/6103

## Limitations

- One-off closures by executive order are not built in. Examples are Christmas Eve closures and national days of mourning such as 2025-01-09. Pass them in `extra_closed_dates`.
- The `federal` calendar is for employees with a Monday to Friday workweek. Other schedules have different in-lieu-of days.
- The `fed_banking` calendar applies the K.8 rule to every year. The Fed publishes tables only for recent years. Before 2022 the Juneteenth rule never changed a banking day, because June 19, 2021 was a Saturday.
- State holidays, stock market holidays and other countries are not covered.
- Dates are plain calendar days. There are no time zones or cut-off times.

## Zovo MCP back-office bundle

Due dates feed the invoice and dunning servers in the paid Zovo MCP back-office bundle. Those servers handle invoices, payment terms and reminders: https://mcp.zovo.one/?utm_source=github&utm_medium=us-federal-holidays-business-days-mcp

Part of the Zovo MCP collection: https://mcp.zovo.one

## Development

```
npm install
npm run build
npm test
npx wrangler deploy
```

`src/core.ts` holds the pure calendar logic. `src/stdio.ts` is the local entry and `src/worker.ts` is the Cloudflare Worker entry. Both use the same tool registry in `src/tools.ts`.

## License

MIT

<!-- data-servers:start -->
## More data servers from the same author

Each one is free, needs no API key and has a hosted URL you can paste into Claude or ChatGPT.

| server | tools | hosted URL |
|---|---|---|
| [cups-to-grams-mcp](https://github.com/theluckystrike/cups-to-grams-mcp) | convert_ingredient, search_ingredients, scale_recipe, convert_oven_temperature | `https://cups-to-grams-mcp.lipmichal.workers.dev/mcp` |
| [dscr-loan-calculator-mcp](https://github.com/theluckystrike/dscr-loan-calculator-mcp) | calculate_dscr, max_loan_for_target_dscr, rent_needed_for_target_dscr, compare_scenarios, amortization_summary | `https://dscr-loan-calculator-mcp.lipmichal.workers.dev/mcp` |
| [gold-price-per-gram-mcp](https://github.com/theluckystrike/gold-price-per-gram-mcp) | get_gold_price_per_gram, get_metal_prices, calculate_jewelry_value, convert_gold_units | `https://gold-price-per-gram-mcp.lipmichal.workers.dev/mcp` |
| [lake-level-mcp](https://github.com/theluckystrike/lake-level-mcp) | search_lakes, get_lake_level, get_lake_history, compare_lakes | `https://lake-level-mcp.lipmichal.workers.dev/mcp` |
| [minimum-wage-mcp](https://github.com/theluckystrike/minimum-wage-mcp) | get_minimum_wage, list_upcoming_increases, compare_states, annual_income_at_minimum_wage | `https://minimum-wage-mcp.lipmichal.workers.dev/mcp` |
| [no-tax-on-overtime-mcp](https://github.com/theluckystrike/no-tax-on-overtime-mcp) | calculate_overtime_deduction, calculate_tips_deduction, calculate_senior_deduction, estimate_tax_savings, explain_eligibility | `https://no-tax-on-overtime-mcp.lipmichal.workers.dev/mcp` |
| [paycheck-calculator-mcp](https://github.com/theluckystrike/paycheck-calculator-mcp) | calculate_take_home_pay, compare_states_take_home, salary_to_hourly, hourly_to_salary, get_federal_tax_brackets | `https://paycheck-calculator-mcp.lipmichal.workers.dev/mcp` |
| [uk-income-tax-salary-mcp](https://github.com/theluckystrike/uk-income-tax-salary-mcp) | calculate_uk_take_home, get_uk_tax_bands, compare_salaries, marginal_rate_at_income | `https://uk-income-tax-salary-mcp.lipmichal.workers.dev/mcp` |

The paid back-office collection (invoices, VAT, PDFs, spreadsheets) is at https://mcp.zovo.one
<!-- data-servers:end -->
