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
        Map: new (container: HTMLElement, options: { center: { lat: number; lng: number }; level: number }) => KakaoMap
        LatLng: new (lat: number, lng: number) => KakaoLatLng
        Marker: new (options: { position: KakaoLatLng; map?: KakaoMap }) => KakaoMarker
        InfoWindow: new (options: { content: string }) => KakaoInfoWindow
        Polyline: new (options: { path: KakaoLatLng[]; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle: string }) => KakaoPolyline
        services: {
          Geocoder: new () => {
            addressSearch: (address: string, callback: (result: Array<{ x: string; y: string }>, status: string) => void) => void
          }
          Status: { OK: string }
          Places: new () => {
            keywordSearch: (keyword: string, callback: (result: Array<{ place_name: string; address_name: string; x: string; y: string }>, status: string) => void) => void
          }
        }
      }
    }
  }
}

interface KakaoMap {
  setCenter: (latlng: KakaoLatLng) => void
  setBounds: (bounds: KakaoBounds) => void
}

interface KakaoLatLng {
  getLat: () => number
  getLng: () => number
}

interface KakaoBounds {
  extend: (latlng: KakaoLatLng) => void
}

interface KakaoMarker {
  setMap: (map: KakaoMap | null) => void
}

interface KakaoInfoWindow {
  open: (map: KakaoMap, marker: KakaoMarker) => void
}

interface KakaoPolyline {
  setMap: (map: KakaoMap | null) => void
}

export default function MapTab({ trip }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('all')
  const mapInstanceRef = useRef<KakaoMap | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY

  useEffect(() => {
    loadSchedules()
  }, [trip.id])

  useEffect(() => {
    if (!apiKey || apiKey === '여기에_카카오맵_api_키_입력') return
    if (document.getElementById('kakao-map-script')) {
      setMapLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.id = 'kakao-map-script'
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&libraries=services&autoload=false`
    script.onload = () => {
      window.kakao.maps.load(() => setMapLoaded(true))
    }
    document.head.appendChild(script)
  }, [apiKey])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || schedules.length === 0) return
    initMap()
  }, [mapLoaded, schedules, selectedDate])

  async function loadSchedules() {
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('trip_id', trip.id)
      .order('date').order('order_index')
    setSchedules(data || [])
  }

  function initMap() {
    const filtered = selectedDate === 'all'
      ? schedules.filter(s => s.latitude && s.longitude)
      : schedules.filter(s => s.date === selectedDate && s.latitude && s.longitude)

    if (!mapRef.current) return

    const centerLat = filtered.length > 0 ? filtered[0].latitude! : 37.5665
    const centerLng = filtered.length > 0 ? filtered[0].longitude! : 126.9780
    const centerLatLng = new window.kakao.maps.LatLng(centerLat, centerLng)

    const map = new window.kakao.maps.Map(mapRef.current, {
      center: centerLatLng,
      level: 7,
    })
    mapInstanceRef.current = map

    if (filtered.length === 0) return

    const bounds = { positions: [] as KakaoLatLng[] } as { positions: KakaoLatLng[] & { extend?: (l: KakaoLatLng) => void } }

    filtered.forEach((s, idx) => {
      const pos = new window.kakao.maps.LatLng(s.latitude!, s.longitude!)
      const marker = new window.kakao.maps.Marker({ position: pos, map })
      const infoContent = `<div style="padding:6px 10px;font-size:13px;font-weight:600;color:#1e293b;">${idx + 1}. ${s.place_name}</div>`
      const info = new window.kakao.maps.InfoWindow({ content: infoContent })
      info.open(map, marker)
      bounds.positions.push(pos)
    })

    // 경로 연결 (직선)
    if (filtered.length > 1) {
      const path = filtered.map(s => new window.kakao.maps.LatLng(s.latitude!, s.longitude!))
      const polyline = new window.kakao.maps.Polyline({
        path,
        strokeWeight: 3,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.8,
        strokeStyle: 'solid',
      })
      polyline.setMap(map)
    }
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

      {/* 지도 */}
      <div ref={mapRef} className="w-full h-80 rounded-xl overflow-hidden border border-slate-200 bg-slate-100" />

      {/* 장소 목록 */}
      <ScheduleList schedules={selectedDate === 'all' ? schedules : schedules.filter(s => s.date === selectedDate)} />

      {schedules.filter(s => !s.latitude).length > 0 && (
        <p className="text-xs text-slate-400 text-center">
          💡 일정 탭에서 주소를 입력하면 지도에 표시돼요
        </p>
      )}
    </div>
  )
}

function ScheduleList({ schedules }: { schedules: Schedule[] }) {
  if (schedules.length === 0) return (
    <div className="text-center py-8 text-slate-400">
      <div className="text-3xl mb-2">🗺️</div>
      <p className="text-sm">일정 탭에서 장소를 추가하면 여기에 표시돼요</p>
    </div>
  )
  return (
    <div className="space-y-2">
      {schedules.map((s, idx) => (
        <div key={s.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
          <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</div>
          <div>
            <p className="font-medium text-slate-800 text-sm">{s.place_name}</p>
            {s.address && <p className="text-xs text-slate-400 mt-0.5">📍 {s.address}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
