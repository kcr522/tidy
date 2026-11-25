import { describe, expect, it } from 'vitest'
import type { Bookmark, CalendarEvent, Diary, Todo, Transaction } from '../../src/db/types'
import { highlightParts, makeSnippet, matchBookmark, normalize, searchAll, splitQuery } from '../../src/lib/search'

const now = '2026-11-10T00:00:00.000Z'
const tx = (id: number, memo: string, extra: Partial<Transaction> = {}): Transaction => ({
  id, type: 'EXPENSE', amount: 5000, category: '식비', date: `2026-11-0${id}`, memo, createdAt: now, updatedAt: now, ...extra,
})
const todo = (id: number, title: string): Todo => ({
  id, title, isCompleted: 0, completedAt: null, dueDate: null, priority: 'MEDIUM', createdAt: now, updatedAt: now,
})
const diary = (date: string, text: string, notes: string[] = []): Diary => ({
  date, text, color: 'pink', photos: notes.map((note) => ({ src: '', note })), createdAt: now, updatedAt: now,
})
const scrap = (id: number, b: Partial<Bookmark>): Bookmark => ({
  id, url: 'https://example.com', title: '', memo: '', isRead: 0, createdAt: now, updatedAt: now, ...b,
})
const event = (id: number, title: string, memo = ''): CalendarEvent => ({
  id, title, memo, startDate: '2026-11-20', endDate: '2026-11-21', color: 'blue', createdAt: now, updatedAt: now,
})

describe('전체 검색', () => {
  const data = {
    transactions: [tx(1, '스타벅스 라떼'), tx(2, '다이소', { account: '신한카드' }), tx(3, '월급', { type: 'INCOME', amount: 2500000, category: '급여' })],
    todos: [todo(1, '스타벅스 쿠폰 쓰기'), todo(2, '빨래')],
    diaries: [diary('2026-11-09', '오늘은 친구랑 카페에 갔다'), diary('2026-11-08', '산책', ['스타벅스에서 찍은 사진'])],
    bookmarks: [
      scrap(1, { title: '성수 맛집 모음', memo: '주말에 가기' }),
      scrap(2, { title: '인스타 릴스', summary: '스타벅스 신메뉴 후기 요약' }),
    ],
    events: [event(1, '제주 여행', '스타벅스 제주점')],
  }

  it('빈 검색어는 아무것도 안 찾는다', () => {
    expect(searchAll(data, '   ')).toEqual([])
  })

  it('가계부 메모, 할 일, 일기 사진 메모, 스크랩 AI 요약, 일정 메모에서 모두 찾는다', () => {
    const hits = searchAll(data, '스타벅스')
    expect(hits.map((h) => h.key)).toEqual(['money-1', 'todo-1', 'diary-2026-11-08', 'scrap-2', 'event-1'])
    expect(hits.find((h) => h.kind === 'scrap')?.field).toBe('요약')
    expect(hits.find((h) => h.kind === 'diary')?.field).toBe('사진 메모')
  })

  it('대소문자와 띄어쓰기를 무시한다', () => {
    expect(searchAll(data, '스타 벅스').length).toBe(5)
    expect(normalize('Star Bucks')).toBe('starbucks')
  })

  it('여러 단어는 모두 들어 있어야 한다 (필드는 달라도 된다)', () => {
    expect(searchAll(data, '성수 주말').map((h) => h.key)).toEqual(['scrap-1'])
    expect(searchAll(data, '성수 빨래')).toEqual([])
  })

  it('결제 수단, 카테고리, 금액으로도 찾는다', () => {
    expect(searchAll(data, '신한').map((h) => h.key)).toEqual(['money-2'])
    expect(searchAll(data, '급여').map((h) => h.key)).toEqual(['money-3'])
    expect(searchAll(data, '2,500,000원').map((h) => h.key)).toEqual(['money-3'])
  })

  it('같은 종류 안에서는 최근 것이 위로', () => {
    expect(searchAll(data, '5000').map((h) => h.key)).toEqual(['money-2', 'money-1'])
  })

  it('찾은 부분 앞뒤만 잘라서 보여 주고 형광펜으로 나눈다', () => {
    const long = `${'가'.repeat(100)}스타벅스${'나'.repeat(100)}`
    const s = makeSnippet(long, '스타벅스', 10)
    expect(s).toBe(`…${'가'.repeat(10)}스타벅스${'나'.repeat(10)}…`)
    expect(highlightParts('나는 Latte 좋아', ['latte'])).toEqual([
      { text: '나는 ', hit: false },
      { text: 'Latte', hit: true },
      { text: ' 좋아', hit: false },
    ])
  })
})

describe('할 일 메모 · 첨부 검색', () => {
  it('메모 글과 첨부 파일 이름으로도 찾는다', () => {
    const t: Todo = { ...todo(7, '발표 준비'), memo: '3쪽 표 먼저 정리', attachments: [{ name: '참고자료.pdf', type: 'application/pdf', size: 3, src: 'data:application/pdf;base64,AAAA' }] }
    const byMemo = searchAll({ todos: [t] }, '먼저')
    expect(byMemo.map((h) => [h.key, h.field])).toEqual([['todo-7', '메모']])
    expect(byMemo[0].snippet).toContain('먼저')
    expect(searchAll({ todos: [t] }, '참고자료').map((h) => h.field)).toEqual(['첨부 파일'])
  })
})

describe('스크랩 내용 검색', () => {
  const long = `${'자취 꿀팁 모음입니다 '.repeat(8)}냉동실에 밥을 소분해서 얼려 두면 편해요 #자취 #살림`
  const b = scrap(9, { title: '인스타 게시물', description: long, categoryId: 3 })

  it('제목에 없어도 내용(캡션) 속 글자로 찾고, 찾은 곳 앞뒤를 보여 준다', () => {
    const m = matchBookmark(b, splitQuery('냉동실 소분'))
    expect(m?.field).toBe('내용')
    expect(m?.snippet).toContain('냉동실에 밥을')
    expect(m?.snippet.startsWith('…')).toBe(true)
  })

  it('해시태그 · 카테고리 이름으로도 찾는다', () => {
    expect(matchBookmark(b, splitQuery('#살림'))?.field).toBe('내용')
    expect(matchBookmark(b, splitQuery('꿀팁저장'), '꿀팁저장')?.field).toBe('카테고리')
    expect(matchBookmark(b, splitQuery('여행'), '꿀팁저장')).toBeNull()
  })

  it('전체 검색도 스크랩 카테고리 이름을 찾는다', () => {
    const hits = searchAll({ bookmarks: [b], scrapCategories: [{ id: 3, name: '자취를 위해 모으기', order: 0, createdAt: now }] }, '자취를위해')
    expect(hits.map((h) => [h.key, h.field])).toEqual([['scrap-9', '카테고리']])
  })
})
