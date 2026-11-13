import { useAskCapture, useAutoCapture } from '../../lib/scrap/settings'

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-grad' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

/** 설정 > 스크랩: 사이트 자동 캡처, 캡처 같이 저장 묻기, 공유받기 안내 */
export default function ScrapSettingsSection() {
  const [auto, setAuto] = useAutoCapture()
  const [ask, setAsk] = useAskCapture()
  return (
    <section className="card overflow-hidden">
      <h2 className="px-5 pt-5 pb-1 font-bold">스크랩</h2>
      <label className="flex min-h-16 items-center gap-3 px-5 py-3">
        <span className="flex-1">
          <span className="block text-[15px] font-semibold text-slate-800">사이트 화면 자동 캡처</span>
          <span className="block text-xs text-slate-500">새 링크를 저장하면 사이트 화면을 저절로 찍어 같이 저장해요. 글이 지워져도 남아요</span>
        </span>
        <Switch on={auto} onToggle={() => setAuto(!auto)} />
      </label>
      {!auto && (
        <label className="flex min-h-16 items-center gap-3 border-t border-slate-100 px-5 py-3">
          <span className="flex-1">
            <span className="block text-[15px] font-semibold text-slate-800">캡처본도 같이 저장할지 묻기</span>
            <span className="block text-xs text-slate-500">새 링크를 저장하면 “캡처본도 같이 저장할까요?” 창을 띄워요</span>
          </span>
          <Switch on={ask} onToggle={() => setAsk(!ask)} />
        </label>
      )}
      <p className="border-t border-slate-100 px-5 py-4 text-xs leading-relaxed text-slate-500">
        인스타그램·네이버·X에서 <b>공유 → Tidy</b>로 바로 보내려면: 안드로이드 크롬에서 Tidy를 “홈 화면에 추가(앱 설치)” 해 두세요. 아이폰은 폰 앱을 만들 때 공유 기능을 따로 붙여야 해요. 그 전에는 링크를 복사해서 붙여 넣으면 돼요.
      </p>
    </section>
  )
}
