import { Client } from 'pg';

const client = new Client({
    connectionString: 'postgresql://postgres.zssdfdngclkuamzpyeyz:oMyZvK0etAnknHQF@aws-1-us-east-1.pooler.supabase.com:6543/postgres'
});

async function run() {
    await client.connect();
    try {
        const query = `
      SELECT call_id, ta_voucher_date, ta_voucher_number, ta_call_type, ta_travel_mode, ta_status, ta_revised_km, ta_revised_places, kms_traveled
      FROM assign_call
      WHERE (CAST(id AS TEXT) = $1 OR CAST(engineer_id AS TEXT) = $1)
        AND ta_voucher_number IS NOT NULL
        AND ta_voucher_number != 'null'
        AND ta_voucher_date IS NOT NULL
        AND ta_voucher_date != ''
        AND TO_DATE(ta_voucher_date, 'YYYY-MM-DD') BETWEEN TO_DATE($2, 'YYYY-MM-DD') AND TO_DATE($3, 'YYYY-MM-DD')
      ORDER BY TO_DATE(ta_voucher_date, 'YYYY-MM-DD') DESC, created_at DESC
    `;
        const res = await client.query(query, ['2ddfdfc9-43bb-41ef-aa5c-0215c54c0ecd', '2026-02-01', '2026-02-28']);
        console.log(res.rows);
    } catch (err) {
        console.error("SQL Error:", err.message);
    } finally {
        client.end();
    }
}

run();
