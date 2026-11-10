import { Check, Eye, EyeOff, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { DEFAULT_SERVER_URL, ENGINE_LABEL, type EngineId } from '../../lib/ai/engines'
import { useAiSettings } from '../../lib/ai/settings'
import Button from '../common/Button'
import { inputClass } from '../common/formStyles'
import { useToast } from '../common/Toast'

const ORDER: EngineId[] = ['gemini', 'local', 'server', 'key']

/** 설정 > AI 연결: 한마디를 어디서 받아 올지 고른다 */
export default function AiSettingsSection() {
  const [settings, save] = useAiSettings()
  const [engine, setEngine] = useState<EngineId>(settings.engine)
  const [apiKey, setApiKey] = useState(settings.apiKey ?? '')
  const [geminiKey, setGeminiKey] = useState(settings.geminiKey ?? '')
  const [groqKey, setGroqKey] = useState(settings.groqKey ?? '')
  const [serverUrl, setServerUrl] = useState(settings.serverUrl ?? '')
  const [show, setShow] = useState(false)
  const toast = useToast()

  const keyMissing = (engine === 'key' && !apiKey.trim()) || (engine === 'gemini' && !geminiKey.trim())
  const changed =
    engine !== settings.engine ||
    apiKey.trim() !== (settings.apiKey ?? '') ||
    geminiKey.trim() !== (settings.geminiKey ?? '') ||
    groqKey.trim() !== (settings.groqKey ?? '') ||
    serverUrl.trim() !== (settings.serverUrl ?? '')

  function submit() {
    if (keyMissing) return
    save({
      engine,
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      ...(geminiKey.trim() ? { geminiKey: geminiKey.trim() } : {}),
      ...(groqKey.trim() ? { groqKey: groqKey.trim() } : {}),
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
      <p className="px-5 pb-3 text-sm break-keep text-slate-500">'AI 소비 한마디', 'AI 비서' 대화창, '음식 사진으로 기록'에 쓸 AI를 골라요.</p>

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
                <span className="block font-semibold text-slate-800">
                  {ENGINE_LABEL[id].title}
                  {id === 'gemini' && <span className="ml-1.5 rounded-full bg-brand-500 px-2 py-0.5 align-middle text-[11px] font-bold text-white">추천</span>}
                </span>
                <span className="block text-sm break-keep text-slate-500">{ENGINE_LABEL[id].desc}</span>
              </span>
            </button>
          )
        })}
      </div>

      {engine === 'gemini' && (
        <div className="px-5 pt-4">
          <label htmlFor="ai-gemini" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Gemini API 키 (무료)
          </label>
          <div className="relative">
            <input
              id="ai-gemini"
              type={show ? 'text' : 'password'}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIza..."
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
          <p className="mt-1.5 text-xs break-keep text-slate-400">
            aistudio.google.com 에 구글 계정으로 들어가 'Get API key'를 누르면 무료로 만들 수 있어요. 카드 등록은 필요 없어요. 하루 사용 횟수 제한이 있고, 무료 등급 대화는 구글이 서비스 개선에 쓸 수 있어요. 키는 이 기기에만 저장돼요.
          </p>
        </div>
      )}

      {engine !== 'local' && (
        <div className="px-5 pt-4">
          <label htmlFor="ai-groq" className="mb-1.5 block text-sm font-semibold text-slate-700">
            예비 AI: Groq API 키 (무료, 넣지 않아도 돼요)
          </label>
          <input
            id="ai-groq"
            type={show ? 'text' : 'password'}
            value={groqKey}
            onChange={(e) => setGroqKey(e.target.value)}
            placeholder="gsk_..."
            autoComplete="off"
            spellCheck={false}
            className={inputClass()}
          />
          <p className="mt-1.5 text-xs break-keep text-slate-400">
            위에서 고른 AI가 한도를 다 쓰거나 붐비면 Groq가 대신 답해요. console.groq.com 에 구글 계정으로 들어가 'API Keys' → 'Create API Key'를 누르면 무료로 만들 수 있어요. 사진 읽기와 검색은 못 해요. 키는 이 기기에만 저장돼요.
          </p>
        </div>
      )}

      {engine === 'key' && (
        <div className="px-5 pt-4">
          <label htmlFor="ai-key" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Claude API 키
          </label>
          <div className="relative">
            <input
              id="ai-key"
              type={show ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
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
          <p className="mt-1.5 text-xs break-keep text-slate-400">
            console.anthropic.com에서 만들 수 있어요. 이 기기에만 저장되고 백업 파일에는 들어가지 않아요. 한마디 한 번에 10~20원쯤 들어요.
          </p>
        </div>
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
          <p className="mt-1.5 text-xs break-keep text-slate-400">Vercel에 ANTHROPIC_API_KEY를 넣어 두면 이 주소가 Claude에게 대신 물어봐요. 음식 사진은 같은 서버의 /api/meal 로 가고, KAKAO_REST_API_KEY도 넣으면 근처 식당을 지도에서 찾아요.</p>
        </div>
      )}

      {engine !== 'local' && (
        <p className="mx-5 mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs break-keep text-slate-500">
          한마디에는 오늘 지출 내역과 이번 달 합계만, AI 비서에는 보낸 사진·글과 자주 간 가게 요약(카테고리, 결제 수단)만 AI에게 보내요.
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
