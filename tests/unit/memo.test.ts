import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { Memo } from '../../src/db/types'
import { filterMemos, groupByDay, memoPreview, memoTitle, sortMemos } from '../../src/lib/memo'
import { searchAll } from '../../src/lib/search'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { MemoFolderNameError, createMemoRepo } from '../../src/repositories/memoRepo'

let db: TidyDB
afterEach(async () => {
  await db?.delete()
})

const memo = (p: Partial<Memo>): Memo => ({ title: '', text: '', createdAt: '2026-11-17T05:00:00.000Z', updatedAt: '2026-11-17T05:00:00.000Z', ...p })

describe('메모 글자', () => {
  it('제목이 없으면 첫 줄을 제목으로, 미리보기는 그다음 줄부터', () => {
    expect(memoTitle(memo({ text: '\n장보기\n우유, 계란' }))).toBe('장보기')
    expect(memoPreview(memo({ text: '\n장보기\n우유, 계란' }))).toBe('우유, 계란')
    expect(memoTitle(memo({ title: '레시피', text: '김치찌개' }))).toBe('레시피')
    expect(memoPreview(memo({ title: '레시피', text: '김치찌개' }))).toBe('김치찌개')
    expect(memoTitle(memo({ attachments: [{ name: 'a.pdf', type: 'application/pdf', size: 1, src: 'data:application/pdf;base64,AA==' }] }))).toBe('파일만 있는 메모')
  })

  it('고정 먼저, 그다음 최근에 쓴 순서. 쓴 날짜별로 묶는다', () => {
    const list = [
      memo({ id: 1, title: '어제', createdAt: '2026-11-16T03:00:00.000Z' }),
      memo({ id: 2, title: '오늘 아침', createdAt: '2026-11-17T00:30:00.000Z' }),
      memo({ id: 3, title: '오늘 오후', createdAt: '2026-11-17T05:00:00.000Z' }),
      memo({ id: 4, title: '고정', createdAt: '2026-11-01T05:00:00.000Z', pinned: 1 }),
    ]
    expect(sortMemos(list).map((m) => m.id)).toEqual([4, 3, 2, 1])
    const groups = groupByDay(list)
    expect(groups[0].key).toBe('pinned')
    expect(groups.slice(1).map((g) => g.memos.map((m) => m.id))).toEqual([[3, 2], [1]])
  })

  it('검색: 낱말이 모두 들어 있는 메모만 (제목·글·파일 이름)', () => {
    const list = [
      memo({ id: 1, title: '회의', text: '다음 주 발표 자료' }),
      memo({ id: 2, title: '', text: '발표 연습', attachments: [{ name: '슬라이드.pdf', type: 'application/pdf', size: 1, src: 'data:application/pdf;base64,AA==' }] }),
    ]
    expect(filterMemos(list, '발표').map((m) => m.id)).toEqual([1, 2])
    expect(filterMemos(list, '발표 회의').map((m) => m.id)).toEqual([1])
    expect(filterMemos(list, '슬라이드').map((m) => m.id)).toEqual([2])
    expect(filterMemos(list, '  ').length).toBe(2)
  })
})

describe('memoRepo', () => {
  it('새 메모는 쓰기 시작한 시각이 남고, 고쳐도 그대로다', async () => {
    db = new TidyDB('memo-test-1')
    const repo = createMemoRepo(db)
    const id = await repo.add({ title: ' 장보기 ', text: '우유' }, '2026-11-17T05:05:00.000Z')
    expect(await repo.get(id)).toMatchObject({ title: '장보기', text: '우유', createdAt: '2026-11-17T05:05:00.000Z' })
    await repo.setPinned(id, true)
    await repo.update(id, { title: '장보기', text: '우유, 계란' })
    const m = await repo.get(id)
    expect(m).toMatchObject({ text: '우유, 계란', createdAt: '2026-11-17T05:05:00.000Z', pinned: 1 })
    expect(m!.updatedAt > m!.createdAt).toBe(true)
  })

  it('파일집: 색과 이름, 같은 이름은 안 되고, 지우면 메모는 파일집 밖으로', async () => {
    db = new TidyDB('memo-test-2')
    const repo = createMemoRepo(db)
    const f = await repo.addFolder(' 레시피 ', '#e5484d')
    await expect(repo.addFolder('레시피')).rejects.toBeInstanceOf(MemoFolderNameError)
    await expect(repo.addFolder('  ')).rejects.toBeInstanceOf(MemoFolderNameError)
    expect((await repo.folders())[0]).toMatchObject({ name: '레시피', color: '#e5484d' })
    await repo.updateFolder(f, '요리', '#2ea97c')
    expect((await repo.folders())[0]).toMatchObject({ name: '요리', color: '#2ea97c' })

    const id = await repo.add({ title: '김치찌개', text: '', folderId: f })
    expect((await repo.get(id))?.folderId).toBe(f)
    await repo.removeFolder(f)
    expect(await repo.folders()).toEqual([])
    const m = await repo.get(id)
    expect(m).toBeDefined()
    expect(m!.folderId).toBeUndefined()
  })

  it('전체 검색에 메모가 나온다 (파일집 이름으로도)', async () => {
    db = new TidyDB('memo-test-3')
    const repo = createMemoRepo(db)
    const f = await repo.addFolder('여행')
    await repo.add({ title: '제주 준비물', text: '선크림', folderId: f })
    const data = { memos: await repo.list(), memoFolders: await repo.folders() }
    const hits = searchAll(data, '선크림')
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ kind: 'memo', title: '제주 준비물', field: '메모' })
    expect(searchAll(data, '여행')[0]).toMatchObject({ kind: 'memo', field: '파일집' })
  })

  it('백업에 메모와 파일집이 들어가고 다시 가져올 수 있다', async () => {
    db = new TidyDB('memo-test-4')
    const repo = createMemoRepo(db)
    const f = await repo.addFolder('회의', '#4f63e0')
    await repo.add({ title: '주간 회의', text: '안건', folderId: f, attachments: [{ name: 'a.mp4', type: 'video/mp4', size: 3, src: 'data:video/mp4;base64,AAAA' }] })
    const backup = createBackupRepo(db, '0.1.0')
    const text = JSON.stringify(await backup.exportAll())
    await db.memos.clear()
    await db.memoFolders.clear()
    await backup.importAll(text)
    expect(await repo.folders()).toMatchObject([{ name: '회의', color: '#4f63e0' }])
    expect(await repo.list()).toMatchObject([{ title: '주간 회의', folderId: f, attachments: [{ name: 'a.mp4' }] }])
  })
})

describe('메모 위젯', () => {
  it('고정 먼저, 최근 순으로 4개. 파일집 색, 오늘은 시각·다른 날은 날짜. 잠금이면 숨김', async () => {
    const { buildWidgetSummary, memoWidgetView } = await import('../../src/lib/widgetSummary')
    const memos = [
      memo({ id: 1, title: '오래된 고정', pinned: 1, createdAt: '2026-11-01T03:00:00.000Z' }),
      memo({ id: 2, title: '', text: '장보기\n우유', folderId: 7, createdAt: '2026-11-17T05:05:00.000Z' }),
      memo({ id: 3, title: '어제', createdAt: '2026-11-16T03:00:00.000Z' }),
      memo({ id: 4, title: 'a', createdAt: '2026-11-10T03:00:00.000Z' }),
      memo({ id: 5, title: 'b', createdAt: '2026-11-09T03:00:00.000Z' }),
    ]
    const folders = [{ id: 7, name: '집', color: '#e5484d', order: 0, createdAt: '' }]
    const s = buildWidgetSummary([], [], '2026-11-17', false, { memos, memoFolders: folders })
    expect(s.memon).toBe(5)
    const view = memoWidgetView(s, '2026-11-17')
    expect(view.rows.map((r) => r.id)).toEqual([1, 2, 3, 4])
    expect(view.rows[1]).toMatchObject({ t: '장보기', c: '#e5484d', p: 0 })
    expect(view.rows[0].p).toBe(1)
    expect(view.rows[2].when).toBe('11/16')
    const locked = memoWidgetView(buildWidgetSummary([], [], '2026-11-17', true, { memos }), '2026-11-17')
    expect(locked).toMatchObject({ locked: true, rows: [] })
  })
})

describe('손글씨', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo='
  it('읽은 글자 다듬기: 따옴표·코드 블록·"글자 없음"을 걷어 낸다', async () => {
    const { cleanReading } = await import('../../src/lib/ai/handwriting')
    expect(cleanReading('"장보기\n우유"')).toBe('장보기\n우유')
    expect(cleanReading('```\n회의 3시\n```')).toBe('회의 3시')
    expect(cleanReading('(글자 없음)')).toBe('')
  })

  it('Gemini로 읽고, AI가 꺼져 있으면 켜 달라고 한다', async () => {
    const { readHandwriting, HandwritingError } = await import('../../src/lib/ai/handwriting')
    let sent = ''
    const f = (async (_url: string, init?: RequestInit) => {
      sent = String(init?.body ?? '')
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '김치찌개 두부 넣기' }] } }] }))
    }) as typeof fetch
    await expect(readHandwriting(png, undefined, { engine: 'gemini', geminiKey: 'KEY', groqKey: 'G' } as never, f)).resolves.toBe('김치찌개 두부 넣기')
    expect(sent).toContain('image/png')
    await expect(readHandwriting(png, undefined, { engine: 'local' } as never, f)).rejects.toBeInstanceOf(HandwritingError)
  })

  it('손글씨에서 읽은 글자로 메모 검색·전체 검색이 되고, 제목이 없으면 그 글자가 제목', async () => {
    const m = memo({ id: 9, ink: [{ src: png, text: '토요일 등산 준비', at: '2026-11-17T05:00:00.000Z' }] })
    expect(memoTitle(m)).toBe('토요일 등산 준비')
    expect(filterMemos([m], '등산').map((x) => x.id)).toEqual([9])
    expect(searchAll({ memos: [m] }, '등산')[0]).toMatchObject({ kind: 'memo', field: '손글씨' })
    expect(memoTitle(memo({ ink: [{ src: png, at: '2026-11-17T05:00:00.000Z' }] }))).toBe('손글씨 메모')
  })

  it('저장·백업에 손글씨가 들어간다 (그림이 아닌 것은 뺀다)', async () => {
    db = new TidyDB('memo-test-ink')
    const repo = createMemoRepo(db)
    const id = await repo.add({ title: '', text: '', ink: [{ src: png, text: ' 메모 ', at: 'a' }, { src: 'nope', at: 'b' }] })
    expect((await repo.get(id))?.ink).toEqual([{ src: png, text: '메모', at: 'a' }])
    const backup = createBackupRepo(db, '0.1.0')
    const text = JSON.stringify(await backup.exportAll())
    await backup.importAll(text)
    expect((await repo.get(id))?.ink?.[0].text).toBe('메모')
  })
})
