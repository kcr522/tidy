import { BookHeart, Bookmark, CalendarDays, House, ListChecks, Settings, Wallet, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** 메뉴 (폰 아래 탭에는 설정이 빠지고 위쪽 톱니바퀴로 간다) */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '대시보드', icon: House },
  { to: '/money', label: '가계부', icon: Wallet },
  { to: '/todos', label: '할 일', icon: ListChecks },
  { to: '/diary', label: '일기', icon: BookHeart },
  { to: '/calendar', label: '캘린더', icon: CalendarDays },
  { to: '/scraps', label: '스크랩', icon: Bookmark },
  // 메모 메뉴는 숨김 (사용자 요청 2026-11-18: 메모 기능은 일기 시간별 칸으로 옮겼다).
  // 쓴 메모는 지우지 않고 그대로 보관: 검색 결과에서 열 수 있고, 아래 줄을 되살리면 다시 보인다
  // { to: '/memo', label: '메모', icon: NotebookPen },
  { to: '/settings', label: '설정', icon: Settings },
]
