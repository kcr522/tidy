import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { createDiaryRepo } from '../../src/repositories/diaryRepo'

let db: TidyDB
afterEach(async () => {
  await db?.delete()
})

const A = 'data:image/jpeg;base64,AAA'
const B = 'data:image/jpeg;base64,BBB'
const C = 'data:image/jpeg;base64,CCC'

describe('일기 대표 사진', () => {
  it('처음에는 첫 장, 고르면 바뀌고 일기를 고쳐도 그대로 남는다', async () => {
    db = new TidyDB('diary-cover-1')
    const repo = createDiaryRepo(db)
    await repo.save('2026-11-02', { text: '카페', photos: [{ src: A, time: '10:00' }, { src: B, time: '12:00' }] })
    expect((await repo.get('2026-11-02'))?.photo).toBe(A)
    await repo.setCover('2026-11-02', B)
    expect((await repo.get('2026-11-02'))?.photo).toBe(B)
    // 글이나 사진을 고쳐도 대표 사진은 지킨다
    await repo.save('2026-11-02', { text: '카페 투어', photos: [{ src: A, time: '10:00' }, { src: B, time: '12:00' }, { src: C, time: '15:00' }] })
    expect((await repo.get('2026-11-02'))?.photo).toBe(B)
  })

  it('대표 사진을 빼면 첫 장으로, 일기에 없는 사진은 고를 수 없다', async () => {
    db = new TidyDB('diary-cover-2')
    const repo = createDiaryRepo(db)
    await repo.save('2026-11-03', { text: '', photos: [{ src: A }, { src: B }], cover: B })
    expect((await repo.get('2026-11-03'))?.photo).toBe(B)
    await repo.setCover('2026-11-03', C)
    expect((await repo.get('2026-11-03'))?.photo).toBe(B)
    await repo.save('2026-11-03', { text: '', photos: [{ src: A }] })
    expect((await repo.get('2026-11-03'))?.photo).toBe(A)
  })
})
