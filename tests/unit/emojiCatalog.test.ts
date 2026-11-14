import { describe, expect, it } from 'vitest'
import { EMOJI_GROUPS, firstEmoji } from '../../src/lib/emojiCatalog'

describe('습관 아이콘 고르기', () => {
  it('직접 입력한 글자에서 첫 이모티콘만 꺼낸다', () => {
    expect(firstEmoji(' 🐳 ')).toBe('🐳')
    expect(firstEmoji('abc🧘‍♀️def🔥')).toBe('🧘‍♀️')
    expect(firstEmoji('👍🏽')).toBe('👍🏽')
    expect(firstEmoji('🇰🇷')).toBe('🇰🇷')
    expect(firstEmoji('가나다')).toBeUndefined()
    expect(firstEmoji('')).toBeUndefined()
  })

  it('주제마다 이모티콘이 겹치지 않고 모두 이모티콘이다', () => {
    for (const g of EMOJI_GROUPS) {
      expect(new Set(g.emojis).size).toBe(g.emojis.length)
      for (const e of g.emojis) expect(firstEmoji(e)).toBe(e)
    }
  })
})
