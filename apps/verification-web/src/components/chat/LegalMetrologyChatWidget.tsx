import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  ShieldCheck,
  Maximize2,
  Minimize2,
  RotateCcw,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Bot,
  User,
  HelpCircle,
  Scale,
} from 'lucide-react';
import { useMetrologyChat } from './useMetrologyChat';
import { ChatMessage, StatutoryCitation, PortalActionLink } from './chatTypes';

interface ChatWidgetProps {
  portalContext?: string;
  onNavigateTab?: (tab: any) => void;
}

export const LegalMetrologyChatWidget: React.FC<ChatWidgetProps> = ({
  portalContext = 'trader',
  onNavigateTab,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});

  const {
    messages,
    loading,
    language,
    setLanguage,
    suggestions,
    sendMessage,
    clearChat,
  } = useMetrologyChat(portalContext);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen, loading]);

  const handleSend = (textToSend?: string) => {
    const query = textToSend || inputVal;
    if (!query.trim() || loading) return;
    sendMessage(query);
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleCitation = (msgId: string, citIndex: number) => {
    const key = `${msgId}-${citIndex}`;
    setExpandedCitations((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleActionClick = (action: PortalActionLink) => {
    if (action.target_tab && onNavigateTab) {
      onNavigateTab(action.target_tab);
    } else if (action.target_tab) {
      window.location.hash = `#${action.target_tab}`;
    }
  };

  return (
    <>
      {/* 1. Floating Launcher Bubble */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg border border-slate-700 animate-bounce">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Ask Legal Metrology AI</span>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-700 via-indigo-600 to-amber-500 text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform border-2 border-white/20 relative group"
            title="Open Legal Metrology AI Assistant"
          >
            <Bot className="w-7 h-7" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
          </button>
        </div>
      )}

      {/* 2. Floating Chat Modal */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-200 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden ${
            isExpanded
              ? 'inset-4 sm:inset-10 rounded-2xl'
              : 'bottom-6 right-6 w-full max-w-[420px] h-[620px] rounded-2xl'
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 flex items-center justify-between border-b border-indigo-900/50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/40 border border-indigo-400/40 flex items-center justify-center text-amber-400 shadow-inner">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  Legal Metrology AI Assistant
                  <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/30">
                    RAG
                  </span>
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Grounded in Acts & General Rules 2011
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-slate-300">
              {/* Language Switcher */}
              <button
                onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] font-bold text-amber-400 border border-slate-700 transition-colors"
                title="Toggle Language"
              >
                {language === 'en' ? 'हिंदी' : 'EN'}
              </button>

              {/* Reset Thread */}
              <button
                onClick={clearChat}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                title="Clear Chat History"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Fullscreen Expand/Collapse */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors hidden sm:inline-flex"
                title={isExpanded ? 'Minimize' : 'Expand'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/40 text-xs">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      isUser
                        ? 'bg-indigo-600 text-white'
                        : 'bg-amber-500/20 border border-amber-500/40 text-amber-500 dark:text-amber-400'
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className={`space-y-2 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm whitespace-pre-wrap ${
                        isUser
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* Statutory Citations Accordion */}
                    {!isUser && msg.citations && msg.citations.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-indigo-400" />
                          <span>Official Legal Citations:</span>
                        </div>

                        <div className="space-y-1">
                          {msg.citations.map((cit, idx) => {
                            const citKey = `${msg.id}-${idx}`;
                            const isCitExpanded = expandedCitations[citKey];

                            return (
                              <div
                                key={citKey}
                                className="bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
                              >
                                <button
                                  onClick={() => toggleCitation(msg.id, idx)}
                                  className="w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition-colors"
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[10px] rounded">
                                      {cit.section_rule_ref}
                                    </span>
                                    <span className="font-medium text-[11px] text-slate-700 dark:text-slate-300 truncate">
                                      {cit.title}
                                    </span>
                                  </div>
                                  {isCitExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  )}
                                </button>

                                {isCitExpanded && (
                                  <div className="p-2.5 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                                    <div className="font-semibold text-slate-900 dark:text-slate-200 mb-1">
                                      {cit.act_or_rule}
                                    </div>
                                    {cit.snippet}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Portal Actions Shortcuts */}
                    {!isUser && msg.portal_actions && msg.portal_actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {msg.portal_actions.map((act, i) => (
                          <button
                            key={i}
                            onClick={() => handleActionClick(act)}
                            className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {act.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Dynamic Follow-up Prompt Chips */}
                    {!isUser && msg.suggested_followups && msg.suggested_followups.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {msg.suggested_followups.map((sug, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(sug)}
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-full text-[10px] font-medium transition-colors text-left"
                          >
                            💡 {sug}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 px-1">{msg.timestamp}</div>
                  </div>
                </div>
              );
            })}

            {/* Loading / Analyzing indicator */}
            {loading && (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs py-2 px-1">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center animate-spin">
                  <Sparkles className="w-3 h-3" />
                </div>
                <span>Analyzing Legal Metrology Acts, Rules & Schedules...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips Bar */}
          <div className="p-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 px-1">
              Suggestions:
            </span>
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s)}
                className="whitespace-nowrap px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded-full text-[11px] font-medium transition-colors shrink-0"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  language === 'hi'
                    ? 'विधिक मापविज्ञान, शुल्क या पैकेजिंग नियमों के बारे में पूछें...'
                    : 'Ask about scale registration, verification fees, Section 22, or packaging rules...'
                }
                className="w-full pl-3 pr-10 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputVal.trim() || loading}
                className="absolute right-1.5 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-lg transition-all"
                title="Send Question"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-[10px] text-center text-slate-400 mt-1.5">
              ⚖️ Official AI Guide under The Legal Metrology Act, 2009 & General Rules, 2011.
            </div>
          </div>
        </div>
      )}
    </>
  );
};
