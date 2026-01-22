import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { generateCode } from '@/lib/utils'
import * as XLSX from 'xlsx'

type ImportRow = {
  商品名稱?: string
  條碼?: string
  售價?: number
  成本?: number
  庫存?: number
  分類?: string
}

type ValidationError = {
  row: number
  field: string
  message: string
}

type ImportResult = {
  success: number
  failed: number
  errors: ValidationError[]
}

// POST /api/products/import - Import products from Excel
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { ok: false, error: '請上傳檔案' },
        { status: 400 }
      )
    }

    // Check file type
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { ok: false, error: '請上傳 .xlsx 或 .xls 檔案' },
        { status: 400 }
      )
    }

    // Parse Excel file
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows: ImportRow[] = XLSX.utils.sheet_to_json(worksheet)

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Excel 檔案沒有資料' },
        { status: 400 }
      )
    }

    // Get existing barcodes from database
    const { data: existingProducts } = await supabaseServer
      .from('products')
      .select('barcode')
      .not('barcode', 'is', null)

    const existingBarcodes = new Set(
      (existingProducts as { barcode: string | null }[] | null)?.map(p => p.barcode?.toLowerCase()) || []
    )

    // Validate rows
    const errors: ValidationError[] = []
    const validRows: ImportRow[] = []
    const seenBarcodes = new Set<string>()

    rows.forEach((row, index) => {
      const rowNum = index + 2 // Excel row number (1-indexed + header row)

      // Check required field: 商品名稱
      if (!row.商品名稱 || String(row.商品名稱).trim() === '') {
        errors.push({
          row: rowNum,
          field: '商品名稱',
          message: '商品名稱為必填欄位'
        })
        return
      }

      // Check required field: 條碼
      if (!row.條碼 || String(row.條碼).trim() === '') {
        errors.push({
          row: rowNum,
          field: '條碼',
          message: '條碼為必填欄位'
        })
        return
      }

      const barcode = String(row.條碼).trim().toLowerCase()

      // Check duplicate barcode in file
      if (seenBarcodes.has(barcode)) {
        errors.push({
          row: rowNum,
          field: '條碼',
          message: '條碼在檔案中重複'
        })
        return
      }

      // Check duplicate barcode in database
      if (existingBarcodes.has(barcode)) {
        errors.push({
          row: rowNum,
          field: '條碼',
          message: '條碼已存在於資料庫中'
        })
        return
      }

      // Validate numeric fields
      const price = Number(row.售價) || 0
      const cost = Number(row.成本) || 0
      const stock = Number(row.庫存) || 0

      if (price < 0) {
        errors.push({
          row: rowNum,
          field: '售價',
          message: '售價不能為負數'
        })
        return
      }

      if (cost < 0) {
        errors.push({
          row: rowNum,
          field: '成本',
          message: '成本不能為負數'
        })
        return
      }

      if (stock < 0) {
        errors.push({
          row: rowNum,
          field: '庫存',
          message: '庫存不能為負數'
        })
        return
      }

      seenBarcodes.add(barcode)
      validRows.push(row)
    })

    // If there are errors, return them without importing
    if (errors.length > 0) {
      return NextResponse.json({
        ok: false,
        error: '資料驗證失敗',
        details: {
          success: 0,
          failed: errors.length,
          errors
        }
      }, { status: 400 })
    }

    // Get the latest item_code number
    const { data: latestProducts } = await supabaseServer
      .from('products')
      .select('item_code')
      .like('item_code', 'I%')
      .order('item_code', { ascending: false })
      .limit(1)

    let maxNumber = 0
    if (latestProducts && latestProducts.length > 0) {
      const lastCode = (latestProducts[0] as { item_code: string }).item_code
      const match = lastCode.match(/^I(\d+)$/)
      if (match) {
        maxNumber = parseInt(match[1])
      }
    }

    // Prepare products for insertion
    const productsToInsert = validRows.map((row, index) => {
      const itemCode = generateCode('I', maxNumber + index)
      const cost = Number(row.成本) || 0
      const stock = Number(row.庫存) || 0

      return {
        item_code: itemCode,
        name: String(row.商品名稱).trim(),
        barcode: String(row.條碼).trim(),
        price: Number(row.售價) || 0,
        cost: cost,
        stock: stock,
        avg_cost: stock > 0 ? cost : 0,
        unit: '件',
        tags: row.分類 ? [String(row.分類).trim()] : [],
        allow_negative: true,
        is_active: true,
      }
    })

    // Batch insert products
    const { data: insertedProducts, error: insertError } = await (supabaseServer
      .from('products') as any)
      .insert(productsToInsert)
      .select()

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: `匯入失敗: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: {
        success: insertedProducts?.length || 0,
        failed: 0,
        errors: []
      }
    })

  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { ok: false, error: '匯入過程發生錯誤' },
      { status: 500 }
    )
  }
}
