# B-Secure Round 3 — Multi-organization mock skeleton

Fresh React + Vite + TypeScript + Tailwind frontend and persistent Node.js API workspace. The frontend is a clickable multi-tenant SaaS prototype using mock data only.

## What is implemented
- Welcome, mock login, sign-up, password-recovery placeholder, demo account selection, organization selector, create organization, and invitation screens.
- Data-driven users, organizations, memberships, per-organization roles, and workspace records.
- Role-filtered shared navigation and centralized mock permission checks.
- Create organization assigns the current user Admin and creates an empty isolated workspace.
- Creator can save a draft, run deterministic mock rule checks, submit for review; Manager can approve or request changes; feedback is visible to the Creator.
- Admin can view/invite mock members, change membership roles, remove members, edit rules, and toggle the TruthShift prototype.
- Demo state is stored in per-tab `sessionStorage`; role switching preserves changes in that session. Starting a new demo begins from seed data. Real mock accounts use `localStorage` separately.
- Seeded demo accounts all share AquaPulse. Password for the demo login form: `demo1234`.
- Mock invitation codes: `AQUA-CREATOR` and `NORTHSTAR-ADMIN`.

## Run locally
From the project root:

```powershell
npm install
npm run dev:frontend
```

Open the Vite URL printed in the terminal. To run the API skeleton separately, use `npm run dev:backend`; it currently only provides `/health`.

## Important limitations
All authentication, organization membership, permissions, review actions, invitation codes, and persistence are simulated in browser storage. These features are not secure and are not shared across devices. Analysis uses a small deterministic mock rule check; there is no AI, external API, Supabase, database, or real invitation delivery. TruthShift is a clearly labeled UI prototype only. The backend has no product routes or database connection.

Vercel is intended for the frontend. The Node API is intended to run as a persistent service on an Oracle Cloud VM; no serverless function deployment is used.
