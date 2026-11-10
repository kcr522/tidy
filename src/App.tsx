import { Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import BookmarksPage from './pages/BookmarksPage'
import SharePage from './pages/SharePage'
import DashboardPage from './pages/DashboardPage'
import NotFoundPage from './pages/NotFoundPage'
import SettingsPage from './pages/SettingsPage'
import TodosPage from './pages/TodosPage'
import TransactionsPage from './pages/TransactionsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="money" element={<TransactionsPage />} />
        <Route path="todos" element={<TodosPage />} />
        <Route path="scraps" element={<BookmarksPage />} />
        <Route path="share" element={<SharePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
