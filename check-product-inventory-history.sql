-- 查詢商品庫存異動記錄
-- 使用品號：P000096

-- 1. 商品基本資訊
SELECT
  id as 商品ID,
  item_code as 品號,
  name as 商品名稱,
  barcode as 條碼,
  stock as 目前庫存,
  avg_cost as 平均成本
FROM products
WHERE item_code = 'P000096';

-- 2. 所有庫存異動記錄（從最新到最舊）
SELECT
  to_char(il.created_at, 'YYYY-MM-DD HH24:MI:SS') as 異動時間,
  il.ref_type as 類型,
  il.qty_change as 數量變化,
  il.memo as 備註
FROM inventory_logs il
JOIN products p ON il.product_id = p.id
WHERE p.item_code = 'P000096'
ORDER BY il.created_at DESC;

-- 3. 理論庫存計算
SELECT
  SUM(il.qty_change) as 理論庫存,
  COUNT(*) as 總異動次數,
  COUNT(CASE WHEN il.qty_change > 0 THEN 1 END) as 增加次數,
  COUNT(CASE WHEN il.qty_change < 0 THEN 1 END) as 減少次數
FROM inventory_logs il
JOIN products p ON il.product_id = p.id
WHERE p.item_code = 'P000096';

-- 4. 進貨記錄
SELECT
  p.purchase_no as 進貨單號,
  pi.quantity as 進貨數量,
  pi.received_quantity as 已收數量,
  pi.is_received as 完成收貨,
  p.status as 狀態,
  to_char(p.created_at, 'YYYY-MM-DD HH24:MI:SS') as 建立時間
FROM purchase_items pi
JOIN purchases p ON pi.purchase_id = p.id
JOIN products prod ON pi.product_id = prod.id
WHERE prod.item_code = 'P000096'
ORDER BY p.created_at DESC;

-- 5. 銷售記錄
SELECT
  s.sale_no as 銷售單號,
  si.quantity as 銷售數量,
  si.is_delivered as 已出貨,
  s.source as 來源,
  to_char(s.created_at, 'YYYY-MM-DD HH24:MI:SS') as 建立時間
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
JOIN products prod ON si.product_id = prod.id
WHERE prod.item_code = 'P000096'
ORDER BY s.created_at DESC;

-- 6. 檢查是否有異常（理論庫存 vs 實際庫存）
SELECT
  p.item_code as 品號,
  p.name as 商品名稱,
  p.stock as 實際庫存,
  COALESCE(SUM(il.qty_change), 0) as 理論庫存,
  p.stock - COALESCE(SUM(il.qty_change), 0) as 差異
FROM products p
LEFT JOIN inventory_logs il ON il.product_id = p.id
WHERE p.item_code = 'P000096'
GROUP BY p.id, p.item_code, p.name, p.stock;
