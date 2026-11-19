# Database (Supabase)

| File | What |
| --- | --- |
| `migrations/20261119120000_initial_schema.sql` | Tables, triggers and Row Level Security |
| `seed.sql` | The two models (prices empty until decided). Safe to run more than once. |
| `tests/schema.test.sql` | Security and logic checks for a **test** database |

## Apply to your Supabase project (once)

1. Open your project on https://supabase.com/dashboard → **SQL Editor** → **New query**.
2. Paste the full contents of `migrations/20261119120000_initial_schema.sql` and click **Run**.
   It should end with "Success. No rows returned".
3. New query: paste `seed.sql` and click **Run**.
4. Check under **Table Editor** that the 7 tables exist and that `products` has 2 rows.

Do **not** run `tests/schema.test.sql` on the real database: it creates test customers and orders.

## Setting prices

**Table Editor** → `products` → fill in `price_from_cents` (in cents, including VAT:
€349.00 = `34900`). The website picks up the new price within a few minutes.
While a price is empty, the site shows €xxx.xx and that model cannot be ordered.

## Who can see what

- Visitors (public key): only **active** products and option prices, read-only.
- The website server (secret key, never in the browser): customers, orders, newsletter.
- Everyone else: nothing. Row Level Security is on for every table.

## Testing locally

The schema tests need a PostgreSQL 15+ database with Supabase's `anon`,
`authenticated` and `service_role` roles and an `auth.users` table; see the
setup at the top of `tests/schema.test.sql`'s run in the project history, or
use `npx supabase start` (Docker) and `psql -f tests/schema.test.sql`.
