#!/usr/bin/env python3
"""
2026 FIFA World Cup Calendar Event Seeding Script

This script populates the club calendar with 2026 World Cup match events.
All events are categorized as "others" with titles like "England vs Argentina".
Times are converted from Eastern Time to London UK time (BST).
"""

import os
import sqlite3
from datetime import datetime, timedelta

# Database configuration
DATABASE_URL = os.environ.get("DATABASE_URL")
USE_POSTGRES = DATABASE_URL is not None

if USE_POSTGRES and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

def get_connection():
    """Get database connection (SQLite or PostgreSQL)"""
    if USE_POSTGRES:
        import psycopg2
        return psycopg2.connect(DATABASE_URL)
    else:
        return sqlite3.connect("football_club.db")

def parse_date(date_str):
    """
    Parse date string like "Thursday, June 11" to YYYY-MM-DD format.
    All matches are in 2026.
    """
    months = {
        "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
        "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12
    }

    parts = date_str.lower().split()
    month_name = parts[1]
    day = int(parts[2].replace(",", ""))
    month = months[month_name]

    return f"2026-{month:02d}-{day:02d}"

def convert_eastern_to_london(date_str, eastern_time_str):
    """
    Convert Eastern date/time to London UK date/time (BST).
    London is 5 hours ahead of Eastern Time during June/July 2026.

    Returns:
        Tuple of (london_date_iso, london_time_24h)
    """
    base_date = datetime.strptime(parse_date(date_str), "%Y-%m-%d")
    time_str = eastern_time_str.lower().replace(".", "")

    if "a.m." in time_str or "am" in time_str:
        period = "am"
    else:
        period = "pm"

    hour_part = time_str.replace("am", "").replace("pm", "").strip()
    if ":" in hour_part:
        hour = int(hour_part.split(":")[0])
        minute = int(hour_part.split(":")[1])
    else:
        hour = int(hour_part)
        minute = 0

    if period == "am":
        if hour == 12:
            hour = 0
    else:
        if hour != 12:
            hour += 12

    eastern_datetime = base_date.replace(hour=hour, minute=minute)
    london_datetime = eastern_datetime + timedelta(hours=5)

    return london_datetime.strftime("%Y-%m-%d"), london_datetime.strftime("%H:%M")

# World Cup 2026 match data (Eastern Time)
# Format: (date_str, eastern_time, team1, team2, venue)
world_cup_matches = [
    # Group A
    ("Thursday, June 11", "3 p.m.", "Mexico", "South Africa", "Estadio Azteca, Mexico City"),
    ("Thursday, June 11", "10 p.m.", "Korea Republic", "Czechia", "Estadio Akron, Guadalajara"),
    ("Thursday, June 18", "12 p.m.", "Czechia", "South Africa", "Mercedes-Benz Stadium, Atlanta"),
    ("Thursday, June 18", "9 p.m.", "Mexico", "Korea Republic", "Estadio Akron, Guadalajara"),
    ("Wednesday, June 24", "9 p.m.", "Czechia", "Mexico", "Estadio Azteca, Mexico City"),
    ("Wednesday, June 24", "9 p.m.", "South Africa", "Korea Republic", "Estadio BBVA, Monterrey"),
    
    # Group B
    ("Friday, June 12", "3 p.m.", "Canada", "Bosnia and Herzegovina", "BMO Field, Toronto"),
    ("Saturday, June 13", "3 p.m.", "Qatar", "Switzerland", "Levi's Stadium, Santa Clara"),
    ("Thursday, June 18", "3 p.m.", "Switzerland", "Bosnia and Herzegovina", "SoFi Stadium, Inglewood"),
    ("Thursday, June 18", "6 p.m.", "Canada", "Qatar", "BC Place, Vancouver"),
    ("Wednesday, June 24", "3 p.m.", "Switzerland", "Canada", "BC Place, Vancouver"),
    ("Wednesday, June 24", "3 p.m.", "Bosnia and Herzegovina", "Qatar", "Lumen Field, Seattle"),
    
    # Group C
    ("Saturday, June 13", "6 p.m.", "Brazil", "Morocco", "MetLife Stadium, East Rutherford"),
    ("Saturday, June 13", "9 p.m.", "Haiti", "Scotland", "Gillette Stadium, Foxborough"),
    ("Friday, June 19", "6 p.m.", "Scotland", "Morocco", "Gillette Stadium, Foxborough"),
    ("Friday, June 19", "8:30 p.m.", "Brazil", "Haiti", "Lincoln Financial Field, Philadelphia"),
    ("Wednesday, June 24", "6 p.m.", "Scotland", "Brazil", "Hard Rock Stadium, Miami"),
    ("Wednesday, June 24", "6 p.m.", "Morocco", "Haiti", "Mercedes-Benz Stadium, Atlanta"),
    
    # Group D
    ("Friday, June 12", "9 p.m.", "United States", "Paraguay", "SoFi Stadium, Inglewood"),
    ("Sunday, June 14", "12 a.m.", "Australia", "Türkiye", "BC Place, Vancouver"),
    ("Friday, June 19", "3 p.m.", "United States", "Australia", "Lumen Field, Seattle"),
    ("Friday, June 19", "11 p.m.", "Türkiye", "Paraguay", "Levi's Stadium, Santa Clara"),
    ("Thursday, June 25", "10 p.m.", "Türkiye", "United States", "SoFi Stadium, Inglewood"),
    ("Thursday, June 25", "10 p.m.", "Paraguay", "Australia", "Levi's Stadium, Santa Clara"),
    
    # Group E
    ("Sunday, June 14", "1 p.m.", "Germany", "Curaçao", "NRG Stadium, Houston"),
    ("Sunday, June 14", "7 p.m.", "Ivory Coast", "Ecuador", "Lincoln Financial Field, Philadelphia"),
    ("Saturday, June 20", "4 p.m.", "Germany", "Ivory Coast", "BMO Field, Toronto"),
    ("Saturday, June 20", "8 p.m.", "Ecuador", "Curaçao", "Arrowhead Stadium, Kansas City"),
    ("Thursday, June 25", "4 p.m.", "Curaçao", "Ivory Coast", "Lincoln Financial Field, Philadelphia"),
    ("Thursday, June 25", "4 p.m.", "Ecuador", "Germany", "MetLife Stadium, East Rutherford"),
    
    # Group F
    ("Sunday, June 14", "4 p.m.", "Netherlands", "Japan", "AT&T Stadium, Arlington"),
    ("Sunday, June 14", "10 p.m.", "Sweden", "Tunisia", "Estadio BBVA, Monterrey"),
    ("Saturday, June 20", "1 p.m.", "Netherlands", "Sweden", "NRG Stadium, Houston"),
    ("Sunday, June 21", "12 a.m.", "Tunisia", "Japan", "Estadio BBVA, Monterrey"),
    ("Thursday, June 25", "7 p.m.", "Japan", "Sweden", "AT&T Stadium, Arlington"),
    ("Thursday, June 25", "7 p.m.", "Tunisia", "Netherlands", "Arrowhead Stadium, Kansas City"),
    
    # Group G
    ("Monday, June 15", "3 p.m.", "Belgium", "Egypt", "Lumen Field, Seattle"),
    ("Monday, June 15", "9 p.m.", "Iran", "New Zealand", "SoFi Stadium, Inglewood"),
    ("Sunday, June 21", "3 p.m.", "Belgium", "Iran", "SoFi Stadium, Inglewood"),
    ("Sunday, June 21", "9 p.m.", "New Zealand", "Egypt", "BC Place, Vancouver"),
    ("Friday, June 26", "11 p.m.", "Egypt", "Iran", "Lumen Field, Seattle"),
    ("Friday, June 26", "11 p.m.", "New Zealand", "Belgium", "BC Place, Vancouver"),
    
    # Group H
    ("Monday, June 15", "12 p.m.", "Spain", "Cape Verde", "Mercedes-Benz Stadium, Atlanta"),
    ("Monday, June 15", "6 p.m.", "Saudi Arabia", "Uruguay", "Hard Rock Stadium, Miami"),
    ("Sunday, June 21", "12 p.m.", "Spain", "Saudi Arabia", "Mercedes-Benz Stadium, Atlanta"),
    ("Sunday, June 21", "6 p.m.", "Uruguay", "Cape Verde", "Hard Rock Stadium, Miami"),
    ("Friday, June 26", "8 p.m.", "Cape Verde", "Saudi Arabia", "NRG Stadium, Houston"),
    ("Friday, June 26", "8 p.m.", "Uruguay", "Spain", "Estadio Akron, Guadalajara"),
    
    # Group I
    ("Tuesday, June 16", "3 p.m.", "France", "Senegal", "MetLife Stadium, East Rutherford"),
    ("Tuesday, June 16", "6 p.m.", "Iraq", "Norway", "Gillette Stadium, Foxborough"),
    ("Monday, June 22", "5 p.m.", "France", "Iraq", "Lincoln Financial Field, Philadelphia"),
    ("Monday, June 22", "8 p.m.", "Norway", "Senegal", "MetLife Stadium, East Rutherford"),
    ("Friday, June 26", "3 p.m.", "Norway", "France", "Gillette Stadium, Foxborough"),
    ("Friday, June 26", "3 p.m.", "Senegal", "Iraq", "BMO Field, Toronto"),
    
    # Group J
    ("Tuesday, June 16", "9 p.m.", "Argentina", "Algeria", "Arrowhead Stadium, Kansas City"),
    ("Wednesday, June 17", "12 a.m.", "Austria", "Jordan", "Levi's Stadium, Santa Clara"),
    ("Monday, June 22", "1 p.m.", "Argentina", "Austria", "AT&T Stadium, Arlington"),
    ("Monday, June 22", "11 p.m.", "Jordan", "Algeria", "Levi's Stadium, Santa Clara"),
    ("Saturday, June 27", "10 p.m.", "Jordan", "Argentina", "AT&T Stadium, Arlington"),
    ("Saturday, June 27", "10 p.m.", "Algeria", "Austria", "Arrowhead Stadium, Kansas City"),
    
    # Group K
    ("Friday, June 17", "1 p.m.", "Portugal", "DR Congo", "NRG Stadium, Houston"),
    ("Friday, June 17", "10 p.m.", "Uzbekistan", "Colombia", "Estadio Azteca, Mexico City"),
    ("Tuesday, June 23", "1 p.m.", "Portugal", "Uzbekistan", "NRG Stadium, Houston"),
    ("Tuesday, June 23", "10 p.m.", "Colombia", "DR Congo", "Estadio Akron, Guadalajara"),
    ("Saturday, June 27", "7:30 p.m.", "Colombia", "Portugal", "Hard Rock Stadium, Miami"),
    ("Saturday, June 27", "7:30 p.m.", "DR Congo", "Uzbekistan", "Mercedes-Benz Stadium, Atlanta"),
    
    # Group L
    ("Friday, June 17", "4 p.m.", "England", "Croatia", "AT&T Stadium, Arlington"),
    ("Friday, June 17", "7 p.m.", "Ghana", "Panama", "BMO Field, Toronto"),
    ("Tuesday, June 23", "4 p.m.", "England", "Ghana", "Gillette Stadium, Foxborough"),
    ("Tuesday, June 23", "7 p.m.", "Panama", "Croatia", "BMO Field, Toronto"),
    ("Saturday, June 27", "5 p.m.", "Panama", "England", "MetLife Stadium, East Rutherford"),
    ("Saturday, June 27", "5 p.m.", "Croatia", "Ghana", "Lincoln Financial Field, Philadelphia"),
    
    # Round of 32
    ("Sunday, June 28", "3 p.m.", "Group A 2nd", "Group B 2nd", "SoFi Stadium, Inglewood"),
    ("Monday, June 29", "1 p.m.", "Group C Winner", "Group F 2nd", "NRG Stadium, Houston"),
    ("Monday, June 29", "4:30 p.m.", "Group E Winner", "Group A/B/C/D/F 3rd", "Gillette Stadium, Boston"),
    ("Monday, June 29", "9 p.m.", "Group F Winner", "Group C 2nd", "Estadio BBVA, Monterrey"),
    ("Tuesday, June 30", "1 p.m.", "Group E 2nd", "Group I 2nd", "AT&T Stadium, Dallas"),
    ("Tuesday, June 30", "5 p.m.", "Group I Winner", "Group C/D/F/G/H 3rd", "MetLife Stadium, East Rutherford"),
    ("Tuesday, June 30", "9 p.m.", "Group A Winner", "Group C/E/F/H/I 3rd", "Estadio Azteca, Mexico City"),
    ("Wednesday, July 1", "12 p.m.", "Group L Winner", "Group E/H/I/J/K 3rd", "Mercedes-Benz Stadium, Atlanta"),
    ("Wednesday, July 1", "4 p.m.", "Group G Winner", "Group A/E/H/I/J 3rd", "Lumen Field, Seattle"),
    ("Wednesday, July 1", "8 p.m.", "Group D Winner", "Group B/E/F/I/J 3rd", "Levi's Stadium, San Francisco"),
    ("Thursday, July 2", "3 p.m.", "Group H Winner", "Group J 2nd", "SoFi Stadium, Inglewood"),
    ("Thursday, July 2", "7 p.m.", "Group K 2nd", "Group L 2nd", "BMO Field, Toronto"),
    ("Thursday, July 2", "11 p.m.", "Group B Winner", "Group E/F/G/I/J 3rd", "BC Place, Vancouver"),
    ("Friday, July 3", "2 p.m.", "Group D 2nd", "Group G 2nd", "AT&T Stadium, Dallas"),
    ("Friday, July 3", "6 p.m.", "Group J Winner", "Group H 2nd", "Hard Rock Stadium, Miami"),
    ("Friday, July 3", "9:30 p.m.", "Group K Winner", "Group D/E/I/J/L 3rd", "Arrowhead Stadium, Kansas City"),
    
    # Round of 16
    ("Saturday, July 4", "1 p.m.", "Round of 16", "Match 1", "NRG Stadium, Houston"),
    ("Saturday, July 4", "5 p.m.", "Round of 16", "Match 2", "Lincoln Financial Field, Philadelphia"),
    ("Sunday, July 5", "4 p.m.", "Round of 16", "Match 3", "MetLife Stadium, New Jersey"),
    ("Sunday, July 5", "8 p.m.", "Round of 16", "Match 4", "Estadio Azteca, Mexico City"),
    ("Monday, July 6", "3 p.m.", "Round of 16", "Match 5", "AT&T Stadium, Dallas"),
    ("Monday, July 6", "8 p.m.", "Round of 16", "Match 6", "Lumen Field, Seattle"),
    ("Tuesday, July 7", "12 p.m.", "Round of 16", "Match 7", "Mercedes-Benz Stadium, Atlanta"),
    ("Tuesday, July 7", "4 p.m.", "Round of 16", "Match 8", "BC Place, Vancouver"),
    
    # Quarterfinals
    ("Thursday, July 9", "4 p.m.", "Quarterfinal", "Match 1", "Gillette Stadium, Boston"),
    ("Friday, July 10", "3 p.m.", "Quarterfinal", "Match 2", "SoFi Stadium, Inglewood"),
    ("Saturday, July 11", "5 p.m.", "Quarterfinal", "Match 3", "Hard Rock Stadium, Miami"),
    ("Saturday, July 11", "9 p.m.", "Quarterfinal", "Match 4", "Arrowhead Stadium, Kansas City"),
    
    # Semifinals
    ("Tuesday, July 14", "3 p.m.", "Semifinal", "Match 1", "AT&T Stadium, Dallas"),
    ("Wednesday, July 15", "3 p.m.", "Semifinal", "Match 2", "Mercedes-Benz Stadium, Atlanta"),
    
    # Third-place game
    ("Saturday, July 18", "5 p.m.", "Third Place", "Playoff", "Hard Rock Stadium, Miami"),
    
    # Final
    ("Sunday, July 19", "3 p.m.", "World Cup", "Final", "MetLife Stadium, New Jersey"),
]

def seed_world_cup_events():
    """
    Seed the database with World Cup 2026 events.
    Returns True if any events were inserted, False if all were duplicates.
    """
    conn = get_connection()
    cur = conn.cursor()
    
    inserted_count = 0
    skipped_count = 0
    
    for date_str, eastern_time, team1, team2, venue in world_cup_matches:
        # Convert Eastern schedule to London date and time
        london_date_iso, london_time = convert_eastern_to_london(date_str, eastern_time)
        
        # Create event title
        if team1 in ["Round of 16", "Quarterfinal", "Semifinal", "Third Place", "World Cup"]:
            event_title = f"{team1} {team2}"
        else:
            event_title = f"{team1} vs {team2}"
        
        # Check if event already exists
        if USE_POSTGRES:
            cur.execute(
                "SELECT id FROM practice_sessions WHERE date = %s AND event_title = %s AND event_type = 'others'",
                (london_date_iso, event_title)
            )
        else:
            cur.execute(
                "SELECT id FROM practice_sessions WHERE date = ? AND event_title = ? AND event_type = 'others'",
                (london_date_iso, event_title)
            )
        existing = cur.fetchone()
        
        if existing:
            print(f"Skipping duplicate: {event_title} on {london_date_iso}")
            skipped_count += 1
            continue
        
        # Insert the event
        if USE_POSTGRES:
            cur.execute("""
                INSERT INTO practice_sessions 
                (date, time, location, event_type, event_title, description, maximum_capacity, session_cost, cost_type, paid_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (london_date_iso, london_time, venue, "others", event_title, "2026 FIFA World Cup Match", 0, None, "Total", None))
        else:
            cur.execute("""
                INSERT INTO practice_sessions 
                (date, time, location, event_type, event_title, description, maximum_capacity, session_cost, cost_type, paid_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (london_date_iso, london_time, venue, "others", event_title, "2026 FIFA World Cup Match", 0, None, "Total", None))
        
        inserted_count += 1
        print(f"Inserted: {event_title} on {london_date_iso} at {london_time} (London) - {venue}")
    
    conn.commit()
    conn.close()
    
    print(f"\nSeeding complete!")
    print(f"Inserted: {inserted_count} events")
    print(f"Skipped: {skipped_count} duplicates")
    
    return inserted_count > 0

if __name__ == "__main__":
    print("Starting 2026 FIFA World Cup calendar event seeding...")
    print("All times will be converted from Eastern Time to London UK time (BST)")
    print("-" * 60)
    seed_world_cup_events()
