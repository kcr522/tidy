import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { MAX_DIARY_PHOTOS, cleanPhotos, diaryPhotos, nowTime, sortByTime } from '../../src/lib/diaryPhotos'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { createDiaryRepo } from '../../src/repositories/diaryRepo'

const img = (n: number) => `data:image/jpeg;base64,${n}`
const dbs: TidyDB[] = []
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete()
})

describe('일기 사진 타임라인', () => {
  it('예전 한 장짜리 일기도 사진 목록으로 읽는다', () => {
    expect(diaryPhotos({ photo: img(1) })).toEqual([{ src: img(1) }])
    expect(diaryPhotos({ photo: img(1), photos: [{ src: img(1), time: '09:00' }, { src: img(2) }] })).toHaveLength(2)
    expect(diaryPhotos(null)).toEqual([])
  })

  it('시간 순서로 줄 세우고, 시간 없는 사진은 맨 앞, 같은 시간은 넣은 순서', () => {
    const got = sortByTime([{ src: 'a', time: '18:30' }, { src: 'b', time: '08:05' }, { src: 'c' }, { src: 'd', time: '08:05' }])
    expect(got.map((p) => p.src)).toEqual(['c', 'b', 'd', 'a'])
  })

  it('저장할 때 10장까지, 이상한 시간·빈 메모·사진 아닌 것은 뺀다', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ src: img(i), time: '10:00' }))
    expect(cleanPhotos(many)).toHaveLength(MAX_DIARY_PHOTOS)
    expect(cleanPhotos([{ src: img(1), time: '25:00', note: '  ' }, { src: 'javascript:alert(1)' }])).toEqual([{ src: img(1) }])
    expect(cleanPhotos([{ src: img(1), time: '07:10', note: ' 아침 ' }])).toEqual([{ src: img(1), time: '07:10', note: '아침' }])
    expect(nowTime(new Date(2026, 10, 10, 9, 5))).toBe('09:05')
  })

  it('여러 장 저장하면 첫 사진이 대표(캘린더)가 되고 백업에도 들어간다', async () => {
    const d = new TidyDB('diary-photos-a')
    dbs.push(d)
    const repo = createDiaryRepo(d, () => 0)
    await repo.save('2026-11-10', { text: '산책', photos: [{ src: img(2), time: '15:00', note: '공원' }, { src: img(1), time: '09:00' }] })
    const got = await repo.get('2026-11-10')
    expect(got?.photo).toBe(img(1))
    expect(got?.photos?.map((p) => p.time)).toEqual(['09:00', '15:00'])

    const backup = await createBackupRepo(d, '0.1.0').exportAll()
    const b = new TidyDB('diary-photos-b')
    dbs.push(b)
    await createBackupRepo(b, '0.1.0').importAll(JSON.stringify(backup))
    expect((await createDiaryRepo(b).get('2026-11-10'))?.photos).toHaveLength(2)

    await repo.save('2026-11-10', { text: '사진 다 뺌', photos: [] })
    const none = await repo.get('2026-11-10')
    expect(none?.photo).toBeUndefined()
    expect(none?.photos).toBeUndefined()
  })
})
