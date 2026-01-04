-- Create stock_adjustments table for inventory adjustment records
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  previous_stock INTEGER NOT NULL,
  adjusted_stock INTEGER NOT NULL,
  difference INTEGER NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product_id ON stock_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_created_at ON stock_adjustments(created_at DESC);

-- Enable RLS
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth requirements)
CREATE POLICY "Allow all operations on stock_adjustments" ON stock_adjustments
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE stock_adjustments IS '庫存盤點調整記錄';
COMMENT ON COLUMN stock_adjustments.product_id IS '商品ID';
COMMENT ON COLUMN stock_adjustments.previous_stock IS '盤點前庫存';
COMMENT ON COLUMN stock_adjustments.adjusted_stock IS '盤點後庫存';
COMMENT ON COLUMN stock_adjustments.difference IS '差異數量（正數=盤盈，負數=盤虧）';
COMMENT ON COLUMN stock_adjustments.note IS '備註';
