import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { getAccountTransactions } from '@/lib/account-service'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const transactionType = searchParams.get('transactionType') as 'purchase_payment' | 'customer_payment' | 'sale' | 'expense' | 'adjustment' | null

    // Use supabaseServer directly as it is the initialized client in this project
    const { data, count, error } = await getAccountTransactions(supabaseServer, id, {
        limit,
        page,
        startDate,
        endDate,
        transactionType: transactionType || undefined
    })

    if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    // Enrich transactions with customer/vendor info
    const enrichedData = await enrichTransactions(data || [])

    return NextResponse.json({
        ok: true,
        data: enrichedData,
        meta: {
            total: count,
            page,
            limit,
            totalPages: count ? Math.ceil(count / limit) : 0
        }
    })
}

type TransactionRecord = {
    id: string
    ref_type: string
    ref_id: string
    ref_no: string | null
    transaction_type: string
    amount: number
    balance_before: number
    balance_after: number
    note: string | null
    created_at: string
}

type EnrichedTransaction = TransactionRecord & {
    customer_name?: string | null
    customer_code?: string | null
    vendor_name?: string | null
    vendor_code?: string | null
    original_payment_method?: string | null
}

async function enrichTransactions(transactions: TransactionRecord[]): Promise<EnrichedTransaction[]> {
    if (!transactions || transactions.length === 0) return []

    // Collect ref_ids by type
    const saleRefIds: string[] = []
    const purchaseRefIds: string[] = []
    const settlementRefIds: string[] = []

    for (const tx of transactions) {
        if (tx.ref_type === 'sale' || tx.transaction_type === 'sale') {
            if (tx.ref_id) saleRefIds.push(tx.ref_id)
        } else if (tx.ref_type === 'purchase_payment' || tx.transaction_type === 'purchase_payment') {
            if (tx.ref_id) purchaseRefIds.push(tx.ref_id)
        } else if (tx.ref_type === 'settlement' || tx.transaction_type === 'settlement') {
            if (tx.ref_id) settlementRefIds.push(tx.ref_id)
        }
    }

    // Types for enrichment data
    type SaleRecord = { id: string; sale_no: string; customer_code: string | null; payment_method: string; customers: { customer_name: string } | null }
    type PurchaseRecord = { id: string; purchase_no: string; vendor_code: string; vendors: { vendor_name: string } | null }
    type SettlementRecord = { id: string; settlement_no: string; vendor_code: string; vendors: { vendor_name: string } | null }

    // Fetch sales with customer info
    const salesMap: Record<string, SaleRecord> = {}
    if (saleRefIds.length > 0) {
        const { data: sales } = await supabaseServer
            .from('sales')
            .select(`
                id,
                sale_no,
                customer_code,
                payment_method,
                customers (
                    customer_name
                )
            `)
            .in('id', saleRefIds)

        if (sales) {
            for (const sale of sales as unknown as SaleRecord[]) {
                salesMap[sale.id] = sale
            }
        }
    }

    // Also try to match by sale_no (ref_no)
    const saleNos = transactions
        .filter(tx => tx.ref_no && tx.ref_no.startsWith('S'))
        .map(tx => tx.ref_no)

    if (saleNos.length > 0) {
        const { data: salesByNo } = await supabaseServer
            .from('sales')
            .select(`
                id,
                sale_no,
                customer_code,
                payment_method,
                customers (
                    customer_name
                )
            `)
            .in('sale_no', saleNos as string[])

        if (salesByNo) {
            for (const sale of salesByNo as unknown as SaleRecord[]) {
                if (!salesMap[sale.id]) {
                    salesMap[sale.id] = sale
                }
                // Also map by sale_no for easier lookup
                salesMap[sale.sale_no] = sale
            }
        }
    }

    // Fetch purchases with vendor info
    const purchasesMap: Record<string, PurchaseRecord> = {}
    const purchaseNos = transactions
        .filter(tx => tx.ref_no && tx.ref_no.startsWith('P'))
        .map(tx => tx.ref_no)

    if (purchaseNos.length > 0) {
        const { data: purchases } = await supabaseServer
            .from('purchases')
            .select(`
                id,
                purchase_no,
                vendor_code,
                vendors (
                    vendor_name
                )
            `)
            .in('purchase_no', purchaseNos as string[])

        if (purchases) {
            for (const purchase of purchases as unknown as PurchaseRecord[]) {
                purchasesMap[purchase.id] = purchase
                purchasesMap[purchase.purchase_no] = purchase
            }
        }
    }

    // Fetch settlements if any
    const settlementsMap: Record<string, SettlementRecord> = {}
    if (settlementRefIds.length > 0) {
        const { data: settlements } = await supabaseServer
            .from('settlements')
            .select(`
                id,
                settlement_no,
                vendor_code,
                vendors (
                    vendor_name
                )
            `)
            .in('id', settlementRefIds)

        if (settlements) {
            for (const settlement of settlements as unknown as SettlementRecord[]) {
                settlementsMap[settlement.id] = settlement
            }
        }
    }

    // Enrich each transaction
    return transactions.map(tx => {
        const enriched: EnrichedTransaction = { ...tx }

        // Try to match sale
        const sale = salesMap[tx.ref_id] || (tx.ref_no ? salesMap[tx.ref_no] : undefined)
        if (sale) {
            enriched.customer_name = sale.customers?.customer_name || sale.customer_code || null
            enriched.customer_code = sale.customer_code
            enriched.original_payment_method = sale.payment_method
        }

        // Try to match purchase
        const purchase = purchasesMap[tx.ref_id] || (tx.ref_no ? purchasesMap[tx.ref_no] : undefined)
        if (purchase) {
            enriched.vendor_name = purchase.vendors?.vendor_name || purchase.vendor_code || null
            enriched.vendor_code = purchase.vendor_code
        }

        // Try to match settlement
        const settlement = settlementsMap[tx.ref_id]
        if (settlement) {
            enriched.vendor_name = settlement.vendors?.vendor_name || settlement.vendor_code || null
            enriched.vendor_code = settlement.vendor_code
        }

        return enriched
    })
}
