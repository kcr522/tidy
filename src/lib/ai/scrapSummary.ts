// 스크랩 AI 요약: 프롬프트, 들어온 값 다듬기, Claude 호출, AI 없이 만드는 간단 요약
// 이 파일은 앱과 서버(api/scrap-summary.ts) 둘 다 쓴다. 그래서 다른 파일을 import 하지 않는다 (타입만 예외).
import type Anthropic from '@anthropic-ai/sdk'

/** AI에게 보내는 스크랩 정보 */
export interface ScrapSummaryInput {
  url: string
  title: string
  /** 링크 미리보기 설명 (인스타그램이면 게시글 본문 앞부분) */
  description?: string
  siteName?: string
  /** 사용자가 쓴 메모 */
  memo?: string
  category?: string
  /** 같이 저장한 캡처 (작게 줄인 JPEG, base64). 글이 지워져도 캡처로 요약할 수 있다 */
  image?: { mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string }
}

export class SummaryError extends Error {}

export const SUMMARY_MODEL = 'claude-opus-5-5'
/** 서버로 받을 캡처 크기 한도 (base64 글자 수) */
export const MAX_IMAGE_B64 = 2_500_000

const SYSTEM = `너는 "Tidy" 앱의 스크랩 정리 도우미야. 사용자가 나중에 보려고 저장한 링크(인스타그램, 네이버 블로그, X 글 등)가 무슨 내용인지 한국어로 정리해 줘.

형식:
- 첫 줄: 한 문장 요약 (40자 안팎)
- 그다음 줄부터: "• "로 시작하는 핵심 2~4줄 (가게 이름, 장소, 가격, 방법, 날짜처럼 나중에 찾을 때 쓸모 있는 정보 위주)
- 마지막 줄: "#키워드" 2~4개를 띄어쓰기로

지켜야 할 것:
- 주어진 제목, 설명, 메모, 캡처 사진에 실제로 있는 내용만 써. 모르는 건 지어내지 마.
- 정보가 거의 없으면 짧게 쓰고, 어떤 글인지 추측이라고 밝혀.
- 마크다운 제목이나 굵은 글씨 없이 위 형식의 글만 써.`

export function summaryPrompt(i: ScrapSummaryInput): string {
  const lines = [
    `주소: ${i.url}`,
    `제목: ${i.title}`,
    i.siteName && `사이트: ${i.siteName}`,
    i.category && `사용자가 고른 카테고리: ${i.category}`,
    i.description && `미리보기 설명:\n${i.description}`,
    i.memo && `사용자 메모: ${i.memo}`,
    i.image && '같이 저장한 캡처 사진을 첨부했어. 사진 속 글자도 읽어서 정리해 줘.',
  ].filter(Boolean)
  return `${lines.join('\n')}\n\n이 스크랩을 정리해 줘.`
}

/** 서버로 들어온 값을 믿을 수 있는 모양으로 */
export function sanitizeSummaryInput(raw: unknown): ScrapSummaryInput | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const url = str(r.url, 2000)
  if (!/^https?:\/\//i.test(url)) return null
  const out: ScrapSummaryInput = { url, title: str(r.title, 200) || url }
  const description = str(r.description, 1500)
  const siteName = str(r.siteName, 60)
  const memo = str(r.memo, 300)
  const category = str(r.category, 30)
  if (description) out.description = description
  if (siteName) out.siteName = siteName
  if (memo) out.memo = memo
  if (category) out.category = category
  const img = r.image as Record<string, unknown> | undefined
  if (img && typeof img.data === 'string' && img.data.length <= MAX_IMAGE_B64 && /^[A-Za-z0-9+/=]+$/.test(img.data.slice(0, 200))) {
    const mt = img.mediaType
    if (mt === 'image/jpeg' || mt === 'image/png' || mt === 'image/webp') out.image = { mediaType: mt, data: img.data }
  }
  return out
}

/** Claude에게 요약을 받는다. 앱(내 API 키)과 서버가 같은 함수를 쓴다 */
export async function askClaudeSummary(client: Anthropic, input: ScrapSummaryInput, signal?: AbortSignal): Promise<string> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  if (input.image) content.push({ type: 'image', source: { type: 'base64', media_type: input.image.mediaType, data: input.image.data } })
  content.push({ type: 'text', text: summaryPrompt(input) })
  const res = await client.beta.messages.create(
    {
      model: SUMMARY_MODEL,
      max_tokens: 2048,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    },
    { signal },
  )
  if (res.stop_reason === 'refusal') throw new SummaryError('AI가 이번엔 정리하지 않았어요')
  const text = res.content
    .flatMap((b) => (b.type === 'text' ? [b.text] : []))
    .join('')
    .trim()
  if (!text) throw new SummaryError('AI가 빈 답을 줬어요')
  return text
}

function sentences(s: string): string[] {
  return s
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。]|다\.|요\.)\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 1)
}

/**
 * AI 없이 만드는 간단 요약: 미리보기 설명과 메모를 줄여서 보여 준다.
 * AI 연결이 없거나 실패했을 때 쓴다.
 */
export function localSummary(i: ScrapSummaryInput): string {
  // 인스타그램 설명 앞에 붙는 "좋아요 12개, 댓글 3개 - 아이디님, 날짜: " 부분은 뺀다
  const desc = (i.description ?? '')
    .replace(/^[\d,.\s]*(likes?|좋아요)[^:]*:\s*/i, '')
    .replace(/^["“]|["”]\.?$/g, '')
    .trim()
  const all = sentences(desc.replace(/#[\p{L}\p{N}_]+/gu, ''))
  // 첫 줄: 설명의 첫 문장 (없으면 제목)
  const firstSrc = all[0] ?? i.title
  const first = firstSrc.length > 50 ? `${firstSrc.slice(0, 50)}…` : firstSrc
  const points = all.slice(1, 4).map((s) => `• ${s.length > 70 ? `${s.slice(0, 70)}…` : s}`)
  if (i.memo) points.push(`• 내 메모: ${i.memo}`)
  const tags = Array.from(new Set((desc.match(/#[\p{L}\p{N}_]+/gu) ?? []).slice(0, 4)))
  const lines = [first, ...(points.length || all.length ? points : ['• 미리보기에 내용이 없어서 제목만 보여 줘요'])]
  if (tags.length) lines.push(tags.join(' '))
  return lines.join('\n')
}
