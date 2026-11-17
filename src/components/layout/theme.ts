/** 주소에 따라 구역 색을 고른다 (index.css의 .theme-*) */
export function themeFor(path: string): string {
  if (path.startsWith('/money')) return 'theme-money'
  if (path.startsWith('/todos') || path.startsWith('/diary')) return 'theme-todo'
  if (path.startsWith('/scraps') || path.startsWith('/memo')) return 'theme-scrap'
  return 'theme-main'
}
