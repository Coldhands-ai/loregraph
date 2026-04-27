import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthLayout } from './routes/AuthLayout'
import { LoginPage } from './routes/LoginPage'
import { RegisterPage } from './routes/RegisterPage'
import { AppLayout } from './routes/AppLayout'
import { WorldsPage } from './routes/WorldsPage'
import { WorldLayout } from './routes/WorldLayout'
import { ArticlesPage } from './routes/ArticlesPage'
import { ArticleEditorPage } from './routes/ArticleEditorPage'
import { GraphPage } from './routes/GraphPage'
import { NotFoundPage } from './routes/NotFoundPage'

export default function App() {
  return (
    <Routes>
      {/* Public auth */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Protected app */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/worlds" replace />} />
          <Route path="/worlds" element={<WorldsPage />} />
          <Route path="/worlds/:projectId" element={<WorldLayout />}>
            <Route index element={<Navigate to="articles" replace />} />
            <Route path="articles" element={<ArticlesPage />} />
            <Route path="articles/:articleId" element={<ArticleEditorPage />} />
            <Route path="graph" element={<GraphPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
