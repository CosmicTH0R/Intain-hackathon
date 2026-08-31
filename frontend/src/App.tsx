import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.tsx';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import OperatorDashboard from './pages/operator/OperatorDashboard';
import UploadPage from './pages/operator/UploadPage';
import ReviewerDashboard from './pages/reviewer/ReviewerDashboard';
import ExceptionQueuePage from './pages/reviewer/ExceptionQueuePage';
import ConsumerDashboard from './pages/consumer/ConsumerDashboard';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function DefaultRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'data_operator') return <Navigate to="/operator" replace />;
  if (user.role === 'reviewer') return <Navigate to="/reviewer" replace />;
  return <Navigate to="/consumer" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<DefaultRedirect />} />
            {/* Data Operator */}
            <Route path="operator" element={<ProtectedRoute roles={['data_operator']}><OperatorDashboard /></ProtectedRoute>} />
            <Route path="operator/upload" element={<ProtectedRoute roles={['data_operator']}><UploadPage /></ProtectedRoute>} />
            {/* Reviewer */}
            <Route path="reviewer" element={<ProtectedRoute roles={['reviewer']}><ReviewerDashboard /></ProtectedRoute>} />
            <Route path="reviewer/exceptions" element={<ProtectedRoute roles={['reviewer']}><ExceptionQueuePage /></ProtectedRoute>} />
            {/* Consumer */}
            <Route path="consumer" element={<ProtectedRoute roles={['data_consumer']}><ConsumerDashboard /></ProtectedRoute>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
