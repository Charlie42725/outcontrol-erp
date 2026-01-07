# ✅ 登入系統已完成

## 已調整以適應您現有的資料庫結構

代碼已經完全適配您現有的 `users` 表，**不需要執行任何資料庫遷移**！

## 您現有的表結構

```sql
create table public.users (
  id uuid not null default gen_random_uuid (),
  username character varying(50) not null,
  password_hash text not null,
  role character varying(20) not null default 'staff'::character varying,
  full_name character varying(100) null,
  is_active boolean null default true,
  created_at timestamp without time zone null default now(),
  updated_at timestamp without time zone null default now(),
  constraint users_pkey primary key (id),
  constraint users_username_key unique (username),
  constraint chk_user_role check (
    (role)::text = any (array['admin'::character varying, 'staff'::character varying]::text[])
  )
);
```

## 角色對應

- **`admin`** = 管理員（所有權限）
- **`staff`** = 員工（POS、會計、進貨查看）

## 快速開始

### 1. 建立測試帳號

使用密碼產生工具：

```bash
node scripts/generate-password.js your_password
```

或直接使用測試帳號（在 Supabase SQL Editor 執行）：

```sql
-- 管理員 (admin / admin123)
INSERT INTO users (username, password_hash, role, full_name, is_active)
VALUES (
  'admin',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'admin',
  '系統管理員',
  true
)
ON CONFLICT (username) DO NOTHING;

-- 員工 (staff / staff123)
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

### 2. 啟動測試

```bash
npm run dev
```

訪問 `http://localhost:3000` 會自動跳轉到登入頁。

## 完整功能

- ✅ 登入/登出系統
- ✅ Session 管理（7 天有效期）
- ✅ 路由保護（未登入自動跳轉）
- ✅ 角色權限控制
- ✅ 導航欄顯示用戶資訊
- ✅ 員工模式進貨單（隱藏成本）

詳細說明請參考 `AUTH_SETUP.md`。

## 注意事項

- 檔案 `supabase/migrations/20260107000001_create_users_table.sql.example` 僅供參考，您不需要執行它
- 所有代碼已經使用您現有的表結構（`admin/staff` 角色）
- 密碼使用 bcrypt 加密，非常安全
