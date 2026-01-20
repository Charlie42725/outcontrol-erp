'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { formatCurrency } from '@/lib/utils'
import type { Product, PaymentMethod } from '@/types'

const CameraScanner = dynamic(() => import('@/components/CameraScanner'), {
    ssr: false,
    loading: () => null,
})

type CartItem = {
    product_id: string
    quantity: number
    price: number
    product: Product
    ichiban_kuji_prize_id?: string
    ichiban_kuji_id?: string
    isFreeGift?: boolean
}

type Customer = {
    id: string
    customer_code: string
    customer_name: string
    phone: string | null
    is_active: boolean
    store_credit: number
    credit_limit: number
}

type MobilePOSProps = {
    cart: CartItem[]
    setCart: (cart: CartItem[] | ((prev: CartItem[]) => CartItem[])) => void
    products: Product[]
    customers: Customer[]
    selectedCustomer: Customer | null
    setSelectedCustomer: (c: Customer | null) => void
    paymentMethod: PaymentMethod
    setPaymentMethod: (p: PaymentMethod) => void
    isPaid: boolean
    setIsPaid: (b: boolean) => void
    isDelivered: boolean
    setIsDelivered: (b: boolean) => void
    loading: boolean
    error: string
    finalTotal: number
    discountAmount: number
    storeCreditUsed: number
    handleCheckout: () => void
    addToCart: (product: Product, quantity?: number) => void
    removeFromCart: (productId: string, index?: number) => void
    updateQuantity: (productId: string, quantity: number) => void
    toggleFreeGift: (index: number) => void
    searchQuery: string
    setSearchQuery: (q: string) => void
}

export default function MobilePOS({
    cart,
    setCart,
    products,
    customers,
    selectedCustomer,
    setSelectedCustomer,
    paymentMethod,
    setPaymentMethod,
    isPaid,
    setIsPaid,
    isDelivered,
    setIsDelivered,
    loading,
    error,
    finalTotal,
    discountAmount,
    storeCreditUsed,
    handleCheckout,
    addToCart,
    removeFromCart,
    updateQuantity,
    toggleFreeGift,
    searchQuery,
    setSearchQuery,
}: MobilePOSProps) {
    const [showCameraScanner, setShowCameraScanner] = useState(false)
    const [showCustomerPicker, setShowCustomerPicker] = useState(false)
    const [showPaymentPicker, setShowPaymentPicker] = useState(false)
    const [customerSearchQuery, setCustomerSearchQuery] = useState('')
    const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // 搜尋結果
    const searchResults = searchQuery.trim()
        ? products.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 8)
        : []

    // 處理掃描或搜尋
    const handleSearchInput = (value: string) => {
        setSearchQuery(value)

        if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current)
        }

        scanTimeoutRef.current = setTimeout(() => {
            if (value.trim()) {
                const matchedProduct = products.find(
                    p => p.barcode && p.barcode.toLowerCase() === value.toLowerCase()
                )
                if (matchedProduct) {
                    addToCart(matchedProduct, 1)
                    setSearchQuery('')
                }
            }
        }, 100)
    }

    // 掃描提示訊息
    const [scanToast, setScanToast] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    // 清除掃描提示
    useEffect(() => {
        if (scanToast) {
            const timer = setTimeout(() => setScanToast(null), 2000)
            return () => clearTimeout(timer)
        }
    }, [scanToast])

    // 相機掃描結果
    const handleCameraScan = (code: string) => {
        const matchedProduct = products.find(
            p => p.barcode && p.barcode.toLowerCase() === code.toLowerCase()
        )
        if (matchedProduct) {
            addToCart(matchedProduct, 1)
            setScanToast({ type: 'success', text: `✓ 已加入: ${matchedProduct.name}` })
            // 不自動關閉，可以繼續掃描
        } else {
            setScanToast({ type: 'error', text: `找不到條碼: ${code}` })
            setSearchQuery(code)
        }
    }

    const filteredCustomers = customers.filter(c =>
        c.customer_name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
        c.customer_code.toLowerCase().includes(customerSearchQuery.toLowerCase())
    )

    const paymentMethods = [
        { key: 'cash', label: '💵 現金', paid: true },
        { key: 'card', label: '💳 刷卡', paid: false },
        { key: 'transfer_cathay', label: '🏦 國泰', paid: false },
        { key: 'transfer_fubon', label: '🏦 富邦', paid: false },
        { key: 'transfer_esun', label: '🏦 玉山', paid: false },
        { key: 'transfer_linepay', label: '💚 LINE', paid: false },
    ]

    const getPaymentLabel = (method: PaymentMethod) => {
        return paymentMethods.find(p => p.key === method)?.label || method
    }

    return (
        <div className="h-screen bg-slate-900 flex flex-col">
            {/* 頂部搜尋區 */}
            <div className="bg-slate-800 px-3 py-3 border-b border-slate-700">
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => handleSearchInput(e.target.value)}
                            placeholder="🔍 掃描或搜尋商品..."
                            className="w-full rounded-lg px-4 py-3 text-base text-white bg-slate-700 border border-slate-600 focus:border-indigo-500 focus:outline-none"
                        />
                        {/* 搜尋結果下拉 */}
                        {searchResults.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                {searchResults.map((product) => (
                                    <button
                                        key={product.id}
                                        onClick={() => {
                                            addToCart(product, 1)
                                            setSearchQuery('')
                                        }}
                                        className="w-full px-4 py-3 text-left hover:bg-slate-700 border-b border-slate-700 last:border-b-0"
                                    >
                                        <div className="text-white font-medium">{product.name}</div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">{product.item_code}</span>
                                            <span className="text-emerald-400">{formatCurrency(product.price)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setShowCameraScanner(true)}
                        className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xl"
                    >
                        📷
                    </button>
                </div>
            </div>

            {/* 購物車列表 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {cart.length === 0 ? (
                    <div className="text-center text-slate-500 mt-20">
                        <div className="text-6xl mb-4">🛒</div>
                        <div className="text-slate-400 text-lg">掃描或搜尋商品加入購物車</div>
                    </div>
                ) : (
                    cart.map((item, index) => (
                        <div
                            key={`${item.product_id}-${index}`}
                            className={`bg-slate-800 rounded-lg p-3 ${item.isFreeGift ? 'border-2 border-emerald-500' : ''}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="text-white font-medium text-sm line-clamp-1">
                                        {item.isFreeGift && <span className="text-emerald-400 mr-1">🎁</span>}
                                        {item.product.name}
                                    </div>
                                    <div className="text-slate-400 text-sm">
                                        {formatCurrency(item.price)} × {item.quantity}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center bg-slate-700 rounded-lg">
                                        <button
                                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                                            className="px-3 py-1 text-white hover:bg-slate-600 rounded-l-lg"
                                        >
                                            −
                                        </button>
                                        <span className="px-3 py-1 text-white min-w-[40px] text-center">{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                                            className="px-3 py-1 text-white hover:bg-slate-600 rounded-r-lg"
                                        >
                                            +
                                        </button>
                                    </div>
                                    <div className="text-white font-bold min-w-[70px] text-right">
                                        {formatCurrency(item.price * item.quantity)}
                                    </div>
                                    <button
                                        onClick={() => removeFromCart(item.product_id, index)}
                                        className="text-red-400 hover:text-red-300 p-1"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                            {!item.ichiban_kuji_prize_id && (
                                <button
                                    onClick={() => toggleFreeGift(index)}
                                    className={`mt-2 text-xs px-2 py-1 rounded ${item.isFreeGift
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-700 text-slate-400'
                                        }`}
                                >
                                    {item.isFreeGift ? '取消贈品' : '設為贈品'}
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* 底部結帳區 */}
            <div className="bg-slate-800 border-t border-slate-700 p-3 space-y-3 safe-area-bottom">
                {/* 客戶 + 付款方式 */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowCustomerPicker(true)}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 px-3 rounded-lg text-sm text-left"
                    >
                        <span className="text-slate-400">客戶:</span>{' '}
                        {selectedCustomer?.customer_name || '散客'}
                    </button>
                    <button
                        onClick={() => setShowPaymentPicker(true)}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 px-3 rounded-lg text-sm text-left"
                    >
                        <span className="text-slate-400">付款:</span>{' '}
                        {getPaymentLabel(paymentMethod)}
                    </button>
                </div>

                {/* 狀態切換 */}
                <div className="flex gap-2">
                    <label className="flex-1 flex items-center gap-2 cursor-pointer bg-slate-700 rounded-lg px-3 py-2">
                        <input
                            type="checkbox"
                            checked={isPaid}
                            onChange={(e) => setIsPaid(e.target.checked)}
                            className="w-4 h-4 accent-indigo-500"
                        />
                        <span className="text-sm text-white">已收款</span>
                    </label>
                    <label className="flex-1 flex items-center gap-2 cursor-pointer bg-slate-700 rounded-lg px-3 py-2">
                        <input
                            type="checkbox"
                            checked={isDelivered}
                            onChange={(e) => setIsDelivered(e.target.checked)}
                            className="w-4 h-4 accent-indigo-500"
                        />
                        <span className="text-sm text-white">已出貨</span>
                    </label>
                </div>

                {/* 折扣資訊 */}
                {(discountAmount > 0 || storeCreditUsed > 0) && (
                    <div className="text-sm space-y-1">
                        {discountAmount > 0 && (
                            <div className="flex justify-between text-red-400">
                                <span>折扣</span>
                                <span>-{formatCurrency(discountAmount)}</span>
                            </div>
                        )}
                        {storeCreditUsed > 0 && (
                            <div className="flex justify-between text-emerald-400">
                                <span>購物金</span>
                                <span>-{formatCurrency(storeCreditUsed)}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* 總計 + 結帳 */}
                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <div className="text-slate-400 text-sm">應收金額</div>
                        <div className="text-white text-2xl font-bold">{formatCurrency(finalTotal)}</div>
                    </div>
                    <button
                        onClick={handleCheckout}
                        disabled={loading || cart.length === 0}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 text-white font-bold text-lg py-4 px-8 rounded-lg transition-all"
                    >
                        {loading ? '處理中...' : '結帳'}
                    </button>
                </div>

                {error && (
                    <div className="bg-red-900 border border-red-600 text-red-200 rounded-lg px-3 py-2 text-sm">
                        {error}
                    </div>
                )}
            </div>

            {/* 相機掃描 Modal */}
            <CameraScanner
                isOpen={showCameraScanner}
                onClose={() => setShowCameraScanner(false)}
                onScan={handleCameraScan}
            />

            {/* 客戶選擇 Modal */}
            {showCustomerPicker && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
                    <div className="w-full bg-slate-800 rounded-t-2xl max-h-[70vh] flex flex-col">
                        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">選擇客戶</h3>
                            <button onClick={() => setShowCustomerPicker(false)} className="text-slate-400 text-2xl">×</button>
                        </div>
                        <div className="p-3">
                            <input
                                type="text"
                                value={customerSearchQuery}
                                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                placeholder="搜尋客戶..."
                                className="w-full rounded-lg px-4 py-3 text-white bg-slate-700 border border-slate-600"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <button
                                onClick={() => {
                                    setSelectedCustomer(null)
                                    setShowCustomerPicker(false)
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-slate-700 border-b border-slate-700 text-white"
                            >
                                散客
                            </button>
                            {filteredCustomers.map((customer) => (
                                <button
                                    key={customer.id}
                                    onClick={() => {
                                        setSelectedCustomer(customer)
                                        setShowCustomerPicker(false)
                                    }}
                                    className="w-full px-4 py-3 text-left hover:bg-slate-700 border-b border-slate-700"
                                >
                                    <div className="text-white">{customer.customer_name}</div>
                                    <div className="text-sm text-slate-400 flex justify-between">
                                        <span>{customer.customer_code}</span>
                                        {customer.store_credit > 0 && (
                                            <span className="text-emerald-400">購物金: {formatCurrency(customer.store_credit)}</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 付款方式 Modal */}
            {showPaymentPicker && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
                    <div className="w-full bg-slate-800 rounded-t-2xl">
                        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">選擇付款方式</h3>
                            <button onClick={() => setShowPaymentPicker(false)} className="text-slate-400 text-2xl">×</button>
                        </div>
                        <div className="p-3 grid grid-cols-2 gap-2">
                            {paymentMethods.map((method) => (
                                <button
                                    key={method.key}
                                    onClick={() => {
                                        setPaymentMethod(method.key as PaymentMethod)
                                        setIsPaid(method.paid)
                                        setShowPaymentPicker(false)
                                    }}
                                    className={`py-4 px-4 rounded-lg text-lg ${paymentMethod === method.key
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-700 text-slate-300'
                                        }`}
                                >
                                    {method.label}
                                </button>
                            ))}
                        </div>
                        <div className="p-3 pb-6">
                            <button
                                onClick={() => setShowPaymentPicker(false)}
                                className="w-full bg-slate-700 text-slate-300 py-3 rounded-lg"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
