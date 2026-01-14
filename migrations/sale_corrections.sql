-- Sale Corrections table for tracking sales corrections and refunds
-- Created: 2026-01-14

create table if not exists sale_corrections (
  id uuid default gen_random_uuid() primary key,
  sale_id uuid not null references sales(id) on delete cascade,
  correction_type text not null check (correction_type in ('item_adjust', 'full_refund', 'to_store_credit', 'partial_refund')),
  original_total numeric(10, 2) not null,
  corrected_total numeric(10, 2) not null,
  adjustment_amount numeric(10, 2) not null, -- 差額（正數=退款，負數=追加）
  store_credit_granted numeric(10, 2) default 0, -- 轉換的購物金金額
  items_adjusted jsonb, -- 記錄調整的品項詳情
  note text,
  created_at timestamp with time zone default now(),
  created_by text
);

-- Index for faster lookups
create index if not exists idx_sale_corrections_sale_id on sale_corrections(sale_id);
create index if not exists idx_sale_corrections_created_at on sale_corrections(created_at);

-- Add status column to sales table if not exists (for tracking correction status)
-- Note: Run this only if the column doesn't already exist
-- alter table sales add column if not exists correction_status text default null;

comment on table sale_corrections is '銷貨更正記錄表，用於追蹤所有銷售更正和退款操作';
comment on column sale_corrections.correction_type is '更正類型：item_adjust=品項調整, full_refund=全額退款, to_store_credit=轉購物金, partial_refund=部分退款';
comment on column sale_corrections.adjustment_amount is '調整金額，正數表示退款/減少，負數表示追加';
comment on column sale_corrections.store_credit_granted is '轉換為購物金的金額';
comment on column sale_corrections.items_adjusted is '調整的品項詳情（JSON格式）';
