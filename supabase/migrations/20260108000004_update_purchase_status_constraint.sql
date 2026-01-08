-- Update purchase status check constraint to include 'pending'
-- 更新進貨單狀態檢查約束，加入 'pending' 狀態

-- Drop existing check constraint if exists
ALTER TABLE purchases
DROP CONSTRAINT IF EXISTS chk_purchase_status;

-- Add new check constraint with 'pending' status
ALTER TABLE purchases
ADD CONSTRAINT chk_purchase_status
CHECK (status IN ('draft', 'pending', 'confirmed', 'cancelled'));

-- Add comment
COMMENT ON CONSTRAINT chk_purchase_status ON purchases IS
'進貨單狀態約束: draft=草稿, pending=待審核(員工提交), confirmed=已確認(老闆審核通過), cancelled=已取消';
