-- Fix created_by column type in purchases table
-- 修復 purchases 表中 created_by 欄位的類型
-- This migration handles the case where created_by was created as UUID type

DO $$
DECLARE
  drop_constraints_sql TEXT;
  col_type TEXT;
BEGIN
  -- Check current column type
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'purchases'
  AND column_name = 'created_by';

  -- If column doesn't exist, create it as TEXT
  IF col_type IS NULL THEN
    ALTER TABLE purchases ADD COLUMN created_by TEXT;
    RAISE NOTICE 'Created created_by column as TEXT';
  -- If column exists but is UUID type, convert to TEXT
  ELSIF col_type = 'uuid' THEN
    RAISE NOTICE 'Converting created_by from UUID to TEXT';

    -- Drop any foreign key constraints on created_by
    SELECT string_agg('ALTER TABLE purchases DROP CONSTRAINT IF EXISTS ' || constraint_name || ';', ' ')
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
      RAISE NOTICE 'Dropped foreign key constraints: %', drop_constraints_sql;
    END IF;

    -- Change column type to TEXT
    ALTER TABLE purchases ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
    RAISE NOTICE 'Successfully converted created_by to TEXT';
  ELSE
    RAISE NOTICE 'Column created_by already has correct type: %', col_type;
  END IF;
END $$;

COMMENT ON COLUMN purchases.created_by IS '建立者帳號（用於追蹤是哪位員工提交）';
