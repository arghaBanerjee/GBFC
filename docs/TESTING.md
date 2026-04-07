# Testing Documentation

## Overview

This document describes the testing infrastructure for the Football Club Application, including test database setup, running tests, and understanding test coverage.

All test files are organized in the `tests/` directory to keep the project structure clean and maintainable.

---

## Project Structure

```
Football/
├── api.py                      # Main API
├── run_all_tests.py           # Master test runner
├── docs/                      # Documentation directory
│   └── TESTING.md             # This file
├── tests/                     # Test directory
│   ├── __init__.py
│   ├── setup_test_db.py                          # Test database setup script
│   ├── test_database_compatibility.py            # Database compatibility tests
│   ├── test_payment_request_comprehensive.py     # Payment request tests
│   ├── test_payment_notifications.py             # Notification tests
│   └── [legacy test files]                       # Older test files (archived)
├── football_club.db           # Production database (never touched by tests)
└── test_football_club.db      # Test database (created/deleted during tests)
```

---

## Test Database Isolation

To protect production data, all tests run against a separate **test database** (`test_football_club.db`) instead of the production database (`football_club.db`).

### How It Works

The application uses the `TEST_MODE` environment variable to determine which database to use:

- **Production Mode** (`TEST_MODE=false` or not set): Uses `football_club.db`
- **Test Mode** (`TEST_MODE=true`): Uses `test_football_club.db`

All test files in the `tests/` directory automatically set `TEST_MODE=true` before importing the API, ensuring complete isolation from production data.

---

## Quick Start - Running All Tests

### **Recommended: Use the Master Test Runner**

The easiest way to run all tests is using the master test runner:

```bash
# Activate virtual environment
source venv/bin/activate

# Run all tests with automatic setup and cleanup
python run_all_tests.py
```

This single command will:
1. ✅ Create and setup the test database
2. ✅ Run all test files
3. ✅ Display consolidated results
4. ✅ Clean up the test database

**Expected Output:**
```
================================================================================
                     Football Club Application - Test Suite                     
================================================================================

Started at: 2026-03-15 10:16:08

→ Found 2 test file(s) to run

Step 1: Setting Up Test Database
✓ Test database setup complete: test_football_club.db

Step 2: Running Tests
✓ test_payment_request_comprehensive.py - PASSED
✓ test_payment_notifications.py - PASSED

Step 3: Test Results Summary
Total Test Files: 2
Passed: 2
Failed: 0

Step 4: Cleaning Up Test Database
✓ Test database removed: test_football_club.db

                             🎉 ALL TESTS PASSED! 🎉                              
```

---

## Manual Test Execution

If you need to run tests individually:

### 1. Setup Test Database (First Time)

```bash
source venv/bin/activate
python tests/setup_test_db.py
```

### 2. Run Individual Test Files

```bash
# Run comprehensive payment request tests
python tests/test_payment_request_comprehensive.py

# Run payment notification tests
python tests/test_payment_notifications.py
```

### 3. Cleanup Test Database (Optional)

```bash
rm test_football_club.db
```

---

## Test Files

### `test_database_compatibility.py`

Tests database compatibility and SQL query generation for both SQLite and PostgreSQL.

**Test Coverage (4 tests):**
- ✅ PLACEHOLDER generation for both databases
- ✅ SQL query generation with correct placeholders
- ✅ Cursor row access (dictionary and index style)
- ✅ Boolean field compatibility

**Merged from:**
- `test_db_compatibility.py`
- `test_postgresql_compatibility.py`
- `test_sql_compatibility.py`
- `test_cursor_fix.py`

**Run Command:**
```bash
python tests/test_database_compatibility.py
```

---

### `test_payment_request_comprehensive.py`

Comprehensive tests for the practice session payment request functionality.

**Test Coverage (18 tests):**

#### Payment Info Save and Update (3 tests)
- ✅ Save payment info with cost and paid_by
- ✅ Update payment info multiple times before payment request
- ✅ Payment info locked after payment request

#### Payment Request Enablement (3 tests)
- ✅ Payment request only after session date
- ✅ Payment request requires both cost and paid_by
- ✅ Payment request is irreversible once enabled

#### Payment Confirmation by Users (3 tests)
- ✅ Available user can confirm payment
- ✅ User can toggle payment confirmation
- ✅ Multiple users can independently confirm payment

#### Availability Locking After Payment Request (2 tests)
- ✅ User cannot change availability after payment request
- ✅ Admin cannot delete availability after payment request

#### Payment Card Visibility (2 tests)
- ✅ Payment card appears for all available users
- ✅ Payment card shows for admin who paid (if available)

#### Payment Calculations (3 tests)
- ✅ Equal split among available users
- ✅ Decimal precision (£16.67 for £50 ÷ 3)
- ✅ Single user pays full amount

#### Data Integrity (2 tests)
- ✅ Payment record unique per user per session
- ✅ Payment confirmation persists correctly

**Run Command:**
```bash
python tests/test_payment_request_comprehensive.py
```

---

### `test_practice_session_id_foundation.py`

Tests for the practice session ID foundation and API endpoint functionality.

**Test Coverage (1 test):**
- **API Endpoint Renaming**: Tests `/api/matches` endpoint (renamed from `/api/events`)

**Run Command:**
```bash
python tests/test_practice_session_id_foundation.py
```

---

### `test_forum_crud.py`

Tests for forum CRUD operations and functionality.

**Test Coverage (4 tests):**
- **Forum Post Creation**: Creating new forum posts with rich text
- **Forum Post Updates**: Editing existing forum posts
- **Forum Post Deletion**: Deleting forum posts
- **Forum Comment Operations**: Adding and managing comments

**Run Command:**
```bash
python tests/test_forum_crud.py
```

---

### `test_payment_notifications.py`

Tests for notification system related to payment requests.

**Test Coverage (4 tests):**

#### Payment Request Notifications
- All available users receive notifications when admin requests payment
- Tentative/unavailable users do NOT receive notifications
- Notification message format is correct

#### Payment Confirmation Notifications
- All admin users receive notifications when user confirms payment
- Notification includes user name, date, time, and location
- No admin notifications sent when user unchecks payment

**Run Command:**
```bash
python tests/test_payment_notifications.py
```

---

## Test Database Schema

The test database includes all tables from the production database:

### Tables
- **users**: User accounts (members and admins)
- **practice_sessions**: Practice session details
- **practice_availability**: User availability for sessions
- **practice_payments**: Payment confirmation records
- **notifications**: User notifications
- **events**: Match/event information

---

## Adding New Tests

To add new test files to the test suite:

1. **Create your test file** in the `tests/` directory (e.g., `tests/test_new_feature.py`)

2. **Add TEST_MODE configuration** at the top:
```python
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set environment to use SQLite test database
os.environ['USE_POSTGRES'] = 'false'
os.environ['TEST_MODE'] = 'true'

from api import app, get_connection, PLACEHOLDER
```

3. **Add to master test runner** in `run_all_tests.py`:
```python
test_files = [
    'test_payment_request_comprehensive.py',
    'test_payment_notifications.py',
    'test_new_feature.py',  # Add your test here
]
```

4. **Run all tests** to verify:
```bash
python run_all_tests.py
```

---

## Continuous Integration

The test suite is designed for easy CI/CD integration:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: |
    source venv/bin/activate
    python run_all_tests.py
```

The master test runner returns:
- **Exit code 0**: All tests passed
- **Exit code 1**: Some tests failed

---

## Best Practices

### ✅ DO:
- Always use `run_all_tests.py` for regression testing
- Run tests before committing changes
- Add tests for new features
- Keep test data separate from production data
- Use meaningful test names and assertions

### ❌ DON'T:
- Modify production database during tests
- Skip test database cleanup
- Hard-code production data in tests
- Run tests without virtual environment
- Commit `test_football_club.db` to version control

---

## Troubleshooting

### Test Database Already Exists
If you see "table already exists" errors:
```bash
rm test_football_club.db
python setup_test_db.py
```

### Tests Modifying Production Data
Verify `TEST_MODE` is set:
```python
import os
print(os.environ.get('TEST_MODE'))  # Should print 'true'
```

### Import Errors
Ensure virtual environment is activated:
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### Test Timeout
Individual tests timeout after 60 seconds. If tests are slow:
- Check database connections are being closed
- Verify no infinite loops in test code
- Consider breaking large tests into smaller ones

---

## Test Statistics

- **Total Test Files**: 5
- **Total Tests**: 31 (4 + 18 + 1 + 4 + 4)
- **Average Execution Time**: ~7.8 seconds
- **Code Coverage**: Database compatibility, payment request functionality, notifications, API endpoint refactoring, forum CRUD operations, data integrity

## Recent Updates (April 2026)

### API Endpoint Refactoring
- **Calendar Events**: `/api/calendar-events` endpoints renamed to `/api/calendar/events`
- **Matches**: `/api/events` endpoints renamed to `/api/matches`
- **Frontend Components**: 
  - `Practice.jsx` renamed to `Calendar.jsx`
  - `Events.jsx` renamed to `Matches.jsx`

### Test Suite Updates
- Added `test_practice_session_id_foundation.py` for API endpoint testing
- Added `test_forum_crud.py` for forum functionality testing
- Updated all tests to work with new API endpoints
- Maintained backward compatibility for legacy endpoints

## Legacy Test Files

The following test files have been moved to the `tests/` directory for archival purposes. They are not included in the automated test suite but are kept for reference:

- `run_tests.py` - User reactivation and practice availability tests (standalone runner)
- `test_birthday_compatibility.py` - Birthday field feature tests
- `test_forgot_password_regression.py` - Forgot password regression tests
- `test_last_login_feature.py` - Last login tracking tests
- `test_profile_compatibility.py` - Profile endpoint tests
- `test_recent_changes.py` - API endpoint tests
- `test_user_reactivation.py` - User reactivation tests

These tests were created for specific features during development and may require updates to work with the current codebase.

**Note:** `run_tests.py` is a standalone test runner (not using pytest) that tests user reactivation scenarios. It can be run independently with `python tests/run_tests.py` if needed.

---

## Future Enhancements

Planned improvements to the test suite:

- [ ] Add frontend component tests
- [ ] Add API endpoint integration tests
- [ ] Add performance/load tests
- [ ] Add test coverage reporting
- [ ] Add mutation testing
- [ ] Add visual regression tests

---

## Support

For questions or issues with testing:

1. Check this documentation
2. Review test file comments
3. Run tests with verbose output: `python test_file.py -v`
4. Check test database schema: `sqlite3 test_football_club.db ".schema"`

---

**Last Updated**: March 15, 2026  
**Test Framework**: pytest 9.0.2  
**Python Version**: 3.13.7
