---
title: StegaNet
date: 2026-03-01
subtitle: Steganography over sockets, in C
excerpt: Hide text, images and audio inside images and audio, and exchange them over TCP.
tags: [c, networking, cryptography]
links:
  - { label: GitHub, href: https://github.com/IshaanNene/StegaNet }
---
- Image steganography across the R, G and B channels and audio steganography with LSB manipulation.
- AES-256-CBC payload encryption and CRC32 integrity checks.
- Length-prefixed messages over TCP with keep-alive pings, timeouts and latency measurement.
- A Raylib UI kept off the networking threads through a shared, mutex-guarded app state.
