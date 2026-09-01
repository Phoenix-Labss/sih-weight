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
  ExternalLink,
  BookOpen,
  AlertTriangle,
  Lightbulb,
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
  const [showSuggestionsBar, setShowSuggestionsBar] = useState(false);
  const [openCitationMsgs, setOpenCitationMsgs] = useState<Record<string, boolean>>({});

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
    setShowSuggestionsBar(false);
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

  const toggleCitation = (msgId: string) => {
    setOpenCitationMsgs((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
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

  // Initial / empty state: only the welcome message exists, no user turn yet.
  // Suggestions are shown ONLY here (max 3 compact chips) and never again
  // after the first real user message.
  const isInitialEmptyState = !messages.some((m) => m.sender === 'user');
  const initialSuggestions = (suggestions || []).slice(0, 3);

  return (
    <>
      {/* 1. Minimized State: compact floating launcher (does not affect the page) */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-3 animate-fade-in">
          <div className="hidden sm:flex items-center gap-2 bg-white text-[#0F2D46] text-xs font-semibold px-3.5 py-2 rounded-full shadow-lg border border-[#CBD5E1] select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Ask Nikks</span>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-full bg-[#0F2D46] text-white flex items-center justify-center shadow-[0_10px_30px_-6px_rgba(15,45,70,0.5)] hover:bg-[#1E4FA3] hover:scale-105 active:scale-95 transition-all border-2 border-white relative cursor-pointer"
            title="Open Nikks Chatbot"
            aria-label="Open Nikks Chatbot"
          >
            <NikksMascotIcon size={34} glow={false} />
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
          </button>
        </div>
      )}

      {/* 2. Chatbot Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Nikks Support Chat"
          className={`fixed z-50 flex flex-col bg-white border border-[#CBD5E1] shadow-[0_12px_45px_-8px_rgba(15,45,70,0.3)] overflow-hidden transition-all duration-200 animate-modal-in ${
            isExpanded
              ? 'inset-2 sm:inset-6 lg:inset-10 w-auto h-auto rounded-2xl'
              : 'bottom-0 right-0 w-full h-[100dvh] sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[600px] sm:max-h-[88vh] rounded-none sm:rounded-2xl'
          }`}
        >
          {/* Header */}
          <div className="bg-white border-b border-[#CBD5E1] px-3.5 py-2.5 flex items-center justify-between shrink-0">
            {/* Left: Identity */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#0F2D46] border border-[#1E4FA3] flex items-center justify-center p-1 shrink-0">
                <NikksMascotIcon size={26} glow={false} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-[16px] text-[#0F2D46] leading-tight tracking-tight">
                  Nikks
                </h3>
                <p className="text-[11px] text-[#475569] font-medium leading-none mt-0.5">
                  Legal Metrology Guide
                </p>
              </div>
            </div>

            {/* Right: Controls & Actions */}
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

          {/* Conversation Area (scrolls independently, composer stays fixed) */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-white text-sm">
            {/* Centered Date Separator */}
            <div className="flex items-center my-1 select-none">
              <div className="flex-1 border-t border-[#CBD5E1]" />
              <span className="px-3 text-[11px] text-[#475569] font-semibold">
                {currentDateFormatted}
              </span>
              <div className="flex-1 border-t border-[#CBD5E1]" />
            </div>

            {/* Messages */}
            {messages.map((msg, idx) => {
              const isUser = msg.sender === 'user';
              const isCurrentSpeaking = isSpeaking && speakingMsgId === msg.id;
              // Compact metadata: timestamp only on the last message of a consecutive group
              const showTimestamp =
                idx === messages.length - 1 ||
                messages[idx + 1].sender !== msg.sender;

              return (
                <div key={msg.id}>
                  <div
                    className={`flex items-end gap-2 ${
                      isUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {/* Assistant Avatar */}
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full bg-[#0F2D46] border border-[#1E4FA3] flex items-center justify-center shrink-0 p-0.5">
                        <NikksMascotIcon size={18} glow={false} />
                      </div>
                    )}

                    {/* Timestamp for User message */}
                    {isUser && showTimestamp && (
                      <span className="text-[11px] text-[#64748B] font-medium select-none shrink-0 mb-1">
                        {msg.timestamp}
                      </span>
                    )}

                    {/* Message Bubble Container */}
                    <div
                      className={`${
                        isUser
                          ? 'max-w-[75%] sm:max-w-[70%]'
                          : 'max-w-[85%] sm:max-w-[80%]'
                      } ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`px-3.5 py-2.5 text-[14px] leading-relaxed ${
                          isUser
                            ? 'bg-[#0F2D46] text-white rounded-2xl rounded-br-md'
                            : 'bg-[#EEF4F8] text-[#0F2742] rounded-2xl rounded-bl-md'
                        }`}
                      >
                        <FormattedMarkdown content={msg.text} isUser={isUser} />

                        {/* Compact secondary actions that belong to this specific response */}
                        {!isUser && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {/* Listen (TTS) */}
                            <button
                              onClick={() => speak(msg.id, msg.text, language)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                                isCurrentSpeaking
                                  ? 'bg-[#D97706] text-white border border-[#B45309] animate-pulse'
                                  : isPaused && speakingMsgId === msg.id
                                  ? 'bg-amber-100 text-amber-900 border border-amber-400'
                                  : 'bg-white/80 hover:bg-white text-[#334155] border border-[#CBD5E1]'
                              }`}
                              title={
                                isCurrentSpeaking
                                  ? 'Pause audio'
                                  : isPaused && speakingMsgId === msg.id
                                  ? `Resume (${speechRate}x)`
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
                                  <Play className="w-3 h-3" />
                                  <span>Resume</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3 h-3" />
                                  <span>Listen</span>
                                </>
                              )}
                            </button>

                            {/* Portal navigation actions (only when this response includes them) */}
                            {msg.portal_actions &&
                              msg.portal_actions.map((act, i) => (
                                <button
                                  key={i}
                                  onClick={() => handleActionClick(act)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/80 hover:bg-white text-[#0F2D46] hover:border-[#0F2D46] border border-[#CBD5E1] rounded-full text-[11px] font-semibold transition-all cursor-pointer"
                                  title={act.description}
                                >
                                  <ExternalLink className="w-3 h-3 text-[#1E4FA3]" />
                                  <span>{act.label}</span>
                                </button>
                              ))}

                            {/* Single compact Citations toggle (opens snippet drawer) */}
                            {msg.citations && msg.citations.length > 0 && (
                              <button
                                onClick={() => toggleCitation(msg.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/80 hover:bg-white text-[#0F2D46] hover:border-[#0F2D46] border border-[#CBD5E1] rounded-full text-[11px] font-semibold transition-all cursor-pointer"
                                title="View statutory citations"
                              >
                                <BookOpen className="w-3 h-3 text-[#1E4FA3]" />
                                <span>
                                  Citations ({msg.citations.length})
                                </span>
                                <ChevronDown
                                  className={`w-3 h-3 transition-transform ${
                                    openCitationMsgs[msg.id] ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Citation snippet drawer (toggled by the compact Citations control) */}
                      {!isUser &&
                        msg.citations &&
                        msg.citations.length > 0 &&
                        openCitationMsgs[msg.id] && (
                          <div className="mt-1.5 space-y-1.5">
                            {msg.citations.map((cit, cIdx) => (
                              <div
                                key={cit.citation_id || cIdx}
                                className="p-2.5 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#0F2742] leading-relaxed"
                              >
                                <div className="font-bold text-[#0F2D46] mb-0.5">
                                  {cit.act_or_rule} &bull; {cit.section_rule_ref}
                                </div>
                                <p className="text-[#334155]">{cit.snippet}</p>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>

                    {/* Timestamp for Assistant message */}
                    {!isUser && showTimestamp && (
                      <span className="text-[11px] text-[#64748B] font-medium select-none shrink-0 mb-1">
                        {msg.timestamp}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Initial / welcome state: up to 3 compact optional suggestion chips.
                These disappear permanently once the user sends their first message. */}
            {isInitialEmptyState && !loading && initialSuggestions.length > 0 && (
              <div className="ml-9 mt-1">
                <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider select-none mb-1.5">
                  Suggested questions
                </div>
                <div className="flex flex-wrap gap-1.5 items-start">
                  {initialSuggestions.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(sug)}
                      className="px-3 py-1.5 rounded-full border border-[#CBD5E1] bg-white hover:border-[#0F2D46] hover:bg-[#EEF4F8] text-[#0F2D46] text-xs font-medium transition-all text-left cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

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

          {/* Chat Composer / Input Area (permanently anchored at the bottom) */}
          <div className="bg-white border-t border-[#CBD5E1] shrink-0">
            {/* Optional context-aware suggestions — shown only via the lightbulb toggle */}
            {showSuggestionsBar && suggestions && suggestions.length > 0 && (
              <div className="px-3 pt-2.5 flex flex-wrap gap-1.5 animate-fade-in">
                {suggestions.slice(0, 3).map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(s)}
                    className="whitespace-nowrap px-3 py-1 bg-white hover:bg-[#EEF4F8] text-[#0F2D46] hover:border-[#0F2D46] border border-[#CBD5E1] rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="p-3">
              <div className="flex items-center gap-1.5 bg-white border border-[#CBD5E1] focus-within:border-[#0F2D46] focus-within:ring-2 focus-within:ring-[#0F2D46]/15 rounded-2xl pl-3 pr-1.5 py-1 transition-all">
                {/* Suggestions toggle (optional menu, replaces permanent suggestion bars) */}
                <button
                  type="button"
                  onClick={() => setShowSuggestionsBar(!showSuggestionsBar)}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                    showSuggestionsBar
                      ? 'bg-[#EEF4F8] text-[#0F2D46]'
                      : 'text-[#64748B] hover:text-[#0F2D46] hover:bg-[#EEF4F8]'
                  }`}
                  title="Suggestions"
                  aria-label="Toggle suggestions"
                >
                  <Lightbulb className="w-4 h-4" />
                </button>

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
                  className="flex-1 min-w-0 bg-transparent py-2 text-[14px] text-[#0F2742] placeholder:text-[#64748B] focus:outline-none"
                />

                {/* Microphone Voice Button */}
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                    isListening
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'text-[#0F2D46] hover:bg-[#EEF4F8]'
                  }`}
                  title={isListening ? 'Stop listening' : 'Voice input'}
                  aria-label={isListening ? 'Stop listening' : 'Voice input'}
                >
                  {isListening ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>

                {/* Send Button (disabled when empty or while loading) */}
                <button
                  onClick={() => handleSend()}
                  disabled={!inputVal.trim() || loading}
                  className="w-8 h-8 rounded-full bg-[#0F2D46] hover:bg-[#1E4FA3] text-white flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:bg-[#94A3B8] disabled:cursor-not-allowed cursor-pointer"
                  title="Send message"
                  aria-label="Send message"
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                </button>
              </div>

              {/* Subtle footer */}
              <div className="text-[11px] text-center text-[#64748B] mt-1.5 font-medium flex items-center justify-center gap-1 select-none">
                <span>Powered by</span>
                <span className="font-semibold text-[#0F2D46]">Legal Metrology</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
