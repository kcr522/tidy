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

let dbCount = 0
const dbs: TidyDB[] = []
function freshDb() {
  const db = new TidyDB(`attach-test-${dbCount++}`)
  dbs.push(db)
  return db
}
afterEach(async () => {
  for (const db of dbs.splice(0)) {
    db.close()
    await db.delete()
  }
})

describe('첨부 다듬기', () => {
  it('첨부가 12개 넘게 와도 10개까지만 남기고, 주소가 data: 가 아닌 것은 뺀다', () => {
    const many = Array.from({ length: MAX_ATTACHMENTS + 2 }, (_, i) => ({ ...pdf, name: `f${i}.pdf` }))
    const webLink = { name: 'x', type: 'a', size: 1, src: 'http://x' } as Attachment

    const cleaned = cleanAttachments([...many, webLink])

    expect(cleaned).toHaveLength(MAX_ATTACHMENTS)
  })

  it('주소가 data: 형식이 아니면 첨부가 아니다', () => {
    const badSrc = { ...pdf, src: 'nope' }

    expect(isAttachment(badSrc)).toBe(false)
  })

  it('이름이 공백뿐이면 "파일" 로 바꾼다', () => {
    const blankName = { ...pdf, name: '  ' }

    expect(cleanAttachments([blankName])[0].name).toBe('파일')
  })

  it.each([
    [500, '500B'],
    [2048, '2KB'],
    [3 * 1024 * 1024, '3MB'],
  ])('%i 바이트는 "%s" 로 보여 준다', (bytes, label) => {
    expect(formatBytes(bytes)).toBe(label)
  })

  it.each([
    ['보고서.docx', 'DOCX'],
    ['README', '파일'],
  ])('파일 이름 "%s" 의 확장자 글자는 "%s" 다', (name, label) => {
    expect(extLabel(name)).toBe(label)
  })

  it('data URL 의 base64 를 풀어 실제 바이트 수를 센다', () => {
    const hello = 'data:text/plain;base64,aGVsbG8=' // "hello" = 5바이트

    expect(dataUrlBytes(hello)).toBe(5)
  })

  it('작은 파일은 클라우드로 동기화된다', () => {
    expect(syncsToCloud(pdf)).toBe(true)
  })

  it('동기화 한도(MAX_FILE_CHARS)만큼 큰 파일은 이 기기에만 남는다', () => {
    const bigFile = { src: 'data:a;base64,' + 'A'.repeat(MAX_FILE_CHARS) }

    expect(syncsToCloud(bigFile)).toBe(false)
  })
})

describe('파일 → 첨부', () => {
  /** 사진 줄이기가 불리면 실패시키는 도우미 */
  const neverShrink = async () => {
    throw new Error('줄이면 안 돼요')
  }
  const shrinkToJpeg = async () => 'data:image/jpeg;base64,AAAA'

  it('GIF 는 줄이지 않고 그대로 넣는다 (움직임 유지)', async () => {
    const gifFile = new File([new Uint8Array([71, 73, 70])], 'cat.gif', { type: 'image/gif' }) // "GIF" 3바이트

    const attachment = await fileToAttachment(gifFile, neverShrink)

    expect(attachment).toMatchObject({ name: 'cat.gif', type: 'image/gif', size: 3 })
    expect(attachment.src.startsWith('data:image/gif;base64,')).toBe(true)
  })

  it('PDF 는 줄이지 않고 그대로 넣는다', async () => {
    const pdfFile = new File(['%PDF'], '영수증.pdf', { type: 'application/pdf' })

    const attachment = await fileToAttachment(pdfFile, neverShrink)

    expect(attachment).toMatchObject({ name: '영수증.pdf', type: 'application/pdf', size: 4 })
  })

  it('HEIC 사진은 줄인 JPEG 으로 바꾸고 이름도 .jpg 로 바꾼다', async () => {
    const heicFile = new File(['x'], 'IMG_1.HEIC', { type: '' })

    const attachment = await fileToAttachment(heicFile, shrinkToJpeg)

    expect(attachment).toMatchObject({ name: 'IMG_1.jpg', type: 'image/jpeg', size: 3 })
  })

  it('10MB 보다 1바이트라도 큰 파일은 막는다', async () => {
    const big = new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], 'big.zip', { type: 'application/zip' })

    await expect(fileToAttachment(big, neverShrink)).rejects.toBeInstanceOf(AttachmentTooBigError)
  })
})

describe('일정·일기 저장', () => {
  const trip = { title: '여행', startDate: '2026-11-20', endDate: '2026-11-22', color: 'blue' as const, memo: '표' }

  it('일정 메모에 붙인 파일이 순서대로 저장된다', async () => {
    const repo = createEventRepo(freshDb())

    await repo.add({ ...trip, attachments: [pdf, gif] })

    const [event] = await repo.listBetween('2026-11-01', '2026-11-30')
    expect(event.attachments?.map((file) => file.name)).toEqual(['영수증.pdf', 'cat.gif'])
  })

  it('일정의 첨부를 다 빼면 첨부 칸이 사라진다', async () => {
    const repo = createEventRepo(freshDb())
    const id = await repo.add({ ...trip, attachments: [pdf, gif] })

    await repo.update(id, { ...trip, attachments: [] })

    const [after] = await repo.listBetween('2026-11-01', '2026-11-30')
    expect(after.attachments).toBeUndefined()
  })

  it('일기에 GIF 사진과 파일을 넣으면 GIF 가 대표 사진이 된다', async () => {
    const repo = createDiaryRepo(freshDb())

    await repo.save('2026-11-12', { text: '', photos: [{ src: gif.src, time: '09:00' }], attachments: [pdf] })

    const diary = await repo.get('2026-11-12')
    expect(diary?.photo).toBe(gif.src)
    expect(diary?.attachments).toEqual([pdf])
  })

  it('백업으로 내보내고 다시 가져와도 일정 · 일기 첨부가 남는다', async () => {
    const source = freshDb()
    await createEventRepo(source).add({ ...trip, endDate: '2026-11-20', memo: '', attachments: [pdf] })
    await createDiaryRepo(source).save('2026-11-12', { text: '일기', attachments: [gif] })
    const target = freshDb()

    const backup = await createBackupRepo(source, '0.1.0').exportAll()
    await createBackupRepo(target).importAll(JSON.stringify(backup))

    expect((await target.events.toArray())[0].attachments).toEqual([pdf])
    expect((await target.diaries.get('2026-11-12'))?.attachments).toEqual([gif])
  })

  it('동기화할 때 큰 첨부는 파일로 따로 올라가고 다시 같은 모양으로 돌아온다', async () => {
    const bigPdf = { ...pdf, src: 'data:application/pdf;base64,' + 'A'.repeat(5000) }

    const encoded = await encodeRecord({ attachments: [bigPdf] })

    expect(encoded.files.size).toBe(1)
    expect(decodeRecord(encoded.json, encoded.files)).toEqual({ attachments: [bigPdf] })
  })
})

describe('검색', () => {
  it('일정 · 일기의 첨부 파일 이름으로도 찾는다', () => {
    const event = { id: 1, title: '여행', startDate: '2026-11-20', endDate: '2026-11-20', color: 'blue' as const, memo: '', attachments: [pdf], createdAt: '', updatedAt: '' }
    const diary = { date: '2026-11-12', text: '', color: '#fff', attachments: [{ ...pdf, name: '영수증-일기.pdf' }], createdAt: '', updatedAt: '' }

    const hits = searchAll({ events: [event], diaries: [diary] }, '영수증')

    expect(hits.map((hit) => [hit.kind, hit.field])).toEqual([
      ['diary', '첨부 파일'],
      ['event', '첨부 파일'],
    ])
  })
})

describe('일기 파일 첨부로 올린 사진 고르기 (2026-11-21)', () => {
  it.each([
    ['a.jpg', 'image/jpeg', true],
    ['a.gif', 'image/gif', true],
    ['IMG_1.HEIC', '', true], // 폰에서 HEIC 는 type 이 비어서 올 때가 있다
    ['a.pdf', 'application/pdf', false],
    ['a.mp4', 'video/mp4', false],
  ])('%s (%s) 는 사진인가: %s', async (name, type, isPicture) => {
    const { isPictureFile } = await import('../../src/components/common/AttachmentField')

    expect(isPictureFile(new File(['x'], name, { type }))).toBe(isPicture)
  })
})
