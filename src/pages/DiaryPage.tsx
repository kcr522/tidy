import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, ChevronLeft, ChevronRight, Clock, ImagePlus, MapPin, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AttachmentField, { DropOverlay, filesToAttachments } from '../components/common/AttachmentField'
import HandwriteButton, { appendHandwritten } from '../components/common/HandwriteButton'
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
import { MAX_HOUR_PICS, type HourValue, cleanHours, hasContent, hourLabel, hourOf, hourTime, hoursToMap, mapToHours, timeInHour, visibleHours } from '../lib/diaryHours'
import { toEditorHtml } from '../lib/richText'
import RichTextEditor from '../components/memo/RichTextEditor'
import { diaryRepo } from '../repositories/diaryRepo'
import { routeStore } from '../lib/routeStore'

const MAX_TEXT = 2000
/** 입력을 멈추고 이만큼 지나면 자동 저장 */
const AUTOSAVE_MS = 1200

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
  // 날짜를 바꾼 직후엔 앞 날짜 결과가 잠깐 남아 있어서, 어느 날짜 결과인지 같이 받는다
  const loaded = useLiveQuery(() => diaryRepo.get(date).then((d) => ({ date, entry: d ?? null })), [date])
  const entry = loaded && loaded.date === date ? loaded.entry : undefined
  const recent = useLiveQuery(() => diaryRepo.recent(30), [])
  // 그날 이동 기록이 있으면 지도로 가는 버튼 (이 기기에만 있는 기록)
  const routeCount = useLiveQuery(() => routeStore.listByDate(date).then((l) => l.length).catch(() => 0), [date])
  const shift = (n: number) => setDate(toDateKey(addDays(parseDateKey(date), n)))
  // 자동 저장한 뒤에 쓰기 칸을 새로 그리면 쓰던 자리(커서)가 날아간다.
  // 내가 저장한 것이면 그대로 두고, 다른 기기 동기화·삭제처럼 밖에서 바뀐 것만 새로 그린다
  const ownSaves = useRef(new Set<string>())
  const editorKey = useRef('')
  const version = entry === undefined ? 'loading' : (entry?.updatedAt ?? 'new')
  if (!editorKey.current.startsWith(`${date}-`) || !ownSaves.current.has(version)) editorKey.current = `${date}-${version}`

  return (
    <>
      <PageHeader
        title="일기"
        action={
          routeCount ? (
            <Link to="/route" state={{ date }} className="tap flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-card">
              <MapPin className="size-4 text-brand-600" aria-hidden />
              이 날 이동 경로
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-start">
        {entry === undefined ? (
          <section className="card min-h-96 p-4" />
        ) : (
          <DiaryEditor
            key={editorKey.current}
            date={date}
            today={today}
            entry={entry}
            draft={draft ?? undefined}
            onSaved={(at) => ownSaves.current.add(at)}
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

/** 저장이 끝나기 전에 창이 닫힐 때 남겨 두는 글 (사진은 커서 빼고 글만) */
const UNSAVED_KEY = 'tidy.diaryUnsaved'
type Unsaved = { date: string; base: string | null; text: string }

function keepUnsaved(v: Unsaved | null) {
  try {
    if (v) localStorage.setItem(UNSAVED_KEY, JSON.stringify(v))
    else localStorage.removeItem(UNSAVED_KEY)
  } catch {
    // 저장소를 못 쓰면 그냥 넘어간다
  }
}

/** 그날, 그 저장본 위에서 쓰다 만 글이 있으면 돌려준다. 그 사이 다른 데서 고쳐졌으면 버린다 */
function unsavedText(date: string, entry: Diary | null): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(UNSAVED_KEY) ?? 'null') as Unsaved | null
    if (!v || v.date !== date) return null
    if (v.base !== (entry?.updatedAt ?? null)) {
      keepUnsaved(null)
      return null
    }
    return v.text
  } catch {
    return null
  }
}

/** 저장 시각을 "오후 1:05" 처럼 */
const savedTime = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })

/** 일기 보기 방식: 시간별 (1시간에 한 칸, 기본) / 사진 순서(예전 그대로). 이 기기에 기억한다 */
type DiaryView = 'photo' | 'hour'
const VIEW_KEY = 'tidy.diaryView'
const ALL_HOURS_KEY = 'tidy.diaryAllHours'
function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    // 저장소를 못 쓰면 이번만 그렇게 보인다
  }
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
  /** 저장할 때마다 그 시각(updatedAt)을 알려 준다 */
  onSaved: (updatedAt: string) => void
  onShift: (n: number) => void
}

/** 그날 일기 쓰기 칸 (날짜나 저장된 내용이 바뀌면 key로 새로 그린다) */
function DiaryEditor({ date, today, entry, draft, onSaved, onShift: shift }: EditorProps) {
  const [text, setText] = useState(() => unsavedText(date, entry) ?? [entry?.text, draft?.text].filter(Boolean).join('\n\n'))
  const [photos, setPhotos] = useState<Item[]>(() =>
    [...diaryPhotos(entry), ...(draft?.photo ? [{ src: draft.photo, time: nowTime() }] : [])].map(withKey),
  )
  const [files, setFiles] = useState<Attachment[]>(() => entry?.attachments ?? [])
  const [hourVals, setHourVals] = useState<Record<number, HourValue>>(() => hoursToMap(entry?.hours))
  const [view, setViewState] = useState<DiaryView>(() => (readPref(VIEW_KEY) === 'photo' ? 'photo' : 'hour'))
  const [showAll, setShowAllState] = useState(() => readPref(ALL_HOURS_KEY) === '1')
  // 직접 더한 빈 시간 칸. 오늘이면 지금 시간 칸을 하나 열어 둔다
  const [extra, setExtra] = useState<number[]>(() => (date === today ? [new Date().getHours()] : []))
  const hourPick = useRef<number | undefined>(undefined)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const setView = (v: DiaryView) => {
    setViewState(v)
    writePref(VIEW_KEY, v)
  }
  const setShowAll = (v: boolean) => {
    setShowAllState(v)
    writePref(ALL_HOURS_KEY, v ? '1' : '0')
  }
  const cleaned = cleanPhotos(photos)
  const hours = mapToHours(hourVals)
  const dirty = text.trim() !== (entry?.text ?? '') || JSON.stringify(hours) !== JSON.stringify(cleanHours(entry?.hours ?? [])) || JSON.stringify(cleaned) !== JSON.stringify(cleanPhotos(diaryPhotos(entry))) ||
    JSON.stringify(cleanAttachments(files)) !== JSON.stringify(cleanAttachments(entry?.attachments))
  const empty = text.trim() === '' && photos.length === 0 && files.length === 0 && hours.length === 0
  const room = MAX_DIARY_PHOTOS - photos.length
  const timeline = sortByTime(photos)

  /**
   * 사진 여러 장을 넣는다. 찍은 시간은 사진 정보에서 읽고, 없으면 파일 시간.
   * 시간 칸(hour)에서 넣으면 그 칸에 들어가게 시간을 맞춘다 (찍은 시간이 그 칸이면 그대로)
   */
  async function pickPhotos(list: FileList | File[] | null, hour?: number) {
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
        added.push(withKey({ src, time: hour === undefined ? info.time : timeInHour(info.time, hour) }))
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

  // 자동 저장: 저장 버튼을 안 눌러도 쓰는 대로 저장한다 (사용자 요청 2026-11-14)
  // 쓰다가 잠깐 멈추면, 다른 날·다른 화면으로 가면, 앱을 내리거나 창을 닫으면 저장된다
  const latest = useRef({ text, photos: cleaned, files, hours, dirty, empty, adding, base: entry?.updatedAt ?? null })
  useEffect(() => {
    latest.current = { text, photos: cleaned, files, hours, dirty, empty, adding, base: entry?.updatedAt ?? null }
  })
  const running = useRef<Promise<void> | null>(null)
  const removed = useRef(false)

  /** 바뀐 게 있으면 저장한다. 저장 중이면 끝난 뒤 한 번 더 확인한다 */
  async function flush(manual = false): Promise<void> {
    while (running.current) await running.current
    const now = latest.current
    if (removed.current || now.empty || now.adding || (!now.dirty && !manual)) return
    const job = (async () => {
      setSaving(true)
      try {
        const at = await diaryRepo.save(date, { text: now.text.trim(), photos: now.photos, attachments: now.files, hours: now.hours })
        onSaved(at)
        setSavedAt(at)
        keepUnsaved(null)
        if (manual) toast('일기를 저장했어요')
      } catch {
        toast('저장하지 못했어요. 사진이 너무 크면 다른 사진으로 해 주세요', 'error')
      } finally {
        setSaving(false)
      }
    })()
    running.current = job
    await job
    running.current = null
  }
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  })

  // 입력을 멈추면 잠시 뒤 저장
  const snapshot = JSON.stringify([text, cleaned, cleanAttachments(files), hours])
  useEffect(() => {
    if (!dirty || empty || adding) return
    const t = window.setTimeout(() => void flushRef.current(), AUTOSAVE_MS)
    return () => window.clearTimeout(t)
  }, [snapshot, dirty, empty, adding])

  // 앱을 내리거나 창을 닫을 때, 그리고 이 칸을 떠날 때(다른 날짜·다른 화면) 바로 저장
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flushRef.current()
    }
    // 창을 닫거나 새로고침하면 저장이 끝나기 전에 꺼질 수 있어서, 글은 바로 남겨 두고 다음에 열 때 이어서 저장한다
    const onLeave = () => {
      const now = latest.current
      if (now.dirty && !now.empty && !removed.current) keepUnsaved({ date, base: now.base, text: now.text })
      void flushRef.current()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onLeave)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onLeave)
      void flushRef.current()
    }
    // 날짜·내용이 바뀌면 새로 그려지므로 처음 값으로 충분하다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = () => flush(true)

  async function remove() {
    removed.current = true
    while (running.current) await running.current
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
            {date === today && <span className="ml-1.5 inline-block rounded-full whitespace-nowrap bg-brand-50 px-2 py-0.5 text-xs text-brand-700">오늘</span>}
          </h2>
          <button type="button" onClick={() => shift(1)} disabled={date >= today} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="다음날">
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>

        <div className="mb-3 flex rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="일기 보기 방식">
          {([['hour', '시간별'], ['photo', '사진 순서']] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`flex-1 rounded-xl py-2 text-sm font-bold ${view === v ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {view === 'hour' && (
          <HourTimeline
            photos={photos}
            values={hourVals}
            extra={extra}
            showAll={showAll}
            adding={adding}
            room={room}
            onShowAll={setShowAll}
            onValue={(h, v) => setHourVals((old) => ({ ...old, [h]: v }))}
            onAddHour={(h) => setExtra((old) => (old.includes(h) ? old : [...old, h]))}
            onAddPhoto={(h) => {
              hourPick.current = h
              fileRef.current?.click()
            }}
            onPhoto={change}
            onDropPhoto={drop}
          />
        )}

        {view === 'photo' && timeline.length > 0 && (
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
                    placeholder="사진 아래 작은 글 (선택)"
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
            onClick={() => {
              hourPick.current = undefined
              fileRef.current?.click()
            }}
            disabled={adding}
            className={`mb-3 flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-60 ${photos.length ? 'min-h-14' : 'min-h-24'}`}
          >
            <ImagePlus className="size-6" aria-hidden />
            {adding ? '사진 넣는 중…' : photos.length ? `사진 더 넣기 (${photos.length}/${MAX_DIARY_PHOTOS})` : `사진·GIF 넣기 (선택, ${MAX_DIARY_PHOTOS}장까지)`}
            {view === 'hour' && !adding && <span className="text-xs font-medium text-slate-400">찍은 시간 칸에 알아서 들어가요</span>}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => {
            void pickPhotos(e.target.files, hourPick.current)
            hourPick.current = undefined
            e.target.value = ''
          }}
        />

        <textarea
          value={text}
          maxLength={MAX_TEXT}
          onChange={(e) => setText(e.target.value)}
          placeholder={view === 'hour' ? '하루 정리 (선택): 오늘 하루 어땠는지 한마디' : '오늘 한 일, 기분, 기억하고 싶은 것'}
          rows={view === 'hour' ? 3 : 7}
          className="w-full resize-none rounded-2xl bg-slate-100 p-4 text-base leading-relaxed outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500"
          aria-label="일기 내용"
        />
        <div className="mt-1 flex items-center justify-between gap-2">
          <HandwriteButton label="일기" onText={(t) => setText((old) => appendHandwritten(old, t, true, MAX_TEXT))} />
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
          <Button className="flex-1" onClick={() => void save()} disabled={saving || empty || (!!entry && !dirty)}>
            {saving ? '저장 중…' : entry && !dirty ? '저장됨' : '저장'}
          </Button>
        </div>
        <p className="mt-2 text-center text-xs font-medium text-slate-500" aria-live="polite">
          {empty
            ? entry
              ? '다 비우면 자동 저장되지 않아요. 지우려면 삭제를 눌러 주세요'
              : '쓰는 대로 자동으로 저장돼요'
            : saving
              ? '자동 저장 중…'
              : dirty
                ? '잠시 뒤 자동으로 저장돼요'
                : savedAt
                  ? `자동 저장됨 · ${savedTime(savedAt)}`
                  : '쓰는 대로 자동으로 저장돼요'}
        </p>
        <p className="mt-2 text-center text-xs text-slate-400">{view === 'hour' ? '시간별: 1시간마다 칸이 하나씩 있어요. 사진은 찍은 시간 칸에 들어가요. ' : ''}사진은 찍은 시간 순서로 줄 세워져요. 시간을 눌러 바꿀 수 있어요. 첫 사진이 캘린더 날짜 뒤에 흐리게 보여요. GIF 도 움직이는 그대로 들어가요.</p>
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

interface HourTimelineProps {
  photos: Item[]
  values: Record<number, HourValue>
  extra: number[]
  showAll: boolean
  adding: boolean
  /** 더 넣을 수 있는 사진 수 */
  room: number
  onShowAll: (v: boolean) => void
  onValue: (hour: number, value: HourValue) => void
  onAddHour: (hour: number) => void
  onAddPhoto: (hour: number) => void
  onPhoto: (key: string, patch: Partial<DiaryPhoto>) => void
  onDropPhoto: (key: string) => void
}

/**
 * 시간별 일기 (사용자 요청 2026-11-18): 세로 선 위에 1시간마다 점과 칸.
 * 칸마다 그 시간에 한 일을 쓰고, 그 시간에 찍은 사진이 모인다
 */
function HourTimeline({ photos, values, extra, showAll, adding, room, onShowAll, onValue, onAddHour, onAddPhoto, onPhoto, onDropPhoto }: HourTimelineProps) {
  const shown = visibleHours(values, photos, extra, showAll)
  const untimed = photos.filter((p) => hourOf(p.time) === null)
  const hidden = Array.from({ length: 24 }, (_, i) => i).filter((h) => !shown.includes(h))
  // 보이는 마지막 시간의 다음 시간 (밤 11시까지)
  const lastShown = shown.length ? shown[shown.length - 1] : null
  const next = lastShown !== null && lastShown < 23 ? lastShown + 1 : null
  const inHour = (h: number) => sortByTime(photos.filter((p) => hourOf(p.time) === h))

  return (
    <div className="mb-3">
      <label className="mb-2 flex items-center justify-end gap-2 text-xs font-semibold text-slate-500">
        빈 시간도 다 보기 (0~23시)
        <input type="checkbox" checked={showAll} onChange={(e) => onShowAll(e.target.checked)} className="size-4 accent-brand-600" />
      </label>

      <ol className="relative" aria-label="시간별 일기">
        {/* 세로 선 */}
        <span className="absolute top-2 bottom-2 left-[7px] w-0.5 rounded-full bg-brand-500/30" aria-hidden />

        {untimed.length > 0 && (
          <li className="relative pb-4 pl-7">
            <span className="absolute top-1 left-0 size-4 rounded-full border-[3px] border-white bg-slate-300 ring-1 ring-slate-200" aria-hidden />
            <p className="text-sm font-bold text-slate-500">시간 모름</p>
            <p className="mb-1.5 text-xs text-slate-400">시간을 누르면 그 시간 칸으로 옮겨져요</p>
            <HourPhotos photos={untimed} onPhoto={onPhoto} onDropPhoto={onDropPhoto} />
          </li>
        )}

        {shown.map((h) => {
          const pics = inHour(h)
          const filled = hasContent(values[h]) || pics.length > 0
          return (
            <li key={h} className={`relative pl-7 ${filled || !showAll ? 'pb-4' : 'pb-2'}`}>
              <span
                className={`absolute top-1 left-0 size-4 rounded-full border-[3px] border-white ${filled ? 'bg-brand-500 ring-1 ring-brand-500/40' : 'bg-slate-300 ring-1 ring-slate-200'}`}
                aria-hidden
              />
              <div className="mb-1 flex items-center gap-2">
                <span className={`text-sm font-bold ${filled ? 'text-brand-700' : 'text-slate-500'}`}>{hourLabel(h)}</span>
                <span className="text-xs text-slate-400">{hourTime(h)}</span>
                {room > 0 && (
                  <button
                    type="button"
                    onClick={() => onAddPhoto(h)}
                    disabled={adding}
                    className="tap ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                    aria-label={`${hourLabel(h)}에 사진 넣기`}
                  >
                    <Camera className="size-3.5" aria-hidden />
                    사진
                  </button>
                )}
              </div>
              <HourEditor hour={h} value={values[h]} onValue={onValue} />
              {pics.length > 0 && (
                <div className="mt-1.5">
                  <HourPhotos photos={pics} onPhoto={onPhoto} onDropPhoto={onDropPhoto} />
                </div>
              )}
            </li>
          )
        })}

        {!showAll && next !== null && (
          <li className="relative pb-2 pl-7">
            <span className="absolute top-2 left-0 flex size-4 items-center justify-center rounded-full bg-white text-brand-500 ring-1 ring-brand-500/40" aria-hidden>
              <Plus className="size-3" strokeWidth={3} />
            </span>
            <button type="button" onClick={() => onAddHour(next)} className="flex min-h-9 items-center text-sm font-bold text-brand-700">
              다음 시간 이어 쓰기 ({hourLabel(next)})
            </button>
          </li>
        )}

        {!showAll && (
          <li className="relative pl-7">
            <span className="absolute top-2 left-0 flex size-4 items-center justify-center rounded-full bg-white text-brand-500 ring-1 ring-brand-500/40" aria-hidden>
              <Plus className="size-3" strokeWidth={3} />
            </span>
            <label className="relative flex min-h-9 items-center text-sm font-bold text-brand-700">
              {shown.length ? '다른 시간 고르기' : '시간 칸을 더해서 써 보세요'}
              <select
                value=""
                onChange={(e) => e.target.value !== '' && onAddHour(Number(e.target.value))}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
                aria-label="시간 칸 더하기"
              >
                <option value="">시간 고르기</option>
                {hidden.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)} ({hourTime(h)})
                  </option>
                ))}
              </select>
            </label>
          </li>
        )}
      </ol>
    </div>
  )
}

/** 시간 칸 안의 사진들: 사진 + 시간(눌러서 바꾸기) + 사진 아래 작은 글 */
function HourPhotos({ photos, onPhoto, onDropPhoto }: { photos: Item[]; onPhoto: (key: string, patch: Partial<DiaryPhoto>) => void; onDropPhoto: (key: string) => void }) {
  return (
    <ul className={`grid gap-2.5 ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1 sm:w-2/3'}`}>
      {photos.map((p) => (
        <li key={p.key} className="min-w-0">
          <div className="relative overflow-hidden rounded-xl bg-slate-100">
            <img src={p.src} alt={p.note || '사진'} className={`w-full object-cover ${photos.length > 1 ? 'aspect-square' : 'max-h-72'}`} />
            <label className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-slate-900/60 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-white">
              <Clock className="size-3 shrink-0" aria-hidden />
              {p.time ?? '시간 넣기'}
              <input
                type="time"
                value={p.time ?? ''}
                onChange={(e) => onPhoto(p.key, { time: e.target.value || undefined })}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
                aria-label="사진 시간"
              />
            </label>
            <button type="button" onClick={() => onDropPhoto(p.key)} className="absolute top-1.5 right-1.5 rounded-full bg-slate-900/60 p-1 text-white" aria-label="사진 빼기">
              <X className="size-3.5" strokeWidth={2.5} aria-hidden />
            </button>
          </div>
          <input
            value={p.note ?? ''}
            maxLength={MAX_PHOTO_NOTE}
            onChange={(e) => onPhoto(p.key, { note: e.target.value })}
            placeholder="사진 아래 작은 글"
            className="mt-1 w-full rounded-lg bg-transparent px-1 py-1 text-center text-xs text-slate-600 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500"
            aria-label="사진 아래 작은 글"
          />
        </li>
      ))}
    </ul>
  )
}

/** 시간 칸 글: 메모처럼 꾸며 쓰기 (형광펜 · 글머리 기호 · 기울임 · 글 크기 · 글 색 · 손글씨). 누르면 꾸미기 도구가 나온다 */
function HourEditor({ hour, value, onValue }: { hour: number; value: HourValue | undefined; onValue: (hour: number, value: HourValue) => void }) {
  // 처음 값으로 한 번만 그린다 (그다음은 편집기가 직접 고친다)
  const [initial] = useState(() => toEditorHtml(value?.html, value?.text ?? '', value?.pics))
  const read = useRef<(() => HourValue) | null>(null)
  return (
    <RichTextEditor
      compact
      initial={initial}
      placeholder="이 시간에 한 일"
      label={`${hourLabel(hour)}에 한 일`}
      maxPics={MAX_HOUR_PICS}
      bindRead={(r) => {
        read.current = r
      }}
      onInput={() => {
        if (read.current) onValue(hour, read.current())
      }}
    />
  )
}
