# Email Hub Sync - Verification Checklist

## What Was Fixed

### 1. Queue Name Issue ✅
- **Problem**: BullMQ doesn't allow colons (`:`) in queue names
- **Fix**: Changed from `email:sync` to `email-sync` format
- **Files**: `lib/email/queue/index.ts`

### 2. IMAP Provider Return Type ✅
- **Problem**: Return type mismatch with Gmail/Outlook providers
- **Fix**: Updated to return `{ threads, syncResult }` format
- **Files**: `lib/email/providers/imap.ts`

### 3. Sync Service IMAP Handling ✅
- **Problem**: Trying to use OAuth tokens for IMAP (password-based)
- **Fix**: Added special handling for CUSTOM provider
- **Files**: `lib/email/services/sync-service.ts`

### 4. Missing Interface Fields ✅
- **Problem**: `EmailMessageData` missing `isRead` and `isStarred`
- **Fix**: Added fields to interface
- **Files**: `lib/email/providers/types.ts`

### 5. Graceful Degradation ✅
- **Problem**: System fails when Redis not available
- **Fix**: Queue errors logged but don't fail mailbox creation
- **Files**: `app/api/email/mailboxes/route.ts`

## How to Test Sync

### Test 1: IMAP Connection (Manual)

1. **Navigate to Email Hub**:
   ```
   http://localhost:3000/manager/email
   ```

2. **Click "IMAP / SMTP"** card

3. **Enter Test Credentials** (Gmail example):
   ```
   Email: your-email@gmail.com
   Password: [App Password - NOT your regular password]
   IMAP Host: imap.gmail.com
   IMAP Port: 993
   SMTP Host: smtp.gmail.com
   SMTP Port: 587
   ```

   > **Gmail App Password**: Go to Google Account → Security → 2-Step Verification → App Passwords

4. **Expected**: Connection test runs, mailbox created

5. **Manual Sync**:
   - Go to `/manager/email/mailboxes`
   - Click sync button (⟳) next to your mailbox
   - Wait 5-10 seconds
   - Check for emails in inbox

### Test 2: Gmail OAuth

1. Click "Gmail" card
2. Complete OAuth flow
3. Mailbox created automatically
4. Manual sync if needed (sync button)

### Test 3: Verify Sync Results

Check database:
```sql
-- Check mailbox status
SELECT id, email, syncStatus, lastSyncAt, lastError 
FROM "Mailbox" 
WHERE email = 'your-email@gmail.com';

-- Check synced threads
SELECT COUNT(*) as thread_count 
FROM "EmailThread" 
WHERE "mailboxId" = '[your-mailbox-id]';

-- Check synced emails
SELECT COUNT(*) as email_count 
FROM "Email" 
WHERE "mailboxId" = '[your-mailbox-id]';
```

Or via UI:
- Navigate to `/manager/email`
- Select your mailbox
- Should see threads in inbox

## Common Issues & Solutions

### Issue: "Queue name cannot contain :"
**Status**: ✅ Fixed (update to latest code)
**Solution**: Already fixed in `lib/email/queue/index.ts`

### Issue: No emails appearing after sync
**Possible Causes**:
1. IMAP credentials incorrect
2. Mailbox is empty (check another mailbox)
3. Sync failed (check `lastError` in Mailbox table)

**Debug**:
```bash
# Check terminal logs for IMAP errors
# Look for: [IMAP] Sync error: ...

# Check mailbox in database
npx prisma studio
# Navigate to Mailbox model
# Check syncStatus and lastError fields
```

### Issue: "Failed to schedule initial sync"
**Status**: ✅ Expected when Redis not running
**Impact**: No impact - use manual sync button
**Solution** (optional): 
```bash
# Start Redis
docker run -d -p 6379:6379 redis:alpine

# Or
brew install redis  # macOS
sudo apt install redis-server  # Ubuntu
```

### Issue: IMAP connection timeout
**Possible Causes**:
1. Wrong host/port
2. Firewall blocking IMAP
3. Password incorrect (use App Password for Gmail)

**Solutions**:
- Gmail: `imap.gmail.com:993`, `smtp.gmail.com:587` + App Password
- Outlook: `outlook.office365.com:993`, `smtp.office365.com:587`
- Yahoo: `imap.mail.yahoo.com:993`, `smtp.mail.yahoo.com:587`

## Performance Notes

### Sync Speed
- **First sync**: 5-30 seconds (depending on email count)
- **Incremental**: 1-5 seconds
- **Default limit**: 50 emails per sync
- **Configurable**: Adjust `maxThreads` parameter

### Production Recommendations

1. **Enable Redis** for background processing
2. **Set up webhooks** for real-time sync (Gmail/Outlook)
3. **Monitor** `syncStatus` and `healthScore` fields
4. **Regular syncs**: Run every 15-30 minutes via cron/worker
5. **Rate limits**: Respect provider limits (Gmail: 250/day/user)

## Verification Complete?

- [ ] IMAP mailbox connects successfully
- [ ] Connection test passes before creation
- [ ] Manual sync button works
- [ ] Emails appear in inbox after sync
- [ ] No errors in console/terminal
- [ ] Database shows synced threads and emails
- [ ] ThreadView displays email content correctly

## Next Steps

Once sync is verified:
1. Test email sending
2. Create and test sequences
3. Try CRM auto-linking
4. Set up templates
5. Configure analytics

---

**Last Updated**: 2026-01-20
**Version**: 1.0.0
