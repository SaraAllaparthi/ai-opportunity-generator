# AUTH_DESIGN.md

## 1. Overview

This document describes the authentication, authorization, and **public sharing** design for the app using **Supabase Auth**.

Requirements:

- Only **invited, active users** can:
  - Access the localized home page (`/en`, `/de`)
  - Generate reports
- Users can view reports via a localized **share page**:
  - `/en/share/:id`
  - `/de/share/:id`
- Users can optionally **share a report via a link** so that:
  - The recipient **does not need an account**
  - Access is valid only for a **limited time**
  - The owner can revoke sharing

> In this design, `:id` in `/[lang]/share/:id` is a **share token**, not the raw report ID.

---

## 2. Architecture

- **Frontend**: Next.js app on Vercel
  - Pages:
    - `/en` / `/de`: localized home page with company form + “generate report” (auth only)
    - `/en/share/:id` / `/de/share/:id`: localized share page showing a report (public via share token)
- **Backend**: Supabase
  - **Auth**: Supabase Auth (`auth.users`)
  - **DB**: Postgres with custom tables:
    - `app_users` – invite, status, role
    - `reports` – reports owned by users
    - `report_shares` – tokens for time-limited public access to reports
  - **RLS**: Row-Level Security on all tables

---

## 3. Data Model

### 3.1 Supabase Auth (managed)

- `auth.users`
  - `id` (UUID) – user identity
  - `email`

### 3.2 Application Tables

#### `app_users`

Maps `auth.users` to app-specific metadata (invite, role, status).

```sql
CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,

  role text NOT NULL DEFAULT 'user',        -- 'user' | 'admin'
  status text NOT NULL DEFAULT 'invited',   -- 'invited' | 'active' | 'disabled'

  invited_at timestamptz DEFAULT now(),
  activated_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

reports
Owned reports (created by authenticated users).

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  company_name text NOT NULL,
  report_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

report_shares
Time-limited public share links for reports.

CREATE TABLE public.report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports (id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,               -- used in /[lang]/share/:token
  expires_at timestamptz NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

Notes:
	•	token is a random, hard-to-guess string (e.g. 32+ chars base64/hex).
	•	When revoked_at is non-null or now() > expires_at, the share is considered invalid.

⸻

4. Row-Level Security (RLS)

Enable RLS:

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

4.1 app_users (high-level policies)
	•	Users can SELECT only their own row (auth.uid() = auth_user_id).
	•	Admins can SELECT/UPDATE all rows (via role = 'admin' check in policy or using a service role).

4.2 reports (high-level policies)
	•	Authenticated users can SELECT/INSERT reports only for themselves:
	•	reports.user_id = current_app_user_id(auth.uid()).
	•	Optional: allow admins to read all reports.

4.3 report_shares (high-level policies)

Two access patterns:
	1.	Owner/admin access (authenticated):
	•	Users can SELECT / INSERT / UPDATE report_shares rows only for reports they own.
	•	Used to create/revoke share links in the app.
	2.	Public access via token (unauthenticated):
	•	Anonymous role (auth.role() = 'anon') can SELECT a share only when:
	•	token = <provided token>
	•	revoked_at IS NULL
	•	now() < expires_at
	•	Query joins to reports to get report_json.

This allows using the Supabase anon client in the share page while still enforcing token + expiry at the DB layer.

⸻

5. Authorization Layer (Server Helpers)

5.1 App User Resolution

type AppUser = {
  id: string;
  auth_user_id: string;
  email: string;
  role: "user" | "admin";
  status: "invited" | "active" | "disabled";
};

async function getCurrentAppUser(): Promise<AppUser | null> {
  const supabase = createSupabaseServerClient(); // server-side Supabase client
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: appUser } = await supabase
    .from("app_users")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  return appUser ?? null;
}

async function requireActiveUser(): Promise<AppUser> {
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.status === "disabled") {
    throw new Error("Unauthorized or disabled");
  }
  return appUser;
}

async function requireAdmin(): Promise<AppUser> {
  const appUser = await requireActiveUser();
  if (appUser.role !== "admin") {
    throw new Error("Forbidden");
  }
  return appUser;
}

Usage:
	•	Home page /[lang] and report-generation API → requireActiveUser().
	•	Admin APIs (invite, disable) → requireAdmin().

The share page /[lang]/share/:id does not use requireActiveUser() — it relies on the report_shares token checks instead.

⸻

6. Invite-Only User Flow

6.1 Invite User (Admin)
	1.	Admin calls an internal admin API (e.g. /api/admin/invite).
	2.	The API:
	•	Uses requireAdmin().
	•	Calls supabase.auth.admin.inviteUserByEmail(email) or equivalent.
	•	Upserts app_users with:
	•	email
	•	auth_user_id (from Supabase auth user)
	•	status = 'invited'
	•	role = 'user' (or admin).

6.2 First Login

On first hit to /en or /de:
	1.	App resolves AppUser via getCurrentAppUser().
	2.	Behavior:
	•	If no app_users row → “Not invited” error page.
	•	If status = 'disabled' → “Your account has been disabled” message.
	•	If status = 'invited' → flip to status = 'active', set activated_at = now().
	•	If status = 'active' → proceed.

6.3 Disable / Enable

Admin APIs:

-- Disable
UPDATE app_users
SET status = 'disabled', disabled_at = now()
WHERE id = :app_user_id;

-- Enable
UPDATE app_users
SET status = 'active', disabled_at = NULL
WHERE id = :app_user_id;

requireActiveUser() will block disabled users from using /[lang] and from generating new reports.

⸻

7. Report Generation & Sharing Flow

7.1 Home Page: /en, /de

Purpose: Company form + “generate report”.

Flow:
	1.	Server-side:
	•	Call requireActiveUser().
	•	If failure → redirect to localized login / error page.
	2.	Authenticated:
	•	Render localized home page with:
	•	Company form.
	•	Optional list of existing reports and their share links.

On submit:
	•	Frontend calls POST /api/reports.

7.2 Generate Report API: POST /api/reports
	1.	Call requireActiveUser().
	2.	Parse company details from request.
	3.	Generate report (existing logic).
	4.	Insert into reports:

INSERT INTO reports (user_id, company_name, report_json)
VALUES (:app_user_id, :company_name, :report_json)
RETURNING id;


	5.	Optionally create an initial share link (e.g. default 7 days):

INSERT INTO report_shares (report_id, token, expires_at, created_by_user_id)
VALUES (:report_id, :random_token, now() + interval '7 days', :app_user_id)
RETURNING token;


	6.	Return share token to frontend.
	7.	Frontend redirects to /[lang]/share/:token.

⸻

8. Public Sharing Design

8.1 Share Page: /en/share/:id, /de/share/:id

Here :id is the share token (report_shares.token), not the report UUID.

Access:
	•	No authentication required.
	•	Anyone with the link can view the report if:
	•	The share record exists.
	•	revoked_at IS NULL.
	•	now() < expires_at.

Server-side flow:
	1.	Extract shareToken from route param.
	2.	Use Supabase anon client in a server component or Route Handler:

const { data: share } = await supabase
  .from("report_shares")
  .select("*, reports(*)")
  .eq("token", shareToken)
  .maybeSingle();


	3.	RLS on report_shares ensures:
	•	Only valid (non-expired, non-revoked) tokens return a row.
	4.	If no row → show “Link expired or invalid” (localized).
	5.	If row exists → render localized report from share.reports.report_json.

Optionally: if user is authenticated and happens to be the owner, we can also show extra controls (e.g. “Extend expiry”, “Revoke link”), but this is not required for the base flow.

8.2 Creating / Managing Share Links (Owner side)

Owner actions (requires auth, handled in UI on /[lang] or a small management UI):
	•	Create/Update share for a report:
	•	Call POST /api/reports/:id/share with expires_at (or TTL).
	•	API:
	•	Uses requireActiveUser().
	•	Verifies the report belongs to the current user.
	•	Creates a new report_shares row with a new token and expires_at, or updates an existing one.
	•	Revoke share:
	•	Call POST /api/report-shares/:shareId/revoke.
	•	API:
	•	Uses requireActiveUser().
	•	Verifies the share belongs to a report owned by the user.
	•	Sets revoked_at = now().

⸻

9. API Endpoints (High-Level)

All endpoints are authenticated except the share page fetch (which uses token-based access via anon client).
	•	POST /api/reports
	•	Auth: requireActiveUser()
	•	Body: company details
	•	Action: create reports row, optionally create report_shares row, return token.
	•	POST /api/reports/:reportId/share
	•	Auth: requireActiveUser()
	•	Body: desired expires_at or TTL
	•	Action: create or update a report_shares record for that report, return token.
	•	POST /api/report-shares/:shareId/revoke
	•	Auth: requireActiveUser()
	•	Action: mark revoked_at = now().
	•	GET /api/admin/users (optional)
	•	Auth: requireAdmin()
	•	Action: list users.
	•	POST /api/admin/invite
	•	Auth: requireAdmin()
	•	Action: invite user, create app_users row.
	•	POST /api/admin/users/:id/disable
	•	Auth: requireAdmin()
	•	Action: disable user.
	•	POST /api/admin/users/:id/enable
	•	Auth: requireAdmin()
	•	Action: re-enable user.

The share page /[lang]/share/:token itself does not call any API; it queries Supabase directly (server-side) with the anon key, relying on report_shares RLS for security.

⸻

10. Security Notes
	•	Home page (/en, /de):
	•	Fully protected by Supabase Auth + requireActiveUser().
	•	Only invited, active users can generate reports or manage share links.
	•	Share page (/[lang]/share/:token):
	•	Publicly accessible via unguessable tokens.
	•	Time-limited and revocable via report_shares table.
	•	RLS ensures only valid tokens return data.
	•	Users:
	•	Cannot see or manage other users’ reports or share links.
	•	Disabled users cannot generate new reports or create/manage share links.
	•	Tokens:
	•	Must be long and random; treat as secrets.
	•	When expired or revoked, links immediately stop working.

⸻

11. Implementation Checklist
	1.	Create/alter Supabase tables:
	•	app_users
	•	reports
	•	report_shares
	2.	Enable RLS on all three tables and add policies:
	•	Owner/admin for app_users, reports, report_shares.
	•	Public token-based read-only policy on report_shares (+ join to reports).
	3.	Implement server-side Supabase client factory for:
	•	Authenticated server calls.
	•	Anon server calls (for share page).
	4.	Implement helpers:
	•	getCurrentAppUser()
	•	requireActiveUser()
	•	requireAdmin()
	5.	Protect home pages /en, /de with requireActiveUser().
	6.	Implement POST /api/reports (generate report + optional share link).
	7.	Implement share management APIs (create/update share, revoke).
	8.	Implement /[lang]/share/:token:
	•	Fetch via report_shares + reports using anon client and token.
	•	Handle expired/invalid tokens gracefully.
	9.	Implement admin APIs for invite/disable/enable.
	10.	Test:
	•	Invite-only access.
	•	Disabled user behavior.
	•	Public share link:
	•	Works within validity window.
	•	Fails when expired/revoked.
	•	Fails for random/invalid tokens.

