// 기기 안에서 사진 속 글자를 읽는다 (Tesseract, 무료, 인터넷으로 사진을 보내지 않는다)
// 처음 한 번은 글자 인식 파일(약 6MB)을 Tidy 서버에서 받아 기기에 저장한다.
import type { Worker } from 'tesseract.js'

export type OcrProgress = (stage: 'loading' | 'reading', ratio: number) => void

let workerPromise: Promise<Worker> | null = null

/** public/ocr 안의 파일 주소 (웹, PWA, 폰 앱 모두 같은 곳) */
function ocrUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}ocr/${path}`, window.location.href).href
}

let progress: OcrProgress | undefined

function getWorker(): Promise<Worker> {
  workerPromise ??= import('tesseract.js')
    .then(({ createWorker }) =>
      createWorker(['kor', 'eng'], 1, {
        workerPath: ocrUrl('worker.min.js'),
        corePath: ocrUrl('core'),
        langPath: ocrUrl('lang'),
        logger: (m) => {
          if (m.status === 'recognizing text') progress?.('reading', m.progress)
          else progress?.('loading', m.progress)
        },
      }),
    )
    .catch((e) => {
      workerPromise = null
      throw e
    })
  return workerPromise
}

/** 글씨가 작으면 키우고 흑백으로 바꿔 인식률을 높인다 */
async function prepare(src: Blob | string): Promise<HTMLCanvasElement> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('사진을 열지 못했어요'))
      i.src = url
    })
    const w = img.naturalWidth
    const scale = w < 900 ? 2 : w > 2400 ? 2400 / w : 1
    const c = document.createElement('canvas')
    c.width = Math.round(w * scale)
    c.height = Math.round(img.naturalHeight * scale)
    const ctx = c.getContext('2d')!
    ctx.filter = 'grayscale(1) contrast(1.15)'
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return c
  } finally {
    if (typeof src !== 'string') URL.revokeObjectURL(url)
  }
}

/** 사진(파일 또는 data URL)의 글자를 줄 단위 문자열로 */
export async function recognizeText(src: Blob | string, onProgress?: OcrProgress): Promise<string> {
  progress = onProgress
  try {
    const [worker, canvas] = await Promise.all([getWorker(), prepare(src)])
    const { data } = await worker.recognize(canvas)
    return data.text
  } finally {
    progress = undefined
  }
}
