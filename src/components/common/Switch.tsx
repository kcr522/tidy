/** 켜고 끄는 스위치 */
export default function Switch({ on, disabled, onClick, label }: { on: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${on ? 'bg-grad' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}
