# Thirty years of Afia

A private, cinematic birthday experience built around an interactive world map of memories. Friends place one photographed moment on Afia's map; entries appear immediately and can be edited, hidden, or restored by the admin.

> **Setting this up for the first time?** Follow the complete step-by-step walkthrough in [SETUP_GUIDE.md](./SETUP_GUIDE.md) — it covers GitHub, Supabase, Cloudflare Pages, buying the domain, and launch.

## Local preview

```bash
npm install
npm run dev
```

Without environment variables the app runs safely in demo mode with six clearly labelled sample memories. Visit:

- `/` — revealed experience in demo mode
- `/contribute` — public contribution flow
- `/admin` — edit, visibility, and reveal controls

Personal copy, birthday date, and dedication live in `src/content/site.ts`.

## Supabase setup

1. Create a free Supabase project.
2. Authenticate the Supabase CLI (via `npx`, no install needed):

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

3. In Authentication settings, disable public user signups. Create one email/password user manually.
4. In the SQL editor, authorize that user:

   ```sql
   insert into public.admins (user_id)
   values ('UUID_FROM_AUTHENTICATION_USERS');
   ```

5. Create a Cloudflare Turnstile widget for the production domain.
6. Copy `.env.example` to `.env.local` and fill in the three public values.
7. Configure and deploy the secure functions:

   ```bash
   npx supabase secrets set TURNSTILE_SECRET_KEY=... ALLOWED_ORIGINS=https://your-domain.com,https://your-project.pages.dev RATE_LIMIT_SALT=...
   npx supabase functions deploy submit-memory
   npx supabase functions deploy moderate-memory
   ```

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions automatically. Never expose the service-role key in a Vite variable.

## Security model

- Public visitors can read only visible memories and the reveal setting.
- Uploads pass through a server-side function with origin checks, Turnstile verification, validation, and a six-per-hour IP rate limit.
- IP addresses are salted and hashed; raw addresses are never stored.
- New entries publish immediately. Hiding an entry moves its image into private storage; restoring it moves the image back.
- Admin status is tied to a manually provisioned Supabase Auth user and enforced by row-level security.
- Images are converted to WebP in the browser before upload: one display image and one small thumbnail.

## Cloudflare Pages deployment

Push the project to GitHub, then create a Cloudflare Pages project with:

- Build command: `npm run build`
- Output directory: `dist`
- Production branch: `main`
- Environment variables: the three `VITE_...` values from `.env.example`

Cloudflare creates a free `pages.dev` URL. Under **Custom domains**, add the purchased domain and follow the DNS prompt. For client-side routes, the Vite SPA fallback is handled automatically by Pages.

Add both the Pages URL and final domain to `ALLOWED_ORIGINS`, and add both hostnames to the Turnstile widget. Preview deployments need either their own allowed hostname or Turnstile's testing keys.

## Launch checklist

- Replace all copy and confirm the reveal timestamp in `src/content/site.ts` and `site_settings`.
- Submit a real phone photo on iPhone and Android.
- Confirm a submission appears automatically.
- Edit, hide, and restore a test memory; confirm hidden photos are not publicly accessible.
- Test the locked page in a private browser window.
- Flip the reveal setting and inspect the map on phone and desktop.
- Add a social sharing image as `public/og-image.jpg` and `og:image` in `index.html`.
- Export a backup immediately before reveal.

## Backup and free-tier availability

The Supabase Free plan does not include automatic backups and can pause after a low-activity week. Export before launch:

```bash
npx supabase db dump --linked --file supabase/backup.sql
```

Download both Storage buckets from the Supabase dashboard as well. Normal contributions and visits generate database activity. For quiet periods, enable the optional weekly workflow in `.github/workflows/keep-supabase-awake.yml` after setting repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY`. For guaranteed no-pause availability, use Supabase Pro during the launch month.

## Quality checks

```bash
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```
