'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Trip, ReferenceItem, ChecklistItem } from '@/lib/types'

interface Props {
  trip: Trip
  isAdmin: boolean
}

const DEFAULT_EMOJI: Record<string, string> = {
  숙소: '🏨', 맛집: '🍜', 관광지: '🗺️', 교통: '✈️', 쇼핑: '🛍️', 기타: '📌',
  카페: '☕', 액티비티: '🎡', 준비물: '🎒', 예산: '💰',
}

function getCategoryEmoji(cat: string) {
  return DEFAULT_EMOJI[cat] || '📁'
}

const DEFAULT_CATEGORIES = ['숙소', '맛집', '관광지', '교통', '쇼핑', '기타']
const PHOTOS_PER_PAGE = 12

export default function BoardTab({ trip, isAdmin }: Props) {
  const [items, setItems] = useState<ReferenceItem[]>([])
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [showChecklistForm, setShowChecklistForm] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [selectedImage, setSelectedImage] = useState<ReferenceItem | null>(null)
  const [editCategory, setEditCategory] = useState('')
  const [editMemo, setEditMemo] = useState('')
  const [photoPage, setPhotoPage] = useState(0)
  const [categories, setCategories] = useState<string[]>(
    trip.board_categories?.length ? trip.board_categories : DEFAULT_CATEGORIES
  )
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingCategory, setPendingCategory] = useState<string>('')
  const [pendingMemo, setPendingMemo] = useState<string>('')
  const [showUploadPicker, setShowUploadPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [linkForm, setLinkForm] = useState({ title: '', url: '', memo: '', category: categories[0] || '기타' })
  const [checklistForm, setChecklistForm] = useState({ category: '', place: '', time: '', item: '', note: '' })

  useEffect(() => {
    loadItems()
    loadChecklist()
  }, [trip.id])

  async function loadItems() {
    const { data } = await supabase
      .from('reference_items')
      .select('*')
      .eq('trip_id', trip.id)
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  async function loadChecklist() {
    const { data } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('trip_id', trip.id)
      .order('order_index', { ascending: true })
    setChecklist(data || [])
  }

  async function addChecklistItem() {
    if (!checklistForm.item.trim()) return
    await supabase.from('checklist_items').insert({
      trip_id: trip.id,
      category: checklistForm.category.trim() || null,
      place: checklistForm.place.trim() || null,
      time: checklistForm.time.trim() || null,
      item: checklistForm.item.trim(),
      note: checklistForm.note.trim() || null,
      order_index: checklist.length,
    })
    setChecklistForm({ category: '', place: '', time: '', item: '', note: '' })
    setShowChecklistForm(false)
    loadChecklist()
  }

  async function toggleChecklistItem(id: string, checked: boolean) {
    await supabase.from('checklist_items').update({ checked: !checked }).eq('id', id)
    loadChecklist()
  }

  async function deleteChecklistItem(id: string) {
    await supabase.from('checklist_items').delete().eq('id', id)
    loadChecklist()
  }

  async function saveCategories(updated: string[]) {
    setCategories(updated)
    await supabase.from('trips').update({ board_categories: updated }).eq('id', trip.id)
  }

  async function addCategory() {
    const name = newCategoryName.trim()
    if (!name || categories.includes(name)) return
    await saveCategories([...categories, name])
    setNewCategoryName('')
  }

  async function deleteCategory(cat: string) {
    if (!confirm(`"${cat}" 카테고리를 삭제할까요?`)) return
    const updated = categories.filter(c => c !== cat)
    await saveCategories(updated)
    if (filterCategory === cat) setFilterCategory('all')
  }

  async function addLink() {
    if (!linkForm.url.trim()) return
    let url = linkForm.url.trim()
    if (!url.startsWith('http')) url = 'https://' + url
    await supabase.from('reference_items').insert({
      trip_id: trip.id, type: 'link',
      title: linkForm.title.trim() || url, url,
      memo: linkForm.memo.trim() || null, category: linkForm.category,
    })
    setLinkForm({ title: '', url: '', memo: '', category: categories[0] || '기타' })
    setShowLinkForm(false)
    loadItems()
  }

  async function uploadPendingImage() {
    if (!pendingFile) return
    setUploading(true)
    setShowUploadPicker(false)
    const ext = pendingFile.name.split('.').pop()
    const fileName = `${trip.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('references').upload(fileName, pendingFile)
    if (!error) {
      const { data: urlData } = supabase.storage.from('references').getPublicUrl(fileName)
      await supabase.from('reference_items').insert({
        trip_id: trip.id, type: 'image',
        image_url: urlData.publicUrl, title: pendingFile.name,
        category: pendingCategory, memo: pendingMemo.trim() || null,
      })
      loadItems()
    }
    setPendingFile(null)
    setUploading(false)
  }

  async function deleteItem(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('reference_items').delete().eq('id', id)
    setSelectedImage(null)
    loadItems()
  }

  function openImageDetail(item: ReferenceItem) {
    setSelectedImage(item)
    setEditCategory(item.category)
    setEditMemo(item.memo || '')
  }

  async function saveImageDetail() {
    if (!selectedImage) return
    await supabase.from('reference_items').update({
      category: editCategory, memo: editMemo.trim() || null,
    }).eq('id', selectedImage.id)
    setSelectedImage(null)
    loadItems()
  }

  const categoryCounts: Record<string, number> = {}
  items.forEach(i => { categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1 })

  const filtered = filterCategory === 'all' ? items : items.filter(i => i.category === filterCategory)
  const filteredLinks = filtered.filter(i => i.type === 'link')
  const filteredImages = filtered.filter(i => i.type === 'image')

  const totalPhotoPages = Math.ceil(filteredImages.length / PHOTOS_PER_PAGE)
  const pagedImages = filteredImages.slice(photoPage * PHOTOS_PER_PAGE, (photoPage + 1) * PHOTOS_PER_PAGE)

  if (loading) return <div className="text-center py-12 text-slate-400">불러오는 중...</div>

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-slate-700">준비 보드</h2>
        {isAdmin && (
          <button onClick={() => setShowCategoryManager(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium px-3 py-1.5 rounded-lg">
            카테고리 관리
          </button>
        )}
      </div>

      {/* ── 준비물 체크리스트 ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h3 className="font-semibold text-slate-700 text-sm">🎒 준비물</h3>
          <button onClick={() => setShowChecklistForm(!showChecklistForm)}
            className="text-blue-500 text-sm font-medium hover:text-blue-600">
            + 추가
          </button>
        </div>

        {/* 추가 폼 */}
        {showChecklistForm && (
          <div className="p-3 border-b border-slate-100 bg-blue-50 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={checklistForm.category} onChange={e => setChecklistForm(f => ({ ...f, category: e.target.value }))}
                placeholder="카테고리" className="border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
              <input type="text" value={checklistForm.place} onChange={e => setChecklistForm(f => ({ ...f, place: e.target.value }))}
                placeholder="장소" className="border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
              <input type="text" value={checklistForm.time} onChange={e => setChecklistForm(f => ({ ...f, time: e.target.value }))}
                placeholder="시간" className="border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
              <input type="text" value={checklistForm.item} onChange={e => setChecklistForm(f => ({ ...f, item: e.target.value }))}
                placeholder="준비물 *" className="border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
            </div>
            <input type="text" value={checklistForm.note} onChange={e => setChecklistForm(f => ({ ...f, note: e.target.value }))}
              placeholder="비고" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
            <div className="flex gap-2">
              <button onClick={addChecklistItem} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium py-2 rounded-lg">추가</button>
              <button onClick={() => setShowChecklistForm(false)} className="flex-1 bg-slate-100 text-slate-600 text-xs font-medium py-2 rounded-lg">취소</button>
            </div>
          </div>
        )}

        {/* 테이블 헤더 */}
        <div className="grid grid-cols-5 gap-0 text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-200">
          <div className="px-3 py-2 border-r border-slate-200">카테고리</div>
          <div className="px-3 py-2 border-r border-slate-200">장소</div>
          <div className="px-3 py-2 border-r border-slate-200">시간</div>
          <div className="px-3 py-2 border-r border-slate-200">준비물</div>
          <div className="px-3 py-2">비고</div>
        </div>

        {/* 테이블 내용 */}
        {checklist.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            + 추가 버튼으로 준비물을 입력해보세요
          </div>
        ) : (
          checklist.map(c => (
            <div key={c.id}
              className={`grid grid-cols-5 text-xs border-b border-slate-100 last:border-0 group ${c.checked ? 'bg-slate-50 opacity-60' : 'bg-white'}`}
            >
              <div className="px-3 py-2.5 border-r border-slate-100 text-slate-600">{c.category || '-'}</div>
              <div className="px-3 py-2.5 border-r border-slate-100 text-slate-600">{c.place || '-'}</div>
              <div className="px-3 py-2.5 border-r border-slate-100 text-slate-600">{c.time || '-'}</div>
              <div className="px-3 py-2.5 border-r border-slate-100 flex items-center gap-1.5">
                <input type="checkbox" checked={c.checked} onChange={() => toggleChecklistItem(c.id, c.checked)}
                  className="rounded shrink-0 cursor-pointer" />
                <span className={c.checked ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}>{c.item}</span>
              </div>
              <div className="px-3 py-2.5 flex items-center justify-between gap-1">
                <span className="text-slate-500 truncate">{c.note || '-'}</span>
                <button onClick={() => deleteChecklistItem(c.id)}
                  className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">✕</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── 링크/사진 추가 버튼 ── */}
      <div className="flex gap-2">
        <button onClick={() => setShowLinkForm(!showLinkForm)}
          className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-xl flex items-center justify-center gap-2">
          🔗 링크 추가
        </button>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
          {uploading ? '업로드 중...' : '📷 사진 추가'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) { setPendingFile(file); setPendingCategory(filterCategory === 'all' ? (categories[0] || '기타') : filterCategory); setPendingMemo(''); setShowUploadPicker(true) }
            e.target.value = ''
          }} />
      </div>

      {/* 링크 추가 폼 */}
      {showLinkForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="font-medium text-slate-700 text-sm">링크 추가</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <button key={c} onClick={() => setLinkForm(f => ({ ...f, category: c }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${linkForm.category === c ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {getCategoryEmoji(c)} {c}
              </button>
            ))}
          </div>
          <input type="url" value={linkForm.url} onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))}
            placeholder="https://..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <input type="text" value={linkForm.title} onChange={e => setLinkForm(f => ({ ...f, title: e.target.value }))}
            placeholder="제목 (선택)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <input type="text" value={linkForm.memo} onChange={e => setLinkForm(f => ({ ...f, memo: e.target.value }))}
            placeholder="메모 (선택)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <div className="flex gap-2">
            <button onClick={addLink} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2 rounded-lg">추가</button>
            <button onClick={() => setShowLinkForm(false)} className="flex-1 bg-slate-100 text-slate-600 text-sm font-medium py-2 rounded-lg">취소</button>
          </div>
        </div>
      )}

      {/* 카테고리 필터 */}
      {items.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => { setFilterCategory('all'); setPhotoPage(0) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterCategory === 'all' ? 'bg-blue-500 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            전체 {items.length}
          </button>
          {categories.filter(c => categoryCounts[c]).map(c => (
            <button key={c} onClick={() => { setFilterCategory(c); setPhotoPage(0) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterCategory === c ? 'bg-blue-500 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
              {getCategoryEmoji(c)} {c} {categoryCounts[c]}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 && !showLinkForm && (
        <div className="text-center py-8 text-slate-400">
          <div className="text-3xl mb-2">📌</div>
          <p>링크나 사진을 추가해보세요!</p>
        </div>
      )}

      {/* 링크 목록 */}
      {filteredLinks.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-700 text-sm mb-2">🔗 링크 ({filteredLinks.length})</h3>
          <div className="space-y-2">
            {filteredLinks.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-start gap-3">
                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-lg shrink-0">{getCategoryEmoji(item.category)}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{item.category}</span>
                  <a href={item.url!} target="_blank" rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline text-sm truncate block mt-0.5">{item.title || item.url}</a>
                  {item.url && item.title && <p className="text-xs text-slate-400 truncate">{item.url}</p>}
                  {item.memo && <p className="text-xs text-slate-500 mt-1">{item.memo}</p>}
                </div>
                <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-400 text-sm shrink-0">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 사진 (3열, 페이지네이션) */}
      {filteredImages.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-700 text-sm">📷 사진 ({filteredImages.length})</h3>
            {totalPhotoPages > 1 && (
              <span className="text-xs text-slate-400">{photoPage + 1} / {totalPhotoPages}</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {pagedImages.map(item => (
              <div key={item.id} onClick={() => openImageDetail(item)}
                className="relative group rounded-xl overflow-hidden aspect-square bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity">
                <img src={item.image_url!} alt={item.title || ''} className="w-full h-full object-cover" />
                <div className="absolute bottom-1 left-1 bg-black/40 rounded-full px-1.5 py-0.5 text-xs text-white">
                  {getCategoryEmoji(item.category)}
                </div>
                {item.memo && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">{item.memo}</div>
                )}
              </div>
            ))}
          </div>

          {/* 페이지네이션 버튼 */}
          {totalPhotoPages > 1 && (
            <div className="flex justify-center gap-2 mt-3">
              <button onClick={() => setPhotoPage(p => Math.max(0, p - 1))} disabled={photoPage === 0}
                className="px-4 py-1.5 rounded-lg text-sm bg-white border border-slate-200 text-slate-600 disabled:opacity-30">
                이전
              </button>
              {Array.from({ length: totalPhotoPages }, (_, i) => (
                <button key={i} onClick={() => setPhotoPage(i)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium ${photoPage === i ? 'bg-blue-500 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setPhotoPage(p => Math.min(totalPhotoPages - 1, p + 1))} disabled={photoPage === totalPhotoPages - 1}
                className="px-4 py-1.5 rounded-lg text-sm bg-white border border-slate-200 text-slate-600 disabled:opacity-30">
                다음
              </button>
            </div>
          )}
        </div>
      )}

      {/* 업로드 전 카테고리/설명 입력 모달 */}
      {showUploadPicker && pendingFile && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-slate-800">사진 정보 입력</h3>
            <img src={URL.createObjectURL(pendingFile)} alt="" className="w-full h-40 object-cover rounded-xl" />
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">카테고리</p>
              <div className="flex flex-wrap gap-2">
                {categories.map(c => (
                  <button key={c} onClick={() => setPendingCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${pendingCategory === c ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {getCategoryEmoji(c)} {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">설명 (선택)</p>
              <input type="text" value={pendingMemo} onChange={e => setPendingMemo(e.target.value)}
                placeholder="이 사진에 대한 메모" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="flex gap-2">
              <button onClick={uploadPendingImage} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl text-sm">업로드</button>
              <button onClick={() => { setShowUploadPicker(false); setPendingFile(null) }} className="flex-1 bg-slate-100 text-slate-600 font-medium py-3 rounded-xl text-sm">취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 사진 상세 모달 */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <img src={selectedImage.image_url!} alt="" className="w-full max-h-64 object-cover" />
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">카테고리</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map(c => (
                    <button key={c} onClick={() => setEditCategory(c)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${editCategory === c ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {getCategoryEmoji(c)} {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">설명</p>
                <input type="text" value={editMemo} onChange={e => setEditMemo(e.target.value)}
                  placeholder="메모를 입력해주세요" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveImageDetail} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl">저장</button>
                <button onClick={() => deleteItem(selectedImage.id)} className="bg-red-50 hover:bg-red-100 text-red-500 text-sm font-medium px-4 py-2.5 rounded-xl">삭제</button>
                <button onClick={() => setSelectedImage(null)} className="flex-1 bg-slate-100 text-slate-600 text-sm font-medium py-2.5 rounded-xl">닫기</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 카테고리 관리 모달 */}
      {showCategoryManager && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">카테고리 관리</h3>
              <button onClick={() => setShowCategoryManager(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="flex gap-2">
              <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCategory()}
                placeholder="새 카테고리 이름" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <button onClick={addCategory} className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg">추가</button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {categories.map(cat => (
                <div key={cat} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCategoryEmoji(cat)}</span>
                    <span className="text-sm font-medium text-slate-700">{cat}</span>
                    {categoryCounts[cat] && <span className="text-xs text-slate-400">{categoryCounts[cat]}개</span>}
                  </div>
                  <button onClick={() => deleteCategory(cat)} className="text-slate-300 hover:text-red-400 text-sm">삭제</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
