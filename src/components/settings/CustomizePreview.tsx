import { Check, ListChecks, Plus, Wallet } from 'lucide-react'
import { useRef } from 'react'
import { useDraftStyles } from '../../hooks/useDraftStyles'
import type { Customization } from '../../lib/customize'
import Button from '../common/Button'
import Modal from '../common/Modal'

interface Props {
  open: boolean
  custom: Customization
  dirty: boolean
  onClose: () => void
  onApply: () => void
}

/** 미리보기: 꾸민 대로 대시보드가 어떻게 보일지 작은 화면으로 보여 준다 */
export default function CustomizePreview({ open, custom, dirty, onClose, onApply }: Props) {
  return (
    <Modal open={open} title="미리보기" onClose={onClose}>
      {open && <MiniApp custom={custom} />}
      <p className="mt-3 mb-4 text-center text-xs text-slate-500">{dirty ? '적용하기를 누르면 이대로 바뀌어요' : '지금 적용된 모습이에요'}</p>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          더 고치기
        </Button>
        <Button className="flex-1" onClick={onApply} disabled={!dirty}>
          적용하기
        </Button>
      </div>
    </Modal>
  )
}

function MiniApp({ custom }: { custom: Customization }) {
  const box = useRef<HTMLDivElement>(null)
  useDraftStyles(box, custom)
  return (
    <div
      ref={box}
      data-testid="customize-preview"
      className="theme-main mx-auto max-w-[320px] space-y-3 overflow-hidden rounded-[28px] bg-slate-100 bg-(image:--page-image) bg-cover bg-center p-4 ring-1 ring-slate-200"
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-logo text-lg font-black tracking-tight">TIDY:</span>
        <span className="text-xs text-slate-500">미리보기</span>
      </div>

      <div className="theme-money bg-grad on-grad rounded-3xl p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold">
          <span className="bg-on-soft flex size-7 items-center justify-center rounded-xl">
            <Wallet className="size-4" aria-hidden />
          </span>
          11월 가계부
        </div>
        <p className="text-xs opacity-80">이번 달 쓴 돈</p>
        <p className="text-2xl font-extrabold">82,750원</p>
      </div>

      <div className="theme-todo card overflow-hidden">
        <div className="bg-grad on-grad flex items-center gap-2 px-4 py-3 text-sm font-bold">
          <span className="bg-on-soft flex size-7 items-center justify-center rounded-xl">
            <ListChecks className="size-4" aria-hidden />
          </span>
          오늘 할 일 (1/3)
          <Plus className="ml-auto size-4" aria-hidden />
        </div>
        <ul className="divide-y divide-slate-100 px-4">
          {[
            ['운동 30분', true],
            ['장보기', false],
            ['책 반납하기', false],
          ].map(([title, done]) => (
            <li key={String(title)} className="flex items-center gap-3 py-2.5 text-sm">
              <span className={`flex size-5 items-center justify-center rounded-full ${done ? 'bg-check' : 'border-2 border-slate-300 bg-white'}`}>
                {done && <Check className="size-3" strokeWidth={3.5} aria-hidden />}
              </span>
              <span className={done ? 'text-slate-400 line-through' : 'font-medium text-slate-800'}>{title}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="theme-scrap card flex items-center gap-3 p-3">
        <span className="bg-grad on-grad flex size-9 items-center justify-center rounded-2xl text-xs font-bold">링크</span>
        <div className="min-w-0 text-sm">
          <p className="truncate font-semibold text-slate-800">부산 여행 코스</p>
          <p className="text-xs text-slate-400">example.com</p>
        </div>
      </div>
    </div>
  )
}
