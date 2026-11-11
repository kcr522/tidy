/** 자동 백업 설정 (이 기기에만, localStorage) */
export type BackupEvery = 'off' | 'day' | 'week'

export interface AutoBackupSettings {
  every: BackupEvery
  /** 마지막으로 백업한 시각 (ISO) */
  last?: string
}

const KEY = 'tidy-auto-backup'
const EVENT = 'tidy:auto-backup'
/** 폰에 남겨 둘 자동 백업 파일 수 (오래된 것부터 지운다) */
export const KEEP = 7
export const AUTO_PREFIX = 'tidy-auto-'

const DAY = 24 * 60 * 60 * 1000
const GAP: Record<Exclude<BackupEvery, 'off'>, number> = { day: DAY, week: 7 * DAY }

export function loadAutoBackup(defaultEvery: BackupEvery): AutoBackupSettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<AutoBackupSettings> | null
    const every = v?.every === 'off' || v?.every === 'day' || v?.every === 'week' ? v.every : defaultEvery
    return { every, ...(typeof v?.last === 'string' && { last: v.last }) }
  } catch {
    return { every: defaultEvery }
  }
}

export function saveAutoBackup(s: AutoBackupSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // 저장 못 하면 다음에 다시 백업할 뿐
  }
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function onAutoBackupChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

/** 백업할 때가 됐나. 하루 기준은 22시간으로 조금 너그럽게 (매일 비슷한 시간에 열면 매일 되도록) */
export function isDue(s: AutoBackupSettings, now: number): boolean {
  if (s.every === 'off') return false
  if (!s.last) return true
  const last = Date.parse(s.last)
  if (!Number.isFinite(last)) return true
  return now - last >= GAP[s.every] - 2 * 60 * 60 * 1000
}

/** 자동 백업 파일 이름: tidy-auto-2026-11-11.json */
export const autoFileName = (dateKey: string) => `${AUTO_PREFIX}${dateKey}.json`

/** 지울 파일: 자동 백업 파일 중 최신 KEEP개만 남긴다 */
export function toPrune(names: string[], keep = KEEP): string[] {
  const auto = names.filter((n) => n.startsWith(AUTO_PREFIX) && n.endsWith('.json')).sort()
  return auto.slice(0, Math.max(0, auto.length - keep))
}

/** "오늘 오후 3:20", "어제", "3일 전" */
export function agoLabel(iso: string | undefined, now: number): string {
  if (!iso) return '아직 없어요'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '아직 없어요'
  const days = Math.floor((new Date(now).setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / DAY)
  if (days <= 0) {
    const d = new Date(t)
    const h = d.getHours()
    return `오늘 ${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  if (days === 1) return '어제'
  return `${days}일 전`
}
