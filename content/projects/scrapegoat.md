---
title: ScrapeGoat
date: 2026-09-06
subtitle: A web crawler for Go, and an MCP server, in one binary
excerpt: Point it at a URL and get structured data, write a spider in 30 lines, or let an agent do the fetching.
tags: [go, crawling, mcp]
links:
  - { label: GitHub, href: https://github.com/IshaanNene/ScrapeGoat }
---
`scrapegoat extract <url>` returns structured JSON with no selectors or config: it finds listings by structure (repeated sibling elements that mostly contain a price and a link) rather than by class names.

`scrapegoat crawl` writes a corpus with depth, concurrency and domain limits; the same crawler is importable as a Go library and runs as an MCP server for Claude or Cursor.
