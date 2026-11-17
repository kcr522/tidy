import { BookHeart, Bookmark, CalendarDays, House, ListChecks, NotebookPen, Settings, Wallet, type LucideIcon } from 'lucide-react'

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
  { to: '/memo', label: '메모', icon: NotebookPen },
  { to: '/settings', label: '설정', icon: Settings },
]
