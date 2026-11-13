import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLastAiUsage, usageLine } from '../../lib/ai/usage'

/** Tidy AI 를 한 번 쓸 때마다 화면 위에 "오늘 몇 번 남았는지, 이번에 토큰 몇 개 썼는지"를 잠깐 보여 준다 */
export default function AiUsageNotice() {
  const last = useLastAiUsage()
  const [shownAt, setShownAt] = useState(0)

  useEffect(() => {
    if (!last) return
    const id = setTimeout(() => setShownAt(last.at), 4500)
    return () => clearTimeout(id)
  }, [last])

  if (!last || shownAt === last.at) return null
  const u = last.usage
  const low = u.remaining <= Math.max(3, Math.floor(u.limit * 0.1))
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[58] flex justify-center px-4">
      <div
        role="status"
        className={`flex max-w-full items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-[#fff] shadow-lg backdrop-blur ${low ? 'bg-expense/95' : 'bg-[#191f28]/90 dark:bg-[#3a404b]/95'}`}
      >
        <Sparkles className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">
          Tidy AI · {usageLine(u)}
          {u.provider === 'groq' && ' (예비 AI)'}
        </span>
      </div>
    </div>
  )
}
