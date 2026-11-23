import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../src/db/types'
import { cleanStoredMemo, memoFixes } from '../../src/lib/memoCleanup'

describe('예전 자동 기록 이름 정리 (출금처만)', () => {
  it('알림에서 온 군더더기는 걷는다', () => {
    expect(cleanStoredMemo('가맹점 GS25 운남점')).toBe('GS25 운남점')
    expect(cleanStoredMemo('가맹점: GS25 운남점')).toBe('GS25 운남점')
    expect(cleanStoredMemo('(주)올리브영')).toBe('올리브영')
    expect(cleanStoredMemo('㈜다이소')).toBe('다이소')
    expect(cleanStoredMemo('다이소 운남점 ( 1234)')).toBe('다이소 운남점')
    expect(cleanStoredMemo('다이소 운남점 (KB국민체크 1234)')).toBe('다이소 운남점')
    expect(cleanStoredMemo('쿠팡이츠에서')).toBe('쿠팡이츠')
    expect(cleanStoredMemo('받는 분 홍길동')).toBe('홍길동')
    expect(cleanStoredMemo('(주)타이디 급여')).toBe('타이디 급여')
  })
  it('사용자가 쓴 메모는 그대로', () => {
    for (const m of ['스타벅스', '엄마 생일 선물', '커피 (2잔)', '점심 김밥', '운남 다이소', '친구랑 밥 먹었어요', '월세']) expect(cleanStoredMemo(m)).toBeNull()
  })
  it('이름이 하나도 안 남으면 그대로 둔다', () => {
    expect(cleanStoredMemo('가 완료되었습니다')).toBeNull()
  })
  it('직접 알려 준 이름 · 가게 이름 기억 · 정기 내역 · 적금은 건드리지 않는다', () => {
    const t = (id: number, memo: string, extra: Partial<Transaction> = {}): Transaction => ({ id, type: 'EXPENSE', amount: 1000, category: '식비', date: '2026-11-20', memo, createdAt: '', updatedAt: '', ...extra })
    const list = [t(1, '(주)올리브영'), t(2, '(주)올리브영', { originalMemo: 'KCP*결제' }), t(3, '㈜다이소'), t(4, '(주)타이디', { recurringId: 1 })]
    expect(memoFixes(list, new Set(['㈜다이소'.replace('㈜', '')]))).toEqual([{ id: 1, memo: '올리브영' }])
  })
})
