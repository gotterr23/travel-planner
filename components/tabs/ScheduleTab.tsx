'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Trip, Schedule } from '@/lib/types'


interface Props {
  trip: Trip
  isAdmin: boolean
}

export default function ScheduleTab({ trip, isAdmin: _isAdmin }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    date: trip.start_date || '',
    place_name: '',
    address: '',
    time: '',
    memo: '',
    participants: '',
  })

  useEffect(() => {
    loadSchedules()
  }, [trip.id])

  async function loadSchedules() {
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('trip_id', trip.id)
      .order('date', { ascending: true })
    const sorted = (data || []).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      if (a.time && b.time) return a.time.localeCompare(b.time)
      if (a.time) return -1
      if (b.time) return 1
      return a.order_index - b.order_index
    })
    setSchedules(sorted)
    setLoading(false)
  }

  async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!window.kakao?.maps?.services) { resolve(null); return }
      const geocoder = new window.kakao.maps.services.Geocoder()
      geocoder.addressSearch(address, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK && result[0]) {
          resolve({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) })
        } else resolve(null)
      })
    })
  }

  async function saveSchedule() {
    if (!form.place_name.trim()) return

    let coords: { lat: number; lng: number } | null = null
    if (form.address.trim()) {
      coords = await geocodeAddress(form.address.trim())
    }

    if (editingId) {
      await supabase.from('schedules').update({
        date: form.date,
        place_name: form.place_name.trim(),
        address: form.address.trim() || null,
        latitude: coords?.lat || null,
        longitude: coords?.lng || null,
        time: form.time || null,
        memo: form.memo.trim() || null,
        participants: form.participants.trim() || null,
      }).eq('id', editingId)
    } else {
      const sameDay = schedules.filter(s => s.date === form.date)
      await supabase.from('schedules').insert({
        trip_id: trip.id,
        date: form.date,
        place_name: form.place_name.trim(),
        address: form.address.trim() || null,
        latitude: coords?.lat || null,
        longitude: coords?.lng || null,
        time: form.time || null,
        memo: form.memo.trim() || null,
        participants: form.participants.trim() || null,
        order_index: sameDay.length,
      })
    }

    resetForm()
    loadSchedules()
  }

  async function deleteSchedule(id: string) {
    if (!confirm('이 일정을 삭제할까요?')) return
    await supabase.from('schedules').delete().eq('id', id)
    loadSchedules()
  }

  function startEdit(s: Schedule) {
    setForm({ date: s.date, place_name: s.place_name, address: s.address || '', time: s.time || '', memo: s.memo || '', participants: s.participants || '' })
    setEditingId(s.id)
    setShowForm(true)
  }

  function resetForm() {
    setForm({ date: trip.start_date || '', place_name: '', address: '', time: '', memo: '', participants: '' })
    setEditingId(null)
    setShowForm(false)
  }

  // 날짜별로 그룹화
  const grouped: Record<string, Schedule[]> = {}
  schedules.forEach(s => {
    if (!grouped[s.date]) grouped[s.date] = []
    grouped[s.date].push(s)
  })

  const getDayLabel = (dateStr: string, index: number) => {
    const date = new Date(dateStr)
    const label = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
    return `Day ${index + 1} · ${label}`
  }

  const sortedDates = Object.keys(grouped).sort()

  if (loading) return <div className="text-center py-12 text-slate-400">불러오는 중...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-slate-700">여행 일정</h2>
        <button
          onClick={() => { setShowForm(true); setEditingId(null) }}
          className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          + 일정 추가
        </button>
      </div>

      {/* 추가/수정 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h3 className="font-medium text-slate-700">{editingId ? '일정 수정' : '새 일정'}</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">날짜</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">시간 (선택)</label>
              <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">장소 이름 *</label>
            <input type="text" value={form.place_name} onChange={e => setForm(f => ({ ...f, place_name: e.target.value }))}
              placeholder="예: 도톤보리" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">주소 (선택)</label>
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="예: 오사카시 주오구 도톤보리" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">참여 인원 (선택)</label>
            <input type="text" value={form.participants} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))}
              placeholder="예: 전체 인원 / 시원, 민정" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">메모 (선택)</label>
            <textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
              placeholder="예: 예약 필요, 저녁 7시" rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveSchedule} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {editingId ? '수정 완료' : '추가'}
            </button>
            <button onClick={resetForm} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium py-2 rounded-lg transition-colors">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 날짜별 일정 목록 */}
      {sortedDates.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <div className="text-3xl mb-2">📅</div>
          <p>아직 일정이 없어요</p>
          <p className="text-sm mt-1">위에서 일정을 추가해보세요!</p>
        </div>
      ) : (
        sortedDates.map((date, dayIndex) => (
          <div key={date} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-blue-50 px-4 py-2.5">
              <p className="text-sm font-semibold text-blue-700">{getDayLabel(date, dayIndex)}</p>
            </div>
            <div className="divide-y divide-slate-100">
              {grouped[date].map((s, idx) => (
                <div key={s.id} className="px-4 py-3 flex gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                    {idx < grouped[date].length - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-1" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-800">{s.place_name}</p>
                        {s.time && <p className="text-xs text-slate-400 mt-0.5">🕐 {s.time}</p>}
                        {s.address && <p className="text-xs text-slate-400 mt-0.5">📍 {s.address}</p>}
                        {s.participants && <p className="text-xs text-slate-400 mt-0.5">👥 {s.participants}</p>}
                        {s.memo && <p className="text-sm text-slate-500 mt-1 bg-slate-50 rounded-lg px-2 py-1">{s.memo}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => startEdit(s)} className="text-slate-400 hover:text-blue-500 text-sm p-1">✏️</button>
                        <button onClick={() => deleteSchedule(s.id)} className="text-slate-400 hover:text-red-500 text-sm p-1">🗑️</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
