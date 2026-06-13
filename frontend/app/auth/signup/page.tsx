'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signup(email, password, fullName);
      // Redirect to the chat app after successful signup
      router.push('/app');
    } catch (err) {
      setError('Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col relative overflow-x-hidden font-sans">
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none z-0" />

      {/* Decorative Radial Glowing Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-gradient-to-b from-blue-500/10 to-transparent blur-3xl rounded-full pointer-events-none z-0" />

      {/* Header/Navbar */}
      <header className="border-b border-white/5 bg-[#07090e]/40 backdrop-blur-md sticky top-0 z-50 relative z-20">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center relative z-20">
          <Link href="/" className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent hover:opacity-90 transition-opacity">
            ChatWithDB
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
               Features
             </Link>
            <Link href="/demo" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
               Interactive Demo
             </Link>
            <Link href="/tech" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
               Tech Stack
             </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="text-sm font-semibold text-white bg-white/5 border border-white/10 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors">
              Sign In
            </Link>
            <Link href="/auth/signup" className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.35)]">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Form Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">
        {/* Header Section */}
        <div className="text-center mb-8 max-w-md">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
            Chat with Database
          </h1>
          <p className="text-sm text-gray-400 mt-3 leading-relaxed">
            Create your account to get started
          </p>
        </div>

        <div className="w-full max-w-md bg-[#0a0f1d]/85 border border-white/10 rounded-2xl shadow-2xl p-8 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="fullName" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                required
                className="w-full bg-[#07090e]/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                className="w-full bg-[#07090e]/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-950/20 border border-red-500/20 rounded-xl p-3 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.35)] disabled:opacity-50"
            >
              {isLoading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          <div className="text-center mt-6 text-sm text-gray-400">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}