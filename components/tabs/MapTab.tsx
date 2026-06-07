'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Trip, Schedule } from '@/lib/types'

interface Props {
  trip: Trip
}

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void
        Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap
        LatLng: new (lat: number, lng: number) => KakaoLatLng
        LatLngBounds: new () => KakaoLatLngBounds
        Marker: new (options: { position: KakaoLatLng; map?: KakaoMap }) => KakaoMarker
        CustomOverlay: new (options: { position: KakaoLatLng; content: string; yAnchor?: number; map?: KakaoMap }) => KakaoCustomOverlay
        Polyline: new (options: { path: KakaoLatLng[]; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle: string }) => KakaoPolyline
        services: {
          Geocoder: new () => {
            addressSearch: (address: string, callback: (result: Array<{ x: string; y: string }>, status: string) => void) => void
          }
          Status: { OK: string }
        }
      }
    }
  }
}

interface KakaoMap {
  setCenter: (latlng: KakaoLatLng) => void
  setBounds: (bounds: KakaoLatLngBounds) => void
  setLevel: (level: number) => void
}
interface KakaoLatLng {
  getLat: () => number
  getLng: () => number
}
interface KakaoLatLngBounds {
  extend: (latlng: KakaoLatLng) => void
}
interface KakaoMarker {
  setMap: (map: KakaoMap | null) => void
}
interface KakaoCustomOverlay {
  setMap: (map: KakaoMap | null) => void
}
interface KakaoPolyline {
  setMap: (map: KakaoMap | null) => void
}

// 초 → "1시간 20분" 형식
function formatDuration(sec: number): string {
  const m = Math.round(sec / 60)
  if (m < 1) return '1분 미만'
  if (m < 60) return `${m}분`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest > 0 ? `${h}시간 ${rest}분` : `${h}시간`
}

// 구간(한 지점에서 다음 지점까지) 정보
interface RouteLeg { fromId: string; toId: string; duration: number; distance: number }

export default function MapTab({ trip }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('all')
  const mapInstanceRef = useRef<KakaoMap | null>(null)
  const geoCacheRef = useRef<Record<string, { lat: number; lng: number }>>({})
  // 일정 id → 좌표 (카드 클릭 시 해당 위치로 이동)
  const coordsRef = useRef<Record<string, { lat: number; lng: number }>>({})
  // 선택된 카드 (구간 시간 표시 + 강조)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  // 자동차 경로 요약 (카카오모빌리티). null이면 직선 표시 중
  const [routeInfo, setRouteInfo] = useState<{ duration: number; distance: number } | null>(null)
  // 구간별 소요시간
  const [routeLegs, setRouteLegs] = useState<RouteLeg[]>([])
  // 상단 배지 클릭 시 구간 코스 펼침
  const [showLegs, setShowLegs] = useState(false)
  // 경로선·전체영역 참조 (확대 시 경로 숨김 / 복원)
  const polylineRef = useRef<KakaoPolyline | null>(null)
  const boundsRef = useRef<KakaoLatLngBounds | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY

  useEffect(() => {
    loadSchedules()
  }, [trip.id])

  useEffect(() => {
    if (!apiKey || apiKey === '여기에_카카오맵_api_키_입력') return
    if (document.getElementById('kakao-map-script')) {
      if (window.kakao?.maps) setMapLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.id = 'kakao-map-script'
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services&autoload=false`
    script.onload = () => {
      try {
        window.kakao.maps.load(() => setMapLoaded(true))
      } catch {
        setMapError(true)
      }
    }
    script.onerror = () => setMapError(true)
    document.head.appendChild(script)
  }, [apiKey])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || schedules.length === 0) return
    initMap()
  }, [mapLoaded, schedules, selectedDate])

  // 날짜 전환 시 펼침·선택 초기화
  useEffect(() => { setShowLegs(false); setSelectedCardId(null) }, [selectedDate])

  async function loadSchedules() {
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('trip_id', trip.id)
      .order('date', { ascending: true })

    const sorted = [...(data || [])].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      if (a.time && b.time) return a.time.localeCompare(b.time)
      if (a.time) return -1
      if (b.time) return 1
      return a.order_index - b.order_index
    })
    setSchedules(sorted)
  }

  // 주소 → 좌표 변환 (캐시 사용)
  function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (geoCacheRef.current[address]) {
        resolve(geoCacheRef.current[address])
        return
      }
      try {
        const geocoder = new window.kakao.maps.services.Geocoder()
        geocoder.addressSearch(address, (result, status) => {
          if (status === window.kakao.maps.services.Status.OK && result[0]) {
            const coord = { lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) }
            geoCacheRef.current[address] = coord
            resolve(coord)
          } else {
            resolve(null)
          }
        })
      } catch {
        resolve(null)
      }
    })
  }

  async function initMap() {
    try {
      if (!mapRef.current) return

      const target = selectedDate === 'all'
        ? schedules
        : schedules.filter(s => s.date === selectedDate)

      // 각 일정의 좌표 확보 (저장된 좌표 우선, 없으면 주소로 지오코딩)
      const points: { schedule: Schedule; lat: number; lng: number }[] = []
      for (const s of target) {
        if (s.latitude && s.longitude) {
          points.push({ schedule: s, lat: s.latitude, lng: s.longitude })
        } else if (s.address) {
          const coord = await geocode(s.address)
          if (coord) points.push({ schedule: s, lat: coord.lat, lng: coord.lng })
        }
      }

      // 카드 클릭용 좌표 저장
      points.forEach(p => { coordsRef.current[p.schedule.id] = { lat: p.lat, lng: p.lng } })

      const center = points.length > 0
        ? new window.kakao.maps.LatLng(points[0].lat, points[0].lng)
        : new window.kakao.maps.LatLng(37.5665, 126.9780)

      const map = new window.kakao.maps.Map(mapRef.current, { center, level: 9 })
      mapInstanceRef.current = map

      if (points.length === 0) return

      const bounds = new window.kakao.maps.LatLngBounds()
      boundsRef.current = bounds

      points.forEach((p, idx) => {
        const pos = new window.kakao.maps.LatLng(p.lat, p.lng)
        new window.kakao.maps.Marker({ position: pos, map })
        const content = `<div style="padding:4px 8px;background:#fff;border:1px solid #3b82f6;border-radius:9999px;font-size:12px;font-weight:700;color:#1e293b;box-shadow:0 1px 3px rgba(0,0,0,0.15);white-space:nowrap;">${idx + 1}. ${p.schedule.place_name}</div>`
        const overlay = new window.kakao.maps.CustomOverlay({ position: pos, content, yAnchor: 2.2 })
        overlay.setMap(map)
        bounds.extend(pos)
      })

      // 경로 연결 — 자동차 실제 도로 경로(카카오모빌리티) 우선, 실패 시 직선
      polylineRef.current = null
      setRouteLegs([])
      if (points.length > 1) {
        let drawnByCar = false
        try {
          const res = await fetch('/api/directions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points: points.map(p => ({ lat: p.lat, lng: p.lng })) }),
          })
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data.path) && data.path.length > 1) {
              const path = data.path.map((c: { lat: number; lng: number }) => new window.kakao.maps.LatLng(c.lat, c.lng))
              const polyline = new window.kakao.maps.Polyline({
                path, strokeWeight: 5, strokeColor: '#3b82f6', strokeOpacity: 0.85, strokeStyle: 'solid',
              })
              polyline.setMap(map)
              polylineRef.current = polyline
              setRouteInfo({ duration: data.duration, distance: data.distance })
              // 구간(legs)을 일정 쌍과 매핑
              if (Array.isArray(data.legs) && data.legs.length === points.length - 1) {
                setRouteLegs(data.legs.map((leg: { duration: number; distance: number }, i: number) => ({
                  fromId: points[i].schedule.id,
                  toId: points[i + 1].schedule.id,
                  duration: leg.duration,
                  distance: leg.distance,
                })))
              }
              drawnByCar = true
            }
          }
        } catch { /* 네트워크 오류 → 직선 fallback */ }

        if (!drawnByCar) {
          // 직선 fallback (키 미설정·경로 없음 등)
          const path = points.map(p => new window.kakao.maps.LatLng(p.lat, p.lng))
          const polyline = new window.kakao.maps.Polyline({
            path, strokeWeight: 3, strokeColor: '#94a3b8', strokeOpacity: 0.7, strokeStyle: 'shortdash',
          })
          polyline.setMap(map)
          polylineRef.current = polyline
          setRouteInfo(null)
        }
        map.setBounds(bounds)
      } else {
        setRouteInfo(null)
      }
    } catch {
      setMapError(true)
    }
  }

  // 위치 카드 클릭 → 지도에서 해당 위치로 확대·이동 (경로선은 숨김)
  async function focusLocation(s: Schedule) {
    const map = mapInstanceRef.current
    if (!map || !window.kakao?.maps) return
    let c = coordsRef.current[s.id]
    if (!c && s.address) {
      const g = await geocode(s.address)
      if (g) { c = g; coordsRef.current[s.id] = g }
    }
    if (!c) return
    // 확대 시 경로선 숨김
    polylineRef.current?.setMap(null)
    setShowLegs(false)
    map.setCenter(new window.kakao.maps.LatLng(c.lat, c.lng))
    map.setLevel(3)
    setSelectedCardId(s.id)
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // 전체 경로 보기 (경로선 복원 + 전체 영역)
  function showFullRoute() {
    const map = mapInstanceRef.current
    if (!map) return
    polylineRef.current?.setMap(map)
    if (boundsRef.current) map.setBounds(boundsRef.current)
    setSelectedCardId(null)
  }

  // 일정 id → place_name
  function placeName(id: string) {
    return schedules.find(s => s.id === id)?.place_name ?? ''
  }
  function placeAddr(id: string) {
    return schedules.find(s => s.id === id)?.address ?? ''
  }

  const dates = [...new Set(schedules.map(s => s.date))].sort()

  if (!apiKey || apiKey === '여기에_카카오맵_api_키_입력') {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="font-semibold text-amber-700 text-sm mb-1">카카오맵 API 키가 필요해요</p>
          <p className="text-amber-600 text-xs">.env.local 파일에 NEXT_PUBLIC_KAKAO_MAP_KEY를 입력해주세요</p>
        </div>
        <ScheduleList schedules={schedules} />
      </div>
    )
  }

  if (mapError) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
          <p className="font-semibold text-red-700 text-sm">🗺️ 지도를 불러올 수 없어요</p>
          <p className="text-red-600 text-xs leading-relaxed">
            카카오맵 API 키에 현재 사이트 주소가 등록되지 않아 발생하는 오류입니다.<br />
            <strong>해결 방법:</strong> developers.kakao.com → 내 애플리케이션 → 앱 설정 → 플랫폼 키 → JavaScript SDK 도메인에
            아래 주소를 추가해주세요
          </p>
          <p className="text-xs bg-red-100 text-red-700 px-3 py-2 rounded-lg font-mono break-all">
            {typeof window !== 'undefined' ? window.location.origin : '현재 배포 URL'}
          </p>
        </div>
        <ScheduleList schedules={schedules} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 날짜 필터 */}
      {dates.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedDate('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              selectedDate === 'all' ? 'bg-blue-500 text-white' : 'bg-white border border-slate-200 text-slate-600'
            }`}
          >
            전체
          </button>
          {dates.map(d => (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedDate === d ? 'bg-blue-500 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              {new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </button>
          ))}
        </div>
      )}

      {/* 자동차 경로 요약 — 클릭하면 구간별 코스 펼침 */}
      {routeInfo && (
        <div className="space-y-2">
          <button
            onClick={() => {
              const next = !showLegs
              setShowLegs(next)
              if (next) showFullRoute() // 펼칠 때 전체 경로 복원
            }}
            className="w-full bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-center gap-2 hover:bg-blue-100/70 transition-colors"
          >
            <span className="text-base">🚗</span>
            <span className="text-sm font-semibold text-blue-700">
              자동차 총 {formatDuration(routeInfo.duration)}
            </span>
            <span className="text-xs text-blue-400">· {(routeInfo.distance / 1000).toFixed(1)}km</span>
            <span className="text-[11px] text-blue-400 ml-auto">{showLegs ? '접기 ▲' : '구간별 보기 ▼'}</span>
          </button>

          {/* 구간별 코스 */}
          {showLegs && routeLegs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
              {routeLegs.map((leg, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-medium text-slate-800 truncate">{placeName(leg.fromId)}</span>
                      <span className="text-slate-300 shrink-0">→</span>
                      <span className="font-medium text-slate-800 truncate">{placeName(leg.toId)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-[11px] text-slate-400">
                      {placeAddr(leg.fromId) && <span className="truncate">📍 {placeAddr(leg.fromId)}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-blue-600">🚗 {formatDuration(leg.duration)}</p>
                    <p className="text-[11px] text-slate-400">{(leg.distance / 1000).toFixed(1)}km</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 지도 */}
      <div ref={mapRef} className="w-full h-80 rounded-xl overflow-hidden border border-slate-200 bg-slate-100" />

      {/* 장소 목록 */}
      <ScheduleList
        schedules={selectedDate === 'all' ? schedules : schedules.filter(s => s.date === selectedDate)}
        onFocus={focusLocation}
        selectedId={selectedCardId}
      />

      {schedules.filter(s => !s.address).length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          💡 일정 탭에서 주소를 입력하면 지도에 표시돼요
        </p>
      )}
    </div>
  )
}

function ScheduleList({ schedules, onFocus, selectedId }: {
  schedules: Schedule[]
  onFocus?: (s: Schedule) => void
  selectedId?: string | null
}) {
  if (schedules.length === 0) return (
    <div className="text-center py-8 text-slate-400">
      <div className="text-3xl mb-2">🗺️</div>
      <p className="text-sm">일정 탭에서 장소를 추가하면 여기에 표시돼요</p>
    </div>
  )
  return (
    <div className="space-y-2">
      {schedules.map((s, idx) => {
        const clickable = !!onFocus && !!s.address
        const isActive = selectedId === s.id
        return (
          <div
            key={s.id}
            onClick={() => clickable && onFocus!(s)}
            className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-3 transition-all ${
              isActive ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/40'
                       : 'border-slate-200'
            } ${clickable ? 'cursor-pointer hover:border-blue-300 hover:bg-slate-50 active:scale-[0.99]' : ''}`}
          >
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 text-sm">{s.place_name}</p>
              {s.address && <p className="text-xs text-slate-400 mt-0.5">📍 {s.address}</p>}
            </div>
            {clickable && <span className="text-slate-300 text-xs shrink-0">🔍 확대</span>}
          </div>
        )
      })}
    </div>
  )
}
