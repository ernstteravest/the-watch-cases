-- Configurator V2: the exterior logo option for corporate orders.
-- Allows optional surcharges per logo mode in option_prices, e.g.
--   option_kind = 'logo', option_id = 'full-color' or 'one-color'.
-- Leather piece kinds stay allowed so older rows remain valid.
alter table public.option_prices drop constraint if exists option_prices_option_kind_check;
alter table public.option_prices add constraint option_prices_option_kind_check
  check (option_kind in ('exterior', 'interior', 'piece_material', 'piece_color', 'engraving', 'logo'));
