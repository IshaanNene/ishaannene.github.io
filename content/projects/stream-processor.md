---
title: Tidewater Stream Processor
slug: tidewater
date: 2026-08-20
excerpt: A low-latency stream processing engine with exactly-once sinks and a SQL front end.
tags: [rust, streaming, databases]
featured: true
subtitle: Exactly-once streaming in Rust
links:
  - { label: Source, href: "https://github.com/IshaanNene" }
visual:
  material: metal
  typography: embossed-sans
  objectType: plaque
---

Tidewater ingests events from Kafka-compatible logs, maintains incremental state in an embedded LSM tree and commits outputs transactionally.

## Highlights

- Watermark-driven windowing with late-data side outputs
- Checkpoint barriers aligned with sink transactions
- 2.1M events/s per core on the reference benchmark

*Placeholder project.*
