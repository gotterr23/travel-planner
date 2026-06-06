'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Trip, Schedule, ReferenceItem, ChecklistItem } from '@/lib/types'

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
function catEmoji(name: string) { return CAT_EMOJI[name] ?? '📌' }

const ITEMS_PER_PAGE = 12
const EMPTY_ITEM_FORM = { scheduleId: '', place: '', time: '', title: '', note: '' }

export default function BoardTab({ trip, focusScheduleId, onFocusHandled }: Props) {
  const [cats, setCats] = useState<string[]>(trip.board_categories ?? DEFAULT_CATS)
  const [newCatName, setNewCatName] = useState('')

  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [refItems, setRefItems] = useState<ReferenceItem[]>([])
  const [loading, setLoading] = useState(true)

  const [showCatManage, setShowCatManage] = useState(false)

  // 준비물
  const [checklistFilter, setChecklistFilter] = useState('전체')
  const [checklistPage, setChecklistPage] = useState(0)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM)

  // 링크
  const [linkFilter, setLinkFilter] = useState('전체')
  const [linkPage, setLinkPage] = useState(0)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkCategory, setLinkCategory] = useState(cats[0] ?? '기타')
  const [linkForm, setLinkForm] = useState({ url: '', title: '', memo: '' })

  // 사진
  const [imageFilter, setImageFilter] = useState('전체')
  const [imagePage, setImagePage] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [imageCategory, setImageCategory] = useState(cats[0] ?? '기타')
  const [showImageCatPicker, setShowImageCatPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 카테고리 변경
  const [editingRef, setEditingRef] = useState<ReferenceItem | null>(null)
  const [editingRefCat, setEditingRefCat] = useState('')

  useEffect(() => { loadAll() }, [trip.id])

  useEffect(() => {
    if (focusScheduleId && !loading) onFocusHandled?.()
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

  // 카테고리 추가/삭제
  async function addCat() {
    const name = newCatName.trim()
    if (!name || cats.includes(name)) return
    const updated = [...cats, name]
    await supabase.from('trips').update({ board_categories: updated }).eq('id', trip.id)
    setCats(updated)
    setNewCatName('')
  }

  async function deleteCat(cat: string) {
    const updated = cats.filter(c => c !== cat)
    await supabase.from('trips').update({ board_categories: updated }).eq('id', trip.id)
    setCats(updated)
  }

  // 준비물
  function openAddItem() { setEditingItem(null); setItemForm(EMPTY_ITEM_FORM); setShowItemModal(true) }
  function openEditItem(item: ChecklistItem) {
    setEditingItem(item)
    setItemForm({ scheduleId: item.schedule_id ?? '', place: item.place ?? '', time: item.time ?? '', title: item.title, note: item.note ?? '' })
    setShowItemModal(true)
  }
  async function saveItem() {
    if (!itemForm.title.trim()) return
    const payload = {
      trip_id: trip.id,
      schedule_id: itemForm.scheduleId || null,
      place: itemForm.place.trim() || null,
      time: itemForm.time || null,
      title: itemForm.title.trim(),
      note: itemForm.note.trim() || null,
    }
    if (editingItem) {
      await supabase.from('checklist_items').update(payload).eq('id', editingItem.id)
    } else {
      await supabase.from('checklist_items').insert(payload)
    }
    setShowItemModal(false); loadAll()
  }
  async function deleteItem(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('checklist_items').delete().eq('id', id); loadAll()
  }

  // 링크
  async function addLink() {
    if (!linkForm.url.trim()) return
    let url = linkForm.url.trim()
    if (!url.startsWith('http')) url = 'https://' + url
    await supabase.from('reference_items').insert({
      trip_id: trip.id, type: 'link',
      title: linkForm.title.trim() || url, url,
      memo: linkForm.memo.trim() || null,
      category: linkCategory,
      schedule_id: null, schedule_ids: [],
    })
    setLinkForm({ url: '', title: '', memo: '' })
    setShowLinkForm(false); setLinkPage(0); loadAll()
  }

  // 사진
  async function uploadImage(file: File, category: string) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const fileName = `${trip.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('references').upload(fileName, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('references').getPublicUrl(fileName)
      await supabase.from('reference_items').insert({
        trip_id: trip.id, type: 'image',
        image_url: urlData.publicUrl, title: file.name,
        category, schedule_id: null, schedule_ids: [],
      })
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
    await supabase.from('reference_items').update({ category: editingRefCat }).eq('id', editingRef.id)
    setEditingRef(null); loadAll()
  }

  const links = refItems.filter(i => i.type === 'link')
  const images = refItems.filter(i => i.type === 'image')

  // 준비물 필터 + 페이지
  const checklistCats = [...new Set(checklistItems.map(i => getSchedLabel(i.schedule_id)).filter(Boolean))]
  const filteredChecklist = checklistFilter === '전체' ? checklistItems : checklistItems.filter(i => getSchedLabel(i.schedule_id) === checklistFilter)
  const totalChecklistPages = Math.ceil(filteredChecklist.length / ITEMS_PER_PAGE)
  const pagedChecklist = filteredChecklist.slice(checklistPage * ITEMS_PER_PAGE, (checklistPage + 1) * ITEMS_PER_PAGE)

  // 링크 필터 + 페이지
  const linkCats = [...new Set(links.map(i => i.category).filter(Boolean))] as string[]
  const filteredLinks = linkFilter === '전체' ? links : links.filter(i => i.category === linkFilter)
  const totalLinkPages = Math.ceil(filteredLinks.length / ITEMS_PER_PAGE)
  const pagedLinks = filteredLinks.slice(linkPage * ITEMS_PER_PAGE, (linkPage + 1) * ITEMS_PER_PAGE)

  // 사진 필터 + 페이지
  const imageCats = [...new Set(images.map(i => i.category).filter(Boolean))] as string[]
  const filteredImages = imageFilter === '전체' ? images : images.filter(i => i.category === imageFilter)
  const totalImagePages = Math.ceil(filteredImages.length / ITEMS_PER_PAGE)
  const pagedImages = filteredImages.slice(imagePage * ITEMS_PER_PAGE, (imagePage + 1) * ITEMS_PER_PAGE)

  if (loading) return <div className="text-center py-12 text-slate-400">불러오는 중...</div>

  return (
    <div className="space-y-6">

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

      {/* ── 섹션 1: 준비물 ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="font-semibold text-slate-700 text-sm">🎒 준비물</span>
          <button onClick={openAddItem} className="text-sm font-semibold text-blue-500 hover:text-blue-600">+ 추가</button>
        </div>

        {checklistCats.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 py-2 border-b border-slate-100 no-scrollbar">
            {['전체', ...checklistCats].map(cat => (
              <button key={cat} onClick={() => { setChecklistFilter(cat); setChecklistPage(0) }}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                  checklistFilter === cat ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>{cat}</button>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-2.5 whitespace-nowrap">카테고리</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-2.5 whitespace-nowrap">장소</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-2.5 whitespace-nowrap">시간</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-2.5 whitespace-nowrap">준비물</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-2.5 whitespace-nowrap">비고</th>
                <th className="px-2 py-2.5 w-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pagedChecklist.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-slate-300 text-sm py-8">
                    + 추가 버튼으로 준비물을 입력해보세요
                  </td>
                </tr>
              ) : pagedChecklist.map(item => (
                <tr key={item.id} onClick={() => openEditItem(item)} className="hover:bg-slate-50 cursor-pointer group">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {item.schedule_id
                      ? <span className="text-xs bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">{getSchedLabel(item.schedule_id)}</span>
                      : <span className="text-xs text-slate-300">-</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{item.place || '-'}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{item.time || '-'}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{item.title}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-32 truncate">{item.note || '-'}</td>
                  <td className="px-2 py-3">
                    <button onClick={e => { e.stopPropagation(); deleteItem(item.id) }}
                      className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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

      {/* ── 섹션 2 & 3: 링크 + 사진 버튼 ── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setShowLinkForm(v => !v); setLinkCategory(cats[0] ?? '기타') }}
          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          🔗 링크 추가
        </button>
        <button
          onClick={() => setShowImageCatPicker(true)}
          disabled={uploading}
          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          📷 {uploading ? '업로드 중...' : '사진 추가'}
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) uploadImage(f, imageCategory)
          e.target.value = ''
        }} />

      {/* ── 링크 추가 폼 ── */}
      {showLinkForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="font-medium text-slate-700 text-sm">링크 추가</h3>
          <div className="flex flex-wrap gap-2">
            {cats.map(cat => (
              <button key={cat} onClick={() => setLinkCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  linkCategory === cat ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
      {links.length > 0 && (
        <div className="space-y-2">
          {linkCats.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {['전체', ...linkCats].map(cat => (
                <button key={cat} onClick={() => { setLinkFilter(cat); setLinkPage(0) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                    linkFilter === cat ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {cat === '전체' ? '전체' : `${catEmoji(cat)} ${cat}`}
                </button>
              ))}
            </div>
          )}
          {pagedLinks.map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 group">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-sm shrink-0">🔗</div>
              <div className="flex-1 min-w-0">
                <a href={item.url!} target="_blank" rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline text-sm truncate block">
                  {item.title || item.url}
                </a>
                {item.memo && <p className="text-xs text-slate-400 mt-0.5">{item.memo}</p>}
              </div>
              <button onClick={() => { setEditingRef(item); setEditingRefCat(item.category ?? '기타') }}
                className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full hover:bg-blue-50 hover:text-blue-500 transition-colors shrink-0">
                {catEmoji(item.category ?? '기타')} {item.category ?? '기타'}
              </button>
              <button onClick={() => deleteRef(item.id)}
                className="text-slate-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0">✕</button>
            </div>
          ))}
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

      {/* ── 사진 목록 ── */}
      {images.length > 0 && (
        <div className="space-y-2">
          {imageCats.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {['전체', ...imageCats].map(cat => (
                <button key={cat} onClick={() => { setImageFilter(cat); setImagePage(0) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                    imageFilter === cat ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {cat === '전체' ? '전체' : `${catEmoji(cat)} ${cat}`}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {pagedImages.map(item => (
              <div key={item.id} className="relative group rounded-xl overflow-hidden aspect-square bg-slate-100">
                <img src={item.image_url!} alt="" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingRef(item); setEditingRefCat(item.category ?? '기타') }}
                    className="w-full text-xs bg-black/60 text-white rounded-lg px-1 py-1 truncate">
                    {catEmoji(item.category ?? '기타')} {item.category ?? '기타'}
                  </button>
                </div>
                <button onClick={() => deleteRef(item.id)}
                  className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              </div>
            ))}
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

      {/* 링크·사진 모두 없을 때 빈 상태 */}
      {links.length === 0 && images.length === 0 && !showLinkForm && (
        <div className="text-center py-10 text-slate-400">
          <div className="text-4xl mb-3">📌</div>
          <p className="text-sm font-medium">링크나 사진을 추가해보세요!</p>
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
            <div className="space-y-2 overflow-y-auto flex-1">
              {cats.map(cat => (
                <div key={cat} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-base">{catEmoji(cat)}</span>
                  <span className="flex-1 text-sm font-medium text-slate-700">{cat}</span>
                  <button onClick={() => deleteCat(cat)}
                    className="text-sm text-slate-400 hover:text-red-500 transition-colors">삭제</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 사진 카테고리 선택 모달 ── */}
      {showImageCatPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">카테고리 선택</h3>
              <button onClick={() => setShowImageCatPicker(false)} className="text-slate-400 text-xl">✕</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {cats.map(cat => (
                <button key={cat} onClick={() => setImageCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    imageCategory === cat ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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

      {/* ── 준비물 추가/수정 모달 ── */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editingItem ? '준비물 수정' : '준비물 추가'}</h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 text-xl">✕</button>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">카테고리 (일정 연동)</label>
              <select
                value={itemForm.scheduleId}
                onChange={e => {
                  const id = e.target.value
                  const sched = schedules.find(s => s.id === id)
                  setItemForm(f => ({
                    ...f,
                    scheduleId: id,
                    place: id && sched?.address ? sched.address : f.place,
                  }))
                }}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                <option value="">분류 없음</option>
                {schedules.map(s => (
                  <option key={s.id} value={s.id}>
                    📍 {s.place_name}{s.address ? ` — ${s.address}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">장소</label>
                <input type="text" value={itemForm.place} onChange={e => setItemForm(f => ({ ...f, place: e.target.value }))}
                  placeholder="예: 불국사 입구"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">시간</label>
                <input type="time" value={itemForm.time} onChange={e => setItemForm(f => ({ ...f, time: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
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
              <h3 className="font-bold text-slate-800">카테고리 변경</h3>
              <button onClick={() => setEditingRef(null)} className="text-slate-400 text-xl">✕</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {cats.map(cat => (
                <button key={cat} onClick={() => setEditingRefCat(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    editingRefCat === cat ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
