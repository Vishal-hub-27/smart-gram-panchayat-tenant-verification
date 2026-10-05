# Smart Gram Panchayat Tenant Management System

A MERN-stack administrative system for managing owners, houses, rooms,
tenants, families, verification, and residence history for a Gram Panchayat.

This repo is being built in phases. **Phases 1–10 (setup through
notifications/audit logs) — done. Phase 11 (this commit): Admin Dashboard,
Global Search, and Reports.**

## Project Structure

```
gram-panchayat/
├── server/     Node.js + Express + MongoDB API (MVC architecture)
└── client/     React + Vite frontend
```

## Phase 11 — What's Included

Admin finally gets an overview instead of only a verification queue.

**Backend**
- `controllers/reportController.js`:
  - `GET /api/reports/dashboard` — the stat cards from spec §17 (owners,
    houses, rooms, active tenants, families, pending applications,
    correction-required, available rooms, moved-out, pending transfers/
    move-outs). "Available rooms" means rooms with *any* free slot, not
    total empty slots.
  - `GET /api/reports/charts` — all six charts spec §17 lists: monthly
    registrations, active-vs-inactive, single-vs-family, house occupancy,
    tenant movement, pending-vs-approved. All computed with Mongo
    aggregation pipelines rather than pulling documents into Node to count.
  - `GET /api/reports/tenants`, `/houses`, `/movement` (spec §22), each
    filterable by `?year=2026` or `?from=&to=`, each with `?format=csv`
    for a one-row CSV download (spec: "Provide export functionality if
    practical") via a small dependency-free `utils/csv.js`.
- `controllers/searchController.js` — `GET /api/search?q=...` (spec §18).
  An exact `O-/H-/T-/F-2026-NNNN` pattern is checked first (unambiguous),
  then an exact phone match, then a fuzzy name match across tenants,
  families, and owners — in that order, stopping at the first tier that
  finds something.
- Both are admin-only; owners already have scoped search/filter on their
  own Tenants/Families/Houses lists from earlier phases.

**Frontend**
- `AdminDashboard.jsx` rewritten with 12 stat cards and 8 charts, rendered
  with a small dependency-free `BarChart` component (no charting library
  added — the data is already pre-aggregated server-side, so a lightweight
  CSS bar list is all that's needed and keeps the bundle small).
- `GlobalSearch.jsx` — search box, results table, click-through to the
  matching tenant/family.
- `Reports.jsx` — the three reports side by side with year/date filters
  and an "Export CSV" link per report.
- `TenantDetails`/`FamilyDetails` are now reachable by admin too (new
  `/admin/tenants/:id`, `/admin/families/:id` routes), read-only — the
  owner-only actions (resubmit, transfer, move-out) are hidden via a role
  check inside the same component, rather than building parallel
  admin-only detail pages.

**Scope boundary worth knowing:** Owner and House browsing pages for admin
don't exist yet — spec §3 lists "View owners" and "View houses" as admin
capabilities, and the backend already supports it (the existing
owner-scoped list endpoints already branch to "all" for admin), but no
admin-facing House/Owner list or detail *page* has been built. Global
Search still returns owner/house matches for reference, just without a
click-through. Tenants and families — the actual subjects of verification,
transfer, and move-out — are where admin's day-to-day work happens in
this build, so they got full pages first.

## Phase 10 — What's Included

Two things the earlier phases were missing: owners had to *go looking* to
learn a decision, and admin actions left no permanent trace.

**Notifications (spec §20)**
- `models/Notification.js`, `services/notificationService.js`,
  `controllers/notificationController.js` — `GET /api/notifications`
  (optionally `?unread=true`), `GET /api/notifications/unread-count`,
  `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`.
  Every query is scoped to the logged-in user's id taken from the session,
  never from the request, so nobody can read another user's notifications.
- **Owners are told** when an application is submitted, approved, rejected,
  or needs correction, when a transfer is approved/rejected, and when a
  move-out is confirmed/rejected. **Admins are told** about new
  applications, resubmissions after correction, and transfer/move-out
  requests. Each notification carries a role-appropriate `link`, so
  clicking it opens the right record.
- **Email/SMS-ready (spec §20).** Delivery goes through a list of channels;
  today there is one (in-app). Adding email or SMS later means adding one
  `{ name, send() }` object to that list — no call sites change.
- **A failed notification can never break the action that triggered it.**
  Notifications are a side effect of something that already succeeded (an
  approval), so every path catches and logs instead of throwing.
- Frontend: a 🔔 bell in the navbar with an unread badge (polls a cheap
  count endpoint every 45s and refreshes instantly when you act on the
  Notifications page), plus a Notifications page with All/Unread, mark-read
  on click, mark-all-read, and pagination.

**Audit logs (spec §21)**
- `models/AuditLog.js`, `services/auditService.js`,
  `controllers/auditController.js` — `GET /api/audit-logs` (admin only),
  filterable by action, target type and date range.
- Recorded: approve / reject / request-correction (tenant and family),
  transfer approve/reject, move-out approve/reject — each with the admin's
  ID and name (matching the spec's *"Admin: A1001, Action: APPROVED_TENANT"*
  example), the target, and a details line. Approving also *activates* the
  record, so it covers the spec's "Activate" case.
- **Tamper-resistance in three layers:** no create/update/delete endpoint
  exists; the route is admin-read-only; and the schema itself refuses
  `update*`, `delete*`, `replaceOne`, `findOneAnd*` and re-saves, so a
  future coding mistake can't quietly rewrite history through Mongoose.
- Frontend: an Audit Logs page for admins with filters and pagination.

**Things to know**
- Audit writes are **best-effort and happen after the action commits**: if
  the audit insert failed, the approval would still stand and the failure
  is logged to the server console. A stricter deployment could write the
  audit row first and abort on failure — a trade-off worth revisiting
  before production.
- Only **admin** actions are audited. Owner actions (registering a house,
  submitting an application, deactivating a house) are not, and spec
  §21's "Create / Update / Deactivate" is covered only where an admin
  performs them.
- Notifications are **polled, not pushed** (no WebSockets) — simple and
  adequate for this scale, at the cost of up to ~45s delay on the badge.

## Phase 9 — What's Included

The rest of the tenant/family lifecycle: an active resident can be moved to
a different room, or move out — and either way their history is preserved.

**Backend**
- `models/ResidenceHistory.js` — the append-only timeline from spec §16.
  Each document is one continuous residence period; `toDate: null` marks
  the *current* one. There is only ever one open period per subject
  (Rule 4), and closed periods are never edited or deleted (Rule 8). The
  first period is opened in `verificationController.approveVerification`;
  transfers close it and open the next; move-outs close it.
- `models/ResidenceRequest.js` — *not in the original model list*, but
  spec §14 and §15 both describe an owner-requests → admin-confirms flow,
  so one model with a `requestType` (`transfer` | `move_out`) backs both
  queues rather than two near-identical models.
- `controllers/residenceRequestController.js`:
  - **Transfer** approval re-checks the destination room's capacity at
    approval time (Rule 3), closes the old history period, moves the
    occupancy count between rooms (using the family's full headcount),
    opens a new period, and updates the subject's house/room.
  - **Move-out** approval closes the period, decrements room occupancy
    (floored at 0), and sets `MOVED_OUT`.
  - `GET /api/tenants/:id/history` and `/families/:id/history` return the
    timeline (owner sees their own, admin sees any).
- `controllers/residenceHelpers.js` now also holds the shared
  `getSubjectModel` / `getOccupantCount` helpers, so approval, transfer and
  move-out all count headcount identically.
- Since spec §30 lists its endpoints as *examples*, I added
  `POST /api/transfers/:id/reject` and an admin queue at `/api/move-outs`
  (list / approve / reject) — without them the "admin approval required"
  rule (Rule 11) couldn't actually be enforced.

**Design decisions worth knowing**
- **Transfers are same-owner only.** Both the old and new room must belong
  to the requesting owner, like every other action in the system (Rule 2).
  A tenant has no identity-verification step for being "claimed" by a
  different owner — unlike a family, which a new owner can claim via
  Phase 5's OTP flow — so cross-owner tenant transfer would need a
  mechanism the spec doesn't define.
- **`TRANSFERRED` isn't used as a terminal status here.** A transfer keeps
  the same record `ACTIVE` at its new location, with the event captured in
  `statusHistory` and `ResidenceHistory`.
- **Atomicity (Rule 10 says "where possible").** Real multi-document
  transactions need a MongoDB replica set, which a plain standalone
  `mongod` doesn't provide. Writes are ordered so nothing changes until
  the capacity check passes, minimizing the window for a half-applied
  transfer. If you deploy on a replica set (e.g. Atlas), wrapping
  `approveTransfer` in a session transaction would be the natural upgrade.

**Frontend**
- `TenantHistory.jsx` (one page for tenants *and* families, chosen by
  route) — a timeline of every residence period
- `TransferTenant.jsx`, `MoveOut.jsx` — owner request forms, reached from
  new buttons on the tenant/family detail pages (shown only when ACTIVE)
- `ResidenceRequestQueue.jsx` — admin queue with Transfers / Move-Outs
  tabs, confirmation dialogs before approving

## Phase 7 — What's Included

This is where everything built so far gets *used*. Applications submitted
in Phases 4–5 finally get reviewed, and this is the only place Tenant/Family
IDs and room occupancy counts are ever touched.

**Backend**
- `models/Verification.js` — a queue/index across both Tenant and Family
  submissions. Kept deliberately separate from Tenant/Family's own
  `status` field: that field remains the source of truth for the subject's
  lifecycle, but an admin queue needs to list "everything awaiting review"
  across two collections without merging results from two queries every
  request. Detailed status timelines still live on the subject's own
  `statusHistory` (Phase 4/5) — this model doesn't duplicate that.
- `services/verificationQueueService.js` — `upsertVerification()` creates
  or refreshes the queue entry on submission/resubmission, reusing an
  existing open entry rather than creating duplicates
- `controllers/verificationController.js`:
  - `GET /pending` — oldest-first queue, with a lightweight subject
    preview (name + whether it was duplicate-flagged) without a full populate
  - `GET /:id` — full detail for the split verification screen: subject,
    owner, house, room, members (if family)
  - `POST /:id/approve` — **re-checks room capacity at approval time**
    (not just trusting the submission-time check — another application may
    have filled the room since), then generates the permanent Tenant/Family
    ID via `idGeneratorService` (spec §12: only ever happens here),
    increments `room.currentOccupancy` by the correct headcount, and sets
    the subject to `ACTIVE`
  - `POST /:id/reject` and `POST /:id/correction` — the correction endpoint
    takes a list of line-item issues (matching spec §11's example format),
    stored on both `Verification.correctionNotes` and folded into the
    subject's `statusHistory` note so the owner sees it without needing
    access to the Verification collection at all (owners never get direct
    API access to `/api/verifications` — it's admin-only throughout)
- New resubmission endpoints closing the loop spec §11 describes
  (*Correction Required → Owner Updates → Resubmit → Re-verify*):
  `PUT /api/tenants/:id` and `PUT /api/families/:id`, both gated to only
  work while status is `CORRECTION_REQUIRED`, both re-validating room
  capacity if the residence changed, both refreshing the Verification
  queue entry back to `RESUBMITTED`

**Frontend**
- `pages/VerificationQueue.jsx` — admin queue, filterable by type, shows a
  ⚠ marker for duplicate-flagged applications
- `pages/VerificationDetails.jsx` — the split screen from spec §26:
  application/owner/house/room details on the left, documents + a
  (non-blocking, informational) verification checklist on the right,
  Request Correction / Reject / Approve at the bottom. Approve shows a
  confirmation dialog first, per spec
- Owner-facing: `TenantDetails`/`FamilyDetails` now show correction notes
  inline and an "Update & Resubmit" flow when an application needs fixes

## A note on scope

Notifications (Phase 10 in the original plan) don't exist yet, so an owner
only learns about a correction request or rejection by checking the
application's detail page themselves — there's no push/in-app alert yet.
This is expected at this stage of the build, not an oversight.


## Phase 5 — What's Included

Family registration supports both flows from spec §8.

**Existing Family flow** (a family relocating to a new owner's house):
`GET /api/families/lookup/:familyId` returns only a masked, non-sensitive
preview. `POST .../send-otp` and `.../verify-otp` confirm the *current*
family head's phone actually matches the one on record — this is what
stops one owner from fraudulently claiming another family's residence
by simply guessing a Family ID. Verification is single-use and time-boxed
(10 minutes) via a `headOtpVerifiedAt` timestamp that
`PUT /api/families/:familyId/residence` checks and then consumes. On
success, the family's `ownerId`/`houseId`/`roomId` move to the new owner
and its status resets to `SUBMITTED` for re-review.

**New Family flow:** head details → dynamic member list → duplicate check
→ house/room (capacity checked for the **whole family's headcount**, not
just 1 — a family of 4 needs 4 free slots) → documents → submit. Members
are stored as their own `FamilyMember` records referencing the `Family`,
per spec §8.

**Backend**
- `models/Family.js`, `FamilyMember.js` — `familyId` deferred until admin
  approval, same pattern as `Tenant`; OTP fields live directly on `Family`
  since a family head isn't necessarily a `User` account in this system
- `utils/statusEnums.js` — the SUBMITTED→...→ACTIVE lifecycle extracted
  into one shared constant so `Tenant` and `Family` can't drift apart
- `controllers/residenceHelpers.js` — the house/room ownership+validation
  logic extracted out of `tenantController` so `familyController` reuses
  the exact same checks rather than a parallel copy
- `controllers/duplicateController.js` — one shared duplicate-check
  handler for both `/api/tenants/duplicate-check` and
  `/api/families/duplicate-check`; the underlying service now searches
  both `Tenant.phone` and `Family.headPhone` together
- Rate-limited OTP endpoints (same rationale as Phase 2's auth OTP limits
  — repeatedly guessing Family IDs to spam a head's phone is the obvious
  abuse vector here)

**Frontend**
- `pages/FamilyManagement.jsx` — list with status filter + search
- `pages/AddFamily.jsx` — a mode toggle between the New Family wizard
  (5 steps, with an inline add/remove member table) and the Existing
  Family claim flow (ID entry → OTP → residence update form)
- `pages/FamilyDetails.jsx` — profile page showing head, members table,
  current residence, and documents

## A note on scope (carried over from Phase 4)

The original phase plan separated "single tenant registration" (Phase 4)
from "document upload + duplicate detection" (Phase 6). Spec §7's own flow
treats those as inseparable, so Phase 4 already included working document
upload and duplicate detection. Phase 5 extended that duplicate check to
also cover Family records, as planned. Phase 6 will hold what's left:
cross-cutting hardening like an admin-facing duplicate-resolution view.

## Phase 4 — What's Included

**Backend**
- `models/Tenant.js` — `tenantId` stays unset until admin approval (Phase 7),
  matching spec §7/§12 exactly. Every status transition is recorded in
  `statusHistory` (spec §10: "every status change should be recorded")
- `services/duplicateCheckService.js` — matches on phone number (the only
  reliable non-sensitive identifier this system collects); never
  auto-merges, only surfaces possible matches for a human to resolve
- `controllers/tenantController.js`:
  - `GET /api/tenants/duplicate-check` — the frontend calls this before
    letting the owner proceed past the details step
  - `POST /api/tenants` — **re-runs the duplicate check server-side
    regardless of what the frontend did**, so a direct API call can't skip
    the warning; requires `duplicateAcknowledged=true` to proceed once a
    match is found
  - Room capacity is checked at submission time via `hasAvailableSpace()`
    (same Rule-3 utility from Phase 3) — a full room is rejected with the
    exact message from spec §29
  - House/room ownership resolved from the authenticated session only,
    same Rule-2 pattern as Phase 3
- `middleware/uploadMiddleware.js` extended with `handleFieldsUpload` for
  forms that submit a photo + multiple documents in one request
- `utils/fileUrl.js` — shared helper for turning a Multer file into a
  public URL (also refactored `houseController` to use it, replacing the
  ad-hoc path-splitting from Phase 3)

**Frontend**
- `pages/TenantManagement.jsx` — tenant list with status filter + search
- `pages/AddSingleTenant.jsx` — 4-step wizard (Details → House & Room →
  Documents → Review & Submit), with the duplicate warning shown inline
  and requiring explicit "Continue Anyway" before proceeding
- `pages/TenantDetails.jsx` — tenant profile with current residence and
  uploaded documents/photo
- `StatusBadge` extended to cover the full tenant lifecycle
  (SUBMITTED/UNDER_REVIEW/APPROVED/ACTIVE/REJECTED/etc.)

## Prerequisites

- Node.js 18+
- MongoDB running locally (or an Atlas connection string)

## Setup

### 1. Backend

```bash
cd server
cp .env.example .env
# edit .env: set MONGO_URI and a real JWT_SECRET
npm install
npm run dev
```

The API starts on `http://localhost:5000`. Confirm it's alive:

```bash
curl http://localhost:5000/api/health
```

Expected response:

```json
{
  "success": true,
  "message": "Gram Panchayat API is running",
  "data": { "env": "development", "time": "..." }
}
```

If `MONGO_URI` or `JWT_SECRET` are missing from `.env`, the server will
refuse to start and tell you exactly what's missing — it won't fail silently.

### 2. Frontend

```bash
cd client
cp .env.example .env   # points VITE_API_URL at the backend
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`) — you'll land
on the Login page. If MongoDB isn't running, the backend itself won't
start, and API calls from the frontend will fail with a connection error —
that's the expected way to catch a missing DB connection early.

## How to Test This Phase

**Single tenant flow (Phase 4, still works):**
1. Start MongoDB + backend + frontend; make sure you have at least one
   house with an active room (Phase 3).
2. Go to **Tenants → + Add Tenant**, complete the wizard.

**New family flow:**
3. Go to **Families → + Add Family**, leave the mode on **New Family**.
4. Fill in the head's name/phone, click **Next** — the duplicate check
   fires automatically against both tenants and families.
5. Add 2–3 members, then go to **House & Room** — notice rooms that don't
   have enough free slots for the *whole family* are disabled, not just
   rooms that are completely full.
6. Complete the wizard. Confirm you land on the family's profile page
   showing status **Submitted**, the members table, and no Family ID yet.

**Existing family claim flow** (now fully testable end-to-end, since
Phase 7 generates real Family IDs on approval — no more manually setting
one in MongoDB):
7. Approve a family application first (see Phase 7 steps below) to get a
   real `familyId`, then go to **Families → + Add Family → Existing
   Family**, enter that ID, click **Find Family**.
8. You should see a masked-phone preview, then an OTP screen. The OTP is
   shown directly in dev mode (`OTP_MOCK_MODE=true`) — enter it.
9. Confirm you now see the members table and a residence-update form.
   Pick a different house/room (owned by the currently logged-in owner)
   and submit — the family should move under this owner and reset to
   **Submitted**, ready for the admin to review again.
10. Try submitting again without going through OTP again — it should be
    rejected with "Phone verification required."

**Cross-cutting checks (Phase 5):**
11. Log in as a second owner and confirm they cannot see the first
    owner's tenants or families.
12. Try the family duplicate warning by creating two families (or a
    family and a tenant) with the same phone number.

**Phase 6 checks:**
13. Repeat the duplicate-warning test from step 12, but click **Continue
    Anyway**. Open the resulting tenant/family's detail page — you should
    see a red "⚠ Flagged as a possible duplicate at submission" banner.
14. Try uploading a genuinely corrupt/renamed file as a document (e.g.
    rename a `.txt` file to `.jpg` and try uploading it) — it should be
    rejected with "does not look like a valid file of an allowed type,"
    even though the browser will send `Content-Type: image/jpeg`.

**Phase 7 checks (the full verification loop):**
15. Log in as the seeded admin (`npm run seed` if you haven't), go to
    **Verification Queue** — you should see every SUBMITTED tenant/family
    from earlier steps, oldest first, with a ⚠ next to any duplicate-flagged
    ones.
16. Open one, review the split screen (left: details, right: documents +
    checklist), click **Approve**, confirm the dialog. You should land back
    with a message showing the generated Tenant/Family ID.
17. Check the room's occupancy on the House Details page — it should have
    incremented by 1 (tenant) or by the family's full headcount.
18. On another pending application, click **Request Correction**, enter a
    couple of lines like "Photograph missing" / "Address incomplete", and
    submit. Log back in as the owner and open that application — you
    should see both lines as a bulleted list and an **Update & Resubmit**
    button.
19. Use that button, change a field, and resubmit. Confirm it disappears
    from "awaiting correction" and reappears in the admin's Verification
    Queue with status **Resubmitted**.
20. Try approving an application for a room that's since been filled by
    another approval — it should be rejected with a capacity message
    instead of silently over-filling the room.

**Phase 9 checks (transfer, move-out, history):**
21. As an owner with an **active** tenant and a second room with free space,
    open the tenant → **Transfer**, pick the new room, submit. Nothing
    changes yet — the tenant is still in the old room.
22. As admin, open **Transfers & Move-Outs**, approve it. Check both
    rooms on House Details: old room's occupancy down by 1, new room's up by 1.
23. Open the tenant → **View Residence History**. You should see two
    entries: the old room (ended, "Transfer") and the new one ("Present").
24. Repeat with an active **family** and confirm the occupancy change
    equals head + members, not 1.
25. Request a transfer into a room, then fill that room via another
    approval before approving the transfer — approval should be refused
    with a capacity message.
26. Open an active tenant → **Move Out**, pick a date, submit; approve it as
    admin. Confirm status becomes **Moved Out**, occupancy drops, and the
    history shows the period ended with "Move-out". The record itself is
    never deleted.
27. Try transferring/moving out a tenant that isn't ACTIVE (e.g. still
    Submitted) via the API — it should be refused.

**Phase 10 checks (notifications and audit logs):**
28. As an owner, submit a tenant application. The 🔔 in your navbar should
    show 1 unread ("Submitted"). As admin, the bell should show a "New
    application" notification.
29. As admin, click that notification — it should mark as read (badge
    drops) and open the Verification Queue.
30. Approve the application. Log in as the owner: an "Approved" notification
    with the new Tenant ID appears, linking to the tenant's page.
31. Request a correction on another application. The owner's notification
    should be styled as needing attention and include your correction lines.
32. Open **Audit Logs** as admin — you should see `APPROVED_TENANT` and
    `CORRECTION_REQUESTED_TENANT` entries with your Admin ID and the
    target. Try the action/date filters.
33. Confirm tamper-resistance: `PUT`/`DELETE` on `/api/audit-logs/:id` should
    return 404 (no such route), and in a Mongo shell an `updateOne` through
    the app's model is refused.
34. As owner A, confirm you can't see owner B's notifications (each list
    only ever contains your own).

**Phase 11 checks (dashboard, search, reports):**
35. Log in as admin — the Dashboard should show real counts (not zeros, if
    you've approved anything in earlier phase testing) and 8 charts. An
    empty system should show clean zero-states, not errors.
36. Go to **Search**, enter a real Tenant ID (e.g. `T-2026-0001`) — it
    should jump straight to that tenant via the exact-ID path. Then search
    a phone number, then a partial name — confirm both return sensible
    results.
37. Search something that matches nothing — confirm a clean empty state,
    not an error.
38. Go to **Reports**, try the year filter vs. the from/to date filter
    (they should be mutually exclusive in the UI). Click **Export CSV** on
    each of the three reports and confirm a file downloads with the right
    headers and one data row.
39. From Search, click into a tenant/family as admin — confirm you can
    view it but the Resubmit/Transfer/Move Out buttons are gone (compare
    with viewing the same record as its owner, where they're present).
40. Confirm an owner still cannot reach `/admin/search` or `/admin/reports`
    (should redirect, per the existing role-based routing).

## What's Next — Phase 12

QR verification (spec §19): a QR code on an approved tenant/family record
pointing at a public verification page that exposes only minimal,
non-sensitive information — no documents, no full address, just enough to
confirm "this person is a verified, active resident here."
