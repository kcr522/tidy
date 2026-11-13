import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

interface Shared {
  text?: string
  title?: string
}

interface ShareIntentPlugin {
  take(): Promise<Shared>
  addListener(event: 'shared', cb: () => void): Promise<PluginListenerHandle>
}

/** 안드로이드 앱: 다른 앱의 "공유 → Tidy" (android/.../ShareIntentPlugin.java) */
const ShareIntent = registerPlugin<ShareIntentPlugin>('ShareIntent')

const available = () => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('ShareIntent')

/** 공유로 들어온 글을 웹과 같은 /share?text=…&title=… 주소로 */
export function shareRoute(s: Shared): string | null {
  const text = s.text?.trim() ?? ''
  const title = s.title?.trim() ?? ''
  if (!text && !title) return null
  const q = new URLSearchParams()
  if (text) q.set('text', text)
  if (title) q.set('title', title)
  return `/share?${q.toString()}`
}

/**
 * 공유로 들어온 링크가 있으면 go('/share?…') 를 부른다. 앱을 켤 때 한 번 + 켜져 있을 때 공유받을 때마다.
 * 돌려주는 함수로 그만 듣는다
 */
export function listenForShares(go: (path: string) => void): () => void {
  if (!available()) return () => undefined
  const pull = () =>
    ShareIntent.take()
      .then((s) => {
        const route = shareRoute(s)
        if (route) go(route)
      })
      .catch(() => undefined)
  pull()
  let handle: PluginListenerHandle | undefined
  let stopped = false
  ShareIntent.addListener('shared', pull)
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
