'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface SavedTrip {
  id: string
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  admin_token: string
  member_token: string
  created_at: string
}

const DEVICE_ID_KEY = 'travel_planner_device_id'
const TOKENS_KEY = 'travel_planner_admin_tokens'

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

function getSavedTokens(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(TOKENS_KEY) || '[]') } catch { return [] }
}

function persistToken(token: string) {
  if (typeof window === 'undefined' || !token) return
  const tokens = getSavedTokens()
  if (!tokens.includes(token)) {
    localStorage.setItem(TOKENS_KEY, JSON.stringify([...tokens, token]))
  }
}

function forgetToken(token: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKENS_KEY, JSON.stringify(getSavedTokens().filter(t => t !== token)))
}

export default function HomePage() {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([])
  const [tripsLoading, setTripsLoading] = useState(true)
  const [copied, setCopied] = useState<{ id: string; type: string } | null>(null)

  // 수정 모달 상태
  const [editTrip, setEditTrip] = useState<SavedTrip | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    loadTripsFromSupabase()
  }, [])

  async function loadTripsFromSupabase() {
    setTripsLoading(true)
    const deviceId = getOrCreateDeviceId()
    const savedTokens = getSavedTokens()

    const SELECT = 'id, title, description, start_date, end_date, admin_token, member_token, created_at'

    async function fetchByDevice(): Promise<SavedTrip[]> {
      if (!deviceId) return []
      const { data, error } = await supabase
        .from('trips').select(SELECT).eq('device_id', deviceId).order('created_at', { ascending: false })
      return error ? [] : (data as SavedTrip[] || [])
    }

    async function fetchByToken(): Promise<SavedTrip[]> {
      if (savedTokens.length === 0) return []
      const { data } = await supabase
        .from('trips').select(SELECT).in('admin_token', savedTokens).order('created_at', { ascending: false })
      return (data as SavedTrip[] || [])
    }

    const [byDevice, byToken] = await Promise.all([fetchByDevice(), fetchByToken()])

    const merged = [...byDevice, ...byToken]
    const unique = merged
      .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // 기존 token 중 DB에서 찾은 것들을 localStorage에 동기화
    unique.forEach(t => persistToken(t.admin_token))

    setSavedTrips(unique)
    setTripsLoading(false)
  }

  async function createTrip() {
    if (!title.trim()) {
      setError('여행 이름을 입력해주세요')
      return
    }
    setLoading(true)
    setError('')
    try {
      const deviceId = getOrCreateDeviceId()

      // device_id 컬럼이 있으면 포함, 없으면 없이 시도
      let data = null
      let dbError = null

      const withDevice = await supabase
        .from('trips')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          device_id: deviceId,
        })
        .select()
        .single()

      if (withDevice.error?.code === 'PGRST204' || withDevice.error?.message?.includes('device_id')) {
        // device_id 컬럼이 없는 경우 없이 재시도
        const withoutDevice = await supabase
          .from('trips')
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            start_date: startDate || null,
            end_date: endDate || null,
          })
          .select()
          .single()
        data = withoutDevice.data
        dbError = withoutDevice.error
      } else {
        data = withDevice.data
        dbError = withDevice.error
      }

      if (dbError) throw dbError

      persistToken(data.admin_token)

      setTitle('')
      setDescription('')
      setStartDate('')
      setEndDate('')
      setShowForm(false)

      router.push(`/trip/${data.admin_token}?role=admin`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '오류가 발생했습니다'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  function copyLink(trip: SavedTrip, type: 'admin' | 'member') {
    const token = type === 'admin' ? trip.admin_token : trip.member_token
    const url = `${window.location.origin}/trip/${token}${type === 'admin' ? '?role=admin' : ''}`
    navigator.clipboard.writeText(url)
    setCopied({ id: trip.id, type })
    setTimeout(() => setCopied(null), 2000)
  }

  function openEdit(trip: SavedTrip) {
    setEditTrip(trip)
    setEditTitle(trip.title)
    setEditDescription(trip.description ?? '')
    setEditStartDate(trip.start_date ?? '')
    setEditEndDate(trip.end_date ?? '')
    setEditError('')
  }

  function closeEdit() {
    setEditTrip(null)
    setEditError('')
  }

  async function saveEdit() {
    if (!editTrip) return
    if (!editTitle.trim()) {
      setEditError('여행 이름을 입력해주세요')
      return
    }
    setEditLoading(true)
    setEditError('')
    try {
      const { error: dbError } = await supabase
        .from('trips')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          start_date: editStartDate || null,
          end_date: editEndDate || null,
        })
        .eq('id', editTrip.id)

      if (dbError) throw dbError

      setSavedTrips((prev: SavedTrip[]) => prev.map((t: SavedTrip) =>
        t.id === editTrip.id
          ? { ...t, title: editTitle.trim(), description: editDescription.trim() || null, start_date: editStartDate || null, end_date: editEndDate || null }
          : t
      ))
      closeEdit()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '저장 중 오류가 발생했습니다'
      setEditError(message)
    } finally {
      setEditLoading(false)
    }
  }

  async function deleteFromList(trip: SavedTrip) {
    if (!confirm('목록에서 제거할까요?\n(여행 데이터는 삭제되지 않습니다)')) return
    await supabase.from('trips').update({ device_id: null }).eq('id', trip.id)
    forgetToken(trip.admin_token)
    setSavedTrips((prev: SavedTrip[]) => prev.filter((t: SavedTrip) => t.id !== trip.id))
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col items-center p-4 pt-10">
      <div className="w-full max-w-md">

        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">✈️</div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">여행 플래너</h1>
          <p className="text-slate-500">친구들과 함께 계획하고 기록하세요</p>
        </div>

        {/* 새 여행 만들기 버튼 / 폼 */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-2xl py-4 text-lg transition-colors shadow-md"
          >
            + 새 여행 만들기
          </button>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-700">새 여행 만들기</h2>
              <button onClick={() => { setShowForm(false); setError('') }} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                여행 이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createTrip()}
                placeholder="예: 오사카 3박 4일"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">한 줄 설명 (선택)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="예: 벚꽃 시즌 4명 여행"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">출발일</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">귀국일</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              onClick={createTrip}
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold rounded-xl py-3 transition-colors"
            >
              {loading ? '만드는 중...' : '여행 만들기 🚀'}
            </button>
          </div>
        )}

        {/* 내 여행 목록 */}
        <div className="mt-8">
          {tripsLoading ? (
            <div className="text-center py-6 text-slate-400 text-sm">불러오는 중...</div>
          ) : savedTrips.length > 0 ? (
            <>
              <h2 className="text-lg font-semibold text-slate-700 mb-3">
                내 여행 목록
                <span className="text-slate-400 font-normal text-sm ml-2">({savedTrips.length}개)</span>
              </h2>
              <div className="space-y-3">
                {savedTrips.map((trip) => (
                  <div key={trip.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 text-base truncate">{trip.title}</p>
                        {trip.description && (
                          <p className="text-sm text-slate-400 truncate mt-0.5">{trip.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(trip)}
                          className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"
                          title="여행 정보 수정"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteFromList(trip)}
                          className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                          title="목록에서 제거"
                        >
                          🗑️
                        </button>
                        <button
                          onClick={() => router.push(`/trip/${trip.admin_token}?role=admin`)}
                          className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"
                          title="여행 열기"
                        >
                          →
                        </button>
                      </div>
                    </div>

                    {(trip.start_date || trip.end_date) && (
                      <p className="text-xs text-slate-400 mb-3">
                        📅 {formatDate(trip.start_date)}
                        {trip.start_date && trip.end_date && ' ~ '}
                        {formatDate(trip.end_date)}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => copyLink(trip, 'admin')}
                        className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 py-2 rounded-xl transition-colors"
                      >
                        {copied?.id === trip.id && copied.type === 'admin' ? '✅ 복사됨!' : '방장 링크 복사'}
                      </button>
                      <button
                        onClick={() => copyLink(trip, 'member')}
                        className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 py-2 rounded-xl transition-colors"
                      >
                        {copied?.id === trip.id && copied.type === 'member' ? '✅ 복사됨!' : '멤버 링크 복사'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          방장 링크는 본인만 보관하세요 · 멤버 링크는 친구들과 공유하세요
        </p>
      </div>

      {/* 수정 모달 */}
      {editTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-lg">여행 정보 수정</h3>
              <button onClick={closeEdit} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                여행 이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">한 줄 설명</label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="선택 사항"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">출발일</label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">귀국일</label>
                <input
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
            </div>

            {editError && (
              <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{editError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={closeEdit}
                className="flex-1 border border-slate-200 text-slate-600 font-medium rounded-xl py-3 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveEdit}
                disabled={editLoading}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold rounded-xl py-3 transition-colors"
              >
                {editLoading ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
