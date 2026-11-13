import { isNativeApp } from './native'
import { writeTextChunks } from './writeChunks'

/**
 * 파일 저장 (백업 내보내기, T064). 내용은 글자 하나 또는 글자 조각들
 * - 웹 / 컴퓨터 PWA: 다운로드 폴더로 내려받기
 * - 폰 앱: 앱 임시 폴더에 쓴 뒤 공유 창을 띄운다 (파일 앱, 카카오톡, 메일 등으로 보낼 수 있다)
 */
export async function saveTextFile(fileName: string, text: string | Iterable<string>, mime = 'application/json'): Promise<void> {
  const pieces = typeof text === 'string' ? [text] : text
  if (isNativeApp()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    // 큰 백업도 되게 조각조각 이어 쓴다
    await writeTextChunks(fileName, Directory.Cache, pieces)
    const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache })
    try {
      await Share.share({ title: fileName, url: uri })
    } catch (err) {
      // 공유 창을 그냥 닫은 건 실패가 아니다 (파일은 이미 만들어졌다)
      if (!/cancel/i.test(err instanceof Error ? err.message : String(err))) throw err
    }
    return
  }
  const url = URL.createObjectURL(new Blob([...pieces], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 파일 고르기 (백업 가져오기). 웹, PWA, 폰 앱 모두 파일 선택 창을 쓴다 */
export function pickTextFile(accept = 'application/json,.json'): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      resolve(file ? { name: file.name, text: await file.text() } : null)
    })
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}
