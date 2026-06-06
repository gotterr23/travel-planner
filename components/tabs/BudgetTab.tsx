'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Trip, BudgetItem } from '@/lib/types'

interface Props {
  trip: Trip
  isAdmin: boolean
}

const CATEGORIES: BudgetItem['category'][] = ['숙박', '교통', '식비', '관광', '기타']

const CATEGORY_EMOJI: Record<BudgetItem['category'], string> = {
  숙박: '🏨', 교통: '✈️', 식비: '🍜', 관광: '🎡', 기타: '📦'
}

const DEFAULT_NAMES: Record<string, string> = {
  숙박: '숙박', 교통: '교통', 식비: '식비', 관광: '관광', 기타: '기타'
}

export default function BudgetTab({ trip, isAdmin: _isAdmin }: Props) {
  const [items, setItems] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ category: '식비' as BudgetItem['category'], title: '', amount: '', paid_by: '' })
  const [selectedPayer, setSelectedPayer] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null)
  const [editForm, setEditForm] = useState({ category: '식비' as BudgetItem['category'], title: '', amount: '', paid_by: '' })

  // 카테고리 이름 커스터마이즈
  const [catNames, setCatNames] = useState<Record<string, string>>(
    trip.settings?.budgetCategories ?? DEFAULT_NAMES
  )
  const [showCatEdit, setShowCatEdit] = useState(false)
  const [editingCatNames, setEditingCatNames] = useState<Record<string, string>>(DEFAULT_NAMES)

  // DB에 저장된 커스텀 이름을 표시용으로 변환
  function label(cat: string): string {
    return catNames[cat] || cat
  }

  useEffect(() => { loadItems() }, [trip.id])

  async function loadItems() {
    const { data } = await supabase
      .from('budget_items')
      .select('*')
      .eq('trip_id', trip.id)
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  async function addItem() {
    if (!form.title.trim() || !form.amount) return
    await supabase.from('budget_items').insert({
      trip_id: trip.id,
      category: form.category,
      title: form.title.trim(),
      amount: parseInt(form.amount),
      paid_by: form.paid_by.trim() || null,
    })
    setForm({ category: '식비', title: '', amount: '', paid_by: '' })
    setShowForm(false)
    loadItems()
  }

  function openCatEdit() {
    setEditingCatNames({ ...DEFAULT_NAMES, ...catNames })
    setShowCatEdit(true)
  }

  async function saveCatNames() {
    const { data } = await supabase.from('trips').select('settings').eq('id', trip.id).single()
    const current = (data?.settings as Record<string, unknown>) || {}
    await supabase.from('trips').update({
      settings: { ...current, budgetCategories: editingCatNames }
    }).eq('id', trip.id)
    setCatNames(editingCatNames)
    setShowCatEdit(false)
  }

  function openEdit(item: BudgetItem) {
    setEditingItem(item)
    setEditForm({ category: item.category, title: item.title, amount: String(item.amount), paid_by: item.paid_by ?? '' })
  }

  async function saveEdit() {
    if (!editingItem || !editForm.title.trim() || !editForm.amount) return
    await supabase.from('budget_items').update({
      category: editForm.category,
      title: editForm.title.trim(),
      amount: parseInt(editForm.amount),
      paid_by: editForm.paid_by.trim() || null,
    }).eq('id', editingItem.id)
    setEditingItem(null)
    loadItems()
  }

  async function deleteItem(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('budget_items').delete().eq('id', id)
    loadItems()
  }

  // 지출자 목록 (중복 제거)
  const payers = [...new Set(items.filter(i => i.paid_by).map(i => i.paid_by!))]

  // 필터 적용
  const filteredItems = selectedPayer ? items.filter(i => i.paid_by === selectedPayer) : items

  const total = items.reduce((sum, i) => sum + i.amount, 0)
  const filteredTotal = filteredItems.reduce((sum, i) => sum + i.amount, 0)

  const byCategory: Partial<Record<BudgetItem['category'], number>> = {}
  filteredItems.forEach(i => { byCategory[i.category] = (byCategory[i.category] || 0) + i.amount })

  // 지출자별 합계
  const payerTotal = (payer: string) =>
    items.filter(i => i.paid_by === payer).reduce((sum, i) => sum + i.amount, 0)

  if (loading) return <div className="text-center py-12 text-slate-400">불러오는 중...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-slate-700">예산 관리</h2>
          <button
            onClick={openCatEdit}
            className="text-xs text-slate-400 hover:text-blue-500 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
            title="카테고리 이름 수정"
          >
            카테고리 수정
          </button>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          + 지출 추가
        </button>
      </div>

      {/* 총계 카드 */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-blue-100 text-sm font-medium">
              {selectedPayer ? `${selectedPayer} 지출` : '총 지출'}
            </p>
            <p className="text-3xl font-bold mt-1">{filteredTotal.toLocaleString()}원</p>
            {selectedPayer && (
              <p className="text-blue-200 text-xs mt-0.5">전체 합계: {total.toLocaleString()}원</p>
            )}
          </div>
          {selectedPayer && (
            <div className="text-right">
              <p className="text-blue-100 text-xs">전체 대비</p>
              <p className="text-white font-bold text-lg">
                {total > 0 ? Math.round(filteredTotal / total * 100) : 0}%
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {CATEGORIES.filter(c => byCategory[c]).map(c => (
            <span key={c} className="bg-white/20 rounded-full px-2.5 py-1 text-xs font-medium">
              {CATEGORY_EMOJI[c]} {label(c)} {byCategory[c]!.toLocaleString()}원
            </span>
          ))}
        </div>
      </div>

      {/* 지출자 필터 */}
      {payers.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">지출자 필터</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedPayer(null)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                selectedPayer === null
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              전체 ({items.length}건)
            </button>
            {payers.map(payer => {
              const count = items.filter(i => i.paid_by === payer).length
              return (
                <button
                  key={payer}
                  onClick={() => setSelectedPayer(selectedPayer === payer ? null : payer)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                    selectedPayer === payer
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {payer} · {payerTotal(payer).toLocaleString()}원 ({count}건)
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 지출 추가 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="font-medium text-slate-700 text-sm">지출 추가</h3>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setForm(f => ({ ...f, category: c }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  form.category === c ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {CATEGORY_EMOJI[c]} {label(c)}
              </button>
            ))}
          </div>
          <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="항목 이름 (예: 도톤보리 타코야키)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="금액 (원)"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <input type="text" value={form.paid_by} onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}
              placeholder="결제자 (선택)"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex gap-2">
            <button onClick={addItem} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2 rounded-lg">추가</button>
            <button onClick={() => setShowForm(false)} className="flex-1 bg-slate-100 text-slate-600 text-sm font-medium py-2 rounded-lg">취소</button>
          </div>
        </div>
      )}

      {/* 지출 목록 */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <div className="text-3xl mb-2">💰</div>
          {selectedPayer ? (
            <p>{selectedPayer}의 지출 내역이 없어요</p>
          ) : (
            <>
              <p>아직 지출이 없어요</p>
              <p className="text-sm mt-1">지출을 추가해보세요!</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => (
            <div
              key={item.id}
              onClick={() => openEdit(item)}
              className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              <div className="text-xl shrink-0">{CATEGORY_EMOJI[item.category]}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 text-sm">{item.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{CATEGORY_EMOJI[item.category]} {label(item.category)}</span>
                  {item.paid_by && (
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedPayer(item.paid_by === selectedPayer ? null : item.paid_by) }}
                      className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                        selectedPayer === item.paid_by
                          ? 'bg-blue-100 text-blue-600'
                          : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'
                      }`}
                    >
                      {item.paid_by} 결제
                    </button>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-slate-800">{item.amount.toLocaleString()}원</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); deleteItem(item.id) }}
                className="text-slate-300 hover:text-red-400 text-sm shrink-0 ml-1"
              >✕</button>
            </div>
          ))}
        </div>
      )}
      {/* 카테고리 이름 편집 모달 */}
      {showCatEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">카테고리 이름 수정</h3>
              <button onClick={() => setShowCatEdit(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <p className="text-xs text-slate-400">이름을 바꿔도 기존 지출 내역은 그대로 유지됩니다</p>
            <div className="space-y-3">
              {CATEGORIES.map(c => (
                <div key={c} className="flex items-center gap-3">
                  <span className="text-xl shrink-0">{CATEGORY_EMOJI[c]}</span>
                  <input
                    type="text"
                    value={editingCatNames[c] ?? c}
                    onChange={e => setEditingCatNames(n => ({ ...n, [c]: e.target.value }))}
                    placeholder={c}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  {editingCatNames[c] !== c && editingCatNames[c] !== DEFAULT_NAMES[c] && (
                    <button
                      onClick={() => setEditingCatNames(n => ({ ...n, [c]: c }))}
                      className="text-xs text-slate-400 hover:text-slate-600 shrink-0"
                    >
                      초기화
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowCatEdit(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-medium py-3 rounded-xl hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveCatNames}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">지출 수정</h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => setEditForm(f => ({ ...f, category: c }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    editForm.category === c ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {CATEGORY_EMOJI[c]} {label(c)}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={editForm.title}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              placeholder="항목 이름"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={editForm.amount}
                onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="금액 (원)"
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <input
                type="text"
                value={editForm.paid_by}
                onChange={e => setEditForm(f => ({ ...f, paid_by: e.target.value }))}
                placeholder="결제자 (선택)"
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-medium py-3 rounded-xl hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                수정 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
