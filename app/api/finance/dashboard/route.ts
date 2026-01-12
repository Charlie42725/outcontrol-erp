import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET /api/finance/dashboard - 獲取財務總覽數據
export async function GET(request: NextRequest) {
  try {
    const today = new Date().toISOString().split('T')[0]

    // 1. 獲取所有帳戶及其餘額
    const { data: accounts, error: accountsError } = await (supabaseServer
      .from('accounts') as any)
      .select('*')
      .eq('is_active', true)
      .order('account_type', { ascending: true })
      .order('account_name', { ascending: true })

    if (accountsError) {
      return NextResponse.json(
        { ok: false, error: accountsError.message },
        { status: 500 }
      )
    }

    // 2. 計算今日支出
    const { data: todayExpenses, error: expensesError } = await (supabaseServer
      .from('expenses') as any)
      .select('amount, account_id')
      .eq('date', today)

    if (expensesError) {
      return NextResponse.json(
        { ok: false, error: expensesError.message },
        { status: 500 }
      )
    }

    const todayExpensesTotal = todayExpenses?.reduce(
      (sum: number, exp: any) => sum + exp.amount,
      0
    ) || 0

    // 3. 計算今日銷售收入 (假設有 sales 表)
    const { data: todaySales, error: salesError } = await (supabaseServer
      .from('sales') as any)
      .select('total, payment_method, account_id, is_paid')
      .gte('sale_date', today)
      .lte('sale_date', today + 'T23:59:59')
      .eq('is_paid', true)

    // 如果沒有 sales 表或查詢失敗，設為 0
    const todaySalesTotal = salesError ? 0 : (todaySales?.reduce(
      (sum: number, sale: any) => sum + sale.total,
      0
    ) || 0)

    // 4. 按帳戶類型分組
    const accountsByType = {
      cash: accounts?.filter((a: any) => a.account_type === 'cash') || [],
      bank: accounts?.filter((a: any) => a.account_type === 'bank') || [],
      petty_cash: accounts?.filter((a: any) => a.account_type === 'petty_cash') || [],
    }

    // 5. 計算各類型總額
    const totals = {
      cash: accountsByType.cash.reduce((sum: number, a: any) => sum + a.balance, 0),
      bank: accountsByType.bank.reduce((sum: number, a: any) => sum + a.balance, 0),
      petty_cash: accountsByType.petty_cash.reduce((sum: number, a: any) => sum + a.balance, 0),
      total: accounts?.reduce((sum: number, a: any) => sum + a.balance, 0) || 0,
    }

    // 6. 今日淨現金流
    const todayNetCashFlow = todaySalesTotal - todayExpensesTotal

    // 7. 今日各帳戶支出統計
    const todayExpensesByAccount = todayExpenses?.reduce((acc: any, exp: any) => {
      if (exp.account_id) {
        acc[exp.account_id] = (acc[exp.account_id] || 0) + exp.amount
      }
      return acc
    }, {}) || {}

    // 8. 今日各帳戶收入統計
    const todaySalesByAccount = todaySales?.reduce((acc: any, sale: any) => {
      if (sale.account_id) {
        acc[sale.account_id] = (acc[sale.account_id] || 0) + sale.total
      }
      return acc
    }, {}) || {}

    return NextResponse.json({
      ok: true,
      data: {
        accounts: accountsByType,
        totals,
        today: {
          sales: todaySalesTotal,
          expenses: todayExpensesTotal,
          netCashFlow: todayNetCashFlow,
          expensesByAccount: todayExpensesByAccount,
          salesByAccount: todaySalesByAccount,
        },
      },
    })
  } catch (error) {
    console.error('Finance dashboard error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
