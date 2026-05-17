# ML Learning Plan — MyExpenseTracker Webapp

> **Goal:** Learn ML properly — math, algorithms, and real engineering — by building features
> on your own financial data in the MyExpenseTracker webapp.
>
> **Resume any session:** Type `/ml-webapp` — picks up exactly where we left off.
>
> **Stack:** FastAPI (Python) `ml-service/` → Supabase (PostgreSQL) → Next.js API proxy → Dashboard UI
>
> **Career docs:** [learning/career/retrospective.md](career/retrospective.md) · [learning/career/ml-plan-review.md](career/ml-plan-review.md)
>
> **Next work-side initiative:** Introduce eval-driven development to the AI Ops assistant (Promptfoo + LLM-as-judge + Prometheus `llm.eval.score`). Mirror the same patterns in MyExpenseTracker Phase 0.

---

## Current Status

```
PHASE    : Phase 1 — Linear Regression
TOPIC    : trend line + forecasting + year-end balance prediction
STATUS   : IN PROGRESS
BEAD     : MyExpenseTracker-k4t
STUDY    : learning/phases/phase-1-regression.md  (HTML: phase-1-regression.html)
NEXT     : Theory captured: vectors, dot product, features/weights, bias trick, SSE,
           why-squared, loss bowl, universal ML recipe, slope=cov/var meaning.
           Pending: R² intuition → numpy implementation → sklearn verify →
           POST /ml/trend → Next.js proxy → run on real Supabase data.
```

---

## Your Learning Path (Traditional ML → LLMs)

```
Phase 0   Setup & Data Stack     pandas · numpy · Supabase → DataFrame · Jupyter
Phase 1   Linear Regression      expense trend · forecasting · year-end balance
Phase 2   Anomaly Detection      Z-score · std dev · normal distribution
Phase 3   Classification         logistic regression · health score · decision boundary
Phase 4   Time Series            rolling avg · seasonality · budget breach alert
          ── you now understand Traditional ML ──
Phase 5   Neural Networks        MLP · backprop · gradient descent math
Phase 6   RAG + LLM              embeddings · cosine similarity · "Ask your finances"
Phase 7   Explainability         SHAP · feature importance · model interpretability
Phase 8   Fine-tuning            LoRA · dataset prep · train categorizer on YOUR data
          ── you now understand how LLMs work end-to-end ──
```

---

## Architecture

```
MyExpenseTracker/
├── ml-service/                  ← Python FastAPI (port 8001 locally)
│   ├── main.py                  ← API endpoints: /health, /trend, /anomaly, /health-score
│   ├── db.py                    ← Supabase → pandas DataFrame loader
│   ├── requirements.txt         ← fastapi uvicorn supabase pandas numpy scikit-learn
│   └── notebooks/
│       └── explore.ipynb        ← Jupyter: explore YOUR real expense data
├── app/api/ml/                  ← Next.js proxy routes (adds auth, forwards to ml-service)
│   └── trend/route.ts           ← example: proxies to http://localhost:8001/trend
└── learning/                    ← THIS FOLDER
    ├── PLAN.md                  ← source of truth for progress (this file)
    └── phases/
        ├── phase-0-setup.md
        ├── phase-1-regression.md
        ├── phase-2-anomaly.md
        ├── phase-3-health-score.md
        ├── phase-4-time-series.md
        ├── phase-5-neural-nets.md
        ├── phase-6-rag-llm.md
        ├── phase-7-explainability.md
        └── phase-8-fine-tuning.md
```

**Local dev:** Run `uvicorn main:app --reload --port 8001` inside `ml-service/`
**Production:** Deploy `ml-service/` to Railway (GitHub push → auto-deploy). Vercel can't run Python ML (too heavy for serverless).

---

## Supabase Tables Used Per Phase

| Phase | Tables | What we extract |
|-------|--------|-----------------|
| 0 | `expenses` | All transactions → DataFrame exploration |
| 1 | `expenses`, `monthly_summary` | Monthly totals → trend line + forecast |
| 2 | `expenses` | Per-category amounts → Z-score anomalies |
| 3 | `monthly_summary` | salary, savings, remaining → health score |
| 4 | `expenses`, `category_budgets` | Spend pace vs budget → breach alert |
| 5 | `monthly_summary` | All columns → MLP regression |
| 6 | `expenses` | Descriptions + amounts → embeddings |
| 7 | `monthly_summary` | Health score inputs → SHAP explain |
| 8 | `expenses` | Descriptions + categories → fine-tune dataset |

---

## Phase Breakdown

---

### Phase 0 — Setup & Data Stack
**Bead:** MyExpenseTracker-01t | **Status: DONE**
**Study file:** `learning/phases/phase-0-setup.md`

**What you build:**
- `ml-service/` FastAPI skeleton (port 8001)
- Supabase connection in Python (`db.py`)
- Load ALL your expenses into a pandas DataFrame
- Plot monthly spending in Jupyter — first ML output from YOUR real data

**Math you learn:**
- What is a vector? (a row of expense data IS a vector)
- What is a matrix? (your entire expenses table IS a matrix)
- Why numpy beats Python loops (vectorized operations — same reason neural nets are fast)
- What is a distribution? (your spending data has a shape — we'll plot it)

**Done when:** You can run `df = load_expenses()` in Jupyter and see a chart of your monthly totals.

---

### Phase 1 — Linear Regression
**Bead:** MyExpenseTracker-k4t | **Status: TODO**
**Study file:** `learning/phases/phase-1-regression.md`

**What you build:**
- Trend line on Dashboard expense chart
- "Your year-end balance will be ₹X" forecast
- Category-level spend forecast (next month Food, Bills, etc.)
- `POST /ml/trend` endpoint

**Math you learn:**
- **Vectors & dot product** — how to measure similarity and direction
- **Least squares** — why the "best fit" line minimises squared errors (not absolute errors)
- **Slope & intercept** — what they mean in plain English
- **R² (R-squared)** — how to tell if a model is actually useful
- **Gradient descent intuition** — how the model finds the best line (same algorithm that trains neural networks)
- **Extrapolation risk** — why predictions far from training data are unreliable

**Algorithm:** Linear Regression (write in numpy first, then scikit-learn)

**Done when:** Dashboard shows a trend line + "predicted year-end: ₹X"

---

### Phase 2 — Anomaly Detection
**Bead:** MyExpenseTracker-0gm | **Status: TODO**
**Study file:** `learning/phases/phase-2-anomaly.md`

**What you build:**
- ⚠️ badge on expense rows that are statistically unusual
- Category spike alert ("Food is 3× your usual this month")
- `POST /ml/anomaly` endpoint

**Math you learn:**
- **Mean and variance** — the centre and spread of your data
- **Standard deviation** — what "1 sigma" and "2 sigma" mean visually
- **Normal distribution (bell curve)** — most spending clusters near the mean; outliers are rare
- **Z-score** — how many standard deviations from the mean is THIS expense?
  - Z > 2 = unusual (top 5%)
  - Z > 3 = very unusual (top 0.3%)
- **IQR (interquartile range)** — alternative to Z-score for skewed data

**Algorithm:** Z-score anomaly detection

**Done when:** Unusual expenses show a badge; you understand WHY the threshold is Z=2

---

### Phase 3 — Financial Health Score
**Bead:** MyExpenseTracker-clc | **Status: TODO**
**Study file:** `learning/phases/phase-3-health-score.md`

**What you build:**
- Health Score card on Dashboard (0–100, colour coded)
- Month quality rating (Good / OK / Bad)
- `POST /ml/health-score` endpoint

**Math you learn:**
- **Normalisation (min-max scaling)** — how to convert any number to 0–100
- **Weighted sum** — why savings rate matters more than absolute spend amount
- **Sigmoid / logistic function** — squashes any number into 0–1 probability
- **Decision boundary** — the line that separates "good month" from "bad month"
- **Logistic Regression** — classification using a probability threshold

**Done when:** Dashboard shows your Health Score and you can explain each component

---

### Phase 4 — Time Series + Budget Breach Alert
**Bead:** MyExpenseTracker-yah | **Status: TODO**
**Study file:** `learning/phases/phase-4-time-series.md`

**What you build:**
- Mid-month banner: "At this pace you'll spend ₹X vs budget ₹Y"
- Seasonal pattern: "You spend 30% more in December"
- SIP NAV simple forecast
- `POST /ml/budget-forecast` endpoint

**Math you learn:**
- **Rolling average** — smooth out noise, see the trend
- **Autocorrelation** — does this month's spending predict next month's?
- **Seasonality** — monthly patterns that repeat year over year
- **Time series decomposition** — split signal into: trend + seasonality + noise
- **ARIMA intuition** — the standard time series model (Auto-Regressive Integrated Moving Average)

**Done when:** Dashboard shows a mid-month "on track / over budget" status

---

### Phase 5 — Neural Networks
**Bead:** MyExpenseTracker-0gl | **Status: TODO**
**Study file:** `learning/phases/phase-5-neural-nets.md`

**What you build:**
- MLP expense predictor (replaces linear regression)
- Compare: does deep learning beat simple regression on YOUR data?
- `POST /ml/neural-predict` endpoint

**Math you learn:**
- **Neurons & weights** — a weighted sum with a twist (activation function)
- **Activation functions** — ReLU, sigmoid, tanh — why they exist
- **Forward pass** — how data flows through layers (matrix multiplications!)
- **Loss function** — how we measure how wrong the model is
- **Backpropagation** — the chain rule applied backwards through the network
- **Gradient descent** — take a small step downhill on the loss surface
- **Overfitting** — when the model memorises training data instead of learning patterns
- **Dropout & regularisation** — how to fight overfitting

**Algorithm:** MLP (Multi-Layer Perceptron) — first in numpy, then scikit-learn MLPRegressor

**Done when:** You can implement a 3-layer network from scratch in numpy and explain each step

---

### Phase 6 — RAG + Local LLM
**Bead:** MyExpenseTracker-7vl | **Status: TODO**
**Study file:** `learning/phases/phase-6-rag-llm.md`

**What you build:**
- "Ask your finances" chat: "How much did I spend on food in Q1?"
- Auto-generate monthly summary paragraph
- Uses local Gemma 4 via LM Studio (no data leaves your Mac)
- `POST /ml/ask` endpoint

**Math you learn:**
- **Embeddings** — turning text into vectors (the universal bridge)
- **Cosine similarity** — measuring semantic distance between vectors
- **Vector search** — find the most relevant expense records for a query
- **RAG architecture** — Retriever finds context, Generator answers using it
- **Context window** — why you can't just give the LLM all your data
- **Chunking** — splitting records into retrievable pieces

**Done when:** You can ask "how much on Swiggy in March?" and get a correct answer

---

### Phase 7 — Explainability (SHAP)
**Bead:** MyExpenseTracker-udv | **Status: TODO**
**Study file:** `learning/phases/phase-7-explainability.md`

**What you build:**
- "Why did your health score drop from 72 to 64?"
- SHAP waterfall chart showing which factors hurt or helped
- `POST /ml/explain` endpoint

**Math you learn:**
- **Shapley values** (from game theory) — fair attribution of credit across features
- **Marginal contribution** — how much does each feature add to the prediction?
- **Feature importance vs SHAP** — why SHAP is more honest than simple importance ranking
- **Model interpretability** — why this matters in production (debugging, trust, compliance)

**Done when:** Health Score card shows "savings rate pulled you down by 8 points"

---

### Phase 8 — Fine-tuning
**Bead:** MyExpenseTracker-oyx | **Status: TODO**
**Study file:** `learning/phases/phase-8-fine-tuning.md`

**What you build:**
- Expense auto-categorizer trained on YOUR labelled data
- Export transactions as JSONL → fine-tune Gemma 4 E2B on M3
- Replace rule-based categorization with trained model

**Math you learn:**
- **Transfer learning** — why you start from a pretrained model, not scratch
- **LoRA / QLoRA** — fine-tuning without retraining all weights (memory-efficient)
- **Instruction tuning format** — JSONL with `instruction` / `response` pairs
- **Overfitting in fine-tuning** — how to detect and stop it
- **Evaluation** — before/after accuracy on held-out test set

**Done when:** You've trained a model on your own data, evaluated it, and deployed it

---

## Session Format

Every session follows this pattern:
1. **Review** — what did we build last time? (5 min)
2. **Theory** — math + algorithm intuition, drawn out (20 min)
3. **Build** — implement it with real Supabase data (40 min)
4. **Interpret** — what does YOUR data actually say? (10 min)
5. **Update** — mark bead done, update STATUS above, set NEXT

---

## ML Algorithms Reference

```
SUPERVISED (labelled data)
├── Regression      Linear, Ridge, Lasso, Polynomial          Phase 1
├── Classification  Logistic, Decision Tree, Random Forest     Phase 3, 5
│                   Naive Bayes, SVM, KNN, XGBoost
└── Ensemble        Bagging (Random Forest), Boosting (XGBoost) Phase 5

UNSUPERVISED (no labels)
├── Clustering      K-Means, DBSCAN, Hierarchical             Phase 6
└── Anomaly         Z-score, Isolation Forest, One-Class SVM  Phase 2

TIME SERIES
└── Rolling avg, ARIMA, SARIMA, Prophet                       Phase 4

DEEP LEARNING
├── MLP             Multi-Layer Perceptron                     Phase 5
├── LSTM            Long Short-Term Memory (sequences)         Phase 6+
└── Transformer     Self-attention — what LLMs ARE             Phase 6

REINFORCEMENT LEARNING  (not in this plan — separate track)
```

## Math Topics Reference

```
Linear Algebra    vectors, matrices, dot product, matrix multiply  Phase 0-1, 5
Statistics        mean, variance, std dev, distributions           Phase 0-2
Probability       conditional probability, Bayes theorem           Phase 3
Calculus          derivatives, chain rule, gradients               Phase 5
Information Theory entropy, KL divergence                          Phase 5
Geometry          cosine similarity, euclidean distance            Phase 6
Game Theory       Shapley values                                   Phase 7
```
