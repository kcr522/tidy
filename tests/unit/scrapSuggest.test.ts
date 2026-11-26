import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { Bookmark, ScrapCategory } from '../../src/db/types'
import { isGenericTitle, needsFill } from '../../src/lib/scrap/enrich'
import { aiPickCategories, classOfName, hostOf, makeSuggester, parseAiPicks, tokens } from '../../src/lib/scrap/suggest'
import { createBookmarkRepo } from '../../src/repositories/bookmarkRepo'

// AI 는 바깥 서비스라 가짜로 바꾼다
const ai = vi.hoisted(() => ({ gemini: vi.fn(), groq: vi.fn() }))
vi.mock('../../src/lib/ai/gemini', () => ({ callGemini: ai.gemini }))
vi.mock('../../src/lib/ai/groq', () => ({ callGroq: ai.groq }))

const TIPS = 1
const LIVING = 2
const TO_MAKE = 3
const WORKOUT = 4
const TRAVEL = 5
const UNSORTED = null
const NOTHING_LEARNED: Bookmark[] = []
const myCategories: ScrapCategory[] = [
  { id: TIPS, name: '꿀팁', order: 0, createdAt: '' },
  { id: LIVING, name: '자취를 위해 모으기', order: 1, createdAt: '' },
  { id: TO_MAKE, name: '나중에 만들 거', order: 2, createdAt: '' },
  { id: WORKOUT, name: '운동', order: 3, createdAt: '' },
  { id: TRAVEL, name: '여행', order: 4, createdAt: '' },
]
let nextId = 100
/** 인스타 게시물 스크랩 하나에서 필요한 칸만 바꾼다 */
const okBookmark = (over: Partial<Bookmark>): Bookmark => ({ id: nextId++, url: 'https://www.instagram.com/p/x/', title: '', memo: '', isRead: 0, createdAt: '', updatedAt: '', ...over })

describe('카테고리 추천 (AI 없이)', () => {
  it.each([
    ['나중에 만들 거', 'make'],
    ['자취템', 'living'],
  ])('카테고리 이름 "%s" 의 뜻은 %s 로 본다', (name, kind) => {
    expect(classOfName(name)).toBe(kind)
  })

  it.each([
    ['레시피는 "나중에 만들 거"', { title: '5분 완성 계란 덮밥 레시피', description: '재료: 계란 2개, 간장' }, TO_MAKE],
    ['수납 꿀팁은 "자취를 위해 모으기"', { title: '원룸 수납 정리 꿀팁', description: '자취방 다이소 수납템' }, LIVING],
    ['카테고리 이름(운동)이 글에 나오면 그 카테고리', { title: '하체 운동 루틴', description: '스쿼트 3세트' }, WORKOUT],
  ])('%s 로 추천한다', (_case, scrap, categoryId) => {
    const suggest = makeSuggester(myCategories, NOTHING_LEARNED)

    expect(suggest(okBookmark(scrap))?.categoryId).toBe(categoryId)
  })

  it('전에 나눈 스크랩의 낱말 · 해시태그 · 사이트를 배워서 추천한다', () => {
    const sorted = [
      okBookmark({ categoryId: TRAVEL, title: '오사카 3박 4일 코스', description: '#일본여행 도톤보리 유니버설' }),
      okBookmark({ categoryId: TRAVEL, title: '후쿠오카 맛집 지도', description: '#일본여행 텐진 나카스' }),
      okBookmark({ categoryId: WORKOUT, title: '필라테스 홈트', description: '#홈트 매트' }),
      okBookmark({ categoryId: TIPS, url: 'https://www.coupang.com/vp/1', title: '쿠팡 로켓배송 팁' }),
    ]

    const suggest = makeSuggester(myCategories, sorted)

    expect(suggest(okBookmark({ title: '교토 당일치기', description: '#일본여행 기요미즈데라' }))?.categoryId).toBe(TRAVEL)
    expect(suggest(okBookmark({ url: 'https://coupang.com/vp/2', title: '상품' }))?.categoryId).toBe(TIPS)
  })

  it.each(['오늘 날씨 좋다', '@abc의 게시물'])('아무 단서가 없는 "%s" 는 고르지 않는다', (title) => {
    const suggest = makeSuggester(myCategories, NOTHING_LEARNED)

    expect(suggest(okBookmark({ title }))).toBeNull()
  })

  it('낱말을 나눌 때 해시태그는 그대로, 조사는 떼어 낸다', () => {
    expect(tokens('자취방에서 #꿀팁 공유')).toEqual(expect.arrayContaining(['#꿀팁', '자취방']))
  })

  it.each([
    // 인스타는 모든 스크랩이 같은 사이트라 단서가 되지 않는다
    ['https://www.instagram.com/p/a/', null],
    ['https://www.coupang.com/a', 'coupang.com'],
  ])('%s 의 사이트 단서는 %s', (url, host) => {
    expect(hostOf(url)).toBe(host)
  })
})

describe('제목 · 내용 다시 채우기 대상', () => {
  it.each([
    ['사이트 이름뿐인 제목', '네이버 블로그', 'https://blog.naver.com/a/1', true],
    ['주소 그대로인 제목', 'example.com', 'https://www.example.com/a', true],
    ['직접 쓴 제목', '성수 카페 정리', 'https://blog.naver.com/a/1', false],
  ])('%s "%s" 를 흔한 제목으로 보는가: $3', (_case, title, url, isGeneric) => {
    expect(isGenericTitle({ title, url })).toBe(isGeneric)
  })

  it.each([
    ['인스타 자동 제목', '@abc의 게시물', '캡션', true],
    ['내용이 빈', '성수 카페', '', true],
    ['제목 · 내용이 다 있는', '성수 카페', '캡션', false],
  ])('%s 인스타 스크랩을 다시 채우는가: $3', (_case, title, description, isTarget) => {
    expect(needsFill(okBookmark({ title, source: 'instagram', description }))).toBe(isTarget)
  })
})

describe('AI 는 누를 때만, 내 카테고리로', () => {
  it('AI 답의 카테고리 번호(1부터)를 카테고리 순서(0부터)로 바꾸고, 0 은 빈칸으로 둔다', () => {
    expect(parseAiPicks('{"results":[{"n":1,"c":2},{"n":2,"c":0}]}', 2, 3)).toEqual([1, null])
  })

  it('기본(AI 없음)이면 AI 에게 묻지 않는다', async () => {
    ai.gemini.mockReset()

    await expect(aiPickCategories({ engine: 'local' } as never, myCategories, [{ id: 1, text: 'a' }])).rejects.toThrow()

    expect(ai.gemini).not.toHaveBeenCalled()
  })

  it('Tidy AI 로 물으면 고른 카테고리를 id 로 돌려준다', async () => {
    ai.gemini.mockResolvedValueOnce(`{"results":[{"n":1,"c":${TRAVEL}}]}`)

    const picks = await aiPickCategories({ engine: 'tidy' } as never, myCategories, [{ id: 9, text: '교토 여행' }])

    expect(picks.result.get(9)).toBe(TRAVEL)
  })
})

const dbs: TidyDB[] = []
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => db.delete()))
})

describe('카테고리 한꺼번에 바꾸기 (setCategories)', () => {
  const newRepo = () => {
    const db = new TidyDB(`sort-${Math.random()}`)
    dbs.push(db)
    return createBookmarkRepo(db)
  }

  it('이미 나눈 스크랩도 바꾸고, 바뀌지 않은 것(미분류 → 미분류)은 세지 않는다', async () => {
    const repo = newRepo()
    const sorted = await repo.add({ url: 'https://a.com', title: 'a', memo: '', categoryId: TIPS })
    const unsorted = await repo.add({ url: 'https://b.com', title: 'b', memo: '' })

    const changed = await repo.setCategories([{ id: sorted, categoryId: LIVING }, { id: unsorted, categoryId: UNSORTED }])

    expect(changed).toBe(1)
    expect((await repo.get(sorted))?.categoryId).toBe(LIVING)
  })

  it('나눈 스크랩을 미분류로 되돌린다', async () => {
    const repo = newRepo()
    const id = await repo.add({ url: 'https://a.com', title: 'a', memo: '', categoryId: TIPS })

    expect(await repo.setCategories([{ id, categoryId: UNSORTED }])).toBe(1)

    expect((await repo.get(id))?.categoryId).toBeUndefined()
  })
})
