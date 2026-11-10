/** 입력 칸 공통 스타일 */
export function inputClass(invalid = false) {
  return `w-full min-h-11 rounded-lg border bg-white px-3 text-base outline-none focus:ring-2 focus:ring-brand-500 ${
    invalid ? 'border-expense' : 'border-slate-300'
  }`
}
