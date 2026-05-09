# Setup — what you need to do

The code is wired up. To make it work in dev (and then in prod) you need to
create accounts on three services, copy a few keys into `.env.local`, run one
database migration, and configure two webhook/redirect URLs.

Total time: ~20 minutes if you have the accounts already, ~40 if not.

---

## 1. Copy the env template

```bash
cp .env.example .env.local
```

Open `.env.local`. You'll fill it in as you go through the steps below.

---

## 2. Supabase (database + Google sign-in)

Supabase gives you Postgres **and** Google OAuth in one project, so we use
both.

### 2a. Create the project
1. Go to https://supabase.com → **New project**.
2. Pick a region close to your users (Mumbai/Singapore for India).
3. Set a strong **database password** — save it; you'll need it in step 2c.

### 2b. Copy the API keys
**Settings → API**:
- Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- Copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`
  (server-only — never paste this anywhere client-side)

### 2c. Copy the Postgres connection string
**Settings → Database → Connection string → URI**:
- Pick the **Session pooler** (port `5432`) — Prisma migrations need a
  non-transaction-pooled connection.
- Replace `[YOUR-PASSWORD]` with the DB password from step 2a.
- Paste into `DATABASE_URL`.

### 2d. Enable Google sign-in
1. **Authentication → Providers → Google** → toggle **Enable**.
2. Supabase shows you a **Callback URL** like
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`. Keep this tab
   open.
3. In a new tab go to https://console.cloud.google.com:
   - Create or pick a project.
   - **APIs & Services → OAuth consent screen** → **External** → fill in app
     name, support email, developer email. Add the scopes `email`, `profile`,
     `openid`. Add yourself as a test user while it's unverified.
   - **APIs & Services → Credentials → Create credentials → OAuth client
     ID → Web application**.
   - **Authorised redirect URIs**: paste the Supabase callback URL from
     step 2d.2.
   - Save. Copy the **Client ID** and **Client secret**.
4. Back in Supabase, paste them into the Google provider screen and click
   **Save**.

### 2e. Add your site URLs to Supabase
**Authentication → URL Configuration**:
- **Site URL**: `http://localhost:3000` for dev (change to your prod domain
  later).
- **Redirect URLs**: add both:
  - `http://localhost:3000/auth/callback`
  - `https://YOUR-PROD-DOMAIN/auth/callback` (when you deploy)

### 2f. Push the database schema
With `DATABASE_URL` filled in:

```bash
npm run db:push
```

If the command **prints the datasource line then hangs**, stop it with Ctrl+C.
Almost always the URL is wrong: **transaction pooler** uses port **6543** and
does not play well with Prisma `db push` / migrations. Open Supabase **Settings
→ Database → Connection string**, choose **Session pooler** (port **5432**),
paste that URI into `DATABASE_URL` in `.env` / `.env.local`, and run
`npm run db:push` again.

This creates the `profiles`, `subscriptions`, and `payments` tables. (Use
`npm run db:migrate -- --name init` instead if you want a versioned migration
checked into git.)

> **Tip:** Supabase Auth manages users in its own `auth.users` table. Our
> `profiles` table holds the same UUID and is created automatically the first
> time a user signs in.

---

## 3. Razorpay (subscriptions)

### 3a. Get API keys
1. Go to https://dashboard.razorpay.com.
2. **Account & Settings → API Keys → Generate Test Key**. (Use Test Mode
   while developing — switch to Live keys when you're ready.)
3. Copy:
   - **Key Id** → `RAZORPAY_KEY_ID` **and** `NEXT_PUBLIC_RAZORPAY_KEY_ID`
     (same value — the public one is exposed to the browser to open
     Checkout).
   - **Key Secret** → `RAZORPAY_KEY_SECRET`

### 3b. Create the two subscription plans
**Subscriptions → Plans → Create Plan** — do this twice:

**Monthly plan**
- Plan name: `Diamond Master Monthly`
- Billing frequency: **Monthly**, every **1** month
- Amount: **₹99.00**
- Total billing cycles: e.g. `120` (10 years' worth — anything large works)
- Save → copy the resulting **Plan ID** (`plan_XXXX`) → `RAZORPAY_PLAN_ID_MONTHLY`

**Yearly plan**
- Plan name: `Diamond Master Yearly`
- Billing frequency: **Yearly**, every **1** year
- Amount: **₹799.00**
- Total billing cycles: e.g. `10`
- Save → copy the **Plan ID** → `RAZORPAY_PLAN_ID_YEARLY`

### 3c. Set up the webhook
Razorpay calls our server when subscriptions activate, charge, fail, or
cancel. Without this the database never learns the subscription is "active."

**Account & Settings → Webhooks → Add New Webhook**:
- **Webhook URL**:
  - Dev: see step 3d below (you need a public URL).
  - Prod: `https://YOUR-PROD-DOMAIN/api/billing/webhook`
- **Secret**: pick anything strong, paste the same value into
  `RAZORPAY_WEBHOOK_SECRET`.
- **Active events** — tick all of:
  - `subscription.activated`
  - `subscription.charged`
  - `subscription.completed`
  - `subscription.cancelled`
  - `subscription.halted`
  - `subscription.paused`
  - `subscription.resumed`
  - `subscription.pending`
  - `payment.failed`
- Save.

### 3d. Local webhook testing (optional but recommended)
Razorpay can't reach `localhost`. Use a tunnel:

```bash
# install once
brew install cloudflared
# then, in a separate terminal:
cloudflared tunnel --url http://localhost:3000
```

Cloudflare gives you a public `https://something.trycloudflare.com` URL —
register that as the webhook URL in step 3c while you're testing. (Or use
`ngrok http 3000` if you prefer.)

---

## 4. App URL

Set `NEXT_PUBLIC_SITE_URL` to whatever the browser sees:
- Dev: `http://localhost:3000`
- Prod: your deployed origin, no trailing slash.

---

## 5. Run it

```bash
npm run dev
```

1. Open http://localhost:3000/account.
2. **Continue with Google** → sign in.
3. You'll land back on `/account` showing **30 trial days left**.
4. The calculator, lot, recut, and history pages now require sign-in. After
   the trial ends, the page will instead show "Your free trial has ended" and
   point them to `/account` to subscribe.
5. Click **₹99 / month** or **₹799 / year** — Razorpay Checkout opens.
6. In Test Mode you can complete a "payment" with the card
   `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234`.
7. Within ~5 seconds the webhook fires and the page refreshes showing
   subscription status `active`.

---

## 6. Deploy

The app is a standard Next.js project. Deploy to Vercel (or anywhere that
runs Next 15):

1. Push to GitHub.
2. Import into Vercel.
3. Paste **all** the env vars from `.env.local` into Vercel project settings.
4. Update the production-only items:
   - `NEXT_PUBLIC_SITE_URL` → your prod domain.
   - Supabase **Authentication → URL Configuration** → add the prod
     `/auth/callback` URL.
   - Razorpay webhook → switch URL to the prod one.
5. When you're ready to take real money, swap the Razorpay **Test** keys for
   **Live** keys (and create the same two plans on the live side; their plan
   IDs will differ).

---

## What's where in the code

- `prisma/schema.prisma` — DB tables (`Profile`, `Subscription`, `Payment`).
- `src/lib/supabase/` — Supabase clients (browser, server, middleware).
- `src/lib/prisma.ts` — Prisma singleton.
- `src/lib/razorpay.ts` — Razorpay SDK + plan config + 30-day trial constant.
- `src/lib/account.ts` — `getAccount()` resolves the signed-in user, trial
  days, and subscription state.
- `src/app/auth/callback/route.ts` — handles Google OAuth redirect, creates
  the `Profile` row.
- `src/app/auth/signout/route.ts` — POST to sign out.
- `src/app/api/billing/subscribe/route.ts` — creates a Razorpay subscription
  with `start_at` set 30 days out.
- `src/app/api/billing/webhook/route.ts` — verifies signature, updates
  `Subscription` and `Payment` rows.
- `src/app/api/billing/cancel/route.ts` — cancels at period end.
- `src/app/(paid)/layout.tsx` — server-side gate for `/calculator`, `/lot`,
  `/recut`, `/history`. Allows access during the 30-day trial **or** with an
  active subscription.
- `src/app/account/` — UI: Google sign-in, plan picker, Razorpay Checkout,
  cancel.

---

## Tweaks you might want later

- **Trial length:** change `TRIAL_DAYS` in `src/lib/razorpay.ts`.
- **Plan prices:** the prices are configured in the Razorpay dashboard
  (single source of truth). The values in `src/lib/razorpay.ts` are display
  labels only — keep them in sync if you change the dashboard prices.
- **Email receipts:** Razorpay sends invoices automatically. Supabase Auth
  sends OAuth-flow emails automatically. No SMTP setup needed unless you
  want product emails.
- **Refunds / proration:** handle from the Razorpay dashboard for now.
