import { Check, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { APP_FONTS, getFontId, loadPreviewFont, previewStack, setFont } from '../../lib/appFont'
import { useToast } from '../common/Toast'

const SAMPLE = '오늘 할 일 3개 · 1,284,000원'

/**
 * 설정 > 글꼴 (사용자 요청 2026-11-25): 많이 쓰는 무료 한글 글꼴 중에서 골라 앱 전체 글씨를 바꾼다.
 * 버튼마다 그 글꼴로 견본 글씨를 보여 주고, 누르면 바로 바뀐다 (이 기기에만 저장)
 */
export default function FontCard() {
  const toast = useToast()
  const [current, setCurrent] = useState(getFontId)
  const [busy, setBusy] = useState<string | null>(null)
  const [, setReady] = useState(0)

  useEffect(() => {
    const text = SAMPLE + APP_FONTS.map((f) => f.name + f.desc).join('')
    void Promise.all(APP_FONTS.map((f) => loadPreviewFont(f, text))).then(() => setReady((n) => n + 1))
  }, [])

  async function pick(id: string) {
    if (id === current || busy) return
    setBusy(id)
    try {
      await setFont(id)
      setCurrent(id)
    } catch {
      toast('글꼴을 받지 못했어요. 인터넷 연결을 확인해 주세요', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="card p-5">
      <h2 className="font-bold">글꼴</h2>
      <p className="mb-1 text-sm text-slate-500">앱 전체 글씨체를 골라요. 누르면 바로 바뀌어요.</p>
      <p className="text-xs break-keep text-slate-400">모두 무료 글꼴이에요. 기본 말고는 처음 고를 때 인터넷에서 받아요 (앱 크기는 그대로).</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {APP_FONTS.map((f) => {
          const on = current === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => void pick(f.id)}
              aria-pressed={on}
              className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-2.5 text-left ${on ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 bg-white'}`}
              style={{ fontFamily: previewStack(f) }}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-slate-900">{f.name}</span>
                <span className="block text-xs text-slate-400">{f.desc}</span>
                <span className="mt-0.5 block truncate text-sm text-slate-600">{SAMPLE}</span>
              </span>
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${on ? 'bg-brand-500 text-white' : 'border-2 border-slate-300'}`}>
                {busy === f.id ? <LoaderCircle className="size-3.5 animate-spin text-slate-500" aria-hidden /> : on && <Check className="size-3.5" strokeWidth={3.5} aria-hidden />}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
