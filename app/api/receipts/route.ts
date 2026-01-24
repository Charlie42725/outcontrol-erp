import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { settlementSchema } from '@/lib/schemas'
import { fromZodError } from 'zod-validation-error'
import { updateAccountBalance } from '@/lib/account-service'
import { getTaiwanDateString } from '@/lib/timezone'

// POST /api/receipts - Create receipt (customer payment)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Add direction for receipt
    const data = {
      ...body,
      partner_type: 'customer',
      direction: 'receipt',
    }

    // Validate input
    const validation = settlementSchema.safeParse(data)
    if (!validation.success) {
      const error = fromZodError(validation.error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      )
    }

    const draft = validation.data
    const isStoreCredit = draft.method === 'store_credit'

    // Verify total amount matches allocations
    const allocationsTotal = draft.allocations.reduce((sum, a) => sum + a.amount, 0)
    if (Math.abs(allocationsTotal - draft.amount) > 0.01) {
      return NextResponse.json(
        { ok: false, error: 'Allocation total does not match settlement amount' },
        { status: 400 }
      )
    }

    // If using store credit, verify customer has enough balance
    if (isStoreCredit) {
      const { data: customer, error: customerError } = await (supabaseServer
        .from('customers') as any)
        .select('store_credit, customer_name')
        .eq('customer_code', draft.partner_code)
        .single()

      if (customerError || !customer) {
        return NextResponse.json(
          { ok: false, error: '找不到客戶資料' },
          { status: 400 }
        )
      }

      if (customer.store_credit < draft.amount) {
        return NextResponse.json(
          { ok: false, error: `購物金餘額不足，目前餘額: $${customer.store_credit}，需要: $${draft.amount}` },
          { status: 400 }
        )
      }
    }

    // Verify all accounts are AR
    for (const allocation of draft.allocations) {
      const { data: account } = await (supabaseServer
        .from('partner_accounts') as any)
        .select('direction, balance')
        .eq('id', allocation.partner_account_id)
        .single()

      if (!account) {
        return NextResponse.json(
          { ok: false, error: `Account not found: ${allocation.partner_account_id}` },
          { status: 400 }
        )
      }

      if (account.direction !== 'AR') {
        return NextResponse.json(
          { ok: false, error: 'Can only apply receipts to AR accounts' },
          { status: 400 }
        )
      }

      if (allocation.amount > account.balance) {
        return NextResponse.json(
          { ok: false, error: `Allocation amount exceeds account balance` },
          { status: 400 }
        )
      }
    }

    // Create settlement（使用台灣時間）
    const { data: settlement, error: settlementError } = await (supabaseServer
      .from('settlements') as any)
      .insert({
        partner_type: draft.partner_type,
        partner_code: draft.partner_code,
        trans_date: getTaiwanDateString(),
        direction: draft.direction,
        method: draft.method || 'cash',
        amount: draft.amount,
        note: draft.note || null,
      })
      .select()
      .single()

    if (settlementError) {
      return NextResponse.json(
        { ok: false, error: settlementError.message },
        { status: 500 }
      )
    }

    // 購物金收款：扣除客戶購物金並記錄日誌
    if (isStoreCredit) {
      // 取得客戶目前購物金餘額
      const { data: customer } = await (supabaseServer
        .from('customers') as any)
        .select('store_credit')
        .eq('customer_code', draft.partner_code)
        .single()

      const balanceBefore = customer.store_credit
      const balanceAfter = balanceBefore - draft.amount

      // 扣除購物金
      const { error: updateError } = await (supabaseServer
        .from('customers') as any)
        .update({ store_credit: balanceAfter })
        .eq('customer_code', draft.partner_code)

      if (updateError) {
        // 回滾 settlement
        await (supabaseServer.from('settlements') as any).delete().eq('id', settlement.id)
        return NextResponse.json(
          { ok: false, error: `扣除購物金失敗: ${updateError.message}` },
          { status: 500 }
        )
      }

      // 記錄購物金變動日誌
      const { error: logError } = await (supabaseServer
        .from('customer_balance_logs') as any)
        .insert({
          customer_code: draft.partner_code,
          amount: -draft.amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          type: 'deduct',
          ref_type: 'ar_receipt',
          ref_id: settlement.id,
          ref_no: null,
          note: draft.note || '應收帳款 - 購物金抵扣',
        })

      if (logError) {
        console.warn('記錄購物金日誌失敗:', logError.message)
      }
    } else {
      // 非購物金收款：更新帳戶餘額
      const accountId = draft.account_id || null
      const paymentMethod = draft.method || 'cash'

      const accountUpdate = await updateAccountBalance({
        supabase: supabaseServer,
        accountId,
        paymentMethod,
        amount: draft.amount,
        direction: 'increase', // 收款 = 現金流入
        transactionType: 'customer_payment', // 客戶收款
        referenceId: settlement.id,
        note: draft.note
      })

      if (!accountUpdate.success && !accountUpdate.warning) {
        // 更新失敗，回滾 settlement
        await (supabaseServer.from('settlements') as any).delete().eq('id', settlement.id)
        return NextResponse.json(
          { ok: false, error: `更新帳戶失敗: ${accountUpdate.error}` },
          { status: 500 }
        )
      }

      // 儲存 account_id 到 settlement（如果是自動解析的）
      if (accountUpdate.accountId && !draft.account_id) {
        await (supabaseServer.from('settlements') as any)
          .update({ account_id: accountUpdate.accountId })
          .eq('id', settlement.id)
      }
    }

    // Create allocations (trigger will handle updating partner_accounts)
    const { error: allocationsError } = await (supabaseServer
      .from('settlement_allocations') as any)
      .insert(
        draft.allocations.map((a) => ({
          settlement_id: settlement.id,
          partner_account_id: a.partner_account_id,
          amount: a.amount,
        }))
      )

    if (allocationsError) {
      // Rollback settlement
      await (supabaseServer.from('settlements') as any).delete().eq('id', settlement.id)
      return NextResponse.json(
        { ok: false, error: allocationsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, data: settlement }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
