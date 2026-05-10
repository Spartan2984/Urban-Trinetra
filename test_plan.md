# FixMyCity: Accountability & Zero-Trust Test Plan

This document outlines the end-to-end testing procedures for verifying image authentication, audit governance, and staff accountability.

---

## Scenario A: The Mumbai Bandstand Resolution (End-to-End)
**Purpose**: Verify EXIF location matching, AI SSIM verification, and the Audit Veto flow.

### Phase 1: Registration & Assignment
1. **Citizen Login**: `citizen1@example.com` / `UserPass123`
2. **Submit Complaint**: 
    - Category: `pothole`
    - Address: `Bandstand, Bandra West`
    - Coords: `19.0433, 72.8185`
    - Photo: `images/processed/before_abdullah-wafiyy-UkqwLshDGBY-unsplash.jpg`
3. **Supervisor Login**: `supervisor1@fixmycity.local` / `StaffPass123`
4. **Action**: Assign the complaint to `Officer 1`.

### Phase 2: Resolution & Veto
1. **Officer Login**: `officer1@fixmycity.local` / `StaffPass123`
2. **Action**: Click 'Request Completion' on the Bandstand task.
3. **Photo**: Upload `images/processed/after_acatinabox-g9gr38rDrlA-unsplash.jpg`.
4. **Citizen Login**: `citizen1@example.com`
5. **Action**: Click 'Veto Resolution' on the complaint.

### Phase 3: The Civic Audit
1. **Identify Auditors**: Look at the "Independent Audit Panel" on the complaint page to see the 3 selected citizens.
2. **Auditor Login**: Login as one of the selected citizens.
3. **Action**: Cast a 'Reject' vote from the Dashboard's "Required Audits" section.

---

## Scenario B: EXIF Security Bypass Test
**Purpose**: Verify that the system blocks fraudulent "armchair" reporting.

1. **Login as Citizen**.
2. **Attempt Registration**: Try to register a complaint at `Bandstand` but upload a photo taken at `Marine Drive` (e.g., `images/processed/before_ilya-semenov-tMDem_uk8wM-unsplash.jpg`).
3. **Expected Result**: Backend should return an error: *"The photo was taken X meters away from the reported location."*

---

## Scenario C: Reputation & The Loserboard
**Purpose**: Verify gamification and disciplinary visibility.

1. **Supervisor Review**: As a supervisor, reject a resolution that has failed an audit.
2. **Check Loserboard**: Navigate to the Dashboard. Verify the officer's face appears on the Loserboard (if their score dropped below 100).
3. **Verify Badges**: Open the officer's profile/card. Ensure the "Disciplinary Action" badge and "Salary Deduction" warning are visible.

---

## Database Verification Commands
Run these in the terminal to verify background state:

### 1. Check AI SSIM Score
```bash
# Get the most recent resolution attempt
node -e "const { Complaint } = require('./backend/src/models/Complaint'); await connectDb(); const c = await Complaint.findOne({ status: 'PENDING_AUDIT' }).sort({ updatedAt: -1 }); console.log(c.aiVerification);"
```

### 2. Verify Auditor Assignments
```bash
# See which citizens were selected for the current audit
node -e "const { Complaint } = require('./backend/src/models/Complaint'); await connectDb(); const c = await Complaint.findOne({ status: 'PENDING_AUDIT' }); console.log(c.auditors.map(a => a.auditor));"
```
