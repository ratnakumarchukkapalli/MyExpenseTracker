# Phase 7 — Explainability (SHAP)

> A model that can't explain itself is a liability in production.
> SHAP tells you: "which features pushed this prediction up or down, and by how much?"
> This is the difference between a junior ML engineer and a senior one.

---

## The Big Idea

Your health score dropped from 72 to 64.
SHAP waterfall chart:

```
Base score:          72
savings_rate  -5.2   ←── fell from 24% to 11%
debt_ratio    -2.1   ←── took a new EMI
buffer_months -0.7   ←── lower remaining
Final score:         64
```

Now you know WHY, not just WHAT.

---

## Math — Shapley Values (Game Theory)

Shapley values come from cooperative game theory (1953, Lloyd Shapley).

The question: "If 4 players contribute to a team score, how do we fairly attribute credit?"

Answer: average each player's marginal contribution across ALL possible orderings.

In ML: features are players, prediction is the score.

```python
import shap

explainer = shap.Explainer(model, X_train)
shap_values = explainer(X_test)

shap.waterfall_plot(shap_values[0])   # explain one prediction
shap.summary_plot(shap_values, X_test) # explain all predictions
```

---

## Why This Matters at Senior Level

1. Debugging: "Why is the model predicting wrong for this user?"
2. Trust: Non-technical stakeholders need explanations, not black boxes
3. Compliance: Financial models often legally require explainability
4. Improvement: SHAP reveals which features actually matter → better feature engineering

---

## Done When

- [ ] `/explain` endpoint returns SHAP values for health score
- [ ] Health Score card shows "what affected your score this month"
- [ ] You can explain Shapley values without looking at notes
