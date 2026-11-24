import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { Bookmark, ScrapCategory } from '../../src/db/types'
import { isGenericTitle, needsFill } from '../../src/lib/scrap/enrich'
import { aiPickCategories, classOfName, hostOf, makeSuggester, parseAiPicks, tokens } from '../../src/lib/scrap/suggest'
import { createBookmarkRepo } from '../../src/repositories/bookmarkRepo'

const ai = vi.hoisted(() => ({ gemini: vi.fn(), groq: vi.fn() }))
vi.mock('../../src/lib/ai/gemini', () => ({ callGemini: ai.gemini }))
vi.mock('../../src/lib/ai/groq', () => ({ callGroq: ai.groq }))

const cats: ScrapCategory[] = [
  { id: 1, name: '꿀팁', order: 0, createdAt: '' },
  { id: 2, name: '자취를 위해 모으기', order: 1, createdAt: '' },
  { id: 3, name: '나중에 만들 거', order: 2, createdAt: '' },
  { id: 4, name: '운동', order: 3, createdAt: '' },
  { id: 5, name: '여행', order: 4, createdAt: '' },
]
let n = 100
const bm = (p: Partial<Bookmark>): Bookmark => ({ id: n++, url: 'https://www.instagram.com/p/x/', title: '', memo: '', isRead: 0, createdAt: '', updatedAt: '', ...p })

describe('카테고리 추천 (AI 없이)', () => {
  it('카테고리 이름 뜻으로 낱말 규칙을 쓴다', () => {
    expect(classOfName('나중에 만들 거')).toBe('make')
    expect(classOfName('자취템')).toBe('living')
    const s = makeSuggester(cats, [])
    expect(s(bm({ title: '5분 완성 계란 덮밥 레시피', description: '재료: 계란 2개, 간장' }))?.categoryId).toBe(3)
    expect(s(bm({ title: '원룸 수납 정리 꿀팁', description: '자취방 다이소 수납템' }))?.categoryId).toBe(2)
  })
  it('카테고리 이름 낱말이 글에 나오면 그쪽', () => {
    const s = makeSuggester(cats, [])
    expect(s(bm({ title: '하체 운동 루틴', description: '스쿼트 3세트' }))?.categoryId).toBe(4)
  })
  it('전에 나눈 스크랩의 낱말 · 해시태그 · 사이트를 배운다', () => {
    const all = [
      bm({ categoryId: 5, title: '오사카 3박 4일 코스', description: '#일본여행 도톤보리 유니버설' }),
      bm({ categoryId: 5, title: '후쿠오카 맛집 지도', description: '#일본여행 텐진 나카스' }),
      bm({ categoryId: 4, title: '필라테스 홈트', description: '#홈트 매트' }),
      bm({ categoryId: 1, url: 'https://www.coupang.com/vp/1', title: '쿠팡 로켓배송 팁' }),
    ]
    const s = makeSuggester(cats, all)
    const r = s(bm({ title: '교토 당일치기', description: '#일본여행 기요미즈데라' }))
    expect(r?.categoryId).toBe(5)
    expect(s(bm({ url: 'https://coupang.com/vp/2', title: '상품' }))?.categoryId).toBe(1)
  })
  it('아무 단서가 없으면 고르지 않는다', () => {
    const s = makeSuggester(cats, [])
    expect(s(bm({ title: '오늘 날씨 좋다' }))).toBeNull()
    expect(s(bm({ title: '@abc의 게시물' }))).toBeNull()
  })
  it('낱말 나누기: 해시태그와 조사', () => {
    expect(tokens('자취방에서 #꿀팁 공유')).toEqual(expect.arrayContaining(['#꿀팁', '자취방']))
    expect(hostOf('https://www.instagram.com/p/a/')).toBeNull()
    expect(hostOf('https://www.coupang.com/a')).toBe('coupang.com')
  })
})

describe('제목 · 내용 다시 채우기 대상', () => {
  it('사이트 이름만 있는 제목, 빈 내용, 인스타 자동 제목', () => {
    expect(isGenericTitle({ title: '네이버 블로그', url: 'https://blog.naver.com/a/1' })).toBe(true)
    expect(isGenericTitle({ title: 'example.com', url: 'https://www.example.com/a' })).toBe(true)
    expect(isGenericTitle({ title: '성수 카페 정리', url: 'https://blog.naver.com/a/1' })).toBe(false)
    expect(needsFill(bm({ title: '@abc의 게시물', source: 'instagram', description: '캡션' }))).toBe(true)
    expect(needsFill(bm({ title: '성수 카페', source: 'instagram', description: '' }))).toBe(true)
    expect(needsFill(bm({ title: '성수 카페', source: 'instagram', description: '캡션' }))).toBe(false)
  })
})

describe('AI는 누를 때만, 내 카테고리로', () => {
  it('답 읽기', () => {
    expect(parseAiPicks('{"results":[{"n":1,"c":2},{"n":2,"c":0}]}', 2, 3)).toEqual([1, null])
  })
  it('기본(AI 없음)이면 묻지 않는다', async () => {
    await expect(aiPickCategories({ engine: 'local' } as never, cats, [{ id: 1, text: 'a' }])).rejects.toThrow()
    expect(ai.gemini).not.toHaveBeenCalled()
  })
  it('Tidy AI 로 물어서 카테고리 id 로 돌려준다', async () => {
    ai.gemini.mockResolvedValueOnce('{"results":[{"n":1,"c":5}]}')
    const r = await aiPickCategories({ engine: 'tidy' } as never, cats, [{ id: 9, text: '교토 여행' }])
    expect(r.result.get(9)).toBe(5)
  })
})

const dbs: TidyDB[] = []
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()))
})

describe('setCategories', () => {
  it('이미 나눈 것도 바꾸고, 미분류로도 돌린다', async () => {
    const db = new TidyDB(`sort-${Math.random()}`)
    dbs.push(db)
    const repo = createBookmarkRepo(db)
    const a = await repo.add({ url: 'https://a.com', title: 'a', memo: '', categoryId: 1 })
    const b = await repo.add({ url: 'https://b.com', title: 'b', memo: '' })
    expect(await repo.setCategories([{ id: a, categoryId: 2 }, { id: b, categoryId: null }])).toBe(1)
    expect((await repo.get(a))?.categoryId).toBe(2)
    expect(await repo.setCategories([{ id: a, categoryId: null }])).toBe(1)
    expect((await repo.get(a))?.categoryId).toBeUndefined()
  })
})
