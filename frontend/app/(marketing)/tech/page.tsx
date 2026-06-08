import React from "react";
import Link from "next/link";

export default function TechStackPage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-white relative overflow-x-hidden font-sans selection:bg-blue-500/30 selection:text-white">
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
            <Link href="/tech" className="text-sm font-medium text-white transition-colors">
              Tech Stack
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="text-sm font-semibold text-gray-300 hover:text-white transition-colors px-3 py-2">
              Sign In
            </Link>
            <Link href="/auth/signup" className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.35)]">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Our Enterprise Tech Stack
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
            Optimized for low latency ingestion, vector search performance, and secure data isolation.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24">
          {/* Card 1 */}
          <div className="bg-[#0d1225]/30 border border-white/5 rounded-2xl p-6 hover:border-blue-500/30 hover:bg-[#0d1225]/50 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Vector Database</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              PostgreSQL &amp; pgvector
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Stores document chunk embeddings and metadata indices. Uses HNSW index methods for rapid similarity queries.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-[#0d1225]/30 border border-white/5 rounded-2xl p-6 hover:border-indigo-500/30 hover:bg-[#0d1225]/50 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 012 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Backend API Service</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              FastAPI &amp; Uvicorn
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Asynchronous endpoint handling, file upload management, RAG pipelining, and user authentication with JWT tokens.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-[#0d1225]/30 border border-white/5 rounded-2xl p-6 hover:border-purple-500/30 hover:bg-[#0d1225]/50 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Frontend Interface</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              Next.js 15 &amp; Tailwind CSS
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Modern page routing, stateful dashboard views, custom styled tailwind utilities, and responsive design systems.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-[#0d1225]/30 border border-white/5 rounded-2xl p-6 hover:border-pink-500/30 hover:bg-[#0d1225]/50 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Task Queues</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              Celery &amp; Redis Broker
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Handles resource-heavy processes like PDF document chunking and vector index embedding in the background.
            </p>
          </div>

          {/* Card 5 */}
          <div className="bg-[#0d1225]/30 border border-white/5 rounded-2xl p-6 hover:border-emerald-500/30 hover:bg-[#0d1225]/50 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Hosting &amp; Proxy</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              Docker &amp; Nginx
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Containerized deployment, SSL encryption, rate limiting, and reverse proxying mapping all traffic routes.
            </p>
          </div>
        </div>

        {/* CTA Banner Section */}
        <div className="bg-gradient-to-r from-blue-900/20 via-indigo-900/20 to-purple-900/20 border border-white/10 rounded-3xl p-12 text-center relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
          <h2 className="text-3xl font-extrabold text-white mb-6">
            Experience Our Architecture Live
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Fast, secure, and production-ready. Create your workspace now and start querying with zero config required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/auth/signup" className="w-full sm:w-auto px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all hover:shadow-[0_0_25px_rgba(59,130,246,0.4)]">
              Create Free Account
            </Link>
            <Link href="/auth/login" className="w-full sm:w-auto px-8 py-4 text-base font-bold text-gray-300 hover:text-white bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all">
              Sign In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
