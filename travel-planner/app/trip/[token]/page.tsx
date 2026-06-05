'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Trip } from '@/lib/types'
import ScheduleTab from '@/components/tabs/ScheduleTab'
import MapTab from '@/components/tabs/MapTab'
import BoardTab from '@/components/tabs/BoardTab'
import AlbumTab from '@/components/tabs/AlbumTab'
import BudgetTab from '@/components/tabs/BudgetTab'

type Tab = 'schedule' | 'map' | 'board' | 'album' | 'budget'

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: 'schedule', label: '일정', emoji: '📅' },
  { key: 'map', label: '지도', emoji: '🗺️' },
  { key: 'board', label: '준비 보드', emoji: '📌' },
  { key: 'album', label: '앨범', emoji: '📸' },
  { key: 'budget', label: '예산', emoji: '💰' },
]

export default function TripPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params.token as string
  const role = searchParams.get('role') === 'admin' ? 'admin' : 'member'

  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('schedule')
  const [showShareModal, setShowShareModal] = useState(false)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    async function loadTrip() {
      const column = role === 'admin' ? 'admin_token' : 'member_token'
      const { data } = await supabase
        .from('trips')
        .select('*')
        .eq(column, token)
        .single()

      if (!data) {
        // admin_token으로 못 찾으면 member_token으로도 시도
        const { data: data2 } = await supabase
          .from('trips')
          .select('*')
          .eq('member_token', token)
          .single()
        if (!data2) {
          setNotFound(true)
        } else {
          setTrip(data2)
        }
      } else {
        setTrip(data)
      }
      setLoading(false)
    }
    loadTrip()
  }, [token, role])

  function copyLink(type: 'admin' | 'member') {
    if (!trip) return
    const t = type === 'admin' ? trip.admin_token : trip.member_token
    const url = `${window.location.origin}/trip/${t}${type === 'admin' ? '?role=admin' : ''}`
    navigator.clipboard.writeText(url)
    setCopied(type)
    setTimeout(() => setCopied(''), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center text-slate-500">
          <div className="text-4xl mb-3">✈️</div>
          <p>불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (notFound || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center text-slate-500">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-semibold text-lg">여행을 찾을 수 없어요</p>
          <p className="text-sm mt-1">링크가 올바른지 확인해주세요</p>
        </div>
      </div>
    )
  }

  const isAdmin = role === 'admin' || trip.admin_token === token

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-slate-800 text-lg leading-tight">{trip.title}</h1>
            {(trip.start_date || trip.end_date) && (
              <p className="text-xs text-slate-400 mt-0.5">
                {trip.start_date && new Date(trip.start_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                {trip.start_date && trip.end_date && ' ~ '}
                {trip.end_date && new Date(trip.end_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <span className="bg-blue-100 text-blue-600 text-xs font-medium px-2 py-1 rounded-full">방장</span>
            )}
            <button
              onClick={() => setShowShareModal(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              공유
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div className="max-w-2xl mx-auto px-4 flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* 탭 콘텐츠 */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4">
        {activeTab === 'schedule' && <ScheduleTab trip={trip} isAdmin={isAdmin} />}
        {activeTab === 'map' && <MapTab trip={trip} />}
        {activeTab === 'board' && <BoardTab trip={trip} isAdmin={isAdmin} />}
        {activeTab === 'album' && <AlbumTab trip={trip} isAdmin={isAdmin} />}
        {activeTab === 'budget' && <BudgetTab trip={trip} isAdmin={isAdmin} />}
      </main>

      {/* 공유 모달 */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-lg">링크 공유</h3>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            {isAdmin && (
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-blue-700 text-sm">방장 링크</span>
                  <span className="text-xs text-blue-500">모든 권한</span>
                </div>
                <p className="text-xs text-blue-600 mb-3">여행 삭제, 멤버 관리 가능. 본인만 보관하세요!</p>
                <button
                  onClick={() => copyLink('admin')}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >
                  {copied === 'admin' ? '✅ 복사됨!' : '방장 링크 복사'}
                </button>
              </div>
            )}

            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-700 text-sm">멤버 초대 링크</span>
                <span className="text-xs text-slate-500">편집 가능</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">일정, 사진, 준비보드, 예산 모두 편집 가능해요</p>
              <button
                onClick={() => copyLink('member')}
                className="w-full bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {copied === 'member' ? '✅ 복사됨!' : '멤버 링크 복사'}
              </button>
            </div>

            <p className="text-xs text-slate-400 text-center">링크를 받은 사람은 누구든 접근할 수 있어요</p>
          </div>
        </div>
      )}
    </div>
  )
}
