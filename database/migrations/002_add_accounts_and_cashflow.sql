-- 建立帳戶管理和現金流追蹤系統
-- Migration: 002_add_accounts_and_cashflow
-- Date: 2026-01-11
-- Updated: 2026-01-12 (新增 sales 收入連動帳戶)

-- ============================================================
-- 1. 建立帳戶表
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('cash', 'bank', 'petty_cash')),
  payment_method_code TEXT UNIQUE, -- 對應 PaymentMethod，用於自動對應收款帳戶
  balance NUMERIC(10, 2) DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. 添加註釋
COMMENT ON TABLE accounts IS '帳戶管理表';
COMMENT ON COLUMN accounts.account_name IS '帳戶名稱，如：現金、國泰銀行、富邦銀行、零用金';
COMMENT ON COLUMN accounts.account_type IS '帳戶類型：cash=現金, bank=銀行, petty_cash=零用金';
COMMENT ON COLUMN accounts.payment_method_code IS '對應的付款方式代碼，用於 POS 自動對應收款帳戶';
COMMENT ON COLUMN accounts.balance IS '帳戶餘額';
COMMENT ON COLUMN accounts.is_active IS '是否啟用';

-- 3. 建立索引
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_is_active ON accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_payment_method ON accounts(payment_method_code);

-- 4. 建立觸發器自動更新 updated_at
CREATE OR REPLACE FUNCTION update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION update_accounts_updated_at();

-- ============================================================
-- 5. 為 expenses 表添加 account_id 欄位（支出帳戶）
-- ============================================================
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON expenses(account_id);

COMMENT ON COLUMN expenses.account_id IS '支出帳戶（從哪個帳戶支出）';

-- ============================================================
-- 6. 為 sales 表添加 account_id 欄位（收入帳戶）
-- ============================================================
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_account_id ON sales(account_id);

COMMENT ON COLUMN sales.account_id IS '收入帳戶（錢進哪個帳戶）';

-- ============================================================
-- 7. 插入預設帳戶
-- ============================================================
INSERT INTO accounts (account_name, account_type, payment_method_code, balance)
VALUES
  -- 現金相關
  ('現金', 'cash', 'cash', 0),
  ('零用金', 'petty_cash', NULL, 0),

  -- 銀行帳戶
  ('國泰銀行', 'bank', 'transfer_cathay', 0),
  ('富邦銀行', 'bank', 'transfer_fubon', 0),
  ('玉山銀行', 'bank', 'transfer_esun', 0),
  ('聯邦銀行', 'bank', 'transfer_union', 0),

  -- 第三方支付
  ('LinePay', 'bank', 'transfer_linepay', 0),

  -- 刷卡帳戶（可依實際情況調整）
  ('刷卡收入', 'bank', 'card', 0),

  -- 貨到付款（通常等同現金）
  ('貨到付款', 'cash', 'cod', 0)
ON CONFLICT (payment_method_code) DO NOTHING;

-- ============================================================
-- 8. 建立帳戶交易記錄表 (用於追蹤所有帳戶異動)
-- ============================================================
CREATE TABLE IF NOT EXISTS account_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('expense', 'sale', 'purchase_payment', 'customer_payment', 'adjustment')),
  amount NUMERIC(10, 2) NOT NULL,
  balance_before NUMERIC(10, 2) NOT NULL,
  balance_after NUMERIC(10, 2) NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  ref_no TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 9. 添加註釋
COMMENT ON TABLE account_transactions IS '帳戶交易記錄表';
COMMENT ON COLUMN account_transactions.transaction_type IS '交易類型：expense=費用支出, sale=銷售收入, purchase_payment=進貨付款, customer_payment=客戶收款, adjustment=人工調整';
COMMENT ON COLUMN account_transactions.amount IS '交易金額，正數表示收入，負數表示支出';

-- 10. 建立索引
CREATE INDEX IF NOT EXISTS idx_account_transactions_account_id ON account_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_created_at ON account_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_transactions_type ON account_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_account_transactions_ref ON account_transactions(ref_type, ref_id);

-- ============================================================
-- 11. 建立觸發器：當 sales 插入/更新時自動記錄帳戶交易
-- ============================================================

-- 銷售自動創建帳戶交易記錄的函數
CREATE OR REPLACE FUNCTION record_sale_account_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_balance_before NUMERIC(10, 2);
  v_balance_after NUMERIC(10, 2);
BEGIN
  -- 只有當銷售已付款且有指定帳戶時才記錄
  IF NEW.is_paid = true AND NEW.account_id IS NOT NULL THEN

    -- 如果是 UPDATE，先檢查是否已記錄過
    IF TG_OP = 'UPDATE' THEN
      -- 如果之前未付款，現在付款了，才記錄
      IF OLD.is_paid = false OR OLD.account_id IS NULL OR OLD.account_id != NEW.account_id THEN
        -- 如果之前有記錄，先刪除舊記錄（避免重複）
        DELETE FROM account_transactions
        WHERE ref_type = 'sale' AND ref_id = OLD.id::text;
      ELSE
        -- 已經記錄過，不重複記錄
        RETURN NEW;
      END IF;
    END IF;

    -- 獲取當前帳戶餘額
    SELECT balance INTO v_balance_before
    FROM accounts
    WHERE id = NEW.account_id
    FOR UPDATE;

    -- 計算新餘額（收入為正）
    v_balance_after := v_balance_before + NEW.total;

    -- 更新帳戶餘額
    UPDATE accounts
    SET balance = v_balance_after
    WHERE id = NEW.account_id;

    -- 創建交易記錄
    INSERT INTO account_transactions (
      account_id,
      transaction_type,
      amount,
      balance_before,
      balance_after,
      ref_type,
      ref_id,
      ref_no,
      note
    ) VALUES (
      NEW.account_id,
      'sale',
      NEW.total, -- 收入為正數
      v_balance_before,
      v_balance_after,
      'sale',
      NEW.id::text,
      NEW.sale_no,
      NEW.note
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
DROP TRIGGER IF EXISTS sales_account_transaction ON sales;
CREATE TRIGGER sales_account_transaction
AFTER INSERT OR UPDATE ON sales
FOR EACH ROW
EXECUTE FUNCTION record_sale_account_transaction();

-- ============================================================
-- 12. 建立觸發器：當 expenses 插入/更新時自動記錄帳戶交易
-- ============================================================

-- 費用自動創建帳戶交易記錄的函數
CREATE OR REPLACE FUNCTION record_expense_account_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_balance_before NUMERIC(10, 2);
  v_balance_after NUMERIC(10, 2);
BEGIN
  -- 只有當有指定帳戶時才記錄
  IF NEW.account_id IS NOT NULL THEN

    -- 如果是 UPDATE，處理帳戶變更
    IF TG_OP = 'UPDATE' THEN
      IF OLD.account_id IS NOT NULL AND OLD.account_id != NEW.account_id THEN
        -- 先刪除舊記錄
        DELETE FROM account_transactions
        WHERE ref_type = 'expense' AND ref_id = OLD.id::text;
      ELSIF OLD.account_id = NEW.account_id AND OLD.amount = NEW.amount THEN
        -- 帳戶和金額都沒變，不重複記錄
        RETURN NEW;
      ELSE
        -- 同帳戶但金額變了，先刪除舊記錄
        DELETE FROM account_transactions
        WHERE ref_type = 'expense' AND ref_id = OLD.id::text;
      END IF;
    END IF;

    -- 獲取當前帳戶餘額
    SELECT balance INTO v_balance_before
    FROM accounts
    WHERE id = NEW.account_id
    FOR UPDATE;

    -- 計算新餘額（支出為負）
    v_balance_after := v_balance_before - NEW.amount;

    -- 更新帳戶餘額
    UPDATE accounts
    SET balance = v_balance_after
    WHERE id = NEW.account_id;

    -- 創建交易記錄
    INSERT INTO account_transactions (
      account_id,
      transaction_type,
      amount,
      balance_before,
      balance_after,
      ref_type,
      ref_id,
      note
    ) VALUES (
      NEW.account_id,
      'expense',
      -NEW.amount, -- 支出為負數
      v_balance_before,
      v_balance_after,
      'expense',
      NEW.id::text,
      COALESCE(NEW.note, NEW.category)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
DROP TRIGGER IF EXISTS expenses_account_transaction ON expenses;
CREATE TRIGGER expenses_account_transaction
AFTER INSERT OR UPDATE ON expenses
FOR EACH ROW
EXECUTE FUNCTION record_expense_account_transaction();

-- ============================================================
-- 13. 建立 Helper Function：根據 payment_method 獲取對應帳戶
-- ============================================================
CREATE OR REPLACE FUNCTION get_account_by_payment_method(p_payment_method TEXT)
RETURNS UUID AS $$
DECLARE
  v_account_id UUID;
BEGIN
  SELECT id INTO v_account_id
  FROM accounts
  WHERE payment_method_code = p_payment_method
    AND is_active = true
  LIMIT 1;

  RETURN v_account_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_account_by_payment_method IS '根據付款方式獲取對應的帳戶 ID';
