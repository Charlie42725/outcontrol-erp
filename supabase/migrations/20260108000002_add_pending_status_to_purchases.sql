-- Add 'pending' status to purchases for staff submissions
-- 為進貨單添加「待審核」狀態，用於員工提交的進貨

-- 目前 status 可能只有 'draft' 和 'confirmed'
-- 新增 'pending' 狀態用於員工提交後等待老闆審核
-- pending 狀態的進貨單不會觸發庫存更新

-- Note: Supabase 使用 text 類型，不需要修改 enum
-- 只需確保應用層支持 'pending' 值即可

COMMENT ON COLUMN purchases.status IS '進貨單狀態: draft=草稿, pending=待審核(員工提交), confirmed=已確認(老闆審核通過)';

-- Add created_by column or modify existing one (to track who created the purchase)
DO $$
DECLARE
  drop_constraints_sql TEXT;
BEGIN
  -- Check if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'purchases'
    AND column_name = 'created_by'
  ) THEN
    -- Drop any foreign key constraints on created_by
    SELECT string_agg('ALTER TABLE purchases DROP CONSTRAINT ' || constraint_name || ';', ' ')
    INTO drop_constraints_sql
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'purchases'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_name IN (
      SELECT constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'purchases'
      AND column_name = 'created_by'
    );

    -- Execute drop constraints if any exist
    IF drop_constraints_sql IS NOT NULL AND drop_constraints_sql != '' THEN
      EXECUTE drop_constraints_sql;
    END IF;

    -- Change column type to TEXT
    ALTER TABLE purchases ALTER COLUMN created_by TYPE TEXT;
  ELSE
    -- Add column if not exists
    ALTER TABLE purchases ADD COLUMN created_by TEXT;
  END IF;
END $$;

COMMENT ON COLUMN purchases.created_by IS '建立者帳號（用於追蹤是哪位員工提交）';
