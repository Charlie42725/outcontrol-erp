import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { expenseSchema } from '@/lib/schemas'
import { fromZodError } from 'zod-validation-error'

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

    const expense = validation.data

    // 取得台灣時間 (UTC+8)
    const now = new Date()
    const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)

    // Update expense
    const { data, error } = await (supabaseServer
      .from('expenses') as any)
      .update({
        date: expense.date,
        category: expense.category,
        amount: expense.amount,
        account_id: expense.account_id || null,
        note: expense.note || null,
        updated_at: taiwanTime.toISOString(), // 使用台灣時間
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

    const { error } = await (supabaseServer
      .from('expenses') as any)
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
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
