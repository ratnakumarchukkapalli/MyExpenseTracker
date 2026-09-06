# Step 1 concepts — embeddings, similarity, and why an index

## Turning meaning into geometry

Computers can't compare "meaning" directly, but they're very good at
comparing numbers. An **embedding** is a trained neural network's way of
converting text into a fixed-length list of numbers (a **vector**) such
that texts with similar meaning end up as nearby *points in space*.

GPS coordinates, but for meaning instead of location:

```
"Swiggy order"          → some point
"Zomato order"           → a nearby point   (similar meaning: food delivery)
"Car insurance premium"  → a distant point  (unrelated meaning)
```

The model (nomic-embed-text, via LM Studio) was trained on huge amounts of
text so its internal representation captures meaning. Feed it a sentence,
it outputs 768 numbers. That list *is* the embedding — nothing more
mystical than that.

## Measuring "close"

Three common distance metrics between two vectors:

- **Cosine similarity** — the angle between them, ignoring length. Same
  direction = 1, perpendicular = 0, opposite = −1.
- **Euclidean (L2) distance** — straight-line distance, sensitive to length.
- **Dot product** — related to cosine, but magnitude-sensitive.

Text embeddings use **cosine**, because a vector's *direction* encodes
meaning — magnitude is mostly a model artifact, not signal.

## The bridge to Phase 1

Cosine similarity is built directly on the dot product:

```
cos(θ) = (a · b) / (|a| |b|)
```

Same dot product from Phase 1's regression work. Vectors and dot products
— same math, new application. Everything downstream in RAG reuses this one
operation.

## Why an index (HNSW) at all

With a few hundred rows, brute-force comparison (query vector against
every row's vector) is fast and *exact*. It's O(n) per query, though — it
stops scaling once you have millions of rows.

**HNSW** (Hierarchical Navigable Small World) pre-builds a graph structure
over the vectors so a query can jump to "very likely nearest neighbors"
without touching every row — trading a small amount of accuracy
(approximate, not guaranteed-exact top-k) for speed at scale.

Honest caveat: at this app's actual data volume (thousands of expense rows
over years), brute force would still be plenty fast — HNSW isn't *needed*
yet. Building it anyway because production RAG systems always use an ANN
index at real scale, and that's the muscle this project is for.

## What the new column actually stores

`embedding vector(768)` on each expense row is a literal array of 768
floats — the geometric fingerprint of that row's `description` (+ `tag`
when set). See [`scripts/022_rag_pgvector.sql`](../../../scripts/022_rag_pgvector.sql)
for the migration (drafted, not yet applied).
