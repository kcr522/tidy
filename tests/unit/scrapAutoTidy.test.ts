import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Bookmark, ScrapCategory } from '../../src/db/types'

const { db } = await import('../../src/db/database')
const { applyTidy, planTidy, topicOf, undoTidy } = await import('../../src/lib/scrap/autoTidy')

let n = 1
const bm = (p: Partial<Bookmark>): Bookmark => ({ id: n++, url: 'https://www.instagram.com/p/x/', title: '', memo: '', isRead: 0, createdAt: '', updatedAt: '', ...p })
const cats: ScrapCategory[] = [
  { id: 1, name: '꿀팁', order: 0, createdAt: '' },
  { id: 2, name: '나중에 만들 거', order: 1, createdAt: '' },
]

describe('예전 스크랩 한 번에 정리 (planTidy)', () => {
  it('주제', () => {
    expect(topicOf('오사카 3박 4일 여행 코스')).toBe('여행')
    expect(topicOf('성수 카페 추천 커피 맛있음')).toBe('카페')
    expect(topicOf('오늘 날씨')).toBeNull()
  })
  it('맞는 카테고리가 있으면 거기로, 없으면 주제끼리 새 카테고리, 이미 나눈 건 그대로', () => {
    const all = [
      bm({ title: '5분 계란 덮밥 레시피', description: '재료: 계란 2개' }),
      bm({ title: '오사카 여행 코스', description: '도톤보리' }),
      bm({ title: '후쿠오카 2박 3일', description: '일본 여행 숙소' }),
      bm({ title: '제주 숙소 정리', description: '', categoryId: 1 }),
      bm({ title: '오늘 날씨 좋다' }),
      bm({ title: '도쿄 호텔 추천' }),
    ]
    const p = planTidy(all, cats)
    const to = new Map(p.moves.map((m) => [m.id, m.categoryId ?? m.newName]))
    expect(to.get(all[0].id!)).toBe(2)
    expect(to.get(all[1].id!)).toBe('여행')
    expect(to.get(all[2].id!)).toBe('여행')
    expect(to.get(all[5].id!)).toBe('여행')
    expect(to.has(all[3].id!)).toBe(false)
    expect(to.has(all[4].id!)).toBe(false)
    expect(p.newNames).toEqual(['여행'])
  })
  it('주제가 하나뿐이면 새로 만들지 않는다, 같은 해시태그 셋이면 그 이름으로', () => {
    const all = [bm({ title: '도쿄 여행' }), bm({ title: 'a', description: '#성수동 좋아' }), bm({ title: 'b', description: '#성수동 굿' }), bm({ title: 'c', description: '#성수동' })]
    const p = planTidy(all, [])
    expect(p.newNames).toEqual(['성수동'])
    expect(p.moves.find((m) => m.id === all[0].id)).toBeUndefined()
  })
})

describe('applyTidy · undoTidy', () => {
  beforeEach(async () => {
    await db.bookmarks.clear()
    await db.scrapCategories.clear()
  })
  it('새 카테고리를 만들어 넣고, 되돌리면 미분류 + 빈 새 카테고리는 지운다', async () => {
    const a = (await db.bookmarks.add({ url: 'https://a.com', title: '오사카 여행', memo: '', isRead: 0, createdAt: '', updatedAt: '' })) as number
    const b = (await db.bookmarks.add({ url: 'https://b.com', title: '교토 여행', memo: '', isRead: 0, createdAt: '', updatedAt: '' })) as number
    const r = await applyTidy({ moves: [{ id: a, newName: '여행' }, { id: b, newName: '여행' }], newNames: ['여행'] })
    expect(r.moved).toBe(2)
    expect(r.created).toEqual(['여행'])
    expect((await db.bookmarks.get(a))?.categoryId).toBeDefined()
    await undoTidy(r.undo)
    expect((await db.bookmarks.get(a))?.categoryId).toBeUndefined()
    expect(await db.scrapCategories.count()).toBe(0)
  })
})
