/** 결제 수단 추천 목록 (입력 칸 자동 완성) */
export const ACCOUNT_PRESETS = [
  '현금',
  '토스',
  '카카오페이',
  '네이버페이',
  '삼성페이',
  '애플페이',
  '페이코',
  '토스뱅크',
  '카카오뱅크',
  '신한카드',
  'KB국민카드',
  '삼성카드',
  '현대카드',
  '우리카드',
  '하나카드',
  '롯데카드',
  'NH농협카드',
  'BC카드',
] as const

export const MAX_ACCOUNT_LENGTH = 30

/** 결제 수단 그림 */
export function accountEmoji(account: string): string {
  if (account === '현금') return '💵'
  if (/페이|pay|토스$|^토스$/i.test(account)) return '📱'
  if (/카드|card/i.test(account)) return '💳'
  if (/은행|뱅크|bank|계좌|통장/i.test(account)) return '🏦'
  if (account === '미지정') return '❔'
  return '👛'
}
