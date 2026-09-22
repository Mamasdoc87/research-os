# Research OS — v2 (Azure + Microsoft sign-in + OneDrive)

## What changed from v1

Swapped Supabase for:
- **Sign-in with Microsoft** (Azure AD / Entra ID), instead of a magic-link
  email. This is the same account you already use for Outlook/OneDrive.
- **Azure Database for PostgreSQL** instead of Supabase's Postgres — same
  schema, same idea, hosted on your Azure account.
- **OneDrive sync**: every idea (and its literature check, once run) is
  also saved as a markdown file in a dedicated folder in your OneDrive,
  called `Apps/Research OS`. This app can only see that one folder, not
  your other OneDrive files. The database is still the source of truth
  the app reads from — OneDrive is your personal, portable copy.

## Three things to set up in Azure, once

### 1. Register the app (gives you sign-in + OneDrive access)
In the Azure Portal, search **App registrations → New registration**.
Name it "Research OS", leave the defaults, and click Register. From the
page it lands you on, copy:
- **Application (client) ID** → `AZURE_AD_CLIENT_ID`
- **Directory (tenant) ID** → `AZURE_AD_TENANT_ID`

Then go to **Certificates & secrets → New client secret**, create one, and
copy its *value* immediately (it's only shown once) → `AZURE_AD_CLIENT_SECRET`.

Then go to **API permissions → Add a permission → Microsoft Graph →
Delegated permissions**, and add `Files.ReadWrite.AppFolder`. Click
**Grant admin consent** if you see that button.

Finally, go to **Authentication → Add a platform → Web**, and add this
redirect URL once you know your live URL (step 3 below):
`https://<your-app-url>/api/auth/callback/azure-ad`

### 2. Create the database
Search **Azure Database for PostgreSQL flexible servers → Create**. Pick
the cheapest "Burstable" tier — plenty for this. Once it's created, open
its **Query editor** (or connect with any Postgres client) and run
`azure/schema.sql` from this folder. Then, from **Connection strings**,
copy the value into `DATABASE_URL`.

### 3. Host the app
Search **Static Web Apps → Create**, connect it to your `research-os`
GitHub repo (same one you already pushed to) — Azure sets up automatic
deployment on every push for you, no separate deploy step needed. In
**Configuration**, add these environment variables:

```
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=...
DATABASE_URL=...
ANTHROPIC_API_KEY=...
NEXTAUTH_SECRET=<any random long string>
NEXTAUTH_URL=https://<your-app-url>
```

## Files in this scaffold

```
azure/schema.sql             - database tables
lib/auth.ts                  - Microsoft sign-in configuration
lib/db.ts                    - Postgres connection
lib/graph.ts                 - writes each idea to your OneDrive
app/ideas/page.tsx           - the whole UI so far
app/api/ideas/route.ts       - list + create ideas
app/api/ideas/check/route.ts - literature check via Claude + Consensus
```

## Next slice

Once this is live and you've logged a few ideas, the search-strategy
generator is next — same pattern, one more API route and one more section
on this page.
