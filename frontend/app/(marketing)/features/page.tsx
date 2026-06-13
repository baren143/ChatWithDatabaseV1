import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features — AI Document Chat & Database Querying",
  description: "Explore ChatWithDB features: multi-format support for PDF, CSV, Excel, natural language SQL queries, cited verification, and secure vector search.",
};


export default function FeaturesPage() {
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
            <Link href="/features" className="text-sm font-medium text-white transition-colors">
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
            Advanced RAG Capabilities
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
            Built on PostgreSQL with pgvector and FastAPI to guarantee enterprise-speed querying and secure access.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-24">
          {/* Card 1 */}
          <div className="bg-[#0d1225]/30 border border-white/5 rounded-2xl p-6 hover:border-blue-500/30 hover:bg-[#0d1225]/50 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Multi-Format Support</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Connect and search across PDFs, raw text, CSVs, and Excel sheets. AI parses both structured tables and unstructured paragraphs.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-[#0d1225]/30 border border-white/5 rounded-2xl p-6 hover:border-indigo-500/30 hover:bg-[#0d1225]/50 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Natural Language SQL</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Translate conversational questions directly into vector searches and JSONB queries. No SQL skills required to extract database insights.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-[#0d1225]/30 border border-white/5 rounded-2xl p-6 hover:border-purple-500/30 hover:bg-[#0d1225]/50 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2m-4-1H5" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Cited Verifications</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Every response displays the exact source document name and row indices. Audit answers instantly to eliminate hallucination risks.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-[#0d1225]/30 border border-white/5 rounded-2xl p-6 hover:border-emerald-500/30 hover:bg-[#0d1225]/50 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Secure Sandbox</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Your data stays private. Protected by JWT auth, row-level isolation, and secure PostgreSQL vector boundaries.
            </p>
          </div>
        </div>

        {/* CTA Banner Section */}
        <div className="bg-gradient-to-r from-blue-900/20 via-indigo-900/20 to-purple-900/20 border border-white/10 rounded-3xl p-12 text-center relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
          <h2 className="text-3xl font-extrabold text-white mb-6">
            Connect Your Data & Start Chatting
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Experience RAG querying with sub-second response times. Join now and upload your first file in seconds.
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
