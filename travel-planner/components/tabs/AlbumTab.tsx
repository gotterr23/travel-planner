'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Trip, Photo } from '@/lib/types'

interface Props {
  trip: Trip
  isAdmin: boolean
}

export default function AlbumTab({ trip, isAdmin: _isAdmin }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<Photo | null>(null)
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

  async function uploadPhotos(files: FileList) {
    setUploading(true)
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const fileName = `${trip.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('photos').upload(fileName, file)
      if (!error) {
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName)
        await supabase.from('photos').insert({ trip_id: trip.id, image_url: urlData.publicUrl })
      }
    }
    setUploading(false)
    loadPhotos()
  }

  async function deletePhoto(photo: Photo) {
    if (!confirm('이 사진을 삭제할까요?')) return
    await supabase.from('photos').delete().eq('id', photo.id)
    setSelected(null)
    loadPhotos()
  }

  if (loading) return <div className="text-center py-12 text-slate-400">불러오는 중...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-slate-700">여행 앨범 {photos.length > 0 && <span className="text-slate-400 font-normal">({photos.length}장)</span>}</h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          {uploading ? '업로드 중...' : '+ 사진 추가'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { if (e.target.files?.length) uploadPhotos(e.target.files); e.target.value = '' }} />
      </div>

      {photos.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-2xl py-16 flex flex-col items-center text-slate-400 cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors"
        >
          <div className="text-4xl mb-3">📸</div>
          <p className="font-medium">사진을 업로드해보세요</p>
          <p className="text-sm mt-1">여러 장 한 번에 선택 가능해요</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map(photo => (
            <div
              key={photo.id}
              onClick={() => setSelected(photo)}
              className="aspect-square rounded-xl overflow-hidden bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <img src={photo.image_url} alt="" className="w-full h-full object-cover" />
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

      {/* 사진 확대 모달 */}
      {selected && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <img src={selected.image_url} alt="" className="w-full rounded-xl" />
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                onClick={() => deletePhoto(selected)}
                className="bg-red-500 text-white text-sm px-3 py-1.5 rounded-lg font-medium"
              >삭제</button>
              <button
                onClick={() => setSelected(null)}
                className="bg-black/50 text-white text-sm px-3 py-1.5 rounded-lg"
              >닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
