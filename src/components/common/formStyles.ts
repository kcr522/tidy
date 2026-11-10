/** 입력 칸 공통 스타일: 회색 바탕, 둥근 모서리, 누르면 흰 바탕 + 핑크 테두리 */
export function inputClass(invalid = false) {
  return `w-full min-h-12 rounded-2xl border-0 bg-slate-100 px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 ${
    invalid ? 'ring-2 ring-expense focus:ring-expense' : 'focus:ring-brand-500'
  }`
}
