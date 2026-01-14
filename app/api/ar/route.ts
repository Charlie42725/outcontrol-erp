import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET /api/ar - List accounts receivable
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const customerCode = searchParams.get('customer_code')
    const status = searchParams.get('status')
    const dueBefore = searchParams.get('due_before')
    const keyword = searchParams.get('keyword')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')

    // 如果有 keyword，先搜尋銷貨單號和客戶名稱找出對應的 ID
    let saleRefIds: string[] = []
    let matchingCustomerCodes: string[] = []

    if (keyword) {
      // 並行搜尋銷貨單號和客戶名稱
      const [salesResult, customersResult] = await Promise.all([
        supabaseServer
          .from('sales')
          .select('id')
          .ilike('sale_no', `%${keyword}%`),
        supabaseServer
          .from('customers')
          .select('customer_code')
          .ilike('customer_name', `%${keyword}%`)
      ])

      saleRefIds = (salesResult.data as any[])?.map(s => s.id) || []
      matchingCustomerCodes = (customersResult.data as any[])?.map(c => c.customer_code) || []
    }

    let query = supabaseServer
      .from('partner_accounts')
      .select('*', { count: 'exact' })
      .eq('partner_type', 'customer')
      .eq('direction', 'AR')
      .order('created_at', { ascending: false })

    if (customerCode) {
      query = query.eq('partner_code', customerCode)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (dueBefore) {
      query = query.lte('due_date', dueBefore)
    }

    if (keyword) {
      const conditions: string[] = []
      conditions.push(`partner_code.ilike.%${keyword}%`)
      if (matchingCustomerCodes.length > 0) {
        conditions.push(`partner_code.in.(${matchingCustomerCodes.join(',')})`)
      }
      if (saleRefIds.length > 0) {
        conditions.push(`ref_id.in.(${saleRefIds.join(',')})`)
      }
      if (conditions.length > 0) {
        query = query.or(conditions.join(','))
      }
    }

    // 分頁
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data: accounts, error, count } = await query

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({
        ok: true,
        data: [],
        pagination: { page, pageSize, total: count || 0, totalPages: 0 }
      })
    }

    // 收集需要查詢的 ID
    const customerCodes = [...new Set((accounts as any[]).map(a => a.partner_code))]
    const itemIds = (accounts as any[]).filter(a => a.sale_item_id).map(a => a.sale_item_id)
    const saleIds = [...new Set((accounts as any[]).filter(a => a.ref_type === 'sale').map(a => a.ref_id))]

    // 並行查詢所有相關資料
    const [customersResult, itemsResult, salesResult, saleItemsResult] = await Promise.all([
      // 查詢客戶
      supabaseServer
        .from('customers')
        .select('customer_code, customer_name')
        .in('customer_code', customerCodes),
      // 查詢 sale items（如果有）
      itemIds.length > 0
        ? supabaseServer
          .from('sale_items')
          .select('id, quantity, price, subtotal, product_id, sale_id, snapshot_name, products:product_id(item_code, unit)')
          .in('id', itemIds)
        : Promise.resolve({ data: [] }),
      // 查詢 sales
      saleIds.length > 0
        ? supabaseServer
          .from('sales')
          .select('id, sale_no, sale_date, payment_method')
          .in('id', saleIds)
        : Promise.resolve({ data: [] }),
      // 查詢完整 sale_items
      saleIds.length > 0
        ? supabaseServer
          .from('sale_items')
          .select('id, quantity, price, subtotal, product_id, sale_id, snapshot_name, products:product_id(item_code, unit)')
          .in('sale_id', saleIds)
        : Promise.resolve({ data: [] })
    ])

    // 建立 Map
    const customersMap = new Map(
      (customersResult.data as any[])?.map(c => [c.customer_code, c]) || []
    )
    const itemsMap = new Map(
      (itemsResult.data as any[])?.map(item => [item.id, item]) || []
    )
    const salesMap = new Map(
      (salesResult.data as any[])?.map(s => [s.id, s]) || []
    )
    const saleItemsBySaleId = new Map<string, any[]>()
    saleItemsResult.data?.forEach((item: any) => {
      if (!saleItemsBySaleId.has(item.sale_id)) {
        saleItemsBySaleId.set(item.sale_id, [])
      }
      saleItemsBySaleId.get(item.sale_id)!.push(item)
    })

    // 組合結果
    const accountsWithDetails = (accounts as any[]).map(account => {
      const saleData = account.ref_type === 'sale' ? salesMap.get(account.ref_id) : null
      const saleItems = account.ref_type === 'sale' ? saleItemsBySaleId.get(account.ref_id) || [] : []

      return {
        ...account,
        customers: customersMap.get(account.partner_code) || null,
        sale_item: account.sale_item_id ? itemsMap.get(account.sale_item_id) : null,
        sales: saleData,
        sale_items: saleItems
      }
    })

    return NextResponse.json({
      ok: true,
      data: accountsWithDetails,
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
