#!/usr/bin/env python3
"""
Script to fix SQL queries in api.py to work with both SQLite and PostgreSQL.
Converts ? placeholders to %s for PostgreSQL compatibility.
"""

import re

def fix_sql_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Add helper function after the database setup
    helper_function = '''
# Helper function to convert SQLite placeholders to PostgreSQL
def sql(query):
    """Convert SQLite ? placeholders to PostgreSQL %s placeholders"""
    if USE_POSTGRES:
        return query.replace("?", "%s")
    return query

'''
    
    # Insert helper function after UPLOAD_DIR setup
    insertion_point = 'os.makedirs(UPLOAD_DIR, exist_ok=True)\n'
    if insertion_point in content:
        content = content.replace(insertion_point, insertion_point + helper_function)
    
    # Pattern to match cur.execute with string literals
    # Match: cur.execute("...", or cur.execute("""...""", or cur.execute('...', 
    pattern = r'cur\.execute\(\s*(["\'])'
    
    def replacer(match):
        quote = match.group(1)
        return f'cur.execute(sql({quote}'
    
    # Replace all cur.execute( with cur.execute(sql(
    content = re.sub(pattern, replacer, content)
    
    # Now we need to add closing ) for sql() before the parameters
    # Pattern: sql("query"), params) or sql("query"))
    # We need to find the end of the string and add ) before the comma or closing paren
    
    # This is complex, so let's use a different approach:
    # Find all cur.execute(sql( and manually fix the closing
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check if this line has cur.execute(sql(
        if 'cur.execute(sql(' in line:
            # Collect the full execute statement
            full_statement = line
            paren_count = line.count('(') - line.count(')')
            j = i + 1
            
            # Keep collecting lines until parentheses are balanced
            while paren_count > 0 and j < len(lines):
                full_statement += '\n' + lines[j]
                paren_count += lines[j].count('(') - lines[j].count(')')
                j += 1
            
            # Now fix the statement
            # Find the end of the SQL string and add ) before the next comma or )
            if '"""' in full_statement:
                # Triple-quoted string
                parts = full_statement.split('"""')
                if len(parts) >= 3:
                    # parts[0] = before first """
                    # parts[1] = SQL query
                    # parts[2] = after second """
                    parts[2] = ')' + parts[2]
                    full_statement = '"""'.join(parts)
            elif "'''" in full_statement:
                # Triple-quoted string with single quotes
                parts = full_statement.split("'''")
                if len(parts) >= 3:
                    parts[2] = ')' + parts[2]
                    full_statement = "'''".join(parts)
            else:
                # Single or double quoted string - find the closing quote
                # This is tricky with escaped quotes, so use regex
                full_statement = re.sub(
                    r'(cur\.execute\(sql\((["\']).*?\2)(,|\))',
                    r'\1)\3',
                    full_statement,
                    flags=re.DOTALL
                )
            
            # Add the fixed statement
            fixed_lines.extend(full_statement.split('\n'))
            i = j
        else:
            fixed_lines.append(line)
            i += 1
    
    content = '\n'.join(fixed_lines)
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"Fixed {filepath}")

if __name__ == '__main__':
    fix_sql_file('api.py')
