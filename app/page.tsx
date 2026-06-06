'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Trip } from '@/lib/types'

export default function HomePage() {
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[]>([])
  const [tripsLoading, setTripsLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadTrips()
  }, [])

  async function loadTrips() {
    const { data } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
    setTrips(data || [])
    setTripsLoading(false)
  }

  async function createTrip() {
    if (!title.trim()) { setError('여행 이름을 입력해주세요'); return }
    setLoading(true)
    setError('')
    try {
      const { data, error: dbError } = await supabase
        .from('trips')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
        })
        .select()
        .single()
      if (dbError) throw dbError
      router.push(`/trip/${data.admin_token}?role=admin`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md mx-auto py-8 space-y-6">

        {/* 헤더 */}
        <div className="text-center">
          <div className="text-5xl mb-3">✈️</div>
          <h1 className="text-3xl font-bold text-slate-800 mb-1">여행 플래너</h1>
          <p className="text-slate-500 text-sm">친구들과 함께 계획하고 기록하세요</p>
        </div>

        {/* 새 여행 만들기 버튼 */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-2xl py-4 transition-colors flex items-center justify-center gap-2 shadow-md"
        >
          <span className="text-xl">+</span>
          새 여행 만들기
        </button>

        {/* 여행 생성 폼 */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-700">새 여행 정보</h2>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                여행 이름 <span className="text-red-400">*</span>
              </label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="예: 오사카 3박 4일"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">한 줄 설명 (선택)</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="예: 벚꽃 시즌 4명 여행"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">출발일</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">귀국일</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2">
              <button onClick={createTrip} disabled={loading}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold rounded-xl py-3 transition-colors">
                {loading ? '만드는 중...' : '여행 만들기 🚀'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl py-3 transition-colors">
                취소
              </button>
            </div>
          </div>
        )}

        {/* 여행 목록 */}
        <div>
          <h2 className="font-semibold text-slate-700 mb-3">
            내 여행 목록
            {!tripsLoading && trips.length > 0 && (
              <span className="text-slate-400 font-normal text-sm ml-2">({trips.length}개)</span>
            )}
          </h2>

          {tripsLoading ? (
            <div className="text-center py-8 text-slate-400 text-sm">불러오는 중...</div>
          ) : trips.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
              <div className="text-3xl mb-2">🗺️</div>
              <p className="text-sm">아직 여행이 없어요</p>
              <p className="text-xs mt-1">위에서 새 여행을 만들어보세요!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map(trip => (
                <div key={trip.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/trip/${trip.admin_token}?role=admin`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate">{trip.title}</h3>
                      {trip.description && (
                        <p className="text-sm text-slate-500 mt-0.5 truncate">{trip.description}</p>
                      )}
                      {(trip.start_date || trip.end_date) && (
                        <p className="text-xs text-slate-400 mt-1">
                          📅 {formatDate(trip.start_date)}
                          {trip.start_date && trip.end_date && ' ~ '}
                          {formatDate(trip.end_date)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (!confirm(`"${trip.title}" 여행을 삭제할까요?\n일정, 사진, 예산 등 모든 데이터가 삭제됩니다.`)) return
                          supabase.from('trips').delete().eq('id', trip.id).then(() => loadTrips())
                        }}
                        className="text-slate-300 hover:text-red-400 transition-colors p-1"
                      >
                        🗑️
                      </button>
                      <span className="text-blue-400 text-lg">→</span>
                    </div>
                  </div>

                  {/* 링크 */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        navigator.clipboard.writeText(`${window.location.origin}/trip/${trip.admin_token}?role=admin`)
                        alert('방장 링크가 복사됐어요!')
                      }}
                      className="flex-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium py-1.5 rounded-lg transition-colors"
                    >
                      방장 링크 복사
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        navigator.clipboard.writeText(`${window.location.origin}/trip/${trip.member_token}`)
                        alert('멤버 링크가 복사됐어요!')
                      }}
                      className="flex-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-1.5 rounded-lg transition-colors"
                    >
                      멤버 링크 복사
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
