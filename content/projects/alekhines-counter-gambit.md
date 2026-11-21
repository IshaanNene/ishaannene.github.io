---
title: "Alekhine's Counter-Gambit"
date: 2026-07-19
subtitle: A distributed chess platform
excerpt: Play Stockfish or a friend live, on Go and Erlang services over gRPC and Kafka, running on Kubernetes.
tags: [go, erlang, grpc, kubernetes]
links:
  - { label: GitHub, href: https://github.com/IshaanNene/AlekhinesCounter-Gambit }
---
Chess is the vehicle; the point is the production system around it. Moves are validated on the server, persisted and streamed live to players and spectators over WebSockets. Engine analysis runs without blocking play, and finished games are analysed asynchronously by a Kafka-fed worker pool.

- Gateway, game service, engine workers, analysis workers and fan-out in Go; clustered session actors in Erlang/OTP.
- PostgreSQL, Redis Streams, Kafka and MinIO for state and events; GraphQL for the client.
- Kubernetes with Helm and Terraform, GitOps through ArgoCD, and Prometheus, Grafana and Jaeger for observability.
