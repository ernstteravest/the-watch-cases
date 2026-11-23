# Database (Supabase)

| File | What |
| --- | --- |
| `migrations/20261119120000_initial_schema.sql` | Shop tables, triggers and Row Level Security |
| `migrations/20261120090000_logo_option_prices.sql` | Logo option prices (configurator V2) |
| `migrations/20261120120000_checkout.sql` | Shipping rates, logo review, private logo storage |
| `migrations/20261123100000_admin_foundation.sql` | **Phase 2:** administrators, roles, permissions, audit log, payments, administrator access to the shop tables |
| `migrations/20261123100100_cms.sql` | **Phase 2:** website content (drafts, publishing, revisions), media library, settings, image storage |
| `migrations/20261123100200_analytics_privacy.sql` | **Phase 2:** own analytics (no cookies), GDPR requests, rate limits |
| `seed.sql` | The two models (prices empty until decided). Safe to run more than once. |
| `tests/schema.test.sql` | Checks for the shop rules, for a **test** database |
| `tests/admin.test.sql` | Checks for the Phase 2 rules (roles, MFA, content, audit log), for a **test** database |
| `tests/local-supabase-stub.sql` | Stand-in for Supabase on a plain local PostgreSQL, for the tests only |

## Apply to your Supabase project

Run the migrations **in the order above**, each once, in **SQL Editor → New query**
(paste the full file, click **Run**, expect "Success. No rows returned").
Make a backup first (**Database → Backups**, or **Table Editor → export** on the free plan).

Not sure which ones already ran? Check in **Table Editor**:

| If this exists… | …this migration already ran |
| --- | --- |
| table `option_prices` allows option kind `logo` (or simply: run it again, it is safe) | `20261120090000_logo_option_prices.sql` |
| table `shipping_rates` | `20261120120000_checkout.sql` |
| table `profiles` | `20261123100000_admin_foundation.sql` |
| table `content_entries` | `20261123100100_cms.sql` |
| table `analytics_events` | `20261123100200_analytics_privacy.sql` |

Never run anything in `tests/` on the real database: it creates test data and,
for the stub, fake Supabase objects.

## Setting prices

**Table Editor** → `products` → fill in `price_from_cents` (in cents, including VAT:
€349.00 = `34900`). The website picks up the new price within a few minutes.
While a price is empty, the site shows €xxx.xx and that model cannot be ordered.
(Once `/beheer` exists, prices are changed there.)

## Who can see what

- **Visitors** (public key): active products, option prices and shipping rates,
  published website content (only through `published_content()`) and settings
  marked public. Read-only.
- **The website server** (secret key, never in the browser): everything, for
  checkout, payments, e-mail and analytics. Even the server cannot change or
  delete the audit log.
- **Administrators**: a signed-in user with an active row in `profiles`, **and**
  a session that passed two-factor authentication (MFA). What they can do comes
  from their role:

| Permission | Owner | Manager | Editor | Support |
| --- | :-: | :-: | :-: | :-: |
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Read orders, payments, logo files | ✓ | ✓ | | ✓ |
| Change order status, notes, logo review | ✓ | ✓ | | ✓ |
| Refunds | ✓ | ✓ | | |
| Read and edit customers, privacy requests | ✓ | ✓ | | ✓ |
| Export customer data (GDPR) | ✓ | ✓ | | ✓ |
| Anonymise customers, remove subscribers | ✓ | | | |
| Prices, availability, shipping rates | ✓ | ✓ | | |
| Edit and publish website content, media | ✓ | ✓ | ✓ | |
| Statistics | ✓ | ✓ | ✓ | |
| Read settings | ✓ | ✓ | | |
| Change settings | ✓ | | | |
| Manage administrators, read audit log | ✓ | | | |

- **Everyone else**, including signed-in users without an administrator profile
  or without MFA: nothing.
- There is always at least one active owner; the database refuses to remove the last one.

## Testing locally

On a plain PostgreSQL 15+ (no Docker), as a superuser, in a **new, empty** database:

```bash
psql -d twc_test -v ON_ERROR_STOP=1 -f supabase/tests/local-supabase-stub.sql
for f in supabase/migrations/*.sql; do psql -d twc_test -v ON_ERROR_STOP=1 -f "$f"; done
psql -d twc_test -v ON_ERROR_STOP=1 -f supabase/seed.sql
psql -d twc_test -v ON_ERROR_STOP=1 -f supabase/tests/schema.test.sql
psql -d twc_test -v ON_ERROR_STOP=1 -f supabase/tests/admin.test.sql
```

Both test files end with "ALL … TESTS PASSED". With Docker you can use
`npx supabase start` instead of the stub.
