# Phase 3 — Financial Health Score (Logistic Regression)

> This phase introduces classification — the other half of supervised ML.
> Regression answers "how much?" Classification answers "which category?"
> The logistic function is the bridge between the two — and it's also the
> building block of every neuron in a neural network.

---

## The Big Idea

Your financial data this month = a set of numbers (salary, savings rate, debt ratio, etc.).
We want to map those numbers to a score 0-100 and a label: "Good" / "OK" / "Bad".

That's classification. We use logistic regression to learn the decision boundary.

---

## Math — Step by Step

### Normalisation (min-max scaling)

Before scoring, all inputs must be on the same scale (0-1):
```
scaled = (value - min) / (max - min)
```

Your savings rate of 24% becomes 0.8 if max is 30%, 0 if you saved nothing.

### Weighted Sum

```
score = w1 * savings_rate + w2 * (1 - debt_ratio) + w3 * emergency_fund_months + ...
```

Weights reflect importance: savings rate matters more than interest income.
We set weights based on domain knowledge first, then learn them from data.

### Sigmoid / Logistic Function

```
σ(z) = 1 / (1 + e^(-z))
```

Takes ANY number and squashes it to (0, 1).
This is the activation function of logistic regression.
It's also the same function used in LSTM gates (Phase 5).

```python
import numpy as np

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

print(sigmoid(-10))   # → ~0.00005 (very bad month)
print(sigmoid(0))     # → 0.5      (neutral)
print(sigmoid(10))    # → ~0.99995 (excellent month)
```

### Decision Boundary

When sigmoid output > 0.5 → classify as "Good"
When sigmoid output < 0.5 → classify as "Bad"
The point where output = 0.5 is the **decision boundary**

In 2D, it's a line. In higher dimensions, it's a hyperplane.
This is the exact same concept in SVMs, neural networks, transformers.

---

## Health Score Formula

```python
def compute_health_score(row):
    """
    Inputs from monthly_summary:
      - savings_rate: remaining / salary
      - debt_ratio: loan EMIs / salary
      - sip_consistency: months with SIP > 0 / total months
      - emergency_buffer: remaining_amount / avg_monthly_expense
    """
    savings_rate = row["remaining_amount"] / row["salary"]
    debt_ratio = row["loan_total"] / row["salary"]
    buffer_months = row["remaining_amount"] / row["avg_expense"]

    # Weighted components (each normalised 0-1)
    s_score = min(savings_rate / 0.30, 1.0)         # 30% savings = perfect
    d_score = max(1 - debt_ratio / 0.40, 0.0)       # 40% debt ratio = 0 score
    b_score = min(buffer_months / 3.0, 1.0)         # 3 months buffer = perfect

    weighted = 0.50 * s_score + 0.30 * d_score + 0.20 * b_score
    return round(weighted * 100)
```

---

## Done When

- [ ] `/health-score` endpoint runs and returns 0-100 score with breakdown
- [ ] Dashboard shows Health Score card with component scores
- [ ] You can explain: what sigmoid does, what a decision boundary is, what normalisation achieves
