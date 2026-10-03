# Database Reset Script

## ⚠️ IMPORTANT WARNING

This script **PERMANENTLY DELETES ALL DATA** from your database. It should **ONLY** be used in:
- Development environments
- Testing environments
- When explicitly resetting the database

**NEVER run this in production!**

## What This Script Does

1. **Deletes all existing data** from all tables in the correct order to respect foreign key constraints
2. **Creates a single initial user** with MANAGER role and specified credentials

## Usage

### Method 1: Using npm script (Recommended)

```bash
npm run db:reset
```

### Method 2: Direct execution

```bash
npx tsx prisma/reset.ts
```

## Initial User Credentials

After running the reset script, you can log in with:

- **Email:** `hichem@suzaliconseil.com`
- **Password:** `Moumouche/100882`
- **Role:** `MANAGER`

## Technical Details

### Password Hashing
The script uses `bcryptjs` with a salt rounds of 10, matching the authentication system used throughout the application.

### Deletion Order
Tables are deleted in the following order to respect foreign key constraints:

1. Internal Communication Module (CommsBroadcastReceipt → CommsChannel)
2. Email Hub Templates
3. Email Hub Audit & Analytics
4. Email Hub Sequences
5. Email Hub Threads & Messages
6. Email Hub Mailboxes
7. Legacy Email Accounts
8. Notifications
9. Permissions System
10. Scheduling
11. Business Developer Relations
12. Projects & Tasks
13. Google Drive Integration
14. Files & Folders
15. CRM Core (Opportunities → Clients)
16. Users (last)

### Transaction Safety
The script executes all deletions sequentially to ensure data integrity. If any step fails, the error will be logged and the process will exit.

## Environment Requirements

- Node.js environment with TypeScript support
- Database connection configured in `.env`
- `tsx` package installed (included in devDependencies)
- `bcryptjs` package installed (included in dependencies)

## After Reset

After running the reset, you may want to:

1. Run the seed script to populate with test data:
   ```bash
   npx prisma db seed
   ```

2. Or start fresh with just the initial MANAGER user and build your data from there

## Troubleshooting

### "Cannot find module" error
Make sure all dependencies are installed:
```bash
npm install
```

### Database connection error
Verify your `.env` file has the correct `DATABASE_URL` and `DIRECT_URL` configured.

### Permission errors
Ensure your database user has DELETE permissions on all tables.

## Safety Checklist

Before running this script, confirm:

- [ ] You are in a development/testing environment
- [ ] You have a backup of any data you want to keep
- [ ] You understand all data will be permanently deleted
- [ ] You are not connected to a production database
- [ ] You have verified the `DATABASE_URL` in your `.env` file

## Related Scripts

- `npm run db:seed` - Populate database with test data
- `npx prisma migrate dev` - Run database migrations
- `npx prisma studio` - Open Prisma Studio to view data
