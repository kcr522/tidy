import { describe, expect, it } from 'vitest'
import type { CalendarEvent, Todo } from '../../src/db/types'
import { buildIcs, parseIcs } from '../../src/lib/ical'

const from = new Date(2026, 9, 1)
const to = new Date(2026, 11, 31)
const calendar = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`
const lines = (...rows: string[]) => rows.join('\n')
const ICS_LINE_BYTES = 75 // RFC 5545 한 줄 최대 길이

describe('parseIcs', () => {
  it('하루 종일 일정의 DTEND 는 그날을 포함하지 않으니 하루 앞으로 당긴다', () => {
    const text = calendar(lines('BEGIN:VEVENT', 'UID:a2', 'DTSTART;VALUE=DATE:20261120', 'DTEND;VALUE=DATE:20261123', 'SUMMARY:여행', 'END:VEVENT'))

    const [event] = parseIcs(text, from, to)

    expect(event).toMatchObject({ startDate: '2026-11-20', endDate: '2026-11-22' })
  })

  it('접힌 줄은 이어 붙이고, \\, 이스케이프를 풀고, 장소는 메모에 넣는다', () => {
    const text = calendar(
      ['BEGIN:VEVENT', 'UID:a1', 'DTSTART;VALUE=DATE:20261111', 'DTEND;VALUE=DATE:20261112', 'SUMMARY:빼빼로\\, 데이', 'END:VEVENT', 'BEGIN:VEVENT', 'UID:a2', 'DTSTART;VALUE=DATE:20261120', 'DTEND;VALUE=DATE:20261123', 'SUMMARY:제주도 ', ' 여행', 'LOCATION:제주', 'END:VEVENT'].join('\r\n'),
    )

    const list = parseIcs(text, from, to)

    expect(list).toEqual([
      { uid: 'a1', title: '빼빼로, 데이', startDate: '2026-11-11', endDate: '2026-11-11', memo: '' },
      { uid: 'a2', title: '제주도 여행', startDate: '2026-11-20', endDate: '2026-11-22', memo: '제주' },
    ])
  })

  it('시간 일정은 그날 하루 일정으로 넣고 시작 시간은 메모에 쓴다', () => {
    const text = calendar(lines('BEGIN:VEVENT', 'UID:b', 'DTSTART;TZID=Asia/Seoul:20261112T143000', 'DTEND;TZID=Asia/Seoul:20261112T153000', 'SUMMARY:치과', 'END:VEVENT'))

    const [event] = parseIcs(text, from, to)

    expect(event).toMatchObject({ startDate: '2026-11-12', endDate: '2026-11-12', time: '14:30', memo: '14:30' })
  })

  it('매주 화 · 목 4번 반복에서 EXDATE 로 뺀 날은 빼고, 날마다 다른 uid 를 준다', () => {
    const text = calendar(lines('BEGIN:VEVENT', 'UID:c', 'DTSTART;VALUE=DATE:20261103', 'DTEND;VALUE=DATE:20261104', 'RRULE:FREQ=WEEKLY;COUNT=4;BYDAY=TU,TH', 'EXDATE;VALUE=DATE:20261105', 'SUMMARY:필라테스', 'END:VEVENT'))

    const list = parseIcs(text, from, to)

    expect(list.map((event) => event.startDate)).toEqual(['2026-11-03', '2026-11-10', '2026-11-12'])
    expect(new Set(list.map((event) => event.uid)).size).toBe(3)
  })

  it('매달 반복은 보는 기간 안의 날만 넣고, 취소된 일정은 뺀다', () => {
    const text = calendar(lines('BEGIN:VEVENT', 'UID:d', 'DTSTART;VALUE=DATE:20260125', 'RRULE:FREQ=MONTHLY', 'SUMMARY:월급날', 'END:VEVENT', 'BEGIN:VEVENT', 'UID:e', 'DTSTART;VALUE=DATE:20261101', 'STATUS:CANCELLED', 'SUMMARY:취소', 'END:VEVENT'))

    const list = parseIcs(text, from, to)

    expect(list.map((event) => event.startDate)).toEqual(['2026-10-25', '2026-11-25', '2026-12-25'])
  })
})

describe('buildIcs', () => {
  const event = (over: Partial<CalendarEvent>): CalendarEvent => ({ id: 1, title: '여행', startDate: '2026-11-20', endDate: '2026-11-22', color: 'blue', memo: '부산, 해운대', createdAt: '', updatedAt: '', ...over })
  const todo = (over: Partial<Todo>): Todo => ({ id: 5, title: '관리비', dueDate: '2026-11-25', isCompleted: 0, completedAt: null, priority: 'MEDIUM', createdAt: '', updatedAt: '', ...over })

  it('일정의 DTEND 는 다음 날로 쓰고, 메모의 쉼표는 이스케이프한다', () => {
    const text = buildIcs([event({})], [])

    expect(text).toContain('DTEND;VALUE=DATE:20261123')
    expect(text).toContain('DESCRIPTION:부산\\, 해운대')
  })

  it('가져온 구글 일정 · 마감일 없는 할 일 · 끝낸 할 일은 빼고, 다시 읽으면 같은 일정이 나온다', () => {
    const fromGoogle = event({ id: 2, title: '구글 것', source: 'google' })
    const noDue = todo({ id: 6, dueDate: null })
    const done = todo({ id: 7, isCompleted: 1 })

    const back = parseIcs(buildIcs([event({}), fromGoogle], [todo({}), noDue, done]), from, to)

    expect(back.map((item) => [item.title, item.startDate, item.endDate])).toEqual([
      ['여행', '2026-11-20', '2026-11-22'],
      ['할 일: 관리비', '2026-11-25', '2026-11-25'],
    ])
  })

  it('긴 줄은 75바이트로 접고, 다시 읽으면 제목이 그대로다', () => {
    const longTitle = '아주 긴 제목'.repeat(10)

    const text = buildIcs([event({ title: longTitle, endDate: '2026-11-20', memo: '' })], [])

    for (const line of text.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(ICS_LINE_BYTES)
    expect(parseIcs(text, from, to)[0].title).toBe(longTitle)
  })
})
