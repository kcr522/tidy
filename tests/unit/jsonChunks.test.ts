import { describe, expect, it, vi } from 'vitest'
import { errorHint, jsonPieces, rechunk, splitText } from '../../src/lib/jsonChunks'

const files: Record<string, string> = {}
const calls: string[] = []
vi.mock('@capacitor/filesystem', () => ({
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    writeFile: async ({ path, data }: { path: string; data: string }) => {
      calls.push(`write:${data.length}`)
      files[path] = data
    },
    appendFile: async ({ path, data }: { path: string; data: string }) => {
      calls.push(`append:${data.length}`)
      files[path] += data
    },
  },
}))

const sample = {
  app: 'tidy',
  schemaVersion: 10,
  skip: undefined,
  transactions: [{ id: 1, memo: '점심 🍜', time: undefined, amount: 8000 }],
  diaries: [{ date: '2026-11-13', photos: [{ src: 'data:image/gif;base64,' + 'A'.repeat(5000), note: '😀'.repeat(3) }] }],
  stickers: [{ date: '2026-11-13', emoji: '🎉' }, undefined],
  empty: [],
  nested: { a: [1, [2, { b: null }]] },
}

describe('백업 조각 쓰기', () => {
  it('조각을 이으면 JSON.stringify 와 똑같다', () => {
    expect([...jsonPieces(sample)].join('')).toBe(JSON.stringify(sample))
    expect([...jsonPieces([])].join('')).toBe('[]')
    expect([...jsonPieces('글자')].join('')).toBe('"글자"')
  })

  it('자를 때 이모지를 반으로 가르지 않는다', () => {
    const text = 'a' + '😀'.repeat(10)
    const parts = [...splitText(text, 4)]
    expect(parts.join('')).toBe(text)
    for (const p of parts) expect(() => encodeURIComponent(p)).not.toThrow()
  })

  it('작은 조각을 덩어리로 묶고, 큰 조각은 나눈다', () => {
    const pieces = ['ab', 'cd', 'e'.repeat(25), 'f']
    const chunks = [...rechunk(pieces, 10)]
    expect(chunks.join('')).toBe(pieces.join(''))
    expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(10)
  })

  it('폰 앱: 큰 백업을 여러 번에 나눠 이어 쓴다', async () => {
    const { writeTextChunks } = await import('../../src/platform/writeChunks')
    const big = { diaries: Array.from({ length: 6 }, (_, i) => ({ i, src: 'x'.repeat(300_000) })) }
    await writeTextChunks('backups/a.json', 'DATA' as never, jsonPieces(big))
    expect(files['backups/a.json']).toBe(JSON.stringify(big))
    expect(calls[0]).toMatch(/^write:/)
    expect(calls.filter((c) => c.startsWith('append:')).length).toBeGreaterThan(1)
    expect(Math.max(...calls.map((c) => Number(c.split(':')[1])))).toBeLessThanOrEqual(512 * 1024)
  })

  it('실패 이유를 짧게 붙인다', () => {
    expect(errorHint(new Error('No space left on device'))).toBe(' (No space left on device)')
    expect(errorHint(undefined)).toBe('')
    expect(errorHint('x'.repeat(100)).length).toBeLessThan(70)
  })
})
