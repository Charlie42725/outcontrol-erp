-- ============================================================
-- Migration: 添加 sale_item_id 到 delivery_items
-- 目的：支持按商品明细出货
-- ============================================================

-- 1. 添加 sale_item_id 列（可为空，因为旧数据没有这个字段）
ALTER TABLE delivery_items
ADD COLUMN IF NOT EXISTS sale_item_id UUID REFERENCES sale_items(id) ON DELETE CASCADE;

-- 2. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_delivery_items_sale_item_id 
ON delivery_items(sale_item_id);

-- 3. 注释说明
COMMENT ON COLUMN delivery_items.sale_item_id IS '关联的销售商品明细ID，用于支持按商品明细出货';
