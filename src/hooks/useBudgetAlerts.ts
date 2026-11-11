import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { budgetStatus, newAlerts } from '../lib/budget'
import { budgetRepo } from '../repositories/budgetRepo'
import { transactionRepo } from '../repositories/transactionRepo'

const KEY = 'tidy-budget-alerts'

function loadSent(ym: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { ym?: string; sent?: string[] } | null
    return v?.ym === ym && Array.isArray(v.sent) ? v.sent : []
  } catch {
    return []
  }
}

/** 이번 달 예산의 80%를 쓰거나 넘으면 한 번씩 알려 준다 (달마다 새로) */
export function useBudgetAlerts(today: string, notify: (text: string) => void) {
  const [year, month] = today.split('-').map(Number)
  const budgets = useLiveQuery(() => budgetRepo.list(), [])
  const items = useLiveQuery(() => transactionRepo.listByMonth(year, month), [year, month])

  useEffect(() => {
    if (!budgets || !items || budgets.length === 0) return
    const ym = today.slice(0, 7)
    const sent = loadSent(ym)
    const alerts = newAlerts(budgetStatus(budgets, items, ym, today), sent)
    if (alerts.length === 0) return
    alerts.forEach((a) => notify(a.text))
    try {
      localStorage.setItem(KEY, JSON.stringify({ ym, sent: [...sent, ...alerts.map((a) => a.key)] }))
    } catch {
      // 저장 못 해도 다음에 한 번 더 알려 줄 뿐
    }
  }, [budgets, items, today, notify])
}
