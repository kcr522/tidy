import { CheckCircle2, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { Bookmark, ScrapCategory } from '../../db/types'
import { ENGINE_LABEL } from '../../lib/ai/engines'
import { loadAiSettings } from '../../lib/ai/settings'
import { CLASS_EMOJI, CLASS_NAME, CLASS_ORDER, classifyText } from '../../lib/scrap/classify'
import { enrichMany, needsFill } from '../../lib/scrap/enrich'
import { aiPickCategories, makeSuggester, type Confidence } from '../../lib/scrap/suggest'
import { bookmarkRepo } from '../../repositories/bookmarkRepo'
import { scrapCategoryRepo } from '../../repositories/scrapCategoryRepo'
import Button from '../common/Button'
import Modal from '../common/Modal'
import CategoryPicker from './CategoryPicker'

interface Props {
  open: boolean
  /** 스크랩 전체 (전에 나눈 것에서 배운다) */
  all: Bookmark[]
  categories: ScrapCategory[]
  onClose: () => void
}

type Pick = { categoryId: number | null; how?: Confidence | 'ai'; why?: string }
type Step =
  | { kind: 'intro' }
  | { kind: 'working'; done: number; total: number }
  | { kind: 'review'; list: Bookmark[]; picks: Map<number, Pick>; resort: boolean; aiBusy?: boolean; aiNote?: string }
  | { kind: 'done'; changed: number }

/**
 * 스크랩 정리: 미분류(또는 전부)를 내 카테고리에 나누기.
 * 기본은 AI 없이 (제목 · 캡션 낱말 + 전에 내가 나눈 스크랩). 모르는 것만 사용자가 누르면 AI에게 묻는다.
 * 바로 바꾸지 않고 결과를 보여 준 뒤 "정리하기"를 누르면 바꾼다
 */
export default function ScrapSortDialog({ open, all, categories, onClose }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'intro' })
  const [resort, setResort] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const unsorted = useMemo(() => all.filter((b) => b.categoryId == null), [all])
  const target = resort ? all : unsorted
  const noText = target.filter(needsFill).length
  const aiOn = loadAiSettings().engine !== 'local'

  function close() {
    abort.current?.abort()
    abort.current = null
    setStep({ kind: 'intro' })
    onClose()
  }

  async function run() {
    const ctl = new AbortController()
    abort.current = ctl
    const ids = target.map((b) => b.id!).filter((id) => id != null)
    try {
      // 1) 제목 · 내용이 비어 있는 것은 페이지 정보(캡션, 미리보기)로 먼저 채운다. AI 안 씀
      const missing = target.filter(needsFill).map((b) => b.id!)
      if (missing.length) {
        setStep({ kind: 'working', done: 0, total: missing.length })
        await enrichMany(missing, (done, total) => setStep({ kind: 'working', done, total }), ctl.signal)
      }
      if (ctl.signal.aborted) return
      const fresh = await bookmarkRepo.list('all')
      const cats = await scrapCategoryRepo.list()
      const list = fresh.filter((b) => ids.includes(b.id!))
      // 2) 규칙으로 추천 (바로 끝남)
      const suggest = makeSuggester(cats, fresh)
      const picks = new Map<number, Pick>()
      for (const b of list) {
        const s = suggest(b)
        const now = b.categoryId ?? null
        // 이미 나눈 것은 확실할 때만 바꾸자고 한다
        if (s && (now == null || (s.confidence === 'sure' && s.categoryId !== now))) picks.set(b.id!, { categoryId: s.categoryId, how: s.confidence, why: s.why })
        else picks.set(b.id!, { categoryId: now })
      }
      const rank = (b: Bookmark) => {
        const p = picks.get(b.id!)!
        if (p.categoryId !== (b.categoryId ?? null)) return p.how === 'sure' ? 0 : 1
        return 2
      }
      list.sort((a, b) => rank(a) - rank(b))
      setStep({ kind: 'review', list, picks, resort })
    } catch {
      if (!ctl.signal.aborted) setStep({ kind: 'intro' })
    }
  }

  async function askAi(list: Bookmark[], picks: Map<number, Pick>) {
    const unknown = list.filter((b) => (picks.get(b.id!)?.categoryId ?? null) === null && classifyText(b).trim())
    if (!unknown.length) return
    setStep((s) => (s.kind === 'review' ? { ...s, aiBusy: true, aiNote: undefined } : s))
    try {
      const cats = await scrapCategoryRepo.list()
      const out = await aiPickCategories(loadAiSettings(), cats, unknown.map((b) => ({ id: b.id!, text: classifyText(b) })))
      const name = ENGINE_LABEL[out.engine].title.replace(/ \(.*\)$/, '')
      setStep((s) => {
        if (s.kind !== 'review') return s
        const next = new Map(s.picks)
        for (const [id, categoryId] of out.result) next.set(id, { categoryId, how: 'ai' })
        return { ...s, picks: next, aiBusy: false, aiNote: `${name}가 ${unknown.length}개 중 ${out.result.size}개를 골랐어요` }
      })
    } catch (e) {
      setStep((s) => (s.kind === 'review' ? { ...s, aiBusy: false, aiNote: e instanceof Error ? e.message : 'AI에 연결하지 못했어요' } : s))
    }
  }

  async function apply(list: Bookmark[], picks: Map<number, Pick>) {
    const todo = list.flatMap((b) => {
      const p = picks.get(b.id!)
      return p && p.categoryId !== (b.categoryId ?? null) ? [{ id: b.id!, categoryId: p.categoryId }] : []
    })
    const changed = await bookmarkRepo.setCategories(todo)
    setStep({ kind: 'done', changed })
  }

  async function addPresets() {
    for (const k of CLASS_ORDER) await scrapCategoryRepo.add(CLASS_NAME[k]).catch(() => undefined)
  }

  const chip = (on: boolean) => `tap inline-flex min-h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-bold whitespace-nowrap transition ${on ? 'bg-grad on-grad shadow-sm' : 'bg-slate-100 text-slate-500'}`
  const catName = (id: number | null) => (id == null ? '미분류' : (categories.find((c) => c.id === id)?.name ?? '미분류'))

  return (
    <Modal open={open} title="스크랩 정리하기" onClose={close}>
      {step.kind === 'intro' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-grad-soft p-4">
            <p className="text-2xl font-extrabold text-slate-900">{target.length.toLocaleString()}개</p>
            <p className="text-sm text-slate-600">{resort ? '모든 스크랩' : '미분류로 남은 스크랩'}</p>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-bold text-slate-700">여기로 나눠요</p>
            {categories.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <span key={c.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-bold text-slate-600">
                    {c.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mb-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
                아직 카테고리가 없어요. 아래에서 만들거나, 자주 쓰는 넷을 한 번에 만들어 보세요.
                <button type="button" onClick={() => void addPresets()} className="tap mt-2 flex flex-wrap gap-1 rounded-xl bg-white px-3 py-2 text-[13px] font-bold text-slate-700 shadow-sm">
                  {CLASS_ORDER.map((k) => `${CLASS_EMOJI[k]} ${CLASS_NAME[k]}`).join(' · ')} 만들기
                </button>
              </div>
            )}
            <CategoryPicker categories={categories} value={null} showChoices={false} onChange={() => undefined} />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={resort} onChange={(e) => setResort(e.target.checked)} className="size-4 accent-brand-600" />
            이미 나눈 스크랩도 다시 보기 (확실할 때만 바꾸자고 해요)
          </label>

          <p className="text-xs leading-relaxed text-slate-400">
            AI는 쓰지 않아요. 제목 · 캡션 낱말, 카테고리 이름, 지금까지 내가 나눈 스크랩을 보고 골라요. 나눌수록 더 잘 맞아요.
            {noText > 0 && ` 제목 · 내용이 빈 ${noText}개는 먼저 페이지에서 읽어 와요.`}
          </p>
          <Button className="w-full" onClick={() => void run()} disabled={!target.length || !categories.length}>
            <Wand2 className="size-4" aria-hidden /> 정리 시작
          </Button>
        </div>
      )}

      {step.kind === 'working' && (
        <div className="space-y-3 py-6">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
            <Loader2 className="size-5 animate-spin text-brand-600" aria-hidden />
            제목 · 내용 읽어 오는 중 · {step.done} / {step.total}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-grad transition-all" style={{ width: `${step.total ? Math.round((step.done / step.total) * 100) : 0}%` }} />
          </div>
        </div>
      )}

      {step.kind === 'review' &&
        (() => {
          const moving = step.list.filter((b) => (step.picks.get(b.id!)?.categoryId ?? null) !== (b.categoryId ?? null))
          const unknown = step.list.filter((b) => (step.picks.get(b.id!)?.categoryId ?? null) === null)
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl bg-slate-50 py-2">
                  <p className="text-lg font-extrabold text-slate-900">{moving.length}</p>
                  <p className="text-[12px] text-slate-500">옮길 스크랩</p>
                </div>
                <div className="rounded-2xl bg-slate-50 py-2">
                  <p className="text-lg font-extrabold text-slate-900">{unknown.length}</p>
                  <p className="text-[12px] text-slate-500">모르겠어요 (미분류)</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">틀린 건 눌러서 고쳐 주세요. 고친 것도 다음 추천에 배워요.</p>
              {aiOn && unknown.length > 0 && (
                <button
                  type="button"
                  onClick={() => void askAi(step.list, step.picks)}
                  disabled={step.aiBusy}
                  className="tap flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-300 px-3 py-2 text-[13px] font-bold text-brand-700 disabled:opacity-60"
                >
                  {step.aiBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                  모르는 {unknown.length}개만 AI에게 물어보기 (선택)
                </button>
              )}
              {step.aiNote && <p className="text-xs text-brand-700">{step.aiNote}</p>}
              <ul className="-mx-1 max-h-[42dvh] divide-y divide-slate-100 overflow-y-auto px-1">
                {step.list.map((b) => {
                  const p = step.picks.get(b.id!) ?? { categoryId: null }
                  const changed = p.categoryId !== (b.categoryId ?? null)
                  const set = (v: number | null) => setStep((s) => (s.kind === 'review' ? { ...s, picks: new Map(s.picks).set(b.id!, { categoryId: v }) } : s))
                  return (
                    <li key={b.id} className="py-2.5">
                      <p className="truncate text-sm font-bold text-slate-800">{b.title}</p>
                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{b.description?.trim() || '내용을 읽지 못했어요 (비공개이거나 지워진 게시물)'}</p>
                      <p className="mt-0.5 text-[11px] font-bold">
                        {changed && p.how === 'sure' && <span className="text-emerald-600">추천 · {p.why}</span>}
                        {changed && p.how === 'guess' && <span className="text-amber-600">아마도 · {p.why}</span>}
                        {changed && p.how === 'ai' && <span className="text-brand-600">AI 추천</span>}
                        {step.resort && b.categoryId != null && <span className="ml-1 text-slate-400">지금: {catName(b.categoryId)}</span>}
                      </p>
                      <div className="-mx-1 mt-1.5 flex gap-1 overflow-x-auto px-1 pb-0.5">
                        {categories.map((c) => (
                          <button key={c.id} type="button" aria-pressed={p.categoryId === c.id} onClick={() => set(c.id!)} className={chip(p.categoryId === c.id)}>
                            {c.name}
                          </button>
                        ))}
                        <button type="button" aria-pressed={p.categoryId === null} onClick={() => set(null)} className={chip(p.categoryId === null)}>
                          미분류
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="sticky bottom-0 -mx-5 -mb-[calc(1.5rem+env(safe-area-inset-bottom))] flex gap-2 border-t border-slate-100 bg-white px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:-mx-6 md:-mb-6 md:px-6 md:pb-6">
                <Button variant="secondary" className="flex-1" onClick={close}>
                  취소
                </Button>
                <Button className="flex-[2]" onClick={() => void apply(step.list, step.picks)} disabled={!moving.length}>
                  {moving.length}개 정리하기
                </Button>
              </div>
            </div>
          )
        })()}

      {step.kind === 'done' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-9 shrink-0 text-emerald-500" aria-hidden />
            <p className="text-lg font-extrabold text-slate-900">{step.changed.toLocaleString()}개 정리했어요</p>
          </div>
          <Button className="w-full" onClick={close}>
            스크랩 보러 가기
          </Button>
        </div>
      )}
    </Modal>
  )
}
