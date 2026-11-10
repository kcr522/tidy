import { useEffect, useState } from 'react'
import { getColorMode, setColorMode, type ColorMode } from '../lib/colorMode'

/** 지금 고른 화면 밝기와 바꾸는 함수 (버튼이 여러 곳에 있어도 같이 바뀐다) */
export function useColorMode(): [ColorMode, (m: ColorMode) => void] {
  const [mode, setMode] = useState<ColorMode>(getColorMode)
  useEffect(() => {
    const sync = () => setMode(getColorMode())
    window.addEventListener('tidy:color-mode', sync)
    return () => window.removeEventListener('tidy:color-mode', sync)
  }, [])
  return [mode, setColorMode]
}
