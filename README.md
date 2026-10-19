# Expense React

React client shell for a household expense tracker.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS 4
- shadcn/ui (Nova) + Lucide icons
- React Router
- i18next (`en` / `my`) with localStorage language preference

## Quick start

```bash
npm install
npm run dev
```

Open the local Vite URL (default `http://localhost:5173`).

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript project build check |
| `npm run lint` | Run oxlint |

## App routes

| Area | Path |
| --- | --- |
| Dashboard | `/` |
| Expenses | `/expenses` |
| Accounts | `/accounts` |
| Settings | `/settings` |
| Sign in | `/login` |

## Localization

- English (`en`) and Myanmar / Burmese (`my`)
- Language switcher in the top bar and Settings
- Preference key: `expense_lang` in `localStorage`

## UI components

shadcn/ui is initialized with the Nova preset. Shared primitives live under `src/components/ui`. Add more with:

```bash
npx shadcn@latest add <component>
```

## Scope notes

This repository currently provides a focused client scaffold: layout, navigation, Lucide icons, bilingual UI strings, shadcn primitives, and placeholder screens. API auth and financial feature slices are intentionally left for follow-up work.
