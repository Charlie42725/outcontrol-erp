import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { expenseSchema } from '@/lib/schemas'
import { fromZodError } from 'zod-validation-error'
import { updateAccountBalance } from '@/lib/account-service'

type RouteContext = {
  params: Promise<{ id: string }>
}

// GET /api/expenses/:id - Get single expense
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params

    const { data, error } = await (supabaseServer
      .from('expenses') as any)
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json(
        { ok: false, error: 'Expense not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/expenses/:id - Update expense
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params
    const body = await request.json()

    // Validate input
    const validation = expenseSchema.safeParse(body)
    if (!validation.success) {
      const error = fromZodError(validation.error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      )
    }

    const newExpense = validation.data

    // 1. 讀取舊的費用記錄
    const { data: oldExpense, error: fetchError } = await (supabaseServer
      .from('expenses') as any)
      .select('account_id, amount')
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json(
        { ok: false, error: 'Expense not found' },
        { status: 404 }
      )
    }

    const oldAccountId = oldExpense.account_id
    const newAccountId = newExpense.account_id || null
    const oldAmount = oldExpense.amount
    const newAmount = newExpense.amount

    // 2. 刪除舊的 account_transactions 記錄
    if (oldAccountId) {
      await (supabaseServer
        .from('account_transactions') as any)
        .delete()
        .eq('ref_type', 'expense')
        .eq('ref_id', id)
    }

    // 3. 更新 expense 記錄
    const { data, error } = await (supabaseServer
      .from('expenses') as any)
      .update({
        date: newExpense.date,
        category: newExpense.category,
        amount: newExpense.amount,
        account_id: newExpense.account_id || null,
        note: newExpense.note || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    // 4. 處理帳戶餘額更新
    // 情況 1: 同一個帳戶，只調整差額
    if (oldAccountId && newAccountId && oldAccountId === newAccountId) {
      const amountDiff = newAmount - oldAmount // 金額差異

      if (amountDiff !== 0) {
        // 讀取當前餘額
        const { data: account } = await (supabaseServer
          .from('accounts') as any)
          .select('balance')
          .eq('id', newAccountId)
          .single()

        if (account) {
          // 只調整差額：正差額表示要多扣，負差額表示要退回
          const newBalance = Number(account.balance) - amountDiff

          await (supabaseServer
            .from('accounts') as any)
            .update({ balance: newBalance })
            .eq('id', newAccountId)

          // 建立新的 account_transactions 記錄
          await (supabaseServer
            .from('account_transactions') as any)
            .insert({
              account_id: newAccountId,
              transaction_type: 'expense',
              amount: newAmount,
              balance_before: account.balance,
              balance_after: newBalance,
              ref_type: 'expense',
              ref_id: id,
              note: newExpense.note || null
            })
        }
      } else {
        // 金額沒變，只需重建 account_transactions 記錄
        const { data: account } = await (supabaseServer
          .from('accounts') as any)
          .select('balance')
          .eq('id', newAccountId)
          .single()

        if (account) {
          await (supabaseServer
            .from('account_transactions') as any)
            .insert({
              account_id: newAccountId,
              transaction_type: 'expense',
              amount: newAmount,
              balance_before: account.balance,
              balance_after: account.balance,
              ref_type: 'expense',
              ref_id: id,
              note: newExpense.note || null
            })
        }
      }
    }
    // 情況 2: 不同帳戶或從無到有/從有到無
    else {
      // 2.1 還原舊帳戶（如果有）
      if (oldAccountId) {
        const { data: oldAccount } = await (supabaseServer
          .from('accounts') as any)
          .select('balance')
          .eq('id', oldAccountId)
          .single()

        if (oldAccount) {
          const restoredBalance = Number(oldAccount.balance) + oldAmount
          await (supabaseServer
            .from('accounts') as any)
            .update({ balance: restoredBalance })
            .eq('id', oldAccountId)
        }
      }

      // 2.2 從新帳戶扣款（如果有）
      if (newAccountId) {
        const { data: newAccount } = await (supabaseServer
          .from('accounts') as any)
          .select('balance')
          .eq('id', newAccountId)
          .single()

        if (newAccount) {
          const newBalance = Number(newAccount.balance) - newAmount

          await (supabaseServer
            .from('accounts') as any)
            .update({ balance: newBalance })
            .eq('id', newAccountId)

          // 建立新的 account_transactions 記錄
          await (supabaseServer
            .from('account_transactions') as any)
            .insert({
              account_id: newAccountId,
              transaction_type: 'expense',
              amount: newAmount,
              balance_before: newAccount.balance,
              balance_after: newBalance,
              ref_type: 'expense',
              ref_id: id,
              note: newExpense.note || null
            })
        }
      }
    }

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/expenses/:id - Delete expense
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params

    // 先讀取 expense 資料（用於還原帳戶餘額）
    const { data: expense, error: fetchError } = await (supabaseServer
      .from('expenses') as any)
      .select('account_id, amount, note')
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json(
        { ok: false, error: 'Expense not found' },
        { status: 404 }
      )
    }

    // 如果有關聯帳戶，先還原餘額（在刪除 expense 之前）
    if (expense.account_id) {
      // 1. 刪除對應的 account_transactions 記錄
      await (supabaseServer
        .from('account_transactions') as any)
        .delete()
        .eq('ref_type', 'expense')
        .eq('ref_id', id)

      // 2. 直接反向更新帳戶餘額
      const { data: account } = await (supabaseServer
        .from('accounts') as any)
        .select('balance')
        .eq('id', expense.account_id)
        .single()

      if (account) {
        const newBalance = Number(account.balance) + expense.amount // 還原餘額

        const { error: updateError } = await (supabaseServer
          .from('accounts') as any)
          .update({ balance: newBalance })
          .eq('id', expense.account_id)

        if (updateError) {
          console.error(`[Expenses API] 刪除費用 ${id} 後還原帳戶餘額失敗:`, updateError)
        }
      }
    }

    // 刪除 expense
    const { error: deleteError } = await (supabaseServer
      .from('expenses') as any)
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json(
        { ok: false, error: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
