# Client Release Checklist (Zoko Pro)

## A) Pre-release technical checks

1. Run dependency and build checks:
   - npm audit
   - npm run build
2. Validate backend starts without errors:
   - npm run start:backend
3. Confirm health endpoint:
   - GET /api/health returns status=ok

## B) Database and migration checks

1. DATABASE_URL is set on hosting platform.
2. Migration executed once:
   - npm run migrate:postgres
3. Verify data in database:
   - users table has records
   - tasks table has records

## C) Functional QA checks

1. Register a new account.
2. Login with the new account.
3. Create task, update task, complete task, delete task.
4. Backup export and restore test.
5. Logout then login again (token revocation path tested).

## D) Security checks

1. ALLOWED_ORIGINS restricted to production domain.
2. No wildcard CORS in production.
3. RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX configured.
4. No secrets committed in repository.
5. Email credentials configured only if reminder emails are needed.

## E) Deployment checks

1. Build command:
   - npm install && npm run build
2. Start command:
   - npm run start:backend
3. HTTPS is enabled by hosting provider.
4. Logs show no startup/storage errors.

## F) Client handoff checks

1. Share production URL.
2. Share admin/test account credentials securely.
3. Share known limitations and next roadmap.
4. Confirm support contact and incident response workflow.
