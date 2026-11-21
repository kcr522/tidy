import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { Attachment } from '../../src/db/types'
import {
  AttachmentTooBigError, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, cleanAttachments, dataUrlBytes, extLabel, fileToAttachment, formatBytes, isAttachment, syncsToCloud,
} from '../../src/lib/attachments'
import { MAX_FILE_CHARS, decodeRecord, encodeRecord } from '../../src/lib/sync/codec'
import { searchAll } from '../../src/lib/search'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { createDiaryRepo } from '../../src/repositories/diaryRepo'
import { createEventRepo } from '../../src/repositories/eventRepo'

const pdf: Attachment = { name: '영수증.pdf', type: 'application/pdf', size: 3, src: 'data:application/pdf;base64,JVBE' }
const gif: Attachment = { name: 'cat.gif', type: 'image/gif', size: 3, src: 'data:image/gif;base64,R0lG' }

let n = 0
const dbs: TidyDB[] = []
function freshDb() {
  const d = new TidyDB(`attach-test-${n++}`)
  dbs.push(d)
  return d
}
afterEach(async () => {
  for (const d of dbs.splice(0)) {
    d.close()
    await d.delete()
  }
})

describe('첨부 다듬기', () => {
  it('잘못된 것은 빼고 10개까지만 남긴다', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...pdf, name: `f${i}.pdf` }))
    expect(cleanAttachments([...many, { name: 'x', type: 'a', size: 1, src: 'http://x' } as Attachment])).toHaveLength(MAX_ATTACHMENTS)
    expect(isAttachment({ ...pdf, src: 'nope' })).toBe(false)
    expect(cleanAttachments([{ ...pdf, name: '  ' }])[0].name).toBe('파일')
  })

  it('크기·확장자 글자', () => {
    expect(formatBytes(500)).toBe('500B')
    expect(formatBytes(2048)).toBe('2KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3MB')
    expect(extLabel('보고서.docx')).toBe('DOCX')
    expect(extLabel('README')).toBe('파일')
    expect(dataUrlBytes('data:text/plain;base64,aGVsbG8=')).toBe(5)
  })

  it('큰 파일은 이 기기에만 남는다고 알려 준다', () => {
    expect(syncsToCloud(pdf)).toBe(true)
    expect(syncsToCloud({ src: 'data:a;base64,' + 'A'.repeat(MAX_FILE_CHARS) })).toBe(false)
  })
})

describe('파일 → 첨부', () => {
  const never = async () => {
    throw new Error('줄이면 안 돼요')
  }

  it('GIF 는 줄이지 않고 그대로 넣는다 (움직임 유지)', async () => {
    const a = await fileToAttachment(new File([new Uint8Array([71, 73, 70])], 'cat.gif', { type: 'image/gif' }), never)
    expect(a).toMatchObject({ name: 'cat.gif', type: 'image/gif', size: 3 })
    expect(a.src.startsWith('data:image/gif;base64,')).toBe(true)
  })

  it('PDF 는 그대로, 사진은 줄인 JPEG 으로', async () => {
    const p = await fileToAttachment(new File(['%PDF'], '영수증.pdf', { type: 'application/pdf' }), never)
    expect(p).toMatchObject({ name: '영수증.pdf', type: 'application/pdf', size: 4 })
    const photo = await fileToAttachment(new File(['x'], 'IMG_1.HEIC', { type: '' }), async () => 'data:image/jpeg;base64,AAAA')
    expect(photo).toMatchObject({ name: 'IMG_1.jpg', type: 'image/jpeg', size: 3 })
  })

  it('10MB 보다 큰 파일은 막는다', async () => {
    const big = new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], 'big.zip', { type: 'application/zip' })
    await expect(fileToAttachment(big, never)).rejects.toBeInstanceOf(AttachmentTooBigError)
  })
})

describe('일정·일기 저장', () => {
  it('일정 메모에 파일을 붙이고, 다 빼면 칸이 사라진다', async () => {
    const repo = createEventRepo(freshDb())
    const id = await repo.add({ title: '여행', startDate: '2026-11-20', endDate: '2026-11-22', color: 'blue', memo: '표', attachments: [pdf, gif] })
    const [e] = await repo.listBetween('2026-11-01', '2026-11-30')
    expect(e.attachments?.map((a) => a.name)).toEqual(['영수증.pdf', 'cat.gif'])
    await repo.update(id, { title: '여행', startDate: '2026-11-20', endDate: '2026-11-22', color: 'blue', memo: '표', attachments: [] })
    const [after] = await repo.listBetween('2026-11-01', '2026-11-30')
    expect(after.attachments).toBeUndefined()
  })

  it('일기에 GIF 사진과 파일을 넣는다', async () => {
    const repo = createDiaryRepo(freshDb())
    await repo.save('2026-11-12', { text: '', photos: [{ src: gif.src, time: '09:00' }], attachments: [pdf] })
    const d = await repo.get('2026-11-12')
    expect(d?.photo).toBe(gif.src)
    expect(d?.attachments).toEqual([pdf])
  })

  it('백업으로 내보내고 다시 가져와도 첨부가 남는다', async () => {
    const a = freshDb()
    await createEventRepo(a).add({ title: '여행', startDate: '2026-11-20', endDate: '2026-11-20', color: 'blue', memo: '', attachments: [pdf] })
    await createDiaryRepo(a).save('2026-11-12', { text: '일기', attachments: [gif] })
    const backup = await createBackupRepo(a, '0.1.0').exportAll()
    const b = freshDb()
    await createBackupRepo(b).importAll(JSON.stringify(backup))
    expect((await b.events.toArray())[0].attachments).toEqual([pdf])
    expect((await b.diaries.get('2026-11-12'))?.attachments).toEqual([gif])
  })

  it('동기화: 큰 첨부는 파일로 따로 올라가고 다시 같은 모양으로 돌아온다', async () => {
    const bigPdf = { ...pdf, src: 'data:application/pdf;base64,' + 'A'.repeat(5000) }
    const enc = await encodeRecord({ attachments: [bigPdf] })
    expect(enc.files.size).toBe(1)
    expect(decodeRecord(enc.json, enc.files)).toEqual({ attachments: [bigPdf] })
  })
})

describe('검색', () => {
  it('첨부 파일 이름으로도 찾는다', () => {
    const hits = searchAll(
      {
        events: [{ id: 1, title: '여행', startDate: '2026-11-20', endDate: '2026-11-20', color: 'blue', memo: '', attachments: [pdf], createdAt: '', updatedAt: '' }],
        diaries: [{ date: '2026-11-12', text: '', color: '#fff', attachments: [{ ...pdf, name: '영수증-일기.pdf' }], createdAt: '', updatedAt: '' }],
      },
      '영수증',
    )
    expect(hits.map((h) => [h.kind, h.field])).toEqual([
      ['diary', '첨부 파일'],
      ['event', '첨부 파일'],
    ])
  })
})

describe('일기 파일 첨부로 올린 사진 고르기 (2026-11-21)', () => {
  it('사진 · GIF · HEIC 는 사진으로, 나머지는 파일로', async () => {
    const { isPictureFile } = await import('../../src/components/common/AttachmentField')
    const f = (name: string, type: string) => new File(['x'], name, { type })
    expect(isPictureFile(f('a.jpg', 'image/jpeg'))).toBe(true)
    expect(isPictureFile(f('a.gif', 'image/gif'))).toBe(true)
    expect(isPictureFile(f('IMG_1.HEIC', ''))).toBe(true)
    expect(isPictureFile(f('a.pdf', 'application/pdf'))).toBe(false)
    expect(isPictureFile(f('a.mp4', 'video/mp4'))).toBe(false)
  })
})
