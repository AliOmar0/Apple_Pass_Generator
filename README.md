# Wallet Studio

A React pass builder for Apple Wallet and Google Wallet. The public site uses
[WalletWallet](https://www.walletwallet.dev/) for managed signing through a
Cloudflare Worker, so no Apple Developer membership or Pass Type ID certificate
is required.

Live site:

```text
https://aliomar0.github.io/Apple_Pass_Generator/
```

## Features

- Membership, event, coupon, store card, and boarding pass templates
- Live Wallet-style preview
- Editable front and back fields
- QR, PDF417, Aztec, and Code 128 barcodes
- Relevant and expiration dates
- Project export
- Managed Apple and Google Wallet installation links

## Local development

```bash
npm install
npm run dev
```

The React app opens at `http://localhost:5173`.

To test the WalletWallet proxy locally:

```bash
copy .dev.vars.example .dev.vars
npm run worker:dev
```

Add your `ww_live_...` key to `.dev.vars`. Copy `.env.example` to `.env` so the
frontend connects to Wrangler at `http://localhost:8787`.

## Deploy managed signing

WalletWallet Free currently includes 1,000 issued passes per month. Its free
tier supports pass fields, barcodes, expiration, updates, hosted install pages,
and six color presets. Custom colors and artwork require WalletWallet Pro.

### 1. Create accounts and credentials

Create:

- A free [WalletWallet API key](https://www.walletwallet.dev/signup/)
- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)
- A Cloudflare API token with **Workers Scripts: Edit**

Find the Cloudflare Account ID on the Workers dashboard.

### 2. Add GitHub repository secrets

In **Settings → Secrets and variables → Actions**, create:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
WALLETWALLET_API_KEY
```

The Worker deployment workflow attempts to save `PASS_API_URL` automatically.
It also passes the URL directly to the first Pages rebuild, so initial
deployment does not depend on variable-write permission.

### 3. Deploy

Open **Actions → Deploy WalletWallet Proxy → Run workflow**.

The workflow:

1. Runs all tests.
2. Deploys `worker/index.js` to Cloudflare Workers.
3. passes its deployment URL to the GitHub Pages workflow.
4. attempts to retain that URL in the `PASS_API_URL` repository variable for
   future `main` deployments.

The WalletWallet key remains an encrypted Worker secret. It is never added to
the repository, Pages artifact, or browser bundle.

## Architecture

```text
GitHub Pages
    → Cloudflare Worker
        → WalletWallet API
            → hosted Apple / Google Wallet installation page
```

The Worker only accepts the deployed Pages origin and local development origins,
validates pass requests, applies a small per-device throttle, and exposes only:

- `GET /api/health`
- `POST /api/passes`

Never commit `.dev.vars` or provider API keys.
