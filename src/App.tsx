import { Route, Routes } from 'react-router-dom'
import LoginScreen from './components/account/LoginScreen'
import SyncChoiceDialog from './components/account/SyncChoiceDialog'
import AppLayout from './components/layout/AppLayout'
import AppUpdatePrompt from './components/layout/AppUpdatePrompt'
import LockScreen from './components/layout/LockScreen'
import Splash from './components/layout/Splash'
import DashboardPage from './pages/DashboardPage'
import { lazyPage } from './lib/lazyPage'

// 첫 화면(대시보드)만 바로 싣고, 나머지 화면은 따로 떼어 둔다 → 앱을 켤 때 읽을 코드가 줄어 첫 화면이 빨리 뜬다.
// 첫 화면이 뜨고 나면 쉬는 틈에 나머지도 미리 읽어 두어서, 탭을 옮길 때는 기다리지 않는다
const TransactionsPage = lazyPage(() => import('./pages/TransactionsPage'))
const TodosPage = lazyPage(() => import('./pages/TodosPage'))
const DiaryPage = lazyPage(() => import('./pages/DiaryPage'))
const CalendarPage = lazyPage(() => import('./pages/CalendarPage'))
const BookmarksPage = lazyPage(() => import('./pages/BookmarksPage'))
const SharePage = lazyPage(() => import('./pages/SharePage'))
const SearchPage = lazyPage(() => import('./pages/SearchPage'))
const ReportPage = lazyPage(() => import('./pages/ReportPage'))
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'))
const NotFoundPage = lazyPage(() => import('./pages/NotFoundPage'))

export default function App() {
  return (
    <>
    <Splash />
    <LockScreen />
    <LoginScreen />
    <SyncChoiceDialog />
    <AppUpdatePrompt />
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="money" element={<TransactionsPage />} />
        <Route path="todos" element={<TodosPage />} />
        <Route path="diary" element={<DiaryPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="scraps" element={<BookmarksPage />} />
        <Route path="share" element={<SharePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="report" element={<ReportPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </>
  )
}
