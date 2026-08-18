# Admissions Management — Product Record

## Problem statement
Using the supplied Admission Management MVP file, build a complete mobile admissions application.

## Architecture
- Expo SDK 54 mobile client with Expo Router, React Native components, safe-area layouts, and Material Community/Ionicons.
- FastAPI service on `/api` with MongoDB persistence through Motor.
- Applicant documents model admissions intake, CQ/MQ quota, CQ phases, review stages, fee position, activity history, and checklist state.

## User personas
- Admissions officer: finds applications, checks documents, advances review stages.
- Reviewer: opens applicant detail, reviews evidence, and records decisions.
- Program administrator: monitors admissions volume, quota mix, pending documents, and collected fees.

## Core requirements (static)
- Dashboard with applications, admitted, document-pending, and fee metrics.
- Searchable/filterable applicant queue.
- Applicant detail with stage workflow, document checklist, fee position, and activity.
- Create applicant/application record.
- Persist stage, document, and payment changes.
- Reject duplicate application numbers, invalid documents, and overpayments.
- Mobile-first responsive layout with accessible 44px touch targets and stable test IDs.

## Implemented
- 2026-08-18: Replaced starter image screen with the Admissions overview and queue shell.
- 2026-08-18: Added live FastAPI/MongoDB dashboard, applicant list/search, applicant creation, stage updates, document updates, and payment endpoint.
- 2026-08-18: Added seeded first-run operational records so the dashboard has an immediately usable admissions queue.
- 2026-08-18: Added warm Swiss visual system, detail modal, wrapped mobile stage controls, checklist feedback, fee progress, pull-to-refresh, and create form.
- 2026-08-18: Verified backend with curl and full Expo regression testing at 390x844; no mocked APIs.

## Prioritized backlog
1. Add authenticated role-based staff access and audit logs.
2. Add course/intake and academic-year administration screens.
3. Add CQ/MQ transfer history with required reason and permissions.
4. Add fee receipt history and reporting/export views.
5. Add document upload/storage with real files and privacy retention controls.

## Remaining priorities
- P0: None for the current admissions queue MVP.
- P1: Authentication, roles, audit trail, and document uploads.
- P2: Reports, CSV export, course configuration, and notifications.

## Next task list
- Define staff roles and login/session requirements.
- Add course and intake data management.
- Replace first-run seed records with institution onboarding/import.