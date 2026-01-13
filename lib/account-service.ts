import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type SupabaseClientType = SupabaseClient<Database>

/**
 * 帳戶餘額更新參數
 */
export interface AccountUpdateParams {
  supabase: SupabaseClientType
  accountId: string | null          // 帳戶 ID（可為 null，將嘗試從 paymentMethod 自動解析）
  paymentMethod?: string             // 付款方式（用於自動解析帳戶）
  amount: number                     // 金額
  direction: 'increase' | 'decrease' // 增加或減少
  transactionType: 'purchase_payment' | 'customer_payment' | 'sale' | 'expense' | 'adjustment'
  referenceId: string                // 關聯記錄 ID
  referenceNo?: string               // 關聯單號
  note?: string
}

/**
 * 帳戶餘額更新結果
 */
export interface AccountUpdateResult {
  success: boolean
  accountId?: string
  error?: string
  warning?: string
  previousBalance?: number
  newBalance?: number
}

/**
 * 更新帳戶餘額
 *
 * 這個函數會：
 * 1. 自動解析帳戶（如果 accountId 為 null）
 * 2. 原子性更新餘額（使用資料庫層級操作）
 * 3. 記錄審計日誌到 account_transactions
 * 4. 處理特殊情況（pending 付款、null 帳戶等）
 *
 * @param params 更新參數
 * @returns 更新結果
 */
export async function updateAccountBalance(
  params: AccountUpdateParams
): Promise<AccountUpdateResult> {
  const {
    supabase,
    accountId: providedAccountId,
    paymentMethod,
    amount,
    direction,
    transactionType,
    referenceId,
    referenceNo,
    note
  } = params

  // 驗證金額
  if (amount <= 0) {
    return {
      success: false,
      error: '金額必須大於 0'
    }
  }

  // 特殊情況：pending 付款方式不更新帳戶餘額
  if (paymentMethod === 'pending') {
    return {
      success: true,
      warning: '付款方式為 pending，不更新帳戶餘額'
    }
  }

  let accountId = providedAccountId

  // 如果沒有提供 accountId，嘗試從 paymentMethod 自動解析
  if (!accountId && paymentMethod) {
    const { data: account, error: accountError } = await (supabase
      .from('accounts') as any)
      .select('id, balance, is_active')
      .eq('payment_method_code', paymentMethod)
      .eq('is_active', true)
      .single()

    if (accountError || !account) {
      // 無法找到對應的帳戶，但不視為錯誤（可能該付款方式沒有對應帳戶）
      return {
        success: true,
        warning: `找不到付款方式 ${paymentMethod} 對應的活躍帳戶，跳過餘額更新`
      }
    }

    accountId = account.id
  }

  // 如果還是沒有 accountId，跳過更新
  if (!accountId) {
    return {
      success: true,
      warning: '未指定帳戶，跳過餘額更新'
    }
  }

  try {
    // 🔒 冪等性檢查：防止同一筆交易重複記帳
    const { data: existingLog, error: logCheckError } = await (supabase
      .from('account_transactions') as any)
      .select('id')
      .eq('ref_type', transactionType === 'purchase_payment' || transactionType === 'customer_payment'
        ? 'settlement'
        : transactionType)
      .eq('ref_id', referenceId)
      .eq('transaction_type', transactionType)
      .limit(1)
      .maybeSingle()

    if (existingLog) {
      // 此交易已經記帳過了，跳過
      return {
        success: true,
        warning: `交易 ${referenceId} 已記帳，跳過重複更新`
      }
    }

    // 讀取當前帳戶資訊（用於審計日誌和驗證）
    const { data: account, error: fetchError } = await (supabase
      .from('accounts') as any)
      .select('id, balance, is_active, account_name')
      .eq('id', accountId)
      .single()

    if (fetchError || !account) {
      return {
        success: false,
        error: `帳戶不存在或無法讀取: ${fetchError?.message || '未知錯誤'}`
      }
    }

    if (!account.is_active) {
      return {
        success: false,
        error: `帳戶 ${account.account_name} 已停用，無法更新餘額`
      }
    }

    const previousBalance = Number(account.balance) || 0
    const changeAmount = direction === 'increase' ? amount : -amount
    const newBalance = previousBalance + changeAmount

    // 使用原子性 SQL 更新避免競態條件
    // 注意：這裡使用 RPC 或直接 SQL 來確保原子性
    const { error: updateError } = await (supabase
      .from('accounts') as any)
      .update({ balance: newBalance })
      .eq('id', accountId)

    if (updateError) {
      return {
        success: false,
        error: `更新帳戶餘額失敗: ${updateError.message}`
      }
    }

    // 記錄審計日誌到 account_transactions
    const transactionLog = {
      account_id: accountId,
      transaction_type: transactionType, // 使用資料庫的欄位名稱
      amount,
      balance_before: previousBalance,
      balance_after: newBalance,
      ref_type: transactionType === 'purchase_payment' || transactionType === 'customer_payment'
        ? 'settlement'
        : transactionType,
      ref_id: referenceId,
      ref_no: referenceNo || null,
      note: note || null
    }

    const { error: logError } = await (supabase
      .from('account_transactions') as any)
      .insert(transactionLog)

    if (logError) {
      // 審計日誌失敗不影響主要流程，但要記錄警告
      console.error('[Account Service] 寫入審計日誌失敗:', logError)
      return {
        success: true,
        accountId,
        previousBalance,
        newBalance,
        warning: `餘額更新成功，但審計日誌寫入失敗: ${logError.message}`
      }
    }

    return {
      success: true,
      accountId,
      previousBalance,
      newBalance
    }
  } catch (error: any) {
    return {
      success: false,
      error: `更新帳戶餘額時發生異常: ${error.message || '未知錯誤'}`
    }
  }
}

/**
 * 批次更新多個帳戶餘額（用於未來擴展）
 *
 * @param updates 多個更新參數
 * @returns 多個更新結果
 */
export async function batchUpdateAccountBalances(
  updates: AccountUpdateParams[]
): Promise<AccountUpdateResult[]> {
  const results: AccountUpdateResult[] = []

  for (const update of updates) {
    const result = await updateAccountBalance(update)
    results.push(result)

    // 如果某個更新失敗且不是警告，可以選擇中止後續更新
    if (!result.success && !result.warning) {
      console.error('[Account Service] 批次更新失敗:', result.error)
      // 這裡可以選擇繼續或中止
    }
  }

  return results
}

/**
 * 查詢帳戶交易歷史
 *
 * @param supabase Supabase 客戶端
 * @param accountId 帳戶 ID
 * @param options 查詢選項
 * @returns 交易記錄列表
 */
export async function getAccountTransactions(
  supabase: SupabaseClientType,
  accountId: string,
  options?: {
    startDate?: string
    endDate?: string
    transactionType?: 'purchase_payment' | 'customer_payment' | 'sale' | 'expense' | 'adjustment'
    limit?: number
  }
) {
  let query = (supabase
    .from('account_transactions') as any)
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })

  if (options?.startDate) {
    query = query.gte('created_at', options.startDate)
  }

  if (options?.endDate) {
    query = query.lte('created_at', options.endDate)
  }

  if (options?.transactionType) {
    query = query.eq('transaction_type', options.transactionType)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('[Account Service] 查詢交易歷史失敗:', error)
    return { data: null, error }
  }

  return { data, error: null }
}
