import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Briefcase, Lock, Mail, AlertCircle, User, UserPlus } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'hr_admin' | 'interviewer'>('interviewer');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    let success = false;
    if (mode === 'login') {
      success = await login(email, password);
      if (!success) setError('Invalid email or password');
    } else {
      success = await register(email, password, name, role);
      if (!success) setError('Registration failed. Email may already be registered.');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#0070f3]/10 mb-4">
            <Briefcase className="w-6 h-6 text-[#0070f3]" />
          </div>
          <h1 className="text-2xl font-semibold text-[#111111] tracking-tight">Hiring Co-Pilot</h1>
          <p className="text-sm text-[#71717a] mt-1">by SeedlingLabs</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#e4e4e7] rounded-xl shadow-sm p-6">

          {/* Tab Switcher */}
          <div className="flex gap-1 mb-5 p-1 bg-[#f4f4f5] rounded-lg">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
                mode === 'login'
                  ? 'bg-white text-[#111111] shadow-sm'
                  : 'text-[#71717a] hover:text-[#111111]'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
                mode === 'signup'
                  ? 'bg-white text-[#111111] shadow-sm'
                  : 'text-[#71717a] hover:text-[#111111]'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a1a1aa]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 border border-[#e4e4e7] rounded-lg text-sm focus:outline-none focus:border-[#0070f3] focus:ring-2 focus:ring-[#0070f3]/10 transition-all"
                    placeholder="Your full name"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a1a1aa]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-[#e4e4e7] rounded-lg text-sm focus:outline-none focus:border-[#0070f3] focus:ring-2 focus:ring-[#0070f3]/10 transition-all"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a1a1aa]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-[#e4e4e7] rounded-lg text-sm focus:outline-none focus:border-[#0070f3] focus:ring-2 focus:ring-[#0070f3]/10 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">I am a...</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('hr_admin')}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      role === 'hr_admin'
                        ? 'border-[#0070f3] bg-[#0070f3]/5'
                        : 'border-[#e4e4e7] hover:border-[#d4d4d8]'
                    }`}
                  >
                    <Briefcase className={`w-5 h-5 mb-1.5 ${role === 'hr_admin' ? 'text-[#0070f3]' : 'text-[#a1a1aa]'}`} />
                    <p className={`text-sm font-medium ${role === 'hr_admin' ? 'text-[#0070f3]' : 'text-[#374151]'}`}>HR Admin</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('interviewer')}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      role === 'interviewer'
                        ? 'border-[#0070f3] bg-[#0070f3]/5'
                        : 'border-[#e4e4e7] hover:border-[#d4d4d8]'
                    }`}
                  >
                    <UserPlus className={`w-5 h-5 mb-1.5 ${role === 'interviewer' ? 'text-[#0070f3]' : 'text-[#a1a1aa]'}`} />
                    <p className={`text-sm font-medium ${role === 'interviewer' ? 'text-[#0070f3]' : 'text-[#374151]'}`}>Interviewer</p>
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-[#0070f3] hover:bg-[#0060df] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {isLoading
                ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#a1a1aa] mt-6">
          Hiring Co-Pilot · SeedlingLabs
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
