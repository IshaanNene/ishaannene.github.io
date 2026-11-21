---
title: "A chess platform as a distributed system"
date: 2026-07-20
excerpt: "Why Alekhine's Counter-Gambit splits a chess game across Go services, Erlang actors and Kafka."
tags: [go, erlang, distributed-systems, grpc]
links:
  - { label: Alekhine's Counter-Gambit on GitHub, href: https://github.com/IshaanNene/AlekhinesCounter-Gambit }
---
Most chess apps are one process wrapped around a chess library. Alekhine's Counter-Gambit treats chess as the vehicle for a real-time, multiplayer, compute-backed system.

## The requirements

- Rules enforced **on the server**; the client is never trusted.
- Moves persisted and streamed live to both players and any number of spectators.
- Engine analysis that never blocks play, and asynchronous post-game analysis.
- Clocks that can never flag-fall a decided game, and ratings that update exactly once.

## How it is split

- **`pkg/chess`** generates legal moves, verified by perft (197,281 nodes to depth 4 from the start position, plus Kiwipete and endgame positions).
- **`engine-worker`** drives Stockfish over UCI behind a gRPC `Analyze` API.
- **`game-service`** validates moves, persists to Postgres and orchestrates the engine.
- **`session-manager`**, in Erlang/OTP, runs one supervised `gen_server` per live game, owning Fischer clocks, turn, presence and reconnect grace. Killing one game never touches another. The game service closes the session on checkmate, stalemate or draw.
- **`gateway`**, Go with gqlgen, is a stateless GraphQL API. `Game.clock` is a lazy resolver, so the session manager is only asked when a client selects it. Subscriptions over WebSocket push every move with no polling.

## Status

The foundation (playing Stockfish end to end over real gRPC services, persisted to Postgres) and the real-time core (Erlang sessions, GraphQL, live subscriptions, a web client, auth) are complete. Next steps move fan-out to Redis so it survives multiple gateway replicas.
