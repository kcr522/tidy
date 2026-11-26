import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Bookmark, ScrapCategory } from '../../src/db/types'

const { db } = await import('../../src/db/database')
const { applyTidy, planTidy, topicOf, undoTidy } = await import('../../src/lib/scrap/autoTidy')

const UNREAD = 0 as const
const NO_CATEGORIES: ScrapCategory[] = []
const TIPS_ID = 1
const TO_MAKE_ID = 2

let nextId = 1
/** 인스타 게시물 스크랩 하나에서 필요한 칸만 바꾼다 */
const okBookmark = (over: Partial<Bookmark>): Bookmark => ({ id: nextId++, url: 'https://www.instagram.com/p/x/', title: '', memo: '', isRead: UNREAD, createdAt: '', updatedAt: '', ...over })
const myCategories: ScrapCategory[] = [
  { id: TIPS_ID, name: '꿀팁', order: 0, createdAt: '' },
  { id: TO_MAKE_ID, name: '나중에 만들 거', order: 1, createdAt: '' },
]

describe('예전 스크랩 한 번에 정리 (planTidy)', () => {
  it.each([
    ['오사카 3박 4일 여행 코스', '여행'],
    ['성수 카페 추천 커피 맛있음', '카페'],
    ['오늘 날씨', null],
  ])('"%s" 의 주제는 %s', (title, topic) => {
    expect(topicOf(title)).toBe(topic)
  })

  it('맞는 카테고리가 있으면 거기로, 없으면 같은 주제끼리 새 카테고리로, 이미 나눈 것 · 주제 없는 것은 그대로 둔다', () => {
    const recipe = okBookmark({ title: '5분 계란 덮밥 레시피', description: '재료: 계란 2개' })
    const trips = [okBookmark({ title: '오사카 여행 코스', description: '도톤보리' }), okBookmark({ title: '후쿠오카 2박 3일', description: '일본 여행 숙소' }), okBookmark({ title: '도쿄 호텔 추천' })]
    const alreadySorted = okBookmark({ title: '제주 숙소 정리', description: '', categoryId: TIPS_ID })
    const noTopic = okBookmark({ title: '오늘 날씨 좋다' })

    const plan = planTidy([recipe, ...trips, alreadySorted, noTopic], myCategories)

    const target = new Map(plan.moves.map((move) => [move.id, move.categoryId ?? move.newName]))
    expect(target.get(recipe.id!)).toBe(TO_MAKE_ID)
    expect(trips.map((trip) => target.get(trip.id!))).toEqual(['여행', '여행', '여행'])
    expect(target.has(alreadySorted.id!)).toBe(false)
    expect(target.has(noTopic.id!)).toBe(false)
    expect(plan.newNames).toEqual(['여행'])
  })

  it('주제가 같은 스크랩이 하나뿐이면 새 카테고리를 만들지 않고, 같은 해시태그가 셋이면 그 이름으로 만든다', () => {
    const lonelyTrip = okBookmark({ title: '도쿄 여행' })
    const tagged = [okBookmark({ title: 'a', description: '#성수동 좋아' }), okBookmark({ title: 'b', description: '#성수동 굿' }), okBookmark({ title: 'c', description: '#성수동' })]

    const plan = planTidy([lonelyTrip, ...tagged], NO_CATEGORIES)

    expect(plan.newNames).toEqual(['성수동'])
    expect(plan.moves.find((move) => move.id === lonelyTrip.id)).toBeUndefined()
  })
})

describe('정리 적용 · 되돌리기 (applyTidy · undoTidy)', () => {
  beforeEach(async () => {
    await db.bookmarks.clear()
    await db.scrapCategories.clear()
  })

  const addTrip = async (url: string, title: string) => (await db.bookmarks.add({ url, title, memo: '', isRead: UNREAD, createdAt: '', updatedAt: '' })) as number

  it('새 카테고리를 만들어 스크랩을 넣는다', async () => {
    const osaka = await addTrip('https://a.com', '오사카 여행')
    const kyoto = await addTrip('https://b.com', '교토 여행')

    const result = await applyTidy({ moves: [{ id: osaka, newName: '여행' }, { id: kyoto, newName: '여행' }], newNames: ['여행'] })

    expect(result.moved).toBe(2)
    expect(result.created).toEqual(['여행'])
    expect((await db.bookmarks.get(osaka))?.categoryId).toBeDefined()
  })

  it('되돌리면 스크랩은 미분류로 돌아가고 비게 된 새 카테고리는 지운다', async () => {
    const osaka = await addTrip('https://a.com', '오사카 여행')
    const result = await applyTidy({ moves: [{ id: osaka, newName: '여행' }], newNames: ['여행'] })

    await undoTidy(result.undo)

    expect((await db.bookmarks.get(osaka))?.categoryId).toBeUndefined()
    expect(await db.scrapCategories.count()).toBe(0)
  })
})
