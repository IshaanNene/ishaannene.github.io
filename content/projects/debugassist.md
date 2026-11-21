---
title: DebugAssist
date: 2026-11-07
subtitle: An autonomous on-call engineer
excerpt: Crash or bug report in; triage, an evidence-backed root cause, a failing test, the fix and a pull request out.
tags: [python, agents, langgraph, mcp]
links:
  - { label: GitHub, href: https://github.com/IshaanNene/DebugAssist }
  - { label: Website, href: https://ishaannene.github.io/DebugAssist/ }
---
DebugAssist investigates bugs in a ride-hailing app end to end.

- **Decisions** (priority, root-cause category, rollback, test tier, PR or draft) come from 18 Cloudflare Clef decision templates.
- **Reasoning:** agents query 11 MCP servers (crash analytics, logs, traces, metrics, flags, git history, code search and more) and write a root cause in which every claim cites evidence.
- **Action:** the plan is a fixed LangGraph graph; agents work in a network-less Docker sandbox on a git worktree.

It is evaluated on a catalog of 25 injected bugs, scored against an answer key the agent never sees.
