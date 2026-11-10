import { RefreshCw, Settings2, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Transaction } from '../../db/types'
import { ENGINE_LABEL, engineFor, localEngine } from '../../lib/ai/engines'
import { localFeedback } from '../../lib/ai/localEngine'
import { FEEDBACK_MODES, FeedbackError } from '../../lib/ai/prompts'
import { cachedFeedback, saveCachedFeedback, useAiSettings, useFeedbackMode } from '../../lib/ai/settings'
import { buildSnapshot, snapshotKey } from '../../lib/ai/snapshot'
import { formatWon } from '../../lib/format'
import { themeFor } from '../layout/theme'

interface Props {
  /** 이번 달 내역 */
  items: Transaction[]
  today: string
}

type State = { status: 'loading' } | { status: 'done'; text: string } | { status: 'error'; text: string; reason: string }

/** 오늘 쓴 돈을 보고 AI가 한마디: 피드백 / 절약 잔소리 / 무조건 칭찬 중에서 고른다 */
export default function AiFeedbackCard({ items, today }: Props) {
  const [mode, setMode] = useFeedbackMode()
  const [settings] = useAiSettings()
  const engine = useMemo(() => engineFor(settings), [settings])
  const snapshot = useMemo(() => buildSnapshot(items, today), [items, today])
  const key = snapshotKey(snapshot)
  const [state, setState] = useState<State>({ status: 'loading' })
  // 다시 묻기 버튼을 누를 때마다 1씩 오른다
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (engine.id === localEngine.id) {
      setState({ status: 'done', text: localFeedback(mode, snapshot) })
      return
    }
    const hit = cachedFeedback(mode)
    if (nonce === 0 && hit && hit.key === key && hit.engine === engine.id) {
      setState({ status: 'done', text: hit.text })
      return
    }
    const ctrl = new AbortController()
    setState({ status: 'loading' })
    engine
      .generate(mode, snapshot, ctrl.signal)
      .then((text) => {
        saveCachedFeedback(mode, { key, engine: engine.id, text })
        setState({ status: 'done', text })
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return
        // 연결이 안 되면 기기 안에서 만든 한마디라도 보여 준다
        const reason = err instanceof FeedbackError ? err.message : '지금은 AI에 연결하지 못했어요'
        setState({ status: 'error', text: localFeedback(mode, snapshot), reason })
      })
    return () => ctrl.abort()
    // key가 같으면 snapshot 내용도 같다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, mode, key, nonce])

  const current = FEEDBACK_MODES.find((m) => m.id === mode)!
  const isLocal = engine.id === localEngine.id

  return (
    <section className={`${themeFor('/money')} card flex flex-col overflow-hidden`} aria-labelledby="ai-feedback-title">
      <div className="bg-grad on-grad flex items-center gap-2.5 px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-on-soft">
          <Sparkles className="size-[18px]" strokeWidth={2.3} aria-hidden />
        </span>
        <h2 id="ai-feedback-title" className="min-w-0 flex-1 truncate text-[17px] font-bold">
          AI 소비 한마디
        </h2>
        <span className="shrink-0 rounded-full bg-on-soft px-2.5 py-1 text-xs font-bold">오늘 {formatWon(snapshot.todayTotal)}</span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5 pt-4">
        <div role="radiogroup" aria-label="말투 고르기" className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 p-1">
          {FEEDBACK_MODES.map((m) => {
            const on = m.id === mode
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                title={m.desc}
                onClick={() => setMode(m.id)}
                className={`tap flex min-h-11 flex-col items-center justify-center rounded-xl px-1 py-1.5 text-[13px] leading-tight font-bold transition ${
                  on ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  {m.emoji}
                </span>
                <span className="mt-1 whitespace-nowrap">{m.label}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-grad-soft text-2xl" aria-hidden>
            {current.emoji}
          </span>
          <div className="relative min-w-0 flex-1 rounded-3xl rounded-tl-md bg-grad-soft px-4 py-3.5" aria-live="polite" aria-busy={state.status === 'loading'}>
            {state.status === 'loading' ? (
              <p className="flex items-center gap-1.5 py-1.5" aria-label="한마디를 생각하는 중">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: `${i * 140}ms` }} />
                ))}
              </p>
            ) : (
              <p className="text-[15px] leading-relaxed break-keep text-slate-800">{state.text}</p>
            )}
          </div>
        </div>

        {state.status === 'error' && <p className="-mt-2 text-xs text-expense">{state.reason}. 기본 한마디를 대신 보여 줘요.</p>}

        <div className="mt-auto flex items-center gap-2 text-xs text-slate-400">
          <span className="min-w-0 flex-1 truncate">{ENGINE_LABEL[engine.id].title}</span>
          {isLocal ? (
            <Link to="/settings" className="tap flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 font-bold text-brand-700">
              <Settings2 className="size-3.5" aria-hidden />
              무료 AI 연결하기
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setNonce((n) => n + 1)}
              disabled={state.status === 'loading'}
              className="tap flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 font-bold text-slate-600 disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${state.status === 'loading' ? 'animate-spin' : ''}`} aria-hidden />
              다시 듣기
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
