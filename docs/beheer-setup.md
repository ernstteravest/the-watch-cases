# Beheer (/beheer): eenmalige instellingen

Dit doet u zelf in Supabase (en eventueel Cloudflare). Er komen geen wachtwoorden
of sleutels in GitHub.

## 1. Database bijwerken

Voer de migraties uit zoals beschreven in `supabase/README.md`.

## 2. Supabase Auth instellen

Supabase-dashboard → **Authentication**:

| Waar | Instelling |
| --- | --- |
| **Sign In / Providers → User Signups** | **Allow new users to sign up: UIT.** Accounts ontstaan alleen via een uitnodiging. |
| **Sign In / Providers → Email** | Aan. *Confirm email*: aan. |
| **Multi-Factor → TOTP (App Authenticator)** | **Enabled**. |
| **Sign In / Providers → Email → Password requirements** | Minimaal 12 tekens; kleine letters, hoofdletters en cijfers. |
| **Attack Protection** | *Prevent use of leaked passwords* aanzetten als uw plan dat toestaat. |
| **URL Configuration → Site URL** | Het adres van de website, bijv. `https://thewatchcases.nl` (nu het Vercel-adres). |
| **URL Configuration → Redirect URLs** | Toevoegen: `https://<uw-adres>/beheer/auth/bevestigen` (en `http://localhost:3000/beheer/auth/bevestigen` voor lokaal testen). |

### E-mailsjablonen

**Authentication → Emails → Templates.** Vervang in deze twee sjablonen de link
zodat die via de website loopt (dan werkt de link in elke browser en verloopt hij
na eenmalig gebruik):

**Invite user**

```html
<h2>Uitnodiging voor beheer – The Watch Cases</h2>
<p>U bent uitgenodigd als beheerder. Klik op de link om een wachtwoord te kiezen en tweestapsverificatie in te stellen:</p>
<p><a href="{{ .SiteURL }}/beheer/auth/bevestigen?token_hash={{ .TokenHash }}&type=invite">Uitnodiging accepteren</a></p>
<p>Verwachtte u deze e-mail niet? Dan kunt u hem negeren.</p>
```

**Reset password**

```html
<h2>Nieuw wachtwoord – The Watch Cases beheer</h2>
<p>Klik op de link om een nieuw wachtwoord te kiezen:</p>
<p><a href="{{ .SiteURL }}/beheer/auth/bevestigen?token_hash={{ .TokenHash }}&type=recovery">Nieuw wachtwoord kiezen</a></p>
<p>Heeft u dit niet aangevraagd? Dan kunt u deze e-mail negeren; uw wachtwoord blijft ongewijzigd.</p>
```

Let op: de gratis e-mailserver van Supabase verstuurt maar enkele e-mails per uur.
Voor de livegang koppelen we Resend (gratis) onder **Authentication → Emails → SMTP Settings**.

## 3. De eerste eigenaar aanmaken

1. **Authentication → Users → Add user → Send invitation**, vul uw e-mailadres in.
2. Open **SQL Editor → New query**, pas het e-mailadres en de naam aan en klik **Run**:

```sql
insert into public.profiles (id, email, full_name, role_id)
select id, email, 'Uw naam', 'owner'
from auth.users
where email = 'uw@e-mailadres.nl';
```

3. Klik op de link in de uitnodigingsmail, kies een wachtwoord en stel de
   authenticator-app in. Daarna komt u in `/beheer`.

Volgende beheerders nodigt de eigenaar straks uit vanuit `/beheer` (fase 5).

## 4. (Aanbevolen) Cloudflare Turnstile

Gratis bescherming tegen automatische inlogpogingen.

1. https://dash.cloudflare.com → **Turnstile → Add widget**. Naam: *The Watch Cases beheer*;
   domeinen: uw Vercel-adres (en later `thewatchcases.nl`); modus: *Managed*.
2. Zet in Vercel → **Settings → Environment Variables**:
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (site key) en `TURNSTILE_SECRET_KEY` (secret key).
3. Opnieuw deployen.

Zonder Turnstile werkt inloggen ook; dan beschermen alleen de limieten op het aantal pogingen.

## Hoe de beveiliging werkt

- Inloggen met e-mail en wachtwoord, daarna **altijd** een code uit de authenticator-app.
- Max. 5 inlogpogingen per account en 20 per netwerkadres per kwartier; 5 codepogingen per 5 minuten.
- Automatisch uitloggen na 30 minuten zonder activiteit en uiterlijk 12 uur na inloggen.
- De inlogcookies zijn alleen geldig voor `/beheer` en niet leesbaar voor scripts.
- Elke pagina controleert opnieuw of u (nog) beheerder bent; de database controleert het nog een keer.
- Inloggen, mislukte pogingen, uitloggen en wachtwoordwijzigingen komen in het logboek
  (`audit_logs`), met een onherleidbare code in plaats van uw IP-adres.
- Een gestolen wachtwoord-resetmail is niet genoeg: wie al tweestapsverificatie heeft,
  moet eerst de code invullen voordat een nieuw wachtwoord kan worden gekozen.
