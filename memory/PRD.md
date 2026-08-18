# Admissions Management — Product Requirements Document

## Original Problem Statement
Migrate a PHP/MySQL admissions MVP to an Expo (React Native) + FastAPI + MongoDB mobile app.
Implement admissions workflows (dashboard, queue, applicant detail, review stages, document
checklist, fee tracking) and expand with secure staff access, course setup, document review,
and reports. Finally, package the code into a downloadable ZIP.

## Architecture
- **Frontend**: Expo Router (file-based), tab navigation, JWT auth context, Toast provider.
  - `app/_layout.tsx` — AuthProvider + ToastProvider + auth gate (redirects login ↔ (app))
  - `app/login.tsx` — staff login with demo-account quick sign-in
  - `app/(app)/` — tab group: `index` (Overview), `applications`, `reports`, `settings`
  - `src/` — `api.ts` (fetch client + Bearer), `context/auth.tsx`, `context/toast.tsx`,
    `components/common.tsx`, `components/modals.tsx`, `theme.ts`, `types.ts`
- **Backend**: FastAPI + Motor (async MongoDB), JWT (PyJWT) + bcrypt, role-based access.
  - Routes prefixed `/api`; ObjectId `_id` never serialized.
- **Auth**: JWT username/email + password. Roles: `admin`, `reviewer`, `lecturer`, `office`.
  Accounts seeded idempotently on startup.

## User Personas
- **Admin (Registrar)**: full control — applicants, courses, staff, reports.
- **Reviewer / Lecturer**: review applications, move stages, verify documents, read reports.
- **Office**: intake — create applicants, update documents, record fee payments.

## Core Requirements (static)
- Secure staff login with role-based permissions.
- Applicant lifecycle: New → Documents → Under review → Admitted.
- Document checklist per applicant; fee tracking with payments.
- Course catalog setup (CRUD).
- Reports: pipeline by stage, by course, by quota, fee collection + shareable summary.

## Implemented (2026-08-18)
- JWT auth (login/me), bcrypt hashing, idempotent seeding of 4 role accounts.
- RBAC across all mutating endpoints.
- Dashboard metrics, applicant queue with search + stage filter, applicant detail
  (stage change, document toggle, payment recording).
- Course CRUD (admin), staff CRUD (admin), Reports endpoint with share_text.
- Full mobile UI: login, Overview, Applications, Reports, Settings tabs; Toast feedback.
- **Applicant editing** (admin+office PATCH) and **delete** (admin, with confirm).
- **Document file uploads** per checklist item via Emergent Managed Object Storage,
  with authenticated view/download (`/api/files/...?token=`).
- **Bulk CSV import** of applicants (admin) — pick file or paste rows.
- Verified: 32/32 backend tests pass; frontend flows + RBAC verified.
- Downloadable ZIP generated at `/app/admissions-management.zip`.

## Backlog / Remaining
- **P1**: Edit/delete applicant; generate offer letters (PDF).
- **P2**: Clear cached state on sign-out to remove transient 401 log; migrate deprecated
  RN-Web `shadow*` props to `boxShadow`.
- **P2**: Document upload with Emergent Object Storage (currently checklist toggles only).

## Test Credentials
See `/app/memory/test_credentials.md`.

## Key API Endpoints
- POST `/api/auth/login`, GET `/api/auth/me`
- GET `/api/dashboard`, GET/POST `/api/applicants`, PATCH stage/documents, POST payments
- GET/POST/PATCH/DELETE `/api/courses`
- GET/POST/DELETE `/api/staff`
- GET `/api/reports`
