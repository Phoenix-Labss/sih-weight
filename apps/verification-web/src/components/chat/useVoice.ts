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
  const [isPaused, setIsPaused] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // User-configurable speech rate with localStorage persistence
  const [speechRate, setSpeechRateState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('emetrology_tts_speed');
      return saved ? parseFloat(saved) : 1.2;
    } catch {
      return 1.2;
    }
  });

  const recognitionRef = useRef<any>(null);

  // Position and context refs for live speed switching & resume
  const currentMsgIdRef = useRef<string | null>(null);
  const currentFullTextRef = useRef<string>('');
  const currentLangRef = useRef<'en' | 'hi'>(language);
  const charOffsetRef = useRef<number>(0);
  const lastCharIndexRef = useRef<number>(0);
  const isSwitchingRateRef = useRef<boolean>(false);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition && !window.speechSynthesis) {
      setIsSupported(false);
    }
  }, []);

  // 1. Speech-to-Text (STT) - Voice Input
  const startListening = useCallback(
    async (onResult: (transcript: string) => void) => {
      setVoiceError(null);
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setVoiceError('Voice input is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.');
        return;
      }

      // Proactively check / request microphone permission
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      } catch (err: any) {
        console.warn('[useVoice] Microphone permission request error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setVoiceError('Microphone permission denied. Please click the camera/mic icon in your browser address bar to allow microphone access.');
          return;
        }
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          setVoiceError(null);
        };

        recognition.onresult = (event: any) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; ++i) {
            fullTranscript += event.results[i][0].transcript;
          }
          if (fullTranscript.trim()) {
            onResult(fullTranscript.trim());
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('[useVoice] Speech recognition error:', event.error);
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setVoiceError('Microphone access was blocked. Please enable microphone permission in your browser address bar.');
          } else if (event.error === 'no-speech') {
            // Normal quiet timeout
          } else if (event.error === 'network') {
            setVoiceError('Voice recognition network timeout. Please check your internet connection.');
          } else if (event.error !== 'aborted') {
            setVoiceError(`Voice recognition notice: ${event.error}`);
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err: any) {
        console.warn('[useVoice] Failed to start recognition:', err);
        setVoiceError('Could not start voice recognition. Please try clicking the microphone again.');
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

  // 2. Text-to-Speech (TTS) Helpers
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

  // Internal utterance spawner from a specified character offset
  const playUtteranceFromOffset = useCallback(
    (msgId: string, fullCleanedText: string, offset: number, rate: number, lang: 'en' | 'hi') => {
      if (!window.speechSynthesis) return;

      const remainingText = offset > 0 ? fullCleanedText.slice(offset).trim() : fullCleanedText;
      if (!remainingText) {
        setIsSpeaking(false);
        setIsPaused(false);
        setSpeakingMsgId(null);
        charOffsetRef.current = 0;
        lastCharIndexRef.current = 0;
        return;
      }

      charOffsetRef.current = offset;
      lastCharIndexRef.current = offset;
      currentMsgIdRef.current = msgId;
      currentFullTextRef.current = fullCleanedText;
      currentLangRef.current = lang;

      const utterance = new SpeechSynthesisUtterance(remainingText);
      utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.rate = rate;
      utterance.pitch = 1.0;

      // Pick voice
      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = voices.find(
        (v) =>
          (lang === 'hi' && (v.lang.includes('hi') || v.name.includes('Hindi'))) ||
          (lang === 'en' && (v.lang === 'en-IN' || v.name.includes('India')))
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onboundary = (event: any) => {
        if (typeof event.charIndex === 'number') {
          lastCharIndexRef.current = charOffsetRef.current + event.charIndex;
        }
      };

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
        setSpeakingMsgId(msgId);
      };

      utterance.onend = () => {
        if (isSwitchingRateRef.current) {
          // Ignore synthetic onend triggered by rate switch cancel
          return;
        }
        setIsSpeaking(false);
        setIsPaused(false);
        setSpeakingMsgId(null);
        charOffsetRef.current = 0;
        lastCharIndexRef.current = 0;
      };

      utterance.onerror = (e: any) => {
        if (isSwitchingRateRef.current || e.error === 'interrupted' || e.error === 'canceled') {
          return;
        }
        setIsSpeaking(false);
        setIsPaused(false);
        setSpeakingMsgId(null);
        charOffsetRef.current = 0;
        lastCharIndexRef.current = 0;
      };

      window.speechSynthesis.speak(utterance);
    },
    []
  );

  // Speak / Pause / Resume with exact position memory
  const speak = useCallback(
    (msgId: string, text: string, lang: 'en' | 'hi' = language) => {
      if (!window.speechSynthesis) return;

      const cleaned = cleanMarkdownForSpeech(text);

      // If already speaking this message, pause / stop it at current position
      if (isSpeaking && speakingMsgId === msgId) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setIsPaused(true);
        // lastCharIndexRef retains the exact character where we stopped
        return;
      }

      // If resuming previously paused message
      if (isPaused && speakingMsgId === msgId && currentMsgIdRef.current === msgId) {
        const resumeIndex = lastCharIndexRef.current;
        playUtteranceFromOffset(msgId, cleaned, resumeIndex, speechRate, lang);
        return;
      }

      // New playback or different message: start fresh
      window.speechSynthesis.cancel();
      lastCharIndexRef.current = 0;
      charOffsetRef.current = 0;
      playUtteranceFromOffset(msgId, cleaned, 0, speechRate, lang);
    },
    [isSpeaking, isPaused, speakingMsgId, language, speechRate, playUtteranceFromOffset]
  );

  // Live on-the-fly speech rate changer without starting over
  const setSpeechRate = useCallback(
    (newRate: number) => {
      setSpeechRateState(newRate);
      try {
        localStorage.setItem('emetrology_tts_speed', String(newRate));
      } catch {
        // ignore
      }

      // If currently speaking, seamlessly continue at new speed from exact current character!
      if (window.speechSynthesis && (isSpeaking || isPaused) && currentMsgIdRef.current) {
        const activeMsgId = currentMsgIdRef.current;
        const fullText = currentFullTextRef.current;
        const currentPos = lastCharIndexRef.current;
        const activeLang = currentLangRef.current;

        if (isSpeaking) {
          isSwitchingRateRef.current = true;
          window.speechSynthesis.cancel();

          // Small microtask to let browser cleanup cancel before re-dispatching
          setTimeout(() => {
            isSwitchingRateRef.current = false;
            playUtteranceFromOffset(activeMsgId, fullText, currentPos, newRate, activeLang);
          }, 40);
        }
      }
    },
    [isSpeaking, isPaused, playUtteranceFromOffset]
  );

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
      setSpeakingMsgId(null);
      charOffsetRef.current = 0;
      lastCharIndexRef.current = 0;
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
    isPaused,
    speakingMsgId,
    speechRate,
    setSpeechRate,
    isSupported,
    voiceError,
    setVoiceError,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
