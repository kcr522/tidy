import { BookmarkPlus, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useAskCapture, useAutoCapture } from '../../lib/scrap/settings'
import { EVERY_OPTIONS, useResurfaceSettings } from '../../lib/scrap/resurface'
import { requestAlarmPermission } from '../../platform/alarms'
import { useToast } from '../common/Toast'
import InstagramImportDialog from '../bookmarks/InstagramImportDialog'

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-grad' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

/** 설정 > 스크랩: 사이트 자동 캡처, 캡처 같이 저장 묻기, 안 본 스크랩 다시 보기, 공유받기 안내 */
export default function ScrapSettingsSection() {
  const [back, setBack] = useResurfaceSettings()
  const toast = useToast()
  async function toggleNotify() {
    if (back.notify) return setBack({ ...back, notify: false })
    const p = await requestAlarmPermission()
    if (p === 'denied' || p === 'unsupported') {
      toast(p === 'denied' ? '알림이 꺼져 있어요. 폰 설정에서 Tidy 알림을 허용해 주세요' : '이 브라우저는 알림을 못 띄워요', 'error')
      return
    }
    setBack({ ...back, notify: true })
    toast('안 본 스크랩을 알려 드릴게요')
  }
  const [auto, setAuto] = useAutoCapture()
  const [ask, setAsk] = useAskCapture()
  const [importing, setImporting] = useState(false)
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
      <label className="flex min-h-16 items-center gap-3 border-t border-slate-100 px-5 py-3">
        <span className="flex-1">
          <span className="block text-[15px] font-semibold text-slate-800">안 본 스크랩 다시 보여 주기</span>
          <span className="block text-xs text-slate-500">저장하고 3일 넘게 안 연 스크랩을 하루 하나씩 대시보드 · 스크랩 화면 맨 위에 꺼내 줘요</span>
        </span>
        <Switch on={back.card} onToggle={() => setBack({ ...back, card: !back.card })} />
      </label>
      <label className="flex min-h-16 items-center gap-3 border-t border-slate-100 px-5 py-3">
        <span className="flex-1">
          <span className="block text-[15px] font-semibold text-slate-800">알림으로도 알려 주기</span>
          <span className="block text-xs text-slate-500">정한 날 정한 시각에 “저장해 두고 안 본 스크랩이 있어요” 알림. 누르면 그 스크랩이 열려요</span>
        </span>
        <Switch on={back.notify} onToggle={() => void toggleNotify()} />
      </label>
      {back.notify && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
          <div className="flex gap-1 rounded-full bg-slate-100 p-1" role="radiogroup" aria-label="알림 주기">
            {EVERY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={back.every === o.value}
                onClick={() => setBack({ ...back, every: o.value })}
                className={`tap rounded-full px-3 py-1.5 text-xs font-bold ${back.every === o.value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <input
            type="time"
            value={back.time}
            onChange={(e) => e.target.value && setBack({ ...back, time: e.target.value })}
            aria-label="알림 시각"
            className="min-h-9 rounded-full bg-slate-100 px-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}
      <button type="button" onClick={() => setImporting(true)} className="tap flex min-h-16 w-full items-center gap-3 border-t border-slate-100 px-5 py-3 text-left">
        <BookmarkPlus className="size-5 shrink-0 text-pink-500" aria-hidden />
        <span className="flex-1">
          <span className="block text-[15px] font-semibold text-slate-800">인스타 저장 목록 가져오기</span>
          <span className="block text-xs text-slate-500">인스타에서 저장(북마크)한 게시물을 한꺼번에 스크랩으로 넣어요. 컬렉션은 카테고리로</span>
        </span>
        <ChevronRight className="size-4 text-slate-400" aria-hidden />
      </button>
      <InstagramImportDialog open={importing} onClose={() => setImporting(false)} />
      <p className="border-t border-slate-100 px-5 py-4 text-xs leading-relaxed text-slate-500">
        인스타그램·네이버·X에서 <b>공유 → Tidy에 스크랩</b>을 누르면 바로 저장 창이 열려요. 안드로이드 앱을 깔았으면 공유 목록에 Tidy가 떠요(처음엔 목록 맨 끝 “더보기”에 있을 수 있어요). 웹만 쓸 때는 안드로이드 크롬에서 Tidy를 “홈 화면에 추가(앱 설치)” 해 두면 떠요. 아이폰은 아직 안 돼요. 링크를 복사해서 붙여 넣으면 돼요.
      </p>
    </section>
  )
}
