'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function createTrip() {
    if (!title.trim()) {
      setError('여행 이름을 입력해주세요')
      return
    }
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
      const message = e instanceof Error ? e.message : '오류가 발생했습니다'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">✈️</div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">여행 플래너</h1>
          <p className="text-slate-500">친구들과 함께 계획하고 기록하세요</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-700">새 여행 만들기</h2>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              여행 이름 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 오사카 3박 4일"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              한 줄 설명 (선택)
            </label>
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

        <p className="text-center text-slate-400 text-sm mt-4">
          만들면 방장 링크와 멤버 초대 링크가 생성됩니다
        </p>
      </div>
    </main>
  )
}
