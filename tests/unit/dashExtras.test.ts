import { describe, expect, it } from 'vitest'
import { addWidget, defaultLayout } from '../../src/lib/dashLayout'
import { clockText, finish, freshTimer, isDone, MIN, pause, reset, setMinutes, start, timeLeft, timerRatio, timeSpent } from '../../src/lib/focusTimer'
import { moodOf } from '../../src/lib/mood'
import { forecastUrl, nearestCity, parseForecast, weatherLook, weatherTip } from '../../src/lib/weather'

const PHONE_COLS = 4
const WIDE_COLS = 12
const NEW_KINDS = ['timer', 'mood', 'weather'] as const
const T0 = Date.UTC(2026, 10, 27, 3, 0, 0)
const SEC = 1000

describe('새 위젯 배치 (타이머 · 기분 · 날씨)', () => {
  it('폰 기본 배치에는 새 위젯을 넣지 않는다 (폰이 복잡해지지 않게)', () => {
    const kinds = defaultLayout(PHONE_COLS).map((w) => w.kind)

    for (const kind of NEW_KINDS) expect(kinds).not.toContain(kind)
  })

  it('넓은 화면 기본 배치에는 새 위젯이 모두 있다', () => {
    const kinds = defaultLayout(WIDE_COLS).map((w) => w.kind)

    for (const kind of NEW_KINDS) expect(kinds).toContain(kind)
  })

  it.each([
    ['timer', 2, 2],
    ['mood', 2, 2],
    ['weather', 4, 2],
  ] as const)('폰에서 %s 위젯을 추가하면 %i×%i 작은 크기로 맨 앞에 들어간다', (kind, w, h) => {
    const added = addWidget(defaultLayout(PHONE_COLS), kind, PHONE_COLS)

    expect(added[0]).toEqual({ kind, w, h })
  })
})

describe('집중 타이머', () => {
  const okMinutes = 25

  it('시작하고 10초 지나면 24분 50초 남는다', () => {
    const running = start(setMinutes(okMinutes), T0)

    expect(clockText(timeLeft(running, T0 + 10 * SEC))).toBe('24:50')
  })

  it('멈추면 남은 시간이 그대로 있고, 이어서 시작하면 거기서부터 줄어든다', () => {
    const paused = pause(start(setMinutes(okMinutes), T0), T0 + MIN)
    const resumed = start(paused, T0 + 10 * MIN)

    expect(timeLeft(paused, T0 + 5 * MIN)).toBe(24 * MIN)
    expect(timeLeft(resumed, T0 + 11 * MIN)).toBe(23 * MIN)
  })

  it.each([
    [okMinutes * MIN - SEC, false],
    [okMinutes * MIN, true],
  ])('시작 뒤 %ims 지났을 때 끝났는지: %s', (passed, done) => {
    expect(isDone(start(setMinutes(okMinutes), T0), T0 + passed)).toBe(done)
  })

  it('끝난 타이머는 남은 시간 0 · 꽉 찬 동그라미, 처음으로 하면 원래 길이로 돌아온다', () => {
    const ended = finish(start(setMinutes(okMinutes), T0))

    expect(timeLeft(ended, T0)).toBe(0)
    expect(timerRatio(ended, T0)).toBe(1)
    expect(timeLeft(reset(ended), T0)).toBe(okMinutes * MIN)
  })

  it('스톱워치는 멈춘 시간을 빼고 흐른 시간만 센다', () => {
    const sw = freshTimer('stopwatch')
    const afterPause = start(pause(start(sw, T0), T0 + 30 * SEC), T0 + 90 * SEC)

    expect(timeSpent(afterPause, T0 + 100 * SEC)).toBe(40 * SEC)
  })

  it.each([
    [25 * MIN, '25:00'],
    [61 * SEC, '01:01'],
    [3723 * SEC, '1:02:03'],
    [500, '00:01'],
  ])('%ims 는 %s 로 보인다', (ms, text) => {
    expect(clockText(ms)).toBe(text)
  })
})

describe('오늘 기분', () => {
  it('저장된 이름으로 이모지를 찾고, 모르는 이름이면 없음', () => {
    expect(moodOf('good')?.emoji).toBe('🙂')
    expect(moodOf('nope')).toBeUndefined()
    expect(moodOf(undefined)).toBeUndefined()
  })
})

describe('날씨', () => {
  const okResponse = {
    current: { time: '2026-11-27T12:00', temperature_2m: 6.4, apparent_temperature: 3.2, weather_code: 3, is_day: 1 },
    hourly: {
      time: ['2026-11-27T11:00', '2026-11-27T12:00', '2026-11-27T13:00'],
      temperature_2m: [5.9, 6.4, 7.1],
      weather_code: [2, 3, 61],
      precipitation_probability: [0, 10, 70],
    },
    daily: { temperature_2m_max: [8.6], temperature_2m_min: [-0.4], precipitation_probability_max: [70] },
  }

  it('응답을 반올림한 기온 · 오늘 최고/최저 · 지금부터의 시간별 예보로 바꾼다', () => {
    const weather = parseForecast(okResponse, T0)

    expect(weather).toMatchObject({ temp: 6, feels: 3, code: 3, isDay: true, max: 9, min: 0, rain: 70, at: T0 })
    expect(weather?.hours.map((h) => h.hour)).toEqual([12, 13])
  })

  it('지금 기온이 없는 응답은 버린다', () => {
    expect(parseForecast({ current: { weather_code: 0 } }, T0)).toBeNull()
  })

  it('키 없이 Open-Meteo 주소로 위도 · 경도를 묻는다', () => {
    const url = forecastUrl({ lat: 37.5665, lng: 126.978 })

    expect(url).toMatch(/^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/)
    expect(url).toContain('latitude=37.566')
    expect(url).not.toMatch(/key/i)
  })

  it.each([
    [37.5, 127.03, '서울'],
    [35.16, 129.06, '부산'],
    [33.5, 126.52, '제주'],
    [48.85, 2.35, '내 위치'],
  ])('위도 %f 경도 %f 는 %s 로 보인다', (lat, lng, name) => {
    expect(nearestCity(lat, lng)).toBe(name)
  })

  it.each([
    [0, true, '☀️'],
    [0, false, '🌙'],
    [63, true, '🌧️'],
    [73, true, '🌨️'],
  ])('날씨 코드 %i (낮 %s) 는 %s', (code, isDay, icon) => {
    expect(weatherLook(code, isDay).icon).toBe(icon)
  })

  it('비 올 확률이 높으면 우산을 챙기라고 한다', () => {
    const rainy = { code: 3, rain: 70, max: 9, min: 5, feels: 6 }

    expect(weatherTip(rainy)).toContain('우산')
  })
})
