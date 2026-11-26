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

const memo = (over: Partial<Memo>): Memo => ({ title: '', text: '', createdAt: '2026-11-17T05:00:00.000Z', updatedAt: '2026-11-17T05:00:00.000Z', ...over })
const pdfFile = (name: string) => ({ name, type: 'application/pdf', size: 1, src: 'data:application/pdf;base64,AA==' })
const PNG = 'data:image/png;base64,iVBORw0KGgo='
const TODAY = '2026-11-17'
const PINNED = 1

describe('메모 글자', () => {
  it.each([
    ['제목이 없으면 첫 글줄', memo({ text: '\n장보기\n우유, 계란' }), '장보기'],
    ['제목이 있으면 제목', memo({ title: '레시피', text: '김치찌개' }), '레시피'],
    ['글 없이 파일만 있으면 안내 글', memo({ attachments: [pdfFile('a.pdf')] }), '파일만 있는 메모'],
  ])('메모 제목: %s', (_case, item, title) => {
    expect(memoTitle(item)).toBe(title)
  })

  it.each([
    ['제목이 없으면 제목으로 쓴 줄 다음부터', memo({ text: '\n장보기\n우유, 계란' }), '우유, 계란'],
    ['제목이 있으면 글 처음부터', memo({ title: '레시피', text: '김치찌개' }), '김치찌개'],
  ])('메모 미리보기: %s', (_case, item, preview) => {
    expect(memoPreview(item)).toBe(preview)
  })

  const byDay = [
    memo({ id: 1, title: '어제', createdAt: '2026-11-16T03:00:00.000Z' }),
    memo({ id: 2, title: '오늘 아침', createdAt: '2026-11-17T00:30:00.000Z' }),
    memo({ id: 3, title: '오늘 오후', createdAt: '2026-11-17T05:00:00.000Z' }),
    memo({ id: 4, title: '고정', createdAt: '2026-11-01T05:00:00.000Z', pinned: PINNED }),
  ]

  it('고정한 메모가 먼저, 그다음 최근에 쓴 순서다', () => {
    expect(sortMemos(byDay).map((item) => item.id)).toEqual([4, 3, 2, 1])
  })

  it('고정 묶음을 맨 위에 두고 나머지는 쓴 날짜별로 묶는다', () => {
    const groups = groupByDay(byDay)

    expect(groups[0].key).toBe('pinned')
    expect(groups.slice(1).map((group) => group.memos.map((item) => item.id))).toEqual([[3, 2], [1]])
  })

  const searchable = [memo({ id: 1, title: '회의', text: '다음 주 발표 자료' }), memo({ id: 2, title: '', text: '발표 연습', attachments: [pdfFile('슬라이드.pdf')] })]

  it.each([
    ['발표', [1, 2]],
    ['발표 회의', [1]], // 낱말이 모두 들어 있어야 한다
    ['슬라이드', [2]], // 파일 이름도 찾는다
    ['  ', [1, 2]], // 빈 검색어는 전체
  ])('메모 검색 "%s" 은 %j 번 메모를 찾는다', (query, ids) => {
    expect(filterMemos(searchable, query).map((item) => item.id)).toEqual(ids)
  })
})

describe('memoRepo', () => {
  const STARTED_AT = '2026-11-17T05:05:00.000Z'

  it('꾸민 글은 html 에 있는 사진만 남기고 글만 뽑은 text 도 저장한다', async () => {
    db = new TidyDB(`memo-rich-${Math.random()}`)
    const repo = createMemoRepo(db)
    const html = '<ul><li><mark>우유</mark></li></ul><img data-pic="p1" alt="">'

    const id = await repo.add({ title: '', text: '• 우유', html, pics: [{ id: 'p1', src: PNG }, { id: 'gone', src: PNG }] })

    const saved = await repo.get(id)
    expect(saved?.pics).toEqual([{ id: 'p1', src: PNG }])
    expect(saved?.text).toBe('• 우유')
    expect((await createBackupRepo(db).exportAll()).memos[0].html).toContain('<mark>')
  })

  it('꾸밈 없이 고치면 html 을 지운다', async () => {
    db = new TidyDB(`memo-rich-${Math.random()}`)
    const repo = createMemoRepo(db)
    const id = await repo.add({ title: '', text: '• 우유', html: '<ul><li>우유</li></ul>' })

    await repo.update(id, { title: '', text: '그냥 글' })

    expect((await repo.get(id))?.html).toBeUndefined()
  })

  it('새 메모는 제목 앞뒤 공백을 지우고 쓰기 시작한 시각을 남긴다', async () => {
    db = new TidyDB('memo-test-1')
    const repo = createMemoRepo(db)

    const id = await repo.add({ title: ' 장보기 ', text: '우유' }, STARTED_AT)

    expect(await repo.get(id)).toMatchObject({ title: '장보기', text: '우유', createdAt: STARTED_AT })
  })

  it('고정하고 고쳐도 쓰기 시작한 시각은 그대로고 고친 시각만 늦어진다', async () => {
    db = new TidyDB('memo-test-1b')
    const repo = createMemoRepo(db)
    const id = await repo.add({ title: '장보기', text: '우유' }, STARTED_AT)

    await repo.setPinned(id, true)
    await repo.update(id, { title: '장보기', text: '우유, 계란' })

    const saved = await repo.get(id)
    expect(saved).toMatchObject({ text: '우유, 계란', createdAt: STARTED_AT, pinned: PINNED })
    expect(saved!.updatedAt > saved!.createdAt).toBe(true)
  })

  it('파일집은 이름 앞뒤 공백을 지우고 색과 함께 저장하며, 고칠 수 있다', async () => {
    db = new TidyDB('memo-test-2')
    const repo = createMemoRepo(db)

    const folder = await repo.addFolder(' 레시피 ', '#e5484d')
    expect((await repo.folders())[0]).toMatchObject({ name: '레시피', color: '#e5484d' })

    await repo.updateFolder(folder, '요리', '#2ea97c')
    expect((await repo.folders())[0]).toMatchObject({ name: '요리', color: '#2ea97c' })
  })

  it.each([
    ['이미 있는 이름', '레시피'],
    ['공백뿐인 이름', '  '],
  ])('파일집 이름이 %s 이면 만들지 않는다', async (_case, name) => {
    db = new TidyDB(`memo-folder-${Math.random()}`)
    const repo = createMemoRepo(db)
    await repo.addFolder('레시피')

    await expect(repo.addFolder(name)).rejects.toBeInstanceOf(MemoFolderNameError)
  })

  it('파일집을 지우면 안에 있던 메모는 남고 파일집 밖으로 나온다', async () => {
    db = new TidyDB('memo-test-2b')
    const repo = createMemoRepo(db)
    const folder = await repo.addFolder('요리')
    const id = await repo.add({ title: '김치찌개', text: '', folderId: folder })
    expect((await repo.get(id))?.folderId).toBe(folder)

    await repo.removeFolder(folder)

    expect(await repo.folders()).toEqual([])
    const saved = await repo.get(id)
    expect(saved).toBeDefined()
    expect(saved!.folderId).toBeUndefined()
  })

  it('전체 검색에 메모가 나오고, 파일집 이름으로도 찾는다', async () => {
    db = new TidyDB('memo-test-3')
    const repo = createMemoRepo(db)
    const folder = await repo.addFolder('여행')
    await repo.add({ title: '제주 준비물', text: '선크림', folderId: folder })
    const data = { memos: await repo.list(), memoFolders: await repo.folders() }

    const byText = searchAll(data, '선크림')
    const byFolder = searchAll(data, '여행')

    expect(byText).toHaveLength(1)
    expect(byText[0]).toMatchObject({ kind: 'memo', title: '제주 준비물', field: '메모' })
    expect(byFolder[0]).toMatchObject({ kind: 'memo', field: '파일집' })
  })

  it('메모와 파일집 · 첨부는 백업에 들어가 다시 가져올 수 있다', async () => {
    db = new TidyDB('memo-test-4')
    const repo = createMemoRepo(db)
    const folder = await repo.addFolder('회의', '#4f63e0')
    await repo.add({ title: '주간 회의', text: '안건', folderId: folder, attachments: [{ name: 'a.mp4', type: 'video/mp4', size: 3, src: 'data:video/mp4;base64,AAAA' }] })
    const backup = createBackupRepo(db, '0.1.0')
    const text = JSON.stringify(await backup.exportAll())
    await db.memos.clear()
    await db.memoFolders.clear()

    await backup.importAll(text)

    expect(await repo.folders()).toMatchObject([{ name: '회의', color: '#4f63e0' }])
    expect(await repo.list()).toMatchObject([{ title: '주간 회의', folderId: folder, attachments: [{ name: 'a.mp4' }] }])
  })
})

describe('메모 위젯', () => {
  const memos = [
    memo({ id: 1, title: '오래된 고정', pinned: PINNED, createdAt: '2026-11-01T03:00:00.000Z' }),
    memo({ id: 2, title: '', text: '장보기\n우유', folderId: 7, createdAt: '2026-11-17T05:05:00.000Z' }),
    memo({ id: 3, title: '어제', createdAt: '2026-11-16T03:00:00.000Z' }),
    memo({ id: 4, title: 'a', createdAt: '2026-11-10T03:00:00.000Z' }),
    memo({ id: 5, title: 'b', createdAt: '2026-11-09T03:00:00.000Z' }),
  ]
  const folders = [{ id: 7, name: '집', color: '#e5484d', order: 0, createdAt: '' }]
  const UNLOCKED = false
  const LOCKED = true

  it('고정 먼저, 최근 순으로 4개를 보여 주고 전체 수도 센다', async () => {
    const { buildWidgetSummary, memoWidgetView } = await import('../../src/lib/widgetSummary')

    const summary = buildWidgetSummary([], [], TODAY, UNLOCKED, { memos, memoFolders: folders })
    const view = memoWidgetView(summary, TODAY)

    expect(summary.memon).toBe(5)
    expect(view.rows.map((row) => row.id)).toEqual([1, 2, 3, 4])
    expect(view.rows[0].p).toBe(1)
  })

  it('줄마다 파일집 색을 붙이고, 다른 날 메모는 날짜를 보여 준다', async () => {
    const { buildWidgetSummary, memoWidgetView } = await import('../../src/lib/widgetSummary')

    const view = memoWidgetView(buildWidgetSummary([], [], TODAY, UNLOCKED, { memos, memoFolders: folders }), TODAY)

    expect(view.rows[1]).toMatchObject({ t: '장보기', c: '#e5484d', p: 0 })
    expect(view.rows[2].when).toBe('11/16')
  })

  it('앱 잠금 중이면 메모를 숨긴다', async () => {
    const { buildWidgetSummary, memoWidgetView } = await import('../../src/lib/widgetSummary')

    const view = memoWidgetView(buildWidgetSummary([], [], TODAY, LOCKED, { memos }), TODAY)

    expect(view).toMatchObject({ locked: true, rows: [] })
  })
})

describe('손글씨', () => {
  it.each([
    ['바깥 따옴표', '"장보기\n우유"', '장보기\n우유'],
    ['코드 블록', '```\n회의 3시\n```', '회의 3시'],
    ['"글자 없음" 답', '(글자 없음)', ''],
  ])('읽은 글자에서 %s 을 걷어 낸다', async (_case, raw, text) => {
    const { cleanReading } = await import('../../src/lib/ai/handwriting')

    expect(cleanReading(raw)).toBe(text)
  })

  it('Gemini 를 켜 두면 손글씨 그림을 보내 글자를 읽는다', async () => {
    const { readHandwriting } = await import('../../src/lib/ai/handwriting')
    let sent = ''
    const fakeGemini = (async (_url: string, init?: RequestInit) => {
      sent = String(init?.body ?? '')
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '김치찌개 두부 넣기' }] } }] }))
    }) as typeof fetch

    const text = await readHandwriting(PNG, undefined, { engine: 'gemini', geminiKey: 'KEY', groqKey: 'G' } as never, fakeGemini)

    expect(text).toBe('김치찌개 두부 넣기')
    expect(sent).toContain('image/png')
  })

  it('AI 가 꺼져 있으면 읽지 않고 켜 달라는 HandwritingError 를 낸다', async () => {
    const { readHandwriting, HandwritingError } = await import('../../src/lib/ai/handwriting')
    const neverCalled = (async () => new Response('{}')) as typeof fetch

    await expect(readHandwriting(PNG, undefined, { engine: 'local' } as never, neverCalled)).rejects.toBeInstanceOf(HandwritingError)
  })

  it('손글씨에서 읽은 글자로 메모 검색 · 전체 검색이 되고, 제목이 없으면 그 글자가 제목이다', () => {
    const inkMemo = memo({ id: 9, ink: [{ src: PNG, text: '토요일 등산 준비', at: '2026-11-17T05:00:00.000Z' }] })

    expect(memoTitle(inkMemo)).toBe('토요일 등산 준비')
    expect(filterMemos([inkMemo], '등산').map((item) => item.id)).toEqual([9])
    expect(searchAll({ memos: [inkMemo] }, '등산')[0]).toMatchObject({ kind: 'memo', field: '손글씨' })
  })

  it('읽은 글자가 없는 손글씨 메모의 제목은 "손글씨 메모" 다', () => {
    expect(memoTitle(memo({ ink: [{ src: PNG, at: '2026-11-17T05:00:00.000Z' }] }))).toBe('손글씨 메모')
  })

  it('손글씨는 그림이 아닌 것을 빼고 저장하며 백업에도 들어간다', async () => {
    db = new TidyDB('memo-test-ink')
    const repo = createMemoRepo(db)
    const id = await repo.add({ title: '', text: '', ink: [{ src: PNG, text: ' 메모 ', at: 'a' }, { src: 'nope', at: 'b' }] })
    expect((await repo.get(id))?.ink).toEqual([{ src: PNG, text: '메모', at: 'a' }])
    const backup = createBackupRepo(db, '0.1.0')

    await backup.importAll(JSON.stringify(await backup.exportAll()))

    expect((await repo.get(id))?.ink?.[0].text).toBe('메모')
  })
})
