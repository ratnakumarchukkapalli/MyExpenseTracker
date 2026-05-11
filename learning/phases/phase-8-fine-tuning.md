# Phase 8 — Fine-tuning (Expense Categorizer)

> Most engineers only USE models. You're going to TRAIN one.
> Fine-tuning is transfer learning: start from a model that already knows language,
> teach it YOUR specific task with YOUR specific data.
> This is the career differentiator.

---

## The Big Idea

You have ~763 labelled expense transactions:
```
"Swiggy order"       → Personal
"Electricity bill"   → MonthlyBills
"HDFC EMI"          → LOANS/CC
"SIP investment"     → Savings
```

Fine-tune Gemma 4 E2B (2B parameters — fits on your M3) to categorize NEW expenses
in YOUR categories, with YOUR naming conventions, trained on YOUR history.

---

## Math — Transfer Learning

### Why not train from scratch?

Training Gemma 4 from scratch requires:
- Trillions of tokens of text data
- Thousands of GPUs
- Months of compute time
- ~$50-100 million

Transfer learning: start from Gemma's pretrained weights, adjust for your task.

### LoRA (Low-Rank Adaptation)

Instead of updating all 2 billion weights (expensive):
- Freeze original weights
- Add small "adapter" matrices alongside each layer
- Train ONLY the adapters (~1-5% of parameters)
- Merge adapters back at inference time

```
Original weight matrix W (frozen)
+
Adapter = A × B   (A: 2B×8, B: 8×2B — much smaller!)
```

Memory: full fine-tune needs 16GB+ VRAM. LoRA needs ~6-8GB.
Your M3 24GB: fits comfortably.

### Dataset Format (JSONL)

```json
{"instruction": "Categorize this expense: Swiggy order 450", "response": "Personal"}
{"instruction": "Categorize this expense: Electricity bill 2400", "response": "MonthlyBills"}
{"instruction": "Categorize this expense: HDFC home loan EMI", "response": "LOANS/CC"}
```

### Overfitting in Fine-tuning

With 763 examples, overfitting is the main risk:
- Model memorises training data instead of learning the pattern
- Train/validation split: 80/20
- Early stopping: stop when validation loss stops improving

---

## Training Command

```bash
# Using Unsloth (fastest LoRA fine-tuning on Apple Silicon)
pip install unsloth

# Fine-tune Gemma 4 E2B on your expense data
# Takes ~30-60 min on M3 with 763 examples
```

Full code written when we build this phase together.

---

## Done When

- [ ] 763 expenses exported as JSONL dataset
- [ ] Gemma 4 E2B fine-tuned on your data (Unsloth)
- [ ] Categorizer accuracy measured before/after fine-tune
- [ ] Deployed: new expense descriptions auto-categorized in Add Expense form
- [ ] You can explain: what transfer learning is, what LoRA does, how to detect overfitting
