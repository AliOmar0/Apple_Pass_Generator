# Wallet Studio

A full-stack Apple Wallet pass builder powered by React, Express, and
[`passkit-generator`](https://github.com/alexandercerutti/passkit-generator).

It includes:

- Ready-to-edit membership, event, coupon, store card, and boarding pass templates
- A live Wallet-style preview
- Editable front and back fields
- Brand colors and artwork uploads
- QR, PDF417, Aztec, and Code 128 barcode support
- Relevant and expiration dates
- Advanced PassKit JSON overrides
- Secure server-side pass signing and `.pkpass` downloads

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The editor works in preview mode before Apple
certificates are configured.

## Configure Apple signing

Apple Wallet only accepts passes signed with a certificate tied to your Pass
Type ID. Create the identifier and certificate in the Apple Developer portal,
then prepare these PEM files:

1. Apple WWDR intermediate certificate
2. Pass Type ID signing certificate
3. Private key for the signing certificate

Copy `.env.example` to `.env` and fill in:

```dotenv
APPLE_PASS_TYPE_IDENTIFIER=pass.com.example.walletstudio
APPLE_TEAM_IDENTIFIER=YOUR_TEAM_ID
APPLE_WWDR_CERT_PATH=./certificates/wwdr.pem
APPLE_SIGNER_CERT_PATH=./certificates/signerCert.pem
APPLE_SIGNER_KEY_PATH=./certificates/signerKey.pem
APPLE_SIGNER_KEY_PASSPHRASE=
```

The API also supports base64 certificate values for hosted environments. See
`.env.example` for the variable names.

### Convert a `.p12` export to PEM

```bash
openssl pkcs12 -in pass-certificate.p12 -clcerts -nokeys -out signerCert.pem
openssl pkcs12 -in pass-certificate.p12 -nocerts -out signerKey.pem
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
```

Keep certificates and private keys outside source control. The included
`.gitignore` excludes common certificate formats and the `certificates/`
directory.

## Production

```bash
npm run build
npm start
```

Express serves the built frontend and the signing API from the same origin.
Use HTTPS in production. Generated passes are exposed through a single-use URL
that expires after five minutes. On an iPhone, Safari opens that URL and prompts
the user to review and add the pass to Apple Wallet.

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` automatically tests, builds,
and deploys the editor whenever `main` is updated. The Pages URL is:

```text
https://aliomar0.github.io/Apple_Pass_Generator/
```

In the repository, open **Settings → Pages** and select **GitHub Actions** as the
source. Until a signing API is configured, the entire editor and project export
work on Pages, but Apple Wallet installation remains unavailable because GitHub
Pages cannot run Node.js or securely hold a private signing key.

After deploying `server/` to an HTTPS Node.js host:

1. Set `ALLOWED_ORIGINS=https://aliomar0.github.io` on the API host.
2. Create a GitHub Actions repository variable named `PASS_API_URL`.
3. Set it to the API origin, without `/api`, for example
   `https://wallet-api.example.com`.
4. Re-run the Pages workflow.

Never store Apple certificates in the frontend, repository, Pages workflow
artifact, or a `VITE_` variable. They belong only in the signing API's encrypted
environment.

The workflow sets `VITE_STATIC_HOST=true`, preventing the Pages build from
mistaking GitHub's static host for the signing API. Normal `npm run build`
deployments keep using the same-origin Express API.
