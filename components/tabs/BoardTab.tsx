'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Trip, ReferenceItem } from '@/lib/types'

interface Props {
  trip: Trip
  isAdmin: boolean
}

export default function BoardTab({ trip, isAdmin: _isAdmin }: Props) {
  const [items, setItems] = useState<ReferenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [linkForm, setLinkForm] = useState({ title: '', url: '', memo: '' })

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
    })
    setLinkForm({ title: '', url: '', memo: '' })
    setShowLinkForm(false)
    loadItems()
  }

  async function uploadImage(file: File) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const fileName = `${trip.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('references')
      .upload(fileName, file)

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('references').getPublicUrl(fileName)
      await supabase.from('reference_items').insert({
        trip_id: trip.id,
        type: 'image',
        image_url: urlData.publicUrl,
        title: file.name,
      })
      loadItems()
    }
    setUploading(false)
  }

  async function deleteItem(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('reference_items').delete().eq('id', id)
    loadItems()
  }

  const links = items.filter(i => i.type === 'link')
  const images = items.filter(i => i.type === 'image')

  if (loading) return <div className="text-center py-12 text-slate-400">불러오는 중...</div>

  return (
    <div className="space-y-5">
      {/* 액션 버튼 */}
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
          onChange={e => { const file = e.target.files?.[0]; if (file) uploadImage(file); e.target.value = '' }} />
      </div>

      {/* 링크 폼 */}
      {showLinkForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="font-medium text-slate-700 text-sm">링크 추가</h3>
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

      {/* 링크 목록 */}
      {links.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-700 text-sm mb-2">🔗 저장한 링크 ({links.length})</h3>
          <div className="space-y-2">
            {links.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-sm shrink-0">🔗</div>
                <div className="flex-1 min-w-0">
                  <a href={item.url!} target="_blank" rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline text-sm truncate block">
                    {item.title || item.url}
                  </a>
                  {item.url && item.title && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{item.url}</p>
                  )}
                  {item.memo && <p className="text-xs text-slate-500 mt-1">{item.memo}</p>}
                </div>
                <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-400 text-sm shrink-0">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 레퍼런스 사진 */}
      {images.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-700 text-sm mb-2">📷 레퍼런스 사진 ({images.length})</h3>
          <div className="grid grid-cols-2 gap-2">
            {images.map(item => (
              <div key={item.id} className="relative group rounded-xl overflow-hidden aspect-square bg-slate-100">
                <img src={item.image_url!} alt={item.title || ''} className="w-full h-full object-cover" />
                <button
                  onClick={() => deleteItem(item.id)}
                  className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && !showLinkForm && (
        <div className="text-center py-12 text-slate-400">
          <div className="text-3xl mb-2">📌</div>
          <p>아직 준비 자료가 없어요</p>
          <p className="text-sm mt-1">링크나 사진을 추가해보세요!</p>
        </div>
      )}
    </div>
  )
}
