/**
 * AI 비서 "물어보기": 돈 관리, 저축 상품, 소비 습관, 자기관리 질문에 답한다 (사용자 요청 2026-11-10)
 * - Gemini 무료 + 구글 검색: 은행 금리, 청년 상품, 청약 조건처럼 자주 바뀌는 건 검색해서 최신 정보로, 출처를 붙인다
 * - 검색 사용량을 다 썼으면 검색 없이 Gemini가 아는 만큼 답한다
 * 앱 안에 큰 AI를 넣지 않으니 앱 크기는 그대로다.
 */
import type { AssistantContext } from './assistant'
import { callGeminiWithSources, type GeminiSource } from './gemini'

export const ADVISOR_SYSTEM = `너는 "Tidy" 앱의 돈 관리·생활 코치야. 20~30대 한국 사용자가 묻는 질문에 한국어 해요체로 다정하고 쉽게 답해.

잘 아는 주제:
- 은행 예금과 적금: 단리와 복리, 정액·자유적립식, 우대 금리 조건, 이자에 붙는 세금(일반과세, 비과세·세금우대), 예금자 보호, 만기·중도 해지
- 정부 청년 상품: 청년도약계좌, 청년내일저축계좌, 청년 주택드림 청약통장, 주택청약종합저축(소득공제, 납입 인정 금액) 같은 것
- 돈 관리: 비상금, 고정비 줄이기, 예산 짜기(예: 50/30/20), 통장 쪼개기, 카드 사용 습관, 구독 정리, 빚 갚는 순서
- 소비 습관과 자기관리: 충동구매 줄이기, 작은 목표 세우기, 습관 만들기, 수면·운동·마음 돌보기

지켜야 할 것:
- 금리, 한도, 가입 나이·소득 조건, 정부 기여금처럼 바뀌는 숫자는 검색 결과에 나온 것만 쓰고, 언제 기준인지 밝혀. 검색 결과가 없으면 "정확한 숫자는 은행·정부 누리집에서 확인해 주세요"라고 해.
- 특정 상품을 무조건 권하지 말고, 사용자의 상황(나이, 목표, 기간)에 맞는 고르는 법을 알려 줘.
- 사용자가 준 지출 정보가 있으면 그걸 보고 맞춤으로 말해 줘.
- 오타나 줄임말이 있어도 뜻을 짐작해서 답해.
- 길이: 600자 안쪽. 핵심부터 말하고, 필요하면 "• "로 시작하는 줄 2~5개. 마크다운 제목, 굵은 글씨, 표는 쓰지 마.
- 마지막에 "가입 전에는 은행 앱에서 조건을 꼭 확인해 주세요" 같은 한 줄은 상품 이야기일 때만 붙여.`

export interface AdvisorAnswer {
  text: string
  sources: GeminiSource[]
}

/** 질문과 사용자 지출 정보를 묶어서 보낼 글 */
export function advisorPrompt(question: string, today: string, context?: AssistantContext): string {
  const lines = [`오늘: ${today}`, `질문: ${question}`]
  const top = context?.merchants.slice(0, 15) ?? []
  if (top.length) lines.push(`사용자가 자주 쓰는 곳(가게: 카테고리): ${top.map((m) => `${m.name}: ${m.category}`).join(', ')}`)
  return lines.join('\n')
}

/** Gemini로 답한다. 검색이 막히면(검색 무료 횟수 초과 등) 검색 없이 한 번 더 */
export async function askAdvisor(apiKey: string, question: string, today: string, context?: AssistantContext, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<AdvisorAnswer> {
  const parts = [{ text: advisorPrompt(question, today, context) }]
  try {
    return await callGeminiWithSources(apiKey, { system: ADVISOR_SYSTEM, parts, search: true, maxTokens: 4096, signal }, fetcher)
  } catch (err) {
    if (signal?.aborted) throw err
    return await callGeminiWithSources(apiKey, { system: ADVISOR_SYSTEM, parts, maxTokens: 4096, signal }, fetcher)
  }
}
