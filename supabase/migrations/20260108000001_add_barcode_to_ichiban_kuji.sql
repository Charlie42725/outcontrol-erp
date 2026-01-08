-- Add barcode column to ichiban_kuji table
-- 為一番賞表添加系列條碼欄位

ALTER TABLE ichiban_kuji
ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Add index for faster barcode lookups
CREATE INDEX IF NOT EXISTS idx_ichiban_kuji_barcode
ON ichiban_kuji(barcode)
WHERE barcode IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN ichiban_kuji.barcode IS '一番賞系列條碼（選填）';
