import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { defaultCustomization, MAX_PHOTOS, parseCustomization, photoRefs, sessionPhoto, withFixedColors, withSplashColors } from '../../src/lib/customize'
import { loadPhotos, photoSrc, prunePhotos, storePhoto } from '../../src/lib/customPhotos'
import { pickTheme } from '../../src/lib/palette'

describe('꾸미기 (customize)', () => {
  it('저장된 값이 없거나 깨졌으면 기본값', () => {
    expect(parseCustomization(null)).toEqual(defaultCustomization())
    expect(parseCustomization('x')).toEqual(defaultCustomization())
  })

  it('틀린 색, 사진, 범위를 벗어난 투명도는 고친다', () => {
    const c = parseCustomization({
      background: { color: 'fixed', fixed: 'red', photo: 'javascript:alert(1)', clear: 140, cardClear: 99 },
      sections: { money: { color: 'fixed', colors: ['#111111', '#222222', '#333333'], photo: 'data:image/jpeg;base64,AA', clear: -5 } },
    })
    expect(c.background).toMatchObject({ color: 'fixed', fixed: '#c9e7ff', photos: [], clear: 100, cardClear: 70 })
    // 예전 한 장짜리 photo 는 photos 로 옮겨 읽는다
    expect(c.sections.money).toMatchObject({ color: 'fixed', photos: ['data:image/jpeg;base64,AA'], clear: 0 })
  })

  it('고정한 구역만 고른 색으로 바뀌고 나머지는 랜덤 그대로', () => {
    const theme = pickTheme(() => 0.3)
    const c = { ...defaultCustomization(), sameColor: false }
    c.sections.todo = { ...c.sections.todo, color: 'fixed', colors: ['#ff0000', '#00ff00', '#0000ff'] }
    const t = withFixedColors(theme, c)
    expect(t.sections.todo.colors).toEqual(['#ff0000', '#00ff00', '#0000ff'])
    expect(t.sections.money).toEqual(theme.sections.money)
  })

  it('모든 메뉴 같은 색(기본): 모든 구역이 대시보드 색을 따른다', () => {
    const theme = pickTheme(() => 0.3)
    const c = defaultCustomization()
    expect(c.sameColor).toBe(true)
    expect(parseCustomization({}).sameColor).toBe(true)
    expect(parseCustomization({ sameColor: false }).sameColor).toBe(false)
    const t = withFixedColors(theme, c)
    for (const s of ['money', 'todo', 'scrap'] as const) expect(t.sections[s]).toEqual(theme.sections.main)
    // 대시보드 색을 고정하면 그 색으로 모두 맞춘다
    c.sections.main = { ...c.sections.main, color: 'fixed', colors: ['#ff0000', '#00ff00', '#0000ff'] }
    expect(withFixedColors(theme, c).sections.scrap.colors).toEqual(['#ff0000', '#00ff00', '#0000ff'])
  })

  it('체크 표시 색: 기본은 구역 색, 고른 색은 #rrggbb 만', () => {
    expect(parseCustomization({}).check).toEqual({ color: 'section', fixed: '#34c759' })
    expect(parseCustomization({ check: { color: 'fixed', fixed: '#ff00aa' } }).check).toEqual({ color: 'fixed', fixed: '#ff00aa' })
    expect(parseCustomization({ check: { color: 'fixed', fixed: 'url(x)' } }).check.fixed).toBe('#34c759')
  })

  it('사진 여러 장: 이상한 이름은 버리고, 같은 사진은 한 번만, 최대 장수까지', () => {
    const many = Array.from({ length: 15 }, (_, i) => `idb:photo-${String(i).padStart(3, '0')}`)
    const c = parseCustomization({ sections: { todo: { photos: ['idb:photo-000', 'idb:photo-000', 'javascript:x', 'idb:../x', ...many] } } })
    expect(c.sections.todo.photos).toHaveLength(MAX_PHOTOS)
    expect(c.sections.todo.photos[0]).toBe('idb:photo-000')
    expect(c.sections.todo.photos).not.toContain('javascript:x')
    expect(photoRefs(c)).toEqual(c.sections.todo.photos)
  })

  it('켤 때 고른 사진은 그 사이에 계속 같다', () => {
    const list = ['idb:aaaaaa', 'idb:bbbbbb', 'idb:cccccc']
    expect(sessionPhoto([], 'k')).toBeNull()
    const first = sessionPhoto(list, 'test-key', () => 0.5)
    expect(first).toBe('idb:bbbbbb')
    expect(sessionPhoto(list, 'test-key', () => 0)).toBe(first)
  })
})

describe('꾸미기 사진 보관함 (IndexedDB)', () => {
  it('넣고, 다시 읽고, 안 쓰는 사진은 지운다', async () => {
    const a = await storePhoto(new Blob(['a'], { type: 'image/jpeg' }))
    const b = await storePhoto(new Blob(['b'], { type: 'image/jpeg' }))
    expect(a).toMatch(/^idb:/)
    expect(photoSrc(a)).toMatch(/^blob:/)
    await prunePhotos([a])
    expect(photoSrc(b)).toBeUndefined()
    expect(photoSrc(a)).toBeDefined()
    await loadPhotos([a, b])
    expect(photoSrc(b)).toBeUndefined()
    expect(photoSrc('data:image/png;base64,AA')).toBe('data:image/png;base64,AA')
  })
})

describe('사진 맞춤', () => {
  it('기본은 꽉 채우기·가운데, 이상한 값은 기본으로', () => {
    const c = parseCustomization({ background: { fit: 'contain', pos: 'top' }, sections: { money: { fit: 'zoom', pos: 'left' } } })
    expect(c.background).toMatchObject({ fit: 'contain', pos: 'top' })
    expect(c.sections.money).toMatchObject({ fit: 'cover', pos: 'center' })
  })
})

describe('시작 화면 (2026-11-10)', () => {
  const pal = { bg: '#f6ece9', colors: ['#eeb2af', '#aa8077', '#6b4e4c'] as [string, string, string] }
  const withSplash = (over: Record<string, unknown> = {}) =>
    parseCustomization({ splash: { photos: ['data:image/jpeg;base64,AAA'], seconds: 3, palettes: { 'data:image/jpeg;base64,AAA': pal }, ...over } })

  it('저장된 값을 읽고, 이상한 값은 기본값으로', () => {
    const c = withSplash()
    expect(c.splash).toMatchObject({ photos: ['data:image/jpeg;base64,AAA'], seconds: 3, matchColors: true })
    expect(c.splash.palettes['data:image/jpeg;base64,AAA']).toEqual(pal)
    expect(parseCustomization({ splash: { seconds: 99, palettes: { x: pal } } }).splash).toEqual({ photos: [], seconds: 2, matchColors: true, basic: true, palettes: {}, logoPos: 'center', logoClear: 50, logoFx: 'blur' })
    expect(parseCustomization({ splash: { logoPos: 'top', logoClear: 20 } }).splash).toMatchObject({ logoPos: 'top', logoClear: 20 })
    expect(parseCustomization({ splash: { logoPos: 'left', logoClear: 500 } }).splash).toMatchObject({ logoPos: 'center', logoClear: 90 })
    expect(parseCustomization({ splash: { logoFx: 'letters' } }).splash.logoFx).toBe('letters')
    expect(parseCustomization({ splash: { logoFx: 'spin' } }).splash.logoFx).toBe('blur')
    expect(parseCustomization({ splash: { basic: false } }).splash.basic).toBe(false)
    expect(photoRefs(c)).toContain('data:image/jpeg;base64,AAA')
  })

  it('사진 색 맞추기: 모든 구역과 바탕을 사진 색으로 (어두운 화면은 바탕 그대로)', () => {
    const light = withSplashColors(withSplash(), false)
    for (const s of ['main', 'money', 'todo', 'scrap'] as const) expect(light.sections[s]).toMatchObject({ color: 'fixed', colors: pal.colors })
    expect(light.background).toMatchObject({ color: 'fixed', fixed: pal.bg, clear: 0 })
    expect(withSplashColors(withSplash(), true).background.color).toBe('default')
    // 끄면 그대로
    const off = withSplash({ matchColors: false })
    expect(withSplashColors(off, false)).toBe(off)
  })
})

describe('기본 시작 화면 시간', () => {
  it('앱을 누른 때부터 1.1초까지, 앱이 늦게 뜬 만큼 짧게, 그래도 0.45초는 보여 준다', async () => {
    const { basicSplashDelay } = await import('../../src/lib/customize')
    expect(basicSplashDelay(200)).toBe(900)
    expect(basicSplashDelay(600)).toBe(500)
    expect(basicSplashDelay(2500)).toBe(450)
  })
})
