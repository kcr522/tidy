import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Bookmark } from '../../db/types'
import { ENGINE_LABEL, type EngineId } from '../../lib/ai/engines'
import { loadAiSettings } from '../../lib/ai/settings'
import { BATCH, CLASS_EMOJI, CLASS_NAME, CLASS_ORDER, CLASS_SHORT, classifyScraps, classifyText, needsCaption, type ScrapClass } from '../../lib/scrap/classify'
import { enrichMany } from '../../lib/scrap/enrich'
import { bookmarkRepo } from '../../repositories/bookmarkRepo'
import Button from '../common/Button'
import Modal from '../common/Modal'

interface Props {
  open: boolean
  /** 미분류 인스타 스크랩 (열 때의 목록) */
  items: Bookmark[]
  onClose: () => void
}

type Choice = ScrapClass | null
type Step =
  | { kind: 'intro' }
  | { kind: 'working'; phase: 'caption' | 'classify'; done: number; total: number }
  | { kind: 'review'; list: Bookmark[]; picks: Map<number, Choice>; engine: EngineId; error?: string }
  | { kind: 'done'; changed: number; left: number }

const HINT: Record<ScrapClass, string> = { tip: '알아 두면 좋은 정보', living: '자취템, 살림, 청소, 방 꾸미기', make: '레시피, 베이킹, DIY', buy: '사고 싶은 물건, 제품 후기, 할인' }

const engineName = (e: EngineId) => (e === 'local' ? '기본 (낱말 규칙)' : ENGINE_LABEL[e].title.replace(/ \(.*\)$/, ''))

/**
 * 미분류 인스타 스크랩을 캡션을 보고 꿀팁 / 자취를 위해 모으기 / 나중에 만들 거 로 나누기.
 * 바로 바꾸지 않고, 나눈 결과를 보여 준 뒤 사용자가 고쳐서 "분류하기"를 누르면 그때 바꾼다
 */
export default function ScrapClassifyDialog({ open, items, onClose }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'intro' })
  const abort = useRef<AbortController | null>(null)
  const noCaption = items.filter(needsCaption).length

  function close() {
    abort.current?.abort()
    abort.current = null
    setStep({ kind: 'intro' })
    onClose()
  }

  async function run() {
    const ctl = new AbortController()
    abort.current = ctl
    const ids = items.map((b) => b.id!).filter((id) => id != null)
    try {
      // 1) 캡션을 아직 못 읽은 게시물은 먼저 서버에서 읽어 온다
      const missing = items.filter(needsCaption).map((b) => b.id!)
      if (missing.length) {
        setStep({ kind: 'working', phase: 'caption', done: 0, total: missing.length })
        await enrichMany(missing, (done, total) => setStep({ kind: 'working', phase: 'caption', done, total }), ctl.signal)
      }
      if (ctl.signal.aborted) return
      const list = (await Promise.all(ids.map((id) => bookmarkRepo.get(id)))).filter((b): b is Bookmark => !!b && b.categoryId == null)
      // 2) 나누기
      setStep({ kind: 'working', phase: 'classify', done: 0, total: list.length })
      const out = await classifyScraps(
        loadAiSettings(),
        list.map((b) => ({ id: b.id!, text: classifyText(b) })),
        (done, total) => setStep({ kind: 'working', phase: 'classify', done, total }),
        ctl.signal,
      )
      if (ctl.signal.aborted) return
      // 정한 것 먼저, 같은 갈래끼리
      const rank = (p: Choice) => (p ? CLASS_ORDER.indexOf(p) : 9)
      list.sort((a, b) => rank(out.result.get(a.id!) ?? null) - rank(out.result.get(b.id!) ?? null))
      setStep({ kind: 'review', list, picks: out.result, engine: out.engine, error: out.error })
    } catch {
      if (!ctl.signal.aborted) setStep({ kind: 'intro' })
    }
  }

  async function apply(list: Bookmark[], picks: Map<number, Choice>) {
    const todo = list.flatMap((b) => {
      const p = picks.get(b.id!)
      return p ? [{ id: b.id!, name: CLASS_NAME[p] }] : []
    })
    const changed = await bookmarkRepo.assignCategories(todo)
    setStep({ kind: 'done', changed, left: list.length - todo.length })
  }

  // 폰 글자가 커도 한 줄에 4개가 들어가게: 칸을 넷으로 똑같이 나누고 짧은 이름으로
  const chip = (on: boolean) => `tap flex min-h-8 min-w-0 items-center justify-center gap-0.5 rounded-full px-1 text-[12px] font-bold whitespace-nowrap transition ${on ? 'bg-grad on-grad shadow-sm' : 'bg-slate-100 text-slate-500'}`

  return (
    <Modal open={open} title="인스타 스크랩 분류하기" onClose={close}>
      {step.kind === 'intro' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-grad-soft p-4">
            <p className="text-2xl font-extrabold text-slate-900">{items.length.toLocaleString()}개</p>
            <p className="text-sm text-slate-600">미분류로 남은 인스타 스크랩</p>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">캡션을 읽고 넷 중 하나로 나눠 볼게요. 바로 바꾸지 않고, 나눈 결과를 먼저 보여 드려요.</p>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {CLASS_ORDER.map((k) => (
              <li key={k}>
                {CLASS_EMOJI[k]} <b>{CLASS_NAME[k]}</b>
                <span className="text-slate-400"> · {HINT[k]}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-slate-400">
            설정 &gt; AI 연결에서 고른 무료 AI로 한 번에 {BATCH}개씩 물어봐요 (기본이면 낱말 규칙으로). 카테고리가 없으면 새로 만들어요.
            {noCaption > 0 && ` 캡션을 아직 못 읽은 ${noCaption}개는 먼저 읽어 와요.`}
          </p>
          <Button className="w-full" onClick={() => void run()} disabled={!items.length}>
            <Sparkles className="size-4" aria-hidden /> 캡션 보고 나누기
          </Button>
        </div>
      )}

      {step.kind === 'working' && (
        <div className="space-y-3 py-6">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
            <Loader2 className="size-5 animate-spin text-brand-600" aria-hidden />
            {step.phase === 'caption' ? '캡션 읽어 오는 중' : '캡션 보고 나누는 중'} · {step.done} / {step.total}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-grad transition-all" style={{ width: `${step.total ? Math.round((step.done / step.total) * 100) : 0}%` }} />
          </div>
        </div>
      )}

      {step.kind === 'review' && (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-1 text-center">
            {[...CLASS_ORDER, null].map((k) => (
              <div key={k ?? 'none'} className="rounded-2xl bg-slate-50 px-1 py-2">
                <p className="text-lg font-extrabold text-slate-900">{step.list.filter((b) => (step.picks.get(b.id!) ?? null) === k).length}</p>
                <p className="truncate text-[11px] leading-tight text-slate-500">{k ? `${CLASS_EMOJI[k]} ${CLASS_SHORT[k]}` : '그대로'}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            {engineName(step.engine)}로 나눴어요. 틀린 건 눌러서 고쳐 주세요.
            {step.error && (
              <span className="mt-0.5 block line-clamp-2 text-amber-600" title={step.error}>
                AI가 막혀서 일부는 낱말 규칙으로 나눴어요: {step.error}
              </span>
            )}
          </p>
          <ul className="-mx-1 max-h-[42dvh] divide-y divide-slate-100 overflow-y-auto px-1">
            {step.list.map((b) => {
              const p = step.picks.get(b.id!) ?? null
              const set = (v: Choice) => setStep((s) => (s.kind === 'review' ? { ...s, picks: new Map(s.picks).set(b.id!, v) } : s))
              return (
                <li key={b.id} className="py-2.5">
                  <p className="truncate text-sm font-bold text-slate-800">{b.title}</p>
                  <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{b.description?.trim() || '캡션을 읽지 못했어요 (비공개이거나 지워진 게시물)'}</p>
                  <div className="mt-1.5 grid grid-cols-5 gap-1">
                    {CLASS_ORDER.map((k) => (
                      <button key={k} type="button" aria-pressed={p === k} aria-label={CLASS_NAME[k]} title={CLASS_NAME[k]} onClick={() => set(k)} className={chip(p === k)}>
                        <span aria-hidden>{CLASS_EMOJI[k]}</span>
                        <span className="truncate">{CLASS_SHORT[k]}</span>
                      </button>
                    ))}
                    <button type="button" aria-pressed={p === null} onClick={() => set(null)} className={chip(p === null)}>
                      그대로
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          {/* 목록이 길어도 아래 버튼은 늘 보이게 (창이 스크롤돼도 바닥에 붙어 있음) */}
          <div className="sticky bottom-0 -mx-5 -mb-[calc(1.5rem+env(safe-area-inset-bottom))] flex gap-2 border-t border-slate-100 bg-white px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:-mx-6 md:-mb-6 md:px-6 md:pb-6">
            <Button variant="secondary" className="flex-1" onClick={close}>
              취소
            </Button>
            <Button className="flex-[2]" onClick={() => void apply(step.list, step.picks)} disabled={!step.list.some((b) => step.picks.get(b.id!))}>
              {step.list.filter((b) => step.picks.get(b.id!)).length}개 분류하기
            </Button>
          </div>
        </div>
      )}

      {step.kind === 'done' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-9 shrink-0 text-emerald-500" aria-hidden />
            <div>
              <p className="text-lg font-extrabold text-slate-900">{step.changed.toLocaleString()}개 분류했어요</p>
              {step.left > 0 && <p className="text-sm text-slate-500">{step.left}개는 미분류로 그대로 뒀어요</p>}
            </div>
          </div>
          <Button className="w-full" onClick={close}>
            스크랩 보러 가기
          </Button>
        </div>
      )}
    </Modal>
  )
}
