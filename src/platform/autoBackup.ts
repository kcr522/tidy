import { autoFileName, toPrune } from '../lib/autoBackup'
import { isNativeApp } from './native'
import { saveTextFile } from './saveFile'

/** 폰 앱 안쪽 폴더 (앱을 지우기 전까지 남는다. 업데이트해도 그대로) */
const DIR = 'backups'
/** 폰의 문서 폴더 (앱을 지워도 남는다). 못 쓰는 폰이면 건너뛴다 */
const PUBLIC_DIR = 'Tidy'

export interface SavedBackup {
  name: string
  /** 바이트 */
  size: number
  /** 수정 시각 (ms) */
  mtime: number
}

const fs = () => import('@capacitor/filesystem')

/** 폰 앱에서만: 백업 파일을 쓰고, 오래된 자동 백업은 지운다. @returns 문서 폴더에도 썼는지 */
export async function writeAutoBackup(dateKey: string, text: string): Promise<{ publicCopy: boolean }> {
  if (!isNativeApp()) throw new Error('폰 앱에서만 돼요')
  const { Filesystem, Directory, Encoding } = await fs()
  const name = autoFileName(dateKey)
  await Filesystem.writeFile({ path: `${DIR}/${name}`, data: text, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true })
  let publicCopy = false
  try {
    await Filesystem.writeFile({ path: `${PUBLIC_DIR}/${name}`, data: text, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true })
    publicCopy = true
  } catch {
    // 문서 폴더에 못 쓰는 폰도 있다. 앱 안 폴더 백업은 있으니 괜찮다
  }
  await prune(Directory.Data, DIR)
  if (publicCopy) await prune(Directory.Documents, PUBLIC_DIR).catch(() => undefined)
  return { publicCopy }
}

async function prune(directory: import('@capacitor/filesystem').Directory, dir: string) {
  const { Filesystem } = await fs()
  const { files } = await Filesystem.readdir({ path: dir, directory })
  for (const name of toPrune(files.map((f) => f.name))) await Filesystem.deleteFile({ path: `${dir}/${name}`, directory })
}

/** 폰에 남아 있는 자동 백업 (최신순) */
export async function listAutoBackups(): Promise<SavedBackup[]> {
  if (!isNativeApp()) return []
  const { Filesystem, Directory } = await fs()
  try {
    const { files } = await Filesystem.readdir({ path: DIR, directory: Directory.Data })
    return files
      .filter((f) => f.type === 'file' && f.name.endsWith('.json'))
      .map((f) => ({ name: f.name, size: f.size, mtime: Number(f.mtime) || 0 }))
      .sort((a, b) => (a.name < b.name ? 1 : -1))
  } catch {
    return []
  }
}

export async function readAutoBackup(name: string): Promise<string> {
  const { Filesystem, Directory, Encoding } = await fs()
  const { data } = await Filesystem.readFile({ path: `${DIR}/${name}`, directory: Directory.Data, encoding: Encoding.UTF8 })
  return typeof data === 'string' ? data : await data.text()
}

/** 백업 파일을 다른 곳(카카오톡, 드라이브, 메일)으로 보내기 */
export async function shareAutoBackup(name: string): Promise<void> {
  await saveTextFile(name, await readAutoBackup(name))
}
