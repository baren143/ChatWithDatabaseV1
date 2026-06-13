import os

BASE = "app/blog"

posts = [
    {
        "slug": "chat-with-csv-ai",
        "title": "How to Chat with Your CSV Files Using AI (No Coding Required)",
        "description": "Learn how to upload CSV files and ask questions in plain English. AI-powered CSV analysis with instant answers, no SQL or Python needed.",
        "keywords": "chat with csv, ai csv analysis, csv chatbot, analyze csv with ai, natural language csv query",
        "content": "Chat with CSV using AI guide content..."
    },
    {
        "slug": "chat-with-pdf-ai",
        "title": "Chat with PDF Documents Using Natural Language - Complete Guide",
        "description": "Upload PDF documents and ask questions in plain English. AI-powered PDF analysis with instant answers, citations, and support for long documents.",
        "keywords": "chat with pdf, ai pdf reader, pdf chatbot, ask pdf questions, ai document analysis",
        "content": "Chat with PDF using AI guide content..."
    },
    {
        "slug": "natural-language-sql-database",
        "title": "How to Query Your Database Using Plain English (Natural Language SQL)",
        "description": "Turn natural language into database queries. Ask questions in English and get SQL-powered answers from any SQL database.",
        "keywords": "natural language sql, query database with ai, text to sql, ai database query",
        "content": "Natural language SQL guide content..."
    },
    {
        "slug": "rag-document-search-guide",
        "title": "RAG-Powered Document Search: The Complete Guide to AI Document Chat",
        "description": "Learn how RAG powers document chat. How AI finds answers across PDFs, CSVs, DOCX files and databases instantly with vector search.",
        "keywords": "rag document search, ai document chat, retrieval augmented generation, rag explained, vector search database",
        "content": "RAG document search guide content..."
    },
    {
        "slug": "ai-excel-spreadsheet-analysis",
        "title": "How to Analyze Excel Spreadsheets with AI (Upload, Chat, Get Insights)",
        "description": "Upload XLSX spreadsheets and analyze them with AI. Ask questions, get instant answers with row-level citations, no formulas needed.",
        "keywords": "ai excel analysis, chat with excel, ai spreadsheet tool, analyze excel with ai",
        "content": "AI Excel analysis guide content..."
    },
    {
        "slug": "ai-document-analysis-pdf-txt-doc",
        "title": "AI Document Analysis: Chat with PDF, TXT, DOC and DOCX Files",
        "description": "Upload PDF, TXT, DOC, and DOCX files for AI-powered analysis. Get summaries, extract insights from any document format instantly.",
        "keywords": "ai document analysis, chat with documents, document chatbot, ai file analysis, text analysis ai",
        "content": "AI document analysis guide content..."
    },
    {
        "slug": "chat-word-documents-docx",
        "title": "How to Chat with Word (DOCX/DOC) Documents Using AI",
        "description": "Upload Word documents and ask questions in plain English. AI-powered DOCX analysis with formatting preservation and instant answers.",
        "keywords": "chat with word documents, ai docx analysis, word document chatbot, analyze docx with ai",
        "content": "Chat with Word documents guide content..."
    },
]

# Create blog index page
index_content = """import type { Metadata } from "next";
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
"""

for post in posts:
    desc = post["description"][:100] + "..."
    index_content += f"""  {{
    slug: "{post['slug']}",
    title: "{post['title']}",
    description: "{desc}",
    date: "June 13, 2026",
    readTime: "5 min read",
  }},
"""

index_content += """];
"""

index_content += """export default function BlogIndex() {
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
"""

os.makedirs(BASE, exist_ok=True)
with open(f"{BASE}/page.tsx", "w") as f:
    f.write(index_content)
print(f"Created blog index")

# Create individual blog post pages
post_template_start = """import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TITLE_PLACEHOLDER",
  description: "DESC_PLACEHOLDER",
  keywords: ["KEYWORDS_PLACEHOLDER"],
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
          CONTENT_PLACEHOLDER
        </div>
"""

post_template_end = """
        <div className="mt-16 p-8 bg-[#0d1225]/60 border border-blue-500/20 rounded-2xl text-center">
          <h3 className="text-2xl font-bold text-white mb-3">Try It Yourself</h3>
          <p className="text-gray-400 mb-6">Upload your files and start asking questions in seconds.</p>
          <Link href="/app" className="inline-block px-8 py-4 font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">Launch ChatWithDB</Link>
        </div>
      </main>
    </div>
  );
}
"""

for post in posts:
    slug = post["slug"]
    post_dir = f"{BASE}/{slug}"
    os.makedirs(post_dir, exist_ok=True)
    
    page = post_template_start.replace("TITLE_PLACEHOLDER", post["title"])
    page = page.replace("DESC_PLACEHOLDER", post["description"])
    page = page.replace("KEYWORDS_PLACEHOLDER", post["keywords"])
    # Use a simple content section
    content_html = f"""<h1 className="text-3xl font-bold mb-6 text-white">{post["title"]}</h1><p>{post["description"]}</p>"""
    page = page.replace("CONTENT_PLACEHOLDER", content_html)
    page += post_template_end
    
    with open(f"{post_dir}/page.tsx", "w") as f:
        f.write(page)
    print(f"  Created: /blog/{slug}")

print(f"Total: {len(posts)} blog posts created")
