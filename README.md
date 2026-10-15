# Equipment Booking — Front end

Standalone browser repository for the equipment booking system. Built with React, Vite, and TypeScript; the sibling `../eqmnt-bokng-sys-be` owns the NestJS API and PostgreSQL database.

## Current foundation

- Accessible, responsive starter screen that describes the three planned workflows.
- Feature folders for equipment, personal reservations, and administration.
- Shared API request/error boundary, browser configuration, and public contract types.
- An explicit API liveness check against `GET /api/v1/health`.
- Strict TypeScript, ESLint, Prettier, Playwright smoke tests, and an npm lockfile.

Authentication, real equipment data, reservation commands, and administrative actions are future work. The starter does not create sample bookings or grant a role. A successful liveness check says the API process is available; it does not verify database readiness or completion of booking features.

## Requirements and setup

Use Node.js **22.18.0** (a newer compatible Node 22 or Node 24 release is also supported) and npm **10.9.3+**. `.nvmrc` records the starting version.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Open **http://127.0.0.1:5173**. Start the sibling back end separately on port **3000** when checking connectivity. The default `VITE_API_BASE_URL=/api/v1` and Vite's `/api` proxy connect development requests to `http://localhost:3000`.

Every `VITE_` value is public browser configuration. Never put passwords, database URLs, session secrets, or identity-provider secrets here. A production host should serve `/api` through the same site to the API; Vite's development proxy is not included in the static build. Authentication and its CSRF/origin integration will be implemented together with the API.

## Commands

| Command               | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `npm run dev`         | Start Vite on port 5173                            |
| `npm run check`       | Formatting, lint, and both TypeScript projects     |
| `npm run lint`        | ESLint with zero warnings                          |
| `npm run typecheck`   | Type checking independently of transpilation       |
| `npm run format`      | Format editable source and documentation           |
| `npm run build`       | Type check and produce `dist/`                     |
| `npm run preview`     | Inspect the static production build locally        |
| `npm run test:e2e`    | Run browser smoke tests; starts Vite automatically |
| `npm run test:e2e:ui` | Open Playwright's interactive runner               |

For browser tests, install the matching Chromium once:

```powershell
npx playwright install chromium
npm run test:e2e
```

Smoke tests cover keyboard access to the main content, visible project scope, the browser's time-zone label, and API liveness success/failure. They stub only the health response and do not claim to verify booking workflows. Future critical journeys require the real API and disposable PostgreSQL data.

## Source map and responsibility

```text
src/
  features/
    equipment/       Catalog, detail, availability, timezone selection
    reservations/    Confirmation, personal history, eligible cancellation
    admin/           Team reservations, catalog maintenance, handovers
  shared/
    api/             HTTP boundary, safe errors, connection status
    config/          Public browser environment
    types/           Public API contracts; no decorated server DTO imports
  App.tsx            Starter composition
  styles.css         Responsive foundation styles and focus treatment
tests/e2e/           Playwright smoke tests
docs/
  implementation-plan.md
```

The API remains authoritative for identity, permissions, time, booking uniqueness, state transitions, and activity history. Client state must never substitute for those guarantees. Front-end responsibility is to make the workflows accessible, preserve the selected server-provided UTC slot, reuse creation request keys on uncertain retries, explain conflicts, and refresh server data after commands.

See [the front-end plan](docs/implementation-plan.md) for screens, integration details, milestones, and acceptance checks. [The original specification](PROJECT_1_EQUIPMENT_BOOKING_SYSTEM.md) is retained unchanged.

## Version choices

Initialized with React/React DOM **19.3.1**, Vite **8.3.4**, `@vitejs/plugin-react` **6.1.2**, TypeScript **5.9.3**, ESLint **10.12.0**, and Playwright **1.64.1**. Exact direct versions and `package-lock.json` make installation reproducible.

Versions and peer compatibility were checked against the npm registry on 15 October 2026. TypeScript 5.9.3 is deliberate: the selected `typescript-eslint` accepts TypeScript `>=4.8.4 <6.1.0`, so the current TypeScript 7 release is outside its supported range. Vite's [official getting started guide](https://vite.dev/guide/) requires Node 20.19+ or 22.12+; this project's Node 22.18 baseline satisfies that requirement. See also [React versions](https://react.dev/versions).

## Git

This folder is an independent Git repository on `main`. `node_modules`, build output, test artifacts, and local environment files are ignored. Commit source, documentation, and the lockfile before pushing a new branch; an initial branch needs at least one commit. Use `git remote -v` to inspect the configured GitHub destination.
