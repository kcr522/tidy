import { CalendarArrowDown, CalendarArrowUp, RefreshCw, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { agoLabel } from '../../lib/autoBackup'
import { accountLabel, defaultPicks, isGoogleCalendar, type DeviceCalendar } from '../../lib/deviceCal'
import { askCalendarPermission, deviceCalAvailable, deviceCalErrorText, listDeviceCalendars, loadDeviceCal, onDeviceCalChange, pullDeviceCalendar, pushDeviceCalendar, setDevicePull, setDevicePush } from '../../platform/deviceCalendar'
import Button from '../common/Button'
import Modal from '../common/Modal'
import { useToast } from '../common/Toast'

/**
 * 설정 > 삼성 캘린더 (폰 앱만)
 * - 삼성 캘린더 일정을 Tidy에서 보기: 고른 캘린더 일정을 Tidy 달력과 달력 위젯에 보인다
 * - Tidy 일정을 삼성 캘린더에 보이기: 폰에 "Tidy" 캘린더를 만들어 Tidy 일정을 넣는다 (할 일은 안 보낸다)
 */
export default function DeviceCalendarCard() {
  const toast = useToast()
  const [s, setS] = useState(loadDeviceCal)
  const [cals, setCals] = useState<DeviceCalendar[] | null>(null)
  const [picking, setPicking] = useState<string[] | null>(null)
  const [working, setWorking] = useState(false)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => onDeviceCalChange(() => setS(loadDeviceCal())), [])

  if (!deviceCalAvailable()) {
    return (
      <section className="card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Smartphone className="size-5 text-brand-600" aria-hidden />
          <h2 className="font-bold">삼성 캘린더</h2>
        </div>
        <p className="text-sm break-keep text-slate-500">갤럭시 폰 앱에서 켤 수 있어요. 폰에서 가져온 일정은 같은 계정으로 로그인한 이 화면에도 보여요.</p>
      </section>
    )
  }

  async function run(fn: () => Promise<string>) {
    setWorking(true)
    try {
      toast(await fn())
    } catch (err) {
      toast(deviceCalErrorText(err), 'error')
    } finally {
      setWorking(false)
    }
  }

  /** 캘린더 고르기 창 열기 (권한부터) */
  async function openPicker() {
    setWorking(true)
    try {
      if (!(await askCalendarPermission())) {
        toast('캘린더 권한을 허용해야 가져올 수 있어요', 'error')
        return
      }
      const list = await listDeviceCalendars()
      setCals(list)
      const cur = loadDeviceCal()
      setPicking(cur?.pull && cur.picked.length ? cur.picked.map((p) => p.id) : defaultPicks(list))
    } catch (err) {
      toast(deviceCalErrorText(err), 'error')
    } finally {
      setWorking(false)
    }
  }

  async function savePicks() {
    const ids = picking ?? []
    setPicking(null)
    if (!ids.length) return run(async () => (await setDevicePull(false), '삼성 캘린더 가져오기를 껐어요'))
    const picked = (cals ?? []).filter((c) => ids.includes(c.id)).map((c) => ({ id: c.id, name: c.name, color: c.color }))
    await run(async () => `삼성 캘린더 일정 ${await setDevicePull(true, picked)}개를 가져왔어요`)
  }

  const pull = s?.pull === true
  const push = s?.push === true

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Smartphone className="size-5 text-brand-600" aria-hidden />
        <h2 className="font-bold">삼성 캘린더</h2>
      </div>
      <p className="mb-4 text-sm break-keep text-slate-500">이 폰의 삼성 캘린더 일정을 Tidy에서 보고, Tidy 일정을 삼성 캘린더에서 봐요.</p>
      {s?.error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs break-keep text-expense">{s.error}</p>}

      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="flex items-center gap-1.5 font-semibold text-slate-800">
          <CalendarArrowDown className="size-4" aria-hidden /> 삼성 캘린더 일정을 Tidy에서 보기
        </p>
        {pull ? (
          <>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {s.picked.map((p) => (
                <li key={p.id} className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                  <span className="size-2.5 rounded-full" style={{ background: p.color }} aria-hidden />
                  {p.name}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-slate-600">{s.last ? `일정 ${s.count ?? 0}개 · 마지막 ${agoLabel(s.last, Date.now())}` : '아직 가져오지 않았어요'}</p>
            <p className="mt-0.5 text-xs break-keep text-slate-400">달력과 달력 위젯에 캘린더 색 그대로 보여요. 앱을 열 때와 5분마다 새로 읽어요. 고치려면 삼성 캘린더에서 고쳐 주세요.</p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" className="min-h-10! flex-1 px-3! text-sm!" onClick={() => void run(async () => `삼성 캘린더 일정 ${await pullDeviceCalendar()}개를 맞췄어요`)} disabled={working}>
                <RefreshCw className={`size-4 ${working ? 'animate-spin' : ''}`} aria-hidden /> 지금 읽기
              </Button>
              <Button variant="secondary" className="min-h-10! px-3! text-sm!" onClick={() => void openPicker()} disabled={working}>
                캘린더 고르기
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm break-keep text-slate-600">삼성 계정 · 내 휴대전화 캘린더 일정이 Tidy 달력과 달력 위젯에 같이 보여요.</p>
            <Button className="mt-3 min-h-10! w-full text-sm!" onClick={() => void openPicker()} disabled={working}>
              캘린더 골라서 가져오기
            </Button>
          </>
        )}
      </div>

      <div className="mt-3 rounded-2xl bg-slate-50 p-4">
        <label className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 font-semibold text-slate-800">
            <CalendarArrowUp className="size-4" aria-hidden /> Tidy 일정을 삼성 캘린더에 보이기
          </span>
          <input
            type="checkbox"
            checked={push}
            disabled={working}
            onChange={(e) => (e.target.checked ? void run(async () => `삼성 캘린더 "Tidy"에 일정 ${await setDevicePush(true)}개를 넣었어요`) : setLeaving(true))}
            className="size-5 shrink-0 accent-brand-600"
          />
        </label>
        <p className="mt-1 text-xs break-keep text-slate-400">
          삼성 캘린더에 "Tidy" 캘린더가 생기고, Tidy에서 넣고 고치고 지운 일정이 몇 초 뒤 똑같이 돼요. 할 일은 보내지 않아요.
          {push && s?.pushCount != null && ` 지금 ${s.pushCount}개.`}
        </p>
        {push && (
          <button type="button" onClick={() => void run(async () => `삼성 캘린더에 일정 ${await pushDeviceCalendar()}개를 맞췄어요`)} disabled={working} className="mt-2 text-xs font-semibold text-brand-600">
            지금 다시 넣기
          </button>
        )}
      </div>
      <p className="mt-3 text-xs break-keep text-slate-400">구글 캘린더는 위 구글 연결로 이미 보이니 여기서는 처음에 꺼 둬요. 구글 보내기도 켜 두었으면 삼성 캘린더에 Tidy 일정이 두 번 보일 수 있어요. 그땐 삼성 캘린더에서 구글 "Tidy" 캘린더를 꺼 주세요.</p>

      <Modal open={picking !== null} title="가져올 캘린더" onClose={() => setPicking(null)}>
        <ul className="divide-y divide-slate-100">
          {(cals ?? []).map((c) => (
            <li key={c.id}>
              <label className="flex items-center gap-3 py-3">
                <span className="size-3.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-800">{c.name || '이름 없음'}</span>
                  <span className="block truncate text-xs text-slate-400">
                    {accountLabel(c)}
                    {isGoogleCalendar(c) && ' · 구글 연결로 보고 있으면 끄세요'}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={picking?.includes(c.id) ?? false}
                  onChange={(e) => setPicking((p) => (e.target.checked ? [...(p ?? []), c.id] : (p ?? []).filter((x) => x !== c.id)))}
                  className="size-5 accent-brand-600"
                />
              </label>
            </li>
          ))}
          {cals?.length === 0 && <li className="py-6 text-center text-sm text-slate-400">이 폰에 캘린더가 없어요</li>}
        </ul>
        <Button className="mt-4 w-full" onClick={() => void savePicks()}>
          {picking?.length ? `${picking.length}개 가져오기` : '가져오지 않기'}
        </Button>
      </Modal>

      <Modal open={leaving} title="삼성 캘린더에 보내기 끄기" onClose={() => setLeaving(false)}>
        <p className="text-sm break-keep text-slate-600">더는 넣지 않아요. 삼성 캘린더에 있는 "Tidy" 캘린더는 어떻게 할까요?</p>
        <div className="mt-4 flex flex-col gap-2">
          <Button variant="secondary" onClick={() => (setLeaving(false), void run(async () => (await setDevicePush(false), '껐어요. 삼성 캘린더의 Tidy 일정은 그대로 있어요')))}>
            남겨 두기
          </Button>
          <Button variant="danger" onClick={() => (setLeaving(false), void run(async () => (await setDevicePush(false, true), '끄고 삼성 캘린더의 Tidy 캘린더도 지웠어요')))}>
            삼성 캘린더에서도 지우기
          </Button>
        </div>
      </Modal>
    </section>
  )
}
