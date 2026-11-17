import { ShieldCheck } from 'lucide-react'
import { openPayNotifySettings } from '../../platform/payNotify'
import Button from '../common/Button'

/** 결제 알림 읽기 권한 안내: 무엇을 읽는지, 켜는 순서, 막힐 때 (설정 카드와 가계부 화면에서 같이 쓴다) */
export default function PayNotifyGuide({ granted }: { granted: boolean | null }) {
  return (
    <div className="text-sm break-keep text-slate-600">
      <div className="flex items-start gap-2.5 rounded-2xl bg-brand-50 p-3.5 text-brand-700">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p>
          카드사·은행·삼성 월렛·간편결제 앱 알림과 <b>카드 결제 문자</b>만 읽어요. 카톡 대화나 다른 앱 알림은 읽지 않고, 읽은 글은 이 폰 밖으로 보내지 않아요. AI도 쓰지 않아요.
        </p>
      </div>

      {!granted && (
        <>
          <ol className="mt-4 space-y-3">
            <Step n={1} title="아래 '알림 접근 허용하러 가기'를 눌러요" />
            <Step n={2} title="'Tidy 결제 알림 기록'을 켜요">경고 창이 뜨면 &lsquo;허용&rsquo;을 눌러요. 다른 앱 알림을 읽을 수 있다는 안드로이드 기본 안내예요.</Step>
            <Step n={3} title="뒤로 가기로 Tidy에 돌아오면 끝">
              카드로 결제하면 <b>&lsquo;가계부에 기록할까요?&rsquo;</b> 알림이 떠요. 누르면 가게·금액·카테고리를 채운 확인 화면이 열리고, 맞는 것만 저장해요.
            </Step>
          </ol>

          <details className="mt-4 rounded-2xl bg-slate-50 p-3.5 text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold text-slate-600">스위치가 회색이라 켜지지 않으면</summary>
            <p className="mt-2">
              스토어가 아닌 APK로 설치한 앱은 안드로이드 13부터 이 권한이 잠겨 있어요. 폰 <b>설정 → 애플리케이션 → Tidy → 오른쪽 위 ⋮ → 제한된 설정 허용</b>을 누른 뒤 다시 1번부터 해 주세요.
            </p>
          </details>
        </>
      )}

      {granted ? (
        <p className="mt-4 rounded-2xl bg-emerald-50 px-3.5 py-3 text-center font-semibold text-emerald-700">✅ 켜져 있어요. 결제 알림을 기다리는 중이에요</p>
      ) : (
        <Button className="mt-4 w-full" onClick={() => void openPayNotifySettings()}>
          알림 접근 허용하러 가기
        </Button>
      )}
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="bg-grad on-grad flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">{n}</span>
      <div>
        <p className="font-semibold text-slate-800">{title}</p>
        {children && <p className="mt-0.5 text-xs text-slate-500">{children}</p>}
      </div>
    </li>
  )
}
