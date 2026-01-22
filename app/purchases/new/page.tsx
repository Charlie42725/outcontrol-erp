'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import type { Product } from '@/types'

type Vendor = {
  id: string
  vendor_code: string
  vendor_name: string
}

type PurchaseItem = {
  product_id: string
  product?: Product
  quantity: number
  cost: number
}

export default function NewPurchasePage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [vendorCode, setVendorCode] = useState('')
  const [isPaid, setIsPaid] = useState(false)
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [totalCostInput, setTotalCostInput] = useState<string>('')

  // 快速新增商品 Modal
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddName, setQuickAddName] = useState('')
  const [quickAddBarcode, setQuickAddBarcode] = useState('')
  const [quickAddCost, setQuickAddCost] = useState('')
  const [quickAddLoading, setQuickAddLoading] = useState(false)

  useEffect(() => {
    fetchVendors()
  }, [])

  const fetchVendors = async () => {
    try {
      const res = await fetch('/api/vendors')
      const data = await res.json()
      if (data.ok) {
        setVendors(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch vendors:', err)
    }
  }

  const searchProducts = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    try {
      const res = await fetch(`/api/products/search?keyword=${encodeURIComponent(query)}&active_only=false`)
      const data = await res.json()
      console.log('Search API response:', data) // Debug log
      if (data.ok) {
        setSearchResults(data.data || [])
        console.log('Search results:', data.data) // Debug log
      } else {
        console.error('Search API error:', data.error)
        setSearchResults([])
      }
    } catch (err) {
      console.error('Search error:', err)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const addItem = (product: Product) => {
    console.log('Adding product:', product) // Debug log
    const existing = items.find((item) => item.product_id === product.id)
    if (existing) {
      setError('商品已在清單中')
      setTimeout(() => setError(''), 3000)
      return
    }

    setItems([
      ...items,
      {
        product_id: product.id,
        product,
        quantity: 1,
        cost: product.cost || 0,
      },
    ])
    setSearchKeyword('')
    setSearchResults([])
    setError('')
    console.log('Product added successfully') // Debug log
  }

  const updateItem = (index: number, field: 'quantity' | 'cost', value: number) => {
    setItems(
      items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    )
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  // 開啟快速新增商品 Modal（預填搜尋關鍵字作為商品名稱）
  const openQuickAdd = () => {
    setQuickAddName(searchKeyword)
    setQuickAddBarcode('')
    setQuickAddCost('')
    setShowQuickAdd(true)
  }

  // 快速新增商品
  const handleQuickAdd = async () => {
    if (!quickAddName.trim()) {
      setError('請輸入商品名稱')
      setTimeout(() => setError(''), 3000)
      return
    }

    setQuickAddLoading(true)
    try {
      const cost = parseFloat(quickAddCost) || 0
      const res = await fetch('/api/products/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickAddName.trim(),
          barcode: quickAddBarcode.trim() || null,
          cost: cost,
        }),
      })

      const data = await res.json()

      if (data.ok && data.data) {
        // 新增成功，直接加入進貨清單
        const newProduct = data.data as Product
        setItems([
          ...items,
          {
            product_id: newProduct.id,
            product: newProduct,
            quantity: 1,
            cost: cost,
          },
        ])
        // 關閉 Modal 並清空
        setShowQuickAdd(false)
        setQuickAddName('')
        setQuickAddBarcode('')
        setQuickAddCost('')
        setSearchKeyword('')
        setSearchResults([])
      } else {
        setError(data.error || '新增商品失敗')
        setTimeout(() => setError(''), 3000)
      }
    } catch (err) {
      setError('新增商品失敗')
      setTimeout(() => setError(''), 3000)
    } finally {
      setQuickAddLoading(false)
    }
  }

  // 分配總成本：直接計算精確的單位成本
  const distributeTotalCost = () => {
    const inputCost = parseFloat(totalCostInput)
    if (isNaN(inputCost) || inputCost <= 0) {
      setError('請輸入有效的總成本金額')
      setTimeout(() => setError(''), 3000)
      return
    }

    if (items.length === 0) {
      setError('請先新增商品')
      setTimeout(() => setError(''), 3000)
      return
    }

    // 計算總數量
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)

    if (totalQuantity === 0) {
      setError('商品總數量不能為零')
      setTimeout(() => setError(''), 3000)
      return
    }

    // 計算精確的單位成本（不做四捨五入，保持完整精度）
    const costPerUnit = inputCost / totalQuantity

    const updatedItems = items.map(item => ({
      ...item,
      cost: costPerUnit
    }))

    setItems(updatedItems)
    setTotalCostInput('')
    setError('')
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.cost, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!vendorCode) {
      setError('請選擇廠商')
      return
    }

    if (items.length === 0) {
      setError('請至少新增一項商品')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_code: vendorCode,
          is_paid: isPaid,
          items: items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            cost: item.cost,
          })),
        }),
      })

      const data = await res.json()

      if (data.ok) {
        router.push('/purchases')
      } else {
        setError(data.error || '建立失敗')
      }
    } catch (err) {
      setError('建立失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-900 dark:text-gray-100">新增進貨單</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded bg-red-50 p-3 text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</div>
          )}

          {/* Vendor selection */}
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
              廠商 <span className="text-red-500">*</span>
            </label>
            <select
              value={vendorCode}
              onChange={(e) => setVendorCode(e.target.value)}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              required
            >
              <option value="">請選擇廠商</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.vendor_code}>
                  {vendor.vendor_code} - {vendor.vendor_name}
                </option>
              ))}
            </select>

            {/* Payment status */}
            <div className="mt-4 flex items-center">
              <input
                type="checkbox"
                id="isPaid"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isPaid" className="ml-2 text-sm text-gray-900 dark:text-gray-100">
                已付款（勾選後不會產生應付帳款）
              </label>
            </div>
          </div>

          {/* Product search */}
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">搜尋商品</label>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value)
                searchProducts(e.target.value)
              }}
              placeholder="輸入商品名稱或品號"
              className="w-full rounded border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
            />

            {/* Search status and results */}
            {searching && (
              <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3 text-center text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
                搜尋中...
              </div>
            )}

            {!searching && searchKeyword && searchResults.length === 0 && (
              <div className="mt-2 rounded border border-gray-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
                <p className="text-center text-sm text-gray-900 dark:text-yellow-400">
                  找不到「{searchKeyword}」
                </p>
                <button
                  type="button"
                  onClick={openQuickAdd}
                  className="mt-2 w-full rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 transition-colors"
                >
                  ➕ 快速新增商品
                </button>
              </div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="mt-2 max-h-60 overflow-y-auto rounded border border-gray-200 dark:border-gray-700">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addItem(product)}
                    className="w-full border-b border-gray-100 p-3 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">{product.name}</div>
                    <div className="text-sm text-gray-900 dark:text-gray-300">
                      {product.item_code} | 成本: {formatCurrency(product.cost)} | 庫存: {product.stock}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">進貨明細</h2>

            {items.length === 0 ? (
              <p className="py-8 text-center text-gray-900 dark:text-gray-100">尚未新增商品</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">商品</th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">數量</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">成本</th>
                      <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">小計</th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{item.product?.name}</div>
                          <div className="text-sm text-gray-900 dark:text-gray-300">
                            {item.product?.item_code}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(index, 'quantity', parseInt(e.target.value) || 0)
                            }
                            min="1"
                            className="w-20 rounded border border-gray-300 bg-white px-2 py-1 text-center text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            value={item.cost}
                            onChange={(e) =>
                              updateItem(index, 'cost', parseFloat(e.target.value) || 0)
                            }
                            min="0"
                            step="0.01"
                            className="w-28 rounded border border-gray-300 bg-white px-2 py-1 text-right text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(item.quantity * item.cost)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500"
                          >
                            刪除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                        合計
                      </td>
                      <td className="px-4 py-3 text-right text-lg font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(total)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* 總成本輸入區塊 */}
            {items.length > 0 && (
              <div className="mt-4 rounded-lg border border-dashed border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/20">
                <label className="mb-2 block text-sm font-medium text-blue-900 dark:text-blue-200">
                  📦 輸入總成本（自動按數量比例分配）
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={totalCostInput}
                      onChange={(e) => setTotalCostInput(e.target.value)}
                      placeholder="輸入總採購成本"
                      min="0"
                      step="0.01"
                      className="w-full rounded border border-blue-300 bg-white py-2 pl-8 pr-3 text-gray-900 placeholder:text-gray-400 dark:border-blue-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={distributeTotalCost}
                    className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
                  >
                    分配成本
                  </button>
                </div>
                <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                  💡 提示：輸入總採購金額後點擊「分配成本」，系統會按各商品數量比例自動計算單位成本
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || items.length === 0}
              className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600"
            >
              {loading ? '建立中...' : '確認進貨'}
            </button>
          </div>
        </form>
      </div>

      {/* 快速新增商品 Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              快速新增商品
            </h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  商品名稱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  placeholder="輸入商品名稱"
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  條碼（選填）
                </label>
                <input
                  type="text"
                  value={quickAddBarcode}
                  onChange={(e) => setQuickAddBarcode(e.target.value)}
                  placeholder="輸入條碼"
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  進貨成本
                </label>
                <input
                  type="number"
                  value={quickAddCost}
                  onChange={(e) => setQuickAddCost(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="flex-1 rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={quickAddLoading || !quickAddName.trim()}
                className="flex-1 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600"
              >
                {quickAddLoading ? '新增中...' : '新增並加入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
