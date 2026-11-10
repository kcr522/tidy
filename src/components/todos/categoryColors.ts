import type { TodoCategoryColor } from '../../db/types'

/** 할 일 카테고리 색 (밝은 화면·어두운 화면 둘 다 읽히는 중간 밝기) */
export const CATEGORY_HEX: Record<TodoCategoryColor, string> = {
  peach: '#e8804a',
  sky: '#3d93dc',
  mint: '#2ea97c',
  lilac: '#8c70da',
  lemon: '#c99a14',
  rose: '#e2607f',
}

export const CATEGORY_COLOR_NAME: Record<TodoCategoryColor, string> = {
  peach: '복숭아',
  sky: '하늘',
  mint: '민트',
  lilac: '라일락',
  lemon: '레몬',
  rose: '장미',
}
