import { db as defaultDb, type TidyDB } from '../db/database'
import type { DaySticker } from '../db/types'
import { nowIso } from '../lib/date'

/** 스티커 고르는 창에 보여 줄 이모티콘 */
export const STICKER_EMOJIS = [
  '🔥', '⭐', '❤️', '🎉', '🎂', '🎁', '💪', '✨',
  '😊', '😍', '🥰', '😎', '🥳', '😴', '😭', '😡',
  '✈️', '🏖️', '🚗', '🏃', '🏋️', '🧘', '📚', '✏️',
  '💼', '💰', '🛍️', '🍀', '☕', '🍰', '🍕', '🍺',
  '🍜', '🍣', '🎬', '🎮', '🎵', '🏥', '💊', '🐶',
  '🐱', '🌸', '🌈', '☀️', '☔', '❄️', '💯', '✅',
]

export function createStickerRepo(database: TidyDB = defaultDb) {
  return {
    /** from~to 사이 스티커 */
    listBetween(from: string, to: string): Promise<DaySticker[]> {
      return database.stickers.where('date').between(from, to, true, true).toArray()
    },
    /** 그날 스티커를 붙인다 (이미 있으면 바꾼다). emoji가 없으면 뗀다 */
    async set(date: string, emoji: string | null): Promise<void> {
      if (!emoji) await database.stickers.delete(date)
      else await database.stickers.put({ date, emoji, updatedAt: nowIso() })
    },
  }
}

export const stickerRepo = createStickerRepo()
