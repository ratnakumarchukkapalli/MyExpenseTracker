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

## Conceptual Foundations (Session Notes)

> Captured during teaching — the intuitions you keep tripping over until they click.

### Scalar vs Vector — what counts as a vector

A single number is a **scalar**, not a vector.
```
3262          ← scalar (one number, e.g. an expense id)
[3262, 1250, 20260315, 4]   ← vector (ordered list — the full row)
```
For Phase 1, the most useful vector is an entire **column** across many rows:
```
amounts = [1250, 480, 3200, 750, 950, ...]   ← N-element vector
```
**Key property:** order matters, length is fixed. You can do element-wise math on two vectors of the same length.

### Dot Product — the universal "weighted combine"

Multiply element-by-element, then sum.

```
months   = [1,  2,  3]
expenses = [40, 50, 60]

months · expenses = 1×40 + 2×50 + 3×60 = 320
```

The result is a single number. But **the weights you choose change what that number means:**

| Weight vector | Result | Name |
|---|---|---|
| `[1, 1, 1]` | `40 + 50 + 60 = 150` | Sum |
| `[1/3, 1/3, 1/3]` | `150 / 3 = 50` | Mean |
| `[w₁, w₂, w₃]` | weighted combination | Weighted average / **prediction** |

> **Big idea:** sum, mean, weighted average, and a regression prediction are all the *same* operation — a dot product. The weight vector is what changes.

### Features vs Weights — who picks what

| | What | Who decides |
|---|---|---|
| **Features** | The inputs you give the model — e.g. `[month_number, 1]` | **You** — by deciding what to measure |
| **Weights** | The numbers the model multiplies features by — e.g. `[slope, intercept]` | **The algorithm**, by minimising loss on your data |

> This is the leap from regular programming to ML. In regular code, **you write the rule**. In ML, **you give examples and the algorithm finds the rule** (the weights). For Phase 1, "finding the rule" = finding the values of `slope` and `intercept` that minimise SSE.

### The Bias Trick — why a constant "1" appears in the feature vector

You'll often see predictions written as a clean dot product:
```
prediction = [slope, intercept] · [month, 1]
              └── weights ───┘    └ features ┘
```
The `1` at the end is a fake feature whose value is always 1. It exists so the **intercept** survives the dot product (otherwise at `month = 0` the prediction would be 0 — you'd have no baseline). With the bias trick, every ML prediction in the universe has the same shape: `weights · features`.

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

#### 2a. Where does `y = mx + b` even come from?

A **line** is, by definition, the unique curve whose slope is the same everywhere. If the slope changed as you moved along it, the curve would bend — it wouldn't be straight anymore.

```
y
│         (x₂, y₂)
│           ●
│         ╱│
│        ╱ │ rise = y₂ − y₁
│       ╱  │
│  (x₁,y₁) │
│    ●─────┘
│    ╲ run = x₂ − x₁
└──────────────────── x

For ANY two points on the same line:
   slope = (y₂ − y₁) / (x₂ − x₁) = constant = m
```

Now pick the reference point to be where the line crosses the y-axis: `(0, b)`. This `b` is the **y-intercept** — the value of `y` when `x = 0`. Pick the general point `(x, y)`. The constant-slope property says:
```
  (y − b) / (x − 0)  =  m
       y − b          =  m · x
       y              =  m · x + b      ✓
```

In plain English: **"start at height `b` on the y-axis. Move `x` units right. The line went up by `m · x`. So you're now at height `m · x + b`."**

| Symbol | Meaning |
|---|---|
| `m` (slope) | How fast y changes per unit of x |
| `b` (intercept) | Where the line is when x = 0 |
| `x` | Your input (e.g. month index) |
| `y` | What the line predicts |

#### 2b. Why a line is the right starting model for Phase 1

```
Simplest possible:     y = constant         (no relationship at all)
Next simplest:         y = mx + b            ← Phase 1
More flexible:         y = ax² + bx + c       (polynomial regression)
Way more flexible:     neural network          (Phase 5)
```

Real-world processes are rarely exactly linear, but over short windows (12-24 months) they're often *approximately* linear. Rule #1 of ML: start with the simplest model that could work. Anything fancier only earns its keep if it beats the line.

#### 2c. Prediction vs actual

```
ŷ = m · x + b      ← "y-hat" — what the MODEL predicts
y  = actual observed value (from Supabase)
```

The hat is convention. Bare `y` means truth; `ŷ` means our guess. They're two different numbers, and the gap between them is what we're trying to minimise.

### 2.5 How does `SSE = Σ (y − m·x − b)²` follow from this?

A chain of three substitutions — each link is one step.

**Link 1 — Apply the line to each data point.** Given any `x_i`, the model predicts:
```
ŷ_i = m · x_i + b
```

**Link 2 — Error per point = actual minus predicted.** Substitute `ŷ_i`:
```
error_i  =  y_i  −  ŷ_i
         =  y_i  −  (m · x_i + b)
         =  y_i  −  m · x_i  −  b          ← just expanded the parentheses
```

**Link 3 — Square and sum across all N points.** Square so signs don't cancel + smooth math. Sum to get one score:
```
SSE  =  Σ (y_i − m · x_i − b)²
        ↑
        "for every point in the dataset, compute (actual − predicted)², then add"
```

The whole expression came directly from the line equation. Every symbol inside the parentheses has a name:

```
SSE  =  Σ (  y_i   −   m·x_i + b   )²
            ↑          ↑
            actual     predicted by the line
```

### 3. Least Squares — Finding the Best Line

#### 3a. What is SSE? — a score for "how bad is this line?"

**SSE = Sum of Squared Errors.** One number that measures how wrong a candidate line is on your data.

For each of your N data points:
1. **Predict** with the candidate line: `ŷ_i = m·x_i + b`
2. **Error** = actual minus predicted: `e_i = y_i - ŷ_i`
3. **Square** the error: `e_i²`

Then sum across all N points:
```
SSE = Σ (y_i - ŷ_i)²
```

**Worked example** — try `m=2000, b=40000` on 3 months:
```
Data point        Prediction        Error    Squared
(1, ₹45k)    →    2000×1+40000=42k    +3      9
(2, ₹50k)    →    2000×2+40000=44k    +6     36
(3, ₹48k)    →    2000×3+40000=46k    +2      4
                                            ─────
                                       SSE =  49
```
A different line gives a different SSE. **The line with the smallest SSE wins** — we call it "the best line".

> *Is `SSE = 49` good or bad?* On its own — meaningless. SSE depends on the scale of `y` and the number of points. That's why we also compute **R²** (a normalised score from 0 to 1) — see step 4.

#### 3b. Why squared errors?

A loss function needs three properties:

| Property | Why | How squaring delivers it |
|---|---|---|
| Penalises wrong predictions | Bigger miss = bigger score | `e²` grows with `|e|` |
| Treats over- and under-predicting equally | +500 isn't better than −500 | Squaring kills the sign |
| Smooth (no kinks) | So calculus can find the minimum | `x²` is smooth everywhere; `|x|` has a kink at 0 |

Alternative: **MAE (Mean Absolute Error) = Σ |y − ŷ|** is also valid and is robust to outliers — but it has no clean closed-form solution because of the kink. Phase 1 uses SSE; you'll meet other losses in later phases.

#### 3c. Why we take derivatives — the universal ML recipe

You now have a single-number score (SSE) that depends on two unknowns (`m`, `b`). Picture it as a 3D bowl:
```
        SSE
         │      ╱╲
         │     ╱  ╲          ← high SSE = bad line
         │    ╱    ╲
         │   ╱  ●   ╲        ← bottom of bowl = best (m*, b*)
         │  ╱        ╲
         └──────────────  (m, b) plane
```

**Finding the best line = finding the bottom of this bowl.** At the bottom, the surface is flat in every direction — the **derivative is zero in every direction**.

```
 f(x)
   │   ╲                ╱
   │    ╲      ●       ╱       ● = minimum (slope = 0)
   │     ╲    ╱ ╲     ╱
   │      ╲  ╱   ╲   ╱
   │       ╲╱     ╲ ╱
   └────────────────────  x
       slope < 0   slope = 0   slope > 0
       (downhill)  (bottom)    (uphill)
```

So the recipe is: **take ∂SSE/∂m and ∂SSE/∂b, set both to zero, solve the two equations.** Two equations, two unknowns — clean algebra. What pops out:

```
m = cov(x, y) / var(x)
b = ȳ − m · x̄
```

These formulas are not magic — they are **forced** by the requirement "minimise SSE". Anyone with calculus would derive the same thing. That's why the same two-liner works on every dataset.

> #### The Universal ML Recipe (memorise this)
> ```
> 1. Pick a model      → here: ŷ = mx + b
> 2. Pick a loss       → here: SSE
> 3. Minimise the loss
>    ├── Closed-form   → calculus → exact formulas    (linear regression)
>    └── Iterative     → gradient descent             (neural nets, every other model)
> ```
> Linear regression is the **only** model in this learning plan with a closed-form answer. Everything else uses gradient descent because the math gets too gnarly. The recipe is identical though — model + loss + minimise.

#### 3d. The Full Derivation — where the formulas come from

> This is the part textbooks skip. Read it once carefully — afterwards you'll never wonder why slope = cov/var ever again.

**Starting point.** SSE as a function of `m` and `b`:
```
SSE(m, b) = Σ (y_i − m·x_i − b)²
```

##### Step 1 — Take ∂SSE/∂b (derivative w.r.t. intercept)

Treat `m` as a constant. Apply the chain rule to each term `(y_i − m·x_i − b)²`:
```
∂SSE/∂b  =  Σ 2·(y_i − m·x_i − b) · (−1)
         =  −2 · Σ (y_i − m·x_i − b)
```
Set it to zero (we're at the bottom of the bowl):
```
Σ (y_i − m·x_i − b) = 0
Σ y_i − m·Σ x_i − N·b = 0          ← N copies of b, one per point
```
Divide everything by N (i.e. take means):
```
ȳ − m·x̄ − b = 0
```
Solve for b:
```
┌──────────────────────────┐
│   b  =  ȳ  −  m · x̄    │   ← INTERCEPT FORMULA ✓
└──────────────────────────┘
```
**Meaning:** the best line is forced to pass through the centre of mass `(x̄, ȳ)`. Once you know `m`, the intercept is determined — there's no second choice.

##### Step 2 — Take ∂SSE/∂m (derivative w.r.t. slope)

Treat `b` as a constant. Chain rule again, but this time the inner derivative is `−x_i` (because the slope multiplies `x_i`):
```
∂SSE/∂m  =  Σ 2·(y_i − m·x_i − b) · (−x_i)
         =  −2 · Σ x_i · (y_i − m·x_i − b)
```
Set it to zero:
```
Σ x_i · (y_i − m·x_i − b) = 0
Σ x_i·y_i  −  m·Σ x_i²  −  b·Σ x_i  =  0          ... (★)
```

##### Step 3 — Substitute b and simplify to get m

We already know `b = ȳ − m·x̄` from Step 1. Plug it into (★):
```
Σ x_i·y_i  −  m·Σ x_i²  −  (ȳ − m·x̄)·Σ x_i  =  0
Σ x_i·y_i  −  ȳ·Σ x_i   =   m·Σ x_i²  −  m·x̄·Σ x_i
Σ x_i·(y_i − ȳ)         =   m·Σ x_i·(x_i − x̄)
```
Tiny algebra trick — both sides simplify using `Σ x̄·(y_i − ȳ) = x̄ · 0 = 0` and `Σ x̄·(x_i − x̄) = x̄ · 0 = 0`, so we can swap `x_i` for `(x_i − x̄)` on each side without changing anything:
```
Σ (x_i − x̄)·(y_i − ȳ)   =   m · Σ (x_i − x̄)²
```
Solve for m:
```
       Σ (x_i − x̄)·(y_i − ȳ)        cov(x, y)
m  =  ───────────────────────  =  ───────────
         Σ (x_i − x̄)²                var(x)
```
```
┌─────────────────────────────────┐
│   m  =  cov(x, y) / var(x)     │   ← SLOPE FORMULA ✓
└─────────────────────────────────┘
```

##### Why this matters

- Both formulas fell out of **two simple moves**: take the derivative, set it to zero.
- No iteration. No gradient descent. **Exact answer in closed form.**
- For neural nets, the derivative-set-to-zero equation is too hairy to solve algebraically — that's why we walk downhill iteratively. But the principle (find where the gradient is zero) is identical.

#### 3e. Plain-English meaning of the slope formula

```
       Σ (x_i - x̄)(y_i - ȳ)        cov(x, y)
m  =  ───────────────────────  =  ───────────
         Σ (x_i - x̄)²                var(x)
```

| Quantity | Name | What it measures |
|---|---|---|
| `cov(x, y)` | Covariance | How much x and y move *together* |
| `var(x)` | Variance | How much x *spreads out* on its own |

> **Slope = how much x and y move together, normalised by how much x moves on its own.**

- `cov > 0` → x and y rise together → slope positive
- `cov < 0` → x rises while y falls → slope negative
- `cov ≈ 0` → y ignores x → slope ≈ 0
- `/ var(x)` converts "co-movement" into "₹ change per unit of x"

And the intercept formula `b = ȳ − m·x̄` means: **the best line always passes through the centre of mass `(x̄, ȳ)` of your data.** Once you know the slope, the intercept is forced.

#### 3f. Final formulas (used in code)

```python
slope     = np.cov(x, y)[0, 1] / np.var(x)
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
