import type { MealGuess } from '../ai/meal'
import { MAX_MEMO_LENGTH } from '../validate'

/** 가게 이름 · 음식 이름 → 가계부 메모 */
export function mealMemo(place: string, dish: string): string {
  const p = place.trim()
  const d = dish.trim()
  return (p && d ? `${p} · ${d}` : p || d || '외식').slice(0, MAX_MEMO_LENGTH)
}

/** 가격을 물어볼 기본값: 메뉴판 가격 × 그릇 수, 없으면 짐작 가격 */
export function suggestedAmount(g: MealGuess): number | null {
  const unit = g.price ?? g.guessPrice
  return unit === null ? null : unit * g.servings
}
