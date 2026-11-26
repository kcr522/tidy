import { assistantPrompt, AssistantError, ASSISTANT_SYSTEM, JSON_SHAPE, parseAssistantJson, type AssistantReply, type AssistantRequest } from './assistant'
import { ADVISOR_SYSTEM, advisorPrompt, askAdvisor } from './advisor'
import { callGroq } from './groq'
import { callGemini, type GeminiSource } from './gemini'
import { localAssistant } from './assistantLocal'
import { effectiveAi, type AiSettings, type EngineId } from './engines'

export interface AssistantResult extends AssistantReply {
  engine: EngineId
  /** AI를 못 써서 기본(AI 없이)으로 대신 답했을 때, 왜 그랬는지 */
  fallback?: string
  /** 고른 AI 대신 예비 AI가 답했을 때 알려 줄 한 줄 */
  note?: string
  /** 질문에 답할 때 검색으로 찾은 출처 */
  sources?: GeminiSource[]
}

/**
 * 설정 > AI 연결에서 고른 방법으로 묻는다 (AI 소비 한마디와 같은 설정)
 * - 기본(AI 없이): 글에서 날짜·금액을 규칙으로 찾는다. 사진은 기기 안에서 글자를 읽어(OCR) 같은 규칙으로 찾는다
 * - Gemini (무료): 내 Gemini 키로 사진과 글을 읽는다
 * - Tidy AI: 서버에 넣어 둔 무료 Gemini 키로 (키 입력 없이)
 */
export async function askAssistant(chosen: AiSettings, req: AssistantRequest, signal?: AbortSignal): Promise<AssistantResult> {
  const r = await askWith(effectiveAi(chosen), req, signal)
  // Tidy AI 를 골랐으면 서버의 Gemini 가 답한 걸 'Tidy AI' 로 보여 준다
  return chosen.engine === 'tidy' && r.engine === 'gemini' ? { ...r, engine: 'tidy' } : r
}

async function askWith(settings: AiSettings, req: AssistantRequest, signal?: AbortSignal): Promise<AssistantResult> {
  try {
    const ai = await askAi(settings, req, signal)
    if (ai?.kind === 'question') return await answerQuestion(settings, req, ai, signal)
    if (ai) return ai
  } catch (err) {
    if (signal?.aborted) throw err
    const why = err instanceof Error ? err.message : 'AI에 연결하지 못했어요'
    // 예비 AI(Groq)가 있으면 그걸로 (사진은 Groq가 못 읽어서 기본으로)
    const groq = settings.groqKey?.trim()
    if (groq && !req.image) {
      try {
        return { ...(await askGroq(groq, req, signal)), note: `${why.split(/\.\s/)[0].replace(/\.$/, '')}. 그래서 예비 AI(Groq)가 대신 답할게요.` }
      } catch (err2) {
        if (signal?.aborted) throw err2
      }
    }
    // 그래도 안 되면(무료 사용량을 다 썼거나, 서버가 붐비거나, 인터넷이 끊기면) 멈추지 않고 기본(AI 없이)으로 답한다
    return { ...(await askLocal(req)), fallback: why }
  }
  return askLocal(req)
}

/** 예비 Groq: 일정·결제·일기를 JSON으로, 질문이면 한 번 더 물어 답한다 (검색은 못 한다) */
async function askGroq(apiKey: string, req: AssistantRequest, signal?: AbortSignal): Promise<AssistantResult> {
  const user = `${assistantPrompt(req).replace(/report로 알려 줘\.$/, '알려 줘.')}\n\n${JSON_SHAPE}`
  const { text } = await callGroq(apiKey, { system: ASSISTANT_SYSTEM, user, json: true, maxTokens: 2048, signal })
  const out = parseAssistantJson(text, req.context?.categories)
  if (!out) throw new AssistantError('Groq 답을 알아보지 못했어요')
  if (out.kind === 'question') {
    const a = await callGroq(apiKey, { system: ADVISOR_SYSTEM, user: advisorPrompt(req.text ?? '', req.today, req.context), maxTokens: 1500, signal })
    return { ...out, reply: `${a.text.slice(0, 1400)}\n\n(예비 AI라 최신 금리는 검색하지 못했어요. 은행 앱에서 꼭 확인해 주세요.)`, engine: 'groq' }
  }
  return { ...out, engine: 'groq' }
}

/** 돈·생활 질문: Gemini가 검색까지 해서 답한다 */
async function answerQuestion(settings: AiSettings, req: AssistantRequest, ai: AssistantResult, signal?: AbortSignal): Promise<AssistantResult> {
  const question = req.text?.trim() || '사진 속 내용에 대해 알려 줘'
  if (settings.engine !== 'gemini' || !settings.geminiKey?.trim()) {
    return { ...ai, kind: 'none', reply: ai.reply || '질문에 답하는 건 설정 > AI 연결에서 Gemini (무료)를 고르면 할 수 있어요.' }
  }
  const a = await askAdvisor(settings.geminiKey.trim(), question, req.today, req.context, signal)
  return { ...ai, kind: 'question', reply: a.text.slice(0, 1500), sources: a.sources }
}

/** 고른 AI로 묻기. AI를 고르지 않았으면 null */
async function askAi(settings: AiSettings, req: AssistantRequest, signal?: AbortSignal): Promise<AssistantResult | null> {
  if (settings.engine === 'gemini' && settings.geminiKey?.trim()) {
    const parts = [
      ...(req.image ? [{ inlineData: { mimeType: 'image/jpeg', data: req.image } }] : []),
      { text: `${assistantPrompt(req).replace(/report로 알려 줘\.$/, '알려 줘.')}\n\n${JSON_SHAPE}` },
    ]
    try {
      const text = await callGemini(settings.geminiKey.trim(), { system: ASSISTANT_SYSTEM, parts, schema: {}, maxTokens: 4096, signal })
      const out = parseAssistantJson(text, req.context?.categories)
      if (!out) throw new AssistantError('Gemini 답을 알아보지 못했어요')
      return { ...out, engine: 'gemini' }
    } catch (err) {
      if (signal?.aborted || err instanceof AssistantError) throw err
      throw new AssistantError(err instanceof Error ? err.message : 'Gemini에 연결하지 못했어요')
    }
  }
  return null
}

async function askLocal(req: AssistantRequest): Promise<AssistantResult> {
  // 기본(AI 없이): 사진이 있으면 기기 안에서 글자를 읽고, 은행·카드 캡처면 내역을 규칙으로 찾는다
  if (req.image) {
    const { recognizeText } = await import('../ocr/recognize')
    const { parseBankText } = await import('../ocr/bankText')
    const read = await recognizeText(`data:image/jpeg;base64,${req.image}`).catch(() => '')
    const bank = parseBankText(read, req.today)
    if (bank.payments.length > 0) {
      const n = bank.payments.length
      return {
        kind: 'payment',
        reply: `캡처에서 결제 내역 ${n}건을 찾았어요. 맞는지 확인해 주세요.`,
        events: [],
        payments: bank.payments,
        diary: null,
        engine: 'local',
      }
    }
    const text = [req.text, read].filter((t) => t?.trim()).join('\n')
    return { ...localAssistant({ ...req, image: undefined, text }), engine: 'local' }
  }
  return { ...localAssistant(req), engine: 'local' }
}
