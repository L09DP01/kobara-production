'use client'

import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { Terminal } from 'lucide-react';

import { DocsAIAssistant } from '@/components/docs/DocsAIAssistant';

export function DocsClient({
  isAuthenticated,
  markdownContent,
  currentSlug = 'quickstart'
}: {
  isAuthenticated: boolean,
  markdownContent: string,
  currentSlug?: string
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const NavItem = ({ id, label, isSubItem = false }: { id: string, label: string, isSubItem?: boolean }) => {
    const isActive = currentSlug === id;
    return (
      <Link 
        href={`/docs/${id}`}
        onClick={() => setIsMobileMenuOpen(false)}
        className={clsx(
          "w-full text-left py-2.5 px-4 transition-all text-[14px] rounded-lg flex items-center gap-3",
          isActive
            ? "text-[#FF4A1C] bg-[#FF4A1C]/10 border-l-[3px] border-[#FF4A1C] font-bold rounded-l-none"
            : "text-[#AAB3C2] hover:text-white hover:bg-[#1E2A38]/50 font-medium",
          isSubItem && "pl-8"
        )}
      >
        <span>{label}</span>
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="py-6 space-y-8">
      <div className="flex flex-col gap-1">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#AAB3C2]/50 px-4 mb-3">Getting Started</h3>
        <NavItem id="quickstart" label="Quickstart" />
        <NavItem id="api-keys" label="API Keys" />
        <NavItem id="authentication" label="Authentication" />
      </div>
      
      <div className="flex flex-col gap-1">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#AAB3C2]/50 px-4 mb-3">SDKs & Libraries</h3>
        <NavItem id="javascript-sdk" label="JavaScript SDK" />
        <NavItem id="nodejs-sdk" label="Node.js SDK" />
        <NavItem id="python-sdk" label="Python SDK" />
        <NavItem id="php-sdk" label="PHP SDK" />
      </div>
      
      <div className="flex flex-col gap-1">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#AAB3C2]/50 px-4 mb-3">Integrations</h3>
        <NavItem id="wordpress-plugin" label="WordPress Plugin" />
        <NavItem id="ai-integration" label="AI Integration" />
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#AAB3C2]/50 px-4 mb-3">Core API</h3>
        <NavItem id="payments" label="Payments" />
        <NavItem id="payment-links" label="Payment Links" />
        <NavItem id="webhooks" label="Webhooks" />
        <NavItem id="withdrawals" label="Withdrawals" />
        <NavItem id="metadata" label="Metadata & Expansion" />
        <NavItem id="errors" label="Errors" />
      </div>
    </div>
  );

  const CodeBlock = ({ title, code, language = 'terminal' }: { title?: string, code: string, language?: string }) => {
    const displayTitle = title || (language === 'txt' || language === 'terminal' ? 'Terminal' : language.toUpperCase());
    
    return (
      <div className="bg-[#020B14] rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] my-8 border border-[#1E2A38] relative group">
        <div className="bg-[#07111F] px-5 py-3 border-b border-[#1E2A38] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FF5F56]"></div>
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E]"></div>
              <div className="w-3 h-3 rounded-full bg-[#27C93F]"></div>
            </div>
            <span className="text-[#AAB3C2] text-xs font-mono ml-1 font-medium tracking-wider uppercase flex items-center gap-2">
              <Terminal className="w-3 h-3" />
              {displayTitle}
            </span>
          </div>
          <button 
            onClick={() => navigator.clipboard.writeText(code)}
            className="text-[#AAB3C2] hover:text-[#FF4A1C] transition-colors flex items-center justify-center p-1.5 rounded-md hover:bg-[#FF4A1C]/10"
            title="Copier le code"
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
          </button>
        </div>
        <pre className="p-6 text-[13px] font-mono text-[#AAB3C2] overflow-x-auto leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    );
  };

  return (
    <div className="bg-[#020B14] font-sans text-white antialiased min-h-[100dvh] flex selection:bg-[#FF4A1C]/30 selection:text-white">
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        "fixed flex flex-col z-40 bg-[#07111F] text-white w-[280px] left-0 top-0 bottom-0 border-r border-[#1E2A38] transition-transform duration-300 ease-in-out md:translate-x-0 md:flex shadow-2xl md:shadow-none",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header inside Sidebar */}
        <div className="px-6 py-6 border-b border-[#1E2A38] flex justify-between items-center bg-[#07111F]">
          <Link href="/" className="font-bold text-xl flex items-center gap-3 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Icone.png" alt="Kobara" className="w-8 h-8 object-contain" />
            Kobara <span className="text-[#AAB3C2] font-normal">Docs</span>
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-full bg-[#1E2A38] text-[#AAB3C2] hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 space-y-4 py-6 scrollbar-thin">
          <SidebarContent />
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-[100dvh] ml-0 md:ml-[280px] lg:mr-[450px] w-full md:w-[calc(100%-280px)] lg:w-[calc(100%-280px-450px)] relative">
        
        {/* Top Nav */}
        <header className="bg-[#020B14]/80 backdrop-blur-xl border-b border-[#1E2A38] fixed top-0 right-0 w-full md:w-[calc(100%-280px)] lg:w-[calc(100%-280px-450px)] flex justify-between items-center h-16 sm:h-20 px-6 sm:px-10 z-40 transition-all duration-200">
          <div className="flex items-center gap-4 sm:gap-6">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-[#07111F] hover:bg-[#1E2A38] text-white transition-colors border border-[#1E2A38]"
            >
              <span className="material-symbols-outlined text-[20px]">{isMobileMenuOpen ? 'close' : 'menu_open'}</span>
            </button>
            <div className="flex flex-col">
              <h2 className="text-lg sm:text-xl text-white tracking-tight font-bold">
                <span className="md:hidden">Docs API</span>
                <span className="hidden md:inline">Documentation API</span>
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <a href={process.env.NEXT_PUBLIC_KOBARA_API_URL || 'https://api.kobara.app'} target="_blank" rel="noreferrer" className="hidden sm:flex text-sm text-[#AAB3C2] hover:text-white items-center gap-2 transition-colors bg-[#07111F] px-4 py-2 rounded-full border border-[#1E2A38]">
              <span className="w-2 h-2 rounded-full bg-[#FF4A1C] animate-pulse"></span>
              API Status
            </a>
            <div className="w-px h-6 bg-[#1E2A38] hidden sm:block mx-2"></div>
            {isAuthenticated ? (
              <Link href="/dashboard" className="bg-[#FF4A1C] hover:bg-[#FF2E14] text-white px-5 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,74,28,0.3)] hover:shadow-[0_0_25px_rgba(255,74,28,0.5)]">
                <span className="material-symbols-outlined text-[18px]">dashboard</span>
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            ) : (
              <Link href="/" className="bg-[#07111F] hover:bg-[#1E2A38] text-white px-5 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 border border-[#1E2A38]">
                <span className="material-symbols-outlined text-[18px]">home</span>
                <span className="hidden sm:inline">Accueil</span>
              </Link>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-6 sm:px-10 flex flex-col max-w-[840px] mx-auto w-full pt-28 pb-16 min-w-0">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]} 
            rehypePlugins={[rehypeSlug]}
            components={{
              h1: ({node, ...props}: any) => <h1 className="text-4xl sm:text-5xl font-black mt-10 mb-6 tracking-tighter text-white scroll-mt-28" {...props} />,
              h2: ({node, ...props}: any) => <h2 className="text-2xl sm:text-3xl font-bold mt-16 mb-6 scroll-mt-28 border-b border-[#1E2A38] pb-4 text-white" {...props} />,
              h3: ({node, ...props}: any) => <h3 className="text-xl font-bold mt-10 mb-4 scroll-mt-28 text-white" {...props} />,
              h4: ({node, ...props}: any) => <h4 className="text-lg font-semibold mt-8 mb-3 scroll-mt-28 text-white" {...props} />,
              p: ({node, ...props}: any) => <p className="text-[#AAB3C2] text-[16px] mb-5 leading-relaxed font-medium" {...props} />,
              a: ({node, ...props}: any) => <a className="text-[#FF4A1C] hover:text-[#FF2E14] font-semibold transition-colors decoration-[#FF4A1C]/30 hover:decoration-[#FF2E14] underline underline-offset-4" {...props} />,
              ul: ({node, ...props}: any) => <ul className="list-disc list-outside ml-6 space-y-2 text-[#AAB3C2] text-[16px] mb-6 font-medium" {...props} />,
              li: ({node, ...props}: any) => <li className="pl-2 marker:text-[#FF4A1C]" {...props} />,
              hr: ({node, ...props}: any) => <hr className="border-[#1E2A38] my-10" {...props} />,
              table: ({node, ...props}: any) => (
                <div className="bg-[#07111F] border border-[#1E2A38] rounded-2xl overflow-hidden shadow-lg mb-8 w-full overflow-x-auto">
                  <table className="w-full text-left text-[15px]" {...props} />
                </div>
              ),
              th: ({node, ...props}: any) => <th className="p-5 font-bold text-white border-b border-[#1E2A38] bg-[#020B14] uppercase tracking-wider text-xs" {...props} />,
              td: ({node, ...props}: any) => <td className="p-5 border-b border-[#1E2A38] text-[#AAB3C2] font-medium" {...props} />,
              code({node, inline, className, children, ...props}: any) {
                const match = /language-(\w+)/.exec(className || '')
                if (!inline && match) {
                  return (
                    <CodeBlock 
                      language={match[1]}
                      code={String(children).replace(/\n$/, '')} 
                    />
                  )
                }
                return <code className="bg-[#1E2A38]/50 px-2 py-1 rounded-md text-[14px] text-[#FF4A1C] font-mono border border-[#1E2A38]" {...props}>{children}</code>
              }
            }}
          >
            {markdownContent}
          </ReactMarkdown>
        </main>
      </div>

      {/* Docs AI Assistant Panel */}
      <DocsAIAssistant currentSlug={currentSlug} />
    </div>
  );
}
