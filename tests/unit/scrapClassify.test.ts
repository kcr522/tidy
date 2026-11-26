import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { classifyScraps, classifyText, isUnsortedInstagram, parseClassifyJson, ruleClassify } from '../../src/lib/scrap/classify'
import { createBookmarkRepo } from '../../src/repositories/bookmarkRepo'

// AI 는 바깥 서비스라 가짜로 바꾼다
const ai = vi.hoisted(() => ({ gemini: vi.fn(), groq: vi.fn() }))
vi.mock('../../src/lib/ai/gemini', () => ({ callGemini: ai.gemini }))
vi.mock('../../src/lib/ai/groq', () => ({ callGroq: ai.groq }))

const NO_MATCH = null
const okKeys = { engine: 'gemini' as const, geminiKey: 'g', groqKey: 'q' }

const dbs: TidyDB[] = []
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => db.delete()))
})

describe('인스타 캡션으로 나누기 (낱말 규칙)', () => {
  it.each([
    // 레시피 · 베이킹 · DIY
    ['5분 완성 계란 덮밥 레시피 🍳 재료: 계란 2개, 간장', 'make'],
    ['자취생 초간단 요리 레시피 모음', 'make'],
    ['코바늘 키링 도안 공유해요', 'make'],
    // 자취 · 살림 · 인테리어
    ['자취방 필수템 10가지 다이소 추천', 'living'],
    ['원룸 수납 정리 꿀팁 🏠', 'living'],
    ['화장실 곰팡이 청소 이렇게 하세요', 'living'],
    // 사고 싶은 물건
    ['올겨울 코트 하울 🛍️ 구매처는 프로필 링크', 'buy'],
    ['품절 대란 쿠션 재입고됐어요', 'buy'],
    // 자취방에 쓸 물건은 사는 것보다 자취 쪽
    ['자취방 필수템 구매 리스트', 'living'],
    // 그 밖의 정보
    ['엑셀 단축키 모르면 손해', 'tip'],
    ['적금 통장 쪼개기 방법', 'tip'],
    ['오늘 날씨 좋다', NO_MATCH],
    ['', NO_MATCH],
  ])('"%s" 는 %s 로 나눈다', (caption, kind) => {
    expect(ruleClassify(caption)).toBe(kind)
  })

  it.each([
    ['븐보다 두껍고 더 바삭한 고구마 맛탕 나왔어요! 바삭아니고 빠삭', 'make'],
    ['19,000원의 행복 이거다.. 편의점 3곳 돌아서 겨우 구한 복담주', 'tip'],
    ['전재산 다 걸고 내돈내산임', 'buy'],
    ['좁은 방 공간 활용 선반 추천', 'living'],
  ])('폰에서 미분류로 남던 캡션 "%s" 도 %s 로 나눈다', (caption, kind) => {
    expect(ruleClassify(caption)).toBe(kind)
  })

  it('"@아이디의 게시물" 자동 제목은 분류할 글에서 뺀다', () => {
    expect(classifyText({ title: '@cook_kim의 게시물', description: '', memo: '' })).toBe('')
  })

  it('직접 쓴 제목과 설명은 줄을 나눠 분류할 글로 쓴다', () => {
    expect(classifyText({ title: '계란 덮밥', description: '레시피', memo: '' })).toBe('계란 덮밥\n레시피')
  })
})

describe('AI 답 읽기 (parseClassifyJson)', () => {
  it.each([
    ['JSON 답', '{"results":[{"n":1,"c":"buy"}]}', 1, ['buy']],
    ['코드 블록에 싸이고 순서가 섞인 답 (모르는 번호 · none 은 빈칸)', '```json\n{"results":[{"n":1,"c":"make"},{"n":3,"c":"none"},{"n":2,"c":"living"},{"n":9,"c":"tip"}]}\n```', 3, ['make', 'living', null]],
    ['중간에 잘린 JSON', '{"results":[{"n":1,"c":"tip"},{"n":2,"c":"make"},{"n":3,"c":"liv', 3, ['tip', 'make', null]],
    ['"번호: 종류" 줄글', '1: make\n2: living\n3: none', 3, ['make', 'living', null]],
  ])('%s 도 읽을 수 있는 만큼 읽는다', (_case, answer, count, kinds) => {
    expect(parseClassifyJson(answer, count)).toEqual(kinds)
  })

  it('읽을 것이 하나도 없는 답은 오류로 알린다', () => {
    expect(() => parseClassifyJson('모르겠어요', 2)).toThrow()
  })
})

describe('여러 스크랩 한꺼번에 나누기 (classifyScraps)', () => {
  it('기본(AI 없이)으로 나누고, 캡션 없는 것은 빈칸으로 둔다', async () => {
    const out = await classifyScraps({ engine: 'local' }, [
      { id: 1, text: '쿠키 레시피' },
      { id: 2, text: '' },
      { id: 3, text: '자취 꿀템' },
    ])

    expect(out.engine).toBe('local')
    expect([...out.result.entries()]).toEqual(expect.arrayContaining([[1, 'make'], [2, null], [3, 'living']]))
  })

  it('Gemini 사용량이 다 떨어지면 Groq 로 (JSON 모드 없이) 한 번에 20개씩 나눈다', async () => {
    // 45개 = 20 + 20 + 5 → Groq 세 번
    const ITEMS = 45
    ai.gemini.mockReset().mockRejectedValue(new Error('오늘 무료 사용량을 다 썼어요'))
    ai.groq.mockReset().mockImplementation(async (_key: string, req: { user: string; json?: boolean }) => {
      expect(req.json).toBeUndefined()
      const asked = (req.user.match(/^\[\d+\]$/gm) ?? []).length
      return { text: JSON.stringify({ results: Array.from({ length: asked }, (_, i) => ({ n: i + 1, c: 'living' })) }), model: 'm' }
    })
    const items = Array.from({ length: ITEMS }, (_, i) => ({ id: i + 1, text: `글 ${i}` }))

    const out = await classifyScraps(okKeys, items)

    expect(ai.gemini).toHaveBeenCalledTimes(1)
    expect(ai.groq).toHaveBeenCalledTimes(3)
    expect(out).toMatchObject({ engine: 'groq', error: undefined })
    expect([...out.result.values()].every((kind) => kind === 'living')).toBe(true)
  })

  it('Groq 도 막히면 낱말 규칙으로 나누고, 두 AI 의 이유를 한 번씩 알린다', async () => {
    ai.gemini.mockReset().mockRejectedValue(new Error('A'))
    ai.groq.mockReset().mockRejectedValue(new Error('B'))

    const out = await classifyScraps(okKeys, [{ id: 1, text: '쿠키 레시피' }])

    expect(out.result.get(1)).toBe('make')
    expect(out.error).toBe('A · 예비 AI(Groq)도 안 됐어요: B')
    expect(out.engine).toBe('local')
  })
})

describe('카테고리 한꺼번에 넣기 (assignCategories)', () => {
  const newDb = () => {
    const db = new TidyDB('classify-test')
    dbs.push(db)
    return db
  }
  const instaPost = (code: string) => ({ url: `https://www.instagram.com/p/${code}/`, title: `@${code}의 게시물`, memo: '', source: 'instagram' as const })

  it('카테고리 없는 인스타 스크랩만 아직 안 나눈 것으로 본다', async () => {
    const db = newDb()
    const repo = createBookmarkRepo(db)
    const unsorted = await repo.add(instaPost('A1'))
    const sorted = await repo.add({ ...instaPost('C1'), categoryId: 1 })

    expect(isUnsortedInstagram((await db.bookmarks.get(unsorted))!)).toBe(true)
    expect(isUnsortedInstagram((await db.bookmarks.get(sorted))!)).toBe(false)
  })

  it('없는 카테고리는 한 번만 만들고, 이미 나눈 스크랩은 건드리지 않는다', async () => {
    const db = newDb()
    const repo = createBookmarkRepo(db)
    const [a, b, c] = [await repo.add(instaPost('A1')), await repo.add(instaPost('B1')), await repo.add(instaPost('C1'))]
    const mine = await db.scrapCategories.add({ name: '내 카테고리', order: 99, createdAt: '2026-11-17T00:00:00Z' })
    await db.bookmarks.update(c, { categoryId: mine })

    const changed = await repo.assignCategories([
      { id: a, name: '나중에 만들 거' },
      { id: b, name: '나중에 만들 거' },
      { id: c, name: '꿀팁' },
    ])

    expect(changed).toBe(2)
    const names = (await db.scrapCategories.toArray()).map((category) => category.name)
    expect(names.filter((name) => name === '나중에 만들 거')).toHaveLength(1)
    expect(names.filter((name) => name === '꿀팁')).toHaveLength(1)
    expect((await db.bookmarks.get(c))!.categoryId).toBe(mine)
  })
})
