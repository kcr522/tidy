import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../src/db/types'
import { cleanStoredMemo, memoFixes } from '../../src/lib/memoCleanup'

describe('예전 자동 기록 이름 정리 (출금처만)', () => {
  it.each([
    ['가맹점 GS25 운남점', 'GS25 운남점'],
    ['가맹점: GS25 운남점', 'GS25 운남점'],
    ['(주)올리브영', '올리브영'],
    ['㈜다이소', '다이소'],
    ['다이소 운남점 ( 1234)', '다이소 운남점'],
    ['다이소 운남점 (KB국민체크 1234)', '다이소 운남점'],
    ['쿠팡이츠에서', '쿠팡이츠'],
    ['받는 분 홍길동', '홍길동'],
    ['(주)타이디 급여', '타이디 급여'],
  ])('알림에서 온 "%s" 는 군더더기를 걷어 "%s" 로 바꾼다', (stored, cleaned) => {
    expect(cleanStoredMemo(stored)).toBe(cleaned)
  })

  it.each(['스타벅스', '엄마 생일 선물', '커피 (2잔)', '점심 김밥', '운남 다이소', '친구랑 밥 먹었어요', '월세'])('사용자가 쓴 메모 "%s" 는 그대로 둔다', (memo) => {
    expect(cleanStoredMemo(memo)).toBeNull()
  })

  it('걷어 내고 이름이 하나도 안 남으면 그대로 둔다', () => {
    expect(cleanStoredMemo('가 완료되었습니다')).toBeNull()
  })

  it('직접 알려 준 이름 · 가게 이름 기억 · 정기 내역은 건드리지 않는다', () => {
    const row = (id: number, memo: string, extra: Partial<Transaction> = {}): Transaction => ({ id, type: 'EXPENSE', amount: 1000, category: '식비', date: '2026-11-20', memo, createdAt: '', updatedAt: '', ...extra })
    const list = [row(1, '(주)올리브영'), row(2, '(주)올리브영', { originalMemo: 'KCP*결제' }), row(3, '㈜다이소'), row(4, '(주)타이디', { recurringId: 1 })]
    const rememberedNames = new Set(['다이소'])

    expect(memoFixes(list, rememberedNames)).toEqual([{ id: 1, memo: '올리브영' }])
  })
})
