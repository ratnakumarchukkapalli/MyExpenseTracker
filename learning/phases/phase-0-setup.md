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

## Math Concepts — Complete Reference

---

### Vector

**What it is:** A list of numbers that represents one thing.

**Analogy:** Your Swiggy order receipt — one transaction described by multiple values:
```
[date,       amount,  category,    payment]
[2026-05-01, 450.0,   "Personal",  "UPI"  ]
```
Convert to numbers → `[20260501, 450.0, 0, 1]` — that IS a vector.

**Diagram:**
```
One expense = one vector (a row of numbers with a direction)

  ┌────────────┬────────┬──────────┬─────────┐
  │ 20260501   │ 450.0  │    0     │    1    │
  └────────────┴────────┴──────────┴─────────┘
     date        amount   category   payment
  ◄──────────────── 4 dimensions ────────────►
```

**In your data:** Every single expense row = one vector.

**Formula:** A vector with n values = `[x₁, x₂, x₃, ... xₙ]`

**Real scenario:** When you search Google, your query gets converted to a vector of numbers.
The search engine finds pages whose vectors are closest to yours. Same idea.

**Interview:** "A vector is an ordered list of numbers representing a point in n-dimensional space.
In practice, one row of a dataset is a feature vector."

---

### Matrix

**What it is:** A table of numbers — rows × columns. A collection of vectors stacked together.

**Analogy:** Your entire expenses spreadsheet. Each row is one expense (one vector).
Stack 837 expense vectors on top of each other → you get a matrix.

**Diagram:**
```
Your expenses table = a matrix of shape (837, 3)

         amount  category  payment
       ┌────────┬──────────┬─────────┐
row 0  │  450   │    0     │    1   │  ← vector
row 1  │ 1800   │    1     │    0   │  ← vector
row 2  │  320   │    0     │    1   │  ← vector
  ...  │  ...   │   ...    │   ...  │
row 836│  ...   │   ...    │   ...  │  ← vector
       └────────┴──────────┴─────────┘
         ▲           ▲
      837 rows    3 columns
      (n_samples) (n_features)

df.shape = (837, 3)
```

**Formula:** Matrix shape = (rows, columns). `df.shape` gives you this.

**Real scenario:** A grayscale image is a matrix. A 100×100 pixel image = a (100, 100) matrix
where each number is a pixel brightness. A neural network processes this matrix directly.

**Interview:** "A matrix is a 2D array of numbers with shape (m, n). In ML, the training data
is usually represented as a matrix X of shape (n_samples, n_features)."

---

### Mean

**What it is:** The average. The "centre of gravity" of your data.

**Analogy:** If you and 4 friends pool money equally, mean = what each person gets.

**Formula:**
```
mean = sum of all values / count of values
     = (100 + 200 + 300 + 400 + 500) / 5
     = 1500 / 5
     = 300
```

**Your real data:** Mean expense = ₹3,999 — but this is pulled up by large EMI/CC payments.

**Real scenario:** A/B testing. Did the new UI increase mean session time?
If yes by how much? Mean is the go-to metric for comparing groups.

**Interview:** "Mean is sensitive to outliers. One extreme value pulls it significantly.
Always check mean vs median before reporting averages on skewed data."

---

### Median

**What it is:** The middle value when data is sorted. Half above, half below.

**Analogy:** If 5 people stand in a line sorted by height, the median is the person in the middle.
The tallest person's height doesn't move the median — but it does move the mean.

**Formula:**
```
Sort: [100, 200, 300, 400, 500]
                 ↑
            median = 300   (3rd of 5 values)

For even count: average of the two middle values
[100, 200, 300, 400]  →  (200+300)/2 = 250
```

**Your real data:** Median = ₹619. Half your 840 expenses are below ₹619.
Mean (₹3,999) is much higher because EMIs/CC pull it up. Median ignores them.

**Rule:** Use median when data is skewed. Use mean when data is symmetric.

**Real scenario:** House prices, salaries. A city's median salary (₹8L) tells you more
than mean salary (₹15L, pulled up by a few tech executives).

**Interview:** "Median is robust to outliers. For skewed distributions, median is a better
measure of central tendency than mean. If mean >> median, data is right-skewed."

---

### Variance

**What it is:** How spread out values are from the mean. Measured in squared units.

**Analogy:** Two cricket batsmen both average 50 runs.
- Batsman A: always scores 45–55. Consistent.
- Batsman B: scores 0 or 100 randomly. Unreliable.
Both have the same mean. Variance tells you who is consistent.

**Formula:**
```
Step 1 — find distance of each value from mean:
  100-300=-200,  200-300=-100,  300-300=0,  400-300=100,  500-300=200

Step 2 — square each (removes negatives):
  40000,  10000,  0,  10000,  40000

Step 3 — average the squares:
  variance = (40000+10000+0+10000+40000) / 5 = 20000
```

**Why square?** Negative distances would cancel out positive ones. Squaring makes everything
positive AND penalises large deviations more heavily than small ones.

**Real scenario:** Stock volatility IS variance. A stable bank stock has low variance.
A meme stock has high variance. Same concept.

**Interview:** "Variance measures spread. High variance = data is dispersed. Low variance = data
clusters near the mean. Variance is in squared units which is hard to interpret directly —
that's why we use standard deviation."

---

### Standard Deviation

**What it is:** Square root of variance. Variance back in original units (₹, not ₹²).

**Analogy:** Same cricket example. Variance said 20000 (runs²) — not readable.
Std dev = √20000 ≈ 141 runs. Now you can say "typically within ±141 runs of the average."

**Formula:**
```
std dev = √variance = √20000 ≈ 141
```

**The 68-95-99 rule (important for Phase 2):**
```
68% of data falls within mean ± 1 std dev
95% of data falls within mean ± 2 std dev
99.7% of data falls within mean ± 3 std dev
```

**Your real data:** Mean=₹3,999, Std=₹13,301. So 68% of your expenses fall between:
```
₹3,999 - ₹13,301 = -₹9,302  (can't be negative, so effectively ₹0)
₹3,999 + ₹13,301 = ₹17,300
```
Std dev larger than mean = extreme spread = right-skewed data.

**Real scenario:** In manufacturing, if a bolt should be 10mm and std dev is 0.1mm,
99.7% of bolts are between 9.7mm and 10.3mm. Quality control IS std dev.

**Interview:** "Standard deviation is the square root of variance, expressed in the same
units as the data. It's used in Z-score calculation, confidence intervals, and is the
foundation of anomaly detection."

---

### Distribution

**What it is:** The shape of your data when plotted as a histogram.
Shows where values cluster and how spread out they are.

**Analogy:** Imagine plotting all exam scores in a class. Most students score 60–70.
A few score very high or very low. That shape — tall in the middle, falling off at edges
— is a distribution.

**Types:**
```
Normal (bell curve)     Right-skewed          Left-skewed
       ███                  █                        █
      █████                 ██                      ██
     ███████                ███                    ███
    █████████               █████░░░░         ░░░█████
─────────────           ─────────────         ─────────────
mean≈median             mean >> median        mean << median
```

**Your data:** Right-skewed. Most expenses are small (₹100–₹500).
A few large EMI/CC payments create the long tail on the right.

**Why it matters:**
- Phase 2: Z-score assumes normal distribution. Skewed data needs extra handling.
- Phase 3: Logistic regression uses probability distributions.
- Phase 5: Neural network weights are initialised from a normal distribution.

**Real scenario:** Response times on a web server are right-skewed.
Most requests complete in 50ms, but a few "tail latency" requests take 5000ms.
Your SLA is set based on the 99th percentile — the right tail.

**Interview:** "Always plot your data's distribution before modelling. Skewed distributions
require preprocessing (log transform, robust scaling) before feeding to algorithms that
assume normality."

---

### numpy vs Python Loops

**What it is:** numpy operates on an entire array in one CPU instruction (vectorised).
Python loops process one element at a time.

**Analogy:** Imagine paying 840 people their salaries.
- Python loop: walk to each person's desk one by one. 840 trips.
- numpy: send one bank transfer that splits automatically. 1 operation.

**Your real benchmark:**
```
Python loop: 0.365ms  (840 iterations)
numpy:       0.159ms  (1 operation)
2× faster on 840 rows → ~100× faster on 1,000,000 rows
```

**Why it matters for ML:** Training a neural network = the same matrix operation done
thousands of times on millions of rows. Without numpy (and GPUs), modern ML is impossible.

**Real scenario:** pandas, scikit-learn, TensorFlow, PyTorch — all built on numpy internally.
When you call `model.fit()`, it's running optimised matrix operations, not Python loops.

**Interview:** "Vectorised operations avoid Python's interpreter overhead and use CPU SIMD
instructions. For ML workloads, this is the difference between minutes and hours of training."

---

### Summary Table

### Dot Product

**What it is:** Multiply two vectors element-by-element, then sum everything into one number.

**Formula:**
```
a · b = a[0]×b[0] + a[1]×b[1] + a[2]×b[2] + ...

Example:
a = [1, 2, 3]
b = [4, 5, 6]

a · b = (1×4) + (2×5) + (3×6)
      =   4   +   10  +   18
      = 32
```

**Diagram:**
```
Step 1 — multiply element-by-element:

  a = [ 1,    2,    3  ]
       ×     ×     ×
  b = [ 4,    5,    6  ]
       =     =     =
      [ 4,   10,   18  ]

Step 2 — sum them all:

  4 + 10 + 18 = 32  ← dot product (one number)
```

**Why it matters:** Linear regression prediction IS a dot product:
```
features = [month,  prev_spend,  season ]
weights  = [ w1,       w2,         w3  ]

prediction = features · weights
           = (month × w1) + (prev_spend × w2) + (season × w3)
```
The algorithm finds the best `weights` vector. That's the whole job.

**Large vs small dot product:**
```
a = [10, 10],  b = [10, 10]  →  a·b = 200   (same direction = very similar)
a = [10,  0],  b = [ 0, 10]  →  a·b = 0     (perpendicular = nothing in common)
```
Large dot product = vectors are similar. Zero = nothing in common.

**Real scenario:** Netflix recommendation:
```
your_taste    = [0.9, 0.1, 0.7]   ← action, romance, thriller preference
movie_profile = [0.8, 0.2, 0.6]

match_score = 0.72 + 0.02 + 0.42 = 1.16
```
Higher dot product = better match. Every recommendation engine works this way.

**Interview:** "Dot product is the fundamental operation in ML. Linear regression, neural
network layers, attention in transformers — all are dot products. It measures alignment
(similarity) between two vectors. A dot product of zero means the vectors are orthogonal
(completely unrelated)."

---

### Summary Table

| Concept | One line | Used in phase |
|---------|----------|---------------|
| Vector | One row of data as a list of numbers | All phases |
| Matrix | The full dataset (rows × columns) | All phases |
| Dot Product | Multiply element-wise then sum — measures similarity | Phase 1, 5, 6 |
| Mean | Sum / count — the centre | Phase 1, 2, 3 |
| Median | Middle value — robust to outliers | Phase 0, 2 |
| Variance | Average squared distance from mean | Phase 2, 5 |
| Std Dev | √Variance — spread in original units | Phase 2, 3, 5 |
| Distribution | Shape of data when plotted | Phase 2, 3 |
| numpy | Whole-array operations — 100× faster | All phases |

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
