/** "3분 전", "어제", "11월 2일" */
export function ago(ms: number | undefined, now = Date.now()): string {
  if (!ms) return '—'
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  const d = Math.floor(s / 86400)
  if (d < 7) return d === 1 ? '어제' : `${d}일 전`
  const t = new Date(ms)
  return `${t.getFullYear() === new Date(now).getFullYear() ? '' : `${t.getFullYear()}년 `}${t.getMonth() + 1}월 ${t.getDate()}일`
}
