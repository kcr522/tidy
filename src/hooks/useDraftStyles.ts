import { useEffect, type RefObject } from 'react'
import { isDark, onDarkChange } from '../lib/colorMode'
import { applyCustomization, withFixedColors, type Customization } from '../lib/customize'
import { applyTheme } from '../lib/palette'
import { randomTheme } from '../lib/sessionTheme'

/**
 * 아직 적용하지 않은 꾸미기를 이 상자 안에만 입힌다 (앱 전체는 그대로).
 * 색, 사진, 투명도 CSS 변수를 상자에 넣으면 안쪽 .theme-* 와 카드가 그 값을 읽는다.
 */
export function useDraftStyles(ref: RefObject<HTMLElement | null>, custom: Customization, active = true) {
  useEffect(() => {
    const el = ref.current
    if (!el || !active) return
    const paint = () => {
      const theme = withFixedColors(randomTheme, custom)
      applyTheme(theme, el, isDark())
      applyCustomization(custom, theme, el)
    }
    paint()
    return onDarkChange(paint)
  }, [ref, custom, active])
}
