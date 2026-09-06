# Launch Guide — from local project to live website

Follow this document top to bottom. Each part builds on the previous one.
Total time: roughly 2–3 hours. Total cost: ~$10/year for the domain, everything else is free.

You will create accounts on three services:

| Service | What it does for this site | Cost |
|---|---|---|
| **GitHub** | Stores the code; every push auto-deploys the site | Free |
| **Supabase** | Database + photo storage + upload/moderation functions | Free |
| **Cloudflare** | Hosts the website (Pages), sells the domain, provides spam protection (Turnstile) | Free + ~$10/yr domain |

Keep a scratch note open while you work. You will collect these values along the way:

```
SUPABASE PROJECT REF:        (Part 2)
SUPABASE URL:                (Part 2)
SUPABASE ANON/PUBLIC KEY:    (Part 2)
ADMIN EMAIL + PASSWORD:      (Part 2)
WORKERS.DEV URL:             (Part 4)
YOUR DOMAIN:                 (Part 5)
TURNSTILE SITE KEY:          (Part 6)
TURNSTILE SECRET KEY:        (Part 6)
```

---

## Part 0 — Prerequisites (10 min)

1. Install [Git for Windows](https://git-scm.com/download/win) if you don't have it. Check in PowerShell:

   ```powershell
   git --version
   ```

2. Create a **GitHub** account at [github.com](https://github.com) (or sign in).
3. Create a **Supabase** account at [supabase.com](https://supabase.com) — sign in with GitHub, it's easiest. No credit card needed.
4. Create a **Cloudflare** account at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).

---

## Part 1 — Push the code to GitHub (10 min)

1. On GitHub, click **+** (top right) → **New repository**.
   - Name: `afia-atlas` (anything works)
   - Visibility: **Private**
   - Do **not** initialize with a README (the project has one).
   - Click **Create repository**.

2. In PowerShell, from the project folder (`af_30`):

   ```powershell
   git init
   git add .
   git commit -m "Afia's atlas — initial version"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/afia-atlas.git
   git push -u origin main
   ```

   Git may open a browser window to sign in to GitHub the first time — allow it.

3. Refresh the GitHub page. You should see all the project files.

> ✅ Checkpoint: the code is on GitHub. From now on, publishing an update is just
> `git add . ; git commit -m "message" ; git push`.

---

## Part 2 — Set up Supabase (30 min)

### 2.1 Create the project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Name: `afia-atlas`. Choose a **strong database password** and save it somewhere safe (you rarely need it, but don't lose it).
3. Region: pick close to where most viewers are — e.g. **Mumbai** (most contributors in India) or **London**. Either is fine.
4. Wait ~2 minutes for provisioning.

### 2.2 Collect the keys

1. In the project dashboard, go to **Project Settings → API**.
2. Copy into your scratch note:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`) → this is `SUPABASE URL`
   - **anon / public** key → this is `SUPABASE ANON KEY`
   - The **project ref** is the `abcdefgh` part of the URL.

   ⚠️ Never copy the `service_role` key anywhere — it stays inside Supabase.

### 2.3 Create the database tables

In PowerShell, from the project folder:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

- `login` opens a browser to authorize.
- `link` asks for the database password from step 2.1.
- `db push` runs the three migration files in `supabase/migrations/` — this creates the memories table, settings, storage buckets, and all security rules.

Verify: in the Supabase dashboard, **Table Editor** should now show `memories`, `site_settings`, `admins`, `submission_attempts`.

### 2.4 Create your admin login

1. Dashboard → **Authentication → Sign In / Up** (under Configuration): turn **off** "Allow new users to sign up". Save. (This means only you can ever log in.)
2. Dashboard → **Authentication → Users** → **Add user → Create new user**:
   - Your email + a strong password. Check **Auto Confirm User**.
   - This is what you'll use to log in at `/admin`.
3. Click the new user and copy its **UUID** (long id like `1f0e2d3c-...`).
4. Dashboard → **SQL Editor** → paste and run (with your UUID):

   ```sql
   insert into public.admins (user_id)
   values ('PASTE_THE_UUID_HERE');
   ```

### 2.5 Deploy the two server functions

Still in PowerShell in the project folder:

```powershell
npx supabase functions deploy submit-memory --no-verify-jwt
npx supabase functions deploy moderate-memory
```

(`--no-verify-jwt` is required on `submit-memory` because friends upload anonymously with the new `sb_publishable_...` key, which isn't a JWT. The function still protects itself with origin checks, Turnstile, and rate limiting.)

These handle photo uploads (with spam protection and rate limiting) and hide/restore. We'll set their secrets in Part 6 once you have the Turnstile keys and final URLs.

> ✅ Checkpoint: Supabase dashboard → **Edge Functions** shows both functions as deployed.

---

## Part 3 — Set the reveal date (5 min)

The map stays locked (countdown page) until reveal. Two places control this:

1. **`src/content/site.ts`** — check the dates and personal copy are what you want.
2. **Supabase** — SQL Editor, run this to set when the countdown ends (this example: Sat Sep 19, 9:00 AM Pacific — adjust to your reveal moment and timezone):

   ```sql
   update public.site_settings
   set reveal_at = '2026-09-19T09:00:00-07:00'
   where id = 1;
   ```

The map actually unlocks when **you flip the reveal switch in `/admin`** — the timestamp only drives the countdown display. So there's no risk of it opening without you.

---

## Part 4 — Host the site on Cloudflare Workers (20 min)

*(Cloudflare's dashboard has replaced the old "Pages" flow with Workers. The repo contains `wrangler.jsonc`, which tells Cloudflare to serve the built site as a static single-page app — same free hosting, same custom domains.)*

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Continue with GitHub**.
2. Authorize Cloudflare to access your GitHub, select the `afia-atlas` repository.
3. Build settings:
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy`
4. Before deploying, open the **variables** section ("Build variables and secrets") and add these three (Turnstile comes in Part 6 — for now put in a placeholder like `pending`):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Supabase URL |
   | `VITE_SUPABASE_ANON_KEY` | your anon/publishable key |
   | `VITE_TURNSTILE_SITE_KEY` | `pending` (replaced in Part 6) |

5. Click **Deploy**. First build takes ~2 minutes.
6. You get a URL like `https://afia-atlas.YOUR_SUBDOMAIN.workers.dev` — write it down (`WORKERS.DEV URL`).

Open the URL: you should see the **locked countdown page** (because the reveal flag in Supabase is off). That's correct. You can check `/admin` and log in with your email/password from Part 2.4.

> ✅ Checkpoint: the site is live on the internet at the workers.dev URL, connected to your real database.

---

## Part 5 — Buy the domain on Cloudflare (15 min)

1. Cloudflare dashboard → **Domain Registration → Register Domains**.
2. Search for the name you want (e.g. `afiasatlas.com`, `thirtyyearsofafia.com`). `.com` is ~$10/year, charged at cost, no markup on renewal.
3. Buy it (this is the only money you'll spend). Auto-renew is on by default — leave it on.
4. Connect it to the site: **Workers & Pages → your project → Settings → Domains & Routes → Add → Custom domain** → enter your domain (e.g. `afiasatlas.com`).
   - Because the domain is registered with Cloudflare, DNS is configured **automatically** — just confirm.
   - Optionally add `www.yourdomain.com` as a second custom domain the same way.
5. Wait a few minutes, then open `https://yourdomain.com`. HTTPS certificate is automatic.

> ✅ Checkpoint: the site loads on your own domain.

---

## Part 6 — Spam protection (Turnstile) + function secrets (15 min)

### 6.1 Create the Turnstile widget

1. Cloudflare dashboard → **Turnstile** (left sidebar) → **Add widget**.
2. Name: `afia-atlas`. Hostnames — add **both**:
   - `yourdomain.com`
   - your `workers.dev` hostname (e.g. `afia-atlas.YOUR_SUBDOMAIN.workers.dev`)
3. Widget mode: **Managed**. Create.
4. Copy the **Site Key** and **Secret Key** into your scratch note.

### 6.2 Put the site key into Cloudflare

1. **Workers & Pages → your project → Settings → Build → Variables and Secrets**.
2. Edit `VITE_TURNSTILE_SITE_KEY` → replace `pending` with the real Site Key. Save.
3. Redeploy so the new value is baked in: retry the latest build from the **Deployments** view (or just push any commit).

### 6.3 Give the secrets to the Supabase functions

In PowerShell, from the project folder (one line; replace the three values — for
`RATE_LIMIT_SALT` type ~40 random characters, it's just an internal scrambler):

```powershell
npx supabase secrets set TURNSTILE_SECRET_KEY=YOUR_TURNSTILE_SECRET ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://afia-atlas.abhinaavsingh1.workers.dev RATE_LIMIT_SALT=some-long-random-string-you-make-up
```

`ALLOWED_ORIGINS` must list every address the site is served from — that's what stops other websites from posting to your upload endpoint.

> ✅ Checkpoint: open `https://yourdomain.com/contribute` and submit a **real test memory with a photo**. It should appear on the map in `/admin` immediately.

---

## Part 7 — Keep Supabase awake (10 min)

Supabase's free tier pauses a project after ~7 days without database activity. The repo contains a workflow that pings the database twice a week from GitHub.

1. GitHub → your repository → **Settings → Secrets and variables → Actions** → **New repository secret**. Add two:

   | Secret name | Value |
   |---|---|
   | `SUPABASE_URL` | your Supabase URL |
   | `SUPABASE_ANON_KEY` | your anon key |

2. GitHub → **Actions** tab → if prompted, enable workflows.
3. Find **"Keep birthday project active"** → **Run workflow** → run it once manually. It should show a green check in under a minute.

It now runs automatically every Monday and Thursday. Additionally, Supabase emails you a warning about a week before it would ever pause a project — don't ignore that email.

---

## Part 8 — Final testing and launch

### Before sharing the contribute link with friends

- [ ] On your **phone**, open `https://yourdomain.com/contribute` and submit a real photo from the camera roll. Confirm it works end to end.
- [ ] In `/admin`: edit that test entry's text, **hide** it, **restore** it.
- [ ] Open the homepage in a private/incognito window — it must show the **locked countdown**, never the map.
- [ ] Check the admin statistics show your test entries and contributors correctly.
- [ ] Delete/hide your test entries.
- [ ] Share `https://yourdomain.com/contribute` with friends (group chats, DMs). The main link `https://yourdomain.com` stays locked, so nothing is spoiled even if it's forwarded.

### As entries come in (ongoing, 2 min/day)

- Check `/admin` for new moments, fix typos or bad locations via **Edit**, hide anything that doesn't fit.

### The weekend before her birthday (Sep 19–20)

1. **Back up everything** (from the project folder):

   ```powershell
   npx supabase db dump --linked --file supabase/backup.sql
   ```

   Also download both storage buckets: Supabase dashboard → **Storage** → `approved-memories` → select all → Download. Keep copies of both outside the project folder too.

2. In `/admin`, flip the **reveal switch**.
3. Open `https://yourdomain.com` in a private window — the full map experience should now play.
4. Give Afia the link. 🎉

---

## Quick reference — everyday operations

| Task | How |
|---|---|
| Update the website (copy, styling, anything) | Edit code → `git add . ; git commit -m "change" ; git push` → live in ~2 min |
| Moderate / edit / hide entries | `https://yourdomain.com/admin` |
| Lock or reveal the map | Reveal switch in `/admin` |
| See visitor-facing site as friends see it | Private/incognito window |
| Check hosting/build status | Cloudflare → Workers & Pages → deployments |
| Check database / photos | Supabase dashboard → Table Editor / Storage |
| Costs | Domain renewal only (~$10/yr). If Supabase ever emails about limits, look at usage in its dashboard — this site's traffic should never get close. |

## If something breaks

- **Contribute page says verification failed** → Turnstile hostname list is missing the domain being used, or the site key in Pages doesn't match the widget.
- **Upload fails with "origin not allowed"** → the domain is missing from `ALLOWED_ORIGINS`; re-run the `npx supabase secrets set` command from Part 6.3 with the full list.
- **Site shows demo/sample memories** → the `VITE_...` environment variables are missing or misspelled in the Cloudflare project's build variables; fix and retry the deployment.
- **Supabase project paused** → Supabase dashboard → project → **Restore**. Takes a couple of minutes; then check the GitHub Action is running (Part 7).
- **Admin login fails** → confirm the user exists in Supabase Authentication and its UUID is in the `admins` table (Part 2.4).
