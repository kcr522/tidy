import { addDays, addMonths, addWeeks, addYears, format } from 'date-fns'
import type { CalendarEvent, Todo } from '../db/types'
import { parseDateKey } from './date'

/** iCal 에서 읽은 일정 하나 (날짜는 이 기기 시간 기준) */
export interface IcsEvent {
  uid: string
  title: string
  startDate: string
  /** 마지막 날 (포함) */
  endDate: string
  /** 시간이 있는 일정이면 "HH:mm" */
  time?: string
  memo: string
}

const key = (d: Date) => format(d, 'yyyy-MM-dd')

/** 접힌 줄 펴기 (줄이 공백/탭으로 시작하면 앞 줄에 이어 붙인다) */
function unfold(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n')
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')
}

/** DTSTART/DTEND 값 → Date. 날짜만이면 allDay */
function parseDate(value: string, params: string): { date: Date; allDay: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s, z] = m
  if (!h || /VALUE=DATE(?!-TIME)/i.test(params)) return { date: new Date(+y, +mo - 1, +d), allDay: true }
  // Z(UTC)면 이 기기 시간으로 바꾸고, TZID가 있으면 그 지역 시간으로 적힌 것: 한국에서 쓰는 앱이라 그대로 현지 시간으로 본다
  const date = z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))) : new Date(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))
  return { date, allDay: false }
}

interface Rule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  count?: number
  until?: Date
  byDay?: number[]
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

function parseRule(v: string): Rule | null {
  const p = Object.fromEntries(v.split(';').map((kv) => kv.split('=') as [string, string]))
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(p.FREQ)) return null
  const until = p.UNTIL ? parseDate(p.UNTIL, '')?.date : undefined
  const byDay = p.BYDAY ? p.BYDAY.split(',').map((d) => DAYS.indexOf(d.slice(-2))).filter((d) => d >= 0) : undefined
  return { freq: p.FREQ as Rule['freq'], interval: Math.max(1, Number(p.INTERVAL) || 1), count: p.COUNT ? Number(p.COUNT) : undefined, until, byDay: byDay?.length ? byDay : undefined }
}

/** 반복 일정의 시작 날짜들 (from~to 안, 최대 limit 개) */
function expand(start: Date, rule: Rule, from: Date, to: Date, exdates: Set<string>, limit = 400): Date[] {
  const out: Date[] = []
  let n = 0
  const push = (d: Date) => {
    n += 1
    if (rule.count !== undefined && n > rule.count) return false
    if (rule.until && d > rule.until) return false
    if (d > to) return false
    if (d >= from && !exdates.has(key(d))) out.push(d)
    return out.length < limit
  }
  if (rule.freq === 'WEEKLY' && rule.byDay) {
    // 시작한 주의 일요일부터 interval 주씩, 그 주의 요일들
    let week = addDays(start, -start.getDay())
    for (let i = 0; i < 2000; i++) {
      for (const wd of [...rule.byDay].sort()) {
        const d = addDays(week, wd)
        d.setHours(start.getHours(), start.getMinutes(), start.getSeconds())
        if (d < start) continue
        if (!push(d)) return out
      }
      week = addWeeks(week, rule.interval)
    }
    return out
  }
  const step = { DAILY: addDays, WEEKLY: addWeeks, MONTHLY: addMonths, YEARLY: addYears }[rule.freq]
  for (let i = 0; i < 5000; i++) {
    if (!push(step(start, i * rule.interval))) return out
  }
  return out
}

/**
 * .ics 글자 → 일정 목록. 반복 일정은 from~to 안에서 펼친다.
 * 취소된 일정(STATUS:CANCELLED)은 뺀다.
 */
export function parseIcs(text: string, from: Date, to: Date): IcsEvent[] {
  const out: IcsEvent[] = []
  let cur: Record<string, { value: string; params: string }[]> | null = null
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') {
      cur = {}
      continue
    }
    if (line === 'END:VEVENT' && cur) {
      out.push(...toEvents(cur, from, to))
      cur = null
      continue
    }
    if (!cur) continue
    const i = line.indexOf(':')
    if (i < 0) continue
    const [name, ...params] = line.slice(0, i).split(';')
    ;(cur[name.toUpperCase()] ??= []).push({ value: line.slice(i + 1), params: params.join(';') })
  }
  return out
}

function toEvents(p: Record<string, { value: string; params: string }[]>, from: Date, to: Date): IcsEvent[] {
  const one = (k: string) => p[k]?.[0]
  if (one('STATUS')?.value.toUpperCase() === 'CANCELLED') return []
  const ds = one('DTSTART')
  const start = ds && parseDate(ds.value, ds.params)
  if (!start) return []
  const de = one('DTEND')
  const end = de ? parseDate(de.value, de.params) : null
  // 하루 종일 일정의 DTEND는 다음 날(포함 안 함). 시간 일정은 끝나는 날 그대로
  const lengthDays = end ? Math.max(0, Math.round((startOfDay(end.date).getTime() - startOfDay(start.date).getTime()) / 864e5) - (end.allDay ? 1 : 0)) : 0
  const title = unescape(one('SUMMARY')?.value ?? '').trim() || '(제목 없음)'
  const uid = one('UID')?.value ?? `${title}-${ds.value}`
  const where = unescape(one('LOCATION')?.value ?? '').trim()
  const time = start.allDay ? undefined : format(start.date, 'HH:mm')
  const memo = [time, where].filter(Boolean).join(' · ')
  const exdates = new Set((p.EXDATE ?? []).flatMap((x) => x.value.split(',')).map((v) => parseDate(v, '')).filter((x): x is { date: Date; allDay: boolean } => !!x).map((x) => key(x.date)))
  const rrule = one('RRULE')
  const rule = rrule ? parseRule(rrule.value) : null
  const starts = rule ? expand(start.date, rule, addDays(from, -lengthDays), to, exdates) : start.date <= to && addDays(start.date, lengthDays) >= from ? [start.date] : []
  return starts.map((s) => ({ uid: rule ? `${uid}@${key(s)}` : uid, title, startDate: key(s), endDate: key(addDays(s, lengthDays)), ...(time && { time }), memo }))
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
const ymd = (k: string) => k.replace(/-/g, '')

/** Tidy 일정 + 마감일 있는 할 일 → .ics (구글 캘린더 "가져오기"에 넣는다) */
export function buildIcs(events: CalendarEvent[], todos: Todo[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tidy//KO', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Tidy']
  const add = (uid: string, title: string, start: string, end: string, memo: string) => {
    lines.push('BEGIN:VEVENT', `UID:${uid}@tidy`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(start)}`, `DTEND;VALUE=DATE:${ymd(key(addDays(parseDateKey(end), 1)))}`, `SUMMARY:${esc(title)}`)
    if (memo) lines.push(`DESCRIPTION:${esc(memo)}`)
    lines.push('END:VEVENT')
  }
  for (const e of events) if (!e.source) add(`event-${e.id}`, e.title, e.startDate, e.endDate, e.memo)
  for (const t of todos) if (t.dueDate && t.isCompleted === 0) add(`todo-${t.id}`, `할 일: ${t.title}`, t.dueDate, t.dueDate, '')
  lines.push('END:VCALENDAR')
  // 한 줄은 75바이트까지 (길면 접는다)
  return lines.flatMap(fold).join('\r\n') + '\r\n'
}

function fold(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
      bytes = 0
    }
    cur += ch
    bytes += b
  }
  out.push(cur)
  return out.map((l, i) => (i ? ` ${l}` : l))
}
