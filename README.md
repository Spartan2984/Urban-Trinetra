# Urban Trinetra — Zero-Trust Municipal Accountability System

A civic complaint management platform where every claim must be **cryptographically proven**. Citizens cannot file complaints without being physically present. Officers cannot mark work as done without photographic evidence verified by AI. Resolutions can be vetoed and escalated to a randomly selected citizen jury.

---

## The Problem

Municipal complaint systems fail because there is no way to verify that reported issues are real, or that resolutions are genuine. Citizens file remote complaints. Officers close tickets without doing the work. There is no independent oversight. **Urban Trinetra** enforces accountability at every step.

---

## Architecture

```
Urban Trinetra/
├── frontend/         React + Redux SPA (Vite)       → Port 5173
├── backend/          Node.js + Express REST API      → Port 5000
├── ai-service/       Python FastAPI microservice     → Port 8000
└── images/           Source images for testing
```

The three services run concurrently. The backend is the single source of truth — the frontend never touches the database directly.

---

## Prerequisites

- **Node.js** v18+
- **Python** 3.9+
- **MongoDB** (local or Atlas)
- **Cloudinary** account (free tier works)

---

## Setup

### 1. Clone and install dependencies

```bash
git clone <your-repo-url>
cd Urban Trinetra
npm install           # installs root + starts concurrently
cd backend && npm install
cd ../frontend && npm install
```

### 2. Install Python dependencies for the AI service

```bash
pip install -r ai-service/requirements.txt
```

### 3. Configure environment variables

Copy the example files and fill them in:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**backend/.env** — required fields:

```env
MONGODB_URI=mongodb://localhost:27017/urban-trinetra
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_RESET_SECRET=your_reset_secret_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**frontend/.env**:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

### 4. Seed the database

Run the main seed script to create departments, staff accounts, and citizens:

```bash
cd backend
node src/seed.js
```

This creates:
- 1 Admin (`admin@fixmycity.local` / `AdminPass123`)
- 5 Supervisors (`supervisor1@fixmycity.local` … `supervisor5@fixmycity.local` / `StaffPass123`)
- 10 Officers (`officer1@fixmycity.local` … `officer10@fixmycity.local` / `StaffPass123`)
- 20 Citizens (`citizen1@example.com` … `citizen20@example.com` / `UserPass123`)

### 5. Seed demo complaints (optional)

To populate the dashboard with realistic complaints in various states:

```bash
node src/scripts/seed_demo_data.js
node src/scripts/seed_patch.js
```

### 6. Run the full stack

From the root:

```bash
npm run dev
```

This starts all three services concurrently. Open `http://localhost:5173`.

---

## Testing Images

The `images/` folder contains stock photos from Unsplash. To generate a full test suite with proper EXIF metadata for Mumbai locations, run:

```bash
cd backend
python src/scripts/create_variants.py
node src/scripts/generate_demo_suite.js
```

This creates `images/demo_suite/` with 24 files following this naming convention:

- `[Location]_Citizen_BEFORE.jpg` — Use when registering a complaint
- `[Location]_Officer_PASS_Success.jpg` — Use when requesting completion (passes AI check)
- `[Location]_Officer_FAIL_NoChange.jpg` — Simulates no visible work (AI blocks it)
- `[Location]_Officer_FAIL_WrongGPS.jpg` — Simulates armchair resolution (EXIF blocks it)

### Complaint Coordinates by Location

| Location | Latitude | Longitude |
|---|---|---|
| Bandstand, Bandra | 19.0433 | 72.8185 |
| Marine Drive | 18.9430 | 72.8230 |
| Gateway of India | 18.9220 | 72.8347 |
| Juhu Beach | 19.1075 | 72.8263 |
| Dadar Chowpatty | 19.0250 | 72.8360 |
| Worli Sea Face | 19.0000 | 72.8150 |

When registering a complaint, enter the coordinates that match the `_Citizen_BEFORE.jpg` image you are uploading.

---

## Utility Scripts

All scripts are in `backend/src/scripts/`. Run them from inside `backend/`.

| Script | Command | What it does |
|---|---|---|
| Wipe complaints | `node src/scripts/wipe_complaints.js` | Deletes all complaints, resets officer task counts |
| Seed demo data | `node src/scripts/seed_demo_data.js` | Creates 3 seeded complaints via Cloudinary upload |
| Patch demo data | `node src/scripts/seed_patch.js` | Adds the PENDING_AUDIT and CLOSED scenarios |
| Simulate time failures | `node src/scripts/simulate_time_failures.js` | Backdates SLA deadlines and audit due dates |
| Generate demo images | `node src/scripts/generate_demo_suite.js` | Generates all 24 test images with EXIF metadata |
| Inject EXIF metadata | `node src/scripts/metadata_injector.js` | Tags raw images with Mumbai GPS coordinates |

---

## Zero-Trust Verification Flow

1. **Complaint Registration** — The uploaded photo's EXIF GPS must be within 100m of the reported location and less than 48 hours old. The system rejects armchair reports.

2. **Resolution Request** — The officer's resolution photo is checked for EXIF validity, then sent to the AI microservice for Structural Similarity comparison against the original complaint photo. A score between 0.45 and 0.90 means the scene matches but visible work was done. Below 0.45 is a location mismatch. Above 0.90 means nothing changed.

3. **Citizen Verification** — The citizen can approve or veto the resolution. A veto triggers an Independent Audit.

4. **Citizen Jury** — Three high-reputation citizens are randomly selected as auditors. They have 36 hours to vote. Their votes are weighted by their reputation scores. Late votes incur a reputation penalty.

5. **Reputation & Accountability** — All staff have visible reputation scores. Officers and auditors who consistently underperform appear on a public "Hall of Shame" leaderboard.

---

## Roles

| Role | Credentials | Capabilities |
|---|---|---|
| Citizen | `citizen1@example.com` | File complaints, veto resolutions, vote as auditor |
| Officer | `officer1@urbantrinetra.local` | Accept tasks, submit resolution with proof |
| Supervisor | `supervisor1@urbantrinetra.local` | Assign tasks, review resolutions, manage team |
| Admin | `admin@urbantrinetra.local` | Full access, manual overrides |

---

## API

The REST API runs at `http://localhost:5000/api/v1`. Key endpoint groups:

- `POST /auth/login` — Returns access token (JWT) and sets refresh cookie
- `GET /complaints` — Paginated list with filters
- `POST /complaints` — Register a new complaint with photo
- `PATCH /complaints/:id/assign` — Supervisor assigns to officer
- `PATCH /complaints/:id/request-completion` — Officer submits resolution proof
- `PATCH /complaints/:id/review-completion` — Citizen approves or rejects
- `PATCH /complaints/:id/veto` — Citizen vetoes, triggers audit
- `POST /complaints/:id/audit-vote` — Auditor casts vote
- `GET /admin/leaderboards` — Reputation leaderboards
