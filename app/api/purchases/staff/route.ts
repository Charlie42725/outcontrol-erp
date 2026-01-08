import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { generateCode } from '@/lib/utils'
import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'
import { getCurrentUser } from '@/lib/auth'

// Simplified schema for staff purchase submission (quantity only, no cost)
const staffPurchaseSchema = z.object({
  vendor_code: z.string().min(1, 'Vendor is required'),
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().positive('Quantity must be positive'),
    })
  ).min(1, 'At least one item is required'),
})

// POST /api/purchases/staff - Staff submits purchase for approval
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Get current user
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate input
    const validation = staffPurchaseSchema.safeParse(body)
    if (!validation.success) {
      const error = fromZodError(validation.error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      )
    }

    const draft = validation.data

    // Verify vendor exists
    const { data: vendor } = await supabaseServer
      .from('vendors')
      .select('id')
      .eq('vendor_code', draft.vendor_code)
      .single()

    if (!vendor) {
      return NextResponse.json(
        { ok: false, error: `廠商不存在: ${draft.vendor_code}` },
        { status: 400 }
      )
    }

    // Generate purchase_no
    const { count } = await supabaseServer
      .from('purchases')
      .select('*', { count: 'exact', head: true })

    const purchaseNo = generateCode('P', count || 0)

    // 1. Create purchase (status: pending for staff submission)
    const { data: purchase, error: purchaseError } = await (supabaseServer
      .from('purchases') as any)
      .insert({
        purchase_no: purchaseNo,
        vendor_code: draft.vendor_code,
        is_paid: false,  // Staff doesn't handle payment
        note: `員工進貨申請 (by ${user.username})`,
        status: 'pending',  // Pending approval from boss
        total: 0,  // Will be calculated after boss adds cost
        created_by: user.username,
      })
      .select()
      .single()

    if (purchaseError) {
      return NextResponse.json(
        { ok: false, error: purchaseError.message },
        { status: 500 }
      )
    }

    // 2. Insert purchase items with cost = 0 (boss will fill later)
    const purchaseItems = draft.items.map((item) => ({
      purchase_id: purchase.id,
      product_id: item.product_id,
      quantity: item.quantity,
      cost: 0,  // Boss will fill the cost later during approval
    }))

    const { error: itemsError } = await (supabaseServer
      .from('purchase_items') as any)
      .insert(purchaseItems)
      .select()

    if (itemsError) {
      // Rollback: delete the purchase
      await (supabaseServer.from('purchases') as any).delete().eq('id', purchase.id)
      return NextResponse.json(
        { ok: false, error: itemsError.message },
        { status: 500 }
      )
    }

    // NOTE: For pending status:
    // - No inventory update (will happen when boss approves)
    // - No AP records created (will be created when boss approves)

    return NextResponse.json(
      {
        ok: true,
        data: purchase,
        message: '進貨申請已提交，等待主管審核'
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Staff purchase submission error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
