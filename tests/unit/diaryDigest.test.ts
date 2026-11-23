import { describe, expect, it } from 'vitest'
import { cleanDigest, digestHours, localDigest, MAX_DIGEST_LINE, shorten } from '../../src/lib/ai/diaryDigest'

describe('하루 정리 자동으로 채우기', () => {
  it('시간 칸 글과 그 시간 사진 글을 시간 순서로 모은다', () => {
    const list = digestHours({ 13: { text: '점심 김치찌개' }, 9: { text: '  ' }, 8: { text: '출근' } }, [{ src: 'x', time: '13:20', note: '맛있었음' }, { src: 'y', time: '09:10' }])
    expect(list).toEqual([
      { hour: 8, text: '출근' },
      { hour: 13, text: '점심 김치찌개\n맛있었음' },
    ])
  })

  it('기본 정리는 시간마다 한 줄, 길면 줄인다', () => {
    const out = localDigest([
      { hour: 8, text: '출근함.\n지하철 사람 많았다' },
      { hour: 14, text: '회의 '.repeat(30) },
    ])
    const lines = out.split('\n')
    expect(lines[0]).toBe('오전 8시 · 출근함, 지하철 사람 많았다')
    expect(lines[1].startsWith('오후 2시 · ')).toBe(true)
    expect(lines[1].length).toBeLessThanOrEqual('오후 2시 · '.length + MAX_DIGEST_LINE)
  })

  it('짧게 줄일 때 글머리 기호를 뺀다', () => {
    expect(shorten('- 카페\n- 공부')).toBe('카페, 공부')
  })

  it('AI 답에서 받은 시간 줄만 남긴다', () => {
    const hours = [{ hour: 8, text: '출근' }, { hour: 13, text: '점심' }]
    const raw = '정리해 봤어요!\n- **오전 8시 · 출근했음**\n오후 1시: 점심 먹음\n오후 5시 · 지어낸 줄'
    expect(cleanDigest(raw, hours)).toBe('오전 8시 · 출근했음\n오후 1시 · 점심 먹음')
  })
})

describe('하루 정리 보기 좋게', () => {
  it('시간 줄은 시간과 내용으로 나눈다', async () => {
    const { parseDigest } = await import('../../src/lib/ai/diaryDigest')
    expect(parseDigest('오전 12시 · 잠\n오후 12시 · 점심\n오늘 좋았다')).toEqual([
      { time: '오전 12시', hour: 0, body: '잠' },
      { time: '오후 12시', hour: 12, body: '점심' },
      { body: '오늘 좋았다' },
    ])
    expect(parseDigest('그냥 쓴 일기')).toBeNull()
  })
})
