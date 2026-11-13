import { scrapMediaRepo } from '../../repositories/scrapMediaRepo'
import { shrinkImage } from './image'

/** 화면 녹화 영상 크기 한도. 기기 저장 공간을 너무 쓰지 않게 */
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024

export const CAPTURE_ACCEPT = 'image/*,video/*'

/**
 * 고른 캡처 사진·화면 녹화를 스크랩에 붙인다.
 * 사진은 긴 변 2048px로 줄여 저장, 영상은 그대로 (너무 크면 건너뛴다)
 */
export async function saveCaptureFiles(bookmarkId: number, files: FileList | File[]): Promise<{ saved: number; skipped: number }> {
  let saved = 0
  let skipped = 0
  for (const f of Array.from(files)) {
    try {
      if (f.type.startsWith('video/')) {
        if (f.size > MAX_VIDEO_BYTES) {
          skipped++
          continue
        }
        await scrapMediaRepo.addCapture(bookmarkId, f)
      } else if (f.type.startsWith('image/')) {
        await scrapMediaRepo.addCapture(bookmarkId, await shrinkImage(f, 2048, 0.9))
      } else {
        skipped++
        continue
      }
      saved++
    } catch {
      skipped++
    }
  }
  return { saved, skipped }
}
