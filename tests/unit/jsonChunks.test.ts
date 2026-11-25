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

const CHUNK_LIMIT = 512 * 1024 // 한 번에 폰으로 넘기는 최대 글자 수
const writeSize = (call: string) => Number(call.split(':')[1])

describe('백업 조각 쓰기', () => {
  it.each([
    ['undefined · 이모지 · 중첩이 섞인 백업', sample],
    ['빈 배열', []],
    ['글자 하나', '글자'],
  ])('%s 의 조각을 이으면 JSON.stringify 와 똑같다', (_case, value) => {
    expect([...jsonPieces(value)].join('')).toBe(JSON.stringify(value))
  })

  it('4글자씩 자를 때 이모지를 반으로 가르지 않는다', () => {
    const text = 'a' + '😀'.repeat(10)

    const parts = [...splitText(text, 4)]

    expect(parts.join('')).toBe(text)
    for (const part of parts) expect(() => encodeURIComponent(part)).not.toThrow() // 반쪽 이모지면 encodeURIComponent 가 오류를 낸다
  })

  it('작은 조각은 덩어리로 묶고 한도(10)보다 큰 조각은 나눈다', () => {
    const pieces = ['ab', 'cd', 'e'.repeat(25), 'f']
    const limit = 10

    const chunks = [...rechunk(pieces, limit)]

    expect(chunks.join('')).toBe(pieces.join(''))
    expect(Math.max(...chunks.map((chunk) => chunk.length))).toBeLessThanOrEqual(limit)
  })

  it('폰 앱에서 큰 백업(1.8MB)은 처음 한 번 쓰고 나머지는 0.5MB 이하로 여러 번 이어 쓴다', async () => {
    const { writeTextChunks } = await import('../../src/platform/writeChunks')
    const big = { diaries: Array.from({ length: 6 }, (_, i) => ({ i, src: 'x'.repeat(300_000) })) }

    await writeTextChunks('backups/a.json', 'DATA' as never, jsonPieces(big))

    expect(files['backups/a.json']).toBe(JSON.stringify(big))
    expect(calls[0]).toMatch(/^write:/)
    expect(calls.filter((call) => call.startsWith('append:')).length).toBeGreaterThan(1)
    expect(Math.max(...calls.map(writeSize))).toBeLessThanOrEqual(CHUNK_LIMIT)
  })

  it('실패 이유를 괄호에 넣어 짧게 붙인다', () => {
    expect(errorHint(new Error('No space left on device'))).toBe(' (No space left on device)')
  })

  it('실패 이유가 없으면 아무것도 붙이지 않는다', () => {
    expect(errorHint(undefined)).toBe('')
  })

  it('실패 이유가 100자로 길면 70자 안으로 줄인다', () => {
    expect(errorHint('x'.repeat(100)).length).toBeLessThan(70)
  })
})
