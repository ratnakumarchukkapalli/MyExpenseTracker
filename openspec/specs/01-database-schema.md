# Database Schema — Supabase Tables

All tables have `user_id UUID` (FK to `auth.users`) for row-level security.

## Core Tables

### expenses
Primary transaction log. Every rupee spent is a row.

```sql
id           BIGINT PRIMARY KEY
user_id      UUID NOT NULL
date         TEXT NOT NULL        -- 'YYYY-MM-DD'
description  TEXT
amount       REAL NOT NULL        -- full rupees, never lakhs
category     TEXT                 -- see valid categories
note         TEXT
created_at   TIMESTAMPTZ
```

Valid categories: `Personal` | `HOME Purpose` | `LOANS/CC` | `Savings` | `MonthlyBills`

### monthly_summary
One row per month per user. Source of truth for net worth.

```sql
id                      BIGINT PRIMARY KEY
user_id                 UUID NOT NULL
month                   INTEGER NOT NULL    -- 1-12
year                    INTEGER NOT NULL
salary                  REAL DEFAULT 0
total_expenses          REAL DEFAULT 0
remaining_amount        REAL DEFAULT 0      -- computed: see business rules
previous_month_remaining REAL DEFAULT 0     -- "Carryover" / opening cash
interest_income         REAL DEFAULT 0
savings_fd              REAL DEFAULT 0
savings_sip             REAL DEFAULT 0      -- SIP snapshot (NOT live NAV × units)
savings_shares          REAL DEFAULT 0      -- Stock snapshot (NOT live price × shares)
savings_nps             REAL DEFAULT 0
savings_pf              REAL DEFAULT 0
cash_equivalents        REAL DEFAULT 0      -- remaining + fd + sip + shares
updated_at              TIMESTAMPTZ
UNIQUE(user_id, month, year)
```

**IMPORTANT**: `savings_sip` and `savings_shares` store the portfolio snapshot value at the time that month was current. For past months, use these stored values — NOT live `current_nav × units`. See business rules.

### loans
```sql
id           BIGINT PRIMARY KEY
user_id      UUID NOT NULL
name         TEXT NOT NULL
amount       REAL NOT NULL       -- monthly EMI
due_day      INTEGER
start_date   TEXT
end_date     TEXT
category     TEXT DEFAULT 'LOANS/CC'
status       TEXT DEFAULT 'active'
comments     TEXT
```

### subscriptions
```sql
id            BIGINT PRIMARY KEY
user_id       UUID NOT NULL
name          TEXT NOT NULL
amount        REAL NOT NULL
renewal_date  TEXT               -- 'YYYY-MM-DD'
billing_type  TEXT               -- 'yearly' | 'monthly'
status        TEXT DEFAULT 'active'
category      TEXT DEFAULT 'MonthlyBills'
```

### insurance_policies
```sql
id             BIGINT PRIMARY KEY
user_id        UUID NOT NULL
name           TEXT NOT NULL
type           TEXT               -- 'life' | 'health' | 'vehicle' | 'term'
insurer        TEXT
sum_insured    REAL
premium_amount REAL
premium_mode   TEXT               -- 'yearly' | 'quarterly' | 'monthly'
next_due_date  TEXT
status         TEXT DEFAULT 'active'
```

### category_budgets
```sql
user_id       UUID NOT NULL
category      TEXT NOT NULL
budget_type   TEXT DEFAULT 'percent'
budget_value  REAL
UNIQUE(user_id, category)
```

## Portfolio Tables

### sip_funds
```sql
id               BIGINT PRIMARY KEY
user_id          UUID NOT NULL
fund_name        TEXT NOT NULL
scheme_code      TEXT             -- AMFI scheme code (numeric, e.g. '120503')
fund_type        TEXT             -- 'active' | 'redeemed'
sip_amount       REAL
units            REAL DEFAULT 0
invested_value   REAL DEFAULT 0
current_nav      REAL             -- latest NAV (updated by sync)
last_nav_update  TEXT             -- 'YYYY-MM-DD'
```

### sip_transactions
```sql
id                BIGINT PRIMARY KEY
user_id           UUID NOT NULL
fund_id           BIGINT REFERENCES sip_funds(id)
transaction_date  TEXT
units             REAL
purchase_nav      REAL
amount            REAL
transaction_type  TEXT             -- 'SIP' | 'LUMPSUM' | 'REDEEM'
```

### nav_history
```sql
id           BIGINT PRIMARY KEY
user_id      UUID NOT NULL
scheme_code  TEXT
nav_date     TEXT
nav_value    REAL
UNIQUE(user_id, scheme_code, nav_date)
```

### stock_holdings
```sql
id             BIGINT PRIMARY KEY
user_id        UUID NOT NULL
ticker         TEXT NOT NULL      -- NSE symbol e.g. 'RELIANCE'
company_name   TEXT
shares         REAL
buy_price      REAL
current_price  REAL               -- latest price (updated by sync)
last_updated   TEXT               -- 'YYYY-MM-DD'
notes          TEXT               -- broker name
```

## Key Business Rules
1. Never delete from `monthly_summary` — update in place
2. `cash_equivalents` must be recalculated whenever savings values change
3. Amounts in full rupees (not lakhs, not paise)
4. `UNIQUE(user_id, month, year)` on monthly_summary — upsert with `onConflict: "user_id,month,year"`
