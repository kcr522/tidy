// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { cleanHours, hourLabel, hourOf, mapToHours, timeInHour, visibleHours } from '../../src/lib/diaryHours'
import { searchAll } from '../../src/lib/search'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { createDiaryRepo } from '../../src/repositories/diaryRepo'

const dbs: TidyDB[] = []
afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete()
})

const PEN = 'data:image/png;base64,AAAA' // 손글씨 그림
const SHOW_ALL = true
const ONLY_USED = false
const HOURS_IN_DAY = 24

describe('시간별 일기', () => {
  it('빈 칸 · 없는 시간(24시) · 같은 시간 두 번째 칸은 빼고 시간 순서로 다듬는다', () => {
    const raw = [{ hour: 13, text: ' 점심 ' }, { hour: 9, text: '출근' }, { hour: 10, text: '  ' }, { hour: 24, text: '틀림' }, { hour: 9, text: '두 번째' }]

    expect(cleanHours(raw)).toEqual([
      { hour: 9, text: '출근' },
      { hour: 13, text: '점심' },
    ])
  })

  it('시간 → 글 모음도 빈 글을 빼고 칸 목록으로 바꾼다', () => {
    expect(mapToHours({ 8: { text: '아침' }, 22: { text: '' } })).toEqual([{ hour: 8, text: '아침' }])
  })

  it('꾸민 글 모양은 지키고, 위험한 태그와 글 안에 없는 그림은 버린다', () => {
    const html = '<div><span style="background-color: rgb(255, 241, 118); font-size: x-large; font-style: italic">하루 끝</span><script>x()</script></div><div><img data-pic="ink1" alt=""></div>'
    const pics = [{ id: 'ink1', src: PEN }, { id: 'gone', src: PEN }]

    const [hour] = cleanHours([{ hour: 21, text: '', html, pics }])

    expect(hour.html).toContain('font-size:x-large')
    expect(hour.html).toContain('font-style:italic')
    expect(hour.html).not.toContain('script')
    expect(hour.pics).toEqual([{ id: 'ink1', src: PEN }])
  })

  it('글 없이 그림만 있는 칸도 남긴다', () => {
    const onlyPicture = { hour: 7, text: '', html: '<div><img data-pic="a" alt=""></div>', pics: [{ id: 'a', src: PEN }] }

    expect(cleanHours([onlyPicture])).toHaveLength(1)
  })

  it('꾸밈 없는 글은 html 없이 글만 저장한다', () => {
    expect(cleanHours([{ hour: 7, text: '그냥 글', html: '<div>그냥 글</div>' }])).toEqual([{ hour: 7, text: '그냥 글' }])
  })

  it.each([
    [0, '오전 12시'],
    [9, '오전 9시'],
    [12, '오후 12시'],
    [13, '오후 1시'],
    [23, '오후 11시'],
  ])('%i시 칸 이름은 "%s" 다', (hour, label) => {
    expect(hourLabel(hour)).toBe(label)
  })

  it.each([
    ['09:41', 9],
    [undefined, null],
  ])('사진 시각 %s 는 %s 시 칸에 들어간다', (time, hour) => {
    expect(hourOf(time)).toBe(hour)
  })

  it.each([
    ['그 시간 안의 시각은 그대로', '09:41', 9, '09:41'],
    ['다른 시간 시각은 그 칸의 정각', '15:20', 9, '09:00'],
    ['시각이 없으면 그 칸의 정각', undefined, 21, '21:00'],
  ])('칸에 넣은 사진 시각: %s', (_case, time, hour, result) => {
    expect(timeInHour(time, hour)).toBe(result)
  })

  it('기본 보기는 글 쓴 시간 · 사진 있는 시간 · 연 시간만 보여 준다', () => {
    const hours = { 13: { text: '점심' }, 14: { text: ' ' } }
    const photos = [{ src: 'x', time: '09:30' }, { src: 'y' }]
    const opened = [20]

    expect(visibleHours(hours, photos, opened, ONLY_USED)).toEqual([9, 13, 14, 20])
  })

  it('다 보기를 켜면 24칸을 모두 보여 준다', () => {
    expect(visibleHours({}, [], [], SHOW_ALL)).toHaveLength(HOURS_IN_DAY)
  })

  it.each([
    ['사진 없이 글만 있어도 다음 칸이 열린다', { 15: { text: '카페' } }, [15, 16]],
    ['밤 11시 다음 칸은 없다', { 23: { text: '잠' } }, [23]],
    ['아무것도 없으면 빈 목록', {}, []],
  ])('기본 보기: %s', (_case, hours, visible) => {
    expect(visibleHours(hours, [], [], ONLY_USED)).toEqual(visible)
  })

  it('시간 칸은 저장되고, 시간 칸 없이 저장(AI 대화창)하면 예전 칸을 지키고, 빈 칸 목록으로 저장하면 지운다', async () => {
    const db = new TidyDB('diary-hours-a')
    dbs.push(db)
    const repo = createDiaryRepo(db, () => 0)

    await repo.save('2026-11-18', { text: '', hours: [{ hour: 12, text: '친구랑 국밥' }] })
    expect((await repo.get('2026-11-18'))?.hours).toEqual([{ hour: 12, text: '친구랑 국밥' }])

    await repo.save('2026-11-18', { text: '좋은 하루' })
    expect((await repo.get('2026-11-18'))?.hours).toHaveLength(1)

    await repo.save('2026-11-18', { text: '좋은 하루', hours: [] })
    expect((await repo.get('2026-11-18'))?.hours).toBeUndefined()
  })

  it('시간 칸은 백업에 들어가고 "시간별 기록" 으로 검색된다', async () => {
    const source = new TidyDB('diary-hours-b')
    const target = new TidyDB('diary-hours-c')
    dbs.push(source, target)
    const repo = createDiaryRepo(source, () => 0)
    await repo.save('2026-11-18', { text: '', hours: [{ hour: 12, text: '친구랑 국밥' }] })

    const backup = await createBackupRepo(source, '0.1.0').exportAll()
    await createBackupRepo(target, '0.1.0').importAll(JSON.stringify(backup))
    const hits = searchAll({ diaries: [(await repo.get('2026-11-18'))!] }, '국밥')

    expect((await createDiaryRepo(target).get('2026-11-18'))?.hours?.[0].text).toBe('친구랑 국밥')
    expect(hits.map((hit) => hit.field)).toEqual(['시간별 기록'])
  })
})
