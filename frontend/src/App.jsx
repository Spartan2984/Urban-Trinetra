import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ComplaintsPage } from './pages/ComplaintsPage';
import { NewComplaintPage } from './pages/NewComplaintPage';
import { ComplaintDetailPage } from './pages/ComplaintDetailPage';
import { AdminPage } from './pages/AdminPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ForumPage } from './pages/ForumPage';
import { ForumTopicPage } from './pages/ForumTopicPage';
import { ProfilePage } from './pages/ProfilePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="complaints" element={<ComplaintsPage />} />
          <Route path="complaints/new" element={<ProtectedRoute roles={['citizen']}><NewComplaintPage /></ProtectedRoute>} />
          <Route path="complaints/:id" element={<ComplaintDetailPage />} />
          <Route path="forum" element={<ForumPage />} />
          <Route path="forum/:id" element={<ForumTopicPage />} />
          <Route path="admin" element={<ProtectedRoute roles={['admin', 'supervisor']}><AdminPage /></ProtectedRoute>} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
