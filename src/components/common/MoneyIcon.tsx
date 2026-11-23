// 가계부 그림을 이모티콘 대신 테두리만 있는 아이콘으로 (사용자 요청 2026-11-23)
import { Banknote, BookOpen, CircleHelp, Clapperboard, CreditCard, Gift, House, Landmark, Package, Pill, PiggyBank, ShoppingBag, Smartphone, Sparkles, TrainFront, Utensils, Wallet, type LucideIcon } from 'lucide-react'
import type { PayMethod, PayMethodKind } from '../../db/types'
import { methodEmoji, PAY_KIND_EMOJI } from '../../lib/payMethods'

const CATEGORY_ICON: Record<string, LucideIcon> = {
  식비: Utensils,
  교통: TrainFront,
  쇼핑: ShoppingBag,
  '문화/여가': Clapperboard,
  '주거/통신': House,
  '의료/건강': Pill,
  교육: BookOpen,
  저축: PiggyBank,
  월급: Banknote,
  용돈: Gift,
  부수입: Sparkles,
  기타: Package,
}

/** 결제 수단 그림 (lib의 이모티콘 → 아이콘) */
const PAY_ICON: Record<string, LucideIcon> = { '💵': Banknote, '📱': Smartphone, '💳': CreditCard, '🏦': Landmark, '❔': CircleHelp, '👛': Wallet }

const INLINE = 'inline size-[1.1em] -mt-0.5 shrink-0 align-middle'

export function categoryIcon(category: string): LucideIcon {
  return CATEGORY_ICON[category] ?? Package
}

/** 글자 옆에 붙는 카테고리 아이콘 (글자 크기를 따라감) */
export function CategoryIcon({ category, className = INLINE }: { category: string; className?: string }) {
  const Icon = categoryIcon(category)
  return <Icon className={className} strokeWidth={2} aria-hidden />
}

/** 글자 옆에 붙는 결제 수단 아이콘: 등록한 카드 · 계좌면 그 종류로, 아니면 이름으로 짐작 */
export function MethodIcon({ name, methods, className = INLINE }: { name: string; methods?: PayMethod[]; className?: string }) {
  const Icon = PAY_ICON[methodEmoji(name, methods)] ?? Wallet
  return <Icon className={className} strokeWidth={2} aria-hidden />
}

export function PayKindIcon({ kind, className = INLINE }: { kind: PayMethodKind; className?: string }) {
  const Icon = PAY_ICON[PAY_KIND_EMOJI[kind]] ?? Wallet
  return <Icon className={className} strokeWidth={2} aria-hidden />
}
