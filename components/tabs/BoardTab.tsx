'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Trip, Schedule, ReferenceItem, ChecklistItem, MemberRole } from '@/lib/types'

interface Props {
  trip: Trip
  isAdmin: boolean
  focusScheduleId?: string | null
  onFocusHandled?: () => void
}

const DEFAULT_CATS = ['숙소', '맛집', '관광지', '교통', '쇼핑', '기타']
const CAT_EMOJI: Record<string, string> = {
  숙소: '🏨', 맛집: '🍜', 관광지: '🏛️', 교통: '✈️', 쇼핑: '🛍️', 기타: '📌',
}
function catEmoji(name: string) { return CAT_EMOJI[name] ?? '📍' }

const ITEMS_PER_PAGE = 12
const EMPTY_ITEM_FORM = { categories: [] as string[], title: '', note: '' }

// 카테고리 배열 토글 헬퍼
function toggleCat(list: string[], cat: string): string[] {
  return list.includes(cat) ? list.filter(c => c !== cat) : [...list, cat]
}

export default function BoardTab({ trip, focusScheduleId, onFocusHandled }: Props) {
  // 기본(고정) 카테고리 — board_categories
  const [baseCats, setBaseCats] = useState<string[]>(trip.board_categories ?? DEFAULT_CATS)
  // 숨긴 일정 카테고리 — settings.hiddenScheduleCats
  const [hiddenSchedCats, setHiddenSchedCats] = useState<string[]>(trip.settings?.hiddenScheduleCats ?? [])
  const [newCatName, setNewCatName] = useState('')

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [refItems, setRefItems] = useState<ReferenceItem[]>([])
  const [loading, setLoading] = useState(true)

  const [showCatManage, setShowCatManage] = useState(false)

  // 역할 분담 (settings.memberRoles)
  const [memberRoles, setMemberRoles] = useState<MemberRole[]>(trip.settings?.memberRoles ?? [])
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editingRole, setEditingRole] = useState<MemberRole | null>(null)
  const [roleForm, setRoleForm] = useState({ name: '', role: '', note: '', avatarUrl: '' })
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // ★ 공통 카테고리 필터 (준비물·링크·사진 모두 적용)
  const [filterCat, setFilterCat] = useState('전체')

  // 준비물
  const [checklistPage, setChecklistPage] = useState(0)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM)

  // 링크
  const [linkPage, setLinkPage] = useState(0)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkCategories, setLinkCategories] = useState<string[]>([])
  const [linkForm, setLinkForm] = useState({ url: '', title: '', memo: '' })

  // 사진
  const [imagePage, setImagePage] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [imageCategories, setImageCategories] = useState<string[]>([])
  const [showImageCatPicker, setShowImageCatPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 카테고리 변경
  const [editingRef, setEditingRef] = useState<ReferenceItem | null>(null)
  const [editingRefCats, setEditingRefCats] = useState<string[]>([])

  // 선택 삭제 모드
  const [selMode, setSelMode] = useState<null | 'checklist' | 'link' | 'image'>(null)
  const [selSet, setSelSet] = useState<Set<string>>(new Set())
  function enterSel(mode: 'checklist' | 'link' | 'image') { setSelMode(mode); setSelSet(new Set()) }
  function exitSel() { setSelMode(null); setSelSet(new Set()) }
  function toggleSel(id: string) {
    setSelSet(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  async function deleteSelected() {
    if (selSet.size === 0) { exitSel(); return }
    if (!confirm(`${selSet.size}개를 삭제할까요?`)) return
    const ids = [...selSet]
    if (selMode === 'checklist') await supabase.from('checklist_items').delete().in('id', ids)
    else await supabase.from('reference_items').delete().in('id', ids)
    exitSel(); loadAll()
  }

  useEffect(() => { loadAll() }, [trip.id])

  // 일정 카드의 "준비 보드" 버튼 → 해당 장소명 카테고리로 필터
  useEffect(() => {
    if (focusScheduleId && !loading) {
      const sched = schedules.find(s => s.id === focusScheduleId)
      if (sched) setFilterCat(sched.place_name)
      onFocusHandled?.()
    }
  }, [focusScheduleId, loading])

  async function loadAll() {
    const [{ data: sData }, { data: cData }, { data: rData }] = await Promise.all([
      supabase.from('schedules').select('*').eq('trip_id', trip.id)
        .order('date', { ascending: true }).order('order_index', { ascending: true }),
      supabase.from('checklist_items').select('*').eq('trip_id', trip.id)
        .order('created_at', { ascending: true }),
      supabase.from('reference_items').select('*').eq('trip_id', trip.id)
        .order('created_at', { ascending: false }),
    ])
    setSchedules(sData || [])
    setChecklistItems(cData || [])
    setRefItems(rData || [])
    setLoading(false)
  }

  function getSchedLabel(scheduleId: string | null): string {
    if (!scheduleId) return ''
    return schedules.find(s => s.id === scheduleId)?.place_name ?? ''
  }

  // 준비물 항목의 카테고리 목록 (categories 우선, 없으면 단일 category / 일정명 하위호환)
  function itemCats(item: ChecklistItem): string[] {
    if (item.categories && item.categories.length > 0) return item.categories
    const single = item.category ?? getSchedLabel(item.schedule_id)
    return single ? [single] : []
  }
  // 링크·사진 자료의 카테고리 목록
  function refCats(item: ReferenceItem): string[] {
    if (item.categories && item.categories.length > 0) return item.categories
    return item.category ? [item.category] : []
  }

  // ── 통합 카테고리 목록 ──
  const scheduleCats = schedules.map(s => s.place_name).filter(n => !hiddenSchedCats.includes(n))
  const allCats = [...new Set([...baseCats, ...scheduleCats])]

  // ── 기본 카테고리 추가/삭제 ──
  async function addCat() {
    const name = newCatName.trim()
    if (!name || baseCats.includes(name)) return
    const updated = [...baseCats, name]
    await supabase.from('trips').update({ board_categories: updated }).eq('id', trip.id)
    setBaseCats(updated)
    setNewCatName('')
  }

  async function deleteBaseCat(cat: string) {
    const updated = baseCats.filter(c => c !== cat)
    await supabase.from('trips').update({ board_categories: updated }).eq('id', trip.id)
    setBaseCats(updated)
    if (filterCat === cat) setFilterCat('전체')
  }

  // 일정 카테고리 숨김 (일정 자체는 삭제하지 않음)
  async function hideScheduleCat(cat: string) {
    const updated = [...hiddenSchedCats, cat]
    await supabase.from('trips')
      .update({ settings: { ...(trip.settings ?? {}), hiddenScheduleCats: updated } })
      .eq('id', trip.id)
    setHiddenSchedCats(updated)
    if (filterCat === cat) setFilterCat('전체')
  }

  // 숨긴 일정 카테고리 다시 표시
  async function unhideScheduleCat(cat: string) {
    const updated = hiddenSchedCats.filter(c => c !== cat)
    await supabase.from('trips')
      .update({ settings: { ...(trip.settings ?? {}), hiddenScheduleCats: updated } })
      .eq('id', trip.id)
    setHiddenSchedCats(updated)
  }

  // ── 역할 분담 ──
  // 다른 settings 값을 보존하며 memberRoles만 저장
  async function persistRoles(updated: MemberRole[]) {
    const { data } = await supabase.from('trips').select('settings').eq('id', trip.id).single()
    const current = (data?.settings as Record<string, unknown>) ?? {}
    await supabase.from('trips').update({ settings: { ...current, memberRoles: updated } }).eq('id', trip.id)
    setMemberRoles(updated)
  }
  function openAddRole() {
    setEditingRole(null)
    setRoleForm({ name: '', role: '', note: '', avatarUrl: '' })
    setShowRoleModal(true)
  }
  function openEditRole(m: MemberRole) {
    setEditingRole(m)
    setRoleForm({ name: m.name, role: m.role, note: m.note, avatarUrl: m.avatarUrl ?? '' })
    setShowRoleModal(true)
  }
  async function uploadAvatar(file: File) {
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const fileName = `${trip.id}/avatar-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('references').upload(fileName, file)
    if (!error) {
      const url = supabase.storage.from('references').getPublicUrl(fileName).data.publicUrl
      setRoleForm(f => ({ ...f, avatarUrl: url }))
    }
    setUploadingAvatar(false)
  }
  async function saveRole() {
    if (!roleForm.name.trim()) return
    const entry: MemberRole = {
      id: editingRole?.id ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now())),
      name: roleForm.name.trim(),
      role: roleForm.role.trim(),
      note: roleForm.note.trim(),
      avatarUrl: roleForm.avatarUrl || undefined,
    }
    const updated = editingRole
      ? memberRoles.map(m => (m.id === entry.id ? entry : m))
      : [...memberRoles, entry]
    await persistRoles(updated)
    setShowRoleModal(false)
  }
  async function deleteRole(id: string) {
    if (!confirm('이 역할을 삭제할까요?')) return
    await persistRoles(memberRoles.filter(m => m.id !== id))
  }

  // ── 준비물 ──
  function openAddItem() {
    setEditingItem(null)
    setItemForm({ ...EMPTY_ITEM_FORM, categories: filterCat !== '전체' ? [filterCat] : [] })
    setShowItemModal(true)
  }
  function openEditItem(item: ChecklistItem) {
    setEditingItem(item)
    setItemForm({ categories: itemCats(item), title: item.title, note: item.note ?? '' })
    setShowItemModal(true)
  }
  async function saveItem() {
    if (!itemForm.title.trim()) return
    const title = itemForm.title.trim()
    const cats = itemForm.categories
    // 선택된 카테고리 중 일정명과 일치하는 것이 있으면 일정 장소·시간 연동
    const matched = schedules.find(s => cats.includes(s.place_name))
    const base: Record<string, unknown> = {
      trip_id: trip.id,
      schedule_id: matched?.id ?? null,
      place: matched?.address ?? null,
      time: matched?.time ?? null,
      title,
      note: itemForm.note.trim() || null,
    }
    // categories(다중·신규), category(단일·하위호환), item(구버전 NOT NULL) — 스키마에 따라 선택 포함
    const full = { ...base, categories: cats, category: cats[0] ?? null, item: title }

    async function run(p: Record<string, unknown>) {
      return editingItem
        ? supabase.from('checklist_items').update(p).eq('id', editingItem.id)
        : supabase.from('checklist_items').insert(p)
    }

    // 누락된 컬럼이 있으면 해당 컬럼만 제거하고 재시도
    let payload: Record<string, unknown> = { ...full }
    for (let i = 0; i < 4; i++) {
      const { error } = await run(payload)
      if (!error) { setShowItemModal(false); loadAll(); return }
      const next = { ...payload }
      if (error.message?.includes("'categories'")) delete next.categories
      else if (error.message?.includes("'category'")) delete next.category
      else if (error.message?.includes("'item'")) delete next.item
      else break // 컬럼 누락 외 다른 오류
      payload = next
    }
  }
  async function deleteItem(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('checklist_items').delete().eq('id', id); loadAll()
  }

  // 자료(링크·사진) insert — categories 컬럼 없으면 제거하고 재시도
  async function insertRef(payload: Record<string, unknown>, cats: string[]) {
    const full = { ...payload, categories: cats, category: cats[0] ?? null }
    let { error } = await supabase.from('reference_items').insert(full)
    if (error && error.message?.includes("'categories'")) {
      ;({ error } = await supabase.from('reference_items').insert({ ...payload, category: cats[0] ?? null }))
    }
    return error
  }

  // ── 링크 ──
  async function addLink() {
    if (!linkForm.url.trim()) return
    let url = linkForm.url.trim()
    if (!url.startsWith('http')) url = 'https://' + url
    await insertRef({
      trip_id: trip.id, type: 'link',
      title: linkForm.title.trim() || url, url,
      memo: linkForm.memo.trim() || null,
      schedule_id: null, schedule_ids: [],
    }, linkCategories)
    setLinkForm({ url: '', title: '', memo: '' })
    setShowLinkForm(false); setLinkPage(0); loadAll()
  }

  // ── 사진 ──
  async function uploadImage(file: File, cats: string[]) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const fileName = `${trip.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('references').upload(fileName, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('references').getPublicUrl(fileName)
      await insertRef({
        trip_id: trip.id, type: 'image',
        image_url: urlData.publicUrl, title: file.name,
        schedule_id: null, schedule_ids: [],
      }, cats)
      setImagePage(0); loadAll()
    }
    setUploading(false)
  }

  async function deleteRef(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('reference_items').delete().eq('id', id); loadAll()
  }

  async function saveRefCat() {
    if (!editingRef) return
    const cats = editingRefCats
    const full = { categories: cats, category: cats[0] ?? null }
    let { error } = await supabase.from('reference_items').update(full).eq('id', editingRef.id)
    if (error && error.message?.includes("'categories'")) {
      await supabase.from('reference_items').update({ category: cats[0] ?? null }).eq('id', editingRef.id)
    }
    setEditingRef(null); loadAll()
  }

  const links = refItems.filter(i => i.type === 'link')
  const images = refItems.filter(i => i.type === 'image')

  // ── 공통 필터 적용 ──
  const filteredChecklist = filterCat === '전체' ? checklistItems : checklistItems.filter(i => itemCats(i).includes(filterCat))
  const filteredLinks = filterCat === '전체' ? links : links.filter(i => refCats(i).includes(filterCat))
  const filteredImages = filterCat === '전체' ? images : images.filter(i => refCats(i).includes(filterCat))

  const totalChecklistPages = Math.ceil(filteredChecklist.length / ITEMS_PER_PAGE)
  const pagedChecklist = filteredChecklist.slice(checklistPage * ITEMS_PER_PAGE, (checklistPage + 1) * ITEMS_PER_PAGE)

  const totalLinkPages = Math.ceil(filteredLinks.length / ITEMS_PER_PAGE)
  const pagedLinks = filteredLinks.slice(linkPage * ITEMS_PER_PAGE, (linkPage + 1) * ITEMS_PER_PAGE)

  const totalImagePages = Math.ceil(filteredImages.length / ITEMS_PER_PAGE)
  const pagedImages = filteredImages.slice(imagePage * ITEMS_PER_PAGE, (imagePage + 1) * ITEMS_PER_PAGE)

  function resetPages() { setChecklistPage(0); setLinkPage(0); setImagePage(0) }

  if (loading) return <div className="text-center py-12 text-slate-400">불러오는 중...</div>

  return (
    <div className="space-y-5">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-700">준비 보드</h2>
        <button
          onClick={() => setShowCatManage(true)}
          className="text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition-colors font-medium"
        >
          카테고리 관리
        </button>
      </div>

      {/* ★ 통합 카테고리 필터 (준비물·링크·사진 공통) */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {['전체', ...allCats].map(cat => (
          <button key={cat} onClick={() => { setFilterCat(cat); resetPages() }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
              filterCat === cat ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {cat === '전체' ? '전체' : `${catEmoji(cat)} ${cat}`}
          </button>
        ))}
      </div>

      {/* ── 섹션 0: 역할 분담 ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="font-semibold text-slate-700 text-sm">👥 역할 분담</span>
          <button onClick={openAddRole} className="text-sm font-semibold text-blue-500 hover:text-blue-600">+ 추가</button>
        </div>
        {memberRoles.length === 0 ? (
          <div className="text-center text-slate-300 text-sm py-6">
            + 추가 버튼으로 멤버별 역할을 정해보세요
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 p-3">
            {memberRoles.map(m => (
              <div key={m.id} onClick={() => openEditRole(m)}
                className="relative rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-200 cursor-pointer group p-3 flex flex-col items-center text-center transition-colors">
                <button onClick={e => { e.stopPropagation(); deleteRole(m.id) }}
                  className="absolute top-1.5 right-1.5 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt={m.name}
                    className="w-11 h-11 rounded-full object-cover mb-2 border border-slate-200" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center text-sm font-bold mb-2">
                    {m.name.slice(0, 2)}
                  </div>
                )}
                <span className="font-medium text-slate-800 text-sm truncate w-full">{m.name}</span>
                {m.role && (
                  <span className="mt-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full max-w-full truncate">{m.role}</span>
                )}
                {m.note && <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 w-full">{m.note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 섹션 1: 준비물 ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="font-semibold text-slate-700 text-sm">🎒 준비물</span>
          {selMode === 'checklist' ? (
            <div className="flex items-center gap-3">
              <button onClick={deleteSelected} className="text-sm font-semibold text-red-500 hover:text-red-600">{selSet.size}개 삭제</button>
              <button onClick={exitSel} className="text-sm text-slate-400 hover:text-slate-600">취소</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {filteredChecklist.length > 0 && (
                <button onClick={() => enterSel('checklist')} className="text-xs text-slate-400 hover:text-slate-600">선택</button>
              )}
              <button onClick={openAddItem} className="text-sm font-semibold text-blue-500 hover:text-blue-600">+ 추가</button>
            </div>
          )}
        </div>

        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-xs font-medium text-slate-500 px-4 py-2.5 w-28">카테고리</th>
              <th className="text-left text-xs font-medium text-slate-500 px-3 py-2.5">준비물</th>
              <th className="text-left text-xs font-medium text-slate-500 px-3 py-2.5">비고</th>
              <th className="px-2 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {pagedChecklist.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-slate-300 text-sm py-8">
                  + 추가 버튼으로 준비물을 입력해보세요
                </td>
              </tr>
            ) : pagedChecklist.map(item => {
              const cats = itemCats(item)
              const picking = selMode === 'checklist'
              const picked = selSet.has(item.id)
              return (
                <tr key={item.id}
                  onClick={() => picking ? toggleSel(item.id) : openEditItem(item)}
                  className={`cursor-pointer group align-top ${picked ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      {picking && (
                        <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 ${
                          picked ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300'
                        }`}>{picked ? '✓' : ''}</span>
                      )}
                      {cats.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {cats.map(c => (
                            <span key={c} className="inline-block text-xs bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full break-keep">{catEmoji(c)} {c}</span>
                          ))}
                        </div>
                      ) : <span className="text-xs text-slate-300">-</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-800 break-words whitespace-pre-wrap">{item.title}</td>
                  <td className="px-3 py-3 text-slate-500 break-words whitespace-pre-wrap">{item.note || '-'}</td>
                  <td className="px-2 py-3">
                    {!picking && (
                      <button onClick={e => { e.stopPropagation(); deleteItem(item.id) }}
                        className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {totalChecklistPages > 1 && (
          <div className="flex items-center justify-center gap-3 py-3 border-t border-slate-100">
            <button onClick={() => setChecklistPage(p => p - 1)} disabled={checklistPage === 0}
              className="text-sm text-slate-500 hover:text-blue-500 disabled:opacity-30 px-2 py-1">← 이전</button>
            <span className="text-xs text-slate-400">{checklistPage + 1} / {totalChecklistPages}</span>
            <button onClick={() => setChecklistPage(p => p + 1)} disabled={checklistPage >= totalChecklistPages - 1}
              className="text-sm text-slate-500 hover:text-blue-500 disabled:opacity-30 px-2 py-1">다음 →</button>
          </div>
        )}
      </div>

      {/* ── 사진 + 링크 추가 버튼 ── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setImageCategories(filterCat !== '전체' ? [filterCat] : []); setShowImageCatPicker(true) }}
          disabled={uploading}
          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          📷 {uploading ? '업로드 중...' : '참고사진 추가'}
        </button>
        <button
          onClick={() => { setShowLinkForm(v => !v); setLinkCategories(filterCat !== '전체' ? [filterCat] : []) }}
          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          🔗 링크 추가
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) uploadImage(f, imageCategories)
          e.target.value = ''
        }} />

      {/* ── 사진 목록 ── */}
      {filteredImages.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-slate-400">📷 참고사진</p>
            {selMode === 'image' ? (
              <div className="flex items-center gap-3">
                <button onClick={deleteSelected} className="text-xs font-semibold text-red-500 hover:text-red-600">{selSet.size}개 삭제</button>
                <button onClick={exitSel} className="text-xs text-slate-400 hover:text-slate-600">취소</button>
              </div>
            ) : (
              <button onClick={() => enterSel('image')} className="text-xs text-slate-400 hover:text-slate-600">선택</button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {pagedImages.map(item => {
              const picking = selMode === 'image'
              const picked = selSet.has(item.id)
              return (
                <div key={item.id}
                  onClick={() => picking && toggleSel(item.id)}
                  className={`relative group rounded-xl overflow-hidden aspect-square bg-slate-100 ${picking ? 'cursor-pointer' : ''} ${picked ? 'ring-2 ring-blue-500' : ''}`}>
                  <img src={item.image_url!} alt="" className="w-full h-full object-cover" />
                  {picking ? (
                    <span className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] ${
                      picked ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white/70 border-white'
                    }`}>{picked ? '✓' : ''}</span>
                  ) : (
                    <>
                      <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingRef(item); setEditingRefCats(refCats(item)) }}
                          className="w-full text-xs bg-black/60 text-white rounded-lg px-1 py-1 truncate">
                          {refCats(item).length > 0 ? refCats(item).map(c => `${catEmoji(c)} ${c}`).join(', ') : '분류'}
                        </button>
                      </div>
                      <button onClick={() => deleteRef(item.id)}
                        className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          {totalImagePages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <button onClick={() => setImagePage(p => p - 1)} disabled={imagePage === 0}
                className="text-sm text-slate-500 hover:text-blue-500 disabled:opacity-30 px-2 py-1">← 이전</button>
              <span className="text-xs text-slate-400">{imagePage + 1} / {totalImagePages}</span>
              <button onClick={() => setImagePage(p => p + 1)} disabled={imagePage >= totalImagePages - 1}
                className="text-sm text-slate-500 hover:text-blue-500 disabled:opacity-30 px-2 py-1">다음 →</button>
            </div>
          )}
        </div>
      )}

      {/* ── 링크 추가 폼 ── */}
      {showLinkForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="font-medium text-slate-700 text-sm">링크 추가 <span className="text-xs font-normal text-slate-400">(카테고리 여러 개 선택 가능)</span></h3>
          <div className="flex flex-wrap gap-2">
            {allCats.map(cat => (
              <button key={cat} onClick={() => setLinkCategories(c => toggleCat(c, cat))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  linkCategories.includes(cat) ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                {catEmoji(cat)} {cat}
              </button>
            ))}
          </div>
          <input type="url" value={linkForm.url} onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))}
            placeholder="https://..."
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <input type="text" value={linkForm.title} onChange={e => setLinkForm(f => ({ ...f, title: e.target.value }))}
            placeholder="제목 (선택)"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <input type="text" value={linkForm.memo} onChange={e => setLinkForm(f => ({ ...f, memo: e.target.value }))}
            placeholder="메모 (선택)"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <div className="flex gap-3">
            <button onClick={addLink}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition-colors">추가</button>
            <button onClick={() => setShowLinkForm(false)}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-3 rounded-xl transition-colors">취소</button>
          </div>
        </div>
      )}

      {/* ── 링크 목록 ── */}
      {filteredLinks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-slate-400">🔗 링크</p>
            {selMode === 'link' ? (
              <div className="flex items-center gap-3">
                <button onClick={deleteSelected} className="text-xs font-semibold text-red-500 hover:text-red-600">{selSet.size}개 삭제</button>
                <button onClick={exitSel} className="text-xs text-slate-400 hover:text-slate-600">취소</button>
              </div>
            ) : (
              <button onClick={() => enterSel('link')} className="text-xs text-slate-400 hover:text-slate-600">선택</button>
            )}
          </div>
          {pagedLinks.map(item => {
            const picking = selMode === 'link'
            const picked = selSet.has(item.id)
            return (
              <div key={item.id}
                onClick={() => picking && toggleSel(item.id)}
                className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-3 group ${picking ? 'cursor-pointer' : ''} ${picked ? 'border-blue-400 ring-1 ring-blue-200 bg-blue-50/40' : 'border-slate-200'}`}>
                {picking && (
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] shrink-0 ${
                    picked ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300'
                  }`}>{picked ? '✓' : ''}</span>
                )}
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-sm shrink-0">🔗</div>
                <div className="flex-1 min-w-0">
                  {picking ? (
                    <span className="font-medium text-slate-700 text-sm truncate block">{item.title || item.url}</span>
                  ) : (
                    <a href={item.url!} target="_blank" rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline text-sm truncate block">
                      {item.title || item.url}
                    </a>
                  )}
                  {item.memo && <p className="text-xs text-slate-400 mt-0.5">{item.memo}</p>}
                </div>
                {!picking && (
                  <>
                    <button onClick={() => { setEditingRef(item); setEditingRefCats(refCats(item)) }}
                      className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full hover:bg-blue-50 hover:text-blue-500 transition-colors shrink-0 max-w-[45%] truncate">
                      {refCats(item).length > 0 ? refCats(item).map(c => `${catEmoji(c)} ${c}`).join(', ') : '분류'}
                    </button>
                    <button onClick={() => deleteRef(item.id)}
                      className="text-slate-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0">✕</button>
                  </>
                )}
              </div>
            )
          })}
          {totalLinkPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <button onClick={() => setLinkPage(p => p - 1)} disabled={linkPage === 0}
                className="text-sm text-slate-500 hover:text-blue-500 disabled:opacity-30 px-2 py-1">← 이전</button>
              <span className="text-xs text-slate-400">{linkPage + 1} / {totalLinkPages}</span>
              <button onClick={() => setLinkPage(p => p + 1)} disabled={linkPage >= totalLinkPages - 1}
                className="text-sm text-slate-500 hover:text-blue-500 disabled:opacity-30 px-2 py-1">다음 →</button>
            </div>
          )}
        </div>
      )}

      {/* 링크·사진 모두 없을 때 빈 상태 */}
      {filteredLinks.length === 0 && filteredImages.length === 0 && !showLinkForm && (
        <div className="text-center py-10 text-slate-400">
          <div className="text-4xl mb-3">📌</div>
          <p className="text-sm font-medium">
            {filterCat === '전체' ? '링크나 참고사진을 추가해보세요!' : `'${filterCat}' 카테고리에 링크·참고사진이 없어요`}
          </p>
        </div>
      )}

      {/* ── 카테고리 관리 모달 ── */}
      {showCatManage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">카테고리 관리</h3>
              <button onClick={() => { setShowCatManage(false); setNewCatName('') }} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCat()}
                placeholder="새 카테고리 이름"
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button onClick={addCat}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
                추가
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1">
              {/* 기본 카테고리 */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400">기본 카테고리</p>
                {baseCats.map(cat => (
                  <div key={cat} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-base">{catEmoji(cat)}</span>
                    <span className="flex-1 text-sm font-medium text-slate-700">{cat}</span>
                    <button onClick={() => deleteBaseCat(cat)}
                      className="text-sm text-slate-400 hover:text-red-500 transition-colors">삭제</button>
                  </div>
                ))}
              </div>

              {/* 일정 연동 카테고리 */}
              {scheduleCats.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400">일정 연동 카테고리</p>
                  {scheduleCats.map(cat => (
                    <div key={cat} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50/50 border border-blue-100">
                      <span className="text-base">📍</span>
                      <span className="flex-1 text-sm font-medium text-slate-700">{cat}</span>
                      <button onClick={() => hideScheduleCat(cat)}
                        className="text-sm text-slate-400 hover:text-red-500 transition-colors">삭제</button>
                    </div>
                  ))}
                  <p className="text-[11px] text-slate-400 px-1">일정 카테고리를 삭제해도 일정 내용은 유지됩니다</p>
                </div>
              )}

              {/* 숨긴 일정 카테고리 복원 */}
              {hiddenSchedCats.filter(c => schedules.some(s => s.place_name === c)).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400">숨긴 일정 카테고리</p>
                  {hiddenSchedCats.filter(c => schedules.some(s => s.place_name === c)).map(cat => (
                    <div key={cat} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 opacity-70">
                      <span className="text-base">🙈</span>
                      <span className="flex-1 text-sm font-medium text-slate-500 line-through">{cat}</span>
                      <button onClick={() => unhideScheduleCat(cat)}
                        className="text-sm text-blue-400 hover:text-blue-600 transition-colors">복원</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 사진 카테고리 선택 모달 ── */}
      {showImageCatPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">카테고리 선택 <span className="text-xs font-normal text-slate-400">(여러 개 가능)</span></h3>
              <button onClick={() => setShowImageCatPicker(false)} className="text-slate-400 text-xl">✕</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {allCats.map(cat => (
                <button key={cat} onClick={() => setImageCategories(c => toggleCat(c, cat))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    imageCategories.includes(cat) ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {catEmoji(cat)} {cat}
                </button>
              ))}
            </div>
            <button onClick={() => { setShowImageCatPicker(false); fileInputRef.current?.click() }}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl">
              사진 선택하기
            </button>
          </div>
        </div>
      )}

      {/* ── 역할 분담 추가/수정 모달 ── */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editingRole ? '역할 수정' : '역할 추가'}</h3>
              <button onClick={() => setShowRoleModal(false)} className="text-slate-400 text-xl">✕</button>
            </div>

            {/* 프로필 사진 */}
            <div className="flex flex-col items-center gap-2">
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = '' }} />
              <div className="relative">
                {roleForm.avatarUrl ? (
                  <img src={roleForm.avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-2xl text-slate-300">👤</div>
                )}
                {roleForm.avatarUrl && (
                  <button onClick={() => setRoleForm(f => ({ ...f, avatarUrl: '' }))}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
                )}
              </div>
              <button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}
                className="text-xs font-medium text-blue-500 hover:text-blue-600 disabled:opacity-50">
                {uploadingAvatar ? '업로드 중...' : (roleForm.avatarUrl ? '사진 변경' : '📷 프로필 사진 추가')}
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">이름 <span className="text-red-400">*</span></label>
              <input type="text" value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))}
                placeholder="예: 홍길동"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">역할 (맡은 일)</label>
              <input type="text" value={roleForm.role} onChange={e => setRoleForm(f => ({ ...f, role: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && saveRole()} placeholder="예: 숙소·예약 담당"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">메모</label>
              <input type="text" value={roleForm.note} onChange={e => setRoleForm(f => ({ ...f, note: e.target.value }))}
                placeholder="예: 연락처, 비고 등"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowRoleModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-medium py-3 rounded-xl hover:bg-slate-50">취소</button>
              <button onClick={saveRole}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl">
                {editingRole ? '수정 완료' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 준비물 추가/수정 모달 ── */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editingItem ? '준비물 수정' : '준비물 추가'}</h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 text-xl">✕</button>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">카테고리 <span className="text-slate-400 font-normal">(여러 개 가능)</span></label>
              <div className="flex flex-wrap gap-2">
                {allCats.map(cat => (
                  <button key={cat} onClick={() => setItemForm(f => ({ ...f, categories: toggleCat(f.categories, cat) }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      itemForm.categories.includes(cat) ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>
                    {catEmoji(cat)} {cat}
                  </button>
                ))}
              </div>
              {(() => {
                const sched = schedules.find(s => itemForm.categories.includes(s.place_name) && (s.address || s.time))
                if (!sched) return null
                return (
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    📍 일정 연동: {sched.address || '주소 없음'}{sched.time ? ` · ${sched.time}` : ''}
                  </p>
                )
              })()}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">준비물 <span className="text-red-400">*</span></label>
              <input type="text" value={itemForm.title} onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && saveItem()} placeholder="예: 여권 챙기기"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">비고</label>
              <input type="text" value={itemForm.note} onChange={e => setItemForm(f => ({ ...f, note: e.target.value }))}
                placeholder="추가 메모"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowItemModal(false)}
                className="flex-1 border border-slate-200 text-slate-600 font-medium py-3 rounded-xl hover:bg-slate-50">취소</button>
              <button onClick={saveItem}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl">
                {editingItem ? '수정 완료' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 자료 카테고리 변경 모달 ── */}
      {editingRef && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">카테고리 변경 <span className="text-xs font-normal text-slate-400">(여러 개 가능)</span></h3>
              <button onClick={() => setEditingRef(null)} className="text-slate-400 text-xl">✕</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {allCats.map(cat => (
                <button key={cat} onClick={() => setEditingRefCats(c => toggleCat(c, cat))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    editingRefCats.includes(cat) ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {catEmoji(cat)} {cat}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingRef(null)}
                className="flex-1 border border-slate-200 text-slate-600 font-medium py-3 rounded-xl hover:bg-slate-50">취소</button>
              <button onClick={saveRefCat}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl">저장</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
