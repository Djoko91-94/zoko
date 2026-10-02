# Zoko Pro Deployment Guide

## 1) Local development

1. Install dependencies:
   npm install
2. Start backend API:
   npm run start:backend
3. In a second terminal, start frontend:
   npm run dev:zoko

## 1.1) PostgreSQL mode (recommended)

1. Ensure PostgreSQL is running and create a database (example: `zoko`).
2. Set `DATABASE_URL` in `.env`.
3. Migrate existing JSON data:
   npm run migrate:postgres
4. Start backend:
   npm run start:backend

When `DATABASE_URL` is set, backend uses PostgreSQL. Without it, backend falls back to `backend-data.json`.

## 2) Environment variables

Copy `.env.example` to `.env` and set values:
- `PORT`: backend port
- `ALLOWED_ORIGINS`: comma-separated frontend origins
- `RESEND_API_KEY`: required for reminder emails
- `RESEND_FROM_EMAIL`: sender address

## 3) Production readiness checklist

- Configure HTTPS on hosting platform.
- Restrict `ALLOWED_ORIGINS` to your real frontend domain.
- Tune `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` for your expected traffic.
- Set strong secrets and do not commit `.env`.
- Monitor server logs and API errors.
- Validate email sending in staging first.

## 3.1) Security now included

- `helmet` headers enabled.
- API/global rate limiting enabled (`express-rate-limit`).
- Auth-specific rate limiting on login/register.
- Backend logout endpoint (`POST /api/logout`) revokes the current token.
- Expired auth tokens are cleaned periodically.

## 4) Current architecture

- Frontend: `zoko.html`, `zoko.js`, `zoko.css`
- Backend: `server.js` (Express)
- Storage: PostgreSQL (when `DATABASE_URL` is set) or `backend-data.json` fallback

Note: For production, prefer PostgreSQL and keep JSON fallback only for local tests.

## 5) Deploy on Render (example)

1. Push project to GitHub.
2. Create PostgreSQL in Render and copy its connection string.
3. Create a new Web Service from your repository.
4. Configure service:
   - Build command: `npm install && npm run build`
   - Start command: `npm run start:backend`
5. Set environment variables:
   - `PORT` = `3000`
   - `DATABASE_URL` = your Render PostgreSQL URL
   - `ALLOWED_ORIGINS` = your frontend URL(s)
   - `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (optional email reminders)
6. After first deploy, run migration job once:
   - `npm run migrate:postgres`

## 6) Deploy on Railway (example)

1. Create a new Railway project and connect your repository.
2. Add PostgreSQL plugin in Railway.
3. Set service variables:
   - `DATABASE_URL` from Railway PostgreSQL
   - `ALLOWED_ORIGINS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL` if needed
4. Configure commands:
   - Build: `npm install && npm run build`
   - Start: `npm run start:backend`
5. Run migration once:
   - `npm run migrate:postgres`

## 7) Quick go-live checklist

- `npm audit` shows no critical/high vulnerabilities.
- `/api/health` returns `status: ok`.
- Login/register/task CRUD works against backend.
- Backup restore tested with a real user account.
- CORS restricted to real domain (no wildcard in production).

## 8) Ready-to-use templates

- Render variables template: `.env.render.example`
- Railway variables template: `.env.railway.example`
- Client release checklist: `CLIENT_RELEASE_CHECKLIST.md`

## 9) Production-ready templates

- Render prod template: `.env.render.production.example`
- Railway prod template: `.env.railway.production.example`
- French quick setup: `PROD_ENV_SETUP_FR.md`

## 10) Platform config files

- Render Blueprint file: `render.yaml`
- Railway deploy file: `railway.json`
- Copy/paste variables guide: `PROD_VARIABLES_COPY_PASTE.md`
