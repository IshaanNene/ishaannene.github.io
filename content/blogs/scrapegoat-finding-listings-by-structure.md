---
title: "ScrapeGoat: finding listings by structure"
date: 2026-09-07
excerpt: "Extraction without selectors, a crawler that refreshes cheaply, and a threat model for fetching URLs someone else chose."
tags: [go, crawling, security, mcp]
links:
  - { label: ScrapeGoat on GitHub, href: https://github.com/IshaanNene/ScrapeGoat }
---
ScrapeGoat is a Go crawler that ships as a CLI, a library, an MCP server and a REST API from one binary.

## Extraction without selectors

`scrapegoat extract <url>` returns structured JSON with no configuration. Instead of guessing at class names it looks for **repeated sibling elements that mostly contain a price and a link**, so it works on markup nobody anticipated. Progress goes to stderr and JSON to stdout, so the output pipes straight into `jq`.

## Crawling and provenance

The crawler has a priority frontier, per-domain rate limits, a circuit breaker, jittered backoff, `robots.txt` and sitemap discovery, and checkpoint resume. Output is a corpus of observations and derived claims (JSONL or Parquet), and every value records the method that produced it and the byte range of its source. `--since` re-checks a corpus with conditional requests, so unchanged pages cost a header exchange rather than a download.

## Security for a crawler

A crawler fetches URLs someone else chose, which is the whole threat model. Outbound requests are blocked after DNS from loopback, private, link-local (including cloud metadata) and CGNAT ranges; the guard dials the address it validated, so DNS rebinding does not work; every redirect hop is re-checked; and bodies are capped after decompression so a gzip bomb cannot exhaust memory.

## Keeping the core small

SEO auditing, change detection and graph export live in `contrib/`, out of the binary. Unwired features were deleted rather than left looking finished: if it is in the feature table, it runs.
