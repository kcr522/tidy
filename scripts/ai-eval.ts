/**
 * AI 비서 정확도 시험 (사용자 요청 2026-11-11 "AI가 정확히 답변하는지 테스트해봐")
 *
 *   npx -y tsx scripts/ai-eval.ts                 # 기본 모드(AI 없이)
 *   GEMINI_KEY=… npx -y tsx scripts/ai-eval.ts    # Gemini (무료)
 *   GROQ_KEY=… npx -y tsx scripts/ai-eval.ts      # 예비 Groq
 *
 * 오늘을 2026-11-11(수)로 두고, 일정·결제·일기·질문 문장마다 앱이 고른 종류와 날짜·시각·금액·카테고리가 맞는지 본다.
 * 결과는 표로 찍고, --json 을 붙이면 JSON 으로도 낸다.
 */
import { askAssistant, type AssistantResult } from '../src/lib/ai/assistantEngines'
import type { AiSettings } from '../src/lib/ai/engines'

const TODAY = '2026-11-11'

interface Case {
  text: string
  kind: AssistantResult['kind']
  /** 맞는지 볼 것들. 틀린 것의 이름을 돌려준다 */
  check?: (r: AssistantResult) => string[]
}

const ev = (date: string, time: string | null, word: string, end = date) => (r: AssistantResult) => {
  const e = r.events[0]
  if (!e) return ['일정 없음']
  const bad: string[] = []
  if (e.startDate !== date) bad.push(`날짜 ${e.startDate} (맞는 답 ${date})`)
  if (e.endDate !== end) bad.push(`끝 날짜 ${e.endDate} (맞는 답 ${end})`)
  if (e.time !== time) bad.push(`시각 ${e.time ?? '없음'} (맞는 답 ${time ?? '없음'})`)
  if (!`${e.title} ${e.place ?? ''}`.includes(word)) bad.push(`제목 "${e.title}"에 "${word}" 없음`)
  return bad
}
const pay = (type: 'EXPENSE' | 'INCOME', amount: number, category: string, date = TODAY) => (r: AssistantResult) => {
  const p = r.payments[0]
  if (!p) return ['결제 없음']
  const bad: string[] = []
  if (p.type !== type) bad.push(`${p.type === 'INCOME' ? '수입' : '지출'}으로 봄`)
  if (p.amount !== amount) bad.push(`금액 ${p.amount.toLocaleString()} (맞는 답 ${amount.toLocaleString()})`)
  if (p.category !== category) bad.push(`카테고리 ${p.category} (맞는 답 ${category})`)
  if (p.date !== date) bad.push(`날짜 ${p.date} (맞는 답 ${date})`)
  return bad
}
const diary = (date: string) => (r: AssistantResult) => (r.diary?.date === date ? [] : [`날짜 ${r.diary?.date ?? '없음'} (맞는 답 ${date})`])

export const CASES: Case[] = [
  // 일정 (오늘 11-11 수요일)
  { text: '내일 오후 3시 치과', kind: 'event', check: ev('2026-11-12', '15:00', '치과') },
  { text: '다음주 금요일 저녁 7시 강남역에서 지수랑 저녁', kind: 'event', check: ev('2026-11-20', '19:00', '지수') },
  { text: '11월 25일부터 27일까지 제주도 여행', kind: 'event', check: ev('2026-11-25', null, '제주', '2026-11-27') },
  { text: '모레 오전 10시 반 팀 회의', kind: 'event', check: ev('2026-11-13', '10:30', '회의') },
  { text: '12/3 엄마 생신', kind: 'event', check: ev('2026-12-03', null, '생신') },
  { text: '이번주 토요일 2시에 영화 보기', kind: 'event', check: ev('2026-11-14', '14:00', '영화') },
  { text: '다음 달 5일 정기검진 예약', kind: 'event', check: ev('2026-12-05', null, '검진') },
  // 결제
  { text: '오늘 스타벅스 5,800원', kind: 'payment', check: pay('EXPENSE', 5800, '식비') },
  { text: '어제 택시비 12000원 냈어', kind: 'payment', check: pay('EXPENSE', 12000, '교통', '2026-11-10') },
  { text: '점심 김밥천국 8천원', kind: 'payment', check: pay('EXPENSE', 8000, '식비') },
  { text: '월급 250만원 들어옴', kind: 'payment', check: pay('INCOME', 2_500_000, '월급') },
  { text: '쿠팡에서 3만 2천원 주문했어', kind: 'payment', check: pay('EXPENSE', 32000, '쇼핑') },
  { text: '엄마한테 용돈 10만원 받았어', kind: 'payment', check: pay('INCOME', 100_000, '용돈') },
  { text: '넷플릭스 17,000원 결제', kind: 'payment', check: pay('EXPENSE', 17000, '문화/여가') },
  { text: '약국에서 감기약 4500원', kind: 'payment', check: pay('EXPENSE', 4500, '의료/건강') },
  // 일기
  { text: '오늘 친구랑 한강 가서 치킨 먹었는데 너무 좋았다', kind: 'diary', check: diary(TODAY) },
  { text: '어제 하루종일 비 와서 집에서 책 읽었어', kind: 'diary', check: diary('2026-11-10') },
  { text: '요즘 너무 피곤하다 오늘은 일찍 자야지', kind: 'diary', check: diary(TODAY) },
  // 질문
  { text: '청년도약계좌 금리 얼마야?', kind: 'question' },
  { text: '적금이랑 예금 차이가 뭐야?', kind: 'question' },
  { text: '한 달에 얼마 저축하는 게 좋아?', kind: 'question' },
]

const KIND: Record<string, string> = { event: '일정', payment: '결제', diary: '일기', question: '질문', none: '못 알아봄' }

async function main() {
  const settings: AiSettings = process.env.GEMINI_KEY
    ? { engine: 'gemini', geminiKey: process.env.GEMINI_KEY, groqKey: process.env.GROQ_KEY }
    : process.env.GROQ_KEY
      ? // Groq만 시험: Gemini 키를 일부러 비워 두면 기본 모드로 가므로, 틀린 Gemini 키로 예비 Groq를 부른다
        { engine: 'gemini', geminiKey: 'x', groqKey: process.env.GROQ_KEY }
      : { engine: 'local' }
  const rows: { text: string; want: string; got: string; ok: boolean; bad: string[]; ms: number; engine: string; reply: string }[] = []
  for (const c of CASES) {
    const t = Date.now()
    let r: AssistantResult
    try {
      r = await askAssistant(settings, { today: TODAY, text: c.text, context: { aliases: [], merchants: [], accounts: [] } })
    } catch (err) {
      rows.push({ text: c.text, want: KIND[c.kind], got: '에러', ok: false, bad: [String(err)], ms: Date.now() - t, engine: '-', reply: '' })
      continue
    }
    const bad = r.kind !== c.kind ? [`${KIND[r.kind]}(으)로 봄`] : (c.check?.(r) ?? [])
    rows.push({ text: c.text, want: KIND[c.kind], got: KIND[r.kind], ok: bad.length === 0, bad, ms: Date.now() - t, engine: r.engine, reply: r.reply })
    // 무료 등급 분당 한도에 걸리지 않게
    if (settings.engine !== 'local') await new Promise((ok) => setTimeout(ok, 4500))
  }
  const pass = rows.filter((r) => r.ok).length
  for (const r of rows) console.log(`${r.ok ? '✅' : '❌'} [${r.want}] ${r.text}  →  ${r.got} · ${r.engine} · ${(r.ms / 1000).toFixed(1)}초${r.bad.length ? `  | ${r.bad.join(', ')}` : ''}`)
  console.log(`\n맞음 ${pass}/${rows.length}`)
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows))
}

void main()
