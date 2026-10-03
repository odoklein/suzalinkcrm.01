# Deployment Workflow for CaptainProspect CRM

## Overview
This workflow covers deploying the CaptainProspect CRM Next.js application to production.

## Prerequisites
- Node.js 18+ installed
- Access to the production database
- Environment variables configured
- SSL certificate configured (for HTTPS)

---

## 1. Pre-Deployment Checklist

// turbo
- [ ] Run all tests: `npm test`
- [ ] Check TypeScript errors: `npx tsc --noEmit`
- [ ] Verify linting: `npm run lint`
- [ ] Update dependencies: `npm audit fix`
- [ ] Review environment variables in `.env.production`
- [ ] Backup production database

## 2. Environment Setup

Create `.env.production` file:

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# NextAuth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-secret-key-min-32-chars"

# Email (SMTP)
SMTP_HOST="smtp.provider.com"
SMTP_PORT="587"
SMTP_USER="user@domain.com"
SMTP_PASSWORD="password"

# External APIs
APOLLO_API_KEY="your-apollo-key"
OPENAI_API_KEY="your-openai-key"

# Storage (S3 compatible)
S3_ENDPOINT="https://s3.provider.com"
S3_BUCKET="captainprospect-uploads"
S3_ACCESS_KEY="access-key"
S3_SECRET_KEY="secret-key"

# Redis (for BullMQ)
REDIS_URL="redis://localhost:6379"
```

## 3. Database Preparation

// turbo
- [ ] Run Prisma migrations: `npx prisma migrate deploy`
- [ ] Verify migration success in database
- [ ] Generate Prisma client: `npx prisma generate`

## 4. Build Application

// turbo
```bash
# Install dependencies
npm ci --production

# Build the application
npm run build
```

## 5. Production Deployment

### Option A: Traditional Server (PM2)

// turbo
```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start npm --name "captainprospect" -- start

# Save PM2 config
pm2 save
pm2 startup
```

### Option B: Docker Deployment

// turbo
```bash
# Build Docker image
docker build -t captainprospect:latest .

# Run container
docker run -d \
  --name captainprospect \
  -p 5000:5000 \
  --env-file .env.production \
  captainprospect:latest
```

### Option C: Static Export (CDN)

// turbo
```bash
# Update next.config.ts
# Add: output: 'export'

# Build static export
npm run build

# Deploy 'out' folder to CDN (CloudFlare, Vercel, etc.)
```

## 6. Post-Deployment Verification

// turbo
- [ ] Verify application loads: `curl -I https://your-domain.com`
- [ ] Check SSL certificate validity
- [ ] Test login functionality
- [ ] Verify API endpoints: `/api/health`
- [ ] Check error logs: `pm2 logs captainprospect`
- [ ] Monitor error tracking (Sentry)

## 7. Worker Processes (Background Jobs)

// turbo
```bash
# Start enrichment worker
pm2 start --name "enrichment-worker" npm -- run worker:enrichment

# Monitor workers
pm2 status
pm2 logs enrichment-worker
```

## 8. Rollback Procedure

If deployment fails:

// turbo
```bash
# Stop new version
pm2 stop captainprospect

# Restore previous PM2 config
pm2 resurrect

# Or restore database backup
pg_restore --clean --if-exists backup.sql
```

## 9. Monitoring & Maintenance

// turbo
- [ ] Setup log rotation: `pm2 install pm2-logrotate`
- [ ] Configure monitoring alerts
- [ ] Schedule daily database backups
- [ ] Update SSL certificates before expiry

---

## Troubleshooting

### Build Failures
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

### Database Connection Issues
```bash
# Test connection
npx prisma db execute --stdin <<< "SELECT 1"
```

### Memory Issues
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

---

## Security Checklist

- [ ] Environment variables not committed to git
- [ ] Database URL uses SSL
- [ ] NEXTAUTH_SECRET is strong (32+ chars)
- [ ] API keys rotated regularly
- [ ] Security headers configured in next.config.ts
- [ ] Rate limiting enabled

## Resources

- Next.js Deployment: https://nextjs.org/docs/deployment
- Prisma Migration: https://www.prisma.io/docs/concepts/components/prisma-migrate
- PM2 Documentation: https://pm2.keymetrics.io/docs/usage/quick-start/
