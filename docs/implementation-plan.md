# Front-end implementation plan

## Goal and ownership

Deliver the browser experience for a single team reserving one physical item for one future one-hour slot. This repository owns accessible UI, interaction state, display time zones, API integration, and browser acceptance tests. The back end owns authentication validation, actor resolution, authorization, authoritative action times, transactions, database invariants, and business activity events.

The specification's suggested `apps/web` layout is adapted to this independent repository's `src/`. Feature boundaries remain the same. Do not import sibling source files, database models, or decorated DTO classes. Once endpoints exist, generate or synchronize public request/response types from versioned OpenAPI; review contract changes in both repositories.

The current implementation is a foundation screen and liveness connection check. Everything below describes planned work.

## Screens and feature boundaries

| Feature / screen       | Browser responsibilities                                                                                                                    | API dependencies                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Session shell          | Sign-in/out with the selected established integration, expiry recovery, actor display, role-aware navigation; preserve safe return location | Authentication integration and `GET /me`                                      |
| Catalog                | Labelled name search, category filter, active item cards, bounded pagination; loading/empty/error states; cancel stale searches             | `GET /equipment`                                                              |
| Item details           | Public description, availability for at most seven UTC days per response, selected IANA time zone, keyboard-selectable server slots         | `GET /equipment/:id`, `GET /equipment/:id/availability`                       |
| Confirmation           | Item, one-hour interval, explicit time-zone name, UTC-backed selection; pending state, retry outcome recovery, conflict explanation         | `POST /reservations`                                                          |
| My reservations        | Upcoming/history views with stable pagination; show stored state plus derived missed/overdue label; eligible cancellation                   | `GET /reservations`, `GET /reservations/:id`, `POST /reservations/:id/cancel` |
| Team reservations      | Admin route guard, bounded state/date filters, reason entry, legal-state checkout/return controls; explain blocked custody                  | `GET /admin/reservations`, reservation cancel/checkout/return commands        |
| Catalog administration | Required item fields, descriptive edits, active/inactive views, activation/deactivation; explain unresolved bookings                        | Equipment create/edit/activate/deactivate commands                            |

A route guard is a usability measure. Server authorization must still apply to every request. The initialization screen explains planned administration without rendering live administrative controls.

## API boundary

- Common base: `/api/v1`. Local Vite port: 5173; local API port: 3000. The `/api` development proxy keeps browser calls on one origin. Production must configure its own reverse proxy.
- Public health endpoints are `GET /api/v1/health` (liveness) and `GET /api/v1/health/ready` (database readiness). Swagger is `/api/docs`. The current UI checks only liveness.
- Protected equipment/reservation calls require the established authenticated session. Align session cookies and CSRF/origin protection with the chosen identity integration; do not invent browser-trusted roles or owner IDs.
- Use the shared request boundary for `Accept`, credentials, error parsing, and cancellation. Add endpoint adapters that validate/map the actual public contract when each API route lands. Avoid guessed reservation response types.
- Lists use the API's stable cursor/order and page size capped at 50. Preserve search/filter context through pagination. Availability exposes booleans without another member's identity.
- Use a dedicated query/cache approach only when real server state justifies it; centralize invalidation and prevent stale responses from overwriting a newer selection. Do not cache protected data across sign-out or actor changes.
- Verify field-level validation response shape together with the API. Associate each error with its input and include a safe request ID for support.

## Creation request keys and uncertain outcomes

1. Start a booking attempt from the selected immutable equipment ID and the exact UTC `slotStart` returned by availability.
2. Generate one UUID `Idempotency-Key` for that attempt, before submission. Send only `{ equipmentId, slotStart }`; the server derives duration and owner.
3. Disable repeat submission while pending. Keep the key and canonical payload through network failures. A retry of this attempt must use the same key even after a page refresh; implement a minimal recoverable attempt record before enabling booking.
4. Persist no session secret in that recovery record. Scope attempts to the signed-in actor, clear unrelated protected state at sign-out, and check the authenticated API result before presenting success.
5. Treat first success `201` and matching replay `200` as the same booking. Replays may return the current cancelled/returned representation; never recreate it automatically.
6. On an uncertain response, retry with the same key or retrieve a known reservation ID. Do not mark a booking confirmed until the server confirms it. Do not silently mint a new key.
7. On `SLOT_UNAVAILABLE`, refresh availability while keeping the item, date, time zone, and relevant context. A genuinely changed selection or intentionally new booking begins a new attempt/key; do not reuse a key with different inputs.
8. On `IDEMPOTENCY_KEY_REUSED`, explain the conflict and recover the original attempt where possible. Do not loop an automatic retry or silently mutate its payload.

## Time and reservation presentation

- Persist selected display time zone as an IANA identifier; initialize from the browser and always display its name beside slots, confirmation, and history.
- Send the original server-provided UTC value with a `Z` suffix, aligned to a full UTC hour. Never round a user-entered local time or derive a new UTC value from a formatted label. The server supplies valid availability slots and the exact one-hour duration.
- Fetch availability in bounded UTC ranges, up to seven days at a time within the 30-day horizon. A local day and a UTC day can differ, especially around daylight saving changes; generate/display ranges accordingly and test a known UTC fixture in multiple zones.
- The server's action time decides future/start/end rules. The browser clock and countdowns are display aids. Account for server-time information from the agreed API contract when deriving labels; refresh near boundaries and on focus.
- Stored states are `reserved`, `checkedOut`, `cancelled`, and `returned`. `missed` means reserved after end; `overdue` means checked out after end. They are display labels, not mutation states.
- Cancellation is available to an owner before start, with administrator cancellation requiring a reason. Checkout is administrative, from start inclusive to end exclusive; return is administrative and remains possible after end.
- An overdue checkout can block the next physical checkout while leaving that later reservation valid. Explain the condition without silently cancelling either reservation.

## Error and refresh behavior

| API outcome                   | UI response                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `400 VALIDATION_FAILED`       | Preserve safe input, connect field errors, focus error summary                                        |
| `401 AUTHENTICATION_REQUIRED` | Clear protected caches, recover session through agreed integration, retain only safe workflow context |
| `403 ADMIN_REQUIRED`          | Explain lack of permission and refresh actor/navigation; never infer a role from form input           |
| `404 RESERVATION_NOT_FOUND`   | Same absent/unavailable message for missing and inaccessible records                                  |
| `409 SLOT_UNAVAILABLE`        | Explain a competing booking; refresh slots and preserve context                                       |
| `409 INVALID_TRANSITION`      | Refresh current reservation and expose only its legal next actions                                    |
| `409 EQUIPMENT_UNAVAILABLE`   | Refresh item/custody state and explain the unavailable action                                         |
| `409 EXISTING_BOOKINGS`       | Explain why deactivation is blocked; let administrators resolve bookings                              |
| `409 IDEMPOTENCY_KEY_REUSED`  | Stop automatic retries; recover the original submission context                                       |
| Network/timeout/5xx           | Safe actionable message and request ID when available; retain creation key on uncertain writes        |

After successful create/cancel/checkout/return, refresh the affected reservation, relevant lists, and equipment availability. Refresh catalog status after activation/deactivation. On page reload, retrieve the current server view. Do not model arbitrary status assignment or treat optimistic state as completed physical handover.

## Accessibility and interaction checks

- Semantic landmarks/headings, visible focus, skip navigation, labelled controls, keyboard-operable slots, and adequate contrast.
- Field errors use `aria-describedby`; error summaries link to inputs. Announce success/failure without moving focus unnecessarily. Restore focus after modal confirmation and action completion.
- Pending/disabled states explain why an action is unavailable; cancellation reasons are bounded and required for administrative actions. Deactivation never implies deletion of history.
- Each data screen handles loading, empty, failure, stale conflict, and recoverable retry. Search and pagination preserve focus and filter context.
- Test narrow layouts, long equipment names, longer error text, selected time-zone visibility, and keyboard completion of the main journey.

## Milestones and completion evidence

| Milestone                | Front-end deliverables                                                                                                            | Evidence / integration dependency                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation (initialized) | React/Vite/TS, feature folders, API boundary, strict checks, responsive scope screen, liveness check, Playwright setup            | `npm run check`, production build, smoke tests; no booking claims                                                                                    |
| 1 — First working slice  | Three screen sketches, real catalog/detail, selected timezone and slot, confirmation with durable request key                     | Seeded member creates one future booking through real authentication/API; backend proves competing claim rejection                                   |
| 2 — Main workflows       | Search/filter/pagination, personal history/cancel, team filters, admin catalog, checkout/return                                   | Member → admin checkout → return → member history; every screen has empty/error/pending states                                                       |
| 3 — Correctness UX       | Conflict recovery, same-key retry after lost response/cancellation, state-aware actions, role/ownership failures, time boundaries | Two-browser competing booking, expired session, inaccessible ID, overdue custody block, refresh recovery; PostgreSQL invariants remain backend tests |
| 4 — Release verification | Real API Playwright journeys, known UTC timezone fixtures, CI checks and static deployment setup                                  | Search/reserve, cancel, admin handover, race, reload, and keyboard journeys on reproducible data                                                     |
| 5 — Handoff              | Accessibility review, clear messages, setup/hosting notes, demo and recovery instructions                                         | Another developer runs both repositories and explains browser retry behavior, timezone display, and permission boundaries                            |

The original specification budgets the entire product at 60 hours plus contingency. These are shared milestones, not an additional front-end estimate. Authentication provider choice, generated contract tooling, CI provider, and deployment target remain implementation decisions for later work.

## Deferred scope

Payments, recurring/variable-duration bookings, multi-item carts, calendars, notifications, attachments, waitlists, and multi-organization tenancy remain outside the first release. Activity history is server-owned; do not invent a public activity endpoint or audit screen without extending the contract.
