---
title: Adaptive Consistency for Geo-Replicated Stores
date: 2026-06-30
excerpt: Switching consistency levels per key based on observed contention reduces p99 write latency by 38%.
tags: [databases, consistency, paper]
featured: true
subtitle: Preprint · 2026
---

## Abstract

We present a geo-replicated key-value store that selects between linearizable and causal consistency per key at runtime, using a contention estimator fed by conflict telemetry.

## Method

1. Estimate per-key conflict probability with a count-min sketch.
2. Promote hot keys to a consensus group; demote cold keys to CRDT replication.

*Placeholder research entry.*
