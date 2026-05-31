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

## ML Features — What Gets Built

> **Philosophy:** Every phase ships a real feature to the Dashboard. Implement **with** each phase,
> not after all phases are done. Seeing your own ₹ data is what makes the math stick.

### Feature Map

| Feature | Where in app | Phase | Daily utility |
|---|---|---|---|
| Spend trend line on bar chart | Dashboard chart overlay | 1 | High |
| Year-end balance forecast card | Dashboard stat card | 1 | High |
| Category spend forecast | Category breakdown | 1 | High |
| "What-if" simulator (cut dining 20% → save ₹X) | Dashboard modal | 1 ext | Medium |
| Unusual expense badge ⚠️ | Expense list rows | 2 | High |
| Category spike alert banner | Dashboard banner | 2 | High |
| Financial health score (0–100, colour-coded) | Dashboard stat card | 3 | High |
| Smart budget suggestions from history | Budget settings | 3 ext | Medium |
| Recurring expense detector | Expense list | 3 ext | Medium |
| Mid-month budget breach warning | Dashboard banner | 4 | High |
| Seasonal pattern tooltip ("28% more in Dec") | Dashboard chart | 4 | Medium |
| SIP NAV simple projection | SIP Tracker | 4 | Medium |
| MLP vs linear regression accuracy comparison | Internal / dev view | 5 | Learning only |
| "Ask your finances" chat widget | Dashboard | 6 | Very high |
| Auto-suggest category on Add Expense | Add Expense form | 6 | Very high |
| Natural language expense search | Search bar | 6 | High |
| Monthly AI-written summary paragraph | Dashboard / export | 6 | Medium |
| Health score plain-English explanation | Health score card | 7 | High |
| Auto-categorizer trained on YOUR data | Add Expense form | 8 | Very high |

### What each phase looks like in the app

```
After Phase 1:  Dashboard has a dotted trend line + "Year-end: ₹X" stat card
After Phase 2:  Unusual expenses get ⚠️ + Dashboard shows spike alerts
After Phase 3:  Health Score card appears (0–100, red/yellow/green) + breakdown
After Phase 4:  Mid-month "on track / ₹X over" banner goes live
After Phase 5:  Internal model swap (invisible to user — that IS the lesson)
After Phase 6:  Chat widget + auto-category on Add Expense + AI monthly summary
After Phase 7:  Health score card shows "why" in one sentence
After Phase 8:  Auto-categorizer replaces manual category on every new expense
```

### Features NOT worth building (honest list)

- SHAP waterfall chart — ML Engineer territory, rarely used day-to-day
- Expense clustering / "month persona" — interesting but not actionable
- Peer comparison — no data, not applicable
- Real-time anomaly streaming — overkill for personal finance

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
**Bead:** MyExpenseTracker-k4t | **Status: IN PROGRESS**
**Study file:** `learning/phases/phase-1-regression.md`

**What you build:**
- Trend line on Dashboard expense chart (dotted line overlaid on bar chart)
- "Year-end balance forecast" stat card — "At current pace: ₹X by December"
- Category-level spend forecast — "Next month Food: ₹4,200 (↑8%)"
- "What-if" simulator — "If I cut dining 20%, year-end improves by ₹18,000" *(extension)*
- `POST /ml/trend` endpoint

**Math you learn:**
- **Vectors & dot product** — how to measure similarity and direction
- **Least squares** — why the "best fit" line minimises squared errors (not absolute errors)
- **Slope & intercept** — what they mean in plain English
- **R² (R-squared)** — how to tell if a model is actually useful
- **Gradient descent intuition** — how the model finds the best line (same algorithm that trains neural networks)
- **Extrapolation risk** — why predictions far from training data are unreliable

**Algorithm:** Linear Regression (write in numpy first, then scikit-learn)

**Done when:** Dashboard shows a dotted trend line + "Year-end: ₹X" stat card on real Supabase data

---

### Phase 2 — Anomaly Detection
**Bead:** MyExpenseTracker-0gm | **Status: TODO**
**Study file:** `learning/phases/phase-2-anomaly.md`

**What you build:**
- ⚠️ badge on expense rows that are statistically unusual vs your category history
- Dashboard banner — "Food is 2.3× your monthly average this month"
- Single transaction alert — flags transactions unusually large vs category average
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

**Done when:** Unusual expense rows show ⚠️ badge + Dashboard shows category spike alert on YOUR data

---

### Phase 3 — Financial Health Score
**Bead:** MyExpenseTracker-clc | **Status: TODO**
**Study file:** `learning/phases/phase-3-health-score.md`

**What you build:**
- Health Score card on Dashboard (0–100, red/yellow/green)
- Score breakdown: savings rate (40 pts) + expense control (35 pts) + budget adherence (25 pts)
- Month quality badge: "Good / Fair / Needs Attention"
- Smart budget suggestions — "Based on your history, realistic Food budget: ₹X" *(extension)*
- Recurring expense detector — "Detected: Netflix ₹649, Spotify ₹119" *(clustering extension)*
- `POST /ml/health-score` endpoint

**Math you learn:**
- **Normalisation (min-max scaling)** — how to convert any number to 0–100
- **Weighted sum** — why savings rate matters more than absolute spend amount
- **Sigmoid / logistic function** — squashes any number into 0–1 probability
- **Decision boundary** — the line that separates "good month" from "bad month"
- **Logistic Regression** — classification using a probability threshold

**Done when:** Dashboard shows your Health Score (0–100) with component breakdown on YOUR monthly data

---

### Phase 4 — Time Series + Budget Breach Alert
**Bead:** MyExpenseTracker-yah | **Status: TODO**
**Study file:** `learning/phases/phase-4-time-series.md`

**What you build:**
- Mid-month banner: "At this pace you'll spend ₹14,200 vs ₹12,000 budget — ₹2,200 over"
- Seasonal insight tooltip on chart: "You typically spend 28% more in December"
- SIP NAV simple month-by-month projection
- `POST /ml/budget-forecast` endpoint

**Math you learn:**
- **Rolling average** — smooth out noise, see the trend
- **Autocorrelation** — does this month's spending predict next month's?
- **Seasonality** — monthly patterns that repeat year over year
- **Time series decomposition** — split signal into: trend + seasonality + noise
- **ARIMA intuition** — the standard time series model (Auto-Regressive Integrated Moving Average)

**Done when:** Dashboard shows mid-month "on track / ₹X over" live banner on real spend data

---

### Phase 5 — Neural Networks
**Bead:** MyExpenseTracker-0gl | **Status: TODO**
**Study file:** `learning/phases/phase-5-neural-nets.md`

> **Honest note:** This phase is primarily for understanding, not daily app value. The user will not
> see a difference in the Dashboard — on 12–36 months of expense data, linear regression matches or
> beats MLP. That IS the lesson: know when not to use complex models.

**What you build:**
- MLP expense predictor (internal swap — replaces linear regression model)
- Accuracy comparison: "MLP R²=0.91 vs Linear R²=0.87 — is the complexity worth it?"
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

**Algorithm:** MLP (Multi-Layer Perceptron) — conceptual in numpy, then scikit-learn MLPRegressor

**Done when:** You can explain forward pass + backprop in plain English; accuracy comparison shows on dev dashboard

---

### Phase 6 — Embeddings + RAG + Local LLM
**Bead:** MyExpenseTracker-7vl | **Status: TODO**
**Study file:** `learning/phases/phase-6-rag-llm.md`

> **Most important phase.** This is where AI Engineering and ML converge. Spend the most time here.
> Split into 6a (embeddings + vector search) then 6b (RAG + LLM features).

**What you build:**
- **6a — Embeddings:** pgvector in Supabase; embed all expense descriptions; natural language search
  - Search bar: type "food expenses above ₹500 in April" → filtered results
- **6b — RAG features:**
  - "Ask your finances" chat widget on Dashboard — "How much on Swiggy in Q1?" → correct answer
  - Auto-suggest category when adding expense — "Swiggy → Food (suggested)"
  - Monthly AI-written summary — "In April you saved 22% of income, best month in 6 months..."
  - Uses local Gemma 4 via Ollama (no data leaves your Mac)
- `POST /ml/ask` endpoint, `POST /ml/categorize` endpoint

**Math you learn:**
- **Embeddings** — turning text into vectors (the universal bridge between language and math)
- **Cosine similarity** — measuring semantic distance between vectors
- **Vector search** — find the most relevant expense records for a query (pgvector)
- **RAG architecture** — Retriever finds context, Generator answers using it
- **Context window** — why you can't just give the LLM all your data
- **Chunking** — splitting records into retrievable pieces

**Stack:** Ollama + pgvector + Pydantic AI + Anthropic SDK fallback (not LangChain)

**Done when:** You can ask "how much on Swiggy in March?" and get a correct answer from local Ollama

---

### Phase 7 — Explainability
**Bead:** MyExpenseTracker-udv | **Status: TODO**
**Study file:** `learning/phases/phase-7-explainability.md`

> **Scope adjustment:** Skip the SHAP waterfall chart (ML Engineer territory, not AI Engineer).
> Focus on plain-English explanations — the output users actually want to read.

**What you build:**
- Health Score card shows a one-sentence reason — "Score dropped 8 pts: dining was ₹3,200 over budget"
- LLM-generated explanation: "Your savings rate fell to 12% vs your usual 22% — 3 weekend trips drove it"
- `POST /ml/explain` endpoint

**Math you learn:**
- **Shapley values** (from game theory) — fair attribution of credit across features
- **Marginal contribution** — how much does each feature add to the prediction?
- **Feature importance vs SHAP** — why SHAP is more honest than simple importance ranking
- **Model interpretability** — why this matters in production (debugging, trust, compliance)

**Done when:** Health Score card shows a plain-English reason sentence generated from YOUR data

---

### Phase 8 — Fine-tuning
**Bead:** MyExpenseTracker-oyx | **Status: TODO**
**Study file:** `learning/phases/phase-8-fine-tuning.md`

> **Goal framing:** The primary lesson is knowing WHEN NOT to fine-tune (most teams never do —
> RAG + prompt engineering gets there first). Fine-tune anyway to understand the technique,
> then compare it against the Phase 6 RAG categorizer.

**What you build:**
- Expense auto-categorizer trained on YOUR labelling history
- Add Expense form shows: "Swiggy → Food (94% confident)" from fine-tuned model
- Eval comparison — fine-tuned model vs base model vs Phase 6 embeddings approach
- Export transactions as JSONL → fine-tune Phi-3 or Llama 3.2 1B via MLX-LM on M3

**Math you learn:**
- **Transfer learning** — why you start from a pretrained model, not scratch
- **LoRA / QLoRA** — fine-tuning without retraining all weights (memory-efficient)
- **Instruction tuning format** — JSONL with `instruction` / `response` pairs
- **Overfitting in fine-tuning** — how to detect and stop it
- **Evaluation** — before/after accuracy on held-out test set; when fine-tuning wins vs loses

**Tool:** MLX-LM (native Apple Silicon — NOT Unsloth which is CUDA-only)

**Done when:** Fine-tuned categorizer shows confidence score on Add Expense; eval comparison shows whether it beat RAG

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
