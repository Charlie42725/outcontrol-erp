import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { productSchema } from '@/lib/schemas'
import { fromZodError } from 'zod-validation-error'
import { generateCode } from '@/lib/utils'

// GET /api/products - Search products
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const keyword = searchParams.get('keyword') || ''
    const active = searchParams.get('active')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = 50

    let query = supabaseServer
      .from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Filter by active status
    if (active !== null) {
      query = query.eq('is_active', active === 'true')
    }

    // Search by keyword (name, item_code, or barcode)
    if (keyword) {
      query = query.or(`name.ilike.%${keyword}%,item_code.ilike.%${keyword}%,barcode.ilike.%${keyword}%`)
    }

    // Apply pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      data,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/products - Create new product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validation = productSchema.safeParse(body)
    if (!validation.success) {
      const error = fromZodError(validation.error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      )
    }

    const data = validation.data

    // Generate item_code if not provided
    if (!data.item_code) {
      const { count } = await supabaseServer
        .from('products')
        .select('*', { count: 'exact', head: true })

      data.item_code = generateCode('I', count || 0)
    }

    // Check if item_code already exists
    const { data: existing } = await supabaseServer
      .from('products')
      .select('id')
      .eq('item_code', data.item_code)
      .single()

    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'Item code already exists' },
        { status: 400 }
      )
    }

    // Check if barcode already exists (if provided)
    if (data.barcode) {
      const { data: existingBarcode } = await supabaseServer
        .from('products')
        .select('id')
        .eq('barcode', data.barcode)
        .single()

      if (existingBarcode) {
        return NextResponse.json(
          { ok: false, error: 'Barcode already exists' },
          { status: 400 }
        )
      }
    }

    // Insert product
    // If initial stock is provided, set avg_cost to cost value
    const { data: product, error } = await (supabaseServer
      .from('products') as any)
      .insert({
        ...data,
        avg_cost: data.stock > 0 ? data.cost : 0,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, data: product }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
