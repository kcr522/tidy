/**
 * HEIC(아이폰·갤럭시 고화질 사진) 열기 (사용자 요청 2026-11-10: 일기에 사진이 안 올라가요)
 * 폰 앱 안 브라우저(안드로이드 WebView)와 크롬은 HEIC 를 못 연다.
 * 그래서 HEIC 이면 먼저 JPEG 로 바꾼다. 바꾸는 도구(heic-to)는 HEIC 를 골랐을 때만 불러온다.
 */

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']

/** 파일 이름·종류·앞부분 글자로 HEIC 인지 본다 (안드로이드는 종류를 비워 줄 때가 있다) */
export async function isHeicFile(file: Blob): Promise<boolean> {
  const name = 'name' in file ? String((file as File).name) : ''
  if (/image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(name)) return true
  if (file.type && file.type !== 'application/octet-stream') return false
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
    const box = String.fromCharCode(...head.slice(4, 8))
    const brand = String.fromCharCode(...head.slice(8, 12))
    return box === 'ftyp' && HEIC_BRANDS.includes(brand)
  } catch {
    return false
  }
}

/** 브라우저가 열 수 있는 사진으로. HEIC 면 JPEG 로 바꾸고, 아니면 그대로 */
export async function toDecodable(file: Blob): Promise<Blob> {
  if (!(await isHeicFile(file))) return file
  try {
    const { heicTo } = await import('heic-to')
    return await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 })
  } catch {
    throw new Error('이 HEIC 사진을 열지 못했어요. 다른 사진으로 해 주세요')
  }
}
