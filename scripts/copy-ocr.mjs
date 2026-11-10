// 글자 인식(Tesseract) 파일을 public/ocr 로 복사한다.
// 인터넷의 다른 사이트에서 받지 않고 Tidy 안에서 바로 쓰기 위해서다 (오프라인, 폰 앱에서도 동작).
// npm run dev / npm run build 앞에서 자동으로 실행된다.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

const out = 'public/ocr'
const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'core/tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'core/tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/kor/4.0.0_best_int/kor.traineddata.gz', 'lang/kor.traineddata.gz'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'lang/eng.traineddata.gz'],
]

for (const [from, to] of files) {
  const dest = join(out, to)
  if (existsSync(dest) && statSync(dest).size === statSync(from).size) continue
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(from, dest)
}
