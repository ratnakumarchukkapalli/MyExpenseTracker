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

### stock_sales
Sale history for realized-P&L reporting and tax. Money columns are NUMERIC, not REAL —
float4 rounds anything past ~7 significant digits, and real sale credits (₹1,75,480.49)
live above that threshold.
```sql
id             BIGINT PRIMARY KEY
user_id        UUID NOT NULL
holding_id     BIGINT             -- FK stock_holdings, ON DELETE SET NULL
ticker         TEXT NOT NULL      -- denormalized: history survives holding deletion
company_name   TEXT
shares_sold    REAL NOT NULL
sell_price     NUMERIC(15,4) NOT NULL
sell_date      TEXT NOT NULL      -- 'YYYY-MM-DD'
avg_buy_price  NUMERIC(15,4) NOT NULL  -- holding.buy_price at sale time
last_price     NUMERIC(15,4)      -- holding.current_price at sale time (undo + delta audit)
gross_proceeds NUMERIC(15,2) NOT NULL  -- shares_sold * sell_price
charges        NUMERIC(15,2) NOT NULL DEFAULT 0
net_proceeds   NUMERIC(15,2) NOT NULL  -- gross_proceeds - charges
realized_pnl   NUMERIC(15,2) NOT NULL  -- (sell_price - avg_buy_price) * shares_sold - charges
broker         TEXT
notes          TEXT
reverted_at    TIMESTAMPTZ        -- set by undo; history rows are never deleted
created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### stock_sale_allocations
Where each rupee of a sale's net proceeds went. Exactly one target FK is populated,
enforced by the `alloc_target_matches_destination` CHECK.
```sql
id                 BIGINT PRIMARY KEY
user_id            UUID NOT NULL
sale_id            BIGINT NOT NULL    -- FK stock_sales, ON DELETE CASCADE
destination        TEXT NOT NULL      -- 'bank' | 'sip'
bank_account_id    BIGINT             -- set iff destination = 'bank'
sip_fund_id        BIGINT             -- set iff destination = 'sip'
sip_transaction_id BIGINT             -- the LUMPSUM row created for a SIP leg, for undo
amount             NUMERIC(15,2) NOT NULL CHECK (amount > 0)
created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
```
Both tables have RLS enabled **with** a `FOR ALL USING (auth.uid() = user_id)` policy.
RLS on without a policy is deny-all — that is what broke `insurance_policies`.

Migration: `scripts/021_stock_sales.sql`

## Key Business Rules
1. Never delete from `monthly_summary` — update in place
2. `cash_equivalents` must be recalculated whenever savings values change
3. Amounts in full rupees (not lakhs, not paise)
4. `UNIQUE(user_id, month, year)` on monthly_summary — upsert with `onConflict: "user_id,month,year"`
