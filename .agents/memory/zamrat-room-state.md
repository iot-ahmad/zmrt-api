---
name: Zamrat room state
description: Durable constraints around the first multiplayer implementation.
---

The first multiplayer version keeps room state in the API process and uses polling from the web client; this is intentional for a no-account MVP, not a production-scale persistence strategy.

**Why:** The user wanted frictionless rooms without sign-in, and the first usable build needed no database setup while preserving real room actions across browser sessions.

**How to apply:** If Zamrat needs deployment across multiple server instances, reconnect-after-restart behavior, or durable room history, replace the in-memory room store and polling contract with shared storage plus a realtime transport.