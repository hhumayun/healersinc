---
name: Keeping the OpenAPI spec and the Express server in lockstep
description: Failure modes seen when the generated client and the server drift, and the guards that catch them.
---

## Paths drift silently

The generated client calls exactly what the spec says; a hand-written Express
route that spells the path differently produces a 404 that looks like a UI bug.
Nothing in the type system catches it.

**How to apply:** after adding or renaming routes, diff every path in the spec
against the paths the router registers, and treat any mismatch as a bug in the
server (the spec is the contract the client is generated from).

## Generated zod turns a missing query param into the string "undefined"

Query params compiled to `z.coerce.string()` accept a missing value and coerce
it to `"undefined"`, which then reaches the database layer and throws an opaque
driver error (e.g. drizzle "Invalid time value") as a 500.

**Why:** coercion happens before any required-ness check the caller assumes.

**How to apply:** validate date and range query params explicitly in the route
(a shared require-calendar-day/range helper) and answer 400, rather than trusting
the generated schema to reject a missing value.

## Server-side rules must be time-aware, not just status-aware

Checking only `status` lets an API caller cancel or reschedule a session that
has already ended, or complete one that has not finished. The UI hides those
buttons, but the UI is not the authority. Guard against `endsAt` in the route.

## A `format: date-time` query param generates a schema that can never pass

The generator emits `z.date()` for such a parameter, but a query value is
always a string, so every request carrying it answers 400 -- including the
paging cursor of an endpoint that otherwise looks implemented.

**How to apply:** pull instant/date query params out of `req.query` with an
explicit parser before handing the rest to the generated schema, and exercise
each optional query param at least once with a real request -- a param the UI
never sent is a param that was never validated.

## A documented cursor that the route ignores is a silent data cap

An endpoint that accepts `before` but never filters on it returns the same
first page forever; past the page size, newer (or older) rows become
unreachable through the API even though they are stored.

**How to apply:** when a list endpoint documents a cursor, seed more than one
page of rows and walk at least three pages, asserting the pages are disjoint
and ordered, before calling the feature done.
