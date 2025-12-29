#!/usr/bin/env python3
"""
MySQL Migration Script
Converts PostgreSQL syntax in backend files to MySQL syntax
"""

import os
import re
import sys
from pathlib import Path

def convert_pg_to_mysql(content):
    """Convert PostgreSQL syntax to MySQL"""
    
    # 1. UUID generation - gen_random_uuid() -> uuidv4() with import
    content = content.replace(
        'DEFAULT gen_random_uuid()',
        'DEFAULT (UUID())'
    )
    content = re.sub(
        r'id:\s*UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)',
        'id VARCHAR(36) PRIMARY KEY',
        content
    )
    
    # 2. Parameter placeholders $1, $2, etc -> ?
    content = re.sub(r'\$(\d+)', '?', content)
    
    # 3. DOUBLE PRECISION -> DOUBLE
    content = content.replace('DOUBLE PRECISION', 'DOUBLE')
    
    # 4. TIMESTAMP WITH TIME ZONE -> TIMESTAMP
    content = content.replace('TIMESTAMP WITH TIME ZONE', 'TIMESTAMP')
    
    # 5. UUID type -> VARCHAR(36)
    content = re.sub(r'\bUUID\b', 'VARCHAR(36)', content)
    
    # 6. Type casting ::text -> CAST(... AS CHAR) or remove if not needed
    content = re.sub(r'(\w+)::text', r"CAST(\1 AS CHAR)", content)
    content = re.sub(r"'([^']+)'::text", r"CAST('\1' AS CHAR)", content)
    
    # 7. json_agg -> JSON_ARRAYAGG
    content = re.sub(r'\bjson_agg\(', 'JSON_ARRAYAGG(', content)
    
    # 8. json_build_object -> JSON_OBJECT
    content = re.sub(r'\bjson_build_object\(', 'JSON_OBJECT(', content)
    
    # 9. COALESCE with json_agg -> conditional JSON_ARRAYAGG
    content = re.sub(
        r"COALESCE\(\s*json_agg\((.*?)\),\s*'\\[\\]'::json\s*\)",
        r"IFNULL(JSON_ARRAYAGG(\1), JSON_ARRAY())",
        content,
        flags=re.DOTALL
    )
    
    # 10. Convert pool.query calls
    # This is tricky - needs manual review
    
    # 11. result.rows -> rows (after const [rows] = await)
    # This needs context-aware replacement
    
    # 12. Remove CREATE EXTENSION statements
    content = re.sub(
        r"CREATE EXTENSION IF NOT EXISTS [^;]+;?\n?",
        "",
        content
    )
    
    # 13. Remove ALTER COLUMN DEFAULT statements that reference extensions
    content = re.sub(
        r"ALTER TABLE.*DEFAULT gen_random_uuid\(\)[^;]*;?\n?",
        "",
        content
    )
    
    # 14. ON CONFLICT -> ON DUPLICATE KEY UPDATE
    content = re.sub(
        r"ON CONFLICT \(([^)]+)\) DO UPDATE SET",
        r"ON DUPLICATE KEY UPDATE",
        content
    )
    
    # 15. Remove REFERENCES constraints (MySQL requires different handling)
    # content = re.sub(r" REFERENCES [^,;]*(?=[,;])", "", content)
    
    return content

def update_file(filepath):
    """Update a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original_content = f.read()
        
        converted_content = convert_pg_to_mysql(original_content)
        
        if original_content != converted_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(converted_content)
            print(f"✅ Updated: {filepath}")
            return True
        else:
            print(f"⏭️  No changes: {filepath}")
            return False
    except Exception as e:
        print(f"❌ Error processing {filepath}: {e}")
        return False

def main():
    backend_path = Path("./backend")
    
    if not backend_path.exists():
        print("❌ Backend directory not found. Run this script from the root of the project.")
        sys.exit(1)
    
    js_files = list(backend_path.glob("*.js"))
    
    if not js_files:
        print("❌ No JavaScript files found in backend/")
        sys.exit(1)
    
    print(f"Found {len(js_files)} JavaScript files to process...\n")
    
    updated = 0
    for filepath in sorted(js_files):
        if update_file(filepath):
            updated += 1
    
    print(f"\n📊 Summary: {updated}/{len(js_files)} files updated")
    print("\n⚠️  IMPORTANT: Review changes before deploying!")
    print("   - Manual updates needed for pool.query() -> connection.query()")
    print("   - Check result.rows conversion to rows")
    print("   - Verify UUID generation with uuidv4()")

if __name__ == "__main__":
    main()
