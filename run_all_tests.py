#!/usr/bin/env python3
"""
Master Test Runner for Football Club Application
Automatically:
1. Sets up test database with schema
2. Runs all test files from tests/ folder
3. Provides consolidated test results
4. Cleans up test database
"""

import os
import sys
import subprocess
import sqlite3
from datetime import datetime

# Set test mode before importing anything
os.environ['USE_POSTGRES'] = 'false'
os.environ['TEST_MODE'] = 'true'

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api import DB_PATH

# Test files directory
TESTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tests')

# ANSI color codes for pretty output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def print_header(message):
    """Print a formatted header"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 80}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{message.center(80)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 80}{Colors.ENDC}\n")


def print_success(message):
    """Print success message"""
    print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")


def print_error(message):
    """Print error message"""
    print(f"{Colors.FAIL}✗ {message}{Colors.ENDC}")


def print_info(message):
    """Print info message"""
    print(f"{Colors.OKCYAN}→ {message}{Colors.ENDC}")


def setup_test_database():
    """Create all required tables in test database"""
    print_info(f"Setting up test database: {DB_PATH}")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        
        # Create users table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                full_name TEXT,
                user_type TEXT DEFAULT 'member',
                is_deleted BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                birthday DATE
            )
        """)
        
        # Create practice_sessions table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS practice_sessions (
                date TEXT PRIMARY KEY,
                time TEXT,
                location TEXT,
                session_cost REAL,
                paid_by TEXT,
                payment_requested BOOLEAN DEFAULT FALSE
            )
        """)
        
        # Create practice_availability table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS practice_availability (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                user_email TEXT NOT NULL,
                user_full_name TEXT,
                status TEXT NOT NULL,
                UNIQUE(date, user_email)
            )
        """)
        
        # Create practice_payments table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS practice_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                user_email TEXT NOT NULL,
                paid BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(date, user_email)
            )
        """)
        
        # Create notifications table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                type TEXT NOT NULL,
                message TEXT NOT NULL,
                read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create events table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                time TEXT,
                location TEXT,
                opponent TEXT,
                event_type TEXT DEFAULT 'match',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        conn.close()
        
        print_success(f"Test database setup complete: {DB_PATH}")
        return True
    except Exception as e:
        print_error(f"Failed to setup test database: {e}")
        return False


def cleanup_test_database():
    """Remove test database file"""
    print_info(f"Cleaning up test database: {DB_PATH}")
    
    try:
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
            print_success(f"Test database removed: {DB_PATH}")
        else:
            print_info("Test database file not found (already cleaned)")
        return True
    except Exception as e:
        print_error(f"Failed to cleanup test database: {e}")
        return False


def run_test_file(test_file):
    """Run a single test file and return results"""
    print_info(f"Running: {test_file}")
    
    try:
        # Run the test file from tests directory
        test_path = os.path.join(TESTS_DIR, test_file)
        result = subprocess.run(
            ['python', test_path],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
        
        # Parse output for results
        output = result.stdout + result.stderr
        
        # Check if test passed
        passed = result.returncode == 0
        
        return {
            'file': test_file,
            'passed': passed,
            'output': output,
            'returncode': result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            'file': test_file,
            'passed': False,
            'output': 'Test timed out after 60 seconds',
            'returncode': -1
        }
    except Exception as e:
        return {
            'file': test_file,
            'passed': False,
            'output': str(e),
            'returncode': -1
        }


def main():
    """Main test runner"""
    start_time = datetime.now()
    
    print_header("Football Club Application - Test Suite")
    print(f"{Colors.BOLD}Started at: {start_time.strftime('%Y-%m-%d %H:%M:%S')}{Colors.ENDC}\n")
    
    # List of test files to run (in tests/ directory)
    test_files = [
        'test_database_compatibility.py',
        'test_payment_request_comprehensive.py',
        'test_payment_notifications.py',
    ]
    
    # Check if test files exist in tests directory
    existing_test_files = []
    for test_file in test_files:
        test_path = os.path.join(TESTS_DIR, test_file)
        if os.path.exists(test_path):
            existing_test_files.append(test_file)
        else:
            print_error(f"Test file not found: {test_path}")
    
    if not existing_test_files:
        print_error("No test files found!")
        return 1
    
    print_info(f"Found {len(existing_test_files)} test file(s) to run\n")
    
    # Step 1: Setup test database
    print_header("Step 1: Setting Up Test Database")
    if not setup_test_database():
        print_error("Failed to setup test database. Aborting tests.")
        return 1
    
    # Step 2: Run all tests
    print_header("Step 2: Running Tests")
    results = []
    
    for test_file in existing_test_files:
        result = run_test_file(test_file)
        results.append(result)
        
        if result['passed']:
            print_success(f"{test_file} - PASSED")
        else:
            print_error(f"{test_file} - FAILED")
    
    # Step 3: Display consolidated results
    print_header("Step 3: Test Results Summary")
    
    total_tests = len(results)
    passed_tests = sum(1 for r in results if r['passed'])
    failed_tests = total_tests - passed_tests
    
    print(f"{Colors.BOLD}Total Test Files: {total_tests}{Colors.ENDC}")
    print(f"{Colors.OKGREEN}Passed: {passed_tests}{Colors.ENDC}")
    print(f"{Colors.FAIL}Failed: {failed_tests}{Colors.ENDC}\n")
    
    # Show details for failed tests
    if failed_tests > 0:
        print(f"{Colors.WARNING}{Colors.BOLD}Failed Test Details:{Colors.ENDC}\n")
        for result in results:
            if not result['passed']:
                print(f"{Colors.FAIL}{'─' * 80}{Colors.ENDC}")
                print(f"{Colors.FAIL}{Colors.BOLD}File: {result['file']}{Colors.ENDC}")
                print(f"{Colors.FAIL}Return Code: {result['returncode']}{Colors.ENDC}")
                print(f"\n{result['output'][:500]}")  # Show first 500 chars
                if len(result['output']) > 500:
                    print(f"{Colors.WARNING}... (output truncated){Colors.ENDC}")
                print(f"{Colors.FAIL}{'─' * 80}{Colors.ENDC}\n")
    
    # Step 4: Cleanup test database
    print_header("Step 4: Cleaning Up Test Database")
    cleanup_test_database()
    
    # Final summary
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    print_header("Test Run Complete")
    print(f"{Colors.BOLD}Finished at: {end_time.strftime('%Y-%m-%d %H:%M:%S')}{Colors.ENDC}")
    print(f"{Colors.BOLD}Duration: {duration:.2f} seconds{Colors.ENDC}\n")
    
    if failed_tests == 0:
        print(f"{Colors.OKGREEN}{Colors.BOLD}{'🎉 ALL TESTS PASSED! 🎉'.center(80)}{Colors.ENDC}\n")
        return 0
    else:
        print(f"{Colors.FAIL}{Colors.BOLD}{'❌ SOME TESTS FAILED ❌'.center(80)}{Colors.ENDC}\n")
        return 1


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print(f"\n\n{Colors.WARNING}Tests interrupted by user{Colors.ENDC}")
        print_info("Cleaning up...")
        cleanup_test_database()
        sys.exit(130)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        cleanup_test_database()
        sys.exit(1)
