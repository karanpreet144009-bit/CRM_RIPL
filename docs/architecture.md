# Architecture

The API follows a controller → service → repository/Prisma flow. Controllers parse HTTP input and format responses; services own authorization and business transactions; Prisma supplies parameterized database access. Business records use UUIDs and soft deletion. Audit entries are append-only.

The web application keeps access tokens in memory and relies on the API's HTTP-only refresh cookie. Route checks improve usability, but authorization must always remain enforced by the API.

## Role baseline

| Role | Scope |
|---|---|
| Administrator | Complete system administration |
| Manager | Team CRM, inventory and booking approval workflow |
| Sales Executive | Assigned leads, follow-ups and booking requests |
| Reception | Enquiries, basic customers and availability |
