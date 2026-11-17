import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { classifyScraps, classifyText, isUnsortedInstagram, parseClassifyJson, ruleClassify } from '../../src/lib/scrap/classify'
import { createBookmarkRepo } from '../../src/repositories/bookmarkRepo'

const ai = vi.hoisted(() => ({ gemini: vi.fn(), groq: vi.fn() }))
vi.mock('../../src/lib/ai/gemini', () => ({ callGemini: ai.gemini }))
vi.mock('../../src/lib/ai/groq', () => ({ callGroq: ai.groq }))

const dbs: TidyDB[] = []
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()))
})

describe('인스타 캡션으로 나누기 (낱말 규칙)', () => {
  it('레시피·베이킹·DIY는 나중에 만들 거', () => {
    expect(ruleClassify('5분 완성 계란 덮밥 레시피 🍳 재료: 계란 2개, 간장')).toBe('make')
    expect(ruleClassify('자취생 초간단 요리 레시피 모음')).toBe('make')
    expect(ruleClassify('코바늘 키링 도안 공유해요')).toBe('make')
  })
  it('자취·살림·인테리어는 자취를 위해 모으기', () => {
    expect(ruleClassify('자취방 필수템 10가지 다이소 추천')).toBe('living')
    expect(ruleClassify('원룸 수납 정리 꿀팁 🏠')).toBe('living')
    expect(ruleClassify('화장실 곰팡이 청소 이렇게 하세요')).toBe('living')
  })
  it('사고 싶은 물건은 나중에 살 것', () => {
    expect(ruleClassify('올겨울 코트 하울 🛍️ 구매처는 프로필 링크')).toBe('buy')
    expect(ruleClassify('품절 대란 쿠션 재입고됐어요')).toBe('buy')
    // 자취방에 쓸 물건은 자취 쪽
    expect(ruleClassify('자취방 필수템 구매 리스트')).toBe('living')
    expect(parseClassifyJson('{"results":[{"n":1,"c":"buy"}]}', 1)).toEqual(['buy'])
  })
  it('그 밖의 정보는 꿀팁, 아무 낱말도 없으면 null', () => {
    expect(ruleClassify('엑셀 단축키 모르면 손해')).toBe('tip')
    expect(ruleClassify('적금 통장 쪼개기 방법')).toBe('tip')
    expect(ruleClassify('오늘 날씨 좋다')).toBeNull()
    expect(ruleClassify('')).toBeNull()
  })
  it('"@아이디의 게시물" 자동 제목은 분류 글에서 뺀다', () => {
    expect(classifyText({ title: '@cook_kim의 게시물', description: '', memo: '' })).toBe('')
    expect(classifyText({ title: '계란 덮밥', description: '레시피', memo: '' })).toBe('계란 덮밥\n레시피')
  })
  it('폰에서 그대로 남던 캡션도 나눈다', () => {
    expect(ruleClassify('븐보다 두껍고 더 바삭한 고구마 맛탕 나왔어요! 바삭아니고 빠삭')).toBe('make')
    expect(ruleClassify('19,000원의 행복 이거다.. 편의점 3곳 돌아서 겨우 구한 복담주')).toBe('tip')
    expect(ruleClassify('전재산 다 걸고 내돈내산임')).toBe('buy')
    expect(ruleClassify('좁은 방 공간 활용 선반 추천')).toBe('living')
  })
  it('잘리거나 모양이 다른 AI 답도 읽을 수 있는 만큼 읽는다', () => {
    expect(parseClassifyJson('{"results":[{"n":1,"c":"tip"},{"n":2,"c":"make"},{"n":3,"c":"liv', 3)).toEqual(['tip', 'make', null])
    expect(parseClassifyJson('1: make\n2: living\n3: none', 3)).toEqual(['make', 'living', null])
  })
  it('AI 답(JSON)을 읽는다', () => {
    expect(parseClassifyJson('```json\n{"results":[{"n":1,"c":"make"},{"n":3,"c":"none"},{"n":2,"c":"living"},{"n":9,"c":"tip"}]}\n```', 3)).toEqual(['make', 'living', null])
    expect(() => parseClassifyJson('모르겠어요', 2)).toThrow()
  })
  it('기본(AI 없이)으로 여러 개 나누고, 캡션 없는 건 그대로', async () => {
    const out = await classifyScraps({ engine: 'local' }, [
      { id: 1, text: '쿠키 레시피' },
      { id: 2, text: '' },
      { id: 3, text: '자취 꿀템' },
    ])
    expect(out.engine).toBe('local')
    expect([...out.result.entries()]).toEqual(expect.arrayContaining([[1, 'make'], [2, null], [3, 'living']]))
  })
})

describe('AI로 나누기', () => {
  it('Gemini 사용량이 다 떨어지면 남은 건 Groq 로 (JSON 모드 없이), 한 번에 20개씩', async () => {
    ai.gemini.mockReset().mockRejectedValue(new Error('오늘 무료 사용량을 다 썼어요'))
    ai.groq.mockReset().mockImplementation(async (_k: string, req: { user: string; json?: boolean }) => {
      expect(req.json).toBeUndefined()
      const n = (req.user.match(/^\[\d+\]$/gm) ?? []).length
      return { text: JSON.stringify({ results: Array.from({ length: n }, (_, i) => ({ n: i + 1, c: 'living' })) }), model: 'm' }
    })
    const items = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, text: `글 ${i}` }))
    const out = await classifyScraps({ engine: 'gemini', geminiKey: 'g', groqKey: 'q' }, items)
    expect(ai.gemini).toHaveBeenCalledTimes(1)
    expect(ai.groq).toHaveBeenCalledTimes(3)
    expect(out.engine).toBe('groq')
    expect(out.error).toBeUndefined()
    expect([...out.result.values()].every((c) => c === 'living')).toBe(true)
  })
  it('Groq 도 막히면 낱말 규칙으로, 이유는 한 번씩', async () => {
    ai.gemini.mockReset().mockRejectedValue(new Error('A'))
    ai.groq.mockReset().mockRejectedValue(new Error('B'))
    const out = await classifyScraps({ engine: 'gemini', geminiKey: 'g', groqKey: 'q' }, [{ id: 1, text: '쿠키 레시피' }])
    expect(out.result.get(1)).toBe('make')
    expect(out.error).toBe('A · 예비 AI(Groq)도 안 됐어요: B')
    expect(out.engine).toBe('local')
  })
})

describe('카테고리 한꺼번에 나누기', () => {
  it('없는 카테고리는 만들고, 이미 나눈 스크랩은 건드리지 않는다', async () => {
    const d = new TidyDB('classify-test')
    dbs.push(d)
    const repo = createBookmarkRepo(d)
    const a = await repo.add({ url: 'https://www.instagram.com/p/A1/', title: '@a의 게시물', memo: '', source: 'instagram' })
    const b = await repo.add({ url: 'https://www.instagram.com/p/B1/', title: '@b의 게시물', memo: '', source: 'instagram' })
    const c = await repo.add({ url: 'https://www.instagram.com/p/C1/', title: '@c의 게시물', memo: '', source: 'instagram' })
    const keep = await d.scrapCategories.add({ name: '내 카테고리', order: 99, createdAt: '2026-11-17T00:00:00Z' })
    await d.bookmarks.update(c, { categoryId: keep })
    expect(isUnsortedInstagram((await d.bookmarks.get(a))!)).toBe(true)
    expect(isUnsortedInstagram((await d.bookmarks.get(c))!)).toBe(false)
    const n = await repo.assignCategories([
      { id: a, name: '나중에 만들 거' },
      { id: b, name: '나중에 만들 거' },
      { id: c, name: '꿀팁' },
    ])
    expect(n).toBe(2)
    const cats = await d.scrapCategories.toArray()
    expect(cats.filter((x) => x.name === '나중에 만들 거')).toHaveLength(1)
    expect(cats.filter((x) => x.name === '꿀팁')).toHaveLength(1)
    expect((await d.bookmarks.get(c))!.categoryId).toBe(keep)
  })
})
