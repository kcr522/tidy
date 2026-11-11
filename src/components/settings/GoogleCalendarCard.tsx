import { CalendarArrowDown, CalendarArrowUp, CalendarDays, Link2Off, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db } from '../../db/database'
import { agoLabel } from '../../lib/autoBackup'
import { buildIcs } from '../../lib/ical'
import { CalendarFetchError, disconnectGoogleCalendar, loadGoogleCal, normalizeIcsUrl, onGoogleCalChange, syncGoogleCalendar } from '../../platform/googleCalendar'
import { isNativeApp } from '../../platform/native'
import { saveTextFile } from '../../platform/saveFile'
import Button from '../common/Button'
import { inputClass } from '../common/formStyles'
import { useToast } from '../common/Toast'

/**
 * 설정 > 구글 캘린더
 * - 보내기: Tidy 일정과 할 일을 .ics 파일로 → 구글 캘린더에서 가져오기
 * - 불러오기: 구글 캘린더 "iCal 형식의 비공개 주소"를 넣으면 Tidy 캘린더에 같이 보여 준다 (구글 로그인 없이)
 */
export default function GoogleCalendarCard() {
  const toast = useToast()
  const [conn, setConn] = useState(loadGoogleCal)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [help, setHelp] = useState(false)
  useEffect(() => onGoogleCalChange(() => setConn(loadGoogleCal())), [])

  async function exportIcs() {
    setBusy(true)
    try {
      const [events, todos] = await Promise.all([db.events.toArray(), db.todos.toArray()])
      await saveTextFile('tidy-calendar.ics', buildIcs(events, todos), 'text/calendar')
      toast(isNativeApp() ? '구글 캘린더 앱을 고르면 일정이 들어가요' : '파일을 저장했어요. 구글 캘린더 › 설정 › 가져오기에 넣어 주세요')
    } catch {
      toast('파일을 만들지 못했어요', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function connect(target: string) {
    const clean = normalizeIcsUrl(target)
    if (!clean) return toast('https:// 로 시작하는 주소를 넣어 주세요', 'error')
    setBusy(true)
    try {
      const n = await syncGoogleCalendar(clean)
      setUrl('')
      toast(`구글 캘린더 일정 ${n}개를 가져왔어요`)
    } catch (err) {
      toast(err instanceof CalendarFetchError ? err.message : '가져오지 못했어요. 인터넷과 주소를 확인해 주세요', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    await disconnectGoogleCalendar()
    toast('연결을 끊고 가져온 일정을 지웠어요')
  }

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <CalendarDays className="size-5 text-brand-600" aria-hidden />
        <h2 className="font-bold">구글 캘린더</h2>
      </div>
      <p className="mb-4 text-sm break-keep text-slate-500">구글 로그인 없이, 파일과 비공개 주소로 주고받아요.</p>

      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="flex items-center gap-1.5 font-semibold text-slate-800">
          <CalendarArrowDown className="size-4" aria-hidden /> 구글 캘린더 일정을 Tidy에서 보기
        </p>
        {conn ? (
          <>
            <p className="mt-1 text-sm text-slate-600">
              연결됨 · 일정 {conn.count ?? 0}개 · 마지막 {agoLabel(conn.last, Date.now())}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">앱을 열 때 6시간마다 저절로 새로 가져와요. 파란색으로 보여요.</p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" className="min-h-10! flex-1 px-3! text-sm!" onClick={() => void connect(conn.url)} disabled={busy}>
                <RefreshCw className="size-4" aria-hidden /> 지금 새로 가져오기
              </Button>
              <Button variant="ghost" className="min-h-10! px-3! text-sm! text-expense" onClick={disconnect} disabled={busy}>
                <Link2Off className="size-4" aria-hidden /> 끊기
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm break-keep text-slate-600">구글 캘린더의 "iCal 형식의 비공개 주소"를 붙여 넣어요.</p>
            <div className="mt-2 flex gap-2">
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" className={inputClass()} aria-label="iCal 비공개 주소" inputMode="url" />
              <Button className="shrink-0 px-4!" onClick={() => void connect(url)} disabled={busy || !url.trim()}>
                연결
              </Button>
            </div>
            <button type="button" onClick={() => setHelp((v) => !v)} className="mt-2 text-xs font-semibold text-brand-600" aria-expanded={help}>
              주소는 어디서 찾나요?
            </button>
            {help && (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs break-keep text-slate-600">
                <li>컴퓨터 브라우저에서 calendar.google.com 을 열어요 (폰 앱에는 이 메뉴가 없어요)</li>
                <li>왼쪽 "내 캘린더"에서 캘린더 이름 옆 ⋮ › 설정 및 공유</li>
                <li>아래쪽 "캘린더 통합"의 "iCal 형식의 비공개 주소"를 복사해요</li>
                <li>여기에 붙여 넣고 연결을 눌러요. 이 주소는 다른 사람에게 알려 주지 마세요</li>
              </ol>
            )}
            {!isNativeApp() && <p className="mt-2 text-xs text-slate-400">웹에서는 구글이 막아서 연결이 안 될 수 있어요. 갤럭시 앱에서는 돼요.</p>}
          </>
        )}
      </div>

      <div className="mt-3 rounded-2xl bg-slate-50 p-4">
        <p className="flex items-center gap-1.5 font-semibold text-slate-800">
          <CalendarArrowUp className="size-4" aria-hidden /> Tidy 일정을 구글 캘린더에 넣기
        </p>
        <p className="mt-1 text-sm break-keep text-slate-600">일정과 마감일 있는 할 일을 파일 하나로 만들어요. {isNativeApp() ? '보내기 창에서 구글 캘린더를 고르면 들어가요.' : '구글 캘린더 › 설정 › 가져오기에 넣어요.'}</p>
        <Button variant="secondary" className="mt-3 min-h-10! w-full text-sm!" onClick={exportIcs} disabled={busy}>
          파일 만들기
        </Button>
      </div>
    </section>
  )
}
