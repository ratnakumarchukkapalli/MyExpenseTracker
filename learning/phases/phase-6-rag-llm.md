# Phase 6 — RAG + Local LLM

> This is where Traditional ML meets LLMs.
> Embeddings are the bridge: they turn your expense records into vectors.
> The LLM then reasons over those vectors to answer questions in plain English.

---

## The Big Idea

"How much did I spend on Swiggy in Q1 2026?"

1. **Embed** the question → a vector of 768 numbers
2. **Embed** each expense record → also a vector of 768 numbers
3. **Find** the records whose vectors are most similar to the question (cosine similarity)
4. **Send** those records + the question to Gemma 4
5. **Get** a plain-English answer back

This is RAG — Retrieval Augmented Generation.

---

## Math — Embeddings

An embedding converts text to a point in high-dimensional space.

```
"Swiggy food delivery" → [0.12, -0.34, 0.87, ..., 0.23]  (768 numbers)
"Zomato order"         → [0.14, -0.31, 0.85, ..., 0.21]  (768 numbers)
```

Similar meanings → similar vectors → close together in space.

### Cosine Similarity

```python
def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# 1.0 = identical direction (same meaning)
# 0.0 = perpendicular (unrelated)
# -1.0 = opposite
```

Dot product (Phase 1) is doing the real work here.
Everything in ML comes back to dot products.

---

## Architecture

```
User query: "Swiggy Q1 spend"
     ↓
Embed query (nomic-embed-text via LM Studio)
     ↓
Compare against embedded expense records (cosine similarity)
     ↓
Take top-10 most similar records
     ↓
Send to Gemma 4: "Given these records, answer: how much on Swiggy in Q1?"
     ↓
Return plain-English answer
```

No raw financial data sent to any cloud API. Gemma 4 runs locally via LM Studio.

---

## Done When

- [ ] `/ask` endpoint accepts natural language query, returns answer
- [ ] Expense records are embedded and stored (ChromaDB or pgvector)
- [ ] You can explain: what an embedding is, what cosine similarity measures, why RAG exists
