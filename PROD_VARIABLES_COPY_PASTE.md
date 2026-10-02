# Variables Production - Copy/Paste

## Render

Use these keys in Render Environment.

NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
ALLOWED_ORIGINS=https://your-frontend-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=200
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@your-domain.com

## Railway

Use these keys in Railway Variables.

NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME
ALLOWED_ORIGINS=https://your-frontend-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=200
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@your-domain.com

## Finalize

1. Replace DATABASE_URL with your real PostgreSQL URL.
2. Replace ALLOWED_ORIGINS with your real frontend domain.
3. Run migration once after first deploy: npm run migrate:postgres
4. Verify health endpoint: /api/health
