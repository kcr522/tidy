import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

/** 'Tidy 메모'로 공유받은 파일 (앱 임시 폴더에 복사된 것) */
export interface SharedFile {
  name: string
  type: string
  path?: string
  size?: number
  /** 50MB 가 넘어서 못 받은 파일 */
  tooBig?: boolean
}

export interface Shared {
  text?: string
  title?: string
  /** 'memo': 공유 목록의 'Tidy 메모'로 들어옴 (아니면 스크랩) */
  target?: 'memo'
  files?: SharedFile[]
}

/** 새 메모로 만들 공유 (메모 화면이 /memo?share=1 로 열리면 꺼내 간다) */
let memoShare: Shared | null = null
export function queueMemoShare(s: Shared) {
  memoShare = s
}
export function takeMemoShare(): Shared | null {
  const s = memoShare
  memoShare = null
  return s
}

/** 공유받은 파일을 웹 화면에서 읽을 수 있는 File 로 */
export async function sharedFileToFile(f: SharedFile): Promise<File | null> {
  if (!f.path) return null
  const res = await fetch(Capacitor.convertFileSrc(`file://${f.path}`))
  if (!res.ok) return null
  const blob = await res.blob()
  return new File([blob], f.name, { type: f.type || blob.type })
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
 * 공유로 들어온 링크가 있으면 go('/share?…'), 'Tidy 메모'로 들어온 것이면 go('/memo?share=1') 를 부른다.
 * (아래는 스크랩)
 * 공유로 들어온 링크가 있으면 go('/share?…') 를 부른다. 앱을 켤 때 한 번 + 켜져 있을 때 공유받을 때마다.
 * 돌려주는 함수로 그만 듣는다
 */
export function listenForShares(go: (path: string) => void): () => void {
  if (!available()) return () => undefined
  const pull = () =>
    ShareIntent.take()
      .then((s) => {
        if (s.target === 'memo') {
          queueMemoShare(s)
          go(`/memo?share=1&t=${Date.now()}`)
          return
        }
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
