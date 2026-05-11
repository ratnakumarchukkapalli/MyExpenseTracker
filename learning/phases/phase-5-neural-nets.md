# Phase 5 — Neural Networks (MLP + Backpropagation)

> This is where the path to LLMs begins.
> A neural network is NOT magic. It's dot products + activation functions + gradient descent.
> You already know all three from Phases 0-4. Now we stack them.

---

## The Big Idea

A neuron = weighted sum → activation function → output

```
inputs: [salary, prev_remaining, loan_total, month_number]
        ↓ (multiply by weights, add bias)
hidden layer neuron: sum(w * x) + b
        ↓ (activation function — adds non-linearity)
        ReLU(z) = max(0, z)
        ↓
output layer: predicted next month expense
```

Stack 3 layers of this = Multi-Layer Perceptron (MLP).
Stack 96 layers with attention heads = GPT-4.
The difference is scale, not concept.

---

## Math — Step by Step

### Forward Pass (prediction)

```python
import numpy as np

def relu(z):
    return np.maximum(0, z)

def forward(X, W1, b1, W2, b2):
    # Layer 1
    z1 = X @ W1 + b1        # matrix multiply + bias
    a1 = relu(z1)            # activation

    # Layer 2 (output)
    z2 = a1 @ W2 + b2
    return z2                 # prediction
```

### Loss Function (how wrong are we?)

```python
def mse_loss(y_pred, y_true):
    return np.mean((y_pred - y_true) ** 2)
```

### Backpropagation (how to improve)

Chain rule applied backwards:
```
∂Loss/∂W2 = ∂Loss/∂z2 × ∂z2/∂W2   (output layer gradient)
∂Loss/∂W1 = ∂Loss/∂z2 × ∂z2/∂a1 × ∂a1/∂z1 × ∂z1/∂W1   (hidden layer)
```

In plain English: "how much does changing each weight change the loss?"
Nudge the weight in the direction that reduces loss. Repeat 1000 times.

### Gradient Descent Update

```python
learning_rate = 0.001
W1 -= learning_rate * dW1   # move weights downhill
W2 -= learning_rate * dW2
```

This is IDENTICAL to what you learned in Phase 1 for linear regression.
The difference: more weights, more layers, more data.

---

## Why This Matters for LLMs

A Transformer (GPT, Claude) is:
- Many layers of: attention (weighted sum over all tokens) + feedforward (MLP)
- Trained with: same gradient descent, same backpropagation
- Loss function: predict the next token (cross-entropy)

The math is the same. The scale is different (billions of weights vs dozens).

---

## Done When

- [ ] 3-layer numpy neural net written from scratch — no sklearn
- [ ] It trains and loss goes down over epochs
- [ ] `/neural-predict` endpoint returns expense forecast
- [ ] You can explain backpropagation without looking at notes
