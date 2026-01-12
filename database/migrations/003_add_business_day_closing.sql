-- 建立日結管理系統
-- Migration: 003_add_business_day_closing
-- Date: 2026-01-12
-- Purpose: 解決跨日營業問題，支援手動日結功能

-- ============================================================
-- 1. 建立日結記錄表
-- ============================================================
CREATE TABLE IF NOT EXISTS business_day_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('pos', 'live')),
  closing_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sales_count INTEGER NOT NULL DEFAULT 0,
  total_sales NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_cash NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_card NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_transfer NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_cod NUMERIC(10, 2) NOT NULL DEFAULT 0,
  sales_by_account JSONB, -- 各帳戶收入明細 {account_id: amount}
  note TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. 添加註釋
COMMENT ON TABLE business_day_closings IS '日結記錄表 - 每個營業日結束時的統計資料';
COMMENT ON COLUMN business_day_closings.source IS '銷售來源：pos=店裡收銀, live=直播';
COMMENT ON COLUMN business_day_closings.closing_time IS '結帳時間 - 標記該營業日結束';
COMMENT ON COLUMN business_day_closings.sales_count IS '銷售筆數';
COMMENT ON COLUMN business_day_closings.total_sales IS '總銷售額';
COMMENT ON COLUMN business_day_closings.total_cash IS '現金收入';
COMMENT ON COLUMN business_day_closings.total_card IS '刷卡收入';
COMMENT ON COLUMN business_day_closings.total_transfer IS '轉帳收入（所有銀行）';
COMMENT ON COLUMN business_day_closings.total_cod IS '貨到付款';
COMMENT ON COLUMN business_day_closings.sales_by_account IS '各帳戶收入明細（JSON格式）';
COMMENT ON COLUMN business_day_closings.note IS '備註（如：班別、值班人員等）';

-- 3. 建立索引
CREATE INDEX IF NOT EXISTS idx_business_day_closings_source ON business_day_closings(source);
CREATE INDEX IF NOT EXISTS idx_business_day_closings_closing_time ON business_day_closings(closing_time DESC);
CREATE INDEX IF NOT EXISTS idx_business_day_closings_created_at ON business_day_closings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_day_closings_source_closing_time ON business_day_closings(source, closing_time DESC);

-- ============================================================
-- 4. 建立 Helper Function：獲取上次結帳時間（按來源）
-- ============================================================
CREATE OR REPLACE FUNCTION get_last_closing_time(p_source TEXT)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  v_last_closing_time TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT closing_time INTO v_last_closing_time
  FROM business_day_closings
  WHERE source = p_source
  ORDER BY closing_time DESC
  LIMIT 1;

  -- 如果沒有任何結帳記錄，返回今天零點
  IF v_last_closing_time IS NULL THEN
    RETURN CURRENT_DATE::TIMESTAMP WITH TIME ZONE;
  END IF;

  RETURN v_last_closing_time;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_last_closing_time IS '獲取上次結帳時間（按來源），用於計算當日銷售';
