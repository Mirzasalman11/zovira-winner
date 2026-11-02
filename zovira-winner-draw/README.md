# Zovira Winner Draw (Next.js)

Upload a CSV / Excel orders file (drag & drop) and pick a winner with a gift-box animation.
Everything runs in the browser — no backend, no database, no separate server.

## Run locally
```bash
npm install
npm run dev        # http://localhost:3000
```

## Production
```bash
npm run build
npm start
```

## Rules
- Customer ID = name + phone (last 10 digits)
- 1 token per 1000 of each order total (rounded down; the step is editable in the UI)
- Odds are proportional to tokens; the pick uses `crypto.getRandomValues`
- Columns (name, phone, total, status) are auto-detected; cancelled/failed/refunded rows are skipped

## Structure
- `app/page.tsx` – UI, gift animation, confetti, drag & drop
- `lib/draw.ts` – file parsing, token calculation, random pick
- `lib/sample.ts` – built-in sample orders (replace or delete as needed)
- `app/globals.css` – styles & theme variables (colours are at the top of the file)
