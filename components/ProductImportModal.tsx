'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'

type ImportRow = {
  商品名稱?: string
  條碼?: string
  售價?: number
  數量?: number
  總成本?: number
}

type ValidationError = {
  row: number
  field: string
  message: string
}

type PreviewRow = ImportRow & {
  rowNum: number
  hasError: boolean
  errorMessage?: string
}

type ProductImportModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ProductImportModal({
  isOpen,
  onClose,
  onSuccess,
}: ProductImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<PreviewRow[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setFile(null)
    setPreviewData([])
    setError('')
    setResult(null)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const downloadTemplate = () => {
    // Create template workbook
    const templateData = [
      {
        商品名稱: '範例商品1',
        條碼: '4710000000001',
        售價: 100,
        數量: 10,
        總成本: 500,
      },
      {
        商品名稱: '範例商品2',
        條碼: '4710000000002',
        售價: 200,
        數量: 5,
        總成本: 500,
      },
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '商品匯入')

    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // 商品名稱
      { wch: 15 }, // 條碼
      { wch: 10 }, // 售價
      { wch: 10 }, // 數量
      { wch: 10 }, // 總成本
    ]

    XLSX.writeFile(wb, '商品匯入範本.xlsx')
  }

  const handleFileSelect = async (selectedFile: File) => {
    setError('')
    setResult(null)

    // Check file type
    const fileName = selectedFile.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      setError('請上傳 .xlsx 或 .xls 檔案')
      return
    }

    setFile(selectedFile)
    setLoading(true)

    try {
      // Parse Excel file
      const arrayBuffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const rows: ImportRow[] = XLSX.utils.sheet_to_json(worksheet)

      if (rows.length === 0) {
        setError('Excel 檔案沒有資料')
        setFile(null)
        return
      }

      // Create preview data with validation
      const preview: PreviewRow[] = rows.map((row, index) => {
        const rowNum = index + 2 // Excel row number
        let hasError = false
        let errorMessage = ''

        // Validate required fields
        if (!row.商品名稱 || String(row.商品名稱).trim() === '') {
          hasError = true
          errorMessage = '商品名稱為必填'
        } else if (!row.條碼 || String(row.條碼).trim() === '') {
          hasError = true
          errorMessage = '條碼為必填'
        }

        // Validate numeric fields
        if (!hasError) {
          const price = Number(row.售價)
          const quantity = Number(row.數量)
          const totalCost = Number(row.總成本)

          if (row.售價 !== undefined && (isNaN(price) || price < 0)) {
            hasError = true
            errorMessage = '售價必須為非負數'
          } else if (row.數量 !== undefined && (isNaN(quantity) || quantity < 0)) {
            hasError = true
            errorMessage = '數量必須為非負數'
          } else if (row.總成本 !== undefined && (isNaN(totalCost) || totalCost < 0)) {
            hasError = true
            errorMessage = '總成本必須為非負數'
          }
        }

        return {
          ...row,
          rowNum,
          hasError,
          errorMessage,
        }
      })

      // Check for duplicate barcodes in file
      const barcodeCount = new Map<string, number>()
      preview.forEach((row) => {
        if (row.條碼) {
          const barcode = String(row.條碼).toLowerCase()
          barcodeCount.set(barcode, (barcodeCount.get(barcode) || 0) + 1)
        }
      })

      preview.forEach((row) => {
        if (!row.hasError && row.條碼) {
          const barcode = String(row.條碼).toLowerCase()
          if ((barcodeCount.get(barcode) || 0) > 1) {
            row.hasError = true
            row.errorMessage = '條碼在檔案中重複'
          }
        }
      })

      setPreviewData(preview)
    } catch (err) {
      console.error('Parse error:', err)
      setError('解析 Excel 檔案失敗')
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/products/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (data.ok) {
        setResult({
          success: data.data.success,
          failed: data.data.failed,
        })
        onSuccess()
      } else {
        if (data.details?.errors) {
          // Update preview with server-side validation errors
          const errorMap = new Map<number, string>()
          data.details.errors.forEach((err: ValidationError) => {
            errorMap.set(err.row, `${err.field}: ${err.message}`)
          })

          setPreviewData((prev) =>
            prev.map((row) => {
              const serverError = errorMap.get(row.rowNum)
              if (serverError) {
                return {
                  ...row,
                  hasError: true,
                  errorMessage: serverError,
                }
              }
              return row
            })
          )
        }
        setError(data.error || '匯入失敗')
      }
    } catch (err) {
      console.error('Import error:', err)
      setError('匯入過程發生錯誤')
    } finally {
      setImporting(false)
    }
  }

  const hasErrors = previewData.some((row) => row.hasError)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            匯入商品
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {result ? (
            // Result view
            <div className="text-center py-8">
              <div className="text-6xl mb-4">
                {result.failed === 0 ? '✅' : '⚠️'}
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                匯入完成
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                成功匯入 <span className="text-green-600 font-bold">{result.success}</span> 筆商品
                {result.failed > 0 && (
                  <>，失敗 <span className="text-red-600 font-bold">{result.failed}</span> 筆</>
                )}
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                關閉
              </button>
            </div>
          ) : !file ? (
            // Upload view
            <div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
              >
                <div className="text-4xl mb-4">📁</div>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  拖放 Excel 檔案到這裡，或點擊選擇檔案
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  支援 .xlsx 和 .xls 格式
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              <div className="mt-4 flex justify-center">
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  下載範本
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
                  {error}
                </div>
              )}
            </div>
          ) : loading ? (
            // Loading view
            <div className="text-center py-8">
              <div className="animate-spin text-4xl mb-4">⏳</div>
              <p className="text-gray-600 dark:text-gray-400">解析中...</p>
            </div>
          ) : (
            // Preview view
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">檔案：</span>
                  <span className="font-medium text-gray-900 dark:text-white">{file.name}</span>
                  <span className="text-gray-500 dark:text-gray-500 ml-2">
                    ({previewData.length} 筆資料)
                  </span>
                </div>
                <button
                  onClick={resetState}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  重新選擇檔案
                </button>
              </div>

              {hasErrors && (
                <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg">
                  發現 {previewData.filter((r) => r.hasError).length} 筆資料有錯誤，請修正後重新上傳
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
                  {error}
                </div>
              )}

              <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">列</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">商品名稱</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">條碼</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">售價</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">數量</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">總成本</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">狀態</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {previewData.map((row) => (
                        <tr
                          key={row.rowNum}
                          className={row.hasError ? 'bg-red-50 dark:bg-red-900/20' : ''}
                        >
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{row.rowNum}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-white">{row.商品名稱 || '-'}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-white">{row.條碼 || '-'}</td>
                          <td className="px-3 py-2 text-right text-gray-900 dark:text-white">{row.售價 ?? 0}</td>
                          <td className="px-3 py-2 text-right text-gray-900 dark:text-white">{row.數量 ?? 0}</td>
                          <td className="px-3 py-2 text-right text-gray-900 dark:text-white">{row.總成本 ?? 0}</td>
                          <td className="px-3 py-2">
                            {row.hasError ? (
                              <span className="text-red-600 dark:text-red-400 text-xs">
                                {row.errorMessage}
                              </span>
                            ) : (
                              <span className="text-green-600 dark:text-green-400">✓</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!result && file && !loading && (
          <div className="flex items-center justify-end gap-3 p-4 border-t dark:border-gray-700">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={handleImport}
              disabled={hasErrors || importing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  匯入中...
                </>
              ) : (
                <>確認匯入</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
