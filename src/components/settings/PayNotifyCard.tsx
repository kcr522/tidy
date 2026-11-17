import { BellRing } from 'lucide-react'
import { useState } from 'react'
import { usePayNotify } from '../../hooks/usePayNotify'
import { setPayNotifyAlert } from '../../platform/payNotify'
import PayFilterEditor from '../payNotify/PayFilterEditor'
import PayNotifyGuide from '../payNotify/PayNotifyGuide'

/** 설정 > 결제 알림으로 가계부 기록 (갤럭시 앱만): 권한 상태, 켜는 방법, "기록할까요?" 알림 켜고 끄기 */
export default function PayNotifyCard() {
  const pay = usePayNotify()
  const [alertOn, setAlertOn] = useState<boolean | null>(null)
  const alert = alertOn ?? pay.alert

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <BellRing className="size-5 text-brand-600" aria-hidden />
        <h2 className="flex-1 font-bold">결제 알림으로 가계부 기록</h2>
        {pay.available && pay.granted !== null && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pay.granted ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{pay.granted ? '켜짐' : '꺼짐'}</span>
        )}
      </div>
      <p className="mb-4 text-sm break-keep text-slate-500">카드로 결제하면 알림을 읽어 가계부에 넣을 내역을 만들어 둬요. 확인하고 저장할 때만 기록돼요.</p>

      {pay.available ? (
        <>
          <PayNotifyGuide granted={pay.granted} />
          {pay.granted && (
            <label className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
              <span className="flex-1 text-sm">
                <span className="block font-semibold text-slate-800">&lsquo;가계부에 기록할까요?&rsquo; 알림</span>
                <span className="block text-xs text-slate-500">끄면 알림 없이 가계부 화면 위에만 모여 있어요</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={alert}
                aria-label="가계부에 기록할까요? 알림"
                onClick={() => {
                  setAlertOn(!alert)
                  void setPayNotifyAlert(!alert)
                }}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${alert ? 'bg-grad' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition ${alert ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </label>
          )}
          <PayFilterEditor />
        </>
      ) : (
        <p className="text-center text-xs text-slate-400">갤럭시(안드로이드) 앱에서 쓸 수 있어요. 웹과 아이폰은 다른 앱 알림을 읽을 수 없어요.</p>
      )}
    </section>
  )
}
