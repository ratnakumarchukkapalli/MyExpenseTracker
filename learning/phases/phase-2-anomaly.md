# Phase 2 — Anomaly Detection (Z-score)

> An anomaly is just a data point that's "too far from normal."
> To know what's too far, you first need to know what "normal" looks like.
> That's statistics. Specifically: the normal distribution.

---

## The Big Idea

Your category spending each month has a "usual" range. When one month spikes way outside that range, it's an anomaly. We flag it automatically.

Example:
- Your average Personal spend: ₹8,000/month
- Standard deviation: ₹1,500
- This month: ₹15,000
- That's (15000 - 8000) / 1500 = **4.7 standard deviations** away
- Anything > 2 is flagged. 4.7 is extreme.

---

## Math — Step by Step

### Mean and Variance

```
mean (μ)     = sum of all values / count         ← the centre
variance (σ²) = average of squared distances from mean
std dev (σ)  = √variance                         ← spread around centre
```

```python
import numpy as np

personal_spending = [7500, 8200, 7800, 9100, 8400, 8000, 7600, 15000]

mean = np.mean(personal_spending)       # 8825
std  = np.std(personal_spending)        # 2398

print(f"Normal range: ₹{mean - 2*std:.0f} to ₹{mean + 2*std:.0f}")
# 95% of months should fall in this range
```

### Normal Distribution (Bell Curve)

Most natural data follows this shape:
```
        ████
      ████████
    ████████████
  ████████████████
──────────────────── spending
  μ-2σ  μ-σ  μ  μ+σ  μ+2σ

68% of months fall within μ ± 1σ
95% of months fall within μ ± 2σ  ← our threshold
99.7% of months fall within μ ± 3σ
```

### Z-score

```
Z = (value - mean) / std_dev
```

Z tells you: "how many standard deviations is this point from the mean?"

```python
def z_score(value, mean, std):
    return (value - mean) / std

z = z_score(15000, 8825, 2398)   # → 2.57
# Flag if abs(z) > 2
```

### IQR (for skewed data)

Expenses are often right-skewed (rare big purchases). IQR is more robust:
```python
q1, q3 = np.percentile(values, [25, 75])
iqr = q3 - q1
lower = q1 - 1.5 * iqr
upper = q3 + 1.5 * iqr
# Values outside [lower, upper] are anomalies
```

---

## FastAPI Endpoint

```python
# POST /anomaly
# Input: user_id, lookback_months
# Output: list of anomalous expenses with their Z-scores and reason
```

Full code written when we build this phase together.

---

## Done When

- [ ] `/anomaly` endpoint flags unusual expenses
- [ ] Expense list shows ⚠️ badge with "3.2σ above your normal Personal spend"
- [ ] You can explain: what std dev measures, what the bell curve represents, when to use IQR vs Z-score
