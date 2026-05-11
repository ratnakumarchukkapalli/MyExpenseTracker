# Phase 0 — Setup & Data Stack

> Before we touch any algorithm, we need our tools. This phase has zero ML.
> But by the end, you'll have done something most ML tutorials never do:
> **looked at your own real data.**

---

## What We Build

```
ml-service/
├── main.py          ← FastAPI app (port 8001)
├── db.py            ← connects to Supabase, returns pandas DataFrame
├── requirements.txt
└── notebooks/
    └── explore.ipynb  ← YOUR expenses plotted live
```

---

## Math Concepts in This Phase

### What is a Vector?

A vector is just a list of numbers with a direction.

Your single expense row:
```
[2026-05-01, "Swiggy", 450.0, "Personal"]
```
When we convert it to numbers:
```
[20260501, 450.0, 0]   ← this IS a vector
```

Your entire expenses table = a **matrix** (rows × columns).
Every ML algorithm is just math on this matrix.

### Why numpy beats Python loops

```python
# Python loop — slow (one number at a time)
total = 0
for expense in expenses:
    total += expense['amount']

# numpy — fast (operates on the whole array at once)
total = np.sum(expenses['amount'])
```

On 10,000 rows, numpy is ~100× faster. This matters because:
- Training a model = doing this calculation thousands of times
- Backpropagation in neural networks = matrix math on millions of values

### What is a Distribution?

Plot your monthly spending as a histogram. You'll see:
- Most months cluster around a central value (your "normal" spend)
- Some months spike (Diwali, travel)
- Very few months are extremely low

That shape is a **distribution**. Understanding distributions is the foundation of:
- Anomaly detection (Phase 2) — what's outside the normal range?
- Probability (Phase 3) — how likely is this outcome?
- Neural network initialisation — weights must start from the right distribution

---

## Setup Commands

```bash
# Inside MyExpenseTracker/
mkdir -p ml-service/notebooks
cd ml-service

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn supabase pandas numpy scikit-learn matplotlib seaborn jupyter python-dotenv

# Run the service
uvicorn main:app --reload --port 8001
```

---

## Code: db.py (Supabase → pandas)

```python
import os
import pandas as pd
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"]   # service role — bypasses RLS
)

def load_expenses(user_id: str) -> pd.DataFrame:
    """Load all expenses for a user into a pandas DataFrame."""
    response = supabase.table("expenses") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("date") \
        .execute()

    df = pd.DataFrame(response.data)
    df["date"] = pd.to_datetime(df["date"])
    df["amount"] = df["amount"].astype(float)
    df["month"] = df["date"].dt.to_period("M")
    return df

def load_monthly_summary(user_id: str) -> pd.DataFrame:
    """Load monthly_summary table into a pandas DataFrame."""
    response = supabase.table("monthly_summary") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("year,month") \
        .execute()

    df = pd.DataFrame(response.data)
    return df
```

---

## Code: main.py (FastAPI skeleton)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MET ML Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "service": "MET ML"}

# Phase 1 endpoints will be added here:
# @app.post("/trend")
# @app.post("/anomaly")
# @app.post("/health-score")
```

---

## Jupyter Exploration (explore.ipynb)

```python
# Cell 1 — Load data
import sys
sys.path.append('..')
from db import load_expenses, load_monthly_summary
import matplotlib.pyplot as plt
import pandas as pd

USER_ID = "your-user-id-here"
df = load_expenses(USER_ID)
print(f"Loaded {len(df)} expenses")
print(df.head())

# Cell 2 — Monthly totals
monthly = df.groupby("month")["amount"].sum()
print(monthly)

# Cell 3 — Plot monthly spending
plt.figure(figsize=(12, 5))
monthly.plot(kind="bar", color="steelblue")
plt.title("Your Monthly Spending")
plt.xlabel("Month")
plt.ylabel("Amount (₹)")
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()

# Cell 4 — Spending by category
by_category = df.groupby("category")["amount"].sum().sort_values(ascending=False)
by_category.plot(kind="pie", autopct="%1.1f%%", figsize=(8, 8))
plt.title("Spending by Category")
plt.show()

# Cell 5 — Distribution of individual expense amounts
df["amount"].hist(bins=50, figsize=(10, 4))
plt.title("Distribution of Expense Amounts")
plt.xlabel("Amount (₹)")
plt.ylabel("Frequency")
plt.show()
# Look at this histogram. This is YOUR spending distribution.
# Most expenses cluster in the centre — that's the normal range.
# The rare high-value ones on the right are future anomaly candidates.
```

---

## Done When

- [ ] `uvicorn main:app --reload --port 8001` runs with no errors
- [ ] `GET http://localhost:8001/health` returns `{"status": "ok"}`
- [ ] Jupyter notebook loads your expenses and plots monthly chart
- [ ] You've looked at your own spending distribution histogram
- [ ] Update PLAN.md: STATUS → DONE, advance to Phase 1
