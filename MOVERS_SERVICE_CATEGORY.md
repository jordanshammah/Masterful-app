Movers - Service Category (Client-Facing Documentation)
Purpose

Introduce a new service category named "Movers" for moving and relocation services (household and office moves). This document provides the exact details the client team needs to consume the new category and update UI, routing, or filtering logic.

Database changes performed

Inserted a new row into the existing table public.service_categories:
id: 5
name: Movers
description: Moving and relocation services (household and office moves).
icon_url: https://example.com/icons/movers.png
created_at: 2026-01-16T19:07:21.464934Z
Created a client-facing view:
Name: public.service_categories_public
Columns exposed: id, name, icon_url
Purpose: explicit, minimal API contract for client consumption
Permissions:
Table-level RLS: existing policy "service_categories_select" allows public SELECT (Definition: true).
Granted SELECT on the view to role anon to make API exposure explicit.

Why this approach

Exposing only id, name, and icon_url avoids leaking backend-only fields (e.g., internal descriptions or metadata) and simplifies client integration.
Retaining table-level policies but adding an explicit view + grant makes the public API stable and clearer to auditors and frontend engineers.
Using ON CONFLICT semantics for insertion prevents duplicate categories if the operation is retried.

Client API details (what the client team needs)

REST (PostgREST) endpoint to fetch categories:
GET /service_categories_public
Response Content-Type: application/json
Returned fields per item:
id (integer) - category identifier (use this to map jobs/providers)
name (string) - display name (e.g., "Movers")
icon_url (string) - URL of the category icon (replace with CDN/asset URL as needed)
Example response: [ { "id": 1, "name": "Plumbing", "icon_url": "https://cdn.example.com/icons/plumbing.png" }, { "id": 5, "name": "Movers", "icon_url": "https://example.com/icons/movers.png" } ]
Supabase client example:
supabase.from('service_categories_public').select('id,name,icon_url')
The anon role has SELECT permission; no auth required for read-only category listing.
GraphQL or other API: map the view to your GraphQL schema or call the REST endpoint above.

UI/UX guidance for the client team

Add "Movers" as a selectable category in category lists, filters, and job creation screens.
Use icon_url for category icons; prefer cached CDN assets to avoid UI latency.
When creating jobs or provider profiles:
Send category_id = 5 (or use the id returned at runtime if categories differ between environments)
Validate client-side that category_id exists by refreshing categories at app start or caching them with a TTL.
If categories are localized in the UI, translate the display name "Movers" on the client side (the DB record currently holds the English name only).

Backend / Integration notes for the client team

Use the view service_categories_public as the canonical read endpoint to avoid changes if table schema evolves.
When creating or updating providers/jobs, write to the existing job/provider endpoints using the numeric category_id that corresponds to the category record.
To avoid mismatches across environments (dev/stage/prod), ensure your deployment/seed process creates the same categories (id or name-based reconciliation). Prefer name-based lookups in migrations (e.g., find category by name then use its id) to avoid environment-specific id drift.

Security & RLS notes (for ops/devs)

Current configuration:
Table policy "service_categories_select" grants public SELECT (true). This means anonymous clients can list categories.
Explicit GRANT SELECT ON view public.service_categories_public TO anon was applied for clarity.
If you later restrict anonymous access to categories:
Keep the view and grant SELECT to roles that should read categories, or
Create role-based views (e.g., service_categories_public, service_categories_internal) and manage grants accordingly.

Operational suggestions

Replace the placeholder icon URL with a CDN-hosted asset or signed storage URL:
Store icons in your approved storage bucket (e.g., Supabase Storage or Cloud CDN) and update icon_url.
Add a monitoring/alerting rule for unexpected deletions or modifications to service_categories (critical for matching existing jobs/providers).
Consider adding a translations table if you require localized category names in the future.
Seed the same categories across environments; prefer migration scripts that upsert by name:
Example (conceptual): INSERT INTO service_categories (name, description, icon_url) VALUES (...) ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, icon_url = EXCLUDED.icon_url;

How to test (QA checklist)

Client can GET /service_categories_public and see the "Movers" item in the list.
When creating a job or provider in the app and selecting "Movers", the server persists the category_id and the job/provider lists correctly filter by category.
Confirm the icon_url loads correctly in the UI and displays at the intended resolution.
Ensure repeated calls to the insertion script do not create duplicates (idempotency).
Verify behavior after revoking table-level anonymous SELECT - confirm view-based grant continues to work if you prefer that model.

Contact points / next steps

If you want me to:
Replace the placeholder icon_url with a storage-hosted icon and update the DB record.
Add translations/localized names and a new view that returns localized strings based on a locale parameter/user preference.
Provide a migration script that seeds categories (idempotent across environments).
Create a GraphQL resolver or example client code snippets for the mobile/web app.

Prepared by

Supabase/Postgres team (performed insertion, created view, and configured grants)
Date

2026-01-16
