// 가계부 그림을 이모티콘 대신 테두리만 있는 아이콘으로 (사용자 요청 2026-11-23)
import { Baby, Banknote, Beer, BookOpen, Briefcase, Bus, Car, CircleHelp, Clapperboard, Coffee, CreditCard, Dumbbell, Fuel, Gamepad2, Gift, GraduationCap, Heart, House, Landmark, Music, Package, PawPrint, Pill, PiggyBank, Plane, Receipt, Scissors, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Star, Stethoscope, TrainFront, TrendingUp, Users, Utensils, Wallet, Wifi, Zap, type LucideIcon } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import type { PayMethod, PayMethodKind, TransactionType } from '../../db/types'
import { categorySnapshot, DEFAULT_CATEGORY_ICON, findCategory, subscribeCategories, type CategoryItem } from '../../lib/categories'
import { methodEmoji, PAY_KIND_EMOJI } from '../../lib/payMethods'

/** 카테고리에 고를 수 있는 아이콘 (저장할 때는 이름만 적는다) */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  beer: Beer,
  cart: ShoppingCart,
  bag: ShoppingBag,
  shirt: Shirt,
  scissors: Scissors,
  train: TrainFront,
  bus: Bus,
  car: Car,
  fuel: Fuel,
  plane: Plane,
  house: House,
  phone: Smartphone,
  wifi: Wifi,
  zap: Zap,
  pill: Pill,
  doctor: Stethoscope,
  gym: Dumbbell,
  book: BookOpen,
  school: GraduationCap,
  clapper: Clapperboard,
  game: Gamepad2,
  music: Music,
  pet: PawPrint,
  baby: Baby,
  users: Users,
  heart: Heart,
  gift: Gift,
  sparkles: Sparkles,
  star: Star,
  banknote: Banknote,
  wallet: Wallet,
  bank: Landmark,
  piggy: PiggyBank,
  work: Briefcase,
  invest: TrendingUp,
  receipt: Receipt,
  package: Package,
}

/** 카테고리 목록이 바뀌면 다시 그린다 (만들기 · 이름 바꾸기 · 지우기 · 다른 기기에서 받기) */
export function useCategories(type: TransactionType): CategoryItem[] {
  return useSyncExternalStore(subscribeCategories, categorySnapshot)[type]
}

/** 결제 수단 그림 (lib의 이모티콘 → 아이콘) */
const PAY_ICON: Record<string, LucideIcon> = { '💵': Banknote, '📱': Smartphone, '💳': CreditCard, '🏦': Landmark, '❔': CircleHelp, '👛': Wallet }

const INLINE = 'inline size-[1.1em] -mt-0.5 shrink-0 align-middle'

export function categoryIcon(category: string): LucideIcon {
  const key = findCategory(category)?.icon ?? DEFAULT_CATEGORY_ICON[category]
  return (key && CATEGORY_ICONS[key]) || Package
}

/** 글자 옆에 붙는 카테고리 아이콘 (글자 크기를 따라감) */
export function CategoryIcon({ category, className = INLINE }: { category: string; className?: string }) {
  useSyncExternalStore(subscribeCategories, categorySnapshot)
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
