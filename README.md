# RateMe — Setup Guide

A social personality-rating app: create a profile, share a link, let friends
rate you on chosen traits, then view radar/bar charts, top traits, an
auto-generated summary, and a personality trivia mini-game unlocked at 15+
ratings.

Vanilla HTML/CSS/JS, Supabase backend, Chart.js, Font Awesome. No build step.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New Project**.
2. Pick a name, database password, and region. Wait ~2 minutes for it to provision.
3. In the left sidebar go to **Project Settings → API**. You'll need two values:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **anon public** key (a long JWT string — NOT the `service_role` key)

---

## 2. Run the database schema

1. In the Supabase dashboard, open **SQL Editor**.
2. Click **New query**, paste the entire contents of `supabase/schema.sql`
   (included in this project), and click **Run**.

This single script:
- Creates the `profiles`, `ratings`, and `trait_cards` tables.
- Adds indexes (`share_code`, `owner_id`, `profile_id`, `created_at`).
- Enforces **one profile per user** via a unique index on `owner_id`
  (delete this index in the SQL if you want to allow multiple profiles
  per account).
- Enables **Row Level Security (RLS)** on all three tables.
- Adds the RLS policies described below.
- Enables **Realtime** on the `ratings` table (used for live dashboard updates).
- Seeds `trait_cards` with the 18 predefined traits used by the UI.

It's safe to re-run — every statement is idempotent (`IF NOT EXISTS`,
`DROP POLICY IF EXISTS`, `ON CONFLICT DO NOTHING`).

### RLS policy summary

| Table | Action | Who | Rule |
|---|---|---|---|
| `profiles` | SELECT | anyone | can read (app filters by `share_code`, so effectively "if you know the code") |
| `profiles` | INSERT | authenticated | only into their own `owner_id` |
| `profiles` | UPDATE | authenticated | only rows where `owner_id = auth.uid()` |
| `profiles` | DELETE | authenticated | only rows where `owner_id = auth.uid()` |
| `ratings` | INSERT | anyone (incl. anonymous) | unrestricted — anyone with a share link can submit a rating |
| `ratings` | SELECT | authenticated | only ratings belonging to a profile they own |
| `ratings` | UPDATE/DELETE | — | no policy defined → nobody can modify/delete individual ratings (immutable) |
| `trait_cards` | SELECT | anyone | public reference data |
| `trait_cards` | INSERT/UPDATE/DELETE | — | no policy defined → dashboard/service-role only |

---

## 3. Configure email auth

1. In the dashboard go to **Authentication → Providers → Email**.
2. Make sure **Email** is enabled (it is by default).
3. For local testing, you can turn **Confirm email** off
   (**Authentication → Providers → Email → "Confirm email"**) so signups log
   the user in immediately without needing to click a confirmation link.
   Leave it **on** for production.
4. Optional: customize the confirmation/magic-link email templates under
   **Authentication → Email Templates**.

---

## 4. Enable Realtime on the `ratings` table (already done by the script)

The schema script runs:
```sql
alter publication supabase_realtime add table public.ratings;
```
This lets `results.js` subscribe to new ratings and update the dashboard
live without a page refresh. If you ever add the table manually instead of
via the script, you can also do this from **Database → Replication** in the
dashboard by toggling the `ratings` table on.

---

## 5. Plug your credentials into the app

Open `js/supabaseClient.js` and replace the two placeholder constants:

```js
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-SUPABASE-ANON-KEY';
```

with the **Project URL** and **anon public** key from Step 1.

> ⚠️ Only ever use the `anon` key in frontend code. Never expose the
> `service_role` key in `supabaseClient.js` or any file that ships to the
> browser — RLS is what keeps the `anon` key safe to use publicly.

---

## 6. Run it locally

This is a static site (no bundler), so any static file server works. From
the project root:

```bash
# Option A: Python
python3 -m http.server 8080

# Option B: Node (npx, no install needed)
npx serve .

# Option C: VS Code "Live Server" extension
```

Then open `http://localhost:8080` (or whatever port your server prints).

> Note: the app is loaded as ES modules (`<script type="module">`), which
> most browsers block under `file://` — you must serve it over `http://`,
> not just double-click `index.html`.

---

## 7. Try the flow end-to-end

1. Open the app → **Sign Up** with an email/password.
2. Enter your name, pick 3–10 traits (or add custom ones), **Create Profile**.
3. You'll land on `results.html` — copy the share link shown there.
4. Open that link in an incognito window (or send it to a friend) to land
   on `rate.html`, rate each trait 1–10, and submit.
5. Back on `results.html`, the dashboard updates live (Realtime) or within
   ~20 seconds (polling fallback) with the new rating, radar/bar charts,
   top traits, and summary.
6. Once a profile reaches **15 ratings**, `game.html` unlocks — a
   multiple-choice trivia game generated from that profile's own data.
7. Use the gear icon anywhere to open **Settings**: switch between 23
   themes and 22 card styles (persisted in `localStorage`), edit your
   profile name, or delete your profile entirely.

---

## 8. Deploy to Vercel

No build step is required — this deploys as a static site.

1. Push this project to a GitHub repo.
2. In [Vercel](https://vercel.com), **New Project → Import** your repo.
3. Framework preset: choose **Other** (or leave auto-detect — Vercel will
   serve it as static files since there's no `package.json` build command).
4. Leave **Build Command** and **Output Directory** blank — deploy as-is.
5. Deploy. Your app will be live at `your-project.vercel.app`.

Since credentials live in `js/supabaseClient.js` (which is fine — it's the
public `anon` key, protected by RLS, not a secret), there's nothing extra
to configure as environment variables. If you'd rather not commit the keys
directly, you can wire them through Vercel environment variables and a
tiny build step later, but it isn't required for this project to work.

---

## Project structure reference

```
/project
  /css
    theme_*.css        23 color themes (swap via Settings)
    card_*.css          22 card visual styles (swap via Settings)
    base.css            shared layout/reset, imported by settings.css
    settings.css        settings panel UI + imports base.css
  /js
    supabaseClient.js    Supabase client + shared helpers (share code, auth guard)
    ui.js                toasts, loading states, confetti, field errors
    auth.js               login/signup form logic
    createProfile.js      trait picker + profile creation
    rateUser.js            rating flow (rate.html)
    results.js              owner dashboard: charts, summary, live updates
    miniGame.js               trivia game (game.html)
    settings.js               theme/card persistence + settings panel logic
    main-*.js                  one thin page-controller per HTML page
  /supabase
    schema.sql              run once in the Supabase SQL Editor
  index.html      → auth + create profile
  rate.html       → rating flow (?code=SHARE_CODE)
  results.html    → owner dashboard
  game.html       → trivia mini-game
  settings.html   → standalone settings page
```

## Troubleshooting

- **"Failed to fetch" / CORS errors** — double check `SUPABASE_URL` has no
  trailing slash and matches exactly what's in Project Settings → API.
- **Signup succeeds but nothing happens** — you likely have "Confirm email"
  on; check your inbox (or the Supabase **Authentication → Users** table to
  manually confirm during testing).
- **Rating submits but dashboard never updates** — confirm Realtime is
  enabled on `ratings` (Step 4); the 20-second polling fallback in
  `results.js` will still pick it up either way.
- **"new row violates row-level security policy"** — make sure you ran the
  full `schema.sql`, including the RLS policies, and that you're logged in
  when creating/editing a profile.
