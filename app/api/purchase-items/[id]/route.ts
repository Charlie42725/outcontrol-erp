import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

type RouteContext = {
  params: Promise<{ id: string }>
}

// DELETE /api/purchase-items/:id - Delete single purchase item and restore inventory
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params

    // 1. Get purchase item details
    const { data: item, error: fetchError } = await (supabaseServer
      .from('purchase_items') as any)
      .select('*, purchases!inner(status)')
      .eq('id', id)
      .single()

    if (fetchError || !item) {
      return NextResponse.json(
        { ok: false, error: 'Purchase item not found' },
        { status: 404 }
      )
    }

    // 2. Update purchase total (if confirmed)
    if (item.purchases.status === 'confirmed') {
      const { data: remainingItems } = await (supabaseServer
        .from('purchase_items') as any)
        .select('quantity, cost')
        .eq('purchase_id', item.purchase_id)
        .neq('id', id)

      const newTotal = (remainingItems || []).reduce(
        (sum: number, i: any) => sum + (i.quantity * i.cost),
        0
      )

      await (supabaseServer
        .from('purchases') as any)
        .update({ total: newTotal })
        .eq('id', item.purchase_id)
    }

    // 3. Delete related partner accounts (AP) for this item
    const { error: apDeleteError } = await (supabaseServer
      .from('partner_accounts') as any)
      .delete()
      .eq('purchase_item_id', id)

    if (apDeleteError) {
      console.error('Failed to delete AP record:', apDeleteError)
      // Don't fail the whole operation, just log the error
    }

    // 4. Delete purchase item (triggers will handle inventory restoration via inventory_logs)
    const { error: deleteError } = await (supabaseServer
      .from('purchase_items') as any)
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
