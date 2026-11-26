import { describe, expect, it } from 'vitest'
import { agoLabel, autoFileName, isDue, toPrune } from '../../src/lib/autoBackup'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const at = (iso: string) => Date.parse(iso)

describe('isDue', () => {
  it('자동 백업을 끄면 하지 않는다', () => {
    expect(isDue({ every: 'off' }, Date.now())).toBe(false)
  })

  it('한 번도 안 했으면 바로 한다', () => {
    expect(isDue({ every: 'day' }, Date.now())).toBe(true)
  })

  const lastDaily = '2026-11-10T09:00:00+09:00'
  it.each([
    [21, false],
    [22, true], // 매일 비슷한 때 열어도 매일 하도록 24시간이 아니라 22시간
  ])('매일 백업은 %i시간 지났을 때 하는가: %s', (hours, isTime) => {
    expect(isDue({ every: 'day', last: lastDaily }, at(lastDaily) + hours * HOUR)).toBe(isTime)
  })

  const lastWeekly = '2026-11-01T09:00:00+09:00'
  it.each([
    [6, false],
    [7, true],
  ])('매주 백업은 %i일 지났을 때 하는가: %s', (days, isTime) => {
    expect(isDue({ every: 'week', last: lastWeekly }, at(lastWeekly) + days * DAY)).toBe(isTime)
  })
})

describe('toPrune', () => {
  const autoFiles = Array.from({ length: 9 }, (_, i) => autoFileName(`2026-11-0${i + 1}`))
  const myFile = '내 백업.json'

  it('자동 백업 파일이 9개면 오래된 2개만 지우고, 직접 만든 파일은 건드리지 않는다', () => {
    expect(toPrune([...autoFiles, myFile])).toEqual(['tidy-auto-2026-11-01.json', 'tidy-auto-2026-11-02.json'])
  })

  it('자동 백업 파일이 7개보다 적으면 아무것도 지우지 않는다', () => {
    expect(toPrune(autoFiles.slice(0, 3))).toEqual([])
  })
})

describe('agoLabel', () => {
  const now = new Date(2026, 10, 11, 20, 0).getTime()

  it('백업한 적이 없으면 "아직 없어요" 라고 한다', () => {
    expect(agoLabel(undefined, now)).toBe('아직 없어요')
  })

  it.each([
    [new Date(2026, 10, 11, 8, 5), '오늘 오전 8:05'],
    [new Date(2026, 10, 10, 23, 0), '어제'],
    [new Date(2026, 10, 4, 12, 0), '7일 전'],
  ])('%s 에 한 백업은 "%s" 로 보여 준다', (lastBackup, label) => {
    expect(agoLabel(lastBackup.toISOString(), now)).toBe(label)
  })
})

describe('열 때마다', () => {
  const last = '2026-11-13T10:00:00+09:00'

  it('열 때마다 백업은 한 번도 안 했으면 바로 한다', () => {
    expect(isDue({ every: 'open' }, Date.now())).toBe(true)
  })

  it.each([
    [29, false],
    [30, true],
  ])('열 때마다 백업은 %i분 지났을 때 다시 하는가: %s', (minutes, isTime) => {
    expect(isDue({ every: 'open', last }, at(last) + minutes * MINUTE)).toBe(isTime)
  })
})
