# Expense React

Track household accounts, expenses, transfers, and reports in the browser.

[![CI](https://github.com/nayzawoo/expense-react/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/nayzawoo/expense-react/actions/workflows/ci.yml?query=branch%3Amain)
[![GitHub last commit](https://img.shields.io/github/last-commit/nayzawoo/expense-react/main)](https://github.com/nayzawoo/expense-react/commits/main)

## Features

- Accounts and balance adjustments
- Expenses and transfers
- Dashboard and reports with charts
- Categories and members
- English and Myanmar, with light and dark themes

## Quick start

Copy the example environment file, install dependencies, and start the app:

```bash
cp .env.example .env
npm install
npm run dev
```

Requires a running backend API. Set its URL in `.env`, using `.env.example` as a reference.

Category icons include the original semantic choices and the full Lucide 1.59.0
catalog (2,159 names including aliases). The picker supports name search and loads
icons on demand, with a bounded grid and a Show more control. Additional icon keys
use `lucide:<kebab-case-name>`; deploy the API catalog support before using them.

Signed-in members can change their own password from Settings using their current
password. Successful changes revoke existing sessions and require sign-in again.
This does not provide an unauthenticated forgot-password recovery flow.
