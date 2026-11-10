import { describe, expect, it } from 'vitest'
import { isHeicFile, toDecodable } from '../../src/lib/heic'

const ftyp = (brand: string) => new Uint8Array([0, 0, 0, 24, ...[...'ftyp', ...brand].map((c) => c.charCodeAt(0))])

describe('HEIC 사진 알아보기', () => {
  it('종류, 이름, 앞부분 글자로 알아본다', async () => {
    expect(await isHeicFile(new File(['x'], 'a.jpg', { type: 'image/heic' }))).toBe(true)
    expect(await isHeicFile(new File(['x'], 'IMG_1.HEIC', { type: '' }))).toBe(true)
    expect(await isHeicFile(new File([ftyp('heic')], 'photo', { type: '' }))).toBe(true)
    expect(await isHeicFile(new File([ftyp('mif1')], 'photo', { type: 'application/octet-stream' }))).toBe(true)
    expect(await isHeicFile(new File([ftyp('isom')], 'video', { type: '' }))).toBe(false)
    expect(await isHeicFile(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBe(false)
  })

  it('HEIC 가 아니면 그대로 돌려준다', async () => {
    const f = new File(['x'], 'a.png', { type: 'image/png' })
    expect(await toDecodable(f)).toBe(f)
  })
})
