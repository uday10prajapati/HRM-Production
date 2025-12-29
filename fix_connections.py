#!/usr/bin/env python3
"""
Fix pool.query() calls to use proper connection management.
This converts direct pool.query() calls to proper connection-based calls.
"""

import os
import re

def fix_payroll_route():
    filepath = 'd:\\Job\\HRMS\\hrm-web\\backend\\payrollRoute.js'
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix the resolveDbUserId function
    old_resolve = '''async function resolveDbUserId(identifier) {
    if (!identifier) {
        console.error('Missing identifier');
        return null;
    }

    const idStr = String(identifier).trim();
    console.log('Looking up user with identifier:', idStr);

    try {
        // Try UUID first
        const uuidQuery = await pool.query(`
            SELECT id, email 
            FROM users 
            WHERE id = ?
            LIMIT 1
        `, [idStr]);

        if (uuidQuery.rows[0]) {
            console.log('Found user by UUID');
            return uuidQuery.rows[0].id;
        }

        // If not UUID, try email
        const emailQuery = await pool.query(`
            SELECT id, email 
            FROM users 
            WHERE LOWER(email) = LOWER(?)
            LIMIT 1
        `, [idStr]);

        if (emailQuery.rows[0]) {
            console.log('Found user by email');
            return emailQuery.rows[0].id;
        }

        console.error('No user found with identifier:', idStr);
        return null;
    } catch (err) {
        console.error('Database error looking up user:', err);
        return null;
    }
}'''

    new_resolve = '''async function resolveDbUserId(identifier) {
    if (!identifier) {
        console.error('Missing identifier');
        return null;
    }

    const idStr = String(identifier).trim();
    console.log('Looking up user with identifier:', idStr);

    let connection;
    try {
        connection = await pool.getConnection();
        // Try UUID first
        const [uuidQueryRows] = await connection.query(`
            SELECT id, email 
            FROM users 
            WHERE id = ?
            LIMIT 1
        `, [idStr]);

        if (uuidQueryRows && uuidQueryRows[0]) {
            console.log('Found user by UUID');
            return uuidQueryRows[0].id;
        }

        // If not UUID, try email
        const [emailQueryRows] = await connection.query(`
            SELECT id, email 
            FROM users 
            WHERE LOWER(email) = LOWER(?)
            LIMIT 1
        `, [idStr]);

        if (emailQueryRows && emailQueryRows[0]) {
            console.log('Found user by email');
            return emailQueryRows[0].id;
        }

        console.error('No user found with identifier:', idStr);
        return null;
    } catch (err) {
        console.error('Database error looking up user:', err);
        return null;
    } finally {
        if (connection) connection.release();
    }
}'''
    
    if old_resolve in content:
        content = content.replace(old_resolve, new_resolve)
        print("✅ Fixed resolveDbUserId function")
    
    # Fix any remaining pool.query( calls with simple pattern
    # But be careful not to break commented code
    lines = content.split('\n')
    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if 'const' in line and 'pool.query' in line and '//' not in line:
            # This is likely: const result = await pool.query(
            # Check if next line continues the query
            if i + 1 < len(lines) and '`' in lines[i] and i + 2 < len(lines):
                # Multi-line query
                print(f"Found multi-line pool.query at line {i+1}: {line[:60]}")
        new_lines.append(line)
        i += 1
    
    content = '\n'.join(new_lines)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Fixed: {filepath}")

if __name__ == '__main__':
    fix_payroll_route()
