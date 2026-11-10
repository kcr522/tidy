import type { EventDraft, PaymentDraft } from './learn'
import { greeting, HELP } from './greetings'

/** "등록할까요?" 카드에 들어가는 것 */
export type Proposal =
  | { kind: 'event'; items: EventDraft[] }
  | { kind: 'payment'; items: PaymentDraft[] }
  | { kind: 'diary'; date: string; text: string; photo?: string; hasEntry: boolean }

export type Choice = 'yes' | 'no' | 'self'

export type ChatMessage =
  | { id: number; from: 'ai'; text: string }
  | { id: number; from: 'me'; text?: string; photo?: string }
  | { id: number; from: 'ai'; text: string; proposal: Proposal; choice?: Choice }

export const CHOICE_LABEL: Record<Choice, string> = { yes: '응', no: '아니', self: '내가 등록할게' }

let nextId = 1
export const msgId = () => nextId++

export function firstMessages(): ChatMessage[] {
  return [
    { id: msgId(), from: 'ai', text: greeting() },
    { id: msgId(), from: 'ai', text: HELP },
  ]
}

