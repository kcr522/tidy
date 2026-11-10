import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ToastProvider } from './components/common/Toast.tsx'
import './index.css'
import { initColorMode, isDark, onDarkChange } from './lib/colorMode'
import { applyCustomization, loadCustomization, onCustomizationChange, withFixedColors } from './lib/customize'
import { applyTheme } from './lib/palette'
import { randomTheme } from './lib/sessionTheme'

// 화면 밝기(라이트/다크/자동)를 먼저 정하고,
// 켤 때마다 구역마다 다른 그라데이션 색을 고른다 (견본 18개 + 새로 만든 조합). 밝기가 바뀌면 같은 색을 그 밝기에 맞춰 다시 넣는다
// 꾸미기에서 색을 고정한 구역은 고른 색, 사진·투명도·앱 배경도 여기서 넣는다
initColorMode()
const paint = () => {
  const custom = loadCustomization()
  const theme = withFixedColors(randomTheme, custom)
  applyTheme(theme, document.documentElement, isDark())
  applyCustomization(custom, theme)
}
paint()
onDarkChange(paint)
onCustomizationChange(paint)

// 브라우저가 저장 공간 부족 시 데이터를 임의로 지우지 않도록 요청 (research.md 2번)
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
