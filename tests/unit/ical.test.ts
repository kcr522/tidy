import { describe, expect, it } from 'vitest'
import type { CalendarEvent, Todo } from '../../src/db/types'
import { buildIcs, parseIcs } from '../../src/lib/ical'

const from = new Date(2026, 9, 1)
const to = new Date(2026, 11, 31)
const cal = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`

describe('parseIcs', () => {
  it('하루 종일, 여러 날 (DTEND는 포함 안 함), 접힌 줄, 이스케이프', () => {
    const list = parseIcs(
      cal(['BEGIN:VEVENT', 'UID:a1', 'DTSTART;VALUE=DATE:20261111', 'DTEND;VALUE=DATE:20261112', 'SUMMARY:빼빼로\\, 데이', 'END:VEVENT', 'BEGIN:VEVENT', 'UID:a2', 'DTSTART;VALUE=DATE:20261120', 'DTEND;VALUE=DATE:20261123', 'SUMMARY:제주도 ', ' 여행', 'LOCATION:제주', 'END:VEVENT'].join('\r\n')),
      from,
      to,
    )
    expect(list).toEqual([
      { uid: 'a1', title: '빼빼로, 데이', startDate: '2026-11-11', endDate: '2026-11-11', memo: '' },
      { uid: 'a2', title: '제주도 여행', startDate: '2026-11-20', endDate: '2026-11-22', memo: '제주' },
    ])
  })

  it('시간 일정은 그날 하루, 시간은 메모에', () => {
    const [e] = parseIcs(cal(['BEGIN:VEVENT', 'UID:b', 'DTSTART;TZID=Asia/Seoul:20261112T143000', 'DTEND;TZID=Asia/Seoul:20261112T153000', 'SUMMARY:치과', 'END:VEVENT'].join('\n')), from, to)
    expect(e).toMatchObject({ startDate: '2026-11-12', endDate: '2026-11-12', time: '14:30', memo: '14:30' })
  })

  it('반복: 매주 화·목 4번, 하나는 빠짐(EXDATE)', () => {
    const list = parseIcs(
      cal(['BEGIN:VEVENT', 'UID:c', 'DTSTART;VALUE=DATE:20261103', 'DTEND;VALUE=DATE:20261104', 'RRULE:FREQ=WEEKLY;COUNT=4;BYDAY=TU,TH', 'EXDATE;VALUE=DATE:20261105', 'SUMMARY:필라테스', 'END:VEVENT'].join('\n')),
      from,
      to,
    )
    expect(list.map((e) => e.startDate)).toEqual(['2026-11-03', '2026-11-10', '2026-11-12'])
    expect(new Set(list.map((e) => e.uid)).size).toBe(3)
  })

  it('반복: 매달, 기간 밖은 빼고, 취소된 일정은 뺀다', () => {
    const list = parseIcs(
      cal(['BEGIN:VEVENT', 'UID:d', 'DTSTART;VALUE=DATE:20260125', 'RRULE:FREQ=MONTHLY', 'SUMMARY:월급날', 'END:VEVENT', 'BEGIN:VEVENT', 'UID:e', 'DTSTART;VALUE=DATE:20261101', 'STATUS:CANCELLED', 'SUMMARY:취소', 'END:VEVENT'].join('\n')),
      from,
      to,
    )
    expect(list.map((e) => e.startDate)).toEqual(['2026-10-25', '2026-11-25', '2026-12-25'])
  })
})

describe('buildIcs', () => {
  it('일정과 마감일 있는 할 일만, 가져온 구글 일정은 빼고, 다시 읽으면 같다', () => {
    const ev = (p: Partial<CalendarEvent>): CalendarEvent => ({ id: 1, title: '여행', startDate: '2026-11-20', endDate: '2026-11-22', color: 'blue', memo: '부산, 해운대', createdAt: '', updatedAt: '', ...p })
    const td = (p: Partial<Todo>): Todo => ({ id: 5, title: '관리비', dueDate: '2026-11-25', isCompleted: 0, completedAt: null, priority: 'MEDIUM', createdAt: '', updatedAt: '', ...p })
    const text = buildIcs([ev({}), ev({ id: 2, title: '구글 것', source: 'google' })], [td({}), td({ id: 6, dueDate: null }), td({ id: 7, isCompleted: 1 })])
    expect(text).toContain('DTEND;VALUE=DATE:20261123')
    expect(text).toContain('DESCRIPTION:부산\\, 해운대')
    const back = parseIcs(text, from, to)
    expect(back.map((e) => [e.title, e.startDate, e.endDate])).toEqual([
      ['여행', '2026-11-20', '2026-11-22'],
      ['할 일: 관리비', '2026-11-25', '2026-11-25'],
    ])
  })

  it('긴 줄은 75바이트로 접는다', () => {
    const text = buildIcs([{ id: 1, title: '아주 긴 제목'.repeat(10), startDate: '2026-11-20', endDate: '2026-11-20', color: 'blue', memo: '', createdAt: '', updatedAt: '' }], [])
    for (const line of text.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    expect(parseIcs(text, from, to)[0].title).toBe('아주 긴 제목'.repeat(10))
  })
})
