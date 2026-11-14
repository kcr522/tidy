/** 습관 아이콘 고르기 창에 보여 줄 이모티콘 (주제별) */
export interface EmojiGroup {
  name: string
  emojis: string[]
}

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    name: '건강',
    emojis: ['💧', '🥤', '💊', '🩺', '🦷', '😴', '🛌', '🧘', '🧘‍♀️', '🫁', '❤️‍🩹', '🧴', '🪥', '🚭', '🍵', '⚖️', '🩹', '🌡️', '👀', '🧠', '💆', '🛁', '🚿', '🧼'],
  },
  {
    name: '운동',
    emojis: ['🏃', '🏃‍♀️', '🚶', '🚶‍♀️', '💪', '🏋️', '🏋️‍♀️', '🚴', '🏊', '🤸', '⛹️', '🧗', '🥾', '⚽', '🏀', '⚾', '🎾', '🏸', '🏓', '⛳', '🥊', '🛹', '⛷️', '🧎'],
  },
  {
    name: '음식',
    emojis: ['🥗', '🥦', '🥕', '🍎', '🍌', '🍓', '🥑', '🥚', '🍳', '🍚', '🍙', '🍜', '🥛', '☕', '🍵', '🧃', '🍫', '🍰', '🍕', '🍔', '🍺', '🍷', '🥜', '🫖'],
  },
  {
    name: '공부·일',
    emojis: ['📚', '📖', '✍️', '✏️', '📝', '📒', '🗒️', '💻', '⌨️', '📊', '📈', '💼', '🗂️', '📅', '⏰', '⏳', '🎯', '🧮', '🔤', '🌐', '🗣️', '🎓', '🔬', '💡'],
  },
  {
    name: '생활',
    emojis: ['🧹', '🧺', '🧽', '🪴', '🌱', '🛏️', '🍽️', '🗑️', '♻️', '🛒', '💰', '💳', '🐷', '📱', '📵', '🔋', '🔑', '👕', '🧦', '💅', '💇', '🪞', '📦', '🏠'],
  },
  {
    name: '취미',
    emojis: ['🎵', '🎸', '🎹', '🎤', '🎧', '🎨', '🖌️', '📷', '🎬', '🎮', '🧩', '♟️', '🧶', '🪡', '📸', '🎲', '🎻', '🥁', '🪕', '🎭', '📺', '🎙️', '🖋️', '🌿'],
  },
  {
    name: '마음',
    emojis: ['😊', '😍', '🥰', '😎', '🥳', '😌', '🙏', '🤗', '💖', '💕', '💛', '💚', '💙', '💜', '🤍', '✨', '⭐', '🌟', '🔥', '💯', '✅', '🍀', '🌈', '☀️'],
  },
  {
    name: '자연·동물',
    emojis: ['🌸', '🌷', '🌻', '🌹', '🍁', '🌳', '🌊', '⛰️', '🌙', '⛅', '☔', '❄️', '🐶', '🐱', '🐰', '🐻', '🐼', '🐥', '🐢', '🐠', '🦋', '🐝', '🦄', '🐾'],
  },
  {
    name: '사람·기타',
    emojis: ['👶', '👨‍👩‍👧', '💑', '👵', '📞', '💌', '🎁', '🎂', '🎉', '🏆', '🥇', '🚗', '🚌', '✈️', '🧳', '⛪', '🕯️', '🔔', '📿', '💸', '⏱️', '🛎️', '🚀', '🎈'],
  },
]

/** 글자에서 첫 번째 이모티콘 하나만 꺼낸다 (직접 입력용). 없으면 undefined */
export function firstEmoji(text: string): string | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter
  const parts = Seg ? Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(trimmed), (s) => s.segment) : Array.from(trimmed)
  return parts.find((p) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(p))
}

const RECENT_KEY = 'tidy.habitEmojiRecent'
const MAX_RECENT = 12

/** 최근에 고른 아이콘 (이 기기에만) */
export function loadRecentEmojis(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

export function pushRecentEmoji(emoji: string): void {
  try {
    const next = [emoji, ...loadRecentEmojis().filter((e) => e !== emoji)].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // 저장이 막혀 있어도 고르기는 된다
  }
}
