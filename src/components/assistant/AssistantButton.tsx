import { Sparkles } from 'lucide-react'
import { useCallback, useState } from 'react'
import { firstMessages, type ChatMessage } from '../../lib/assistant/chat'
import AssistantChat from './AssistantChat'

/** 첫 화면 오른쪽 아래에 떠 있는 작은 동그라미: 누르면 AI 대화창이 열린다 */
export default function AssistantButton() {
  const [open, setOpen] = useState(false)
  // 대화는 앱을 켜 둔 동안 남아 있다 (닫았다 열어도 이어서)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!messages.length) setMessages(firstMessages())
          setOpen(true)
        }}
        className="bg-grad on-grad fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full shadow-float transition active:scale-95 short:bottom-[calc(3.75rem+env(safe-area-inset-bottom))] short:size-12 md:right-8 md:bottom-8 short:md:bottom-4"
        aria-label="AI 비서 열기"
        title="AI 비서"
      >
        <Sparkles className="size-6" strokeWidth={2.2} aria-hidden />
      </button>
      {open && <AssistantChat messages={messages} setMessages={setMessages} onClose={close} />}
    </>
  )
}
