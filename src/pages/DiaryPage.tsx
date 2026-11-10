import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, ImagePlus, Mic, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from '../components/common/Button'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PageHeader from '../components/common/PageHeader'
import { useToast } from '../components/common/Toast'
import { addDays } from 'date-fns'
import { useSpeech } from '../hooks/useSpeech'
import { useToday } from '../hooks/useToday'
import { dayTitle } from '../lib/calendar'
import { parseDateKey, toDateKey } from '../lib/date'
import { shrinkImage } from '../lib/image'
import type { Diary } from '../db/types'
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
                      <span className="block text-sm font-bold">{dayTitle(d.date)}</span>
                      <span className="line-clamp-2 text-sm text-slate-500">{d.text || '사진만 있어요'}</span>
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
  const [photo, setPhoto] = useState<string | undefined>(entry?.photo ?? draft?.photo)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  // 말로 쓰기: 끝난 문장을 글 끝에 붙인다
  const speech = useSpeech(
    (said) => setText((t) => (t && !/\s$/.test(t) ? `${t} ${said}` : t + said).slice(0, MAX_TEXT)),
    (msg) => toast(msg, 'error'),
  )

  const dirty = (text !== (entry?.text ?? '') || photo !== entry?.photo)
  const empty = text.trim() === '' && !photo

  async function pickPhoto(file: File | undefined) {
    if (!file) return
    try {
      setPhoto(await shrinkImage(file))
    } catch {
      toast('사진을 넣지 못했어요. 다른 사진으로 해 주세요', 'error')
    }
  }

  async function save() {
    if (empty) return
    setSaving(true)
    try {
      await diaryRepo.save(date, { text: text.trim(), photo })
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

        {photo ? (
          <div className="relative mb-3 overflow-hidden rounded-2xl">
            <img src={photo} alt="일기 사진" className="max-h-72 w-full object-cover" />
            <button type="button" onClick={() => setPhoto(undefined)} className="absolute top-2 right-2 rounded-full bg-slate-900/60 p-1.5 text-white" aria-label="사진 빼기">
              <X className="size-4" strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mb-3 flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            <ImagePlus className="size-6" aria-hidden />
            사진 넣기 (선택)
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />

        <textarea
          value={text}
          maxLength={MAX_TEXT}
          onChange={(e) => setText(e.target.value)}
          placeholder="오늘 한 일, 기분, 기억하고 싶은 것"
          rows={7}
          className="w-full resize-none rounded-2xl bg-slate-100 p-4 text-base leading-relaxed outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500"
          aria-label="일기 내용"
        />
        {speech.listening && (
          <p className="mt-1 line-clamp-2 text-sm text-brand-600" aria-live="polite">
            {speech.interim || '듣고 있어요… 말씀하세요'}
          </p>
        )}
        <div className="mt-1 flex items-center justify-between">
          <button
            type="button"
            onClick={speech.listening ? speech.stop : speech.start}
            aria-pressed={speech.listening}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${speech.listening ? 'bg-expense text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {speech.listening ? <Square className="size-3.5" fill="currentColor" aria-hidden /> : <Mic className="size-4" aria-hidden />}
            {speech.listening ? '그만 말하기' : '말로 쓰기'}
          </button>
          <span className="text-xs text-slate-400">
            {text.length}/{MAX_TEXT}
          </span>
        </div>

        <div className="mt-2 flex gap-2">
          {entry && (
            <Button variant="secondary" className="text-expense" onClick={() => setDeleting(true)}>
              삭제
            </Button>
          )}
          <Button className="flex-1" onClick={save} disabled={saving || empty || (!!entry && !dirty)}>
            {saving ? '저장 중…' : entry && !dirty ? '저장됨' : '저장'}
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">사진을 넣으면 캘린더 날짜 뒤에 흐리게 보여요. 글만 쓰면 색으로 표시돼요.</p>
      </section>

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
