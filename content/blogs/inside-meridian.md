---
title: "Inside Meridian: an issue tracker built like a production system"
date: 2026-11-19
excerpt: "How Meridian keeps tenants apart, never loses an event, and what a single-laptop load test showed."
tags: [rust, architecture, multi-tenancy, kafka]
featured: true
links:
  - { label: Meridian on GitHub, href: https://github.com/IshaanNene/Jira }
---
Meridian is a Jira-style tracker whose goal is the whole system behind the UI rather than the UI alone. This write-up walks through the parts that make it more than a clone.

## The request path

The React app talks to an **Envoy gateway** that checks the JWT, applies rate limits and routes. Behind it sit the request-path services (identity, tenant, user, permission, project, workflow, issue and agile), which expose REST with Axum on the outside and gRPC between each other. Each service is a library crate with its own binary, so integration tests run in process and the release is one shared build.

## Tenancy below the application

The tenant comes only from the signed token's claim. Every transaction sets `app.tenant_id`, and PostgreSQL row-level security (forced, one database per service) applies the same isolation rule whether a tenant has a shared or a dedicated database. A bug in a query cannot read another tenant's rows.

## Events that are never lost

A status change shows the pattern: the issue service asks the workflow service whether the move is allowed, then writes the update, its history row and an **outbox** row in one transaction. A relay publishes the outbox to Kafka, and consumers re-index search (OpenSearch), push live hints over Redis Streams, send notifications and record analytics facts in ClickHouse. Live clients can resume after a reconnect; a detected gap forces a resync.

## Measured, not claimed

An autocannon stress test on a three-node kind cluster, on one laptop:

| Load | p50 | p99 | Failed |
|---|---|---|---|
| Reads at 1,000/s | 7 ms | 70 ms | 0 |
| Reads, no rate cap (2,959/s served) | 58 ms | 178 ms | 96 of 88,829 |
| Writes, no rate cap (1,799/s served) | 102 ms | 310 ms | 0 of 35,967 |

The services were not the first thing to saturate; the query engines were. After the uncapped write burst Kafka delivered all ~40,000 events to search and analytics. These are single-machine numbers, not a capacity claim.

## Where it stands

Phases 0 to 7 (identity through dashboards, including MQL, SSO, SCIM, automation and integrations) are built and verified. The operations phase is partly done: signed images, Helm, Argo CD manifests, CI and observability exist, but nothing has been applied to a cloud cluster yet.
