-- Migration: 帳戶表新增顯示相關欄位
-- 用途：讓 POS/LIVE 頁面可以從帳戶動態載入付款選項
-- 執行方式：在 Supabase SQL Editor 中執行此腳本

-- ============================================================
-- 步驟 1：新增欄位
-- ============================================================

-- display_name: 顯示名稱（如 "💵 現金"、"🏦 國泰"）
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS display_name VARCHAR(50);

-- sort_order: 排序順序（數字越小越前面）
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 999;

-- auto_mark_paid: 選擇此帳戶時是否自動標記為已付款
-- 例如：現金=true（當場收款），轉帳=false（需確認到帳）
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS auto_mark_paid BOOLEAN DEFAULT false;

-- ============================================================
-- 步驟 2：更新現有帳戶的欄位值
-- ============================================================

-- 現金帳戶
UPDATE public.accounts
SET display_name = '💵 現金',
    sort_order = 1,
    auto_mark_paid = true
WHERE payment_method_code = 'cash';

-- 刷卡帳戶
UPDATE public.accounts
SET display_name = '💳 刷卡',
    sort_order = 2,
    auto_mark_paid = false
WHERE payment_method_code = 'card';

-- 國泰銀行
UPDATE public.accounts
SET display_name = '🏦 國泰',
    sort_order = 3,
    auto_mark_paid = false
WHERE payment_method_code = 'transfer_cathay';

-- 富邦銀行
UPDATE public.accounts
SET display_name = '🏦 富邦',
    sort_order = 4,
    auto_mark_paid = false
WHERE payment_method_code = 'transfer_fubon';

-- 玉山銀行
UPDATE public.accounts
SET display_name = '🏦 玉山',
    sort_order = 5,
    auto_mark_paid = false
WHERE payment_method_code = 'transfer_esun';

-- 聯邦銀行
UPDATE public.accounts
SET display_name = '🏦 聯邦',
    sort_order = 6,
    auto_mark_paid = false
WHERE payment_method_code = 'transfer_union';

-- LINE Pay
UPDATE public.accounts
SET display_name = '💚 LINE',
    sort_order = 7,
    auto_mark_paid = false
WHERE payment_method_code = 'transfer_linepay';

-- 貨到付款
UPDATE public.accounts
SET display_name = '📦 貨到',
    sort_order = 8,
    auto_mark_paid = false
WHERE payment_method_code = 'cod';

-- 待確定
UPDATE public.accounts
SET display_name = '❓ 待定',
    sort_order = 99,
    auto_mark_paid = false
WHERE payment_method_code = 'pending';

-- 對於沒有 payment_method_code 的帳戶，使用帳戶名稱作為顯示名稱
UPDATE public.accounts
SET display_name = account_name
WHERE display_name IS NULL;

-- ============================================================
-- 步驟 3：新增索引
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_accounts_sort_order ON public.accounts(sort_order);
CREATE INDEX IF NOT EXISTS idx_accounts_payment_method_code ON public.accounts(payment_method_code);

-- ============================================================
-- 步驟 4：新增註釋
-- ============================================================

COMMENT ON COLUMN public.accounts.display_name IS 'POS 頁面顯示的名稱（可含 emoji）';
COMMENT ON COLUMN public.accounts.sort_order IS 'POS 頁面的排序順序（數字越小越前面）';
COMMENT ON COLUMN public.accounts.auto_mark_paid IS '選擇此帳戶時是否自動標記為已付款';

-- ============================================================
-- 驗證結果
-- ============================================================

SELECT id, account_name, payment_method_code, display_name, sort_order, auto_mark_paid
FROM public.accounts
ORDER BY sort_order, account_name;
