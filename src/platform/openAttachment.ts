import type { Attachment } from '../db/types'
import { dataUrlToBlob } from '../lib/sync/codec'
import { isNativeApp } from './native'

/** 폴더에 쓸 수 있는 이름으로 (/ 같은 글자를 뺀다) */
const safeName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 100) || 'file'

/**
 * 첨부 파일 열기 (사진이 아닌 파일: PDF, 문서 등)
 * - 폰 앱: 앱 임시 폴더에 쓴 뒤 공유 창을 띄운다 (다른 앱으로 열거나, 파일 앱에 저장하거나, 보낼 수 있다)
 * - 웹 / PWA: PDF·글·영상·소리는 새 탭으로 열고, 나머지는 내려받는다
 */
export async function openAttachment(a: Attachment): Promise<void> {
  if (isNativeApp()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    const { uri } = await Filesystem.writeFile({
      path: `attachments/${safeName(a.name)}`,
      data: a.src.slice(a.src.indexOf(',') + 1),
      directory: Directory.Cache,
      recursive: true,
    })
    await Share.share({ title: a.name, url: uri })
    return
  }
  const url = URL.createObjectURL(dataUrlToBlob(a.src))
  const viewable = /^(application\/pdf|text\/|video\/|audio\/|image\/)/.test(a.type)
  const link = document.createElement('a')
  link.href = url
  if (viewable) {
    link.target = '_blank'
    link.rel = 'noopener'
  } else {
    link.download = a.name
  }
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
