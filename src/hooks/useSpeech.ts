import { useCallback, useEffect, useRef, useState } from 'react'

// 말로 입력하기: 브라우저 음성 인식(Web Speech API, 한국어)
// - 크롬(안드로이드·컴퓨터), 엣지, 사파리 14.1+ 에서 된다. 파이어폭스는 아직 안 된다.
// - 아이폰은 사파리(또는 홈 화면에 설치한 앱)에서 되고, 처음 한 번 마이크·음성 인식 허락을 묻는다.
// - 크롬은 소리를 구글 서버로 보내 글자로 바꾼다 (녹음 파일은 저장하지 않는다).

interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

type RecognitionCtor = new () => Recognition

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const speechSupported = () => ctor() !== null

const ERRORS: Record<string, string> = {
  'not-allowed': '마이크를 쓸 수 있게 허락해 주세요',
  'service-not-allowed': '이 브라우저에서는 음성 인식을 쓸 수 없어요',
  'no-speech': '말소리가 들리지 않았어요',
  'audio-capture': '마이크를 찾지 못했어요',
  network: '인터넷 연결을 확인해 주세요',
}

/**
 * onText: 말한 글자 (끝난 문장만). 말하는 중인 글자는 interim 으로 보여 준다
 */
export function useSpeech(onText: (text: string) => void, onError?: (message: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const rec = useRef<Recognition | null>(null)
  const cb = useRef({ onText, onError })
  useEffect(() => {
    cb.current = { onText, onError }
  })

  useEffect(() => () => rec.current?.abort(), [])

  const stop = useCallback(() => rec.current?.stop(), [])

  const start = useCallback(() => {
    const C = ctor()
    if (!C) {
      cb.current.onError?.('이 브라우저는 음성 입력을 지원하지 않아요 (크롬이나 사파리에서 써 주세요)')
      return
    }
    rec.current?.abort()
    const r = new C()
    r.lang = 'ko-KR'
    r.interimResults = true
    r.continuous = true
    r.onresult = (e) => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) cb.current.onText(res[0].transcript.trim())
        else live += res[0].transcript
      }
      setInterim(live)
    }
    r.onerror = (e) => {
      if (e.error !== 'aborted') cb.current.onError?.(ERRORS[e.error] ?? '음성을 알아듣지 못했어요')
    }
    r.onend = () => {
      setListening(false)
      setInterim('')
      if (rec.current === r) rec.current = null
    }
    rec.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      cb.current.onError?.('음성 입력을 시작하지 못했어요')
    }
  }, [])

  return { listening, interim, start, stop, supported: speechSupported() }
}
