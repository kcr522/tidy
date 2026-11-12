import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Clock, ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AttachmentField, { DropOverlay, filesToAttachments } from '../components/common/AttachmentField'
import Button from '../components/common/Button'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PageHeader from '../components/common/PageHeader'
import { useToast } from '../components/common/Toast'
import { addDays } from 'date-fns'
import { useFileDrop } from '../hooks/useFileDrop'
import { useToday } from '../hooks/useToday'
import { MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, cleanAttachments, readAsDataUrl } from '../lib/attachments'
import { dayTitle } from '../lib/calendar'
import { parseDateKey, toDateKey } from '../lib/date'
import { shrinkImage } from '../lib/image'
import { readPhotoInfo } from '../lib/meal/photo'
import { MAX_DIARY_PHOTOS, MAX_PHOTO_NOTE, cleanPhotos, diaryPhotos, nowTime, sortByTime } from '../lib/diaryPhotos'
import type { Attachment, Diary, DiaryPhoto } from '../db/types'
import { diaryRepo } from '../repositories/diaryRepo'

const MAX_TEXT = 2000

/** 일기: 오늘 한 일을 글과 사진으로 남긴다. 캘린더에 색이나 사진으로 표시된다 */
export default function DiaryPage() {
  const today = useToday()
  const location = useLocation()
  const navigate = useNavigate()
  const [date, setDate] = useState<string>(() => (location.state as { date?: string } | null)?.date ?? today)
  // AI 대화창의 "내가 등록할게": 이 글을 일기 칸에 채워서 연다 (한 번만 쓰고 지운다)
  const [draft, setDraft] = useState(() => {
    const s = location.state as { draft?: string; photo?: string } | null
    return s?.draft || s?.photo ? { text: s.draft ?? '', photo: s.photo } : null
  })
  useEffect(() => {
    if (draft) navigate(location.pathname, { replace: true, state: null })
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const entry = useLiveQuery(() => diaryRepo.get(date).then((d) => d ?? null), [date])
  const recent = useLiveQuery(() => diaryRepo.recent(30), [])
  const shift = (n: number) => setDate(toDateKey(addDays(parseDateKey(date), n)))

  return (
    <>
      <PageHeader title="일기" />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-start">
        {entry === undefined || (entry && entry.date !== date) ? (
          <section className="card min-h-96 p-4" />
        ) : (
          <DiaryEditor
            key={`${date}-${entry?.updatedAt ?? 'new'}`}
            date={date}
            today={today}
            entry={entry}
            draft={draft ?? undefined}
            onShift={(n) => {
              setDraft(null)
              shift(n)
            }}
          />
        )}

        <section className="card overflow-hidden" aria-label="지난 일기">
          <h2 className="border-b border-slate-100 px-4 py-3 text-[17px] font-bold">지난 일기</h2>
          {!recent?.length ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">아직 쓴 일기가 없어요</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((d) => (
                <li key={d.date}>
                  <button type="button" onClick={() => setDate(d.date)} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${d.date === date ? 'bg-brand-50' : ''}`}>
                    {d.photo ? (
                      <img src={d.photo} alt="" className="size-12 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="size-12 shrink-0 rounded-xl" style={{ background: d.color }} aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">
                        {dayTitle(d.date)}
                        {(d.photos?.length ?? 0) > 1 && <span className="ml-1.5 text-xs font-semibold text-slate-400">사진 {d.photos!.length}장</span>}
                        {!!d.attachments?.length && <span className="ml-1.5 text-xs font-semibold text-slate-400">파일 {d.attachments.length}개</span>}
                      </span>
                      <span className="line-clamp-2 text-sm text-slate-500">{d.text || (d.photo ? '사진만 있어요' : '파일만 있어요')}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

    </>
  )
}

type Item = DiaryPhoto & { key: string }
let nextKey = 0
const withKey = (p: DiaryPhoto): Item => ({ ...p, key: `p${nextKey++}` })

interface EditorProps {
  date: string
  today: string
  entry: Diary | null
  /** 채워 둘 글 (이미 쓴 일기가 있으면 뒤에 붙인다) */
  draft?: { text: string; photo?: string }
  onShift: (n: number) => void
}

/** 그날 일기 쓰기 칸 (날짜나 저장된 내용이 바뀌면 key로 새로 그린다) */
function DiaryEditor({ date, today, entry, draft, onShift: shift }: EditorProps) {
  const [text, setText] = useState(() => [entry?.text, draft?.text].filter(Boolean).join('\n\n'))
  const [photos, setPhotos] = useState<Item[]>(() =>
    [...diaryPhotos(entry), ...(draft?.photo ? [{ src: draft.photo, time: nowTime() }] : [])].map(withKey),
  )
  const [files, setFiles] = useState<Attachment[]>(() => entry?.attachments ?? [])
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const cleaned = cleanPhotos(photos)
  const dirty = text !== (entry?.text ?? '') || JSON.stringify(cleaned) !== JSON.stringify(cleanPhotos(diaryPhotos(entry))) ||
    JSON.stringify(cleanAttachments(files)) !== JSON.stringify(cleanAttachments(entry?.attachments))
  const empty = text.trim() === '' && photos.length === 0 && files.length === 0
  const room = MAX_DIARY_PHOTOS - photos.length
  const timeline = sortByTime(photos)

  /** 사진 여러 장을 넣는다. 찍은 시간은 사진 정보에서 읽고, 없으면 파일 시간 */
  async function pickPhotos(list: FileList | File[] | null) {
    const files = Array.from(list ?? [])
    if (files.length === 0) return
    if (room <= 0) {
      toast(`사진은 하루에 ${MAX_DIARY_PHOTOS}장까지 넣을 수 있어요`, 'error')
      return
    }
    setAdding(true)
    let failed = 0
    const added: Item[] = []
    for (const file of files.slice(0, room)) {
      try {
        // GIF 는 줄이면 움직임이 사라져서 그대로 넣는다
        const isGif = file.type === 'image/gif'
        if (isGif && file.size > MAX_ATTACHMENT_BYTES) throw new Error('too big')
        const [src, info] = await Promise.all([isGif ? readAsDataUrl(file) : shrinkImage(file), readPhotoInfo(file)])
        added.push(withKey({ src, time: info.time }))
      } catch {
        failed++
      }
    }
    setPhotos((old) => [...old, ...added].slice(0, MAX_DIARY_PHOTOS))
    setAdding(false)
    if (files.length > room) toast(`사진은 하루에 ${MAX_DIARY_PHOTOS}장까지라서 ${files.length - room}장은 빼고 넣었어요`, 'error')
    else if (failed) toast(`${failed}장은 넣지 못했어요. 다른 사진으로 해 주세요`, 'error')
  }

  /** 컴퓨터에서 끌어다 놓기: 사진·GIF 는 사진 타임라인으로, 나머지는 파일로 */
  const dragging = useFileDrop(async (dropped) => {
    const isPic = (f: File) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)
    const pics = dropped.filter(isPic)
    const others = dropped.filter((f) => !isPic(f))
    if (pics.length) await pickPhotos(pics)
    if (others.length) {
      const { added, error } = await filesToAttachments(others, MAX_ATTACHMENTS - files.length)
      setFiles((old) => [...old, ...added].slice(0, MAX_ATTACHMENTS))
      if (error) toast(error, 'error')
    }
  })

  const change = (key: string, patch: Partial<DiaryPhoto>) => setPhotos((old) => old.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  const drop = (key: string) => setPhotos((old) => old.filter((p) => p.key !== key))

  async function save() {
    if (empty) return
    setSaving(true)
    try {
      await diaryRepo.save(date, { text: text.trim(), photos: cleaned, attachments: files })
      toast('일기를 저장했어요')
    } catch {
      toast('저장하지 못했어요. 사진이 너무 크면 다른 사진으로 해 주세요', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    await diaryRepo.remove(date)
    setDeleting(false)
    toast('삭제했어요')
  }


  return (
    <>
        <section className="card p-4">
        <div className="mb-3 flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="전날">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <h2 className="flex-1 text-center text-[17px] font-bold">
            {dayTitle(date)}
            {date === today && <span className="ml-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">오늘</span>}
          </h2>
          <button type="button" onClick={() => shift(1)} disabled={date >= today} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="다음날">
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>

        {timeline.length > 0 && (
          <ol className="mb-3" aria-label="사진 타임라인">
            {timeline.map((p, i) => (
              <li key={p.key} className="relative flex gap-3 pb-4 last:pb-1">
                {/* 시간 줄 */}
                <div className="flex w-16 shrink-0 flex-col items-center">
                  {/* 보이는 건 24시간 글자, 누르면 위에 투명하게 덮은 시간 고르기가 열린다 */}
                  <label className="relative flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-xs font-bold whitespace-nowrap text-brand-700">
                    <Clock className="size-3 shrink-0" aria-hidden />
                    {p.time ?? '시간'}
                    <input
                      type="time"
                      value={p.time ?? ''}
                      onChange={(e) => change(p.key, { time: e.target.value || undefined })}
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                      aria-label={`${i + 1}번째 사진 시간`}
                    />
                  </label>
                  {i < timeline.length - 1 && <span className="mt-1 w-0.5 flex-1 rounded-full bg-slate-200" aria-hidden />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="relative overflow-hidden rounded-2xl bg-slate-100">
                    <img src={p.src} alt={p.note || `${i + 1}번째 사진`} className="max-h-80 w-full object-contain" />
                    <button type="button" onClick={() => drop(p.key)} className="absolute top-2 right-2 rounded-full bg-slate-900/60 p-1.5 text-white" aria-label={`${i + 1}번째 사진 빼기`}>
                      <X className="size-4" strokeWidth={2.5} aria-hidden />
                    </button>
                  </div>
                  <input
                    value={p.note ?? ''}
                    maxLength={MAX_PHOTO_NOTE}
                    onChange={(e) => change(p.key, { note: e.target.value })}
                    placeholder="한 줄 메모 (선택)"
                    className="mt-1.5 w-full rounded-xl bg-slate-100 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500"
                    aria-label={`${i + 1}번째 사진 메모`}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
        {room > 0 && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={adding}
            className={`mb-3 flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-60 ${photos.length ? 'min-h-14' : 'min-h-24'}`}
          >
            <ImagePlus className="size-6" aria-hidden />
            {adding ? '사진 넣는 중…' : photos.length ? `사진 더 넣기 (${photos.length}/${MAX_DIARY_PHOTOS})` : `사진·GIF 넣기 (선택, ${MAX_DIARY_PHOTOS}장까지)`}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => {
            void pickPhotos(e.target.files)
            e.target.value = ''
          }}
        />

        <textarea
          value={text}
          maxLength={MAX_TEXT}
          onChange={(e) => setText(e.target.value)}
          placeholder="오늘 한 일, 기분, 기억하고 싶은 것"
          rows={7}
          className="w-full resize-none rounded-2xl bg-slate-100 p-4 text-base leading-relaxed outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500"
          aria-label="일기 내용"
        />
        <div className="mt-1 flex items-center justify-end">
          <span className="text-xs text-slate-400">
            {text.length}/{MAX_TEXT}
          </span>
        </div>

        <div className="mt-3">
          <span className="mb-1.5 block text-sm font-medium text-slate-600">파일 (선택)</span>
          <AttachmentField value={files} onChange={setFiles} addLabel="파일 첨부 (PDF, 문서 등)" />
        </div>

        <div className="mt-3 flex gap-2">
          {entry && (
            <Button variant="secondary" className="text-expense" onClick={() => setDeleting(true)}>
              삭제
            </Button>
          )}
          <Button className="flex-1" onClick={save} disabled={saving || empty || (!!entry && !dirty)}>
            {saving ? '저장 중…' : entry && !dirty ? '저장됨' : '저장'}
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">사진은 찍은 시간 순서로 줄 세워져요. 시간을 눌러 바꿀 수 있어요. 첫 사진이 캘린더 날짜 뒤에 흐리게 보여요. GIF 도 움직이는 그대로 들어가요.</p>
        <p className="mt-1 hidden text-center text-xs text-slate-400 md:block">컴퓨터에서 사진이나 파일을 끌어다 놓아도 돼요</p>
      </section>

      <DropOverlay show={dragging} label={`${dayTitle(date)} 일기에 넣어요`} />

      <ConfirmDialog
        open={deleting}
        title="일기 삭제"
        message="이날 일기를 삭제할까요? 삭제하면 되돌릴 수 없어요."
        confirmLabel="삭제"
        danger
        onConfirm={remove}
        onCancel={() => setDeleting(false)}
      />
    </>
  )
}
