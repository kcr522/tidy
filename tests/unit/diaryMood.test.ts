import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { createDiaryRepo } from '../../src/repositories/diaryRepo'

const DAY = '2026-11-27'
const okText = '오늘은 카페에서 포트폴리오를 정리했다'

let db: TidyDB | undefined

afterEach(async () => {
  await db?.delete()
  db = undefined
})

describe('오늘 기분 저장 (대시보드 기분 위젯)', () => {
  it('일기가 없는 날 기분을 고르면 글 없는 일기에 기분만 남는다', async () => {
    db = new TidyDB('diary-mood-1')
    const repo = createDiaryRepo(db)

    await repo.setMood(DAY, 'good')

    expect(await repo.get(DAY)).toMatchObject({ date: DAY, text: '', mood: 'good' })
  })

  it('기분을 고른 뒤 일기를 써도 기분이 그대로 남는다', async () => {
    db = new TidyDB('diary-mood-2')
    const repo = createDiaryRepo(db)

    await repo.setMood(DAY, 'calm')
    await repo.save(DAY, { text: okText })

    expect(await repo.get(DAY)).toMatchObject({ text: okText, mood: 'calm' })
  })

  it('같은 기분을 다시 눌러 지우면 일기 글은 남고 기분만 없어진다', async () => {
    db = new TidyDB('diary-mood-3')
    const repo = createDiaryRepo(db)
    await repo.save(DAY, { text: okText })
    await repo.setMood(DAY, 'sad')

    await repo.setMood(DAY, null)

    const diary = await repo.get(DAY)
    expect(diary?.text).toBe(okText)
    expect(diary?.mood).toBeUndefined()
  })
})
