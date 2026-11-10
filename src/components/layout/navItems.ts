export interface NavItem {
  to: string
  label: string
  icon: string
}

/** 메뉴 5개 (plan.md 화면 구성) */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '대시보드', icon: '🏠' },
  { to: '/money', label: '가계부', icon: '💳' },
  { to: '/todos', label: '할 일', icon: '✅' },
  { to: '/scraps', label: '스크랩', icon: '🔖' },
  { to: '/settings', label: '설정', icon: '⚙️' },
]
