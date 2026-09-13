---
name: OpenAPI codegen constraints (orval)
description: Two non-obvious rules the api-spec → api-zod/api-client-react pipeline enforces; violating either breaks `pnpm --filter @workspace/api-spec run codegen`.
---

## Never mix path parameters and query parameters on the same operation

**Rule:** an operation may have path params *or* query params, not both.

**Why:** for a query-only operation orval names the zod schema
`<OperationIdPascal>QueryParams`, but when path params are also present it emits
a combined `<OperationIdPascal>Params` const — which collides with the
identically named TypeScript type in `generated/types`. `lib/api-zod/src/index.ts`
re-exports both with `export *`, so the build fails with TS2308 ("has already
exported a member named ...").

**How to apply:** when an endpoint needs a resource id *and* filters, put the id
in the query string too (`GET /availability?practitionerId=...&from=...`) rather
than nesting it in the path. Path params are fine alongside a request body.

## orval emits zod v4 syntax against a zod v3 package

**Rule:** generated zod files must import from `zod/v4`, not `zod`.

**Why:** orval v8 generates `zod.int()` / `zod.uuid()`, which only exist in zod
v4. The workspace catalog pins zod 3.25.x, which ships v4 behind the `zod/v4`
subpath. Without the rewrite every generated schema fails to typecheck.

**How to apply:** the `codegen` script runs `lib/api-spec/scripts/postprocess.mjs`
after orval to rewrite the import. Keep that step in the pipeline — orval's
`clean: true` wipes the generated folder on every run, so the fix must be a
build step, never a hand edit.
