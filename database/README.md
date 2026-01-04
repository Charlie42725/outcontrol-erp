# 資料庫設置說明

## 庫存盤點功能

### 設置步驟

1. 登入 Supabase Dashboard
2. 進入 SQL Editor
3. 執行 `create-stock-adjustments.sql` 文件中的 SQL 語句

### 功能說明

庫存盤點功能允許您：
- 在商品編輯頁面進行庫存盤點
- 記錄盤點前後的數量差異
- 查看歷史盤點記錄
- 添加盤點備註

### 資料表結構

**stock_adjustments** - 庫存盤點記錄表
- `id` - 記錄ID
- `product_id` - 商品ID（關聯到 products 表）
- `previous_stock` - 盤點前庫存
- `adjusted_stock` - 盤點後庫存
- `difference` - 差異數量（正數=盤盈，負數=盤虧）
- `note` - 備註（選填）
- `created_at` - 盤點時間

### API 端點

- `POST /api/products/[id]/adjust-stock` - 執行庫存盤點
- `GET /api/products/[id]/adjustments` - 查詢盤點歷史

### 使用方式

1. 進入商品編輯頁面
2. 在「庫存盤點」區塊點擊「開始盤點」
3. 輸入實際盤點的庫存數量
4. （可選）填寫盤點備註
5. 點擊「確認盤點」
6. 系統會顯示盤點結果並更新庫存
7. 可在下方查看歷史盤點記錄
