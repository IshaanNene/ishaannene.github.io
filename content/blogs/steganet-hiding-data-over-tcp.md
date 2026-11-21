---
title: "StegaNet: hiding data in images and audio over TCP"
date: 2026-03-02
excerpt: "A C application that encrypts a payload, hides it in least significant bits and sends it over a socket."
tags: [c, steganography, networking]
links:
  - { label: StegaNet on GitHub, href: https://github.com/IshaanNene/StegaNet }
---
StegaNet hides text, images and audio inside images and audio, then exchanges the carriers between peers over TCP.

## The payload

Any message can optionally be encrypted with **AES-256-CBC** (via OpenSSL), and every packet carries a **CRC32** checksum, so corruption is detected rather than decoded into garbage.

## Hiding it

- **Images:** up to 4 KB written across the R, G and B channels.
- **Audio:** bits are written with least-significant-bit manipulation of the samples.

## Moving it

Messages are length-prefixed over TCP, with keep-alive pings, timeouts and latency measurement. The Raylib UI runs apart from the networking threads and shares a mutex-guarded application state, and writes leveled rolling logs for observation.
