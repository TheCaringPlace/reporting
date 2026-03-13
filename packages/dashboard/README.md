# The Caring Place Dashboard

An interactive dashboard for visualizing consolidated report data. Built with Preact and client-side routing.

## Project structure

```
dashboard/
├── index.html          # SPA entry
├── styles.css          # Shared styles
├── data/               # JSON data (copied by prebuild from parser)
│   ├── service-report.json
│   ├── financials.json
│   └── current-year-financials.json
├── src/
│   ├── main.jsx        # App entry, Router
│   ├── components/     # Layout, Card, Chart, etc.
│   ├── pages/          # Index, Financials, BudgetTracker, etc.
│   └── lib/            # utils, charts, expense-per-household
└── dist/               # Build output
```

**Routes:** `/` (home), `/financials`, `/budget-tracker`, `/service-report`, `/service-expenses`

## Run locally


```bash
npm install
cd dashboard
npm run dev
```

The dashboard opens at [http://localhost:5173](http://localhost:5173).

## Build for deployment

```bash
npm run build
```
## Preview production build

```bash
npm run preview
```

## Deploy with SST (password-protected)

From the project root, deploy to AWS with HTTP Basic Auth:

```bash
# 1. Ensure parser reports exist
cd parser && npm run build && cd ..

# 2. Set auth credentials
npx sst secret set USERNAME your-username
npx sst secret set PASSWORD your-password

# 3. Deploy
npm run deploy
```

The deployed URL is shown after deploy. The browser will prompt for username and password.
