'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Trip, ReferenceItem } from '@/lib/types'

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

export default function BoardTab({ trip, isAdmin }: Props) {
  const [items, setItems] = useState<ReferenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [selectedImage, setSelectedImage] = useState<ReferenceItem | null>(null)
  const [editCategory, setEditCategory] = useState('')
  const [editMemo, setEditMemo] = useState('')
  const [categories, setCategories] = useState<string[]>(
    trip.board_categories?.length ? trip.board_categories : DEFAULT_CATEGORIES
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [linkForm, setLinkForm] = useState({ title: '', url: '', memo: '', category: categories[0] || '기타' })

  useEffect(() => {
    loadItems()
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
    if (!confirm(`"${cat}" 카테고리를 삭제할까요?\n항목들은 삭제되지 않아요.`)) return
    const updated = categories.filter(c => c !== cat)
    await saveCategories(updated)
    if (filterCategory === cat) setFilterCategory('all')
  }

  async function addLink() {
    if (!linkForm.url.trim()) return
    let url = linkForm.url.trim()
    if (!url.startsWith('http')) url = 'https://' + url

    await supabase.from('reference_items').insert({
      trip_id: trip.id,
      type: 'link',
      title: linkForm.title.trim() || url,
      url,
      memo: linkForm.memo.trim() || null,
      category: linkForm.category,
    })
    setLinkForm({ title: '', url: '', memo: '', category: categories[0] || '기타' })
    setShowLinkForm(false)
    loadItems()
  }

  async function uploadImage(file: File, category: string) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const fileName = `${trip.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('references').upload(fileName, file)
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('references').getPublicUrl(fileName)
      await supabase.from('reference_items').insert({
        trip_id: trip.id,
        type: 'image',
        image_url: urlData.publicUrl,
        title: file.name,
        category,
      })
      loadItems()
    }
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
      category: editCategory,
      memo: editMemo.trim() || null,
    }).eq('id', selectedImage.id)
    setSelectedImage(null)
    loadItems()
  }

  const categoryCounts: Record<string, number> = {}
  items.forEach(i => { categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1 })

  const filtered = filterCategory === 'all' ? items : items.filter(i => i.category === filterCategory)
  const filteredLinks = filtered.filter(i => i.type === 'link')
  const filteredImages = filtered.filter(i => i.type === 'image')

  if (loading) return <div className="text-center py-12 text-slate-400">불러오는 중...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-slate-700">준비 보드</h2>
        {isAdmin && (
          <button
            onClick={() => setShowCategoryManager(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            카테고리 관리
          </button>
        )}
      </div>

      {/* 링크/사진 추가 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowLinkForm(!showLinkForm)}
          className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          🔗 링크 추가
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {uploading ? '업로드 중...' : '📷 사진 추가'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) uploadImage(file, filterCategory === 'all' ? (categories[0] || '기타') : filterCategory)
            e.target.value = ''
          }} />
      </div>

      {/* 링크 추가 폼 */}
      {showLinkForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="font-medium text-slate-700 text-sm">링크 추가</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setLinkForm(f => ({ ...f, category: c }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  linkForm.category === c ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
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
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filterCategory === 'all' ? 'bg-blue-500 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            전체 {items.length}
          </button>
          {categories.filter(c => categoryCounts[c]).map(c => (
            <button
              key={c}
              onClick={() => setFilterCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filterCategory === c ? 'bg-blue-500 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {getCategoryEmoji(c)} {c} {categoryCounts[c]}
            </button>
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {items.length === 0 && !showLinkForm && (
        <div className="text-center py-12 text-slate-400">
          <div className="text-3xl mb-2">📌</div>
          <p>아직 준비 자료가 없어요</p>
          <p className="text-sm mt-1">링크나 사진을 추가해보세요!</p>
        </div>
      )}

      {/* 링크 목록 */}
      {filteredLinks.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-700 text-sm mb-2">🔗 링크 ({filteredLinks.length})</h3>
          <div className="space-y-2">
            {filteredLinks.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-start gap-3">
                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-lg shrink-0">
                  {getCategoryEmoji(item.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{item.category}</span>
                  </div>
                  <a href={item.url!} target="_blank" rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline text-sm truncate block">
                    {item.title || item.url}
                  </a>
                  {item.url && item.title && <p className="text-xs text-slate-400 truncate mt-0.5">{item.url}</p>}
                  {item.memo && <p className="text-xs text-slate-500 mt-1">{item.memo}</p>}
                </div>
                <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-400 text-sm shrink-0">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 레퍼런스 사진 */}
      {filteredImages.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-700 text-sm mb-2">📷 사진 ({filteredImages.length})</h3>
          <div className="grid grid-cols-2 gap-2">
            {filteredImages.map(item => (
              <div
                key={item.id}
                onClick={() => openImageDetail(item)}
                className="relative group rounded-xl overflow-hidden aspect-square bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
              >
                <img src={item.image_url!} alt={item.title || ''} className="w-full h-full object-cover" />
                <div className="absolute bottom-1 left-1 bg-black/40 rounded-full px-1.5 py-0.5 text-xs text-white">
                  {getCategoryEmoji(item.category)} {item.category}
                </div>
                {item.memo && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">
                    {item.memo}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 사진 상세 모달 */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <img src={selectedImage.image_url!} alt="" className="w-full max-h-64 object-cover" />
            <div className="p-4 space-y-3">
              {/* 카테고리 선택 */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">카테고리</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditCategory(c)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        editCategory === c ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {getCategoryEmoji(c)} {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* 설명 입력 */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">설명</p>
                <input
                  type="text"
                  value={editMemo}
                  onChange={e => setEditMemo(e.target.value)}
                  placeholder="이 사진에 대한 메모를 입력해주세요"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
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
              <input
                type="text"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCategory()}
                placeholder="새 카테고리 이름"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
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
