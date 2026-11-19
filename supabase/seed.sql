-- Starting data: the two models. Prices stay empty (null) until decided;
-- the site then shows €xxx.xx. Safe to run more than once.
insert into public.products (slug, name, capacity, price_from_cents, active, sort_order) values
  ('duo', 'Duo', 2, null, true, 1),
  ('quartet-slim', 'Quartet Slim', 4, null, true, 2)
on conflict (slug) do nothing;
