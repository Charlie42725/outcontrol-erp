-- =====================================================
-- 直接查詢：找出現金帳戶中，銷貨付款方式不是 cash 的記錄
-- =====================================================

-- 先看現金帳戶叫什麼名字、ID 是什麼
SELECT id, account_name, payment_method_code, account_type
FROM accounts
WHERE account_name LIKE '%現金%' OR payment_method_code = 'cash';


-- 方法 1: 用帳戶名稱包含「現金」來找
SELECT
  s.sale_no AS "銷貨單號",
  s.payment_method AS "銷貨付款方式",
  a.account_name AS "記帳帳戶",
  at.amount AS "交易金額",
  s.total AS "銷貨總額",
  s.sale_date AS "銷貨日期",
  s.created_at AS "建立時間"
FROM account_transactions at
JOIN accounts a ON at.account_id = a.id
JOIN sales s ON at.ref_no = s.sale_no  -- 用 ref_no 對 sale_no
WHERE a.account_name LIKE '%現金%'
  AND at.transaction_type = 'sale'
  AND s.payment_method != 'cash'
ORDER BY s.created_at DESC;


-- 方法 2: 用 ref_no (單號) 直接比對
SELECT
  at.ref_no AS "交易單號",
  s.sale_no AS "銷貨單號",
  s.payment_method AS "銷貨付款方式",
  a.account_name AS "記帳帳戶",
  at.amount AS "交易金額",
  s.total AS "銷貨總額",
  at.created_at AS "交易時間"
FROM account_transactions at
JOIN accounts a ON at.account_id = a.id
JOIN sales s ON at.ref_no = s.sale_no
WHERE a.account_name LIKE '%現金%'
  AND s.payment_method NOT IN ('cash')
ORDER BY at.created_at DESC;


-- 方法 3: 檢查特定單號 S0496, S0497
SELECT
  '交易明細' AS "來源",
  at.ref_no AS "單號",
  a.account_name AS "帳戶",
  at.amount AS "金額",
  at.transaction_type,
  at.created_at
FROM account_transactions at
JOIN accounts a ON at.account_id = a.id
WHERE at.ref_no IN ('S0496', 'S0497')

UNION ALL

SELECT
  '銷貨記錄' AS "來源",
  s.sale_no AS "單號",
  s.payment_method AS "付款方式",
  s.total AS "金額",
  s.status,
  s.created_at
FROM sales s
WHERE s.sale_no IN ('S0496', 'S0497')
ORDER BY "單號", "來源";


-- 方法 4: 統計 - 現金帳戶中各付款方式的分布
SELECT
  s.payment_method AS "銷貨付款方式",
  COUNT(*) AS "筆數",
  SUM(at.amount) AS "總金額"
FROM account_transactions at
JOIN accounts a ON at.account_id = a.id
JOIN sales s ON at.ref_no = s.sale_no
WHERE a.account_name LIKE '%現金%'
  AND at.transaction_type = 'sale'
GROUP BY s.payment_method
ORDER BY COUNT(*) DESC;
