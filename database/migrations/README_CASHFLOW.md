# 現金流管理系統 - 使用說明

## 系統升級完成

您的 ERP 系統已成功升級為 **真正的 Cash Flow ERP**！

## 新增功能

### 1️⃣ 帳戶管理頁 (`/accounts`)

**功能特點：**
- 新增/編輯/刪除帳戶
- 支援三種帳戶類型：
  - 現金 (cash)
  - 銀行 (bank)
  - 零用金 (petty_cash)
- 即時顯示各帳戶餘額
- 按類型分組顯示

**操作步驟：**
1. 訪問 `/accounts` 頁面
2. 點擊「新增帳戶」按鈕
3. 填寫帳戶名稱（如：國泰銀行、富邦銀行）
4. 選擇帳戶類型
5. 設定初始餘額
6. 保存即可

### 2️⃣ 會計記帳頁升級 (`/expenses`)

**新增功能：**
- ✅ 新增「支出帳戶」欄位
- ✅ 篩選器支援按帳戶篩選
- ✅ 總支出可依帳戶/類別統計
- ✅ 列表顯示支出帳戶資訊

**操作步驟：**
1. 新增費用時，必須選擇支出帳戶
2. 可使用篩選器按帳戶或類別查看支出
3. 總支出會即時顯示篩選結果

### 3️⃣ 財務總覽頁 (`/finance`)

**老闆最愛的功能！**

顯示內容：
- 📊 現金餘額
- 🏦 銀行餘額
- 💰 零用金餘額
- 📈 今日淨現金流（收入 - 支出）
- 📅 今日收入/支出明細
- 🔍 各帳戶今日支出統計

**特色：**
- 即時數據，一目了然
- 按帳戶類型分組顯示
- 今日現金流詳情
- 支援深色模式

## 資料庫遷移

執行以下 SQL 腳本來建立資料表：

```bash
# 在 Supabase SQL Editor 中執行
database/migrations/002_add_accounts_and_cashflow.sql
```

**遷移內容：**
1. 建立 `accounts` 表
2. 建立 `account_transactions` 表（用於未來追蹤）
3. 為 `expenses` 表添加 `account_id` 欄位
4. 插入預設帳戶（現金、零用金）

## API 端點

### 帳戶管理
- `GET /api/accounts` - 獲取所有帳戶
- `POST /api/accounts` - 新增帳戶
- `GET /api/accounts/:id` - 獲取單一帳戶
- `PATCH /api/accounts/:id` - 更新帳戶
- `DELETE /api/accounts/:id` - 刪除帳戶

### 財務總覽
- `GET /api/finance/dashboard` - 獲取財務總覽數據

### 費用管理（已更新）
- `GET /api/expenses?account_id={id}` - 按帳戶篩選費用
- `POST /api/expenses` - 新增費用（需包含 account_id）
- `PUT /api/expenses/:id` - 更新費用（需包含 account_id）

## 系統等級提升

### 升級前 ❌
- 記帳小工具
- Excel 替代品
- 無法對帳
- 無現金流追蹤

### 升級後 ✅
- **真正的 Cash Flow ERP**
- **可對帳**
- **多帳戶管理**
- **即時財務總覽**
- **可擴充金流 API**（預留接口）

## 未來擴充建議

1. **金流 API 整合**（已預留接口）
   - 綠界金流
   - 藍新金流
   - 自動對帳功能

2. **帳戶交易記錄**
   - 使用 `account_transactions` 表
   - 追蹤每筆帳戶異動
   - 生成對帳報表

3. **財務報表**
   - 月度/年度報表
   - 現金流量表
   - 帳戶異動明細

4. **預算管理**
   - 設定各類別預算
   - 預算執行率追蹤
   - 超支警告

## 技術架構

- **前端**: Next.js 16 + TypeScript + Tailwind CSS
- **後端**: Next.js API Routes
- **資料庫**: Supabase (PostgreSQL)
- **驗證**: Zod Schema Validation
- **狀態管理**: React Hooks

## 注意事項

1. **必須先建立帳戶**才能新增費用
2. **刪除帳戶前**確保該帳戶沒有關聯的費用記錄
3. **帳戶餘額**目前需要手動管理，未來可自動計算
4. **銷售收入**來自 sales 表，需確保 is_paid = true

## 聯絡支援

如有問題，請查看：
- 系統日誌
- API 錯誤訊息
- Supabase 資料庫連線狀態

---

🎉 恭喜！您的 ERP 系統已成功升級為 **Cash Flow ERP**！
