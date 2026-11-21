---
title: Meridian
date: 2026-11-18
featured: true
subtitle: A multi-tenant project tracker in the style of Jira
excerpt: "Twelve Rust microservices behind a React app: boards, sprints, workflows, search, live updates and dashboards."
tags: [rust, microservices, kafka, postgres]
links:
  - { label: GitHub, href: https://github.com/IshaanNene/Jira }
  - { label: Product site, href: https://ishaannene.github.io/Jira/ }
---
Meridian rebuilds the whole system behind an issue tracker, not just its UI.

- **Multi-tenancy:** the tenant comes only from a signed token, and PostgreSQL row-level security enforces it underneath the application code.
- **Events:** every write lands in a transactional outbox and flows through Kafka into search (OpenSearch), notifications, live updates and analytics (ClickHouse).
- **Product:** issues with custom fields, Scrum and Kanban boards, a visual workflow designer, a query language (MQL) compiled on the server, dashboards, SSO with OIDC/SAML and SCIM.
- **Operations:** Axum and Tonic services, distroless images, a Helm chart, Terraform for AWS, CI with vulnerability scans, Prometheus alerts, and load and failure tests.
