# Expense React

React browser client for the Spring household expense API.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS 4
- shadcn/ui (Nova) + Lucide icons
- React Router
- i18next (`en` / `my`) with localStorage language preference
- Light / dark / system theme (`expense_theme` in localStorage; `dark` class on `html`)
- Session + CSRF calls to the Spring API (`credentials: 'include'`)

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Open the local Vite URL (default `http://localhost:5173`).

The default setup keeps `VITE_API_BASE_URL` empty so the browser calls same-origin
`/api/v1/...`. Vite proxies `/api` to `VITE_DEV_API_PROXY_TARGET`
(default `http://localhost:8080`) and removes the browser `Origin` header on those
proxied requests. That keeps local Vite (`http://localhost:5173`) working against a
stock Spring API whose credentialed CORS allow-list is only `:4200`.

If you set an absolute `VITE_API_BASE_URL` (cross-origin, no Vite proxy), add the
Vite origin to Spring `expense.cors.allowed-origins` or browser calls will fail CORS.

Local API process: run `expense-api` (documented under the private `expense-spring`
context) on port 8080 with Postgres. Copy `.env.example` to `.env` — no secrets live
in those Vite variables; session login uses your local household admin password.

### Environment

| Variable | Description |
| --- | --- |
| `VITE_API_BASE_URL` | Optional absolute API origin. Leave empty for same-origin `/api` requests. |
| `VITE_DEV_API_PROXY_TARGET` | Spring API origin used only by the Vite dev proxy. |

Do not commit `.env` or real secrets. `.env.example` is the committed template.

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript project build check |
| `npm run lint` | Run oxlint |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run Playwright smoke e2e (build + preview locally) |
| `npm run test:e2e:ui` | Open the Playwright UI runner |

Unit tests use Vitest + Testing Library with mocked network calls. They cover API
client helpers, auth route gates, accounts list rendering, the home dashboard
summary, and period reports.

Smoke e2e uses Playwright against the Vite preview server (Chromium). Specs live
under `e2e/` and assert the app boots and the login page renders — no credentials
or live API required. First local run may need `npx playwright install chromium`.

## App routes

| Area | Path | Notes |
| --- | --- | --- |
| Sign in | `/login` | Guest only |
| Change password | `/change-password` | Required when the API sets `mustChangePassword` |
| Dashboard | `/` | Household summary from the reports API |
| Accounts | `/accounts` | Live account list from the API |
| Expenses | `/expenses` | Posted expenses list and form |
| Transfers | `/transfers` | Account-to-account moves (create / void) |
| Reports | `/reports` | Period analytics from the reports API |
| Members | `/members` | Household member admin (roles / status) |
| Settings | `/settings` | Language + session |

## API contract used in this slice

- `GET /api/v1/auth/csrf`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `PUT /api/v1/password`
- `GET /api/v1/household`
- `GET /api/v1/households/{householdId}/accounts`
- `GET /api/v1/households/{householdId}/transfers`
- `POST /api/v1/households/{householdId}/transfers`
- `POST /api/v1/households/{householdId}/transfers/{transferId}/void`
- `GET /api/v1/households/{householdId}/reports/dashboard`
- `GET /api/v1/households/{householdId}/reports/analytics`

Auth is cookie-session based (`expense-session`). Unsafe requests send the CSRF
header returned by the bootstrap endpoint. After login, password change, or logout,
the client refreshes or clears CSRF state.

## Localization

- English (`en`) and Myanmar / Burmese (`my`)
- Language switcher in the top bar and Settings
- Preference key: `expense_lang` in `localStorage`
- Money display uses Western digits, for example `1,000 MMK`

## Scope notes

This slice covers env-based API wiring, session auth, forced password change, and
the accounts list. Expense create/list and other financial writes remain follow-up work.
