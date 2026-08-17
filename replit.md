# Mizaan Properties

A public real-estate marketplace and no-login operator desk for browsing and managing builds, apartments, and sale-only land listings.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Wouter, TanStack React Query
- API: Express 5
- DB: MongoDB Atlas via the official MongoDB driver
- Validation: OpenAPI-generated Zod schemas plus server-side business-rule validation
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/real-estate-hub/` — public marketplace, property detail pages, dashboard, and listing forms
- `artifacts/api-server/` — Express API and MongoDB connection/CRUD routes
- `lib/api-spec/openapi.yaml` — source of truth for listing and summary API contracts
- `lib/api-client-react/` and `lib/api-zod/` — generated client hooks and validation schemas

## Architecture decisions

- No authentication is used, matching the brief; the dashboard is intentionally an operator surface without accounts.
- MongoDB Atlas is the source of truth for listings; the API maps MongoDB ObjectIds to stable string ids for the client.
- Land sale-only behavior is enforced twice: the UI removes rent controls and the API rejects invalid category/listing-type combinations.
- Listing images are stored as validated HTTP(S) URLs to keep the first version lightweight and avoid introducing file storage before it is needed.

## Product

- Public browsing with search, category filters, sale/rent filters, property cards, and detail pages.
- Dashboard summary counts, searchable inventory, create/edit/delete flows, confirmation before deletion, and responsive mobile layouts.
- Rental listings require a monthly or yearly period; land listings can never include rental metadata.

## User preferences

- Keep the product login-free for now.

## Gotchas

- `MONGODB_URI` must contain a real Atlas connection string, not the `<db_password>` placeholder. Password characters must be URL-encoded.
- Atlas `mongodb+srv://` connection strings must not include a port number.
- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
