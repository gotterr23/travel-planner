'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Trip, Schedule, Photo } from '@/lib/types'

interface Props {
  trip: Trip
  isAdmin: boolean
  focusScheduleId?: string | null
  onFocusHandled?: () => void
}

export default function AlbumTab({ trip, focusScheduleId, onFocusHandled }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Photo | null>(null)
  const [uploading, setUploading] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const [showCatManage, setShowCatManage] = useState(false)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState('')

  const uploadTargetRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadAll() }, [trip.id])

  useEffect(() => {
    if (!loading && focusScheduleId) {
      setHighlightedId(focusScheduleId)
      onFocusHandled?.()
      setTimeout(() => {
        document.getElementById(`album-cat-${focusScheduleId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
      setTimeout(() => setHighlightedId(null), 2500)
    }
  }, [loading, focusScheduleId])

  async function loadAll() {
    const [{ data: sData }, { data: pData }] = await Promise.all([
      supabase.from('schedules').select('*').eq('trip_id', trip.id)
        .order('date', { ascending: true }).order('order_index', { ascending: true }),
      supabase.from('photos').select('*').eq('trip_id', trip.id)
        .order('created_at', { ascending: false }),
    ])
    setSchedules(sData || [])
    setPhotos(pData || [])
    setLoading(false)
  }

  async function uploadPhotos(files: FileList, scheduleId: string | null) {
    setUploading(true)
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const fileName = `${trip.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('photos').upload(fileName, file)
      if (!error) {
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName)
        await supabase.from('photos').insert({
          trip_id: trip.id,
          image_url: urlData.publicUrl,
          schedule_id: scheduleId,
        })
      }
    }
    setUploading(false)
    loadAll()
  }

  async function deletePhoto(photo: Photo) {
    if (!confirm('이 사진을 삭제할까요?')) return
    await supabase.from('photos').delete().eq('id', photo.id)
    setSelected(null)
    loadAll()
  }

  async function saveCatName() {
    if (!editingCatId || !editingCatName.trim()) { setEditingCatId(null); return }
    await supabase.from('schedules').update({ place_name: editingCatName.trim() }).eq('id', editingCatId)
    setEditingCatId(null)
    loadAll()
  }

  function triggerUpload(scheduleId: string | null) {
    uploadTargetRef.current = scheduleId
    fileInputRef.current?.click()
  }

  function getPhotosFor(scheduleId: string | null) {
    return photos.filter(p => (p.schedule_id ?? null) === scheduleId)
  }

  if (loading) return <div className="text-center py-12 text-slate-400">불러오는 중...</div>

  const categories = [
    ...schedules.map(s => ({ id: s.id, label: s.place_name, isSchedule: true })),
    { id: null as null, label: '기타', isSchedule: false },
  ]
  const hasPhotos = photos.length > 0

  return (
    <div className="space-y-4">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-700">
          여행 앨범
          {hasPhotos && <span className="text-slate-400 font-normal text-sm ml-1">({photos.length}장)</span>}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCatManage(true)}
            className="text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            카테고리 관리
          </button>
          <button
            onClick={() => triggerUpload(null)}
            disabled={uploading}
            className="text-sm text-white bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            {uploading ? '업로드 중...' : '+ 사진 추가'}
          </button>
        </div>
      </div>

      {/* 빈 상태 — 사진 없을 때 */}
      {!hasPhotos ? (
        <div
          onClick={() => triggerUpload(null)}
          className="border-2 border-dashed border-slate-200 rounded-2xl py-20 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors"
        >
          <div className="text-5xl mb-4">📸</div>
          <p className="font-semibold text-base">사진을 업로드해보세요</p>
          <p className="text-sm mt-1.5">여러 장 한 번에 선택 가능해요</p>
        </div>
      ) : (
        /* 카테고리별 사진 목록 */
        <div className="space-y-3">
          {categories.map(cat => {
            const catPhotos = getPhotosFor(cat.id)
            if (!cat.isSchedule && catPhotos.length === 0) return null
            const isHighlighted = highlightedId === cat.id
            return (
              <div
                key={cat.id ?? '__other__'}
                id={cat.id ? `album-cat-${cat.id}` : undefined}
                className={`rounded-xl border overflow-hidden transition-all duration-300 ${
                  isHighlighted ? 'border-purple-400 shadow-lg shadow-purple-100 bg-white' : 'border-slate-200 bg-white'
                }`}
              >
                <div className={`px-4 py-2.5 flex items-center gap-2 transition-colors duration-300 ${isHighlighted ? 'bg-purple-50' : 'bg-slate-50'}`}>
                  <span className="text-sm shrink-0">{cat.isSchedule ? '📍' : '📌'}</span>
                  <span className="flex-1 font-semibold text-sm text-slate-700 truncate">
                    {cat.label}
                    {catPhotos.length > 0 && (
                      <span className="font-normal text-slate-400 ml-1">({catPhotos.length}장)</span>
                    )}
                  </span>
                  <button
                    onClick={() => triggerUpload(cat.id)}
                    disabled={uploading}
                    className="text-xs text-white bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 px-3 py-1 rounded-lg transition-colors shrink-0"
                  >
                    {uploading ? '...' : '+ 사진'}
                  </button>
                </div>

                {catPhotos.length === 0 ? (
                  <div
                    onClick={() => triggerUpload(cat.id)}
                    className="py-8 text-center text-slate-300 text-sm cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="text-2xl mb-1">📸</div>
                    <p>사진을 추가해보세요</p>
                  </div>
                ) : (
                  <div className="p-2 grid grid-cols-3 gap-1.5">
                    {catPhotos.map(photo => (
                      <div
                        key={photo.id}
                        onClick={() => setSelected(photo)}
                        className="aspect-square rounded-lg overflow-hidden bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
                      >
                        <img src={photo.image_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    <div
                      onClick={() => triggerUpload(cat.id)}
                      className="aspect-square rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors"
                    >
                      <span className="text-xl">+</span>
                      <span className="text-xs mt-0.5">추가</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 공통 파일 인풋 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files?.length) uploadPhotos(e.target.files, uploadTargetRef.current ?? null)
          e.target.value = ''
        }}
      />

      {/* 카테고리 관리 모달 */}
      {showCatManage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">카테고리 관리</h3>
              <button onClick={() => { setShowCatManage(false); setEditingCatId(null) }} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <p className="text-xs text-slate-400">일정 탭에서 장소를 추가하면 앨범 카테고리가 자동 생성됩니다</p>
            {schedules.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">일정을 먼저 추가해주세요</p>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1">
                {schedules.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-base">📍</span>
                    {editingCatId === s.id ? (
                      <input
                        autoFocus
                        value={editingCatName}
                        onChange={e => setEditingCatName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveCatName(); if (e.key === 'Escape') setEditingCatId(null) }}
                        onBlur={saveCatName}
                        className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-sm focus:outline-none"
                      />
                    ) : (
                      <span className="flex-1 text-sm font-medium text-slate-700">{s.place_name}</span>
                    )}
                    {editingCatId !== s.id && (
                      <button
                        onClick={() => { setEditingCatId(s.id); setEditingCatName(s.place_name) }}
                        className="text-sm text-slate-400 hover:text-blue-500 transition-colors"
                      >
                        수정
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => { setShowCatManage(false); setEditingCatId(null) }}
              className="w-full border border-slate-200 text-slate-600 font-medium py-3 rounded-xl hover:bg-slate-50"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 사진 확대 모달 */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <img src={selected.image_url} alt="" className="w-full rounded-xl" />
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                onClick={() => deletePhoto(selected)}
                className="bg-red-500 text-white text-sm px-3 py-1.5 rounded-lg font-medium"
              >
                삭제
              </button>
              <button
                onClick={() => setSelected(null)}
                className="bg-black/50 text-white text-sm px-3 py-1.5 rounded-lg"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
