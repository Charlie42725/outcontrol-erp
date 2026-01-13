-- Migration: Add Account Integration for AP/AR/POS Cash Flow
-- 此遷移腳本為 settlements 表新增 account_id 欄位
-- 執行方式：在 Supabase SQL Editor 中執行此腳本

-- ============================================================
-- 步驟 1：為 settlements 表新增 account_id 欄位
-- ============================================================

-- 新增欄位連結到 accounts 表
ALTER TABLE public.settlements
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);

-- 新增索引提升查詢效能
CREATE INDEX IF NOT EXISTS idx_settlements_account_id ON public.settlements(account_id);

-- 新增註釋說明欄位用途
COMMENT ON COLUMN public.settlements.account_id IS '關聯的帳戶ID（現金/銀行帳戶），用於追蹤實際金流';

-- ============================================================
-- 驗證遷移結果
-- ============================================================

-- 檢查 settlements 表結構
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'settlements'
AND column_name = 'account_id';

-- 檢查索引是否創建成功
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'settlements'
AND indexname = 'idx_settlements_account_id';

-- ============================================================
-- 註記
-- ============================================================
-- account_transactions 表已存在於資料庫中，無需創建
-- 現有的 account_transactions 使用以下 transaction_type 值：
--   - 'expense' (費用)
--   - 'sale' (銷售)
--   - 'purchase_payment' (付款給供應商)
--   - 'customer_payment' (客戶收款)
--   - 'adjustment' (調整)
--
-- 程式碼已調整為使用這些值
