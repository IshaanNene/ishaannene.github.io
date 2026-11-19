---
title: Understanding Distributed Systems
slug: understanding-distributed-systems
category: blogs
date: 2026-09-14
excerpt: Clocks lie, networks partition and every node is a liar until proven otherwise. A field guide to reasoning about systems you cannot see all at once.
tags: [distributed-systems, consensus, reliability]
featured: true
visual:
  material: stone
  typography: engraved-serif
  objectType: slab
  placement: auto
---

A distributed system is one in which the failure of a computer you didn't even know existed can render your own computer unusable. Everything else in this essay is commentary on that sentence.

## The three lies

1. **The network is reliable.** It is not. Packets are dropped, duplicated and reordered.
2. **Latency is zero.** Every hop costs time, and the tail is where users live.
3. **There is one clock.** There are as many clocks as there are machines, and they disagree.

## Thinking in histories

Instead of asking *what is the state?*, ask *which histories are possible?* Linearizability, sequential consistency and eventual consistency are simply different answers to which interleavings you are willing to show a client.

```txt
client A: write(x=1) ─────┐
client B:        read(x) ─┴─> 0 or 1?
```

## Practical rules

- Make operations idempotent, then retry freely.
- Put deadlines on everything; propagate them.
- Prefer a few well-understood primitives (a log, a lease, a fencing token) over clever protocols.

*Placeholder article — replace with your own writing.*
