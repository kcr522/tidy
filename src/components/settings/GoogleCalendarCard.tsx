import { CalendarArrowDown, CalendarDays, Check, Link2Off, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db } from '../../db/database'
import type { EventColor } from '../../db/types'
import { agoLabel } from '../../lib/autoBackup'
import { EVENT_COLORS } from '../../lib/eventLayout'
import { buildIcs } from '../../lib/ical'
import {
  addGoogleCalendar,
  CalendarFetchError,
  disconnectGoogleCalendar,
  type GoogleCal,
  loadGoogleCals,
  MAX_CALS,
  nextColor,
  normalizeIcsUrl,
  onGoogleCalChange,
  renameGoogleCal,
  setGoogleCalColor,
  syncGoogleCalendar,
} from '../../platform/googleCalendar'
import { isNativeApp } from '../../platform/native'
import { saveTextFile } from '../../platform/saveFile'
import Button from '../common/Button'
import GooglePushSection from './GooglePushSection'
import { inputClass } from '../common/formStyles'
import { useToast } from '../common/Toast'

/**
 * 설정 > 구글 캘린더
 * - 보내기: 구글 계정을 연결하면 Tidy 일정과 할 일을 구글의 "Tidy" 캘린더에 저절로 넣는다 (GooglePushSection). 파일(.ics)로 한 번 넣을 수도 있다
 * - 불러오기: 구글 캘린더 "iCal 형식의 비공개 주소"를 넣으면 Tidy 캘린더에 같이 보여 준다 (구글 로그인 없이)
 */
export default function GoogleCalendarCard() {
  const toast = useToast()
  const [cals, setCals] = useState(loadGoogleCals)
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [color, setColor] = useState<EventColor>(() => nextColor(loadGoogleCals().map((c) => c.color)))
  const [busy, setBusy] = useState(false)
  const [help, setHelp] = useState(false)
  useEffect(() => onGoogleCalChange(() => setCals(loadGoogleCals())), [])
  const showForm = cals.length === 0 || adding

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

  function fail(err: unknown) {
    toast(err instanceof CalendarFetchError ? err.message : '가져오지 못했어요. 인터넷과 주소를 확인해 주세요', 'error')
  }

  async function add() {
    const clean = normalizeIcsUrl(url)
    if (!clean) return toast('https:// 로 시작하는 주소를 넣어 주세요', 'error')
    setBusy(true)
    try {
      const n = await addGoogleCalendar({ name, url: clean, color })
      setUrl('')
      setName('')
      setAdding(false)
      setColor(nextColor([...loadGoogleCals().map((c) => c.color)]))
      toast(`구글 캘린더 일정 ${n}개를 가져왔어요`)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  async function refresh(c: GoogleCal) {
    setBusy(true)
    try {
      const n = await syncGoogleCalendar(c)
      toast(`${c.name} 일정 ${n}개를 새로 가져왔어요`)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  async function disconnect(c: GoogleCal) {
    await disconnectGoogleCalendar(c.id)
    toast(`${c.name} 연결을 끊고 가져온 일정을 지웠어요`)
  }

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <CalendarDays className="size-5 text-brand-600" aria-hidden />
        <h2 className="font-bold">구글 캘린더</h2>
      </div>
      <p className="mb-4 text-sm break-keep text-slate-500">구글 일정을 Tidy에서 보고, Tidy 일정을 구글에서 봐요.</p>

      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="flex items-center gap-1.5 font-semibold text-slate-800">
          <CalendarArrowDown className="size-4" aria-hidden /> 구글 캘린더 일정을 Tidy에서 보기
        </p>
        {cals.length > 0 && (
          <>
            <p className="mt-0.5 text-xs text-slate-400">앱을 열 때 6시간마다 저절로 새로 가져와요. 캘린더마다 색을 고를 수 있어요.</p>
            <ul className="mt-3 space-y-2.5">
              {cals.map((c) => (
                <li key={c.id} className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="size-3 shrink-0 rounded-full" style={{ background: EVENT_COLORS[c.color].bg }} aria-hidden />
                    <input
                      defaultValue={c.name}
                      maxLength={20}
                      onBlur={(e) => renameGoogleCal(c.id, e.target.value)}
                      aria-label={`${c.name} 이름`}
                      className="min-w-0 flex-1 bg-transparent font-semibold text-slate-800 outline-none focus:underline"
                    />
                    <button
                      type="button"
                      onClick={() => void refresh(c)}
                      disabled={busy}
                      className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100"
                      aria-label={`${c.name} 새로 가져오기`}
                      title="새로 가져오기"
                    >
                      <RefreshCw className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => void disconnect(c)}
                      disabled={busy}
                      className="tap rounded-full p-2 text-expense hover:bg-red-50"
                      aria-label={`${c.name} 연결 끊기`}
                      title="끊기"
                    >
                      <Link2Off className="size-4" aria-hidden />
                    </button>
                  </div>
                  <p className="mt-0.5 pl-5 text-xs text-slate-500">
                    일정 {c.count ?? 0}개 · 마지막 {agoLabel(c.last, Date.now())}
                  </p>
                  <ColorPicker value={c.color} onChange={(v) => void setGoogleCalColor(c.id, v)} label={`${c.name} 색`} />
                </li>
              ))}
            </ul>
            {!adding && cals.length < MAX_CALS && (
              <Button variant="secondary" className="mt-3 min-h-10! w-full text-sm!" onClick={() => setAdding(true)}>
                <Plus className="size-4" aria-hidden /> 캘린더 더 연결하기
              </Button>
            )}
          </>
        )}
        {showForm && (
          <div className={cals.length ? 'mt-3 rounded-xl bg-white p-3 shadow-sm' : ''}>
            <p className="mt-1 text-sm break-keep text-slate-600">구글 캘린더의 "iCal 형식의 비공개 주소"를 붙여 넣어요.</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder={cals.length ? '이름 (예: 회사)' : '이름 (예: 개인, 비워도 돼요)'}
              className={`${inputClass()} mt-2`}
              aria-label="캘린더 이름"
            />
            <div className="mt-2 flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                className={inputClass()}
                aria-label="iCal 비공개 주소"
                inputMode="url"
              />
              <Button className="shrink-0 px-4!" onClick={() => void add()} disabled={busy || !url.trim()}>
                연결
              </Button>
            </div>
            <ColorPicker value={color} onChange={setColor} label="새 캘린더 색" />
            <div className="mt-2 flex items-center gap-3">
              <button type="button" onClick={() => setHelp((v) => !v)} className="text-xs font-semibold text-brand-600" aria-expanded={help}>
                주소는 어디서 찾나요?
              </button>
              {adding && (
                <button type="button" onClick={() => setAdding(false)} className="ml-auto text-xs font-semibold text-slate-500">
                  취소
                </button>
              )}
            </div>
            {help && (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs break-keep text-slate-600">
                <li>컴퓨터 브라우저에서 calendar.google.com 을 열어요 (폰 앱에는 이 메뉴가 없어요)</li>
                <li>왼쪽 "내 캘린더"에서 캘린더 이름 옆 ⋮ › 설정 및 공유</li>
                <li>아래쪽 "캘린더 통합"의 "iCal 형식의 비공개 주소"를 복사해요</li>
                <li>여기에 붙여 넣고 연결을 눌러요. 이 주소는 다른 사람에게 알려 주지 마세요</li>
                <li>캘린더가 여러 개면 하나씩 연결하고 색을 다르게 골라요</li>
              </ol>
            )}
            {!isNativeApp() && <p className="mt-2 text-xs text-slate-400">웹에서는 구글이 막아서 연결이 안 될 수 있어요. 갤럭시 앱에서는 돼요.</p>}
          </div>
        )}
      </div>

      <GooglePushSection onExportFile={exportIcs} busy={busy} />
    </section>
  )
}

function ColorPicker({ value, onChange, label }: { value: EventColor; onChange: (c: EventColor) => void; label: string }) {
  return (
    <div className="mt-2 flex gap-2 pl-5" role="radiogroup" aria-label={label}>
      {(Object.keys(EVENT_COLORS) as EventColor[]).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={EVENT_COLORS[c].label}
          onClick={() => onChange(c)}
          className={`flex size-7 items-center justify-center rounded-full transition ${value === c ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}
          style={{ background: EVENT_COLORS[c].bg }}
        >
          {value === c && <Check className="size-3.5 text-white" strokeWidth={3} aria-hidden />}
        </button>
      ))}
    </div>
  )
}
