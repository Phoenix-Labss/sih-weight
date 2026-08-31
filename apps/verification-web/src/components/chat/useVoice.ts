import { useState, useEffect, useCallback, useRef } from 'react';

// Declare Web Speech API window interface
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export function useVoice(language: 'en' | 'hi' = 'en') {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition && !window.speechSynthesis) {
      setIsSupported(false);
    }
  }, []);

  // 1. Speech-to-Text (STT) - Voice Input
  const startListening = useCallback(
    (onResult: (transcript: string) => void) => {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        alert('Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.');
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechRecognition();
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          onResult(finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[useVoice] Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (err) {
        console.warn('[useVoice] Failed to start recognition:', err);
        setIsListening(false);
      }
    },
    [language]
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }
  }, []);

  // 2. Text-to-Speech (TTS) - Voice Output
  const cleanMarkdownForSpeech = (text: string): string => {
    return text
      .replace(/#+\s/g, '') // remove headings
      .replace(/\*\*(.*?)\*\*/g, '$1') // remove bold
      .replace(/\*(.*?)\*/g, '$1') // remove italic
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // remove links
      .replace(/`{1,3}.*?`{1,3}/g, '') // remove code
      .replace(/>\s/g, '') // remove blockquotes
      .replace(/[•\-\*]\s/g, ', ') // list items to comma pause
      .replace(/₹/g, 'Rupees ') // currency
      .replace(/\n+/g, '. ') // newlines to periods
      .trim();
  };

  const speak = useCallback(
    (msgId: string, text: string, lang: 'en' | 'hi' = language) => {
      if (!window.speechSynthesis) return;

      // If already speaking this message, toggle off
      if (isSpeaking && speakingMsgId === msgId) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setSpeakingMsgId(null);
        return;
      }

      window.speechSynthesis.cancel();

      const cleaned = cleanMarkdownForSpeech(text);
      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      // Pick best voice if available
      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = voices.find(
        (v) =>
          (lang === 'hi' && (v.lang.includes('hi') || v.name.includes('Hindi'))) ||
          (lang === 'en' && (v.lang === 'en-IN' || v.name.includes('India')))
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setSpeakingMsgId(msgId);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setSpeakingMsgId(null);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setSpeakingMsgId(null);
      };

      window.speechSynthesis.speak(utterance);
    },
    [isSpeaking, speakingMsgId, language]
  );

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeakingMsgId(null);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isListening,
    isSpeaking,
    speakingMsgId,
    isSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
