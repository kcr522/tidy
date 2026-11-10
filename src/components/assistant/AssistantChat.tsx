import { ArrowUp, BookHeart, CalendarRange, ExternalLink, ImagePlus, Loader2, Sparkles, Wallet, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AssistantError } from '../../lib/ai/assistant'
import { askAssistant } from '../../lib/ai/assistantEngines'
import { ENGINE_LABEL } from '../../lib/ai/engines'
import { useAiSettings } from '../../lib/ai/settings'
import { buildContext, refineEvents, refinePayments } from '../../lib/assistant/learn'
import { dayTitle } from '../../lib/calendar'
import { categoryEmoji } from '../../lib/categories'
import { todayKey } from '../../lib/date'
import { formatWon } from '../../lib/format'
import { isWebUrl } from '../../lib/validate'
import { shrinkImage } from '../../lib/image'
import { shrinkPhoto } from '../../lib/meal/photo'
import { diaryRepo } from '../../repositories/diaryRepo'
import { eventRepo } from '../../repositories/eventRepo'
import { merchantAliasRepo } from '../../repositories/merchantAliasRepo'
import { transactionRepo } from '../../repositories/transactionRepo'
import { useToast } from '../common/Toast'
import { CHOICE_LABEL, msgId as id, type ChatMessage, type Choice, type Proposal } from '../../lib/assistant/chat'

const PLACE: Record<Proposal['kind'], string> = { event: '캘린더', payment: '가계부', diary: '일기' }


interface Props {
  messages: ChatMessage[]
  setMessages: (fn: (m: ChatMessage[]) => ChatMessage[]) => void
  onClose: () => void
}

/** AI 대화창: 사진이나 글을 보내면 일정 / 결제 내역 / 일기를 찾아 "등록할까요?" 묻는다 */
export default function AssistantChat({ messages, setMessages, onClose }: Props) {
  const [settings] = useAiSettings()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const abort = useRef<AbortController | null>(null)
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const add = (m: ChatMessage) => setMessages((list) => [...list, m])

  async function send(input: { text?: string; file?: File }) {
    if (busy) return
    const said = input.text?.trim()
    let photo: string | undefined
    let image: string | undefined
    try {
      if (input.file) {
        photo = await shrinkImage(input.file, 720, 0.75)
        image = await shrinkPhoto(input.file)
      }
    } catch {
      toast('사진을 열지 못했어요. 다른 사진으로 해 주세요', 'error')
      return
    }
    if (!said && !image) return
    add({ id: id(), from: 'me', text: said, photo })
    setText('')
    setBusy(true)
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    try {
      const today = todayKey()
      const [transactions, aliases] = await Promise.all([transactionRepo.listAll(), merchantAliasRepo.list()])
      const res = await askAssistant(settings, { today, ...(said ? { text: said } : {}), ...(image ? { image } : {}), context: buildContext(transactions, aliases) }, ctrl.signal)
      if (ctrl.signal.aborted) return
      if (res.fallback) add({ id: id(), from: 'ai', text: `${res.fallback.split(/\.\s/)[0].replace(/\.$/, "")}. 그래서 이번엔 기본 모드(AI 없이)로 답할게요.` })
      if (res.kind === 'event') {
        const first = res.events.map((e) => e.startDate).sort()[0]
        const last = res.events.map((e) => e.endDate).sort().at(-1)!
        const items = refineEvents(res.events, await eventRepo.listBetween(first, last))
        add({ id: id(), from: 'ai', text: res.reply, proposal: { kind: 'event', items } })
      } else if (res.kind === 'payment') {
        add({ id: id(), from: 'ai', text: res.reply, proposal: { kind: 'payment', items: refinePayments(res.payments, transactions, aliases) } })
      } else if (res.kind === 'diary' && res.diary) {
        const date = res.diary.date > today ? today : res.diary.date
        const entry = await diaryRepo.get(date)
        add({ id: id(), from: 'ai', text: res.reply, proposal: { kind: 'diary', date, text: res.diary.text, photo: entry?.photo ? undefined : photo, hasEntry: !!entry } })
      } else {
        add({ id: id(), from: 'ai', text: res.reply, ...(res.sources?.length ? { sources: res.sources } : {}) })
      }
    } catch (err) {
      if (ctrl.signal.aborted) return
      add({ id: id(), from: 'ai', text: `${err instanceof AssistantError ? err.message : 'AI에 연결하지 못했어요'}. 잠시 뒤에 다시 보내 주세요.` })
    } finally {
      if (!ctrl.signal.aborted) setBusy(false)
    }
  }

  async function choose(msg: Extract<ChatMessage, { proposal: Proposal }>, choice: Choice) {
    const p = msg.proposal
    setMessages((list) => [...list.map((m) => (m.id === msg.id ? { ...msg, choice } : m)), { id: id(), from: 'me', text: CHOICE_LABEL[choice] }])

    if (choice === 'no') {
      add({ id: id(), from: 'ai', text: '알겠어요, 등록하지 않을게요. 다른 것도 편하게 보내 주세요.' })
      return
    }

    if (choice === 'self') {
      onClose()
      // 이미 있는 것은 빼고 연다 (전부 이미 있으면 그래도 다 보여 준다)
      const pick = <T extends { duplicate: boolean; input: unknown }>(items: T[]) => {
        const fresh = items.filter((i) => !i.duplicate)
        return (fresh.length ? fresh : items).map((i) => i.input)
      }
      if (p.kind === 'event') navigate('/calendar', { state: { drafts: pick(p.items) } })
      else if (p.kind === 'payment') navigate('/money', { state: { drafts: pick(p.items) } })
      else navigate('/diary', { state: { date: p.date, draft: p.text, photo: p.photo } })
      return
    }

    try {
      if (p.kind === 'event') {
        const fresh = p.items.filter((i) => !i.duplicate)
        for (const i of fresh) await eventRepo.add(i.input)
        add({ id: id(), from: 'ai', text: fresh.length ? `캘린더에 일정 ${fresh.length}개를 등록했어요 📅` : '이미 캘린더에 있는 일정이라 새로 넣지 않았어요.' })
      } else if (p.kind === 'payment') {
        const fresh = p.items.filter((i) => !i.duplicate)
        for (const i of fresh) await transactionRepo.add(i.input)
        const skipped = p.items.length - fresh.length
        add({
          id: id(),
          from: 'ai',
          text: fresh.length
            ? `가계부에 ${fresh.length}건을 기록했어요 💸${skipped ? ` 이미 있던 ${skipped}건은 빼 뒀어요.` : ''}`
            : '모두 이미 가계부에 있는 내역이라 새로 넣지 않았어요.',
        })
      } else {
        const old = await diaryRepo.get(p.date)
        await diaryRepo.save(p.date, { text: [old?.text, p.text].filter(Boolean).join('\n\n'), photo: old?.photo ?? p.photo })
        add({ id: id(), from: 'ai', text: `${dayTitle(p.date)} 일기에 남겼어요 📔${old ? ' 전에 쓴 일기 뒤에 붙였어요.' : ''}` })
      }
    } catch {
      add({ id: id(), from: 'ai', text: '저장하지 못했어요. 다시 해 주세요.' })
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void send({ text })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-end md:justify-end md:p-8" role="dialog" aria-modal="true" aria-label="AI 비서">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] md:bg-black/20" onClick={onClose} />
      <div className="relative flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-slate-100 shadow-xl md:h-[min(720px,88vh)] md:max-w-[420px] md:rounded-3xl">
        <header className="flex items-center gap-3 bg-white px-4 pt-4 pb-3">
          <span className="bg-grad on-grad flex size-10 items-center justify-center rounded-full">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-extrabold tracking-tight">AI 비서</h2>
            <p className="truncate text-xs text-slate-400">{ENGINE_LABEL[settings.engine].title}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200" aria-label="닫기">
            <X className="size-4" strokeWidth={2.5} aria-hidden />
          </button>
        </header>

        <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4" aria-live="polite">
          {messages.map((m) =>
            m.from === 'me' ? (
              <div key={m.id} className="flex flex-col items-end gap-1">
                {m.photo && <img src={m.photo} alt="보낸 사진" className="max-h-56 max-w-[70%] rounded-2xl object-cover shadow-card" />}
                {m.text && <p className="bg-grad on-grad max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[15px] whitespace-pre-wrap">{m.text}</p>}
              </div>
            ) : (
              <div key={m.id} className="flex max-w-[88%] flex-col items-start gap-2">
                <p className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[15px] whitespace-pre-wrap text-slate-800 shadow-card">{m.text}</p>
                {'proposal' in m && <ProposalCard msg={m} onChoose={(c) => choose(m, c)} />}
                {'sources' in m && m.sources && (
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {m.sources.filter((src) => isWebUrl(src.url)).map((src) => (
                      <a
                        key={src.url}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex max-w-[14rem] items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 shadow-card"
                      >
                        <ExternalLink className="size-3 shrink-0" aria-hidden />
                        <span className="truncate">{src.title}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
          {busy && (
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm text-slate-500 shadow-card" style={{ width: 'fit-content' }}>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              보고 있어요…
            </div>
          )}
        </div>

        <form onSubmit={submit} className="flex items-end gap-2 bg-white px-3 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => fileRef.current?.click()} className="tap flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-label="사진 보내기">
            <ImagePlus className="size-5" aria-hidden />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void send({ text, file: f })
            }}
          />
          <div className="flex min-h-11 min-w-0 flex-1 items-center rounded-3xl bg-slate-100 pr-1 pl-4">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="메시지나 사진을 보내 보세요"
              maxLength={500}
              className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-slate-400"
              aria-label="메시지"
            />
          </div>
          <button type="submit" disabled={busy || !text.trim()} className="bg-grad on-grad flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40" aria-label="보내기">
            <ArrowUp className="size-5" strokeWidth={2.6} aria-hidden />
          </button>
        </form>
      </div>
    </div>
  )
}

function ProposalCard({ msg, onChoose }: { msg: Extract<ChatMessage, { proposal: Proposal }>; onChoose: (c: Choice) => void }) {
  const p = msg.proposal
  const Icon = p.kind === 'event' ? CalendarRange : p.kind === 'payment' ? Wallet : BookHeart
  const fresh = p.kind === 'diary' ? 1 : p.items.filter((i) => !i.duplicate).length
  const question = fresh === 0 ? '이미 다 있어요. 그래도 볼까요?' : p.kind === 'diary' ? `${dayTitle(p.date).replace(/ \(.\)$/, '')} 일기에 등록할까요?` : `${PLACE[p.kind]}에 등록할까요?`

  return (
    <div className="w-full min-w-64 overflow-hidden rounded-2xl bg-white shadow-card">
      <div className="flex items-center gap-2 px-3.5 pt-3 text-xs font-bold text-slate-500">
        <Icon className="size-4 text-brand-500" aria-hidden />
        {PLACE[p.kind]}
      </div>
      <ul className="divide-y divide-slate-100 px-3.5">
        {p.kind === 'event' &&
          p.items.map((e, i) => (
            <li key={i} className={`py-2.5 ${e.duplicate ? 'opacity-50' : ''}`}>
              <p className="text-[15px] font-bold">
                {e.input.title}
                {e.duplicate && <Dup />}
              </p>
              <p className="text-sm text-slate-500">
                {e.input.startDate === e.input.endDate ? dayTitle(e.input.startDate) : `${dayTitle(e.input.startDate)} ~ ${dayTitle(e.input.endDate)}`}
              </p>
              {e.input.memo && <p className="text-xs text-slate-400">{e.input.memo}</p>}
            </li>
          ))}
        {p.kind === 'payment' &&
          p.items.map((t, i) => (
            <li key={i} className={`flex items-center gap-2.5 py-2.5 ${t.duplicate ? 'opacity-50' : ''}`}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base" aria-hidden>
                {categoryEmoji(t.input.category)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">
                  {t.display}
                  {t.duplicate && <Dup />}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {dayTitle(t.input.date).replace(/ \(.\)$/, '')}
                  {t.input.time && ` ${t.input.time}`} · {t.input.category}
                  {t.input.account && ` · ${t.input.account}`}
                </span>
                {t.learned.length > 0 && <span className="block text-[11px] font-semibold text-brand-600">✓ {t.learned.join(', ')}</span>}
              </span>
              <span className={`shrink-0 text-[15px] font-bold tabular-nums ${t.input.type === 'INCOME' ? 'text-income' : ''}`}>
                {t.input.type === 'INCOME' ? '+' : '-'}
                {formatWon(t.input.amount)}
              </span>
            </li>
          ))}
        {p.kind === 'diary' && (
          <li className="py-2.5">
            {p.photo && <img src={p.photo} alt="" className="mb-2 max-h-32 w-full rounded-xl object-cover" />}
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-slate-700">{p.text}</p>
            {p.hasEntry && <p className="mt-1 text-xs text-slate-400">이날 쓴 일기 뒤에 이어서 붙여요</p>}
          </li>
        )}
      </ul>

      {msg.choice ? (
        <p className="border-t border-slate-100 px-3.5 py-2.5 text-sm font-semibold text-slate-400">골랐어요 · {CHOICE_LABEL[msg.choice]}</p>
      ) : (
        <div className="border-t border-slate-100 p-3">
          <p className="mb-2 text-[15px] font-bold">{question}</p>
          <div className="grid grid-cols-[1fr_1fr_1.6fr] gap-1.5">
            <button type="button" disabled={fresh === 0} onClick={() => onChoose('yes')} className="bg-grad on-grad min-h-11 rounded-xl text-sm font-bold disabled:opacity-40">
              응
            </button>
            <button type="button" onClick={() => onChoose('no')} className="min-h-11 rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
              아니
            </button>
            <button type="button" onClick={() => onChoose('self')} className="min-h-11 rounded-xl bg-brand-50 text-sm font-bold text-brand-700">
              내가 등록할게
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Dup() {
  return <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 align-middle text-[11px] font-bold text-slate-500">이미 있어요</span>
}
