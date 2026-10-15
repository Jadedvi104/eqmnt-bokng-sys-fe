# Project 1 Equipment booking system

## Purpose and expected outcome

Build a full-stack application that lets a small team reserve shared equipment, then record its checkout and return. Use **React and Vite for the browser, NestJS for the API, and PostgreSQL with Drizzle for persistence**.

The project develops mid-level engineering skills: turn business rules into a domain model, organize a NestJS application, enforce permissions, protect data under concurrent requests, and deliver a usable deployed product. The central completion test is that twenty competing requests for one free slot produce exactly one reservation.

**Estimated effort:** 60 hours of planned work, with up to 20 hours for fixes and unfamiliar tooling. At ten hours per week, allow six to eight weeks. This estimate assumes the shared development foundation is ready. If starting from scratch, add 12–20 hours for setup, authentication integration, CI, and deployment foundations. If NestJS is new, add a further 8–12 hours for its basic concepts.

**Final deliverables:** a working application, migrations and seed data, automated acceptance tests, an API contract, deployment and recovery instructions, two architecture decisions, and a short demonstration of concurrency and permission behavior.

## Product scope

### Users and their workflows

**Member:** find an item, inspect its availability, book a future one-hour slot, view personal reservations, and cancel an eligible reservation.

**Administrator:** maintain the equipment catalog, review reservations, cancel a reserved booking with a reason, and record checkout and return. Administrators may also make their own reservations as members.

The first release supports one team. Each equipment record represents one physical item, such as one camera with its own asset tag. A reservation covers exactly one item and one one-hour slot.

### Required capabilities

- Sign in and sign out using an established authentication library or identity provider.
- Search equipment by name and filter by category.
- Display available slots in the user's selected time zone.
- Create and list reservations, with understandable conflict and validation errors.
- Cancel reservations according to ownership, state, and time rules.
- Record administrative checkout and return.
- Create, edit, activate, and deactivate catalog items.
- Retain reservation history and record important actions in an activity log.

### Boundaries of the first release

Defer payments, recurring bookings, variable booking durations, multiple-item carts, external calendars, notifications, attachments, waitlists, and organization tenancy. Equipment is deactivated rather than deleted. A missed booking requires no scheduled job; an administrator can cancel it manually.

## Technology and repository setup

| Area | Choice | Implementation goal |
|---|---|---|
| Browser | React, Vite, TypeScript | Accessible catalog, forms, and reservation views |
| API | NestJS with the default Express adapter | Controllers, feature modules, dependency injection, and services |
| Validation | DTO classes, class-validator, class-transformer, ValidationPipe | Reject invalid or unexpected request data |
| Database | PostgreSQL and Drizzle | Explicit constraints, transactions, and reviewed migrations |
| API contract | OpenAPI through @nestjs/swagger | Document actual request and response behavior |
| Backend tests | @nestjs/testing, Vitest with a Nest-compatible compiler transform, Supertest | Verify service wiring and HTTP behavior |
| Browser tests | Playwright | Verify critical workflows in a real browser |
| Local dependencies | A disposable PostgreSQL container | Repeatable development and integration tests |

Choose supported, compatible package versions and commit the lockfile. Follow the compiler and testing configuration for the selected Nest version. In particular, preserve decorator metadata in backend builds and tests. Run type checking separately from execution or transpilation. The official [Nest testing guide](https://docs.nestjs.com/fundamentals/testing) and [compiler recipe](https://docs.nestjs.com/recipes/swc) describe the relevant setup.

Use separate browser and API TypeScript configurations. Enable `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`. Keep `experimentalDecorators` and `emitDecoratorMetadata` in the API configuration where required by the chosen Nest build. Keep database credentials and decorated server DTOs out of browser imports.

```text
apps/
  web/src/
    features/equipment/
    features/reservations/
    features/admin/
    shared/
  api/src/
    main.ts
    app.module.ts
    common/                 # guards, filters, pipes, and request context
    auth/                   # identity integration and actor resolution
    database/               # Drizzle client provider and migrations
    equipment/              # module, controller, DTOs, and service
    reservations/           # module, controller, DTOs, and service
    activity/               # activity recording provider
packages/
  domain/                   # pure state and policy functions
  contracts/                # public types and generated OpenAPI output
docs/
  decisions/
  runbook.md
  evidence/
```

## Booking and time rules

Treat the following as the initial product specification. Changing one requires updating its tests and API contract.

1. The server accepts an ISO 8601 slot start with a UTC `Z` suffix. It must align to a full UTC hour. The server derives the end as exactly one hour later; the client does not choose a duration.
2. A slot is a half-open interval: its start is included and its end is excluded. Adjacent slots do not overlap.
3. New bookings start strictly after authoritative server time and no more than 30 days ahead. Validate time again inside the write transaction after acquiring the necessary locks.
4. Store instants as PostgreSQL `timestamptz`. The UI displays the time zone beside the selected slot and sends the server-provided UTC value back on submission.
5. An item must be active when a new reservation is committed. An availability response is a view of current data, not a guarantee that a later write succeeds.
6. At most one active reservation can claim an item and slot. The active states are `reserved` and `checkedOut`.
7. An item can have only one reservation in `checkedOut` state at a time, including across different slots. An overdue checkout blocks the next physical checkout until return is recorded.
8. The reservation owner, equipment item, and slot are immutable. Rescheduling means cancelling an eligible booking and creating another.
9. Deactivation fails while the item has an unexpired reserved booking or any checked-out booking. The administrator must resolve those bookings first. Deactivation never silently cancels history.
10. Capture action times on the server. Browser clocks are used only for display.

Display **missed** when a reservation remains `reserved` after its end. Display **overdue** when it remains `checkedOut` after its end. These are derived labels, not additional stored states. Historical missed reservations do not block a different future slot.

## Reservation lifecycle and permissions

| Command | Current state | Result | Who may act | Additional condition |
|---|---|---|---|---|
| Create | No reservation | reserved | Signed-in member or administrator | Item active; future valid slot; no conflicting claim |
| Cancel | reserved | cancelled | Owner or administrator | Owner acts before start; administrator supplies a reason |
| Checkout | reserved | checkedOut | Administrator | Start reached; end not reached; item active; no existing checkout |
| Return | checkedOut | returned | Administrator | Allowed before or after the scheduled end |

`returned` and `cancelled` are terminal states. They cannot be reopened. Do not allow a generic endpoint that lets callers assign an arbitrary status.

Repeated cancellation of an already cancelled reservation returns its current representation without another activity event. Repeated checkout while it is already checked out, and repeated return while it is already returned, behave similarly. A command against an incompatible state returns a conflict. Authorization is checked before returning any representation, including on repeated requests.

For example, replaying checkout after the reservation has already been returned is a conflict; it must not check the item out again. This simple repeat behavior does not promise replay of every historical command outcome.

| Operation | Member | Administrator |
|---|---|---|
| Read active equipment and availability | Allowed | Allowed |
| Create a personal reservation | Allowed | Allowed |
| List personal reservations | Allowed | Allowed |
| Read another member's reservation | Denied | Allowed |
| Cancel a personal reserved booking | Before slot start | Allowed with reason |
| Cancel another member's reserved booking | Denied | Allowed with reason |
| Checkout or return equipment | Denied | Allowed |
| Maintain catalog and view team reservations | Denied | Allowed |

Resolve the actor from the authenticated session. Never accept a trusted owner ID or role from the request body. Return `404` for reservation IDs that are absent or inaccessible to the caller, and `403` for an authenticated member attempting an administrator-only operation.

## NestJS architecture

Use a modular monolith with one API process and one database. Every module has a defined responsibility.

| Module | Responsibility | Main exports |
|---|---|---|
| AuthModule | Integrate identity, resolve actor, enforce authenticated routes | Authentication guard and actor resolver |
| DatabaseModule | Own one managed database pool and Drizzle client | Database injection token/provider |
| EquipmentModule | Catalog queries and administrative item commands | Equipment application service |
| ReservationsModule | Booking queries, commands, policies, and transactions | Reservation application service |
| ActivityModule | Record business actions in the caller's transaction | Activity recording provider |

A controller accepts validated input, calls an application service, and maps the result to a public response. The application service checks resource permissions, applies domain rules, and coordinates the transaction. Pure functions in the domain package decide legal state transitions without knowing about Nest or HTTP.

```text
React screen
    |
Nest authentication guard
    |
DTO validation and controller
    |
Application service
    |-- actor and resource policy
    |-- state and time rules
    |-- short database transaction
    |
PostgreSQL constraints and activity records
```

Use concrete DTO class imports where Nest needs runtime metadata. Configure a global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`. Parse booleans and numbers explicitly and define whether each optional field permits `null`. Request validation does not validate response objects; map and test those separately. See [Nest validation](https://docs.nestjs.com/techniques/validation).

Guards establish identity and coarse route permissions. Application services still check ownership and administrative authority for the resource. Pass the actor explicitly; do not place the current user in a singleton service field. Register global configuration through a reusable bootstrap function so the test application has the same validation, guards, and filters as production.

## Data model and database guarantees

Use UUID identifiers, explicit foreign keys, and server-generated timestamps. Avoid deleting users or equipment referenced by reservation history.

| Record | Important fields | Constraints and purpose |
|---|---|---|
| User | id, identitySubject, displayName, role | Unique identity subject; member or administrator role |
| Equipment | id, assetTag, name, category, description, isActive, createdAt, updatedAt | Unique asset tag; required name; catalog status |
| Reservation | id, equipmentId, ownerId, slotStart, slotEnd, status, createRequestKey, createdAt, checkedOutAt, returnedAt, cancelledAt, cancellationReason | Foreign keys; valid state; valid one-hour slot; lifecycle timestamps; unique owner/request key |
| ActivityLog | id, actorId, equipmentId, reservationId, action, occurredAt, reason | Append-only application behavior; correlate successful actions with business records |

The roadmap's **slot claim** is represented here by the active reservation itself. A partial unique index protects active item/slot claims, keeping the fixed-slot model small:

```sql
CREATE UNIQUE INDEX reservations_active_slot_unique
ON reservations (equipment_id, slot_start)
WHERE status IN ('reserved', 'checkedOut');

CREATE UNIQUE INDEX reservations_single_checkout_unique
ON reservations (equipment_id)
WHERE status = 'checkedOut';
```

Also enforce the following with named constraints where possible:

- `slotEnd` equals `slotStart` plus one hour, and the start aligns to a UTC hour.
- State belongs to the four allowed values.
- Reserved bookings have no cancellation, checkout, or return timestamp.
- Cancelled bookings have a cancellation timestamp and no checkout/return timestamp.
- Checked-out bookings have a checkout timestamp and no return/cancellation timestamp.
- Returned bookings have both checkout and return timestamps, no cancellation timestamp, and return is not before checkout.
- `(ownerId, createRequestKey)` is unique for creation retries.

Do not put the current time into a uniqueness predicate or depend on a cleanup job to free future availability. The state determines whether a reservation claims its original slot; the write-time policy prevents creating past bookings. A checked-out item retains physical custody until an explicit return.

Add indexes that support the actual queries, initially personal reservations by owner/start and administrative reservations by status/start. Inspect query plans before adding more. PostgreSQL documents [constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) and [partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html).

## Transactions and competing actions

All item-affecting commands use the same lock order: **equipment first, then reservation**. Keep transactions short and make no external network calls while holding database locks.

### Creating a reservation

1. Resolve the actor and validate the request shape.
2. Look up an existing reservation for the actor and creation request key. If found, compare the original item/slot inputs and return it or a key-reuse conflict.
3. Begin a transaction and lock the equipment row for update.
4. Recheck the actor/key pair using a fresh read after acquiring the lock. Another request may have committed while this request waited. Resolve a matching replay before applying new-booking eligibility rules, even if the original slot has now started or the item was later deactivated.
5. Read database action time with `clock_timestamp()` after the lock is acquired. Recheck item activity, slot alignment, future time, and booking horizon.
6. Insert the reserved booking with its creation request key. The unique index decides whether the slot is still available.
7. Insert a booking-created activity event in the same transaction and commit.
8. Return the public reservation response. If creation hits a uniqueness violation, roll back and resolve creation-key replay before mapping a remaining named slot conflict to `409 SLOT_UNAVAILABLE`.

Concurrent requests can both miss the preliminary key lookup, and either the owner/key constraint or slot index may report the collision. After any creation uniqueness failure, roll back before looking up the owner/key pair in a new valid transaction. If it exists, compare canonical item/slot inputs and return the original booking or a key-reuse conflict. Otherwise map the named constraint failure to the relevant domain error. Never return a half-committed record or continue using an aborted transaction.

Use PostgreSQL's default Read Committed isolation for this lock-based design, so the post-lock lookup can see another committed request. `now()` and `CURRENT_TIMESTAMP` are fixed at transaction start and can be stale after a lock wait; `clock_timestamp()` supplies the current action time. See [PostgreSQL date and time functions](https://www.postgresql.org/docs/current/functions-datetime.html).

### Cancelling checkout returning and deactivating

For an existing booking, determine its immutable equipment ID, lock that equipment row, then lock and re-read the booking. Check authorization, current state, and action time from `clock_timestamp()` inside the transaction. Apply the command and its activity event atomically. Deactivation locks the same equipment row before checking for blocking reservations and changing item status.

This protocol makes cancellation versus checkout and booking versus deactivation produce a legal ordered outcome. All API instances must use it. The database uniqueness indexes remain an independent defense against duplicate claims and duplicate physical checkout. See [PostgreSQL row locking](https://www.postgresql.org/docs/current/explicit-locking.html).

If a previous booking is overdue, the next reservation remains valid as a reservation, but its checkout is blocked until the earlier item is returned. Show a clear administrative message instead of silently cancelling or rewriting either record.

## HTTP API contract

Use `/api/v1` as a common prefix. All equipment and reservation operations require authentication. Publish request/response DTOs, status codes, pagination, and examples in OpenAPI.

| Method and route | Behavior | Access |
|---|---|---|
| GET /me | Current actor and role | Signed-in user |
| GET /equipment | Search and filter active items with bounded pagination | Signed-in user |
| GET /equipment/:id | Public catalog details | Signed-in user; inactive items restricted to administrators |
| GET /equipment/:id/availability | Slot list for a bounded UTC range | Signed-in user |
| POST /reservations | Create one reservation with Idempotency-Key header | Signed-in user |
| GET /reservations | Paginated personal reservations | Signed-in user |
| GET /reservations/:id | One reservation | Owner or administrator |
| POST /reservations/:id/cancel | Cancel according to state/time policy | Owner or administrator |
| POST /reservations/:id/checkout | Record physical checkout | Administrator |
| POST /reservations/:id/return | Record physical return | Administrator |
| GET /admin/reservations | Paginated team bookings with status/date filters | Administrator |
| POST /equipment | Create an equipment item | Administrator |
| PATCH /equipment/:id | Edit allowed descriptive fields | Administrator |
| POST /equipment/:id/deactivate | Deactivate after checking blocking bookings | Administrator |
| POST /equipment/:id/activate | Make an item bookable again | Administrator |

The creation body contains only `equipmentId` and `slotStart`. The required `Idempotency-Key` is a client-generated UUID reused for retries of that one submission. A first successful creation returns `201`; a matching replay returns `200` with the same reservation ID and current representation. Reusing a key with different item/slot inputs returns `409 IDEMPOTENCY_KEY_REUSED`.

Retain the key with reservation history. Retrying a cancelled booking must return that cancelled booking; making a genuinely new booking requires a new key. Do not silently generate a new key when automatically retrying a failed network request.

Limit list page size, for example to 50, and order by a stable pair such as `(slotStart, id)`. Bound availability requests to at most seven days per response and the supported 30-day booking horizon. Return availability booleans without exposing another member's identity or reservation details.

### Error behavior

| HTTP status | Example code | Meaning |
|---|---|---|
| 400 | VALIDATION_FAILED | Invalid timestamp, UUID, field, query, or unsupported request shape |
| 401 | AUTHENTICATION_REQUIRED | Missing or expired authenticated session |
| 403 | ADMIN_REQUIRED | Signed-in member attempted an administrator operation |
| 404 | RESERVATION_NOT_FOUND | Reservation absent or inaccessible to this actor |
| 409 | SLOT_UNAVAILABLE | Another active reservation already claims the slot |
| 409 | INVALID_TRANSITION | Current state or action time does not permit the command |
| 409 | EQUIPMENT_UNAVAILABLE | Item is inactive or already physically checked out |
| 409 | EXISTING_BOOKINGS | Deactivation blocked by unresolved reservations |
| 409 | IDEMPOTENCY_KEY_REUSED | Creation key was already used for different inputs |

Use a stable error envelope with `code`, a safe `message`, and `requestId`; add field errors for validation where useful. Unexpected failures return a generic server error while details remain in redacted logs. Cancellation requires a nonempty reason for administrative actions; bound its length in the DTO.

## Browser screens and behavior

| Screen | Main content | Important behavior |
|---|---|---|
| Catalog | Search, category, equipment list | Loading, empty, error, and pagination states |
| Equipment details | Item details, timezone, available slots | A conflict refreshes availability and keeps the user's context |
| Reservation confirmation | Item, local time, UTC-backed slot, submit action | One request key per submission; pending state prevents accidental resubmission |
| My reservations | Upcoming and historical bookings | Eligible cancellation; visible missed/overdue labels |
| Team reservations | Filters and administrative actions | State-aware checkout/return controls; reason required for cancellation |
| Equipment administration | Item form and active status | Deactivation explains blocking bookings |

Use semantic form labels, keyboard-operable controls, a visible focus indicator, and field errors connected to their inputs. Announce important success/failure messages accessibly. Show the selected time zone in confirmation and history views.

The API remains the authority when the page is stale. After a successful command, refresh the affected reservation and availability data. On an uncertain network outcome, retry with the same creation key or retrieve the result; do not optimistically show an unconfirmed booking as successful. A page refresh must recover the current view from the server.

## Build milestones

### Milestone 1 Model and first working slice

**Budget: 8 hours.** Write the product brief, permission matrix, state rules, and three initial screen sketches. Create the database migration and seed users/items. Wire the Nest feature modules, one create DTO, one booking transaction, and one browser form.

**Checkpoint:** a seeded member can reserve a future slot through the browser, and the database rejects an independently attempted competing active claim. Document the first decision: why the slot uniqueness rule belongs in the database.

### Milestone 2 Complete the main workflows

**Budget: 18 hours.** Implement catalog search, availability, personal history, cancellation, administrative item management, checkout, return, and team booking filters. Add public response mappings and OpenAPI descriptions. Use established authentication integration and server-resolved actors.

**Checkpoint:** a member creates a booking; an administrator checks the item out and records its return; the member can see the final history. Every workflow has a visible validation, empty, or failure state where relevant.

### Milestone 3 Prove correctness and permissions

**Budget: 16 hours.** Implement consistent locking, request-key replay, lifecycle timestamp constraints, deactivation rules, the single-checkout constraint, and transactional activity events. Test role and ownership boundaries, boundary times, competing commands, and lost-response retries.

**Checkpoint:** all correctness scenarios in the verification section pass against PostgreSQL. Record the second decision: the chosen locking strategy and its cost for concurrent requests on one item.

### Milestone 4 Verify and deploy

**Budget: 12 hours.** Complete representative Nest HTTP tests and browser journeys, inspect important query plans, configure CI, deploy behind TLS, and rehearse migration and backup restoration. Ensure the test bootstrap applies production validation and error handling.

**Checkpoint:** a clean environment can run the migrations, seed the demo, pass the critical tests, and start the application from the documented instructions.

### Milestone 5 Review and handoff

**Budget: 6 hours.** Review keyboard use and time-zone presentation, remove confusing error messages, finish the runbook, record the demonstration, and write a short retrospective.

**Checkpoint:** another developer can run the system and explain its concurrency guarantee, permission boundaries, and recovery procedure using the documentation.

The five milestones total **60 hours**. Use the additional **20-hour contingency** for actual gaps and defects. Defer optional features until all required acceptance checks pass.

## Verification plan

### Domain and database tests

Test pure state transitions, ownership policies, and time-boundary decisions independently from HTTP. Integration tests must use a real disposable PostgreSQL database with applied migrations and more than one connection for races.

| Scenario | Required result |
|---|---|
| Twenty competing creates with different request keys for one free slot | One 201, nineteen slot conflicts, one active reservation |
| Twenty concurrent creates with the same key and inputs | One reservation ID and one row; replays refer to it |
| Same key used with another slot or item | Key-reuse conflict; no second booking |
| Creation retry after cancellation | Original cancelled booking returned; no recreation |
| Same-key request waits behind creation until the original slot starts | Post-lock key recheck returns the original booking instead of rejecting it as a new past booking |
| Independent duplicate active-slot insert | Database uniqueness violation |
| Adjacent slots | Both can be reserved |
| Two physical checkouts on one item across different slots | At most one checked-out row |
| Booking versus deactivation | A legal ordered outcome; never an inactive item with a newly accepted unresolved booking |
| Cancellation versus checkout | One legal resulting state with matching timestamps and activity history |
| Return versus the next checkout | Legal ordering; no simultaneous physical custody |
| Invalid intermediate transaction | Rollback leaves neither a partial booking nor an orphan activity event |

For concurrency tests, coordinate request starts, use a connection pool that permits contention, and assert final database invariants. Avoid depending on sleeps or assuming a particular command wins a race.

Test times immediately before, at, and after start/end. Creation at or after start fails; checkout at start succeeds and at end fails; return after end succeeds. Use a controllable application-time boundary and a consistent database-time seam in tests rather than changing the machine clock. Include a transaction that waits across a time boundary before rechecking eligibility.

### Nest HTTP and permission tests

- Create the test application with real feature modules and the same global setup as production.
- Reject unknown fields, malformed UUIDs, non-hour-aligned slots, unsupported query values, and disallowed nulls.
- A member cannot read or cancel another member's booking by changing an ID.
- A member cannot invoke checkout, return, or catalog administration.
- Missing/expired sessions fail before protected data is returned.
- Request body owner/role fields cannot change the actor; they are rejected as unexpected data.
- Repeated allowed commands do not create extra activity events.
- Responses omit identity-provider internals, credentials, and private session data.
- Authentication and authorization are not replaced with always-allow test guards in security tests.

### Browser journeys

Use Playwright for the critical paths: search and reserve; cancel a personal reservation; complete administrative checkout and return; resolve a booking conflict between two browsers; refresh and recover the current booking view; complete the main flow with a keyboard. Include at least one timezone display check using known UTC fixtures.

## Delivery and operating instructions

### Environment and startup

Document the required Node/package-manager versions, installation command, database startup, configuration values, migration command, seed command, development commands, and production build/start commands. Provide an example environment file with placeholder values only.

Validate required configuration before starting the API. Use one managed database pool per process and close it on shutdown. Keep production secrets out of source control, logs, OpenAPI examples, and browser bundles.

### Release and database changes

CI should run formatting/lint checks, API/browser type checking, domain and PostgreSQL integration tests, representative browser tests, and production builds. Release one migration step at a time through a controlled migration runner; do not have every API replica independently alter the schema during startup.

Review migration SQL and test it on representative data. Prefer additive changes. If a release fails, roll back application code when it remains compatible with the database. Do not assume a destructive reverse migration is safe. Rehearse backup restoration into a fresh database and verify sample reservations and activity history.

### Authentication and diagnostics

Serve the browser and API under one site where practical. Use TLS, secure session cookies, and the authentication integration's CSRF/origin protections. Protect administrator routes on the server, rate-limit sensitive entry points, and set bounded query/body sizes.

Log a request ID, route, duration, status, safe actor identifier, and stable error code. Do not log cookies, credentials, or full sensitive request bodies. Keep the activity log as business history rather than treating diagnostic logs as the source of booking truth.

Provide liveness and database-readiness checks. The runbook should explain how to trace a failed booking by request ID, distinguish a normal slot conflict from a server error, diagnose an overdue item, apply a migration, and restore data. Avoid promising uptime or scale that has not been measured.

## Completion checklist

- [ ] Required member and administrator workflows work in a deployed or reproducible local demo.
- [ ] All four states, time rules, and command replay behaviors are documented and tested.
- [ ] Concurrent booking and checkout tests preserve the database invariants.
- [ ] Ownership and administrator boundaries are enforced through the real HTTP application.
- [ ] UTC storage and user-visible timezone presentation agree on known fixtures.
- [ ] Migrations, seed data, setup, API contract, and operating instructions are complete.
- [ ] A clean environment can run the application and critical tests.
- [ ] A backup restoration rehearsal succeeds.
- [ ] The main flow works by keyboard with understandable error states.
- [ ] Two decision records explain database uniqueness and transaction locking.
- [ ] A short demonstration shows normal booking, a concurrency conflict, unauthorized access rejection, and checkout/return.
- [ ] The retrospective identifies one wrong assumption, one important tradeoff, and one evidence-based improvement.

## Optional extensions after completion

Choose one extension with a clear learning goal: arbitrary time ranges with overlap constraints, an administrative no-show action, or a modest measured performance exercise. Estimate and plan it separately. Keep the first release focused on correctness, useful workflows, and an understandable NestJS implementation.

## Technical references

The domain rules, limits, effort estimates, and API choices above are project design decisions. Framework and database behavior should be checked against the selected versions using these primary references:

- [NestJS modules](https://docs.nestjs.com/modules)
- [NestJS custom providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [NestJS validation](https://docs.nestjs.com/techniques/validation)
- [NestJS authorization](https://docs.nestjs.com/security/authorization)
- [NestJS testing](https://docs.nestjs.com/fundamentals/testing)
- [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction)
- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL date and time functions](https://www.postgresql.org/docs/current/functions-datetime.html)
- [Drizzle transactions](https://orm.drizzle.team/docs/transactions)

Prepared on 15 October 2026.
