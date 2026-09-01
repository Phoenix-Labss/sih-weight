import { useState, useEffect, useCallback } from 'react';
import { ChatMessage } from './chatTypes';
import { chatApi } from './chatApi';

const STORAGE_KEY = 'emetrology_chat_thread_v1';

export function useMetrologyChat(portalContext = 'trader') {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: 'msg-welcome',
        sender: 'assistant',
        text: `**Hi! I'm Nikks, your Legal Metrology Guide.**\n\nAsk me anything about your weighing scales, verification fees, renewal deadlines, or package label rules. I will explain everything in simple and easy words so you can get things done without any confusion.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggested_followups: [
          'What to do if my certificate is lost?',
          'What to do if my physical seal is broken?',
          'How much time does it typically take to test?',
          'What documents are required for verification?',
        ],
      },
    ];
  });

  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    if (language === 'hi') {
      setSuggestions([
        'प्रमाण पत्र खो जाने पर क्या करें?',
        'यदि मशीन की सील टूट जाए तो क्या करें?',
        'सत्यापन परीक्षण में कितना समय लगता है?',
        'सत्यापन हेतु आवश्यक दस्तावेज कौन से हैं?',
        'काउंटर स्केल का वैधानिक सत्यापन शुल्क कितना है?',
      ]);
    } else {
      chatApi.getSuggestions(portalContext).then(setSuggestions);
    }
  }, [portalContext, language]);

  const sendMessage = useCallback(
    async (queryText: string) => {
      const trimmed = queryText.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = {
        id: `usr-${Date.now()}`,
        sender: 'user',
        text: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const historyPayload = messages.slice(-4).map((m) => ({
          sender: m.sender,
          text: m.text,
        }));

        const res = await chatApi.sendQuery(trimmed, language, portalContext, historyPayload);

        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          text: res.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          citations: res.citations,
          portal_actions: res.portal_actions,
          suggested_followups: res.suggested_followups,
          provider_used: res.provider_used,
        };

        setMessages((prev) => [...prev, botMsg]);
      } catch (err: any) {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `Error retrieving statutory answer: ${err?.message || 'Please check your connection and try again.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
      }
    },
    [loading, language, portalContext, messages]
  );

  const clearChat = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setMessages([
      {
        id: `msg-welcome-${Date.now()}`,
        sender: 'assistant',
        text: `**Namaste! I am the Official Legal Metrology AI Assistant.**\n\nAsk me any question regarding weighing machine registration, fees, renewal timelines, or packaged commodity rules.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggested_followups: [
          'How to calculate statutory verification fees?',
          'What is Section 22 Central Model Approval?',
          'What are mandatory declarations on packaged goods under Rule 6?',
        ],
      },
    ]);
  }, []);

  return {
    messages,
    loading,
    language,
    setLanguage,
    suggestions,
    sendMessage,
    clearChat,
  };
}
