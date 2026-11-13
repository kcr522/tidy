import type { Directory } from '@capacitor/filesystem'
import { rechunk } from '../lib/jsonChunks'

/**
 * 폰 앱: 글자 조각들을 파일 하나에 이어 쓴다 (첫 조각은 새로 쓰기, 나머지는 덧붙이기).
 * 한 번에 넘기는 글자가 작아서 백업이 커도 메모리가 모자라지 않는다.
 */
export async function writeTextChunks(path: string, directory: Directory, pieces: Iterable<string>): Promise<void> {
  const { Filesystem, Encoding } = await import('@capacitor/filesystem')
  let first = true
  for (const data of rechunk(pieces)) {
    if (first) await Filesystem.writeFile({ path, data, directory, encoding: Encoding.UTF8, recursive: true })
    else await Filesystem.appendFile({ path, data, directory, encoding: Encoding.UTF8 })
    first = false
  }
  // 내용이 비어 있어도 파일은 만든다
  if (first) await Filesystem.writeFile({ path, data: '', directory, encoding: Encoding.UTF8, recursive: true })
}
