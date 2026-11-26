import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { MAX_DIARY_PHOTOS, cleanPhotos, diaryPhotos, nowTime, sortByTime } from '../../src/lib/diaryPhotos'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { createDiaryRepo } from '../../src/repositories/diaryRepo'

const photo = (n: number) => `data:image/jpeg;base64,${n}`
const dbs: TidyDB[] = []
afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete()
})

describe('일기 사진 타임라인', () => {
  it('예전 한 장짜리 일기도 사진 목록으로 읽는다', () => {
    expect(diaryPhotos({ photo: photo(1) })).toEqual([{ src: photo(1) }])
  })

  it('photos 가 있으면 대표 photo 를 두 번 세지 않는다', () => {
    const diary = { photo: photo(1), photos: [{ src: photo(1), time: '09:00' }, { src: photo(2) }] }

    expect(diaryPhotos(diary)).toHaveLength(2)
  })

  it('일기가 없으면 빈 목록이다', () => {
    expect(diaryPhotos(null)).toEqual([])
  })

  it('시간 순서로 줄 세우고, 시간 없는 사진은 맨 앞, 같은 시간은 넣은 순서로 둔다', () => {
    const photos = [{ src: 'a', time: '18:30' }, { src: 'b', time: '08:05' }, { src: 'c' }, { src: 'd', time: '08:05' }]

    expect(sortByTime(photos).map((item) => item.src)).toEqual(['c', 'b', 'd', 'a'])
  })

  it('저장할 때 12장이 와도 10장까지만 남긴다', () => {
    const many = Array.from({ length: MAX_DIARY_PHOTOS + 2 }, (_, i) => ({ src: photo(i), time: '10:00' }))

    expect(cleanPhotos(many)).toHaveLength(MAX_DIARY_PHOTOS)
  })

  it('저장할 때 25:00 같은 시간 · 빈 메모 · 사진 아닌 주소는 뺀다', () => {
    const messy = [{ src: photo(1), time: '25:00', note: '  ' }, { src: 'javascript:alert(1)' }]

    expect(cleanPhotos(messy)).toEqual([{ src: photo(1) }])
  })

  it('저장할 때 메모 앞뒤 공백을 지운다', () => {
    expect(cleanPhotos([{ src: photo(1), time: '07:10', note: ' 아침 ' }])).toEqual([{ src: photo(1), time: '07:10', note: '아침' }])
  })

  it('지금 시각은 "09:05" 처럼 두 자리로 쓴다', () => {
    expect(nowTime(new Date(2026, 10, 10, 9, 5))).toBe('09:05')
  })

  it('여러 장 저장하면 시간 순서로 놓고 가장 이른 사진이 대표(캘린더)가 된다', async () => {
    const db = new TidyDB('diary-photos-a')
    dbs.push(db)
    const repo = createDiaryRepo(db, () => 0)

    await repo.save('2026-11-10', { text: '산책', photos: [{ src: photo(2), time: '15:00', note: '공원' }, { src: photo(1), time: '09:00' }] })

    const saved = await repo.get('2026-11-10')
    expect(saved?.photo).toBe(photo(1))
    expect(saved?.photos?.map((item) => item.time)).toEqual(['09:00', '15:00'])
  })

  it('일기 사진은 백업에 들어가 다시 가져올 수 있다', async () => {
    const source = new TidyDB('diary-photos-b')
    const target = new TidyDB('diary-photos-c')
    dbs.push(source, target)
    await createDiaryRepo(source, () => 0).save('2026-11-10', { text: '산책', photos: [{ src: photo(2), time: '15:00' }, { src: photo(1), time: '09:00' }] })

    const backup = await createBackupRepo(source, '0.1.0').exportAll()
    await createBackupRepo(target, '0.1.0').importAll(JSON.stringify(backup))

    expect((await createDiaryRepo(target).get('2026-11-10'))?.photos).toHaveLength(2)
  })

  it('사진을 다 빼고 저장하면 대표 사진과 사진 목록이 모두 사라진다', async () => {
    const db = new TidyDB('diary-photos-d')
    dbs.push(db)
    const repo = createDiaryRepo(db, () => 0)
    await repo.save('2026-11-10', { text: '산책', photos: [{ src: photo(1), time: '09:00' }] })

    await repo.save('2026-11-10', { text: '사진 다 뺌', photos: [] })

    const none = await repo.get('2026-11-10')
    expect(none?.photo).toBeUndefined()
    expect(none?.photos).toBeUndefined()
  })
})
