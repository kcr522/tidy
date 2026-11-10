import type { ReactNode } from 'react'

/** 라벨 + 입력 칸 + 오류 안내 */
export default function FormField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-expense">{error}</span>}
    </label>
  )
}
