import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import Login from './pages/Login';
import SecretaryDashboard from './pages/SecretaryDashboard';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('/login');

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.role === 'admin') {
          setCurrentPage('/admin');
        } else if (user.role === 'secretary') {
          setCurrentPage('/secretary');
        } else if (user.role === 'teacher') {
          setCurrentPage('/teacher');
        }
      } else {
        setCurrentPage('/login');
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
            <span className="text-2xl font-bold text-white">EBD</span>
          </div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {currentPage === '/login' && <Login />}
      {currentPage === '/secretary' && <SecretaryDashboard />}
      {currentPage === '/admin' && <AdminDashboard />}
      {currentPage === '/teacher' && <TeacherDashboard />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
}
