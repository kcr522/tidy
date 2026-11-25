import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ToastProvider } from './components/common/Toast.tsx'
import AiUsageNotice from './components/common/AiUsageNotice.tsx'
import './index.css'
import { db } from './db/database'
import { initColorMode, isDark, onDarkChange } from './lib/colorMode'
import { loadPhotos } from './lib/customPhotos'
import { applyCustomization, loadCustomization, onCustomizationChange, photoRefs, withFixedColors, withSplashColors } from './lib/customize'
import { applyTheme } from './lib/palette'
import { initFont } from './lib/appFont'
import { randomTheme } from './lib/sessionTheme'
import { initAccount } from './lib/sync/account'
import { installSyncHooks } from './lib/sync/engine'
import { moneyCategoryRepo } from './repositories/moneyCategoryRepo'
import { setupServiceWorker } from './platform/serviceWorker'

// 화면 밝기(라이트/다크/자동)를 먼저 정하고,
// 켤 때마다 구역마다 다른 그라데이션 색을 고른다 (견본 18개 + 새로 만든 조합). 밝기가 바뀌면 같은 색을 그 밝기에 맞춰 다시 넣는다
// 꾸미기에서 색을 고정한 구역은 고른 색, 사진·투명도·앱 배경도 여기서 넣는다
initColorMode()
const paint = () => {
  // 시작 화면 사진 색 맞추기를 켰으면 그 사진 색으로
  const custom = withSplashColors(loadCustomization(), isDark())
  const theme = withFixedColors(randomTheme, custom)
  applyTheme(theme, document.documentElement, isDark())
  applyCustomization(custom, theme)
}
paint()
// 꾸미기 사진은 IndexedDB 에서 읽어야 해서, 읽고 나면 한 번 더 칠한다
void loadPhotos(photoRefs(loadCustomization())).then(paint).catch(() => {})
onDarkChange(paint)
onCustomizationChange(paint)
// 설정 > 글꼴에서 고른 글씨체 (기본 말고는 인터넷에서 받아 둔 것)
initFont()
// 가계부 카테고리 (내가 만든 것 · 바꾼 것) 를 읽어 두고, 바뀌면 앱 전체가 따라간다
moneyCategoryRepo.watch()

// 오프라인용 저장본: 웹은 쓰고, 폰 앱은 예전 것을 지운다 (업데이트해도 예전 화면이 뜨던 문제)
setupServiceWorker()

// 구글 로그인한 기기면 다른 기기와 기록을 맞춘다 (바뀐 기록을 적어 두는 훅은 늘 걸어 둔다)
installSyncHooks(db)
initAccount()

// 브라우저가 저장 공간 부족 시 데이터를 임의로 지우지 않도록 요청 (research.md 2번)
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
        <AiUsageNotice />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
