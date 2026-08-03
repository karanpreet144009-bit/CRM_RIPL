# Secure deployment checklist

This application must not be shared with employees through `http://<computer-ip>:5173`. That is the Vite development server and browser traffic, including passwords, is unencrypted.

## Required production setup

1. Use a server that remains powered on and is maintained by an administrator. A VPS, managed cloud service, or a company server with a fixed IP is suitable. A personal office PC is not a production host.
2. Choose a domain such as `erp.your-company-domain.com` and point its DNS record to the server's public IP. Set `WEB_ORIGIN=https://erp.your-company-domain.com` in `.env`.
3. Obtain a certificate from a trusted certificate authority. Copy its certificate chain to `certs/fullchain.pem` and private key to `certs/privkey.pem`. Keep the private key private: do not email or commit it.
4. Copy `.env.production.example` to `.env`; generate unique, long values for `POSTGRES_PASSWORD` and `JWT_ACCESS_SECRET`; set `NODE_ENV=production` and `COOKIE_SECURE=true`.
5. Run `docker compose -f docker-compose.production.yml up -d --build`. Only ports 80 and 443 are exposed. PostgreSQL and the API are private Docker services.
6. Verify that `http://erp.your-company-domain.com` redirects to HTTPS and that Chrome shows a lock icon at `https://erp.your-company-domain.com` before employees sign in.

## Office-only alternative

If the ERP must be reachable only inside the office, use a company VPN or internal DNS plus an internal certificate authority. Every employee computer must trust that CA. A self-signed certificate alone will still show a warning and is not acceptable for password entry.

### This office setup: `erp.rrpl.local`

This repository now contains an office certificate for `erp.rrpl.local` and `192.168.1.32`. It is trusted only on the ERP host computer. Copy **only** `certs/rrpl-office-root-ca.pem` to each employee PC; never copy `privkey.pem` or any `rootCA-key.pem` file.

On every employee PC, an administrator can run `scripts/Install-RrplOfficeTrust.ps1` after copying the root certificate and script to that machine. It adds the internal name to the Windows hosts file and trusts the RRPL office root certificate. Then users can open `https://erp.rrpl.local` without a browser warning.

The ERP host must run the production Docker configuration using an `.env` copied from `.env.office.example`, with unique production secrets. Start it with `docker compose -f docker-compose.production.yml up -d --build`.

## Ongoing controls

- Back up PostgreSQL daily and test restoring a backup.
- Keep Windows/Linux, Docker, Node, and dependencies patched.
- Create one employee account per person; never share the administrator account.
- Remove disabled employees promptly and review audit logs and failed logins.
- Restrict server administrator access and do not expose ports 4000 or 5432 to the internet.
