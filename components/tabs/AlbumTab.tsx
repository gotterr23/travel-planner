'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Trip, Photo } from '@/lib/types'

interface Props {
  trip: Trip
  isAdmin: boolean
}

const DEFAULT_EMOJI: Record<string, string> = {
  풍경: '🏞️', 음식: '🍜', 숙소: '🏨', 교통: '✈️', 사람: '🤳', 기타: '📷',
  쇼핑: '🛍️', 액티비티: '🎡', 야경: '🌃', 카페: '☕',
}

function getCategoryEmoji(cat: string) {
  return DEFAULT_EMOJI[cat] || '📁'
}

const DEFAULT_CATEGORIES = ['풍경', '음식', '숙소', '교통', '사람', '기타']

export default function AlbumTab({ trip, isAdmin }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<Photo | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [uploadCategory, setUploadCategory] = useState<string>('기타')
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null)
  const [categories, setCategories] = useState<string[]>(
    trip.photo_categories?.length ? trip.photo_categories : DEFAULT_CATEGORIES
  )
  const [newCategoryName, setNewCategoryName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadPhotos()
  }, [trip.id])

  async function loadPhotos() {
    const { data } = await supabase
      .from('photos')
      .select('*')
      .eq('trip_id', trip.id)
      .order('created_at', { ascending: false })
    setPhotos(data || [])
    setLoading(false)
  }

  async function saveCategories(updated: string[]) {
    setCategories(updated)
    await supabase.from('trips').update({ photo_categories: updated }).eq('id', trip.id)
  }

  async function addCategory() {
    const name = newCategoryName.trim()
    if (!name || categories.includes(name)) return
    await saveCategories([...categories, name])
    setNewCategoryName('')
  }

  async function deleteCategory(cat: string) {
    if (!confirm(`"${cat}" 카테고리를 삭제할까요?\n이 카테고리의 사진은 삭제되지 않아요.`)) return
    const updated = categories.filter(c => c !== cat)
    await saveCategories(updated)
    if (filterCategory === cat) setFilterCategory('all')
  }

  function handleFileSelect(files: FileList) {
    setPendingFiles(files)
    setUploadCategory(categories[0] || '기타')
    setShowCategoryPicker(true)
  }

  async function uploadWithCategory() {
    if (!pendingFiles) return
    setUploading(true)
    setShowCategoryPicker(false)

    for (const file of Array.from(pendingFiles)) {
      const ext = file.name.split('.').pop()
      const fileName = `${trip.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('photos').upload(fileName, file)
      if (!error) {
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName)
        await supabase.from('photos').insert({
          trip_id: trip.id,
          image_url: urlData.publicUrl,
          category: uploadCategory,
        })
      }
    }

    setPendingFiles(null)
    setUploading(false)
    loadPhotos()
  }

  async function deletePhoto(photo: Photo) {
    if (!confirm('이 사진을 삭제할까요?')) return
    await supabase.from('photos').delete().eq('id', photo.id)
    setSelected(null)
    loadPhotos()
  }

  const filtered = filterCategory === 'all' ? photos : photos.filter(p => p.category === filterCategory)

  const categoryCounts: Record<string, number> = {}
  photos.forEach(p => {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1
  })

  if (loading) return <div className="text-center py-12 text-slate-400">불러오는 중...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-slate-700">
          여행 앨범 {photos.length > 0 && <span className="text-slate-400 font-normal">({photos.length}장)</span>}
        </h2>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowCategoryManager(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              카테고리 관리
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {uploading ? '업로드 중...' : '+ 사진 추가'}
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { if (e.target.files?.length) handleFileSelect(e.target.files); e.target.value = '' }} />
      </div>

      {/* 카테고리 필터 */}
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filterCategory === 'all' ? 'bg-blue-500 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            전체 {photos.length}
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

      {/* 사진 그리드 */}
      {filtered.length === 0 && photos.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-2xl py-16 flex flex-col items-center text-slate-400 cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors"
        >
          <div className="text-4xl mb-3">📸</div>
          <p className="font-medium">사진을 업로드해보세요</p>
          <p className="text-sm mt-1">여러 장 한 번에 선택 가능해요</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <div className="text-3xl mb-2">{getCategoryEmoji(filterCategory)}</div>
          <p>{filterCategory} 카테고리 사진이 없어요</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {filtered.map(photo => (
            <div
              key={photo.id}
              onClick={() => setSelected(photo)}
              className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <img src={photo.image_url} alt="" className="w-full h-full object-cover" />
              <div className="absolute bottom-1 left-1 bg-black/40 rounded-full px-1.5 py-0.5 text-xs text-white">
                {getCategoryEmoji(photo.category)}
              </div>
            </div>
          ))}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors"
          >
            <span className="text-2xl">+</span>
            <span className="text-xs mt-1">추가</span>
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

            {/* 새 카테고리 추가 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCategory()}
                placeholder="새 카테고리 이름 입력"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={addCategory}
                className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >추가</button>
            </div>

            {/* 카테고리 목록 */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {categories.map(cat => (
                <div key={cat} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCategoryEmoji(cat)}</span>
                    <span className="text-sm font-medium text-slate-700">{cat}</span>
                    {categoryCounts[cat] && (
                      <span className="text-xs text-slate-400">{categoryCounts[cat]}장</span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteCategory(cat)}
                    className="text-slate-300 hover:text-red-400 text-sm transition-colors"
                  >삭제</button>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-400 text-center">카테고리를 삭제해도 사진은 지워지지 않아요</p>
          </div>
        </div>
      )}

      {/* 카테고리 선택 모달 (업로드 전) */}
      {showCategoryPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-slate-800">어떤 카테고리인가요?</h3>
            <p className="text-sm text-slate-500">{pendingFiles?.length}장의 사진에 카테고리를 지정해주세요</p>
            <div className="grid grid-cols-3 gap-2">
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setUploadCategory(c)}
                  className={`py-3 rounded-xl text-sm font-medium transition-colors flex flex-col items-center gap-1 ${
                    uploadCategory === c ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <span className="text-xl">{getCategoryEmoji(c)}</span>
                  <span>{c}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={uploadWithCategory} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-xl">
                업로드
              </button>
              <button onClick={() => { setShowCategoryPicker(false); setPendingFiles(null) }} className="flex-1 bg-slate-100 text-slate-600 font-medium py-3 rounded-xl">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사진 확대 모달 */}
      {selected && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-sm font-medium">
                {getCategoryEmoji(selected.category)} {selected.category}
              </span>
              <div className="flex gap-2">
                <button onClick={() => deletePhoto(selected)} className="bg-red-500 text-white text-sm px-3 py-1.5 rounded-lg font-medium">삭제</button>
                <button onClick={() => setSelected(null)} className="bg-black/50 text-white text-sm px-3 py-1.5 rounded-lg">닫기</button>
              </div>
            </div>
            <img src={selected.image_url} alt="" className="w-full rounded-xl" />
          </div>
        </div>
      )}
    </div>
  )
}
