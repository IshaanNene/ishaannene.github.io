---
title: Notes on Ownership and Borrowing
date: 2026-05-19
excerpt: What Rust's borrow checker taught me about API design in every other language.
tags: [rust, languages, api-design]
---

Ownership is not a Rust feature; it is a property of every program. Rust merely makes you write it down.

## Aliasing XOR mutation

The core rule — many readers or one writer — is the same rule your database uses for locks and your team uses for documents.

*Placeholder article.*
