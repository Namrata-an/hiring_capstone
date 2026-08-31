import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import HRDashboard from './pages/HRDashboard';
import InterviewerDashboard from './pages/InterviewerDashboard';

// Main App content that uses auth context
const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#0070f3] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-[#71717a]">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in - show login page
  if (!user) {
    return <LoginPage />;
  }

  // Route based on role
  if (user.role === 'hr_admin') {
    return <HRDashboard />;
  }

  if (user.role === 'interviewer') {
    return <InterviewerDashboard />;
  }

  // Fallback
  return <LoginPage />;
};

// Root App with providers
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
