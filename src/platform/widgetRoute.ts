import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

interface WidgetRoutePlugin {
  take(): Promise<{ route?: string }>
  addListener(event: 'route', cb: () => void): Promise<PluginListenerHandle>
}

/** 안드로이드 앱: 홈 화면 위젯에서 누른 곳 (android/.../WidgetRoutePlugin.java) */
const WidgetRoute = registerPlugin<WidgetRoutePlugin>('WidgetRoute')

const available = () => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('WidgetRoute')

/** 앱 안 주소만 받는다 (/memo?id=3, /memo?new=1 등) */
export const isAppRoute = (r: unknown): r is string => typeof r === 'string' && r.startsWith('/') && !r.startsWith('//')

/**
 * 위젯으로 앱을 열었으면 go(주소)를 부른다. 앱을 켤 때 한 번 + 켜져 있을 때 위젯을 누를 때마다.
 * 돌려주는 함수로 그만 듣는다
 */
export function listenForWidgetRoutes(go: (path: string) => void): () => void {
  if (!available()) return () => undefined
  const pull = () =>
    WidgetRoute.take()
      .then(({ route }) => {
        if (isAppRoute(route)) go(route)
      })
      .catch(() => undefined)
  pull()
  let handle: PluginListenerHandle | undefined
  let stopped = false
  WidgetRoute.addListener('route', pull)
    .then((h) => {
      if (stopped) h.remove()
      else handle = h
    })
    .catch(() => undefined)
  return () => {
    stopped = true
    handle?.remove()
  }
}
