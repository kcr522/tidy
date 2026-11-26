import { describe, expect, it } from 'vitest'
import { isHeicFile, toDecodable } from '../../src/lib/heic'

/** 파일 앞부분: 크기 4바이트 + "ftyp" + 브랜드 4글자 (ISO 미디어 파일 머리) */
const ftypHeader = (brand: string) => new Uint8Array([0, 0, 0, 24, ...[...'ftyp', ...brand].map((char) => char.charCodeAt(0))])

describe('HEIC 사진 알아보기', () => {
  it.each([
    ['종류가 image/heic', new File(['x'], 'a.jpg', { type: 'image/heic' }), true],
    ['종류가 비었고 이름이 .HEIC', new File(['x'], 'IMG_1.HEIC', { type: '' }), true],
    ['앞부분 브랜드가 heic', new File([ftypHeader('heic')], 'photo', { type: '' }), true],
    ['앞부분 브랜드가 mif1', new File([ftypHeader('mif1')], 'photo', { type: 'application/octet-stream' }), true],
    ['앞부분 브랜드가 동영상(isom)', new File([ftypHeader('isom')], 'video', { type: '' }), false],
    ['종류가 image/jpeg', new File(['x'], 'a.jpg', { type: 'image/jpeg' }), false],
  ])('%s 이면 HEIC 인가: $2', async (_case, file, isHeic) => {
    expect(await isHeicFile(file)).toBe(isHeic)
  })

  it('HEIC 가 아니면 바꾸지 않고 같은 파일을 돌려준다', async () => {
    const png = new File(['x'], 'a.png', { type: 'image/png' })

    expect(await toDecodable(png)).toBe(png)
  })
})
