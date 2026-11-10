import type { FeedbackMode, SpendingSnapshot } from './prompts'

// AI 연결 없이 기기 안에서 만드는 한마디. 연결 방법을 정하기 전이나 인터넷이 없을 때 쓴다.

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

/** 날짜와 금액으로 문장을 고른다: 같은 날 같은 내역이면 같은 말 */
function pick<T>(list: T[], seed: string): T {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return list[h % list.length]
}

export function localFeedback(mode: FeedbackMode, s: SpendingSnapshot): string {
  const seed = `${s.date}:${s.todayTotal}:${mode}`
  const top = [...s.items].sort((a, b) => b.amount - a.amount)[0]
  const avg = s.dailyAverage
  const diff = avg === null ? null : s.todayTotal - avg
  const compare =
    diff === null || avg === 0
      ? ''
      : diff > 0
        ? `하루 평균보다 ${won(diff)} 더 썼어.`
        : diff < 0
          ? `하루 평균보다 ${won(-diff)} 덜 썼어.`
          : '딱 하루 평균만큼 썼어.'

  if (s.todayTotal === 0) {
    return pick(
      {
        feedback: ['오늘은 지출이 없어! 무지출 하루는 생각보다 어려운데 해냈네 👍 내일도 꼭 필요한 것만 사 보자.', '오늘 쓴 돈 0원. 기록을 빼먹은 게 아니라면 완벽한 하루야 ✨'],
        saver: ['오늘 0원? …흠, 인정. 이번만 봐준다 😤 내일도 이렇게만 하자.', '무지출이라니 잔소리할 게 없잖아. 아쉽지만 칭찬할게 😤'],
        cheer: ['무지출 데이라니 너 진짜 대단해!! 🥰 지갑도 쉬는 날이 필요하지!', '오늘 0원이라니 절약 천재 아니야? 🥰 너무 멋져!'],
      }[mode],
      seed,
    )
  }

  const topText = top ? `${top.name} ${won(top.amount)}` : ''
  switch (mode) {
    case 'feedback':
      return [
        `오늘은 ${won(s.todayTotal)} 썼어. ${compare}`,
        top && s.items.length > 1 ? `제일 큰 건 ${topText}이야.` : '',
        diff !== null && diff > 0 ? '내일은 하나만 줄여 보면 평균으로 돌아올 거야 🧐' : '이 페이스 좋다, 이대로만 가자 🧐',
      ]
        .filter(Boolean)
        .join(' ')
    case 'saver':
      return [
        top ? `${topText}… 이거 진짜 꼭 필요했어? 😤` : `오늘 ${won(s.todayTotal)}이나 썼네? 😤`,
        compare,
        top ? `그거 참았으면 ${won(top.amount)} 그대로 남았잖아. 내일은 지갑 닫자!` : '내일은 지갑 닫자!',
      ]
        .filter(Boolean)
        .join(' ')
    case 'cheer':
      return [
        top ? `${top.name}에 쓴 건 완전 잘한 선택이야! 🥰` : '오늘도 멋지게 썼다! 🥰',
        `오늘 ${won(s.todayTotal)}, 다 너를 위한 투자지.`,
        pick(['열심히 산 너, 그럴 자격 충분해 ✨', '행복해졌으면 그걸로 된 거야 ✨', '오늘의 너 칭찬해 ✨'], seed),
      ].join(' ')
  }
}
