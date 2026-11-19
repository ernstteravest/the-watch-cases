# the-watch-cases

Website for **The Watch Cases Amsterdam**: personalised leather watch boxes (Duo and Quartet Slim).

Next.js (App Router) · React · TypeScript · Tailwind CSS · shadcn/ui conventions · Framer Motion.
Planned: Supabase (database), Stripe (payments, not active), Vercel (hosting).

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 (Dutch) or http://localhost:3000/en (English).
The design system is at `/stijlgids` (`/en/styleguide`).

Run the configurator tests with `npm test`.

## Where things live

| Path | What |
| --- | --- |
| `src/app/globals.css` | Design tokens: colours, type scale, spacing (from the design reference) |
| `src/config/site.ts` | Business settings: contact, shipping countries, production time, warranty, feature switches |
| `src/i18n/routes.ts` | Every public URL in Dutch and English |
| `src/i18n/dictionaries/` | All texts, `nl.ts` (default) and `en.ts` |
| `src/proxy.ts` | Maps Dutch/English URLs to the internal routes |
| `src/components/ui/` | Buttons, links, icons, sheet (shadcn/ui style) |
| `src/components/layout/` | Announcement bar, header, menu, language switch, footer |
| `src/assets/images/` | Product renders |
| `src/configurator/config/options.ts` | Configurator catalog: models, colours, leathers, pieces, engraving rules |
| `src/configurator/labels.ts` | Dutch/English names for colours, leathers and pieces |
| `src/components/configurator/` | Configurator page UI (preview, options, engraving, download) |
| `reference/` | Design reference (render and HTML mockup) |

## Languages

Dutch is the default and has no prefix (`/ontwerp`); English lives under `/en` (`/en/design`).
To add a page, add its URL in both languages to `src/i18n/routes.ts` and create the folder
under `src/app/[lang]/` with the English name.

## Secrets

Never commit `.env*` files (only `.env.example`). Server-only keys (Supabase service role,
Stripe secret) must never be used in client components.
