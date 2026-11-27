import { describe, expect, it } from 'vitest'
import type { Bookmark, CalendarEvent, Diary, Todo, Transaction } from '../../src/db/types'
import { highlightParts, makeSnippet, matchBookmark, normalize, searchAll, splitQuery } from '../../src/lib/search'

const NOW = '2026-11-10T00:00:00.000Z'
const NOT_DONE = 0 as const
const UNREAD = 0 as const
const NO_CATEGORY_NAME = undefined

/** 정상 내역 · 할 일 · 일기 · 스크랩 · 일정 하나씩 (필요한 칸만 바꾼다) */
const okTx = (id: number, memo: string, over: Partial<Transaction> = {}): Transaction => ({
  id, type: 'EXPENSE', amount: 5000, category: '식비', date: `2026-11-0${id}`, memo, createdAt: NOW, updatedAt: NOW, ...over,
})
const okTodo = (id: number, title: string): Todo => ({
  id, title, isCompleted: NOT_DONE, completedAt: null, dueDate: null, priority: 'MEDIUM', createdAt: NOW, updatedAt: NOW,
})
const okDiary = (date: string, text: string, photoNotes: string[] = []): Diary => ({
  date, text, color: 'pink', photos: photoNotes.map((note) => ({ src: '', note })), createdAt: NOW, updatedAt: NOW,
})
const okScrap = (id: number, over: Partial<Bookmark>): Bookmark => ({
  id, url: 'https://example.com', title: '', memo: '', isRead: UNREAD, createdAt: NOW, updatedAt: NOW, ...over,
})
const okEvent = (id: number, title: string, memo = ''): CalendarEvent => ({
  id, title, memo, startDate: '2026-11-20', endDate: '2026-11-21', color: 'blue', createdAt: NOW, updatedAt: NOW,
})

const keysOf = (hits: { key: string }[]) => hits.map((hit) => hit.key)

describe('전체 검색', () => {
  const data = {
    transactions: [okTx(1, '스타벅스 라떼'), okTx(2, '다이소', { account: '신한카드' }), okTx(3, '월급', { type: 'INCOME', amount: 2_500_000, category: '급여' })],
    todos: [okTodo(1, '스타벅스 쿠폰 쓰기'), okTodo(2, '빨래')],
    diaries: [okDiary('2026-11-09', '오늘은 친구랑 카페에 갔다'), okDiary('2026-11-08', '산책', ['스타벅스에서 찍은 사진'])],
    bookmarks: [okScrap(1, { title: '성수 맛집 모음', memo: '주말에 가기' }), okScrap(2, { title: '인스타 릴스', summary: '스타벅스 신메뉴 후기 요약' })],
    events: [okEvent(1, '제주 여행', '스타벅스 제주점')],
  }
  const ALL_STARBUCKS = ['money-1', 'todo-1', 'diary-2026-11-08', 'scrap-2', 'event-1']

  it('가계부 따로 적은 메모로도 찾는다', () => {
    const hits = searchAll({ transactions: [okTx(4, '다이소', { note: '친구 생일 선물' })] }, '생일')
    expect(hits).toHaveLength(1)
    expect(hits[0].title).toBe('다이소')
    expect(hits[0].field).toBe('메모')
  })

  it('공백만 있는 검색어로는 아무것도 찾지 않는다', () => {
    expect(searchAll(data, '   ')).toEqual([])
  })

  it('가계부 메모, 할 일, 일기 사진 메모, 스크랩 AI 요약, 일정 메모에서 모두 찾는다', () => {
    const hits = searchAll(data, '스타벅스')

    expect(keysOf(hits)).toEqual(ALL_STARBUCKS)
    expect(hits.find((hit) => hit.kind === 'scrap')?.field).toBe('요약')
    expect(hits.find((hit) => hit.kind === 'diary')?.field).toBe('사진 메모')
  })

  it('검색어의 띄어쓰기는 무시한다', () => {
    expect(keysOf(searchAll(data, '스타 벅스'))).toEqual(ALL_STARBUCKS)
  })

  it('비교할 때 대소문자와 띄어쓰기를 없앤다', () => {
    expect(normalize('Star Bucks')).toBe('starbucks')
  })

  it('여러 낱말은 칸이 달라도 모두 들어 있으면 찾는다', () => {
    expect(keysOf(searchAll(data, '성수 주말'))).toEqual(['scrap-1'])
  })

  it('여러 낱말 중 하나라도 없으면 찾지 않는다', () => {
    expect(searchAll(data, '성수 빨래')).toEqual([])
  })

  it.each([
    ['결제 수단', '신한', 'money-2'],
    ['카테고리', '급여', 'money-3'],
    ['쉼표 · 원이 붙은 금액', '2,500,000원', 'money-3'],
  ])('가계부는 %s "%s" 로도 찾는다', (_case, query, key) => {
    expect(keysOf(searchAll(data, query))).toEqual([key])
  })

  it('같은 종류 안에서는 최근 것이 위로 온다', () => {
    expect(keysOf(searchAll(data, '5000'))).toEqual(['money-2', 'money-1'])
  })

  it('긴 글은 찾은 부분 앞뒤만 잘라 말줄임표를 붙인다', () => {
    const AROUND = 10
    const long = `${'가'.repeat(100)}스타벅스${'나'.repeat(100)}`

    expect(makeSnippet(long, '스타벅스', AROUND)).toBe(`…${'가'.repeat(AROUND)}스타벅스${'나'.repeat(AROUND)}…`)
  })

  it('찾은 부분은 대소문자가 달라도 형광펜 칠할 조각으로 나눈다', () => {
    expect(highlightParts('나는 Latte 좋아', ['latte'])).toEqual([
      { text: '나는 ', hit: false },
      { text: 'Latte', hit: true },
      { text: ' 좋아', hit: false },
    ])
  })
})

describe('할 일 메모 · 첨부 검색', () => {
  const todo: Todo = { ...okTodo(7, '발표 준비'), memo: '3쪽 표 먼저 정리', attachments: [{ name: '참고자료.pdf', type: 'application/pdf', size: 3, src: 'data:application/pdf;base64,AAAA' }] }

  it('할 일 메모 글로 찾고, 찾은 곳을 보여 준다', () => {
    const hits = searchAll({ todos: [todo] }, '먼저')

    expect(hits.map((hit) => [hit.key, hit.field])).toEqual([['todo-7', '메모']])
    expect(hits[0].snippet).toContain('먼저')
  })

  it('첨부 파일 이름으로 찾는다', () => {
    expect(searchAll({ todos: [todo] }, '참고자료').map((hit) => hit.field)).toEqual(['첨부 파일'])
  })
})

describe('스크랩 내용 검색', () => {
  const MY_CATEGORY = 3
  const long = `${'자취 꿀팁 모음입니다 '.repeat(8)}냉동실에 밥을 소분해서 얼려 두면 편해요 #자취 #살림`
  const scrap = okScrap(9, { title: '인스타 게시물', description: long, categoryId: MY_CATEGORY })

  it('제목에 없어도 내용(캡션) 속 글자로 찾고, 찾은 곳 앞뒤를 보여 준다', () => {
    const match = matchBookmark(scrap, splitQuery('냉동실 소분'))

    expect(match?.field).toBe('내용')
    expect(match?.snippet).toContain('냉동실에 밥을')
    expect(match?.snippet.startsWith('…')).toBe(true)
  })

  it.each([
    ['해시태그', '#살림', NO_CATEGORY_NAME, '내용'],
    ['카테고리 이름', '꿀팁저장', '꿀팁저장', '카테고리'],
  ])('%s "%s" 로도 찾는다', (_case, query, categoryName, field) => {
    expect(matchBookmark(scrap, splitQuery(query), categoryName)?.field).toBe(field)
  })

  it('어디에도 없는 낱말로는 찾지 않는다', () => {
    expect(matchBookmark(scrap, splitQuery('여행'), '꿀팁저장')).toBeNull()
  })

  it('전체 검색도 스크랩 카테고리 이름을 띄어쓰기 없이 찾는다', () => {
    const hits = searchAll({ bookmarks: [scrap], scrapCategories: [{ id: MY_CATEGORY, name: '자취를 위해 모으기', order: 0, createdAt: NOW }] }, '자취를위해')

    expect(hits.map((hit) => [hit.key, hit.field])).toEqual([['scrap-9', '카테고리']])
  })
})
