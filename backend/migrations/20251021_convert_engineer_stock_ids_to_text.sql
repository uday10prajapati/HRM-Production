-- idempotent migration: convert engineer_stock.engineer_id and stock_item_id to TEXT
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='engineer_stock' AND column_name='engineer_id' AND data_type LIKE '%int%') THEN
    BEGIN
      ALTER TABLE engineer_stock ALTER COLUMN engineer_id TYPE TEXT USING engineer_id::text;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skipping conversion of engineer_id: %', SQLERRM;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='engineer_stock' AND column_name='stock_item_id' AND data_type LIKE '%int%') THEN
    BEGIN
      ALTER TABLE engineer_stock ALTER COLUMN stock_item_id TYPE TEXT USING stock_item_id::text;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skipping conversion of stock_item_id: %', SQLERRM;
    END;
  END IF;
END$$;
