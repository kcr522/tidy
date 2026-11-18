import { Bot, Check, ExternalLink, RefreshCw, Server, ShieldCheck, Users, X } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/common/Button'
import PageHeader from '../components/common/PageHeader'
import { useAccount } from '../hooks/useAccount'
import { AdminError, fetchAdminReport } from '../lib/admin/adminClient'
import { ago } from '../lib/admin/ago'
import type { AdminReport, AdminUser } from '../lib/admin/adminServer'
import type { LatestApp } from '../lib/appUpdate'
import { formatNumber } from '../lib/format'
import { fetchLatestApp } from '../platform/appUpdate'

const shortDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const weekday = (day: string) => WEEK[new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10))).getUTCDay()]

/** 관리자 페이지: 사용자 목록 · AI 사용량 · 서버 상태 (서버가 관리자라고 한 사람만 내용을 받는다) */
export default function AdminPage() {
  const account = useAccount()
  const [report, setReport] = useState<AdminReport | null>(null)
  const [error, setError] = useState<AdminError | null>(null)
  const [loading, setLoading] = useState(false)
  const [latest, setLatest] = useState<LatestApp | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReport(await fetchAdminReport())
    } catch (e) {
      setError(e instanceof AdminError ? e : new AdminError('정보를 받지 못했어요', 0))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (account.checking) return
    void load()
    void fetchLatestApp().then(setLatest, () => setLatest(null))
  }, [account.checking, account.user?.uid, load])

  const today = report?.ai.days[0]
  const activeToday = report ? report.users.filter((u) => Math.max(u.lastActiveAt ?? 0, u.lastSyncAt ?? 0) >= Date.now() - 86400_000).length : 0
  const weekCount = report?.ai.days.reduce((s, d) => s + d.count, 0) ?? 0
  const maxDay = Math.max(1, ...(report?.ai.days.map((d) => d.count) ?? [0]))

  return (
    <>
      <PageHeader
        title="관리자"
        action={
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            새로고침
          </Button>
        }
      />
      <div className="space-y-4">
        <section className="flex items-start gap-3 rounded-3xl bg-brand-50 p-5 text-sm text-brand-700">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="break-keep">주인 계정만 볼 수 있는 화면이에요. 일기 · 가계부 같은 내용은 읽지 않고, 사람마다 언제 썼는지와 개수만 보여 줘요.</p>
        </section>

        {error && <ErrorCard error={error} />}

        {!report && !error && <p className="py-10 text-center text-sm text-slate-400">불러오는 중…</p>}

        {report && (
          <>
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="전체 사용자" value={`${report.users.length}명`} />
              <Tile label="최근 24시간 쓴 사람" value={`${activeToday}명`} />
              <Tile label="오늘 AI" value={`${today?.count ?? 0}번`} sub={`${today?.users ?? 0}명이 씀`} />
              <Tile label="7일 AI" value={`${formatNumber(weekCount)}번`} sub={`${formatNumber(report.ai.days.reduce((s, d) => s + d.tokens, 0))} 토큰`} />
            </dl>

            {report.warnings.length > 0 && (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{report.warnings.join(' · ')}</p>
            )}

            <section className="card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Bot className="size-5 text-brand-600" aria-hidden />
                <h2 className="font-bold">Tidy AI 사용량</h2>
                <span className="ml-auto text-xs text-slate-400">한 사람 하루 {report.ai.limit}번까지</span>
              </div>
              <div className="flex h-36 items-end gap-2" role="img" aria-label={`최근 7일 AI 사용: ${[...report.ai.days].reverse().map((d) => `${shortDay(d.day)} ${d.count}번`).join(', ')}`}>
                {[...report.ai.days].reverse().map((d) => (
                  <div key={d.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-xs font-semibold text-slate-600 tabular-nums">{d.count}</span>
                    <div className={`w-full max-w-10 rounded-t-lg ${d.day === report.today ? 'bg-brand-500' : 'bg-brand-100'}`} style={{ height: `${Math.max(3, (d.count / maxDay) * 100)}%` }} />
                    <span className={`text-[11px] ${d.day === report.today ? 'font-bold text-brand-600' : 'text-slate-400'}`}>
                      {d.day === report.today ? '오늘' : `${shortDay(d.day)} ${weekday(d.day)}`}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card overflow-hidden">
              <div className="flex items-center gap-2 px-5 pt-5 pb-3">
                <Users className="size-5 text-brand-600" aria-hidden />
                <h2 className="font-bold">사용자</h2>
                <span className="ml-auto text-xs text-slate-400">최근에 쓴 순서</span>
              </div>
              {report.users.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-slate-500">아직 구글로 로그인한 사람이 없어요.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {report.users.map((u) => (
                    <UserRow key={u.uid} user={u} limit={report.ai.limit} today={report.today} />
                  ))}
                </ul>
              )}
            </section>

            <section className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Server className="size-5 text-brand-600" aria-hidden />
                <h2 className="font-bold">서버 · 버전</h2>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Info label="웹 버전">
                  {report.server.commit ? (
                    <a className="inline-flex items-center gap-1 font-mono text-brand-600" href={`https://github.com/kcr522/tidy/commit/${report.server.commit}`} target="_blank" rel="noreferrer">
                      {report.server.commit.slice(0, 7)}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ) : (
                    <span className="text-slate-400">개발 서버</span>
                  )}
                  {report.server.branch && <span className="block truncate text-xs text-slate-400">{report.server.branch}</span>}
                </Info>
                <Info label="최신 안드로이드 앱">
                  {latest ? (
                    <>
                      <span className="font-semibold">{latest.versionName}</span>
                      <span className="block text-xs text-slate-400">{ago(Date.parse(latest.publishedAt))} 나옴</span>
                    </>
                  ) : (
                    <span className="text-slate-400">확인 못 함</span>
                  )}
                </Info>
                <Info label="이 화면 앱 버전">
                  <span className="font-semibold">v{__APP_VERSION__}</span>
                </Info>
                <Info label="정보 모은 시각">
                  <span className="font-semibold">{new Date(report.generatedAt).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}</span>
                </Info>
              </dl>
              <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <Flag on={report.ai.gemini} label="Gemini 키" />
                <Flag on={report.ai.groq} label="Groq 예비 키" />
                <Flag on={report.server.kakao} label="카카오 키 (음식 사진)" />
                <Flag on={report.server.releaseToken} label="앱 업데이트 토큰" />
              </ul>
              {report.server.allowedEmails > 0 && <p className="mt-3 text-xs text-slate-400">Tidy AI는 정해 둔 메일 {report.server.allowedEmails}개만 쓸 수 있어요 (AI_ALLOWED_EMAILS).</p>}
            </section>
          </>
        )}
      </div>
    </>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-extrabold tabular-nums">{value}</dd>
      {sub && <dd className="text-xs text-slate-400">{sub}</dd>}
    </div>
  )
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 p-3">
      <dt className="mb-0.5 text-xs text-slate-500">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${on ? 'text-slate-700' : 'text-slate-400'}`}>
      {on ? <Check className="size-4 text-emerald-500" aria-hidden /> : <X className="size-4 text-rose-400" aria-hidden />}
      {label}
      <span className="sr-only">{on ? '있음' : '없음'}</span>
    </li>
  )
}

function UserRow({ user: u, limit, today }: { user: AdminUser; limit: number; today: string }) {
  const t = u.ai.find((a) => a.day === today) ?? { count: 0, tokens: 0 }
  const week = u.ai.reduce((s, a) => s + a.count, 0)
  const pct = Math.min(100, (t.count / limit) * 100)
  return (
    <li className="px-5 py-4">
      <div className="flex items-center gap-3">
        {u.photoUrl ? (
          <img src={u.photoUrl} alt="" className="size-10 shrink-0 rounded-full bg-slate-100" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">{(u.name || u.email || '?').slice(0, 1).toUpperCase()}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-semibold">
            <span className="truncate">{u.name || u.email || '이름 없음'}</span>
            {u.admin && <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-600">관리자</span>}
            {u.disabled && <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-500">막힘</span>}
          </p>
          <p className="truncate text-sm text-slate-500">{u.email}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold">{ago(Math.max(u.lastActiveAt ?? 0, u.lastSyncAt ?? 0) || undefined)}</p>
          <p className="text-[11px] text-slate-400">마지막 사용</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
        <Mini label="기록" value={u.rows == null ? '—' : formatNumber(u.rows)} />
        <Mini label="사진·파일" value={u.files == null ? '—' : formatNumber(u.files)} />
        <Mini label="기기" value={u.devices == null ? '—' : `${u.devices}대`} />
        <Mini label="마지막 동기화" value={ago(u.lastSyncAt)} />
        <Mini label="가입" value={ago(u.createdAt)} />
        <Mini label="7일 AI" value={`${week}번`} />
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-slate-500">오늘 AI</span>
          <span className="font-semibold tabular-nums">
            {t.count} / {limit}번{t.tokens ? <span className="font-normal text-slate-400"> · {formatNumber(t.tokens)} 토큰</span> : null}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={t.count} aria-label={`${u.email} 오늘 AI 사용`}>
          <div className={`h-full rounded-full ${pct >= 100 ? 'bg-rose-400' : pct >= 80 ? 'bg-amber-400' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </li>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-1.5 py-2">
      <p className="truncate font-semibold text-slate-700">{value}</p>
      <p className="truncate text-[11px] text-slate-400">{label}</p>
    </div>
  )
}

function ErrorCard({ error }: { error: AdminError }) {
  if (error.status === 401) {
    return (
      <section className="card p-5 text-sm">
        <p className="mb-3 font-semibold">{error.message}</p>
        <Link to="/settings" className="text-brand-600 underline">
          설정에서 로그인하기
        </Link>
      </section>
    )
  }
  if (error.setup) {
    return (
      <section className="card space-y-3 p-5 text-sm break-keep">
        <p className="font-semibold">{error.message}</p>
        {error.setup === 'ADMIN_EMAILS' ? (
          <p className="text-slate-600">
            Vercel → tidy 프로젝트 → Settings → Environment Variables 에 <code className="rounded bg-slate-100 px-1">ADMIN_EMAILS</code> 를 만들고 관리자 구글 메일을 넣은 뒤 다시 배포해 주세요.
          </p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-slate-600">
            <li>Firebase 콘솔 → TIDY 프로젝트 → 프로젝트 설정(톱니) → 서비스 계정 → "새 비공개 키 생성"을 눌러 JSON 파일을 받아요.</li>
            <li>
              Vercel → tidy 프로젝트 → Settings → Environment Variables 에 <code className="rounded bg-slate-100 px-1">FIREBASE_SERVICE_ACCOUNT</code> 를 만들고, 받은 파일 내용을 통째로 붙여 넣어요.
            </li>
            <li>Deployments 에서 Redeploy 하면 끝이에요. (무료, 키는 서버에만 있어요)</li>
          </ol>
        )}
      </section>
    )
  }
  return <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error.message}</p>
}
