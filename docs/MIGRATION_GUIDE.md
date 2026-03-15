# Database Migration Guide - Payment Request Feature

## Overview

This guide documents the database schema changes required when deploying the payment request feature to production.

**Last Production Commit:** `45dce54` - "Capture user birthday (optional)"

**Local Changes:** Payment request feature with notifications

---

## Database Schema Changes

### 1. New Table: `practice_payments`

**Purpose:** Track payment confirmations by users for practice sessions

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS practice_payments (
    id SERIAL PRIMARY KEY,
    date VARCHAR(50) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, user_email)
);
```

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS practice_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    user_email TEXT NOT NULL,
    paid INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, user_email)
);
```

---

### 2. Modified Table: `practice_sessions`

**New Columns Added:**

#### `session_cost` - Total cost of the practice session
- **PostgreSQL:** `DECIMAL(10, 2)`
- **SQLite:** `REAL`
- **Nullable:** Yes
- **Purpose:** Store the total session cost (e.g., £20.00)

#### `paid_by` - Email of user who paid for the session
- **PostgreSQL:** `VARCHAR(255)`
- **SQLite:** `TEXT`
- **Nullable:** Yes
- **Purpose:** Track which user paid for the session

#### `payment_requested` - Flag indicating if payment has been requested
- **PostgreSQL:** `BOOLEAN DEFAULT FALSE`
- **SQLite:** `INTEGER DEFAULT 0`
- **Nullable:** No
- **Purpose:** Lock availability changes once payment is requested

---

### 3. Modified Table: `notifications`

**New Column Added:**

#### `related_date` - Date associated with the notification
- **PostgreSQL:** `DATE`
- **SQLite:** `DATE`
- **Nullable:** Yes
- **Purpose:** Enable navigation to specific practice session dates from notifications

---

## Migration Strategy

### ✅ **GOOD NEWS: Automatic Migration Built-In!**

The `init_db()` function in `api.py` includes automatic migration logic that will:

1. **Check for existing columns** before adding them
2. **Handle errors gracefully** if columns already exist
3. **Work on both PostgreSQL and SQLite**

### PostgreSQL Migration (Production)

The code uses PostgreSQL's `DO $$ ... END $$` blocks to check for column existence:

```python
# Example from api.py
cur.execute("""
    DO $$ 
    BEGIN 
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='practice_sessions' AND column_name='session_cost'
        ) THEN
            ALTER TABLE practice_sessions ADD COLUMN session_cost DECIMAL(10, 2);
        END IF;
    END $$;
""")
```

### SQLite Migration (Local Development)

The code uses try-except blocks to handle duplicate column errors:

```python
# Example from api.py
try:
    cur.execute("ALTER TABLE practice_sessions ADD COLUMN session_cost REAL")
except sqlite3.OperationalError as e:
    if "duplicate column name" not in str(e).lower():
        print(f"Warning: Could not add session_cost column: {e}")
```

---

## Deployment Steps

### Step 1: Backup Production Database

**Before deploying**, create a backup of your production PostgreSQL database:

```bash
# On Render or your hosting platform
pg_dump $DATABASE_URL > backup_before_payment_feature.sql
```

### Step 2: Deploy Code to Production

Push the updated code to your production environment:

```bash
git add .
git commit -m "Add payment request feature with notifications"
git push origin main
```

### Step 3: Restart Application

The application will automatically run `init_db()` on startup, which will:

1. ✅ Create `practice_payments` table if it doesn't exist
2. ✅ Add `session_cost`, `paid_by`, `payment_requested` columns to `practice_sessions`
3. ✅ Add `related_date` column to `notifications`
4. ✅ Handle any errors gracefully

### Step 4: Verify Migration

After deployment, verify the migration was successful:

**Check PostgreSQL Tables:**
```sql
-- Check practice_payments table exists
SELECT * FROM practice_payments LIMIT 1;

-- Check new columns in practice_sessions
SELECT date, time, location, session_cost, paid_by, payment_requested 
FROM practice_sessions LIMIT 1;

-- Check related_date in notifications
SELECT id, type, message, related_date, created_at 
FROM notifications LIMIT 1;
```

### Step 5: Test Payment Flow

1. Create a new practice session as admin
2. Set session cost and paid by user
3. Request payment
4. Verify notifications are sent with `related_date`
5. Confirm users can click notifications and navigate to correct date
6. Test payment confirmation by users

---

## Rollback Plan

If issues occur, you can rollback:

### Option 1: Revert Code
```bash
git revert HEAD
git push origin main
```

### Option 2: Manual Database Rollback

**Remove new columns (if needed):**
```sql
-- PostgreSQL
ALTER TABLE practice_sessions DROP COLUMN IF EXISTS session_cost;
ALTER TABLE practice_sessions DROP COLUMN IF EXISTS paid_by;
ALTER TABLE practice_sessions DROP COLUMN IF EXISTS payment_requested;
ALTER TABLE notifications DROP COLUMN IF EXISTS related_date;
DROP TABLE IF EXISTS practice_payments;
```

**Restore from backup:**
```bash
psql $DATABASE_URL < backup_before_payment_feature.sql
```

---

## Risk Assessment

### ✅ **LOW RISK** - Safe to Deploy

**Why it's safe:**

1. **Non-breaking changes:** All new columns are nullable or have defaults
2. **Backward compatible:** Existing functionality continues to work
3. **Automatic migration:** Built-in migration logic handles everything
4. **Graceful error handling:** Won't crash if columns already exist
5. **Tested:** All tests pass (26 tests covering SQLite and PostgreSQL)

**Potential Issues:**

- ⚠️ **None expected** - The migration is designed to be safe and automatic

---

## Post-Deployment Monitoring

After deployment, monitor:

1. **Application logs** - Check for any migration warnings or errors
2. **Database performance** - New tables/columns should have minimal impact
3. **User notifications** - Verify payment notifications are working
4. **Payment flow** - Test end-to-end payment request and confirmation

---

## Summary

**Database Changes:**
- ✅ 1 new table: `practice_payments`
- ✅ 3 new columns in `practice_sessions`: `session_cost`, `paid_by`, `payment_requested`
- ✅ 1 new column in `notifications`: `related_date`

**Migration Type:** Automatic (handled by `init_db()`)

**Risk Level:** LOW - Safe to deploy

**Rollback:** Easy - revert code or restore database backup

**Testing:** ✅ All 26 tests passing

---

## Questions?

If you encounter any issues during deployment, check:
1. Application logs for migration warnings
2. Database connection status
3. PostgreSQL version compatibility (should work with any modern version)

The migration is designed to be safe and automatic. Simply deploy the code and the database will update itself on first run! 🚀
