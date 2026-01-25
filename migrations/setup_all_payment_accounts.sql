-- Migration: 設定所有付款帳戶
-- 執行方式：在 Supabase SQL Editor 中執行此腳本

-- ============================================================
-- 1. 新增「待定」帳戶
-- ============================================================
INSERT INTO public.accounts (account_name, account_type, payment_method_code, display_name, sort_order, auto_mark_paid, balance, is_active)
VALUES ('待確定', 'cash', 'pending', '❓ 待定', 99, false, 0, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. 設定 Line bank 為付款選項
-- ============================================================
UPDATE public.accounts
SET payment_method_code = 'transfer_linebank',
    display_name = '💚 Line Bank',
    sort_order = 10
WHERE account_name = 'Line bank';

-- ============================================================
-- 3. 設定郵局為付款選項
-- ============================================================
UPDATE public.accounts
SET payment_method_code = 'transfer_post',
    display_name = '🏤 郵局',
    sort_order = 11
WHERE account_name = '郵局';

-- ============================================================
-- 4. 設定國泰公司戶為付款選項
-- ============================================================
UPDATE public.accounts
SET payment_method_code = 'transfer_cathay_biz',
    display_name = '🏦 國泰公司',
    sort_order = 12
WHERE account_name = '國泰公司戶';

-- ============================================================
-- 驗證結果
-- ============================================================
SELECT id, account_name, payment_method_code, display_name, sort_order, auto_mark_paid
FROM public.accounts
ORDER BY sort_order, account_name;
