# ShieldNex Email Deliverability Checker

A DNS-only bulk email routing checker built for the ShieldNex Aerospace internship task. It accepts pasted addresses and explains whether each address is structurally invalid, has no usable mail routing, or remains unverified.

## What it does

- Parses up to 100 unique pasted email addresses.
- Validates safe, conventional email structure and IDNA-normalizes domains.
- Looks up MX records and recognizes null MX (`MX .`).
- Uses A/AAAA direct-mail fallback only when MX is absent.
- Returns `likely_bounce` only for invalid structure, nonexistent domains, null MX, or confirmed absence of mail routing.
- Returns `unknown` for valid mail-capable domains, DNS timeouts, temporary resolver failures, and unsupported internationalized local parts.

## Important limitations

This application does **not** verify that a specific mailbox exists, and it does **not** guarantee delivery. MX records only establish that a domain appears capable of accepting mail. The deployed Vercel Function is intentionally DNS-only: it never attempts SMTP recipient probing and never sends email.

## Architecture

One Node.js/Express service serves the compiled React/Vite frontend and exposes:

- `GET /health` → `{ "ok": true, "mode": "dns-only" }`
- `POST /api/check` → bulk result data

No database, authentication system, external verification API, or SMTP client is used. Domain-routing outcomes are cached in memory for ten minutes; full submitted email addresses are neither persisted nor logged.

## Local setup

Requires Node.js 24.x LTS for local verification and deployment. The project pins `24.x` in `package.json`; Vercel supplies the latest patch release in that major line.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The frontend proxies API requests to Express on port 3001.

```bash
npm test
npm run build
npm start
```

The production server uses `PORT` when supplied, otherwise port 3001.

## API

```http
POST /api/check
Content-Type: application/json

{ "input": "alex@example.com\ninvalid@@example" }
```

The response contains one result per unique normalized address plus category counts and `duplicatesRemoved`. Input is limited to 20 KB and 100 unique addresses. The service limits callers to 30 batch requests per 10 minutes, limits DNS work to ten concurrent addresses, and applies a three-second DNS-operation timeout.

## Privacy and safety

- No submitted address is stored in a database or written to application logs.
- The server accepts only email text; users cannot select DNS servers, hosts, ports, or SMTP commands.
- No outbound SMTP connection is made and the application never reaches an email `DATA` stage.
- DNS errors are treated as `unknown`, never as proof an address is invalid.

## Single-project Vercel deployment

GitHub repository: https://github.com/Jude-00-05/shieldnex-email-checker

Create one Vercel project from the public GitHub repository. The project contains one Express Function and the Vite static output, so the browser and API use one origin.

Manual project settings:

- Framework preset: `Express` (the repository's `vercel.json` pins this supported framework slug). Do not create a second frontend or backend project. Vercel's Express route introspection handles `/api/check` and `/health`; no API rewrite is required.
- Build command: `npm run build` (Vercel runs the install step from `package-lock.json`).
- Output directory: leave blank/default; native Express deployment serves generated `public/**` assets through Vercel's CDN.
- Required user-provided environment variables: none.

Vercel serves the generated `public/**` files through its CDN. `express.static()` is used only for local production testing because Vercel does not serve static assets through that middleware. The Express Function exports from `src/index.ts`; `/api/check` and `/health` remain Express routes. `vercel.json` pins the Express framework and only overrides the build command needed to run the Vite build; it contains no rewrites or output-directory override.

The frontend calls `/api/check` with a relative URL, so no API URL environment variable is needed. Vercel supplies the function runtime and does not require a `PORT` setting for the exported app.

Each DNS operation has a three-second timeout and the batch worker limit is ten addresses. The maximum 100-address batch therefore has a roughly 30-second timeout-bound worst case, within current Vercel Hobby function limits; actual DNS behavior and duration must be checked after deployment. Vercel Fluid Compute currently allows 300 seconds on Hobby, while non-Fluid Hobby functions allow up to 60 seconds.

After deployment, open the project URL, request `/health`, and run one valid-domain and one malformed-address check from the live UI. Confirm that static assets load, `/api/check` returns JSON, and DNS failures appear as `unknown` rather than deliverable.
