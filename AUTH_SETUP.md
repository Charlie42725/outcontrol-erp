# 登入系統設置說明

## 1. 安裝依賴

已經自動安裝完成：
- `bcryptjs` - 密碼加密
- `@types/bcryptjs` - TypeScript 類型定義

## 2. 資料庫設置

✅ **您的資料庫已經有 users 表了！**

您現有的表結構：
- `id` - UUID 主鍵
- `username` - 使用者名稱（唯一）
- `password_hash` - 密碼雜湊
- `role` - 角色 ('admin' 或 'staff')
- `full_name` - 全名（可選）
- `is_active` - 是否啟用
- `created_at` - 建立時間
- `updated_at` - 更新時間

**不需要執行任何資料庫遷移！** 代碼已經調整為使用您現有的表結構。

## 3. 建立初始帳號

### 使用 bcrypt 產生密碼雜湊

你需要為每個帳號產生密碼雜湊。可以使用以下 Node.js 腳本：

```javascript
// generate-password.js
const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'password123';
const hash = bcrypt.hashSync(password, 10);

console.log('Password:', password);
console.log('Hash:', hash);
```

運行：
```bash
node generate-password.js your_password_here
```

### 插入用戶資料

在 Supabase SQL Editor 中執行：

```sql
-- 插入管理員帳號
INSERT INTO users (username, password_hash, role, full_name, is_active)
VALUES (
  '你的帳號',  -- 帳號
  '$2a$10$你的密碼雜湊',  -- 替換成你產生的 hash
  'admin',
  '管理員名稱',  -- 可選
  true
);

-- 插入員工帳號
INSERT INTO users (username, password_hash, role, full_name, is_active)
VALUES (
  '員工帳號',  -- 帳號
  '$2a$10$你的密碼雜湊',  -- 替換成你產生的 hash
  'staff',
  '員工名稱',  -- 可選
  true
);
```

#### 測試用帳號範例

如果你想建立測試帳號，以下是密碼為 `admin123` 和 `staff123` 的範例：

```sql
-- 管理員帳號 (username: admin, password: admin123)
INSERT INTO users (username, password_hash, role, full_name, is_active)
VALUES (
  'admin',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'admin',
  '系統管理員',
  true
)
ON CONFLICT (username) DO NOTHING;

-- 員工帳號 (username: staff, password: staff123)
INSERT INTO users (username, password_hash, role, full_name, is_active)
VALUES (
  'staff',
  '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa',
  'staff',
  '一般員工',
  true
)
ON CONFLICT (username) DO NOTHING;
```

## 4. 權限設置

### 管理員權限（role: 'admin'）
- ✅ 所有功能完全開放
- ✅ 可以查看所有財務數據
- ✅ 可以進行所有操作（新增、編輯、刪除）

### 員工權限（role: 'staff'）
- ✅ POS 收銀
- ✅ 會計記帳
- ✅ 進貨單明細（僅顯示數量，隱藏成本和金額）
- ❌ 其他功能受限

## 5. 登入系統功能

- ✅ 登入頁面：`/login`
- ✅ 登出功能：導航欄右上角
- ✅ Session 管理：7 天有效期
- ✅ 自動重定向：未登入自動跳轉到登入頁
- ✅ 權限控制：根據角色顯示不同菜單
- ✅ 用戶資訊顯示：導航欄顯示當前用戶和角色

## 6. API 端點

- `POST /api/auth/login` - 登入
- `POST /api/auth/logout` - 登出
- `GET /api/auth/me` - 獲取當前用戶資訊

## 7. 測試

1. 啟動開發伺服器：
```bash
npm run dev
```

2. 訪問 `http://localhost:3000`，應該會自動重定向到登入頁

3. 使用測試帳號登入（如果你有建立）：
   - 管理員：`admin` / `admin123`
   - 員工：`staff` / `staff123`

4. 驗證權限：
   - 管理員可以看到所有菜單和功能
   - 員工只能看到 POS、會計記帳、進貨管理
   - 員工在進貨管理中看不到成本和金額

## 8. 安全性注意事項

- ✅ 密碼使用 bcrypt 加密（10 輪）
- ✅ Session 使用 httpOnly cookie
- ✅ 生產環境使用 secure cookie
- ✅ 密碼不會在回應中返回
- ⚠️ 請務必修改預設密碼
- ⚠️ 在生產環境中使用強密碼

## 9. 修改密碼

如需修改用戶密碼：

1. 使用上述腳本產生新的密碼雜湊
2. 在 Supabase SQL Editor 執行：

```sql
UPDATE users
SET password_hash = '$2a$10$你的新密碼雜湊'
WHERE username = '要修改的帳號';
```

## 10. 新增用戶

```sql
INSERT INTO users (username, password_hash, role, full_name, is_active)
VALUES (
  '新帳號',
  '$2a$10$密碼雜湊',
  'admin', -- 或 'staff'
  '使用者全名',  -- 可選
  true
);
```
