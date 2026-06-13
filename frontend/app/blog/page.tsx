import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog — AI Document Chat, Natural Language SQL & RAG Guides",
  description: "Learn how to chat with PDFs, CSVs, Excel, Word documents and databases using AI. Guides on RAG, natural language SQL, and more.",
  keywords: ["AI document chat blog", "RAG guide", "natural language SQL tutorial", "chat with CSV guide", "AI document analysis"],
  openGraph: {
    title: "ChatWithDB Blog — AI Document Chat & Database Querying",
    description: "Learn how to chat with PDFs, CSVs, Excel, Word documents and databases using AI.",
  },
};

const blogPosts = [
  {
    slug: "chat-with-csv-ai",
    title: "How to Chat with Your CSV Files Using AI (No Coding Required)",
    description: "Learn how to upload CSV files and ask questions in plain English. AI-powered CSV analysis with insta...",
    date: "June 13, 2026",
    readTime: "5 min read",
  },
  {
    slug: "chat-with-pdf-ai",
    title: "Chat with PDF Documents Using Natural Language - Complete Guide",
    description: "Upload PDF documents and ask questions in plain English. AI-powered PDF analysis with instant answer...",
    date: "June 13, 2026",
    readTime: "5 min read",
  },
  {
    slug: "natural-language-sql-database",
    title: "How to Query Your Database Using Plain English (Natural Language SQL)",
    description: "Turn natural language into database queries. Ask questions in English and get SQL-powered answers fr...",
    date: "June 13, 2026",
    readTime: "5 min read",
  },
  {
    slug: "rag-document-search-guide",
    title: "RAG-Powered Document Search: The Complete Guide to AI Document Chat",
    description: "Learn how RAG powers document chat. How AI finds answers across PDFs, CSVs, DOCX files and databases...",
    date: "June 13, 2026",
    readTime: "5 min read",
  },
  {
    slug: "ai-excel-spreadsheet-analysis",
    title: "How to Analyze Excel Spreadsheets with AI (Upload, Chat, Get Insights)",
    description: "Upload XLSX spreadsheets and analyze them with AI. Ask questions, get instant answers with row-level...",
    date: "June 13, 2026",
    readTime: "5 min read",
  },
  {
    slug: "ai-document-analysis-pdf-txt-doc",
    title: "AI Document Analysis: Chat with PDF, TXT, DOC and DOCX Files",
    description: "Upload PDF, TXT, DOC, and DOCX files for AI-powered analysis. Get summaries, extract insights from a...",
    date: "June 13, 2026",
    readTime: "5 min read",
  },
  {
    slug: "chat-word-documents-docx",
    title: "How to Chat with Word (DOCX/DOC) Documents Using AI",
    description: "Upload Word documents and ask questions in plain English. AI-powered DOCX analysis with formatting p...",
    date: "June 13, 2026",
    readTime: "5 min read",
  },
];
export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-[#07090e] text-white relative overflow-x-hidden font-sans">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <header className="border-b border-white/5 bg-[#07090e]/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-20 flex justify-between items-center">
          <Link href="/" className="font-extrabold text-2xl bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">ChatWithDB</Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">Back to Home</Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">Blog</h1>
        <p className="text-gray-400 text-lg mb-12 max-w-2xl">Guides, tutorials, and deep dives into AI-powered document chat, natural language database querying, and RAG technology.</p>
        <div className="grid gap-8">
          {blogPosts.map((post) => (
            <Link key={post.slug} href={"/blog/" + post.slug} className="block bg-[#0d1225]/40 border border-white/5 rounded-2xl p-6 hover:border-blue-500/30 hover:bg-[#0d1225]/60 transition-all duration-300 group">
              <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                <span>{post.date}</span>
                <span>&bull;</span>
                <span>{post.readTime}</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">{post.title}</h2>
              <p className="text-gray-400 text-sm leading-relaxed">{post.description}</p>
            </Link>
          ))}
        </div>
      </main>
      <footer className="border-t border-white/5 py-8 mt-16">
        <div className="max-w-5xl mx-auto px-6 text-center text-gray-500 text-sm">&copy; 2026 ChatWithDB. All rights reserved.</div>
      </footer>
    </div>
  );
}
