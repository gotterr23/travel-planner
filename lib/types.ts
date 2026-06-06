export type Role = 'admin' | 'member'

export interface Trip {
  id: string
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  cover_image_url: string | null
  admin_token: string
  member_token: string
  board_categories: string[] | null
  settings: { budgetCategories?: Record<string, string> } | null
  created_at: string
}

export interface Schedule {
  id: string
  trip_id: string
  date: string
  order_index: number
  place_name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  memo: string | null
  time: string | null
  participants: string | null
  created_at: string
}

export interface ReferenceItem {
  id: string
  trip_id: string
  type: 'link' | 'image'
  title: string | null
  url: string | null
  image_url: string | null
  memo: string | null
  category: string | null
  schedule_id: string | null
  schedule_ids: string[]
  created_at: string
}

export interface Photo {
  id: string
  trip_id: string
  image_url: string
  caption: string | null
  schedule_id: string | null
  created_at: string
}

export interface ChecklistItem {
  id: string
  trip_id: string
  schedule_id: string | null
  place: string | null
  time: string | null
  title: string
  note: string | null
  created_at: string
}

export interface BudgetItem {
  id: string
  trip_id: string
  category: '숙박' | '교통' | '식비' | '관광' | '기타'
  title: string
  amount: number
  paid_by: string | null
  created_at: string
}
