# Phase 4 — Time Series + Budget Breach Alert

> Time series is just regression where ORDER matters.
> The past predicts the future — but only if the pattern repeats.
> This phase teaches you when to trust a prediction and when not to.

---

## The Big Idea

Mid-month you've spent ₹28,000 out of ₹60,000 budget in 12 days.
At this pace: (28000 / 12) × 30 = ₹70,000 → you'll EXCEED budget by ₹10,000.

That alert = time series forecasting applied to your current month.

---

## Math — Step by Step

### Rolling Average

```python
# Smooth out noise — see the trend
df["rolling_avg"] = df["total_expenses"].rolling(window=3).mean()
# Each value = average of last 3 months
# Reduces noise, reveals trend direction
```

### Autocorrelation

Does this month's spending correlate with last month's?

```python
from pandas.plotting import autocorrelation_plot
autocorrelation_plot(df["total_expenses"])

# High correlation at lag-1: last month predicts this month well
# High correlation at lag-12: same month last year is a good predictor (seasonality!)
```

### Seasonality Decomposition

```python
from statsmodels.tsa.seasonal import seasonal_decompose

result = seasonal_decompose(df["total_expenses"], model="additive", period=12)
result.plot()
# Shows: trend + seasonality + residual (noise)
# Seasonality: do you spend more in Dec/Jan? That's the seasonal component.
```

### ARIMA Intuition (not implemented — understand the concept)

**AR** (Auto-Regressive): predict based on past values
**I** (Integrated): difference the series to make it stationary
**MA** (Moving Average): model the error terms

You don't need to implement ARIMA — Prophet (Facebook) does it better.
What you need to understand: prediction = trend + seasonality + noise model.

---

## Budget Breach Formula

```python
def budget_breach_alert(user_id, current_date):
    expenses_this_month = load_current_month_expenses(user_id)
    total_budget = load_category_budgets(user_id)

    days_elapsed = current_date.day
    days_in_month = 30
    pace_factor = days_in_month / days_elapsed

    projected_spend = expenses_this_month["amount"].sum() * pace_factor
    budget_total = total_budget["budget_value"].sum()
    gap = projected_spend - budget_total

    return {
        "projected": projected_spend,
        "budget": budget_total,
        "gap": gap,
        "status": "over" if gap > 0 else "under",
        "message": f"At this pace you'll spend ₹{projected_spend:,.0f} vs budget ₹{budget_total:,.0f}"
    }
```

---

## Done When

- [ ] `/budget-forecast` endpoint returns projection and alert status
- [ ] Dashboard shows mid-month pace alert (green/red)
- [ ] You can explain: rolling average, autocorrelation, what seasonality means in your data
