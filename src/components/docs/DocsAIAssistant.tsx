'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Send, Copy, Check, X, TerminalSquare, Loader2, Sparkles, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';

export function DocsAIAssistant({ currentSlug = '' }: { currentSlug?: string }) {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('kobara_docs_chat_history');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Bonjour ! Je suis l\'assistant IA de Kobara. Comment puis-je vous aider avec votre intégration aujourd\'hui ? (ex: "Comment créer un paiement", "Valider mon code", etc.)'
      }
    ];
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { id: Date.now().toString(), role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/docs/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, page: currentSlug })
      });

      if (!response.ok) throw new Error('API Error');
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      if (reader) {
        setMessages([...newMessages, { id: (Date.now() + 1).toString(), role: 'assistant', content: '' }]);
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          assistantMessage += decoder.decode(value, { stream: true });
          
          setMessages(prev => {
            const last = prev[prev.length - 1];
            return [...prev.slice(0, -1), { ...last, content: assistantMessage }];
          });
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Une erreur est survenue lors de la communication avec le serveur.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('kobara_docs_chat_history', JSON.stringify(messages));
    }
  }, [messages]);

  const clearChat = () => {
    const init = [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Bonjour ! Je suis l\'assistant IA de Kobara. Comment puis-je vous aider avec votre intégration aujourd\'hui ? (ex: "Comment créer un paiement", "Valider mon code", etc.)'
      }
    ];
    setMessages(init);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('kobara_docs_chat_history');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');
    
    if (!inline && match) {
      const isCopied = copiedCode === codeString;
      return (
        <div className="relative group my-4 rounded-lg overflow-hidden border border-[#1E2A38] bg-[#020B14]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#07111F] border-b border-[#1E2A38]">
            <span className="text-xs font-mono text-[#AAB3C2] uppercase tracking-wider">{match[1]}</span>
            <button 
              onClick={() => copyToClipboard(codeString)}
              className="p-1.5 rounded-md hover:bg-[#1E2A38] text-[#AAB3C2] hover:text-white transition-colors"
            >
              {isCopied ? <Check size={14} className="text-[#27C93F]" /> : <Copy size={14} />}
            </button>
          </div>
          <pre className="p-3 text-[13px] overflow-x-auto text-[#AAB3C2]">
            <code className={className} {...props}>{children}</code>
          </pre>
        </div>
      );
    }
    return <code className="bg-[#1E2A38]/50 px-1.5 py-0.5 rounded text-[13px] text-[#FF4A1C] font-mono border border-[#1E2A38]" {...props}>{children}</code>;
  };

  // UI du Chat (Réutilisable Desktop/Mobile)
  const chatInterfaceNode = (
    <div className="flex flex-col h-full min-h-0 bg-[#07111F] border-l border-[#1E2A38] shadow-2xl">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-[#1E2A38] bg-[#020B14]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#07111F] border border-[#1E2A38] flex items-center justify-center text-[#FF4A1C] shadow-[0_0_15px_rgba(255,74,28,0.2)]">
            <Sparkles size={18} className="animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-[15px] text-white">Kobara AI</h3>
            <p className="text-[12px] text-[#AAB3C2] font-medium leading-none mt-1">Assistant Intégration</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 1 && (
            <button 
              onClick={clearChat}
              title="Effacer la conversation"
              className="p-2 text-[#AAB3C2] hover:text-[#FF4A1C] rounded-lg hover:bg-[#FF4A1C]/10 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button 
            onClick={() => setIsOpenMobile(false)}
            className="md:hidden p-2 text-[#AAB3C2] hover:text-white rounded-lg hover:bg-[#1E2A38] transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6 scrollbar-thin">
        {messages.map((m: any) => (
          <div key={m.id} className={clsx("flex gap-4", m.role === 'user' ? "flex-row-reverse" : "")}>
            <div className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-md",
              m.role === 'user' 
                ? "bg-[#020B14] border border-[#1E2A38] text-white" 
                : "bg-[#FF4A1C]/10 border border-[#FF4A1C]/20 text-[#FF4A1C]"
            )}>
              {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            
            <div className={clsx(
              "max-w-[85%] px-5 py-4 text-[14px] leading-relaxed shadow-lg",
              m.role === 'user'
                ? "bg-[#020B14] border border-[#1E2A38] text-white rounded-2xl rounded-tr-sm"
                : "bg-[#07111F] border border-[#1E2A38] text-[#AAB3C2] rounded-2xl rounded-tl-sm"
            )}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  code: CodeBlock,
                  p: ({children}) => <p className="mb-3 last:mb-0 text-[14px] font-medium leading-relaxed">{children}</p>,
                  a: ({href, children}) => <a href={href} className="text-[#FF4A1C] hover:text-[#FF2E14] underline font-semibold transition-colors">{children}</a>,
                  ul: ({children}) => <ul className="list-disc ml-5 mb-3 space-y-1">{children}</ul>,
                  ol: ({children}) => <ol className="list-decimal ml-5 mb-3 space-y-1">{children}</ol>,
                  strong: ({children}) => <strong className="font-bold text-white">{children}</strong>,
                }}
              >
                {m.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
             <div className="w-8 h-8 rounded-full bg-[#FF4A1C]/10 border border-[#FF4A1C]/20 text-[#FF4A1C] flex items-center justify-center shrink-0 mt-1 shadow-md">
              <Bot size={14} />
            </div>
            <div className="bg-[#07111F] border border-[#1E2A38] rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-3 text-[#AAB3C2] shadow-lg">
              <Loader2 size={16} className="animate-spin text-[#FF4A1C]" />
              <span className="text-[14px] animate-pulse font-medium">L'IA analyse le contexte...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-[#020B14] border-t border-[#1E2A38]">
        <form onSubmit={handleSubmit} className="relative flex items-end">
          <textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Posez une question ou collez du code..."
            className="w-full bg-[#07111F] text-white placeholder:text-[#AAB3C2]/50 text-[14px] rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-1 focus:ring-[#FF4A1C] focus:border-[#FF4A1C] resize-none max-h-32 min-h-[50px] border border-[#1E2A38] transition-all font-medium scrollbar-thin"
            rows={input.split('\n').length > 1 ? Math.min(input.split('\n').length, 5) : 1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="absolute right-2 bottom-2 w-8 h-8 bg-[#FF4A1C] hover:bg-[#FF2E14] text-white rounded-lg flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,74,28,0.3)] hover:shadow-[0_0_20px_rgba(255,74,28,0.5)] active:scale-95"
          >
            <Send size={14} className="ml-0.5" />
          </button>
        </form>
        <div className="text-center mt-3">
          <span className="text-[10px] text-[#AAB3C2]/60 uppercase tracking-widest font-bold flex items-center justify-center gap-1.5">
            <TerminalSquare size={12} />
            Copiez-collez votre code pour l'analyser
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* --- DESKTOP (Fixe à droite sous le header) --- */}
      <aside className="hidden lg:block fixed right-0 top-16 sm:top-20 bottom-0 w-[450px] z-30 transform transition-transform">
        {chatInterfaceNode}
      </aside>

      {/* --- MOBILE (Bouton flottant + Drawer) --- */}
      <div className="lg:hidden">
        {/* Floating Button */}
        <AnimatePresence>
          {!isOpenMobile && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => setIsOpenMobile(true)}
              className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#FF4A1C] text-white rounded-full shadow-[0_0_30px_rgba(255,74,28,0.4)] flex items-center justify-center hover:scale-105 transition-transform border border-white/10"
            >
              <Sparkles size={24} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Fullscreen Drawer */}
        <AnimatePresence>
          {isOpenMobile && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
                onClick={() => setIsOpenMobile(false)}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-x-0 bottom-0 top-[10vh] z-50 bg-[#07111F] rounded-t-3xl overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col border-t border-[#1E2A38]"
              >
                {/* Handle for drawer */}
                <div className="w-full flex justify-center py-3 absolute top-0 z-10">
                  <div className="w-12 h-1.5 bg-[#1E2A38] rounded-full" />
                </div>
                <div className="flex-1 mt-6 min-h-0">
                  {chatInterfaceNode}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
