"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Message {
  sender: "User" | "AI";
  text: string;
  table?: {
    headers: string[];
    rows: string[][];
  };
  bullets?: string[];
  citation?: string;
}

export default function DemoPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "AI",
      text: "Welcome to the Interactive RAG Playground! I have loaded Q2_Sales_Data.csv and project_brief.pdf. Try asking a question or select one of the Quick Start queries below.",
    },
  ]);

  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleQuery = (queryText: string) => {
    if (!queryText.trim() || isTyping) return;

    const userMsg: Message = { sender: "User", text: queryText };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      let aiResponse: Message;

      const norm = queryText.toLowerCase();
      if (norm.includes("sales") || norm.includes("rep") || norm.includes("jenkins")) {
        aiResponse = {
          sender: "AI",
          text: "Based on Q2_Sales_Data.csv, Sarah Jenkins was our top performing sales representative in May.",
          table: {
            headers: ["Rep Name", "Total Sales", "Region"],
            rows: [["Sarah Jenkins", "$18,450", "East Coast"]],
          },
          citation: "Source: Q2_Sales_Data.csv : Row 143",
        };
      } else if (norm.includes("brief") || norm.includes("objectives") || norm.includes("summarize")) {
        aiResponse = {
          sender: "AI",
          text: "Here is a summary of the core objectives extracted from project_brief.pdf:",
          bullets: [
            "Reduce database query latency by 35% using pgvector index strategies",
            "Enforce multi-tenant schema isolation at the row level",
            "Implement auto-scaled background Celery task ingestion workers",
          ],
          citation: "Source: project_brief.pdf : Page 3",
        };
      } else if (norm.includes("anomaly") || norm.includes("anomalies") || norm.includes("outlier")) {
        aiResponse = {
          sender: "AI",
          text: "A potential data outlier was detected in Q2_Sales_Data.csv:",
          table: {
            headers: ["Rep Name", "Sales Amount", "Anomaly Reason"],
            rows: [["Unknown Rep", "$95,000", "Sales exceed historical averages by 800%"]],
          },
          citation: "Source: Q2_Sales_Data.csv : Row 92",
        };
      } else {
        aiResponse = {
          sender: "AI",
          text: "This is a simulated response in the Interactive Demo sandbox. In the actual application, our FastAPI service handles secure PostgreSQL vector database uploads and runs live RAG queries.",
        };
      }

      setMessages((prev) => [...prev, aiResponse]);
    }, 900);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    handleQuery(inputValue);
    setInputValue("");
  };

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
            <Link href="/demo" className="text-sm font-medium text-white transition-colors">
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
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Interactive RAG Playground
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
            Query index tables, database records, and document files using natural language.
          </p>
        </div>

        {/* Dashboard Playground Grid */}
        <div className="grid md:grid-cols-12 gap-8 mb-16">
          {/* Sidebar - Source Libraries */}
          <div className="md:col-span-4 bg-[#0d1225]/30 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
              <h3 className="text-sm font-bold text-gray-200 tracking-wide uppercase">Source Libraries</h3>
              <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 font-semibold">Active</span>
            </div>
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-white truncate max-w-[150px]">Q2_Sales_Data.csv</span>
                  <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px]">Ready</span>
                </div>
                <span className="text-[10px] text-gray-500">12 KB - CSV File</span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-white truncate max-w-[150px]">project_brief.pdf</span>
                  <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px]">Ready</span>
                </div>
                <span className="text-[10px] text-gray-500">840 KB - PDF Document</span>
              </div>
            </div>
          </div>

          {/* Chat Panel */}
          <div className="md:col-span-8 bg-[#0a0f1d]/85 border border-white/10 rounded-2xl shadow-2xl p-6 backdrop-blur-md flex flex-col h-[550px] justify-between relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
            <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-4">
              <span className="w-3 h-3 rounded-full bg-red-500/40" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/40" />
              <span className="w-3 h-3 rounded-full bg-green-500/40" />
              <span className="text-xs text-gray-500 ml-2 font-mono">sandbox-session-active</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === "User" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 text-sm shadow-md ${
                    msg.sender === "User"
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-sm"
                      : "bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm"
                  }`}>
                    <p className="leading-relaxed mb-3">{msg.text}</p>
                    {msg.bullets && (
                      <ul className="list-disc list-inside space-y-2 mb-3 text-gray-300">
                        {msg.bullets.map((bullet, idx) => (
                          <li key={idx}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                    {msg.table && (
                      <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 mb-3">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-white/5 border-b border-white/10">
                              {msg.table.headers.map((h, idx) => (
                                <th key={idx} className="p-3 text-gray-400 font-semibold">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.table.rows.map((row, idx) => (
                              <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                {row.map((cell, cidx) => (
                                  <td key={cidx} className="p-3 text-white font-medium">{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {msg.citation && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-gray-500">Source:</span>
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded cursor-default font-mono">
                          {msg.citation}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 text-gray-400 rounded-2xl rounded-tl-sm p-4 text-xs flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                    AI is querying pgvector database &amp; generating response...
                  </div>
                </div>
              )}
            </div>
            <div className="mb-4">
              <span className="text-[10px] font-bold text-gray-500 tracking-wider uppercase block mb-2">Quick Start Suggestions:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuery("Who is our top sales representative?")}
                  disabled={isTyping}
                  className="text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all text-left disabled:opacity-50"
                >
                  * Top sales representative?
                </button>
                <button
                  type="button"
                  onClick={() => handleQuery("Summarize the project brief objectives")}
                  disabled={isTyping}
                  className="text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all text-left disabled:opacity-50"
                >
                  * Summarize project brief
                </button>
                <button
                  type="button"
                  onClick={() => handleQuery("Are there any data anomalies?")}
                  disabled={isTyping}
                  className="text-xs bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all text-left disabled:opacity-50"
                >
                  * Find data anomalies
                </button>
              </div>
            </div>
            <form onSubmit={handleFormSubmit} className="flex items-center gap-3 bg-white/5 border border-white/10 p-2 rounded-xl">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isTyping}
                placeholder="Ask about your documents or databases..."
                className="flex-1 bg-transparent text-sm focus:outline-none text-white px-3 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isTyping || !inputValue.trim()}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Query
              </button>
            </form>
          </div>
        </div>

        {/* CTA Banner Section */}
        <div className="bg-gradient-to-r from-blue-900/20 via-indigo-900/20 to-purple-900/20 border border-white/10 rounded-3xl p-12 text-center relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
          <h2 className="text-3xl font-extrabold text-white mb-6">
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
      </main>
    </div>
  );
}
