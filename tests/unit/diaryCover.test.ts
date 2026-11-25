import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { createDiaryRepo } from '../../src/repositories/diaryRepo'

let db: TidyDB
afterEach(async () => {
  await db?.delete()
})

const PHOTO_A = 'data:image/jpeg;base64,AAA'
const PHOTO_B = 'data:image/jpeg;base64,BBB'
const PHOTO_C = 'data:image/jpeg;base64,CCC'
const DAY = '2026-11-02'

describe('일기 대표 사진', () => {
  const twoPhotos = [{ src: PHOTO_A, time: '10:00' }, { src: PHOTO_B, time: '12:00' }]

  it('처음 저장하면 첫 장이 대표 사진이 된다', async () => {
    db = new TidyDB('diary-cover-1')
    const repo = createDiaryRepo(db)

    await repo.save(DAY, { text: '카페', photos: twoPhotos })

    expect((await repo.get(DAY))?.photo).toBe(PHOTO_A)
  })

  it('대표 사진을 고르면 바뀌고, 글이나 사진을 고쳐도 고른 사진을 지킨다', async () => {
    db = new TidyDB('diary-cover-1b')
    const repo = createDiaryRepo(db)
    await repo.save(DAY, { text: '카페', photos: twoPhotos })

    await repo.setCover(DAY, PHOTO_B)
    expect((await repo.get(DAY))?.photo).toBe(PHOTO_B)

    await repo.save(DAY, { text: '카페 투어', photos: [...twoPhotos, { src: PHOTO_C, time: '15:00' }] })
    expect((await repo.get(DAY))?.photo).toBe(PHOTO_B)
  })

  it('일기에 없는 사진은 대표 사진으로 고를 수 없다', async () => {
    db = new TidyDB('diary-cover-2')
    const repo = createDiaryRepo(db)
    await repo.save(DAY, { text: '', photos: [{ src: PHOTO_A }, { src: PHOTO_B }], cover: PHOTO_B })

    await repo.setCover(DAY, PHOTO_C)

    expect((await repo.get(DAY))?.photo).toBe(PHOTO_B)
  })

  it('대표 사진을 일기에서 빼면 첫 장이 대표가 된다', async () => {
    db = new TidyDB('diary-cover-3')
    const repo = createDiaryRepo(db)
    await repo.save(DAY, { text: '', photos: [{ src: PHOTO_A }, { src: PHOTO_B }], cover: PHOTO_B })

    await repo.save(DAY, { text: '', photos: [{ src: PHOTO_A }] })

    expect((await repo.get(DAY))?.photo).toBe(PHOTO_A)
  })
})
