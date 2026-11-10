// 음식 사진에서 찍은 때와 위치를 읽고, AI에 보낼 작은 사진을 만든다.
// 원본 사진은 기기 밖으로 나가지 않는다: 줄인 사진(위치 정보 없음)과 좌표 숫자만 보낸다.

export interface PhotoInfo {
  /** YYYY-MM-DD */
  date: string
  /** HH:mm */
  time: string
  /** 사진 속 위치. 없으면 undefined */
  location?: { lat: number; lng: number }
  /** 찍은 때를 사진 정보에서 읽었는지 (아니면 파일 날짜) */
  fromExif: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateTime(d: Date): { date: string; time: string } {
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}

/** 위도·경도가 말이 되는 값인지 (0,0 은 위치 없음으로 본다) */
export function validLocation(lat: unknown, lng: unknown): { lat: number; lng: number } | undefined {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return undefined
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return undefined
  return { lat, lng }
}

/** 사진 정보(EXIF)에서 찍은 때와 위치를 읽는다. 없으면 파일 날짜를 쓴다 */
export async function readPhotoInfo(file: File): Promise<PhotoInfo> {
  let taken: Date | undefined
  let location: PhotoInfo['location']
  try {
    const { default: exifr } = await import('exifr')
    const tags = (await exifr.parse(await file.arrayBuffer(), { gps: true, exif: true, tiff: true, pick: ['DateTimeOriginal', 'CreateDate', 'latitude', 'longitude'] })) as
      | { DateTimeOriginal?: Date; CreateDate?: Date; latitude?: number; longitude?: number }
      | undefined
    const d = tags?.DateTimeOriginal ?? tags?.CreateDate
    if (d instanceof Date && !Number.isNaN(d.getTime())) taken = d
    location = validLocation(tags?.latitude, tags?.longitude)
  } catch {
    // 사진 정보가 없거나 읽지 못하는 형식
  }
  const when = taken ?? new Date(file.lastModified || Date.now())
  return { ...toDateTime(when), ...(location ? { location } : {}), fromExif: taken !== undefined }
}

/** 긴 쪽을 이만큼으로 줄인다 (음식 알아보기에 충분하고 요금이 적게 든다) */
export const MAX_SIDE = 1280

/** AI에 보낼 JPEG (base64). 다시 그리면서 사진 속 위치 정보는 사라진다 */
export async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const url = canvas.toDataURL('image/jpeg', 0.82)
  return url.slice(url.indexOf(',') + 1)
}
