import { Check } from 'lucide-react'

/** 오늘 했어요 체크 (크고 둥근 버튼) */
export default function HabitCheckButton({ done, label, onClick, size = 'lg' }: { done: boolean; label: string; onClick: () => void; size?: 'lg' | 'sm' }) {
  const box = size === 'lg' ? 'size-11' : 'size-8'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={`${label} ${done ? '오늘 한 것 취소' : '오늘 했어요'}`}
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center rounded-full transition-all active:scale-90 ${box} ${
        done ? 'bg-grad on-grad shadow-float' : 'border-2 border-dashed border-slate-300 bg-white text-slate-300 hover:border-slate-400'
      }`}
    >
      <Check className={size === 'lg' ? 'size-5' : 'size-4'} strokeWidth={3.2} aria-hidden />
    </button>
  )
}
