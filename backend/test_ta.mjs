import { Client } from 'pg';

const client = new Client({
    connectionString: 'postgresql://postgres.zssdfdngclkuamzpyeyz:oMyZvK0etAnknHQF@aws-1-us-east-1.pooler.supabase.com:6543/postgres'
});

async function run() {
    await client.connect();
    try {
        const query = `
      WITH RankedCalls AS (
        SELECT *, 
               TO_CHAR(created_at, 'DDMMYY') || '/' || 
               ROW_NUMBER() OVER(PARTITION BY DATE(created_at) ORDER BY created_at ASC) as sequence_id
        FROM assign_call
      )
      SELECT sequence_id, call_id, dairy_name, name, ta_voucher_date, ta_voucher_number, ta_call_type, ta_travel_mode, ta_status, ta_revised_km, ta_revised_places, kms_traveled
      FROM RankedCalls
      WHERE CAST(id AS TEXT) = $1
        AND ta_voucher_number IS NOT NULL
        AND ta_voucher_number != 'null'
        AND ta_voucher_date IS NOT NULL
        AND ta_voucher_date >= CAST($2 AS DATE)
        AND ta_voucher_date <= CAST($3 AS DATE)
      ORDER BY ta_voucher_date DESC, created_at DESC
    `;
        const res = await client.query(query, ['2ddfdfc9-43bb-41ef-aa5c-0215c54c0ecd', '2026-02-01', '2026-02-28']);
        console.log("Success. Rows retrieved:", res.rows.length);
        console.log(res.rows);
    } catch (err) {
        console.error("SQL Error:", err.message);
    } finally {
        client.end();
    }
}

run();
