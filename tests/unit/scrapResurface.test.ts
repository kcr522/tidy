import { describe, expect, it } from 'vitest'
import type { Bookmark } from '../../src/db/types'
import { cleanSettings, DEFAULT_RESURFACE, MIN_AGE_DAYS, nextNotifyTimes, pickResurface, planNotifications, resurfaceCandidates, savedAgoLabel } from '../../src/lib/scrap/resurface'

const NOT_READ = 0 as const
const READ = 1 as const
const TODAY = '2026-11-27'
const NOW = new Date(2026, 10, 27, 14, 0) // 11월 27일 오후 2시

let seq = 0
/** 안 본 스크랩 하나: 저장한 날(로컬 날짜) 만 정하고 나머지는 정상 값 */
const okScrap = (savedOn: string, over: Partial<Bookmark> = {}): Bookmark => {
  const [y, m, d] = savedOn.split('-').map(Number)
  const created = new Date(y, m - 1, d, 12, 0).toISOString()
  seq += 1
  return { id: seq, url: `https://www.instagram.com/p/post${seq}/`, title: `자취 꿀팁 ${seq}`, memo: '', isRead: NOT_READ, createdAt: created, updatedAt: created, ...over }
}

describe('다시 볼 스크랩 고르기', () => {
  it.each([
    [`딱 ${MIN_AGE_DAYS}일 전 저장`, '2026-11-24', true],
    [`${MIN_AGE_DAYS - 1}일 전 저장`, '2026-11-25', false],
  ])('%s 이면 꺼낼지: %s', (_case, savedOn, isPicked) => {
    const scrap = okScrap(savedOn)

    const list = resurfaceCandidates([scrap], TODAY)

    expect(list.includes(scrap)).toBe(isPicked)
  })

  it('이미 본(열어 본) 스크랩은 꺼내지 않는다', () => {
    const seen = okScrap('2026-11-01', { isRead: READ })

    expect(resurfaceCandidates([seen], TODAY)).toEqual([])
  })

  it.each([
    ['오늘까지 쉬는 중', TODAY, false],
    ['어제로 쉬기가 끝남', '2026-11-26', true],
  ])('"나중에"로 %s 이면 꺼낼지: %s', (_case, until, isPicked) => {
    const scrap = okScrap('2026-11-01')
    const snoozes = { [String(scrap.id)]: until }

    expect(resurfaceCandidates([scrap], TODAY, snoozes).includes(scrap)).toBe(isPicked)
  })

  it('같은 날에는 몇 번 골라도 같은 스크랩이다', () => {
    const list = Array.from({ length: 8 }, () => okScrap('2026-11-01'))

    const first = pickResurface(list, TODAY)
    const again = pickResurface([...list].reverse(), TODAY)

    expect(again).toEqual(first)
  })

  it('날이 바뀌면 다른 스크랩도 뽑힌다 (일주일 동안 두 가지 넘게)', () => {
    const list = Array.from({ length: 8 }, () => okScrap('2026-11-01'))
    const week = ['2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03']

    const picked = new Set(week.map((day) => pickResurface(list, day)[0].id))

    expect(picked.size).toBeGreaterThan(2)
  })
})

describe('저장한 지 얼마나 됐는지', () => {
  it.each([
    ['2026-11-24', '3일 전에 저장했어요'],
    ['2026-11-20', '1주 전에 저장했어요'],
    ['2026-10-20', '1달 전에 저장했어요'],
    ['2025-11-27', '1년 전에 저장했어요'],
  ])('%s 에 저장 → "%s"', (savedOn, label) => {
    expect(savedAgoLabel(okScrap(savedOn), TODAY)).toBe(label)
  })
})

describe('다시 보기 알림 시각', () => {
  const every3 = { every: 3 as const, time: '20:00' }

  it('처음 켠 날 저녁 시각이 아직이면 오늘부터 3일마다 울린다', () => {
    const times = nextNotifyTimes(NOW, every3, TODAY)

    expect(times).toEqual([new Date(2026, 10, 27, 20, 0), new Date(2026, 10, 30, 20, 0), new Date(2026, 11, 3, 20, 0)])
  })

  it('켠 지 이틀 뒤에는 다음 차례(켠 날 + 3일)부터 울린다', () => {
    const turnedOn = '2026-11-25'

    const [first] = nextNotifyTimes(NOW, every3, turnedOn)

    expect(first).toEqual(new Date(2026, 10, 28, 20, 0))
  })

  it('오늘이 차례지만 시각이 지났으면 다음 차례부터', () => {
    const lateNight = new Date(2026, 10, 27, 21, 0)

    const [first] = nextNotifyTimes(lateNight, every3, TODAY)

    expect(first).toEqual(new Date(2026, 10, 30, 20, 0))
  })

  it('알림마다 다른 스크랩을 넣고, 꺼낼 게 모자라면 그만큼만 예약한다', () => {
    const list = [okScrap('2026-11-01'), okScrap('2026-11-02')]
    const times = nextNotifyTimes(NOW, every3, TODAY)

    const plan = planNotifications(list, times)

    expect(plan).toHaveLength(2)
    expect(plan[0].item.id).not.toBe(plan[1].item.id)
  })
})

describe('설정 값 다듬기', () => {
  it('저장된 값이 망가졌으면 기본값(카드 켬 · 알림 끔 · 3일마다 · 20:00)으로', () => {
    const broken = { card: 'yes', every: 5, time: '25:00' }

    expect(cleanSettings(broken)).toEqual(DEFAULT_RESURFACE)
  })
})
