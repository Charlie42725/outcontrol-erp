'use client'

import React, { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'

type Account = {
  id: string
  account_name: string
  account_type: 'cash' | 'bank' | 'petty_cash'
  balance: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const ACCOUNT_TYPE_LABELS = {
  cash: '現金',
  bank: '銀行',
  petty_cash: '零用金',
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [formData, setFormData] = useState({
    account_name: '',
    account_type: 'cash' as 'cash' | 'bank' | 'petty_cash',
    balance: 0,
    is_active: true,
  })

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/accounts')
      const data = await res.json()
      if (data.ok) {
        setAccounts(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const url = editingAccount ? `/api/accounts/${editingAccount.id}` : '/api/accounts'
    const method = editingAccount ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (data.ok) {
        alert(editingAccount ? '更新成功！' : '新增成功！')
        setShowAddForm(false)
        setEditingAccount(null)
        resetForm()
        fetchAccounts()
      } else {
        alert(`操作失敗：${data.error}`)
      }
    } catch (err) {
      alert('操作失敗')
    }
  }

  const handleEdit = (account: Account) => {
    setEditingAccount(account)
    setFormData({
      account_name: account.account_name,
      account_type: account.account_type,
      balance: account.balance,
      is_active: account.is_active,
    })
    setShowAddForm(true)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`確定要刪除帳戶「${name}」嗎？\n\n此操作無法復原。`)) {
      return
    }

    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (data.ok) {
        alert('刪除成功！')
        fetchAccounts()
      } else {
        alert(`刪除失敗：${data.error}`)
      }
    } catch (err) {
      alert('刪除失敗')
    }
  }

  const resetForm = () => {
    setFormData({
      account_name: '',
      account_type: 'cash',
      balance: 0,
      is_active: true,
    })
  }

  const cancelEdit = () => {
    setShowAddForm(false)
    setEditingAccount(null)
    resetForm()
  }

  const groupedAccounts = {
    cash: accounts.filter((a) => a.account_type === 'cash'),
    bank: accounts.filter((a) => a.account_type === 'bank'),
    petty_cash: accounts.filter((a) => a.account_type === 'petty_cash'),
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">帳戶管理</h1>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            {showAddForm ? '取消' : '+ 新增帳戶'}
          </button>
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="mb-6 rounded-lg bg-white dark:bg-gray-800 p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
              {editingAccount ? '編輯帳戶' : '新增帳戶'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                    帳戶名稱 *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.account_name}
                    onChange={(e) =>
                      setFormData({ ...formData, account_name: e.target.value })
                    }
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none"
                    placeholder="例如：國泰銀行、富邦銀行"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                    帳戶類型 *
                  </label>
                  <select
                    required
                    value={formData.account_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        account_type: e.target.value as 'cash' | 'bank' | 'petty_cash',
                      })
                    }
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="cash">現金</option>
                    <option value="bank">銀行</option>
                    <option value="petty_cash">零用金</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                    初始餘額
                  </label>
                  <input
                    type="number"
                    value={formData.balance}
                    onChange={(e) =>
                      setFormData({ ...formData, balance: Number(e.target.value) })
                    }
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData({ ...formData, is_active: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    啟用
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  {editingAccount ? '更新' : '新增'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Summary */}
        <div className="mb-4 rounded-lg bg-white dark:bg-gray-800 p-4 shadow">
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium text-gray-900 dark:text-gray-100">總餘額</span>
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(totalBalance)}
            </span>
          </div>
        </div>

        {/* Accounts List */}
        {loading ? (
          <div className="rounded-lg bg-white dark:bg-gray-800 p-8 text-center text-gray-900 dark:text-gray-100 shadow">
            載入中...
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-lg bg-white dark:bg-gray-800 p-8 text-center text-gray-900 dark:text-gray-100 shadow">
            <p className="mb-4">尚未建立任何帳戶</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              新增第一個帳戶
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedAccounts).map(([type, accountList]) => {
              if (accountList.length === 0) return null

              return (
                <div
                  key={type}
                  className="rounded-lg bg-white dark:bg-gray-800 shadow"
                >
                  <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-3">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {ACCOUNT_TYPE_LABELS[type as keyof typeof ACCOUNT_TYPE_LABELS]}
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                            帳戶名稱
                          </th>
                          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                            餘額
                          </th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                            狀態
                          </th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {accountList.map((account) => (
                          <tr
                            key={account.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                              {account.account_name}
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-semibold">
                              <span
                                className={
                                  account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                                }
                              >
                                {formatCurrency(account.balance)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center text-sm">
                              <span
                                className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                                  account.is_active
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {account.is_active ? '啟用' : '停用'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center text-sm">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEdit(account)}
                                  className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                >
                                  編輯
                                </button>
                                <button
                                  onClick={() => handleDelete(account.id, account.account_name)}
                                  className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                                >
                                  刪除
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
