import { describe, expect, it } from 'vitest'
import { cleanDigest, digestHours, localDigest, MAX_DIGEST_LINE, shorten } from '../../src/lib/ai/diaryDigest'

describe('하루 정리 자동으로 채우기', () => {
  it('시간 칸 글과 그 시간 사진 글을 시간 순서로 모으고, 빈 칸은 뺀다', () => {
    const hours = { 13: { text: '점심 김치찌개' }, 9: { text: '  ' }, 8: { text: '출근' } }
    const photos = [{ src: 'x', time: '13:20', note: '맛있었음' }, { src: 'y', time: '09:10' }]

    const list = digestHours(hours, photos)

    expect(list).toEqual([
      { hour: 8, text: '출근' },
      { hour: 13, text: '점심 김치찌개\n맛있었음' },
    ])
  })

  it('기본 정리는 시간마다 한 줄로, 여러 줄 글은 쉼표로 잇는다', () => {
    const out = localDigest([{ hour: 8, text: '출근함.\n지하철 사람 많았다' }])

    expect(out).toBe('오전 8시 · 출근함, 지하철 사람 많았다')
  })

  it('기본 정리에서 긴 글은 한 줄 최대 길이(MAX_DIGEST_LINE)까지 줄인다', () => {
    const longText = '회의 '.repeat(30)
    const prefix = '오후 2시 · '

    const line = localDigest([{ hour: 14, text: longText }])

    expect(line.startsWith(prefix)).toBe(true)
    expect(line.length).toBeLessThanOrEqual(prefix.length + MAX_DIGEST_LINE)
  })

  it('짧게 줄일 때 글머리 기호를 빼고 쉼표로 잇는다', () => {
    expect(shorten('- 카페\n- 공부')).toBe('카페, 공부')
  })

  it('AI 답에서 굵게 · 글머리 표시를 지우고, 보낸 시간의 줄만 남긴다 (지어낸 시간은 버린다)', () => {
    const hours = [{ hour: 8, text: '출근' }, { hour: 13, text: '점심' }]
    const raw = '정리해 봤어요!\n- **오전 8시 · 출근했음**\n오후 1시: 점심 먹음\n오후 5시 · 지어낸 줄'

    expect(cleanDigest(raw, hours)).toBe('오전 8시 · 출근했음\n오후 1시 · 점심 먹음')
  })
})

describe('하루 정리 보기 좋게', () => {
  it('시간 줄은 시간과 내용으로 나누고, 시간 없는 줄은 내용만 둔다', async () => {
    const { parseDigest } = await import('../../src/lib/ai/diaryDigest')

    const parts = parseDigest('오전 12시 · 잠\n오후 12시 · 점심\n오늘 좋았다')

    expect(parts).toEqual([
      { time: '오전 12시', hour: 0, body: '잠' },
      { time: '오후 12시', hour: 12, body: '점심' },
      { body: '오늘 좋았다' },
    ])
  })

  it('시간 줄이 하나도 없으면 그냥 쓴 일기라서 나누지 않는다', async () => {
    const { parseDigest } = await import('../../src/lib/ai/diaryDigest')

    expect(parseDigest('그냥 쓴 일기')).toBeNull()
  })
})
