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

  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState('')

  const uploadTargetRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadAll() }, [trip.id])

  // 일정 카드에서 이동해왔을 때 해당 카테고리로 스크롤 + 하이라이트
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
    if (!editingCatId) return
    if (editingCatName.trim()) {
      await supabase.from('schedules').update({ place_name: editingCatName.trim() }).eq('id', editingCatId)
    }
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

  function renderSection(scheduleId: string | null, label: string, isSchedule: boolean) {
    const catPhotos = getPhotosFor(scheduleId)
    const isEditing = isSchedule && editingCatId === scheduleId

    const isHighlighted = highlightedId === scheduleId

    return (
      <div
        id={scheduleId ? `album-cat-${scheduleId}` : undefined}
        className={`rounded-xl border overflow-hidden transition-all duration-300 ${
          isHighlighted
            ? 'border-purple-400 shadow-lg shadow-purple-100 bg-white'
            : 'border-slate-200 bg-white'
        }`}
      >
        {/* 카테고리 헤더 */}
        <div className={`px-4 py-2.5 flex items-center gap-2 transition-colors duration-300 ${isHighlighted ? 'bg-purple-50' : 'bg-slate-50'}`}>
          <span className="text-sm shrink-0">{isSchedule ? '📍' : '📌'}</span>
          {isEditing ? (
            <input
              autoFocus
              value={editingCatName}
              onChange={e => setEditingCatName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveCatName()
                if (e.key === 'Escape') setEditingCatId(null)
              }}
              onBlur={saveCatName}
              className="flex-1 border border-blue-300 rounded px-2 py-0.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          ) : (
            <span className="flex-1 font-semibold text-sm text-slate-700 truncate">
              {label}
              {catPhotos.length > 0 && (
                <span className="font-normal text-slate-400 ml-1">({catPhotos.length}장)</span>
              )}
            </span>
          )}
          <div className="flex items-center gap-1 shrink-0">
            {isSchedule && !isEditing && (
              <button
                onClick={() => { setEditingCatId(scheduleId!); setEditingCatName(label) }}
                className="text-xs text-slate-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                수정
              </button>
            )}
            <button
              onClick={() => triggerUpload(scheduleId)}
              disabled={uploading}
              className="text-xs text-white bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 px-3 py-1 rounded-lg transition-colors"
            >
              {uploading ? '...' : '+ 사진'}
            </button>
          </div>
        </div>

        {/* 사진 그리드 */}
        {catPhotos.length === 0 ? (
          <div
            onClick={() => triggerUpload(scheduleId)}
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
              onClick={() => triggerUpload(scheduleId)}
              className="aspect-square rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors"
            >
              <span className="text-xl">+</span>
              <span className="text-xs mt-0.5">추가</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div className="text-center py-12 text-slate-400">불러오는 중...</div>

  const categories = [
    ...schedules.map(s => ({ id: s.id, label: s.place_name, isSchedule: true })),
    { id: null as null, label: '기타', isSchedule: false },
  ]

  const hasContent = schedules.length > 0 || photos.length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-700">
          여행 앨범
          {photos.length > 0 && <span className="text-slate-400 font-normal ml-1">({photos.length}장)</span>}
        </h2>
        {schedules.length > 0 && (
          <span className="text-xs text-slate-400">{schedules.length}개 일정 카테고리</span>
        )}
      </div>

      {!hasContent ? (
        <div
          onClick={() => triggerUpload(null)}
          className="border-2 border-dashed border-slate-200 rounded-2xl py-16 flex flex-col items-center text-slate-400 cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors"
        >
          <div className="text-4xl mb-3">📸</div>
          <p className="font-medium">사진을 업로드해보세요</p>
          <p className="text-sm mt-1">일정 탭에서 장소를 추가하면 카테고리가 생성됩니다</p>
        </div>
      ) : (
        categories.map(cat => (
          <div key={cat.id ?? '__other__'}>
            {renderSection(cat.id, cat.label, cat.isSchedule)}
          </div>
        ))
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
