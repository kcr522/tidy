import { toDecodable } from './heic'

/**
 * 사진을 긴 쪽 maxSide 픽셀로 줄여 JPEG data URL로 바꾼다.
 * 폰 사진(몇 MB)을 그대로 넣으면 저장 공간과 백업 파일이 커지므로 줄여서 저장한다.
 */
export async function shrinkImage(file: File, maxSide = 1080, quality = 0.8): Promise<string> {
  const url = URL.createObjectURL(await toDecodable(file))
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('사진을 열지 못했어요'))
      i.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}
