import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { defaultCustomization, MAX_PHOTOS, parseCustomization, photoRefs, sessionPhoto, withFixedColors, withSplashColors } from '../../src/lib/customize'
import { loadPhotos, photoSrc, prunePhotos, storePhoto } from '../../src/lib/customPhotos'
import { pickTheme, type Trio } from '../../src/lib/palette'

const RGB: Trio = ['#ff0000', '#00ff00', '#0000ff']
const fixedRgb = { color: 'fixed' as const, colors: RGB }
const SAME_PICK = () => 0.3
const OTHER_SECTIONS = ['money', 'todo', 'scrap'] as const

describe('꾸미기 (customize)', () => {
  it.each([
    ['없으면', null],
    ['깨졌으면', 'x'],
  ])('저장된 값이 %s 기본값을 쓴다', (_case, saved) => {
    expect(parseCustomization(saved)).toEqual(defaultCustomization())
  })

  it('틀린 색 · 위험한 사진 주소 · 범위를 벗어난 투명도는 고친다', () => {
    const saved = { background: { color: 'fixed', fixed: 'red', photo: 'javascript:alert(1)', clear: 140, cardClear: 99 } }

    const result = parseCustomization(saved)

    expect(result.background).toMatchObject({ color: 'fixed', fixed: '#c9e7ff', photos: [], clear: 100, cardClear: 70 })
  })

  it('예전 한 장짜리 photo 는 photos 로 옮겨 읽고, 0 보다 작은 투명도는 0 으로 고친다', () => {
    const saved = { sections: { money: { color: 'fixed', colors: ['#111111', '#222222', '#333333'], photo: 'data:image/jpeg;base64,AA', clear: -5 } } }

    const result = parseCustomization(saved)

    expect(result.sections.money).toMatchObject({ color: 'fixed', photos: ['data:image/jpeg;base64,AA'], clear: 0 })
  })

  it('메뉴마다 다른 색이면 고정한 구역만 고른 색으로 바뀌고 나머지는 랜덤 그대로다', () => {
    const theme = pickTheme(SAME_PICK)
    const custom = { ...defaultCustomization(), sameColor: false }
    custom.sections.todo = { ...custom.sections.todo, ...fixedRgb }

    const result = withFixedColors(theme, custom)

    expect(result.sections.todo.colors).toEqual(RGB)
    expect(result.sections.money).toEqual(theme.sections.money)
  })

  it.each([
    ['기본값', defaultCustomization().sameColor, true],
    ['빈 저장값', parseCustomization({}).sameColor, true],
    ['끈 저장값', parseCustomization({ sameColor: false }).sameColor, false],
  ])('모든 메뉴 같은 색 설정 — %s: %s', (_case, sameColor, isSame) => {
    expect(sameColor).toBe(isSame)
  })

  it('모든 메뉴 같은 색이면 모든 구역이 대시보드 색을 따른다', () => {
    const theme = pickTheme(SAME_PICK)

    const result = withFixedColors(theme, defaultCustomization())

    for (const section of OTHER_SECTIONS) expect(result.sections[section]).toEqual(theme.sections.main)
  })

  it('모든 메뉴 같은 색에서 대시보드 색을 고정하면 그 색으로 모두 맞춘다', () => {
    const custom = defaultCustomization()
    custom.sections.main = { ...custom.sections.main, ...fixedRgb }

    const result = withFixedColors(pickTheme(SAME_PICK), custom)

    expect(result.sections.scrap.colors).toEqual(RGB)
  })

  const DEFAULT_CHECK = '#34c759'
  it.each([
    ['저장값이 없으면 구역 색', {}, { color: 'section', fixed: DEFAULT_CHECK }],
    ['#rrggbb 색은 그대로', { check: { color: 'fixed', fixed: '#ff00aa' } }, { color: 'fixed', fixed: '#ff00aa' }],
    ['#rrggbb 가 아니면 기본 초록', { check: { color: 'fixed', fixed: 'url(x)' } }, { color: 'fixed', fixed: DEFAULT_CHECK }],
  ])('체크 표시 색: %s', (_case, saved, check) => {
    expect(parseCustomization(saved).check).toEqual(check)
  })

  it('사진 여러 장은 이상한 이름을 버리고, 같은 사진은 한 번만, 최대 장수까지 남긴다', () => {
    const many = Array.from({ length: 15 }, (_, i) => `idb:photo-${String(i).padStart(3, '0')}`)
    const saved = { sections: { todo: { photos: ['idb:photo-000', 'idb:photo-000', 'javascript:x', 'idb:../x', ...many] } } }

    const photos = parseCustomization(saved).sections.todo.photos

    expect(photos).toHaveLength(MAX_PHOTOS)
    expect(photos[0]).toBe('idb:photo-000')
    expect(photos).not.toContain('javascript:x')
  })

  it('보관할 사진 목록(photoRefs)에는 구역 사진이 모두 들어간다', () => {
    const custom = parseCustomization({ sections: { todo: { photos: ['idb:photo-000', 'idb:photo-001'] } } })

    expect(photoRefs(custom)).toEqual(custom.sections.todo.photos)
  })

  it('사진이 없으면 켤 때 고를 사진도 없다', () => {
    expect(sessionPhoto([], 'k')).toBeNull()
  })

  it('켤 때 고른 사진은 앱을 끄기 전까지 계속 같다', () => {
    const photos = ['idb:aaaaaa', 'idb:bbbbbb', 'idb:cccccc']
    const middlePick = () => 0.5
    const firstPick = () => 0

    const first = sessionPhoto(photos, 'test-key', middlePick)
    const again = sessionPhoto(photos, 'test-key', firstPick)

    expect(first).toBe('idb:bbbbbb')
    expect(again).toBe(first)
  })
})

describe('꾸미기 사진 보관함 (IndexedDB)', () => {
  const jpeg = (text: string) => new Blob([text], { type: 'image/jpeg' })

  it('사진을 넣으면 idb: 이름을 주고 화면에는 blob: 주소로 보여 준다', async () => {
    const ref = await storePhoto(jpeg('a'))

    expect(ref).toMatch(/^idb:/)
    expect(photoSrc(ref)).toMatch(/^blob:/)
  })

  it('안 쓰는 사진은 지우고, 다시 읽어도 지운 사진은 돌아오지 않는다', async () => {
    const kept = await storePhoto(jpeg('a'))
    const unused = await storePhoto(jpeg('b'))

    await prunePhotos([kept])
    await loadPhotos([kept, unused])

    expect(photoSrc(unused)).toBeUndefined()
    expect(photoSrc(kept)).toBeDefined()
  })

  it('data: 주소 사진은 보관함 없이 그대로 쓴다', () => {
    const dataPhoto = 'data:image/png;base64,AA'

    expect(photoSrc(dataPhoto)).toBe(dataPhoto)
  })
})

describe('사진 맞춤', () => {
  it('맞는 맞춤 값은 그대로, 이상한 값은 기본(꽉 채우기 · 가운데)으로 바꾼다', () => {
    const saved = { background: { fit: 'contain', pos: 'top' }, sections: { money: { fit: 'zoom', pos: 'left' } } }

    const result = parseCustomization(saved)

    expect(result.background).toMatchObject({ fit: 'contain', pos: 'top' })
    expect(result.sections.money).toMatchObject({ fit: 'cover', pos: 'center' })
  })
})

describe('시작 화면 (2026-11-10)', () => {
  const PHOTO = 'data:image/jpeg;base64,AAA'
  const palette = { bg: '#f6ece9', colors: ['#eeb2af', '#aa8077', '#6b4e4c'] as [string, string, string] }
  const withSplash = (over: Record<string, unknown> = {}) => parseCustomization({ splash: { photos: [PHOTO], seconds: 3, palettes: { [PHOTO]: palette }, ...over } })
  const splashOf = (splash: Record<string, unknown>) => parseCustomization({ splash }).splash
  const IS_DARK = true
  const IS_LIGHT = false

  it('저장된 시작 화면 사진 · 시간 · 사진 색을 읽고, 사진은 보관할 목록에 들어간다', () => {
    const custom = withSplash()

    expect(custom.splash).toMatchObject({ photos: [PHOTO], seconds: 3, matchColors: true })
    expect(custom.splash.palettes[PHOTO]).toEqual(palette)
    expect(photoRefs(custom)).toContain(PHOTO)
  })

  it('99초 같은 이상한 시간과 목록에 없는 사진 색은 기본값으로 돌린다', () => {
    const splash = splashOf({ seconds: 99, palettes: { x: palette } })

    expect(splash).toEqual({ photos: [], seconds: 2, matchColors: true, basic: true, palettes: {}, logoPos: 'center', logoClear: 50, logoFx: 'shine' })
  })

  it.each([
    ['맞는 로고 위치 · 투명도는 그대로', { logoPos: 'top', logoClear: 20 }, { logoPos: 'top', logoClear: 20 }],
    ['모르는 위치는 가운데, 투명도는 90 까지', { logoPos: 'left', logoClear: 500 }, { logoPos: 'center', logoClear: 90 }],
    ['맞는 로고 효과는 그대로', { logoFx: 'letters' }, { logoFx: 'letters' }],
    ['모르는 로고 효과는 반짝임', { logoFx: 'spin' }, { logoFx: 'shine' }],
    ['사진 없을 때 기본 화면 끄기', { basic: false }, { basic: false }],
  ])('시작 화면 설정: %s', (_case, saved, expected) => {
    expect(splashOf(saved)).toMatchObject(expected)
  })

  it('사진 색 맞추기를 켜면 라이트 화면에서 모든 구역과 바탕을 사진 색으로 바꾼다', () => {
    const light = withSplashColors(withSplash(), IS_LIGHT)

    for (const section of ['main', ...OTHER_SECTIONS] as const) expect(light.sections[section]).toMatchObject({ color: 'fixed', colors: palette.colors })
    expect(light.background).toMatchObject({ color: 'fixed', fixed: palette.bg, clear: 0 })
  })

  it('사진 색 맞추기를 켜도 다크 화면에서는 바탕을 그대로 둔다', () => {
    const dark = withSplashColors(withSplash(), IS_DARK)

    expect(dark.background.color).toBe('default')
  })

  it('사진 색 맞추기를 끄면 꾸미기를 그대로 둔다', () => {
    const off = withSplash({ matchColors: false })

    expect(withSplashColors(off, IS_LIGHT)).toBe(off)
  })
})

describe('기본 시작 화면 시간', () => {
  it.each([
    [200, 900], // 1100 - 200
    [600, 500], // 1100 - 600
    [2500, 450], // 아무리 늦어도 0.45초는 보여 준다
  ])('앱이 %ims 늦게 뜨면 시작 화면을 %ims 더 보여 준다 (누른 때부터 1.1초)', async (loadMs, delayMs) => {
    const { basicSplashDelay } = await import('../../src/lib/customize')

    expect(basicSplashDelay(loadMs)).toBe(delayMs)
  })
})
