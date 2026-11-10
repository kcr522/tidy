import { Bookmark, House, ListChecks, Settings, Wallet, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** 메뉴 5개 (plan.md 화면 구성) */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '대시보드', icon: House },
  { to: '/money', label: '가계부', icon: Wallet },
  { to: '/todos', label: '할 일', icon: ListChecks },
  { to: '/scraps', label: '스크랩', icon: Bookmark },
  { to: '/settings', label: '설정', icon: Settings },
]
