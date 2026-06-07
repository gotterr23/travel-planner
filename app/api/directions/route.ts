import { NextRequest, NextResponse } from 'next/server'

interface Coord { lat: number; lng: number }

// 카카오모빌리티 자동차 길찾기 (여러 경유지)
// 키가 없으면 클라이언트가 직선으로 fallback 하도록 에러를 반환한다.
export async function POST(req: NextRequest) {
  const key = process.env.KAKAO_REST_KEY
  if (!key) return NextResponse.json({ error: 'no_key' }, { status: 400 })

  let points: Coord[] = []
  try {
    const body = await req.json()
    points = body.points ?? []
  } catch {
    return NextResponse.json({ error: 'bad_body' }, { status: 400 })
  }
  if (points.length < 2) return NextResponse.json({ error: 'need_2_points' }, { status: 400 })

  const origin = { x: points[0].lng, y: points[0].lat }
  const destination = { x: points[points.length - 1].lng, y: points[points.length - 1].lat }
  const waypoints = points.slice(1, -1).map(p => ({ x: p.lng, y: p.lat }))

  let res: Response
  try {
    res = await fetch('https://apis-navi.kakaomobility.com/v1/waypoints/directions', {
      method: 'POST',
      headers: {
        Authorization: `KakaoAK ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ origin, destination, waypoints, priority: 'RECOMMEND' }),
    })
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 })
  }

  if (!res.ok) {
    return NextResponse.json({ error: 'api_error', status: res.status }, { status: 502 })
  }

  const data = await res.json()
  const route = data.routes?.[0]
  if (!route || route.result_code !== 0) {
    return NextResponse.json({ error: 'no_route', detail: route?.result_msg ?? null }, { status: 502 })
  }

  // 도로 경로 좌표 평탄화 (vertexes: [x, y, x, y, ...])
  const path: Coord[] = []
  // 구간(경유지 사이)별 소요시간·거리
  const legs: { duration: number; distance: number }[] = []
  for (const section of route.sections ?? []) {
    legs.push({ duration: section.duration ?? 0, distance: section.distance ?? 0 })
    for (const road of section.roads ?? []) {
      const v: number[] = road.vertexes ?? []
      for (let i = 0; i + 1 < v.length; i += 2) {
        path.push({ lng: v[i], lat: v[i + 1] })
      }
    }
  }

  return NextResponse.json({
    duration: route.summary?.duration ?? 0, // 초
    distance: route.summary?.distance ?? 0, // 미터
    path,
    legs, // 구간별 [{duration, distance}, ...] (지점 수 - 1개)
  })
}
