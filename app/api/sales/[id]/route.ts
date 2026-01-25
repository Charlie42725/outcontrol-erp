import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { saleUpdateSchema } from '@/lib/schemas'
import { fromZodError } from 'zod-validation-error'
import { getTaiwanTime } from '@/lib/timezone'

type RouteContext = {
  params: Promise<{ id: string }>
}

// GET /api/sales/:id - Get sale details with items
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params

    // Get sale
    const { data: sale, error: saleError } = await (supabaseServer
      .from('sales') as any)
      .select('*')
      .eq('id', id)
      .single()

    if (saleError) {
      return NextResponse.json(
        { ok: false, error: 'Sale not found' },
        { status: 404 }
      )
    }

    // Get sale items with product details
    const { data: items, error: itemsError } = await (supabaseServer
      .from('sale_items') as any)
      .select(`
        *,
        products:product_id (
          id,
          item_code,
          name,
          unit
        )
      `)
      .eq('sale_id', id)

    if (itemsError) {
      return NextResponse.json(
        { ok: false, error: itemsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: {
        ...sale,
        items,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/sales/:id - Update sale payment method
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params
    const body = await request.json()

    // Validate input
    const validation = saleUpdateSchema.safeParse(body)
    if (!validation.success) {
      const error = fromZodError(validation.error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      )
    }

    const { payment_method } = validation.data

    // 1. 讀取舊的 sale 記錄
    const { data: oldSale, error: fetchError } = await (supabaseServer
      .from('sales') as any)
      .select('account_id, total, payment_method')
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json(
        { ok: false, error: 'Sale not found' },
        { status: 404 }
      )
    }

    const oldAccountId = oldSale.account_id
    const saleTotal = oldSale.total

    // 2. 取得新的 account_id
    const { data: account } = await (supabaseServer
      .from('accounts') as any)
      .select('id')
      .eq('payment_method_code', payment_method)
      .eq('is_active', true)
      .single()

    const newAccountId = account?.id || null

    // 3. 如果帳戶有變更，處理餘額轉移
    // 🔧 修正：只有當舊帳戶存在時才處理轉移
    // 避免補記歷史銷售單的帳戶交易（當初創建時因 payment_method_code 未設定而沒有記帳）
    if (oldAccountId && oldAccountId !== newAccountId) {
      // 3.1 還原舊帳戶餘額
      if (oldAccountId) {
        // 刪除舊的 account_transactions
        await (supabaseServer
          .from('account_transactions') as any)
          .delete()
          .eq('ref_type', 'sale')
          .eq('ref_id', id.toString())

        // 還原舊帳戶餘額（減去收入）
        const { data: oldAccount } = await (supabaseServer
          .from('accounts') as any)
          .select('balance')
          .eq('id', oldAccountId)
          .single()

        if (oldAccount) {
          const restoredBalance = oldAccount.balance - saleTotal
          await (supabaseServer
            .from('accounts') as any)
            .update({
              balance: restoredBalance,
              updated_at: getTaiwanTime()
            })
            .eq('id', oldAccountId)

          console.log(`[Sale PATCH ${id}] Restored old account ${oldAccountId}: -${saleTotal}`)
        }
      }

      // 3.2 記錄新帳戶交易
      if (newAccountId) {
        const { data: newAccount } = await (supabaseServer
          .from('accounts') as any)
          .select('balance')
          .eq('id', newAccountId)
          .single()

        if (newAccount) {
          const newBalance = newAccount.balance + saleTotal

          // 更新新帳戶餘額
          await (supabaseServer
            .from('accounts') as any)
            .update({
              balance: newBalance,
              updated_at: getTaiwanTime()
            })
            .eq('id', newAccountId)

          // 建立新的 account_transactions
          await (supabaseServer
            .from('account_transactions') as any)
            .insert({
              account_id: newAccountId,
              transaction_type: 'sale',
              amount: saleTotal,
              balance_before: newAccount.balance,
              balance_after: newBalance,
              ref_type: 'sale',
              ref_id: id.toString(),
              note: `銷售單 ${id} - 變更支付方式為 ${payment_method}`
            })

          console.log(`[Sale PATCH ${id}] Recorded new account ${newAccountId}: +${saleTotal}`)
        }
      }
    }

    // 4. 取得台灣時間 (UTC+8)
    const now = new Date()
    const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)

    // 5. Update sale payment method and account_id
    const { data: sale, error } = await (supabaseServer
      .from('sales') as any)
      .update({
        payment_method,
        account_id: newAccountId,
        updated_at: taiwanTime.toISOString(),
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

    return NextResponse.json({ ok: true, data: sale })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/sales/:id - Delete sale and restore inventory
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params

    // 1. Check if sale exists and get its info
    const { data: sale, error: fetchError } = await (supabaseServer
      .from('sales') as any)
      .select('status, customer_code, sale_no, is_paid, account_id, total')
      .eq('id', id)
      .single()

    if (fetchError || !sale) {
      return NextResponse.json(
        { ok: false, error: 'Sale not found' },
        { status: 404 }
      )
    }

    // 1.5. Restore customer store_credit if used (check balance logs)
    if (sale.customer_code) {
      // 查找该销售单使用的购物金记录
      const { data: balanceLogs } = await (supabaseServer
        .from('customer_balance_logs') as any)
        .select('amount, balance_before, balance_after')
        .eq('ref_type', 'sale')
        .eq('ref_id', id.toString())
        .eq('customer_code', sale.customer_code)

      // 如果有使用购物金（amount 为负数），需要退回
      if (balanceLogs && balanceLogs.length > 0) {
        const balanceLog = balanceLogs[0]
        if (balanceLog.amount < 0) {
          const refundAmount = Math.abs(balanceLog.amount)

          // 获取客户当前购物金余额
          const { data: customer } = await (supabaseServer
            .from('customers') as any)
            .select('store_credit')
            .eq('customer_code', sale.customer_code)
            .single()

          if (customer) {
            const newBalance = customer.store_credit + refundAmount

            // 更新客户购物金余额
            await (supabaseServer
              .from('customers') as any)
              .update({ store_credit: newBalance })
              .eq('customer_code', sale.customer_code)

            // 刪除原使用日誌（避免孤兒記錄）
            await (supabaseServer
              .from('customer_balance_logs') as any)
              .delete()
              .eq('ref_type', 'sale')
              .eq('ref_id', id.toString())
              .eq('customer_code', sale.customer_code)

            console.log(`[Delete Sale ${id}] Restored customer ${sale.customer_code} store_credit: +${refundAmount}, deleted balance log`)
          }
        }
      }
    }

    // 1.6. 如果是已付款的銷售，需要退款到帳戶
    if (sale.is_paid && sale.account_id && sale.total > 0) {
      // 獲取帳戶餘額
      const { data: account } = await (supabaseServer
        .from('accounts') as any)
        .select('balance')
        .eq('id', sale.account_id)
        .single()

      if (account) {
        const newBalance = account.balance - sale.total

        // 更新帳戶餘額
        await (supabaseServer
          .from('accounts') as any)
          .update({
            balance: newBalance,
            updated_at: getTaiwanTime(),
          })
          .eq('id', sale.account_id)

        // 記錄帳戶交易
        await (supabaseServer
          .from('account_transactions') as any)
          .insert({
            account_id: sale.account_id,
            transaction_type: 'sale_delete',
            amount: -sale.total,
            balance_before: account.balance,
            balance_after: newBalance,
            ref_type: 'sale_delete',
            ref_id: id,
            note: `刪除銷售單 ${sale.sale_no}，退款至帳戶`,
          })

        console.log(`[Delete Sale ${id}] Refunded ${sale.total} to account ${sale.account_id}`)
      }
    }

    // 1.7. 如果是轉購物金的銷售，需要扣回購物金
    if (sale.status === 'store_credit' && sale.customer_code) {
      // 查找轉購物金的記錄
      const { data: storeCreditLogs } = await (supabaseServer
        .from('customer_balance_logs') as any)
        .select('id, amount')
        .eq('ref_type', 'sale_to_store_credit')
        .eq('ref_id', id.toString())
        .eq('customer_code', sale.customer_code)

      if (storeCreditLogs && storeCreditLogs.length > 0) {
        // 計算總共轉換的購物金
        const totalStoreCredit = storeCreditLogs.reduce((sum: number, log: any) => sum + log.amount, 0)

        // 獲取客戶當前購物金餘額
        const { data: customer } = await (supabaseServer
          .from('customers') as any)
          .select('store_credit')
          .eq('customer_code', sale.customer_code)
          .single()

        if (customer && totalStoreCredit > 0) {
          const newBalance = customer.store_credit - totalStoreCredit

          // 更新客戶購物金餘額（扣回）
          await (supabaseServer
            .from('customers') as any)
            .update({ store_credit: newBalance })
            .eq('customer_code', sale.customer_code)

          // 建立扣回記錄
          await (supabaseServer
            .from('customer_balance_logs') as any)
            .insert({
              customer_code: sale.customer_code,
              amount: -totalStoreCredit,
              balance_before: customer.store_credit,
              balance_after: newBalance,
              type: 'deduct',
              ref_type: 'sale_delete',
              ref_id: id.toString(),
              note: `刪除銷售單 ${sale.sale_no}，扣回轉換的購物金`,
            })

          // 刪除原轉換記錄
          await (supabaseServer
            .from('customer_balance_logs') as any)
            .delete()
            .eq('ref_type', 'sale_to_store_credit')
            .eq('ref_id', id.toString())
            .eq('customer_code', sale.customer_code)

          console.log(`[Delete Sale ${id}] Deducted store_credit ${totalStoreCredit} from customer ${sale.customer_code}`)
        }
      }
    }

    // 2. 刪除銷貨更正產生的庫存日誌（避免重複回補）
    // 更正時已經回補過的庫存不應該再回補
    const { data: correctionLogs } = await (supabaseServer
      .from('inventory_logs') as any)
      .select('id, product_id, qty_change')
      .eq('ref_type', 'adjustment')
      .eq('ref_id', id.toString())

    if (correctionLogs && correctionLogs.length > 0) {
      console.log(`[Delete Sale ${id}] Found ${correctionLogs.length} correction inventory logs, deleting...`)
      // 刪除這些更正產生的庫存日誌
      // 注意：這些日誌的 qty_change 已經正向回補過，
      // 所以我們需要插入反向日誌來抵消，然後刪除原始日誌
      for (const log of correctionLogs) {
        // 插入反向日誌抵消之前的回補
        await (supabaseServer
          .from('inventory_logs') as any)
          .insert({
            product_id: log.product_id,
            ref_type: 'sale_delete',
            ref_id: id.toString(),
            qty_change: -log.qty_change, // 如果更正回補了 +5，這裡就 -5
            memo: `刪除銷售單 ${sale.sale_no}，抵消更正回補`,
          })
      }

      // 刪除更正產生的庫存日誌
      await (supabaseServer
        .from('inventory_logs') as any)
        .delete()
        .eq('ref_type', 'adjustment')
        .eq('ref_id', id.toString())
    }

    // 3. Get all deliveries for this sale
    const { data: deliveries } = await (supabaseServer
      .from('deliveries') as any)
      .select('id, status, delivery_no')
      .eq('sale_id', id)

    // 4. For each delivery, restore inventory by inserting reverse logs
    // 注意：如果銷售單是轉購物金狀態，庫存已在轉換時回補過，不需要再次回補
    const skipInventoryRestore = sale.status === 'store_credit'

    for (const delivery of deliveries || []) {
      // 只有 confirmed 的 delivery 才有扣庫存，才需要回補
      if (delivery.status === 'confirmed' && !skipInventoryRestore) {
        // 獲取該出貨單的所有庫存扣除記錄
        const { data: inventoryLogs } = await (supabaseServer
          .from('inventory_logs') as any)
          .select('product_id, qty_change')
          .eq('ref_type', 'delivery')
          .eq('ref_id', delivery.id.toString())

        // 反向插入庫存日誌來回補庫存（trigger 會自動處理）
        for (const log of inventoryLogs || []) {
          await (supabaseServer
            .from('inventory_logs') as any)
            .insert({
              product_id: log.product_id,
              ref_type: 'sale_delete',
              ref_id: id.toString(),
              qty_change: -log.qty_change, // 反向數量（原本是負數，現在變正數）
              memo: `刪除銷售單 ${sale.sale_no}，回補庫存（原出貨單：${delivery.delivery_no}）`,
            })
        }

        // 刪除原有的庫存日誌
        await (supabaseServer
          .from('inventory_logs') as any)
          .delete()
          .eq('ref_type', 'delivery')
          .eq('ref_id', delivery.id.toString())
      }

      // 刪除出貨明細
      await (supabaseServer
        .from('delivery_items') as any)
        .delete()
        .eq('delivery_id', delivery.id)

      // 刪除出貨單
      await (supabaseServer
        .from('deliveries') as any)
        .delete()
        .eq('id', delivery.id)
    }

    // 4. If confirmed, need to restore ONLY ichiban kuji remaining
    if (sale.status === 'confirmed') {
      // Get all sale items (including ichiban kuji info)
      const { data: items, error: itemsError } = await (supabaseServer
        .from('sale_items') as any)
        .select('product_id, quantity, ichiban_kuji_prize_id, ichiban_kuji_id')
        .eq('sale_id', id)

      if (itemsError) {
        return NextResponse.json(
          { ok: false, error: itemsError.message },
          { status: 500 }
        )
      }

      // Restore ONLY ichiban kuji remaining
      for (const item of items || []) {
        // 如果是從一番賞售出的，恢復一番賞庫存
        if (item.ichiban_kuji_prize_id) {
          const { data: prize, error: fetchPrizeError } = await (supabaseServer
            .from('ichiban_kuji_prizes') as any)
            .select('remaining')
            .eq('id', item.ichiban_kuji_prize_id)
            .single()

          if (fetchPrizeError) {
            return NextResponse.json(
              { ok: false, error: `Failed to fetch prize: ${fetchPrizeError.message}` },
              { status: 500 }
            )
          }

          // 恢復一番賞庫的 remaining
          const { error: updatePrizeError } = await (supabaseServer
            .from('ichiban_kuji_prizes') as any)
            .update({ remaining: prize.remaining + item.quantity })
            .eq('id', item.ichiban_kuji_prize_id)

          if (updatePrizeError) {
            return NextResponse.json(
              { ok: false, error: `Failed to restore prize inventory: ${updatePrizeError.message}` },
              { status: 500 }
            )
          }
        }
      }
    }

    // 3. 處理帳戶餘額還原
    // 3.1 還原銷售時的收入（如果當時已付款）
    const { data: accountTransactions } = await (supabaseServer
      .from('account_transactions') as any)
      .select('account_id, amount')
      .eq('ref_type', 'sale')
      .eq('ref_id', id.toString())

    if (accountTransactions && accountTransactions.length > 0) {
      for (const accountTransaction of accountTransactions) {
        const { data: account } = await (supabaseServer
          .from('accounts') as any)
          .select('balance')
          .eq('id', accountTransaction.account_id)
          .single()

        if (account) {
          // 減去這筆銷售的金額（刪除場景：直接還原，因為是收入所以要減去）
          const newBalance = account.balance - accountTransaction.amount

          await (supabaseServer
            .from('accounts') as any)
            .update({
              balance: newBalance,
              updated_at: getTaiwanTime()
            })
            .eq('id', accountTransaction.account_id)

          console.log(`[Delete Sale ${id}] Restored sale account ${accountTransaction.account_id}: -${accountTransaction.amount}`)
        }
      }

      // 刪除銷售的交易記錄
      await (supabaseServer
        .from('account_transactions') as any)
        .delete()
        .eq('ref_type', 'sale')
        .eq('ref_id', id.toString())
    }

    // 3.2 處理後續收款（receipts）的還原
    // 查詢與此銷售單相關的 AR 記錄
    const { data: arRecords } = await (supabaseServer
      .from('partner_accounts') as any)
      .select('id')
      .eq('ref_type', 'sale')
      .eq('ref_id', id.toString())

    if (arRecords && arRecords.length > 0) {
      const arIds = arRecords.map((ar: any) => ar.id)

      // 查詢關聯的 settlement_allocations（收款分配）
      const { data: allocations } = await (supabaseServer
        .from('settlement_allocations') as any)
        .select('settlement_id, amount')
        .in('partner_account_id', arIds)

      if (allocations && allocations.length > 0) {
        // 找出所有關聯的 settlements（收款記錄）
        const settlementIds = [...new Set(allocations.map((a: any) => a.settlement_id))]

        for (const settlementId of settlementIds) {
          // 查詢 settlement 資訊
          const { data: settlement } = await (supabaseServer
            .from('settlements') as any)
            .select('amount, account_id, method, partner_code')
            .eq('id', settlementId)
            .single()

          if (settlement) {
            // 如果是購物金收款，回補購物金
            if (settlement.method === 'store_credit' && settlement.partner_code) {
              // 獲取客戶當前購物金餘額
              const { data: customer } = await (supabaseServer
                .from('customers') as any)
                .select('store_credit')
                .eq('customer_code', settlement.partner_code)
                .single()

              if (customer) {
                const newBalance = customer.store_credit + settlement.amount

                // 回補客戶購物金
                await (supabaseServer
                  .from('customers') as any)
                  .update({ store_credit: newBalance })
                  .eq('customer_code', settlement.partner_code)

                // 刪除購物金扣除日誌
                await (supabaseServer
                  .from('customer_balance_logs') as any)
                  .delete()
                  .eq('ref_type', 'ar_receipt')
                  .eq('ref_id', settlementId)

                console.log(`[Delete Sale ${id}] Restored store_credit ${settlement.amount} to customer ${settlement.partner_code}`)
              }
            } else if (settlement.account_id) {
              // 非購物金收款，還原帳戶餘額
              // 刪除 account_transactions 記錄
              await (supabaseServer
                .from('account_transactions') as any)
                .delete()
                .eq('ref_type', 'settlement')
                .eq('ref_id', settlementId)

              // 還原帳戶餘額（減去收款金額）
              const { data: account } = await (supabaseServer
                .from('accounts') as any)
                .select('balance')
                .eq('id', settlement.account_id)
                .single()

              if (account) {
                const newBalance = Number(account.balance) - settlement.amount
                await (supabaseServer
                  .from('accounts') as any)
                  .update({
                    balance: newBalance,
                    updated_at: getTaiwanTime()
                  })
                  .eq('id', settlement.account_id)

                console.log(`[Delete Sale ${id}] Restored receipt account ${settlement.account_id}: -${settlement.amount}`)
              }
            }
          }

          // 刪除 settlement_allocations
          await (supabaseServer
            .from('settlement_allocations') as any)
            .delete()
            .eq('settlement_id', settlementId)

          // 刪除 settlement
          await (supabaseServer
            .from('settlements') as any)
            .delete()
            .eq('id', settlementId)
        }
      }
    }

    // 4. Delete related partner accounts (AR)
    await (supabaseServer
      .from('partner_accounts') as any)
      .delete()
      .eq('ref_type', 'sale')
      .eq('ref_id', id.toString())

    // 5. Delete sale items
    await (supabaseServer.from('sale_items') as any).delete().eq('sale_id', id)

    // 6. Delete sale
    const { error: deleteError } = await (supabaseServer
      .from('sales') as any)
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
