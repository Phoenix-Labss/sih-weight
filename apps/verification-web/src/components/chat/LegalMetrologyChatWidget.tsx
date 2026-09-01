import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  RotateCcw,
  Maximize2,
  Minimize2,
  Volume2,
  Pause,
  Play,
  Mic,
  MicOff,
  Gauge,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';
import { useMetrologyChat } from './useMetrologyChat';
import { useVoice } from './useVoice';
import { FormattedMarkdown } from './FormattedMarkdown';
import { PortalActionLink } from './chatTypes';
import { NikksMascotIcon } from './NikksMascotIcon';

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
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
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

  const {
    isListening,
    isSpeaking,
    isPaused,
    speakingMsgId,
    speechRate,
    setSpeechRate,
    voiceError,
    setVoiceError,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  } = useVoice(language);

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
    stopSpeaking();
    sendMessage(query);
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      stopSpeaking();
      startListening((transcript) => {
        setInputVal(transcript);
      });
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

  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      {/* 1. Floating Launcher Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 animate-fade-in">
          <div className="hidden sm:flex items-center gap-2 bg-white text-[#0F2D46] text-xs font-bold px-3.5 py-2 rounded-full shadow-lg border border-[#CBD5E1] select-none">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ask Nikks AI</span>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-full bg-[#0F2D46] text-white flex items-center justify-center shadow-2xl hover:bg-[#1E4FA3] hover:scale-105 active:scale-95 transition-all border-2 border-white ring-2 ring-[#0F2D46]/20 relative cursor-pointer"
            title="Open Nikks Chatbot"
            aria-label="Open Nikks Chatbot"
          >
            <NikksMascotIcon size={34} glow={false} />
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white ring-1 ring-[#0F2D46]" />
          </button>
        </div>
      )}

      {/* 2. Chatbot Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Nikks Support Chat"
          className={`fixed z-50 flex flex-col bg-white border border-[#CBD5E1] shadow-[0_12px_45px_-8px_rgba(15,45,70,0.25)] overflow-hidden transition-all duration-200 animate-modal-in ${
            isExpanded
              ? 'inset-3 sm:inset-8 w-auto h-auto rounded-2xl'
              : 'bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-[420px] h-full sm:h-[620px] sm:max-h-[85vh] rounded-none sm:rounded-2xl'
          }`}
        >
          {/* Header (High Contrast Pure White) */}
          <div className="bg-white border-b border-[#CBD5E1] px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between shrink-0">
            {/* Left: Identity */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#0F2D46] border border-[#1E4FA3] ring-1 ring-[#D97706]/40 flex items-center justify-center p-1 shrink-0 shadow-sm">
                <NikksMascotIcon size={24} glow={false} />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#0F2D46] leading-tight tracking-tight">
                  Nikks
                </h3>
                <p className="text-xs text-[#475569] font-medium leading-none mt-0.5">
                  Legal Metrology Guide
                </p>
              </div>
            </div>

            {/* Right: Controls & Actions (High Contrast Navy & Slate) */}
            <div className="flex items-center gap-1.5 text-[#0F2D46]">
              {/* Language Switcher Pill */}
              <div className="flex items-center bg-[#EEF4F8] p-0.5 rounded-full border border-[#CBD5E1]">
                <button
                  onClick={() => {
                    stopSpeaking();
                    setLanguage('en');
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                    language === 'en'
                      ? 'bg-[#0F2D46] text-white shadow-xs'
                      : 'text-[#0F2D46] hover:text-[#1E4FA3]'
                  }`}
                  title="English"
                >
                  EN
                </button>
                <button
                  onClick={() => {
                    stopSpeaking();
                    setLanguage('hi');
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                    language === 'hi'
                      ? 'bg-[#0F2D46] text-white shadow-xs'
                      : 'text-[#0F2D46] hover:text-[#1E4FA3]'
                  }`}
                  title="हिंदी"
                >
                  हिन्दी
                </button>
              </div>

              {/* Voice Speed Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="px-2.5 py-1 bg-[#EEF4F8] hover:bg-[#CBD5E1]/50 border border-[#CBD5E1] rounded-full text-xs font-bold text-[#0F2D46] flex items-center gap-1 transition-colors cursor-pointer"
                  title="Voice Speed"
                >
                  <Gauge className="w-3.5 h-3.5 text-[#0F2D46]" />
                  <span>{speechRate}x</span>
                  <ChevronDown className="w-3 h-3 text-[#475569]" />
                </button>

                {showSpeedMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-32 bg-white border border-[#CBD5E1] rounded-xl shadow-xl py-1 z-50 text-xs">
                    {[0.8, 1.0, 1.2, 1.5, 1.8].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => {
                          setSpeechRate(rate);
                          setShowSpeedMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 hover:bg-[#EEF4F8] flex items-center justify-between text-xs cursor-pointer ${
                          speechRate === rate
                            ? 'text-[#0F2D46] font-bold bg-[#EEF4F8]'
                            : 'text-[#0F2742] font-medium'
                        }`}
                      >
                        <span>{rate}x</span>
                        {speechRate === rate && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0F2D46]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Restart / Clear Thread */}
              <button
                onClick={() => {
                  stopSpeaking();
                  clearChat();
                }}
                className="p-1.5 text-[#0F2D46] hover:text-[#0F2D46] hover:bg-[#EEF4F8] rounded-full transition-colors cursor-pointer"
                title="Restart conversation"
                aria-label="Restart conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Expand / Minimize */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-[#0F2D46] hover:text-[#0F2D46] hover:bg-[#EEF4F8] rounded-full transition-colors hidden sm:inline-flex cursor-pointer"
                title={isExpanded ? 'Minimize' : 'Expand'}
                aria-label={isExpanded ? 'Minimize' : 'Expand'}
              >
                {isExpanded ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>

              {/* Close */}
              <button
                onClick={() => {
                  stopSpeaking();
                  stopListening();
                  setIsOpen(false);
                }}
                className="p-1.5 text-[#0F2D46] hover:text-[#0F2D46] hover:bg-[#EEF4F8] rounded-full transition-colors cursor-pointer"
                title="Close chat"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Voice Error Notice */}
          {voiceError && (
            <div className="bg-amber-50 border-b border-amber-300 text-amber-950 px-4 py-2 text-xs flex items-center justify-between shrink-0 font-medium">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{voiceError}</span>
              </div>
              <button
                onClick={() => setVoiceError(null)}
                className="text-amber-800 hover:text-amber-950 p-0.5 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Voice Listening Bar */}
          {isListening && (
            <div className="bg-red-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shrink-0 animate-pulse">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
                <span>
                  {language === 'hi'
                    ? 'बोलिए... (हिंदी आवाज़ सक्रिय)'
                    : 'Listening in English...'}
                </span>
              </div>
              <button
                onClick={stopListening}
                className="text-xs bg-white/25 hover:bg-white/40 px-3 py-0.5 rounded-full font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {/* Conversation Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-white text-sm">
            {/* Centered Date Separator */}
            <div className="flex items-center my-3 select-none">
              <div className="flex-1 border-t border-[#CBD5E1]" />
              <span className="px-3 text-xs text-[#475569] font-semibold">
                {currentDateFormatted}
              </span>
              <div className="flex-1 border-t border-[#CBD5E1]" />
            </div>

            {/* Messages */}
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const isCurrentSpeaking = isSpeaking && speakingMsgId === msg.id;

              return (
                <div key={msg.id} className="space-y-2">
                  {/* Sender Name above Assistant messages */}
                  {!isUser && (
                    <div className="text-xs font-bold text-[#475569] ml-9 select-none">
                      Nikks
                    </div>
                  )}

                  <div
                    className={`flex items-end gap-2.5 ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {/* Assistant Avatar */}
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full bg-[#0F2D46] border border-[#1E4FA3] ring-1 ring-[#D97706]/30 flex items-center justify-center shrink-0 p-0.5 shadow-xs">
                        <NikksMascotIcon size={20} glow={false} />
                      </div>
                    )}

                    {/* Timestamp for User message (placed to the left of user bubble) */}
                    {isUser && (
                      <span className="text-[11px] text-[#64748B] font-medium select-none shrink-0 mb-1">
                        {msg.timestamp}
                      </span>
                    )}

                    {/* Message Bubble Container */}
                    <div
                      className={`max-w-[84%] sm:max-w-[80%] ${
                        isUser ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`p-3.5 text-[14px] leading-relaxed shadow-xs ${
                          isUser
                            ? 'bg-[#0F3554] text-white rounded-2xl rounded-tr-sm font-normal'
                            : 'bg-[#EEF4F8] border border-[#CBD5E1]/70 text-[#0F2742] rounded-2xl rounded-tl-sm font-normal'
                        }`}
                      >
                        <FormattedMarkdown content={msg.text} isUser={isUser} />

                        {/* Audio TTS control inside assistant bubble */}
                        {!isUser && (
                          <div className="mt-3 pt-2.5 border-t border-[#CBD5E1]/80 flex items-center justify-between text-xs">
                            <button
                              onClick={() => speak(msg.id, msg.text, language)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                isCurrentSpeaking
                                  ? 'bg-[#D97706] text-white border border-[#B45309] shadow-xs animate-pulse'
                                  : isPaused && speakingMsgId === msg.id
                                  ? 'bg-amber-100 text-amber-900 border border-amber-400'
                                  : 'bg-white hover:bg-[#EEF4F8] text-[#0F2D46] border border-[#CBD5E1] hover:border-[#0F2D46] shadow-xs'
                              }`}
                              title={
                                isCurrentSpeaking
                                  ? 'Pause audio'
                                  : isPaused && speakingMsgId === msg.id
                                  ? `Resume audio (${speechRate}x)`
                                  : `Listen (${speechRate}x)`
                              }
                            >
                              {isCurrentSpeaking ? (
                                <>
                                  <Pause className="w-3.5 h-3.5 text-white" />
                                  <span>Pause</span>
                                </>
                              ) : isPaused && speakingMsgId === msg.id ? (
                                <>
                                  <Play className="w-3.5 h-3.5 text-amber-800" />
                                  <span>Resume</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3.5 h-3.5 text-[#0F2D46]" />
                                  <span>Listen ({speechRate}x)</span>
                                </>
                              )}
                            </button>

                            {msg.provider_used && (
                              <span className="text-[11px] text-[#475569] font-mono font-semibold">
                                {msg.provider_used === 'GEMINI_API'
                                  ? 'Gemini'
                                  : 'Legal RAG'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Statutory Citations Accordion */}
                      {!isUser && msg.citations && msg.citations.length > 0 && (
                        <div className="mt-2.5 space-y-1.5">
                          <div className="text-xs font-bold text-[#0F2D46] flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-[#1E4FA3]" />
                            <span>Legal Citations:</span>
                          </div>

                          {msg.citations.map((cit, idx) => {
                            const citKey = `${msg.id}-${idx}`;
                            const isCitExpanded = expandedCitations[citKey];

                            return (
                              <div
                                key={citKey}
                                className="bg-white border border-[#CBD5E1] rounded-xl overflow-hidden text-xs shadow-xs"
                              >
                                <button
                                  onClick={() => toggleCitation(msg.id, idx)}
                                  className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-[#EEF4F8] transition-colors cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <span className="px-2 py-0.5 bg-[#EEF4F8] text-[#0F2D46] font-mono font-bold text-[11px] rounded border border-[#CBD5E1]">
                                      {cit.section_rule_ref}
                                    </span>
                                    <span className="font-semibold text-[#0F2742] truncate">
                                      {cit.title}
                                    </span>
                                  </div>
                                  {isCitExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-[#475569] shrink-0" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-[#475569] shrink-0" />
                                  )}
                                </button>

                                {isCitExpanded && (
                                  <div className="p-3 bg-[#EEF4F8]/50 border-t border-[#CBD5E1] text-xs text-[#0F2742] leading-relaxed font-sans">
                                    <div className="font-bold text-[#0F2D46] mb-1">
                                      {cit.act_or_rule}
                                    </div>
                                    <p className="text-[#334155]">{cit.snippet}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Portal Action Links */}
                      {!isUser && msg.portal_actions && msg.portal_actions.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {msg.portal_actions.map((act, i) => (
                            <button
                              key={i}
                              onClick={() => handleActionClick(act)}
                              className="px-3.5 py-1.5 bg-white hover:bg-[#EEF4F8] text-[#0F2D46] hover:border-[#0F2D46] border border-[#CBD5E1] rounded-full text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-[#1E4FA3]" />
                              <span>{act.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Timestamp for Assistant message (placed to the right of assistant bubble) */}
                    {!isUser && (
                      <span className="text-[11px] text-[#64748B] font-medium select-none shrink-0 mb-1">
                        {msg.timestamp}
                      </span>
                    )}
                  </div>

                  {/* Sendbird-Style Quick Suggestion Chips (High Contrast Visible Outlines) */}
                  {!isUser &&
                    msg.suggested_followups &&
                    msg.suggested_followups.length > 0 && (
                      <div className="ml-9 mt-2 flex flex-col items-start sm:items-end gap-2">
                        {msg.suggested_followups.map((sug, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(sug)}
                            className="w-auto max-w-[92%] text-left sm:text-right px-4 py-2 rounded-full border border-[#CBD5E1] bg-white hover:border-[#0F2D46] hover:bg-[#EEF4F8] text-[#0F2D46] text-[13px] font-semibold transition-all shadow-xs cursor-pointer min-h-[36px] flex items-center"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              );
            })}

            {/* Restrained Loading / Typing Indicator */}
            {loading && (
              <div className="flex items-start gap-2.5 pt-1" role="status">
                <div className="w-7 h-7 rounded-full bg-[#0F2D46] border border-[#1E4FA3] flex items-center justify-center shrink-0 p-0.5 mt-0.5 shadow-xs">
                  <NikksMascotIcon size={20} glow={false} />
                </div>
                <div className="bg-[#EEF4F8] border border-[#CBD5E1]/70 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#0F2D46] animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-[#0F2D46] animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-[#0F2D46] animate-bounce" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Bar (Scrollable High-Contrast Pill Chips) */}
          {suggestions && suggestions.length > 0 && (
            <div className="px-4 py-2.5 bg-white border-t border-[#CBD5E1] flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s)}
                  className="whitespace-nowrap px-4 py-2 bg-white hover:bg-[#EEF4F8] text-[#0F2D46] hover:border-[#0F2D46] border border-[#CBD5E1] rounded-full text-[13px] font-semibold transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Chat Composer / Input Area (Strong Contrast Border & Button) */}
          <div className="p-3.5 bg-white border-t border-[#CBD5E1] shrink-0">
            <div className="flex items-center gap-2 bg-white border-2 border-[#CBD5E1] focus-within:border-[#0F2D46] focus-within:ring-2 focus-within:ring-[#0F2D46]/20 rounded-full px-4 py-1.5 transition-all shadow-xs">
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="Ask Nikks"
                placeholder={
                  isListening
                    ? 'Listening...'
                    : language === 'hi'
                    ? 'निक्स से सवाल पूछें...'
                    : 'Ask Nikks a question...'
                }
                className="flex-1 bg-transparent py-2 text-[14px] font-medium text-[#0F2742] placeholder:text-[#64748B] focus:outline-none"
              />

              {/* Microphone Voice Button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isListening
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'text-[#0F2D46] hover:bg-[#EEF4F8]'
                }`}
                title={isListening ? 'Stop listening' : 'Voice input'}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              {/* Send Button (Strong Solid Navy & Clear States) */}
              <button
                onClick={() => handleSend()}
                disabled={!inputVal.trim() || loading}
                className="w-8 h-8 rounded-full bg-[#0F2D46] hover:bg-[#1E4FA3] text-white flex items-center justify-center shrink-0 transition-all shadow-sm active:scale-95 disabled:bg-[#94A3B8] disabled:opacity-80 disabled:cursor-not-allowed cursor-pointer"
                title="Send message"
                aria-label="Send message"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            {/* Clean, readable footer watermark */}
            <div className="text-xs text-center text-[#64748B] mt-2 font-medium flex items-center justify-center gap-1 select-none">
              <span>Powered by</span>
              <span className="font-bold text-[#0F2D46]">Legal Metrology</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
