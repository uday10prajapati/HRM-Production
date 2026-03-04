-- Add SKU column to stock_items table if it doesn't exist
ALTER TABLE stock_items
ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE;

-- Create index on SKU for faster lookups
CREATE INDEX IF NOT EXISTS idx_stock_items_sku ON stock_items(sku);
