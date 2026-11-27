/**
 * 오늘 기분 (대시보드 기분 위젯, 사용자 요청 2026-11-27)
 * 그날 일기(diaries.mood)에 이름으로 저장해서 로그인하면 다른 기기와도 같이 보인다
 */

export interface Mood {
  key: string
  emoji: string
  label: string
  /** 기분 칸 배경 (연한 색) */
  bg: string
}

export const MOODS: Mood[] = [
  { key: 'great', emoji: '😆', label: '최고', bg: '#fde68a' },
  { key: 'good', emoji: '🙂', label: '좋아요', bg: '#bbf7d0' },
  { key: 'calm', emoji: '😌', label: '평온', bg: '#bae6fd' },
  { key: 'meh', emoji: '😐', label: '그저 그래요', bg: '#e2e8f0' },
  { key: 'sad', emoji: '😢', label: '슬퍼요', bg: '#c7d2fe' },
  { key: 'angry', emoji: '😤', label: '짜증나요', bg: '#fecaca' },
]

export const moodOf = (key: string | undefined | null): Mood | undefined => (key ? MOODS.find((m) => m.key === key) : undefined)
