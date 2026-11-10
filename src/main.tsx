import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ToastProvider } from './components/common/Toast.tsx'
import './index.css'
import { applyTheme, pickTheme } from './lib/palette'

// 켤 때마다 구역마다 다른 그라데이션 색을 고른다 (견본 18개 + 새로 만든 조합)
applyTheme(pickTheme())

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
