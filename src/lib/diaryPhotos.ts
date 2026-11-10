/**
 * 일기 사진 여러 장 + 시간 타임라인 (사용자 요청 2026-11-10)
 * 사진마다 찍은 시간(HH:mm)과 한 줄 메모를 붙이고, 시간 순서로 보여 준다.
 * 예전 일기는 사진이 photo 한 장뿐이라 시간 없는 사진 하나로 읽는다.
 */
import type { Diary, DiaryPhoto } from '../db/types'

export const MAX_DIARY_PHOTOS = 10
export const MAX_PHOTO_NOTE = 100

export const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

/** 그날 일기의 사진들 (예전 한 장짜리도 포함) */
export function diaryPhotos(d: Pick<Diary, 'photo' | 'photos'> | null | undefined): DiaryPhoto[] {
  if (!d) return []
  if (d.photos?.length) return d.photos
  return d.photo ? [{ src: d.photo }] : []
}

/** 시간 순서로 (시간 없는 사진은 맨 앞, 같은 시간이면 넣은 순서 그대로) */
export function sortByTime<T extends DiaryPhoto>(photos: T[]): T[] {
  return photos
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.time ?? '').localeCompare(b.p.time ?? '') || a.i - b.i)
    .map((x) => x.p)
}

/** 저장할 모양으로 다듬는다: 빈 메모·잘못된 시간은 빼고, 10장까지, 시간 순서 */
export function cleanPhotos(photos: DiaryPhoto[]): DiaryPhoto[] {
  return sortByTime(
    photos
      .filter((p) => typeof p.src === 'string' && p.src.startsWith('data:image/'))
      .slice(0, MAX_DIARY_PHOTOS)
      .map((p) => {
        const out: DiaryPhoto = { src: p.src }
        if (isTime(p.time)) out.time = p.time
        const note = p.note?.trim().slice(0, MAX_PHOTO_NOTE)
        if (note) out.note = note
        return out
      }),
  )
}

/** 지금 시각 HH:mm */
export function nowTime(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
