# Thunder Client Test Requests

Base URL:

```text
http://localhost:5000/api/v1
```

## 1. Health

`GET /health`

Expected:

```json
{
  "success": true,
  "message": "API is healthy",
  "data": {
    "uptime": 10,
    "mongoState": 1
  }
}
```

## 2. Register Citizen

`POST /auth/register`

```json
{
  "name": "Asha Citizen",
  "email": "asha@example.com",
  "phone": "9876543210",
  "password": "Citizen123"
}
```

Save `data.accessToken` and `data.refreshToken`.

## 3. Login

`POST /auth/login`

```json
{
  "email": "asha@example.com",
  "password": "Citizen123"
}
```

## 4. Create Complaint

Use `POST /complaints` with `Authorization: Bearer <citizen_access_token>`.

Body type: `form-data`

```text
category=pothole
title=Large pothole near bus stop
description=There is a large pothole near the main bus stop causing traffic risk.
priorityHint=high
address=MG Road bus stop, Bengaluru
longitude=77.5946
latitude=12.9716
contactName=Asha Citizen
contactPhone=9876543210
images=<attach jpg/png/webp>
```

Expected status: `201`.

## 5. Admin Login

After running seed:

`POST /auth/login`

```json
{
  "email": "admin@fixmycity.local",
  "password": "AdminPass123"
}
```

## 6. Create Department

`POST /admin/departments`

Use admin bearer token.

```json
{
  "name": "Street Lighting",
  "code": "LIGHT",
  "description": "Streetlight faults and electrical safety"
}
```

## 7. Create Officer

`POST /admin/users`

Use admin bearer token. Replace `department` with a real department `_id`.

```json
{
  "name": "Ravi Officer",
  "email": "ravi.officer@example.com",
  "phone": "9999999991",
  "password": "Officer123",
  "role": "officer",
  "department": "REPLACE_WITH_DEPARTMENT_ID"
}
```

## 8. Assign Complaint

`PATCH /complaints/<complaint_id>/assign`

Use admin or supervisor bearer token.

```json
{
  "assignedTo": "REPLACE_WITH_OFFICER_ID",
  "department": "REPLACE_WITH_DEPARTMENT_ID",
  "note": "Assigned to field officer"
}
```

## 9. Officer Status Update

Login as officer, then:

`PATCH /complaints/<complaint_id>/status`

```json
{
  "status": "IN_PROGRESS",
  "note": "Inspection started"
}
```

Then:

```json
{
  "status": "RESOLVED",
  "note": "Pothole filled and barricades removed"
}
```

## 10. Dashboard Metrics

`GET /complaints/metrics`

Use any authenticated role. Results are scoped by role.

## 11. Validation Checks

Create a complaint with a short description:

```text
description=too short
```

Expected status: `422`.

Upload a `.pdf` file as `images`.

Expected status: `415`.

Call admin route as citizen:

`GET /admin/audit-logs`

Expected status: `403`.
