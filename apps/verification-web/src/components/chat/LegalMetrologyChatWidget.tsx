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
  User,
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
          <div className="hidden sm:flex items-center gap-2 bg-white text-slate-800 text-xs font-semibold px-3.5 py-2 rounded-full shadow-lg border border-slate-200 select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ask Nikks AI</span>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-full bg-gov-navy text-white flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all border-2 border-white relative cursor-pointer"
            title="Open Nikks Chatbot"
            aria-label="Open Nikks Chatbot"
          >
            <NikksMascotIcon size={34} glow={false} />
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
          </button>
        </div>
      )}

      {/* 2. Sendbird-Style Floating Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Nikks Support Chat"
          className={`fixed z-50 flex flex-col bg-white border border-slate-200/90 shadow-2xl overflow-hidden transition-all duration-200 animate-modal-in ${
            isExpanded
              ? 'inset-3 sm:inset-8 w-auto h-auto rounded-2xl'
              : 'bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-[410px] h-full sm:h-[620px] sm:max-h-[85vh] rounded-none sm:rounded-2xl'
          }`}
        >
          {/* Header */}
          <div className="bg-white border-b border-slate-100 px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between shrink-0">
            {/* Left: Identity */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center p-1 shrink-0">
                <NikksMascotIcon size={24} glow={false} />
              </div>
              <div>
                <h3 className="font-semibold text-[15px] sm:text-base text-slate-900 leading-tight">
                  Nikks
                </h3>
                <p className="text-[11px] text-slate-500 leading-none mt-0.5">
                  Legal Metrology Guide
                </p>
              </div>
            </div>

            {/* Right: Controls & Actions */}
            <div className="flex items-center gap-1 text-slate-500">
              {/* Language Switcher Pill */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-full border border-slate-200 mr-1">
                <button
                  onClick={() => {
                    stopSpeaking();
                    setLanguage('en');
                  }}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                    language === 'en'
                      ? 'bg-gov-navy text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
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
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                    language === 'hi'
                      ? 'bg-gov-navy text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
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
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-full text-[11px] font-semibold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Voice Speed"
                >
                  <Gauge className="w-3 h-3 text-slate-500" />
                  <span>{speechRate}x</span>
                  <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
                </button>

                {showSpeedMenu && (
                  <div className="absolute right-0 top-full mt-1 w-28 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 text-xs">
                    {[0.8, 1.0, 1.2, 1.5, 1.8].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => {
                          setSpeechRate(rate);
                          setShowSpeedMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between text-xs cursor-pointer ${
                          speechRate === rate
                            ? 'text-gov-navy font-bold bg-slate-50'
                            : 'text-slate-700'
                        }`}
                      >
                        <span>{rate}x</span>
                        {speechRate === rate && (
                          <span className="w-1.5 h-1.5 rounded-full bg-gov-navy" />
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
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="Restart conversation"
                aria-label="Restart conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Expand / Minimize */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors hidden sm:inline-flex cursor-pointer"
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
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="Close chat"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Voice Error Notice */}
          {voiceError && (
            <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-3.5 py-2 text-xs flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{voiceError}</span>
              </div>
              <button
                onClick={() => setVoiceError(null)}
                className="text-amber-700 hover:text-amber-900 p-0.5 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Voice Listening Bar */}
          {isListening && (
            <div className="bg-red-500 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shrink-0 animate-pulse">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                <span>
                  {language === 'hi'
                    ? 'बोलिए... (हिंदी आवाज़ सक्रिय)'
                    : 'Listening in English...'}
                </span>
              </div>
              <button
                onClick={stopListening}
                className="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-0.5 rounded-full font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {/* Conversation Area */}
          <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4 bg-white text-sm">
            {/* Centered Date Separator */}
            <div className="flex items-center my-2 select-none">
              <div className="flex-1 border-t border-slate-100" />
              <span className="px-3 text-[11px] text-slate-400 font-medium">
                {currentDateFormatted}
              </span>
              <div className="flex-1 border-t border-slate-100" />
            </div>

            {/* Messages */}
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const isCurrentSpeaking = isSpeaking && speakingMsgId === msg.id;

              return (
                <div key={msg.id} className="space-y-1.5">
                  {/* Sender Name above Assistant messages */}
                  {!isUser && (
                    <div className="text-[11px] font-medium text-slate-400 ml-9 select-none">
                      Nikks
                    </div>
                  )}

                  <div
                    className={`flex items-end gap-2 ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {/* Assistant Avatar */}
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 p-0.5">
                        <NikksMascotIcon size={20} glow={false} />
                      </div>
                    )}

                    {/* Timestamp for User message (placed to the left of user bubble) */}
                    {isUser && (
                      <span className="text-[11px] text-slate-400 select-none shrink-0 mb-1">
                        {msg.timestamp}
                      </span>
                    )}

                    {/* Message Bubble Container */}
                    <div
                      className={`max-w-[82%] sm:max-w-[78%] ${
                        isUser ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`p-3.5 text-[14px] leading-relaxed ${
                          isUser
                            ? 'bg-gov-navy text-white rounded-2xl rounded-tr-sm shadow-xs'
                            : 'bg-[#F1F3F5] text-slate-900 rounded-2xl rounded-tl-sm'
                        }`}
                      >
                        <FormattedMarkdown content={msg.text} isUser={isUser} />

                        {/* Audio TTS control inside assistant bubble */}
                        {!isUser && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                            <button
                              onClick={() => speak(msg.id, msg.text, language)}
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                                isCurrentSpeaking
                                  ? 'bg-amber-500 text-slate-950 animate-pulse'
                                  : isPaused && speakingMsgId === msg.id
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200'
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
                                  <Pause className="w-3 h-3" />
                                  <span>Pause</span>
                                </>
                              ) : isPaused && speakingMsgId === msg.id ? (
                                <>
                                  <Play className="w-3 h-3 text-amber-700" />
                                  <span>Resume</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3 h-3 text-slate-600" />
                                  <span>Listen ({speechRate}x)</span>
                                </>
                              )}
                            </button>

                            {msg.provider_used && (
                              <span className="text-[10px] text-slate-400 font-mono">
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
                        <div className="mt-2 space-y-1">
                          <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-slate-400" />
                            <span>Legal Citations:</span>
                          </div>

                          {msg.citations.map((cit, idx) => {
                            const citKey = `${msg.id}-${idx}`;
                            const isCitExpanded = expandedCitations[citKey];

                            return (
                              <div
                                key={citKey}
                                className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden text-xs"
                              >
                                <button
                                  onClick={() => toggleCitation(msg.id, idx)}
                                  className="w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-800 font-mono font-bold text-[10px] rounded">
                                      {cit.section_rule_ref}
                                    </span>
                                    <span className="font-medium text-slate-700 truncate">
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
                                  <div className="p-2.5 bg-white border-t border-slate-200 text-[11px] text-slate-600 leading-relaxed font-sans">
                                    <div className="font-semibold text-slate-800 mb-0.5">
                                      {cit.act_or_rule}
                                    </div>
                                    {cit.snippet}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Portal Action Links */}
                      {!isUser && msg.portal_actions && msg.portal_actions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {msg.portal_actions.map((act, i) => (
                            <button
                              key={i}
                              onClick={() => handleActionClick(act)}
                              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-gov-navy border border-slate-200 rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3 text-slate-500" />
                              <span>{act.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Timestamp for Assistant message (placed to the right of assistant bubble) */}
                    {!isUser && (
                      <span className="text-[11px] text-slate-400 select-none shrink-0 mb-1">
                        {msg.timestamp}
                      </span>
                    )}
                  </div>

                  {/* Sendbird-Style Quick Suggestion Chips (Right under Assistant Message) */}
                  {!isUser &&
                    msg.suggested_followups &&
                    msg.suggested_followups.length > 0 && (
                      <div className="ml-9 mt-2 flex flex-col items-start sm:items-end gap-1.5">
                        {msg.suggested_followups.map((sug, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(sug)}
                            className="w-auto max-w-[90%] text-left sm:text-right px-4 py-2 rounded-full border border-gov-navy/35 hover:border-gov-navy hover:bg-gov-navy/5 text-gov-navy text-[13px] font-medium transition-colors cursor-pointer"
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
              <div className="flex items-start gap-2 pt-1" role="status">
                <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 p-0.5 mt-0.5">
                  <NikksMascotIcon size={20} glow={false} />
                </div>
                <div className="bg-[#F1F3F5] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Bar (Scrollable Pill Chips) */}
          {suggestions && suggestions.length > 0 && (
            <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s)}
                  className="whitespace-nowrap px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-gov-navy border border-slate-200 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Chat Composer / Input Area */}
          <div className="p-3.5 bg-white border-t border-slate-100 shrink-0">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 focus-within:border-gov-navy focus-within:ring-2 focus-within:ring-gov-navy/10 rounded-full px-3.5 py-1 transition-all">
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
                className="flex-1 bg-transparent py-2 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />

              {/* Microphone Voice Button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'text-slate-400 hover:text-gov-navy'
                }`}
                title={isListening ? 'Stop listening' : 'Voice input'}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              {/* Send Button */}
              <button
                onClick={() => handleSend()}
                disabled={!inputVal.trim() || loading}
                className="w-8 h-8 rounded-full bg-gov-navy text-white flex items-center justify-center shrink-0 transition-transform active:scale-95 disabled:opacity-30 disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
                title="Send message"
                aria-label="Send message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Clean, subtle footer watermark */}
            <div className="text-[11px] text-center text-slate-400 mt-2 font-medium flex items-center justify-center gap-1 select-none">
              <span>Powered by</span>
              <span className="font-semibold text-slate-600">Legal Metrology</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
