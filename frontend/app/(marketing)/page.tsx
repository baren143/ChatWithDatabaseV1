import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-white relative overflow-x-hidden font-sans selection:bg-blue-500/30 selection:text-white">
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none z-0" />

      {/* Decorative Radial Glowing Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-gradient-to-b from-blue-500/10 to-transparent blur-3xl rounded-full pointer-events-none z-0" />
      <div className="absolute top-[30%] -right-1/4 w-[600px] h-[600px] bg-gradient-to-tr from-purple-500/5 to-transparent blur-3xl rounded-full pointer-events-none z-0" />

      {/* Header/Navbar */}
      <header className="border-b border-white/5 bg-[#07090e]/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center relative z-20">
          <Link href="/" className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent hover:opacity-90 transition-opacity">
            ChatWithDB
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Features</Link>
            <Link href="/demo" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Interactive Demo</Link>
            <Link href="/tech" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Tech Stack</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="text-sm font-semibold text-gray-300 hover:text-white transition-colors px-3 py-2">
              Sign In
            </Link>
            <Link href="/demo" className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.35)]">
              Explore Interactive Sandbox
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold text-blue-400 bg-blue-500/10 rounded-full border border-blue-500/20 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
            AI-Powered Document Ingestion & RAG
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Talk to Your Documents <br />
            &amp; Databases In Real-Time
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Upload files (PDF, CSV, Excel) or query your custom database using natural language. Get instant cited answers with precise table and row citations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/app" className="w-full sm:w-auto px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 transition-all hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] transform hover:-translate-y-0.5">
              Launch App Dashboard
            </Link>
            <Link href="/demo" className="w-full sm:w-auto px-8 py-4 text-base font-bold text-gray-300 hover:text-white bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all transform hover:-translate-y-0.5">
              Explore Interactive Sandbox
            </Link>
          </div>
        </section>

        {/* Mock UI Showcase Section */}
        <section id="demo" className="max-w-5xl mx-auto px-6 mb-32">
          <div className="bg-[#0a0f1d]/85 border border-white/10 rounded-2xl shadow-2xl p-6 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
            
            {/* Header circles */}
            <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
              <span className="w-3 h-3 rounded-full bg-red-500/40" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/40" />
              <span className="w-3 h-3 rounded-full bg-green-500/40" />
              <span className="text-xs text-gray-500 ml-2 font-mono">app.chatwithdb.com/dashboard</span>
            </div>

            <div className="grid md:grid-cols-[250px_1fr] gap-6 min-h-[400px]">
              {/* Sidebar Mockup */}
              <div className="border-r border-white/5 pr-6 flex flex-col gap-4">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <span>Libraries</span>
                  <span className="text-blue-400">+ Upload</span>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-white truncate max-w-[140px]">Q2_Sales_Data.csv</span>
                      <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px]">Ready</span>
                    </div>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="w-full h-full bg-emerald-500" />
                    </div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-2 opacity-75">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-300 truncate max-w-[140px]">project_brief.pdf</span>
                      <span className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded text-[10px] animate-pulse">75%</span>
                    </div>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="w-3/4 h-full bg-blue-500 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Panel Mockup */}
              <div className="flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-4">
                  {/* User Bubble */}
                  <div className="self-end max-w-[85%] bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm shadow-md">
                    Who was our top sales representative in May, and what did they sell?
                  </div>
                  {/* AI Bubble */}
                  <div className="self-start max-w-[90%] bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-200 shadow-md">
                    <p className="mb-3">
                      Based on <span className="text-blue-400 font-semibold cursor-pointer">Q2_Sales_Data.csv</span>, the top representative in May was **Sarah Jenkins**.
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10">
                            <th className="p-3 text-gray-400">Rep Name</th>
                            <th className="p-3 text-gray-400">Total Sales</th>
                            <th className="p-3 text-gray-400">Region</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-white/5">
                            <td className="p-3 text-white font-medium">Sarah Jenkins</td>
                            <td className="p-3 text-emerald-400 font-semibold">$18,450</td>
                            <td className="p-3">East Coast</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] text-gray-500">Source Citations:</span>
                      <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded cursor-pointer hover:bg-blue-500/20 transition-all">
                        Q2_Sales_Data.csv : Row 143
                      </span>
                    </div>
                  </div>
                </div>
                {/* Input mockup */}
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-2 rounded-xl">
                  <div className="flex-1 text-xs text-gray-500 px-3">Ask about your documents or databases...</div>
                  <button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-lg">Send</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="max-w-7xl mx-auto px-6 mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
              Advanced RAG Capabilities
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Built on PostgreSQL with pgvector and FastAPI to guarantee enterprise-speed querying and secure access.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
        </section>

        {/* CTA Banner Section */}
        <section className="max-w-6xl mx-auto px-6 mb-32">
          <div className="bg-gradient-to-r from-blue-900/20 via-indigo-900/20 to-purple-900/20 border border-white/10 rounded-3xl p-12 text-center relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6">
              Connect Your Data &amp; Start Chatting
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
        </section>
      </main>

      {/* Footer */}
      <footer id="tech" className="border-t border-white/5 py-12 bg-black/40 relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} ChatWithDB. All rights reserved.
          </div>
          <div className="text-gray-500 text-sm flex flex-wrap justify-center gap-2">
            <span>Powered by</span>
            <Link href="/tech" className="text-gray-400 font-semibold">PostgreSQL (pgvector)</Link>
            <span>&bull;</span>
            <Link href="/tech" className="text-gray-400 font-semibold">FastAPI</Link>
            <span>&bull;</span>
            <Link href="/tech" className="text-gray-400 font-semibold">Next.js</Link>
            <span>&bull;</span>
            <Link href="/tech" className="text-gray-400 font-semibold">Celery</Link>
            <span>&bull;</span>
            <Link href="/tech" className="text-gray-400 font-semibold">NVIDIA NIM</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}