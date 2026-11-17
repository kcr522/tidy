import { registerPlugin } from '@capacitor/core'
import type { WidgetKind } from '../lib/widgetSettings'
import type { WidgetSummary } from '../lib/widgetSummary'
import { isNativeApp } from './native'

/** 안드로이드 쪽 TidyWidgetPlugin.java */
interface TidyWidgetPlugin {
  /** 요약을 저장하고 홈 화면 위젯을 다시 그린다 */
  update(options: { data: string }): Promise<void>
  /** 홈 화면에 위젯을 추가해 달라고 런처에 부탁한다. 지원하지 않는 런처면 false */
  pin(options: { kind: WidgetKind }): Promise<{ ok: boolean }>
}

const TidyWidget = registerPlugin<TidyWidgetPlugin>('TidyWidget')

let last = ''

/** 폰 앱에서만: 바뀐 게 있을 때만 위젯에 요약을 보낸다 */
export async function syncWidget(summary: WidgetSummary): Promise<void> {
  if (!isNativeApp()) return
  const data = JSON.stringify(summary)
  if (data === last) return
  try {
    await TidyWidget.update({ data })
    last = data
  } catch {
    // 위젯이 없는 옛 앱이거나 실패해도 앱 사용에는 영향 없음
  }
}

/** 홈 화면에 위젯 추가 창을 띄운다. 못 띄우면 false (직접 추가하는 방법을 안내한다) */
export async function pinWidget(kind: WidgetKind = 'today'): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    return (await TidyWidget.pin({ kind })).ok
  } catch {
    return false
  }
}
