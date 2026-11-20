---
title: Designing for Failure
date: 2026-07-02
excerpt: Resilience is not a feature you add at the end. It is the shape of the system from the first diagram.
tags: [architecture, reliability]
featured: true
---

Every system fails. The only question is whether it fails in a way you designed.

## Blast radius first

Draw the dependency graph and ask, for every edge: *if this disappears for ten minutes, who notices?* Cells, bulkheads and shuffle sharding are all tools for shrinking the answer.

## Degrade, don't die

A search page without personalisation is still a search page. Decide in advance which features are load-bearing and which are decoration.

*Placeholder article.*
