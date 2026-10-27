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

This application does **not** verify that a specific mailbox exists, and it does **not** guarantee delivery. MX records only establish that a domain appears capable of accepting mail. The deployed Render Free service is intentionally DNS-only: Render Free blocks outbound SMTP ports, so the app never attempts SMTP recipient probing and never sends email.

## Architecture

One Node.js/Express service serves the compiled React/Vite frontend and exposes:

- `GET /health` → `{ "ok": true, "mode": "dns-only" }`
- `POST /api/check` → bulk result data

No database, authentication system, external verification API, or SMTP client is used. Domain-routing outcomes are cached in memory for ten minutes; full submitted email addresses are neither persisted nor logged.

## Local setup

Requires Node.js 20.18 or newer.

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

The response contains one result per unique normalized address plus category counts and `duplicatesRemoved`. Input is limited to 20 KB and 100 unique addresses. The service limits callers to 30 batch requests per 10 minutes, limits DNS work to five concurrent addresses, and applies a three-second DNS-operation timeout.

## Privacy and safety

- No submitted address is stored in a database or written to application logs.
- The server accepts only email text; users cannot select DNS servers, hosts, ports, or SMTP commands.
- No outbound SMTP connection is made and the application never reaches an email `DATA` stage.
- DNS errors are treated as `unknown`, never as proof an address is invalid.

## Render deployment

GitHub repository: https://github.com/Jude-00-05/shieldnex-email-checker

Use the public GitHub repository to create a Render Free Web Service, or select **Blueprint** so Render reads the included `render.yaml`.

Manual service settings:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check path: `/health`
- Runtime: Node.js 20.18+ (the supported range is pinned in `package.json`)
- Required user-provided environment variables: none

The server binds to `0.0.0.0` and uses Render's `PORT` value automatically. The build places the frontend in `dist/client`; the production Express server serves that directory and the API from the same service. Do not configure a separate frontend service or add SMTP credentials.

After deployment, open the service URL, request `/health`, and run one valid-domain and one malformed-address check from the live UI. A Free service can take about a minute to wake after inactivity.

Render Free services can cold-start after inactivity. The live application URL should be added here after verification.
