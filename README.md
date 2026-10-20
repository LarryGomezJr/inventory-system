# Inventory System

Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · shadcn/ui · Supabase (Auth + Postgres).

Phase 1 covers authentication and a static dashboard:

- **Sign up** — full name, username, phone, email, password → 6-digit code emailed → verified.
- **Sign in (2-step)** — email + password → 6-digit code emailed → signed in.
- **Forgot password** — email → 6-digit code → new password (signs out all devices).
- **Sign out**, protected `/dashboard`.

## Setup

### 1. Supabase project
1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → API**: copy the Project URL, the `anon`/publishable key and the `service_role`/secret key.
3. `cp .env.example .env.local` and fill in the values. Never commit `.env.local`.

### 2. Email (SMTP)
Supabase's built-in mailer only sends a couple of emails per hour, to team members only, so custom SMTP is required.

Gmail example: turn on **2-Step Verification** for the Google account, then create an **App Password**.

- Put `SMTP_*` values in `.env.local` (used for the sign-in codes).
- Supabase → **Authentication → Emails → SMTP Settings** → enable custom SMTP with the same host (`smtp.gmail.com`), port (`465`), user, app password and sender (used for signup and reset codes).

### 3. Auth settings (Supabase dashboard)
- **Authentication → Sign In / Providers → Email**: enabled, *Confirm email* ON, email OTP length **6**, expiry **600** s.
- **Authentication → URL Configuration**: Site URL `http://localhost:3000`.
- **Authentication → Emails → Templates**: paste
  - `supabase/email-templates/confirm-signup.html` into **Confirm signup**
  - `supabase/email-templates/reset-password.html` into **Reset password**

### 4. Database
Supabase → **SQL Editor → New query** → paste each file in order → **Run**:
1. `supabase/migrations/0001_init.sql` (users)
2. `supabase/migrations/0002_products.sql` (products: `tbl_product`, with Row Level Security so each user only sees their own products, and a database-computed `stock_status`)
3. `supabase/migrations/0003_suppliers.sql` (suppliers: `tbl_supplier`, private per user; links products to suppliers with a same-user foreign key and converts any old free-text product suppliers)

Creates:
- `tbl_user` — full name, username, phone number and email from the signup form, auto-filled by a trigger on signup. RLS: each user can only read/update their own row. **No password column**: Supabase Auth stores only a bcrypt hash in `auth.users.encrypted_password`, which the API never exposes.
- `login_challenges` — hashed sign-in codes, service-role only.
- `check_signup_availability()` — duplicate email/username check, service-role only.

### 5. Session length (30 minutes)
Supabase → **Project Settings → JWT Keys** → set **Access token expiry** to `1800` seconds.

The app also enforces a 30-minute **idle timeout** (override with `SESSION_IDLE_SECONDS`):
- Session tokens live only in **httpOnly cookies**, so page JavaScript can't read them. They're never stored in app tables.
- A signed `session_activity` cookie (HMAC with `SESSION_SECRET`) is renewed on every page request and on a heartbeat while the user is active on the dashboard.
- At 28 minutes idle the dashboard shows a warning. At 30 minutes the user is signed out (refresh token revoked) and sent to `/login?expired=1`.

### 6. Run
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## How sign-in works
1. `POST /api/auth/login` checks the password with a throwaway Supabase client (no cookies), revokes that session, stores a SHA-256 hash of a random 6-digit code in `login_challenges` and emails the code. An httpOnly `login_challenge` cookie points to the challenge.
2. `POST /api/auth/login/verify` checks the code (10-minute expiry, 5 attempts, 60 s resend cooldown), then mints the real session with `auth.admin.generateLink` + `verifyOtp(token_hash)`. No session exists before this step.

Supabase's own `signInWithOtp` is deliberately not used for step 2, since anyone holding the public anon key could call it and skip the password.

## Project layout
```
app/(auth)/        login, login/verify, signup, verify-email, forgot-password, reset-password
app/dashboard/     protected layout (sidebar + user menu) and static dashboard
app/api/auth/      route handlers for every auth action
lib/supabase/      server, admin (service role) and proxy session helpers
lib/               otp, mailer, login-challenge, validations, auth (current user)
proxy.ts           session refresh + route protection
supabase/          SQL migration and email templates
```

## Environments & database changes

Use **two Supabase projects**: development (`.env.local`) and production (set its keys only in your hosting provider's environment variables, never in git). Every database change is a **migration file** in `supabase/migrations/`, applied to each project with the **Supabase CLI** (`npx supabase …`, installed as a dev dependency). Never change the production schema in the dashboard.

| What | Moves with | Notes |
|---|---|---|
| Tables, RLS, triggers | `supabase db push` | Runs only migrations the project hasn't applied yet |
| Auth settings, SMTP, email templates, rate limits | `supabase config push --project-ref <ref>` | From `supabase/config.toml`. Shows a diff and asks before changing anything |
| Data | — | Never copied. Dev test data stays in dev |
| API keys | — | Different per project |

### Everyday change
```bash
npm run db:new add_something           # creates supabase/migrations/<timestamp>_add_something.sql
# write the SQL, then apply it to the linked (dev) project:
npm run db:push
npm run test:e2e                        # test against dev
git commit -am "Add something"
```

### Release to production
```bash
npx supabase link --project-ref <prod-ref>
npx supabase migration list             # what prod has vs. what's in the repo
npx supabase db push --dry-run          # preview
npx supabase db push                    # apply
npx supabase link --project-ref <dev-ref>   # link back to dev
```
Rules: migrations only go forward (fix mistakes with a new migration), and back up prod before risky changes.

### First-time production setup
1. Create a new Supabase project (use the Pro plan for real users; free projects pause when idle).
2. Link it and run `npx supabase db push` (applies every migration).
3. Add a `[remotes.production]` block in `supabase/config.toml` with its `project_id` and production `site_url`, then run `npx supabase config diff --project-ref <prod-ref>` and `npx supabase config push --project-ref <prod-ref>`. SMTP credentials come from `SMTP_USER` / `SMTP_PASS` in your environment.
4. Put the prod URL and keys in your hosting env vars, and add the prod ref to `E2E_FORBIDDEN_PROJECT_REFS` in `.env.local` so tests can never run against it.
