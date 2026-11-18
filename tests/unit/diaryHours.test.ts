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
  for (const d of dbs.splice(0)) await d.delete()
})

describe('시간별 일기', () => {
  it('칸을 다듬는다: 빈 칸·잘못된 시간은 빼고 시간 순서', () => {
    expect(cleanHours([{ hour: 13, text: ' 점심 ' }, { hour: 9, text: '출근' }, { hour: 10, text: '  ' }, { hour: 24, text: '틀림' }, { hour: 9, text: '두 번째' }])).toEqual([
      { hour: 9, text: '출근' },
      { hour: 13, text: '점심' },
    ])
    expect(mapToHours({ 8: { text: '아침' }, 22: { text: '' } })).toEqual([{ hour: 8, text: '아침' }])
  })

  it('꾸민 글 · 손글씨 그림을 지키고, 글 안에 없는 그림·위험한 태그는 버린다', () => {
    const pen = 'data:image/png;base64,AAAA'
    const [h] = cleanHours([
      {
        hour: 21,
        text: '',
        html: '<div><span style="background-color: rgb(255, 241, 118); font-size: x-large; font-style: italic">하루 끝</span><script>x()</script></div><div><img data-pic="ink1" alt=""></div>',
        pics: [{ id: 'ink1', src: pen }, { id: 'gone', src: pen }],
      },
    ])
    expect(h.html).toContain('font-size:x-large')
    expect(h.html).toContain('font-style:italic')
    expect(h.html).not.toContain('script')
    expect(h.pics).toEqual([{ id: 'ink1', src: pen }])
    // 그림만 있는 칸도 남는다
    expect(cleanHours([{ hour: 7, text: '', html: '<div><img data-pic="a" alt=""></div>', pics: [{ id: 'a', src: pen }] }])).toHaveLength(1)
    // 꾸밈 없는 글은 html 없이 글만
    expect(cleanHours([{ hour: 7, text: '그냥 글', html: '<div>그냥 글</div>' }])).toEqual([{ hour: 7, text: '그냥 글' }])
  })

  it('시간 이름과 사진 칸', () => {
    expect([0, 9, 12, 13, 23].map(hourLabel)).toEqual(['오전 12시', '오전 9시', '오후 12시', '오후 1시', '오후 11시'])
    expect(hourOf('09:41')).toBe(9)
    expect(hourOf(undefined)).toBeNull()
    expect(timeInHour('09:41', 9)).toBe('09:41')
    expect(timeInHour('15:20', 9)).toBe('09:00')
    expect(timeInHour(undefined, 21)).toBe('21:00')
  })

  it('기본은 쓴 시간·사진 있는 시간만, 다 보기면 24칸', () => {
    expect(visibleHours({ 13: { text: '점심' }, 14: { text: ' ' } }, [{ src: 'x', time: '09:30' }, { src: 'y' }], [20], false)).toEqual([9, 13, 20])
    expect(visibleHours({}, [], [], true)).toHaveLength(24)
  })

  it('저장·백업·검색에 들어가고, 시간 칸을 안 주는 저장(AI 대화창)은 예전 칸을 지킨다', async () => {
    const d = new TidyDB('diary-hours-a')
    dbs.push(d)
    const repo = createDiaryRepo(d, () => 0)
    await repo.save('2026-11-18', { text: '', hours: [{ hour: 12, text: '친구랑 국밥' }] })
    expect((await repo.get('2026-11-18'))?.hours).toEqual([{ hour: 12, text: '친구랑 국밥' }])

    await repo.save('2026-11-18', { text: '좋은 하루' })
    expect((await repo.get('2026-11-18'))?.hours).toHaveLength(1)

    const backup = await createBackupRepo(d, '0.1.0').exportAll()
    const b = new TidyDB('diary-hours-b')
    dbs.push(b)
    await createBackupRepo(b, '0.1.0').importAll(JSON.stringify(backup))
    expect((await createDiaryRepo(b).get('2026-11-18'))?.hours?.[0].text).toBe('친구랑 국밥')

    const hits = searchAll({ diaries: [(await repo.get('2026-11-18'))!] }, '국밥')
    expect(hits.map((h) => h.field)).toEqual(['시간별 기록'])

    await repo.save('2026-11-18', { text: '좋은 하루', hours: [] })
    expect((await repo.get('2026-11-18'))?.hours).toBeUndefined()
  })
})
