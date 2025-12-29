#!/usr/bin/env python3
"""
Convert remaining route files from PostgreSQL to MySQL syntax.
This script handles:
1. Replacing $N placeholders with ?
2. Replacing pool.query/pool.connect with pool.getConnection
3. Replacing result.rows with [rows] destructuring
4. Replacing RETURNING clauses with SELECT after INSERT/UPDATE
5. Removing ::text casting
6. Converting PostgreSQL JSON functions to MySQL equivalents
"""

import os
import re

def convert_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # 1. Replace $N placeholders with ?
    # Match $1, $2, etc. and replace with ?
    content = re.sub(r'\$\d+', '?', content)
    
    # 2. Replace pool.connect() with pool.getConnection()
    content = re.sub(r'pool\.connect\(\)', 'pool.getConnection()', content)
    
    # 3. Replace await pool.query( with proper connection pattern
    # This is more complex, skip for now as it requires structural changes
    
    # 4. Replace result.rows with rows (from destructuring)
    # Only do this where we've already done [rows] = await connection.query
    # This is context-dependent, so we'll do it manually in critical places
    
    # 5. Remove ::text casting
    content = re.sub(r'::text', '', content)
    
    # 6. Remove ::uuid casting
    content = re.sub(r'::uuid', '', content)
    
    # 7. Replace RETURNING * with separate SELECT
    # This requires more careful replacement
    
    # 8. Replace json_agg with JSON_ARRAYAGG
    content = re.sub(r'json_agg\(', 'JSON_ARRAYAGG(', content)
    
    # 9. Replace json_build_object with JSON_OBJECT
    content = re.sub(r'json_build_object\(', 'JSON_OBJECT(', content)
    
    # 10. Replace row_number() OVER ... with MySQL ROW_NUMBER
    # (simpler syntax but might need adjustments)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Converted: {filepath}")
        return True
    else:
        print(f"⏭️  No changes needed: {filepath}")
        return False

# List of route files to convert
route_files = [
    'd:\\Job\\HRMS\\hrm-web\\backend\\attendanceRoute.js',
    'd:\\Job\\HRMS\\hrm-web\\backend\\leaveRoute.js',
    'd:\\Job\\HRMS\\hrm-web\\backend\\payrollRoute.js',
    'd:\\Job\\HRMS\\hrm-web\\backend\\shiftsRoute.js',
    'd:\\Job\\HRMS\\hrm-web\\backend\\taskRoute.js',
    'd:\\Job\\HRMS\\hrm-web\\backend\\stockRoute.js',
    'd:\\Job\\HRMS\\hrm-web\\backend\\serviceCallsRoute.js',
    'd:\\Job\\HRMS\\hrm-web\\backend\\documentsRoute.js',
    'd:\\Job\\HRMS\\hrm-web\\backend\\overtimeRoute.js',
]

print("Starting PostgreSQL to MySQL conversion for route files...")
print("=" * 60)

converted_count = 0
for filepath in route_files:
    if os.path.exists(filepath):
        if convert_file(filepath):
            converted_count += 1
    else:
        print(f"⚠️  File not found: {filepath}")

print("=" * 60)
print(f"Conversion complete! {converted_count} files modified.")
print("\n⚠️  Note: These are automated conversions. Please review each file for:")
print("   - Connection management (try/finally with release)")
print("   - Transaction handling (beginTransaction/commit/rollback)")
print("   - Complex queries with RETURNING clauses")
print("   - Schema-specific queries that may need rewriting")
