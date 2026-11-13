import { budgetRepo } from '../../repositories/budgetRepo'
import { diaryRepo } from '../../repositories/diaryRepo'
import { eventRepo } from '../../repositories/eventRepo'
import { recurringRepo } from '../../repositories/recurringRepo'
import { savingsRepo } from '../../repositories/savingsRepo'
import { todoRepo } from '../../repositories/todoRepo'
import { transactionRepo } from '../../repositories/transactionRepo'
import { holidaysBetween } from '../holidays'
import { answerQuick, detectQuick, type QuickData, type QuickIntent } from './quickAnswer'

/** 질문에 필요한 기록만 기기에서 읽는다 */
export async function loadQuickData(q: QuickIntent): Promise<QuickData> {
  switch (q.kind) {
    case 'schedule': {
      const [events, todos, recurring, savings] = await Promise.all([eventRepo.listBetween(q.from, q.to), todoRepo.listAll(), recurringRepo.list(), savingsRepo.list()])
      return { events, todos, recurring, savings, holidays: holidaysBetween(q.from, q.to) }
    }
    case 'spending':
      return { transactions: await transactionRepo.listAll() }
    case 'budget': {
      const [budgets, transactions] = await Promise.all([budgetRepo.list(), transactionRepo.listAll()])
      return { budgets, transactions }
    }
    case 'savings':
      return { savings: await savingsRepo.list() }
    case 'recurring':
      return { recurring: await recurringRepo.list() }
    case 'diary':
      return { diary: (await diaryRepo.get(q.date)) ?? null }
  }
}

/** 기록으로 답할 수 있으면 답, 아니면 null (그때는 AI 에게) */
export async function quickReply(text: string, today: string): Promise<string | null> {
  const q = detectQuick(text, today)
  if (!q) return null
  try {
    return answerQuick(q, await loadQuickData(q), today, text)
  } catch {
    return null
  }
}
