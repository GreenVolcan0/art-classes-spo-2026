import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import ProtectedRoute from './components/ProtectedRoute';

import HomePage from './pages/HomePage';
import WorkshopPage from './pages/WorkshopPage';
import MasterPublicPage from './pages/MasterPublicPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import MyBookingsPage from './pages/MyBookingsPage';
import NotFoundPage from './pages/NotFoundPage';

import MyWorkshopsPage from './pages/master/MyWorkshopsPage';
import WorkshopFormPage from './pages/master/WorkshopFormPage';
import ParticipantsPage from './pages/master/ParticipantsPage';

import AdminLayout from './pages/admin/AdminLayout';
import AdminWorkshopsPage from './pages/admin/AdminWorkshopsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminReviewsPage from './pages/admin/AdminReviewsPage';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminLogsPage from './pages/admin/AdminLogsPage';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <div className="app-shell d-flex flex-column min-vh-100">
            <Navbar />
            <main className="flex-grow-1 py-4">
              <Container>
                <Routes>
                  {/* Публичные страницы */}
                  <Route path="/" element={<HomePage />} />
                  <Route path="/workshops/:id" element={<WorkshopPage />} />
                  <Route path="/masters/:id" element={<MasterPublicPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />

                  {/* Клиент */}
                  <Route
                    path="/my-bookings"
                    element={
                      <ProtectedRoute roles={['client']}>
                        <MyBookingsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Любой авторизованный пользователь */}
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Мастер */}
                  <Route
                    path="/master/workshops"
                    element={
                      <ProtectedRoute roles={['master']}>
                        <MyWorkshopsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/master/workshops/new"
                    element={
                      <ProtectedRoute roles={['master']}>
                        <WorkshopFormPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/master/workshops/:id/edit"
                    element={
                      <ProtectedRoute roles={['master']}>
                        <WorkshopFormPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/master/workshops/:id/participants"
                    element={
                      <ProtectedRoute roles={['master']}>
                        <ParticipantsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Администратор */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute roles={['admin']}>
                        <AdminLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="/admin/workshops" replace />} />
                    <Route path="workshops" element={<AdminWorkshopsPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="reviews" element={<AdminReviewsPage />} />
                    <Route path="categories" element={<AdminCategoriesPage />} />
                    <Route path="logs" element={<AdminLogsPage />} />
                  </Route>

                  {/* 404 */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Container>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
