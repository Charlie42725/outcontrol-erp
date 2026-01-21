'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

type FixedAsset = {
    id: string
    asset_name: string
    category: string
    purchase_date: string
    purchase_amount: number
    residual_value: number
    useful_life_months: number
    monthly_depreciation: number
    depreciation_start_date: string
    status: string
    note: string | null
    // Calculated fields
    months_elapsed: number
    accumulated_depreciation: number
    remaining_value: number
    progress_percent: number
    is_fully_depreciated: boolean
}

type Summary = {
    total_assets: number
    total_purchase_amount: number
    total_monthly_depreciation: number
    total_accumulated_depreciation: number
    total_remaining_value: number
}

const CATEGORY_LABELS: Record<string, string> = {
    machinery: '機械設備',
    transport: '運輸設備',
    office: '辦公設備',
    computer: '電腦設備',
    leasehold: '租賃改良',
    other: '其他',
}

const CATEGORY_OPTIONS = [
    { value: 'machinery', label: '機械設備' },
    { value: 'transport', label: '運輸設備' },
    { value: 'office', label: '辦公設備' },
    { value: 'computer', label: '電腦設備' },
    { value: 'leasehold', label: '租賃改良' },
    { value: 'other', label: '其他' },
]

export default function FixedAssetsPage() {
    const router = useRouter()
    const [accessDenied, setAccessDenied] = useState(false)
    const [assets, setAssets] = useState<FixedAsset[]>([])
    const [summary, setSummary] = useState<Summary | null>(null)
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null)
    const [formData, setFormData] = useState({
        asset_name: '',
        category: 'machinery',
        purchase_date: new Date().toISOString().split('T')[0],
        purchase_amount: '',
        residual_value: '0',
        useful_life_months: '',
        useful_life_years: '',
        use_years: true,
        depreciation_start_date: '',
        note: '',
    })

    // 權限檢查
    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                if (!data.ok || data.data?.role !== 'admin') {
                    setAccessDenied(true)
                    setTimeout(() => router.push('/'), 2000)
                }
            })
            .catch(() => {
                setAccessDenied(true)
                setTimeout(() => router.push('/'), 2000)
            })
    }, [router])

    useEffect(() => {
        fetchAssets()
        fetchSummary()
    }, [])

    const fetchAssets = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/fixed-assets')
            const data = await res.json()
            if (data.ok) {
                setAssets(data.data || [])
            }
        } catch (err) {
            console.error('Failed to fetch assets:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchSummary = async () => {
        try {
            const res = await fetch('/api/fixed-assets/summary')
            const data = await res.json()
            if (data.ok) {
                setSummary(data.data.summary)
            }
        } catch (err) {
            console.error('Failed to fetch summary:', err)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (submitting) return
        setSubmitting(true)

        const months = formData.use_years
            ? parseInt(formData.useful_life_years) * 12
            : parseInt(formData.useful_life_months)

        const payload = {
            asset_name: formData.asset_name,
            category: formData.category,
            purchase_date: formData.purchase_date,
            purchase_amount: parseFloat(formData.purchase_amount),
            residual_value: parseFloat(formData.residual_value) || 0,
            useful_life_months: months,
            depreciation_start_date: formData.depreciation_start_date || formData.purchase_date,
            note: formData.note || null,
        }

        try {
            const url = editingAsset
                ? `/api/fixed-assets/${editingAsset.id}`
                : '/api/fixed-assets'
            const method = editingAsset ? 'PATCH' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (data.ok) {
                alert(editingAsset ? '更新成功！' : '新增成功！')
                setShowForm(false)
                setEditingAsset(null)
                resetForm()
                fetchAssets()
                fetchSummary()
            } else {
                alert(`操作失敗：${data.error}`)
            }
        } catch (err) {
            alert('操作失敗')
        } finally {
            setSubmitting(false)
        }
    }

    const handleEdit = (asset: FixedAsset) => {
        const years = Math.floor(asset.useful_life_months / 12)
        const months = asset.useful_life_months % 12

        setEditingAsset(asset)
        setFormData({
            asset_name: asset.asset_name,
            category: asset.category,
            purchase_date: asset.purchase_date,
            purchase_amount: asset.purchase_amount.toString(),
            residual_value: asset.residual_value.toString(),
            useful_life_months: asset.useful_life_months.toString(),
            useful_life_years: years.toString(),
            use_years: months === 0 && years > 0,
            depreciation_start_date: asset.depreciation_start_date,
            note: asset.note || '',
        })
        setShowForm(true)
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`確定要刪除「${name}」嗎？\n\n此操作無法復原。`)) {
            return
        }

        try {
            const res = await fetch(`/api/fixed-assets/${id}`, { method: 'DELETE' })
            const data = await res.json()

            if (data.ok) {
                alert('刪除成功！')
                fetchAssets()
                fetchSummary()
            } else {
                alert(`刪除失敗：${data.error}`)
            }
        } catch (err) {
            alert('刪除失敗')
        }
    }

    const resetForm = () => {
        setFormData({
            asset_name: '',
            category: 'machinery',
            purchase_date: new Date().toISOString().split('T')[0],
            purchase_amount: '',
            residual_value: '0',
            useful_life_months: '',
            useful_life_years: '',
            use_years: true,
            depreciation_start_date: '',
            note: '',
        })
    }

    const cancelEdit = () => {
        setShowForm(false)
        setEditingAsset(null)
        resetForm()
    }

    // 權限不足時顯示提示
    if (accessDenied) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">🚫</div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">權限不足</h1>
                    <p className="text-gray-600 dark:text-gray-400">您沒有權限訪問此頁面，正在返回首頁...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
            <div className="mx-auto max-w-7xl">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">固定資產</h1>
                    <button
                        onClick={() => setShowForm(true)}
                        className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
                    >
                        + 新增資產
                    </button>
                </div>

                {/* Summary Cards */}
                {summary && (
                    <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="rounded-lg bg-white dark:bg-gray-800 p-4 shadow">
                            <div className="text-sm text-gray-500 dark:text-gray-400">資產總數</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {summary.total_assets} 項
                            </div>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-gray-800 p-4 shadow">
                            <div className="text-sm text-gray-500 dark:text-gray-400">原始總值</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {formatCurrency(summary.total_purchase_amount)}
                            </div>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-gray-800 p-4 shadow">
                            <div className="text-sm text-gray-500 dark:text-gray-400">每月攤提</div>
                            <div className="text-2xl font-bold text-orange-600">
                                {formatCurrency(summary.total_monthly_depreciation)}
                            </div>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-gray-800 p-4 shadow">
                            <div className="text-sm text-gray-500 dark:text-gray-400">累計攤提</div>
                            <div className="text-2xl font-bold text-red-600">
                                {formatCurrency(summary.total_accumulated_depreciation)}
                            </div>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-gray-800 p-4 shadow">
                            <div className="text-sm text-gray-500 dark:text-gray-400">剩餘價值</div>
                            <div className="text-2xl font-bold text-green-600">
                                {formatCurrency(summary.total_remaining_value)}
                            </div>
                        </div>
                    </div>
                )}

                {/* Assets Table */}
                <div className="rounded-lg bg-white dark:bg-gray-800 shadow overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">載入中...</div>
                    ) : assets.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            尚無固定資產，點擊「新增資產」開始記錄
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="border-b bg-gray-50 dark:bg-gray-900">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">資產名稱</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">分類</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">購入金額</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">攤提期間</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">月攤提</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">攤提進度</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">剩餘價值</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {assets.map((asset) => (
                                        <tr key={asset.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    {asset.asset_name}
                                                </div>
                                                {asset.note && (
                                                    <div className="text-xs text-gray-500">{asset.note}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                                    {CATEGORY_LABELS[asset.category] || asset.category}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                                                {formatCurrency(asset.purchase_amount)}
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                                                {asset.useful_life_months >= 12
                                                    ? `${Math.floor(asset.useful_life_months / 12)} 年`
                                                    : `${asset.useful_life_months} 月`}
                                                <div className="text-xs text-gray-400">
                                                    ({asset.months_elapsed}/{asset.useful_life_months} 月)
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-medium text-orange-600">
                                                {formatCurrency(asset.monthly_depreciation)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${asset.is_fully_depreciated
                                                                ? 'bg-green-500'
                                                                : 'bg-blue-500'
                                                                }`}
                                                            style={{ width: `${asset.progress_percent}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-500 w-12 text-right">
                                                        {asset.progress_percent.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-medium text-green-600">
                                                {formatCurrency(asset.remaining_value)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleEdit(asset)}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            編輯
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(asset.id, asset.asset_name)}
                                                            className="text-red-600 focus:text-red-600"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            刪除
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Add/Edit Modal */}
                {showForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={cancelEdit}>
                        <div
                            className="mx-4 w-full max-w-lg rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
                                {editingAsset ? '編輯固定資產' : '新增固定資產'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                        資產名稱 *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.asset_name}
                                        onChange={(e) => setFormData({ ...formData, asset_name: e.target.value })}
                                        className="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100"
                                        placeholder="例如：冷氣設備"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                        分類
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100"
                                    >
                                        {CATEGORY_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                            購入日期 *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.purchase_date}
                                            onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                                            className="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                            開始攤提日期
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.depreciation_start_date}
                                            onChange={(e) => setFormData({ ...formData, depreciation_start_date: e.target.value })}
                                            className="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100"
                                            placeholder="預設同購入日期"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                            購入金額 *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={formData.purchase_amount}
                                            onChange={(e) => setFormData({ ...formData, purchase_amount: e.target.value })}
                                            className="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100"
                                            placeholder="100000"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                            殘值
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.residual_value}
                                            onChange={(e) => setFormData({ ...formData, residual_value: e.target.value })}
                                            className="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100"
                                            placeholder="0"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">攤提完畢後的剩餘價值</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                        攤提期間 *
                                    </label>
                                    <div className="flex gap-2 items-center">
                                        <label className="flex items-center gap-1">
                                            <input
                                                type="radio"
                                                checked={formData.use_years}
                                                onChange={() => setFormData({ ...formData, use_years: true })}
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">年</span>
                                        </label>
                                        <label className="flex items-center gap-1">
                                            <input
                                                type="radio"
                                                checked={!formData.use_years}
                                                onChange={() => setFormData({ ...formData, use_years: false })}
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">月</span>
                                        </label>
                                    </div>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={formData.use_years ? formData.useful_life_years : formData.useful_life_months}
                                        onChange={(e) =>
                                            formData.use_years
                                                ? setFormData({ ...formData, useful_life_years: e.target.value })
                                                : setFormData({ ...formData, useful_life_months: e.target.value })
                                        }
                                        className="mt-2 w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100"
                                        placeholder={formData.use_years ? '5' : '60'}
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                                        備註
                                    </label>
                                    <textarea
                                        value={formData.note}
                                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                        className="w-full rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100"
                                        rows={2}
                                        placeholder="選填"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    >
                                        {submitting ? '處理中...' : (editingAsset ? '更新' : '新增')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={cancelEdit}
                                        className="flex-1 rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
                                    >
                                        取消
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
