---
title: "DebugAssist: evidence before fixes"
date: 2026-11-08
excerpt: "An autonomous on-call pipeline, how it is kept safe, and what its evaluation does and doesn't show."
tags: [agents, llm, evaluation, security]
links:
  - { label: DebugAssist on GitHub, href: https://github.com/IshaanNene/DebugAssist }
  - { label: Website, href: https://ishaannene.github.io/DebugAssist/ }
---
DebugAssist takes a crash or bug report from a small ride-hailing app (MiniRide) and runs it to a pull request with no human in the loop.

## The pipeline

A fixed LangGraph graph: **ingest → triage → context → root cause → mitigate → reproduce → fix → validate → ship gate → PR**. Every step is checkpointed, so a run can resume from any node.

- **Context** is a deterministic evidence bundle from MCP servers: the crash group, flag-to-crash correlation, logs, traces, commits in the window and the code at the crash site.
- **Root cause** is structured (mechanism, location, suspect commit, timeline), and each claim must cite evidence.
- **Mitigate** runs a two-proportion z-test between flag-exposed and unexposed sessions and proposes a rollback behind a policy gate.
- **Reproduce** may only write tests, and the test must fail on the shipped release. **Fix** then freezes that test and makes the smallest source change that passes it, the suite and the repo's lint.

## Guardrails

Agents run in `docker run --network none` on a per-run git worktree with a read-only `.git`. Every external write (PR, comment, Jira, chat, flag) goes through a policy file and the audit log. Bug reports, logs and commit messages are treated as data, never instructions, with 32 injection payloads in the tests.

## Results, with caveats

On 25 injected catalog bugs, three seeds each, the root cause was right or close in **80%** of runs, exact in **65%**, and hidden tests passed on **80%** of fixes, at a median of **$0.014** a run. It still stops where a symptom surfaced instead of following a failed call into the service it called, and some fixes are narrower than the regression.

The decision layer (Cloudflare Clef) is **not measured yet**: every recorded call fell back to the LLM decider, so for now its value is auditability, not accuracy. The bugs are synthetic and written by the same author as the agent's skills, so the numbers show strengths and gaps rather than real-world rates.
