import { describe, expect, it } from 'vitest'
import { EMOJI_GROUPS, firstEmoji } from '../../src/lib/emojiCatalog'

describe('습관 아이콘 고르기', () => {
  it.each([
    ['앞뒤 공백', ' 🐳 ', '🐳'],
    ['글자 사이 합친 이모티콘', 'abc🧘‍♀️def🔥', '🧘‍♀️'],
    ['피부색 붙은 이모티콘', '👍🏽', '👍🏽'],
    ['국기', '🇰🇷', '🇰🇷'],
  ])('직접 입력한 글자(%s)에서 첫 이모티콘만 꺼낸다', (_case, text, emoji) => {
    expect(firstEmoji(text)).toBe(emoji)
  })

  it.each([
    ['한글만', '가나다'],
    ['빈 글자', ''],
  ])('%s 이면 꺼낼 이모티콘이 없다', (_case, text) => {
    expect(firstEmoji(text)).toBeUndefined()
  })

  it.each(EMOJI_GROUPS.map((group) => [group.name, group] as const))('%s 주제의 이모티콘은 겹치지 않는다', (_name, group) => {
    expect(new Set(group.emojis).size).toBe(group.emojis.length)
  })

  it.each(EMOJI_GROUPS.map((group) => [group.name, group] as const))('%s 주제의 항목은 모두 이모티콘 하나씩이다', (_name, group) => {
    for (const emoji of group.emojis) expect(firstEmoji(emoji)).toBe(emoji)
  })
})
