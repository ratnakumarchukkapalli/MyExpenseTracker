# Phase 1 — Linear Regression

> The most important algorithm in ML. Everything else builds on this.
> Linear regression IS gradient descent. Gradient descent IS how neural networks learn.
> Understand this deeply and Phase 5 (neural nets) becomes obvious.

---

## The Big Idea

You have monthly expense totals for 12+ months. Can you draw the single best line through them?

```
₹ Amount
│                              ● ← actual month
│           ●               /
│       ●         →  best line /
│   ●         /
│       /  ●
└─────────────────────────── time
```

That line is Linear Regression. Once you have it, you can extend it forward → that's forecasting.

---

## Math — Step by Step

### 1. Vectors and Dot Product

Your monthly data as two vectors:
```
x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]   ← month number
y = [45000, 42000, 51000, 48000, ...]            ← total expense that month
```

A **dot product** is: multiply element-by-element, then sum.
```
x · y = x[0]*y[0] + x[1]*y[1] + ... 
```
This is the most fundamental operation in ALL of ML.
Every layer in a neural network is a dot product + activation function. Nothing more.

### 2. The Line Formula

```
ŷ = mx + b

m = slope     (how much expense changes per month)
b = intercept (baseline expense at month 0)
```

### 3. Least Squares — Finding the Best Line

The "best" line minimises the sum of squared errors:

```
Error for one point = (actual - predicted)²  = (y - ŷ)²

Total error = Σ (y - ŷ)²   ← we want this as small as possible
```

**Why squared?** Two reasons:
1. Negative and positive errors cancel out if you just sum them. Squaring makes all errors positive.
2. Squaring punishes large errors more than small ones. A ₹10,000 error is 100× worse than a ₹1,000 error, not 10× worse.

**The formula** (derived from calculus — setting derivative to 0):
```python
slope     = np.cov(x, y)[0,1] / np.var(x)
intercept = np.mean(y) - slope * np.mean(x)
```

### 4. R² — Is the Model Actually Good?

```
R² = 1 - (sum of squared errors) / (total variance in y)

R² = 1.0  → perfect prediction
R² = 0.0  → model is no better than predicting the mean every time
R² < 0    → model is WORSE than just predicting the mean (your model is broken)
```

For expenses, R² of 0.7+ is good. If it's 0.3, the trend is weak.

### 5. Gradient Descent Intuition

Instead of the closed-form formula above, neural networks FIND the slope by iterating:

```
start with random slope and intercept
loop:
    calculate error
    nudge slope in the direction that reduces error
    nudge intercept in the direction that reduces error
    repeat until error stops improving
```

That "nudge" is the **gradient** (derivative of the error with respect to the weight).
"Descending the gradient" = walking downhill on the error surface.

This IS backpropagation. Same math. Just applied to millions of weights instead of two.

---

## Implementing It

### Step 1: Write It in Numpy First

```python
import numpy as np

def linear_regression_numpy(x, y):
    """Fit a line y = mx + b using least squares."""
    x = np.array(x, dtype=float)
    y = np.array(y, dtype=float)

    slope = np.cov(x, y)[0, 1] / np.var(x)
    intercept = np.mean(y) - slope * np.mean(x)

    # R² score
    y_pred = slope * x + intercept
    ss_res = np.sum((y - y_pred) ** 2)      # sum of squared residuals
    ss_tot = np.sum((y - np.mean(y)) ** 2)  # total variance
    r2 = 1 - ss_res / ss_tot

    return slope, intercept, r2

# Test with your monthly data
months = list(range(1, 13))
expenses = [45000, 42000, 51000, 48000, 55000, 52000, 49000, 58000, 54000, 61000, 57000, 63000]

slope, intercept, r2 = linear_regression_numpy(months, expenses)
print(f"Slope: ₹{slope:.0f}/month (spending grows by this much each month)")
print(f"Intercept: ₹{intercept:.0f}")
print(f"R²: {r2:.3f}")

# Forecast next 3 months
for m in [13, 14, 15]:
    forecast = slope * m + intercept
    print(f"Month {m} forecast: ₹{forecast:.0f}")
```

### Step 2: Verify with scikit-learn

```python
from sklearn.linear_model import LinearRegression

X = np.array(months).reshape(-1, 1)  # sklearn needs 2D input
y = np.array(expenses)

model = LinearRegression()
model.fit(X, y)

print(f"sklearn slope: {model.coef_[0]:.0f}")       # should match your numpy
print(f"sklearn intercept: {model.intercept_:.0f}")  # should match your numpy
print(f"sklearn R²: {model.score(X, y):.3f}")        # should match your numpy

# Now you know: sklearn is just doing the same math you just wrote
```

---

## FastAPI Endpoint

```python
# In ml-service/main.py
from pydantic import BaseModel
from typing import List
import numpy as np

class TrendRequest(BaseModel):
    user_id: str
    months_ahead: int = 3

class TrendResponse(BaseModel):
    slope: float           # ₹ change per month
    intercept: float
    r2: float              # model quality (0-1)
    forecast: List[float]  # next N months predicted
    trend_direction: str   # "increasing" | "decreasing" | "stable"

@app.post("/trend", response_model=TrendResponse)
def expense_trend(req: TrendRequest):
    df = load_monthly_summary(req.user_id)

    # Month index (1, 2, 3, ...)
    x = np.arange(1, len(df) + 1, dtype=float)
    y = df["total_expenses"].values.astype(float)

    slope = np.cov(x, y)[0, 1] / np.var(x)
    intercept = np.mean(y) - slope * np.mean(x)

    y_pred = slope * x + intercept
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r2 = float(1 - ss_res / ss_tot)

    # Forecast
    n = len(x)
    forecast = [float(slope * (n + i) + intercept) for i in range(1, req.months_ahead + 1)]

    direction = "stable"
    if slope > 500:
        direction = "increasing"
    elif slope < -500:
        direction = "decreasing"

    return TrendResponse(slope=slope, intercept=intercept, r2=r2,
                         forecast=forecast, trend_direction=direction)
```

---

## Next.js Proxy Route

```typescript
// app/api/ml/trend/route.ts
import { NextRequest, NextResponse } from "next/server"
import { requireAuthFast } from "@/lib/auth"

const ML_SERVICE = process.env.ML_SERVICE_URL || "http://localhost:8001"

export async function POST(req: NextRequest) {
  const { user } = await requireAuthFast()
  const body = await req.json()

  const response = await fetch(`${ML_SERVICE}/trend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: user.id, ...body }),
  })

  const data = await response.json()
  return NextResponse.json(data)
}
```

---

## Key Insights (read before moving on)

1. **Linear regression is not just a line** — it's the simplest form of gradient descent, which is the learning algorithm behind every neural network ever built.

2. **R² tells you if the model is even worth using** — always check it. An R² of 0.2 means 80% of the variance is unexplained. Don't trust forecasts from a bad model.

3. **Extrapolation is dangerous** — the further ahead you forecast, the wider the uncertainty. Never present a single number as "the forecast" — always show a range.

4. **Your data is small** — 12-24 months of data is actually too small for most ML models. Linear regression handles small datasets better than neural networks. This is why we start here.

---

## Done When

- [ ] Numpy implementation works and matches sklearn output
- [ ] `/trend` endpoint runs and returns slope, R², forecast
- [ ] Dashboard shows trend line on expense chart
- [ ] You can explain: what R² means, why we square errors, what gradient descent does
- [ ] Update PLAN.md: STATUS → DONE, advance to Phase 2
