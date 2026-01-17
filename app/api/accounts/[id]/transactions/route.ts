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
    const transactionType = searchParams.get('transactionType') as any

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

    return NextResponse.json({
        ok: true,
        data,
        meta: {
            total: count,
            page,
            limit,
            totalPages: count ? Math.ceil(count / limit) : 0
        }
    })
}
