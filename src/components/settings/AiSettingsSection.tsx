import { Check, Eye, EyeOff, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { DEFAULT_SERVER_URL, ENGINE_LABEL, RECOMMENDED_ENGINE, type EngineId } from '../../lib/ai/engines'
import { useAiSettings } from '../../lib/ai/settings'
import Button from '../common/Button'
import { inputClass } from '../common/formStyles'
import { useToast } from '../common/Toast'

const ORDER: EngineId[] = ['gemini', 'local', 'server', 'key']

/** 돈이 드는 연결 */
const PAID: EngineId[] = ['server', 'key']

/** 설정 > AI 연결: 한마디를 어디서 받아 올지 고른다 */
export default function AiSettingsSection() {
  const [settings, save] = useAiSettings()
  const [engine, setEngine] = useState<EngineId>(settings.engine)
  const [apiKey, setApiKey] = useState(settings.apiKey ?? '')
  const [geminiKey, setGeminiKey] = useState(settings.geminiKey ?? '')
  const [serverUrl, setServerUrl] = useState(settings.serverUrl ?? '')
  const toast = useToast()

  const keyMissing = (engine === 'key' && !apiKey.trim()) || (engine === 'gemini' && !geminiKey.trim())
  const changed =
    engine !== settings.engine ||
    apiKey.trim() !== (settings.apiKey ?? '') ||
    geminiKey.trim() !== (settings.geminiKey ?? '') ||
    serverUrl.trim() !== (settings.serverUrl ?? '')

  function submit() {
    if (keyMissing) return
    save({
      engine,
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      ...(geminiKey.trim() ? { geminiKey: geminiKey.trim() } : {}),
      ...(serverUrl.trim() ? { serverUrl: serverUrl.trim() } : {}),
    })
    toast('AI 연결을 바꿨어요')
  }

  return (
    <section className="card overflow-hidden">
      <h2 className="flex items-center gap-2 px-5 pt-5 pb-1 font-bold">
        <Sparkles className="size-[18px] text-brand-600" aria-hidden />
        AI 연결
      </h2>
      <p className="px-5 pb-3 text-sm break-keep text-slate-500">대시보드의 'AI 소비 한마디'를 어디서 받아 올지 골라요.</p>

      <div role="radiogroup" aria-label="AI 연결 방법" className="space-y-2 px-5">
        {ORDER.map((id) => {
          const on = id === engine
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setEngine(id)}
              className={`tap flex w-full items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${
                on ? 'border-brand-500 bg-brand-50' : 'border-slate-100 hover:bg-slate-50'
              }`}
            >
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${on ? 'bg-brand-500 text-white' : 'border-2 border-slate-300'}`}
                aria-hidden
              >
                {on && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-800">
                  {ENGINE_LABEL[id].title}
                  {id === RECOMMENDED_ENGINE && <span className="bg-grad on-grad rounded-full px-2 py-0.5 text-[11px] font-bold">추천</span>}
                  {PAID.includes(id) && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">유료</span>}
                </span>
                <span className="block text-sm break-keep text-slate-500">{ENGINE_LABEL[id].desc}</span>
              </span>
            </button>
          )
        })}
      </div>

      {engine === 'gemini' && (
        <KeyInput
          id="ai-gemini-key"
          label="Gemini API 키"
          value={geminiKey}
          onChange={setGeminiKey}
          placeholder="AIza..."
          hint="aistudio.google.com에 Google 계정으로 들어가서 'Get API key'를 누르면 무료로 만들 수 있어요. 결제 정보는 안 넣어도 돼요. 무료로 쓰면 Google이 보낸 내용을 서비스 개선에 쓸 수 있어요."
        />
      )}

      {engine === 'key' && (
        <KeyInput
          id="ai-key"
          label="Claude API 키"
          value={apiKey}
          onChange={setApiKey}
          placeholder="sk-ant-..."
          hint="console.anthropic.com에서 만들 수 있어요. 한마디 한 번에 10~20원쯤 들어요."
        />
      )}

      {engine === 'server' && (
        <div className="px-5 pt-4">
          <label htmlFor="ai-server" className="mb-1.5 block text-sm font-semibold text-slate-700">
            서버 주소 (비워 두면 기본)
          </label>
          <input
            id="ai-server"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder={DEFAULT_SERVER_URL}
            autoComplete="off"
            spellCheck={false}
            className={inputClass()}
          />
          <p className="mt-1.5 text-xs break-keep text-slate-400">Vercel에 ANTHROPIC_API_KEY를 넣어 두면 이 주소가 Claude에게 대신 물어봐요.</p>
        </div>
      )}

      {engine !== 'local' && (
        <p className="mx-5 mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs break-keep text-slate-500">
          한마디를 받을 때 오늘 지출 내역(가게 이름, 카테고리, 금액)과 이번 달 합계만 AI에게 보내요. 다른 기록은 보내지 않아요.
        </p>
      )}

      <div className="p-5">
        <Button className="w-full" onClick={submit} disabled={!changed || keyMissing}>
          저장
        </Button>
      </div>
    </section>
  )
}

function KeyInput(props: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder: string; hint: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="px-5 pt-4">
      <label htmlFor={props.id} className="mb-1.5 block text-sm font-semibold text-slate-700">
        {props.label}
      </label>
      <div className="relative">
        <input
          id={props.id}
          type={show ? 'text' : 'password'}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          autoComplete="off"
          spellCheck={false}
          className={`${inputClass()} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="tap absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-2 text-slate-400"
          aria-label={show ? '키 숨기기' : '키 보기'}
        >
          {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
      <p className="mt-1.5 text-xs break-keep text-slate-400">{props.hint} 키는 이 기기에만 저장되고 백업 파일에는 들어가지 않아요.</p>
    </div>
  )
}
