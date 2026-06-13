import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chat with PDF Documents Using Natural Language - Complete Guide",
  description: "Upload PDF documents and ask questions in plain English. AI-powered PDF analysis with instant answers, citations, and support for long documents.",
  keywords: ["chat with pdf, ai pdf reader, pdf chatbot, ask pdf questions, ai document analysis"],
};

export default function BlogPost() {
  return (
    <div className="min-h-screen bg-[#07090e] text-white relative overflow-x-hidden font-sans">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <header className="border-b border-white/5 bg-[#07090e]/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-20 flex justify-between items-center">
          <Link href="/" className="font-extrabold text-2xl bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">ChatWithDB</Link>
          <div className="flex items-center gap-4">
            <Link href="/blog" className="text-sm text-gray-400 hover:text-white transition-colors">Blog</Link>
            <Link href="/app" className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">Try It Free</Link>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-gray-300 leading-relaxed">
          <h1 className="text-3xl font-bold mb-6 text-white">Chat with PDF Documents Using Natural Language - Complete Guide</h1><p>Upload PDF documents and ask questions in plain English. AI-powered PDF analysis with instant answers, citations, and support for long documents.</p>
        </div>

        <div className="mt-16 p-8 bg-[#0d1225]/60 border border-blue-500/20 rounded-2xl text-center">
          <h3 className="text-2xl font-bold text-white mb-3">Try It Yourself</h3>
          <p className="text-gray-400 mb-6">Upload your files and start asking questions in seconds.</p>
          <Link href="/app" className="inline-block px-8 py-4 font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">Launch ChatWithDB</Link>
        </div>
      </main>
    </div>
  );
}
