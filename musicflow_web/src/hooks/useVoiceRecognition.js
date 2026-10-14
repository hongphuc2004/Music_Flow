import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Normalizes and cleans voice transcript for music search / AI input.
 * Strips common conversational Vietnamese voice command prefixes
 * (e.g., "tìm bài hát", "mở nhạc", "bật bài") and trailing punctuation.
 */
export function cleanVoiceQuery(rawText = '') {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText.trim();

  // 1. Remove trailing punctuations (. , ? ! : ;)
  text = text.replace(/[.,?!:;]+$/g, '').trim();

  // 2. Remove common Vietnamese voice assistant prefixes
  // e.g. "tìm kiếm bài hát", "tìm bài hát", "tìm bài", "tìm nhạc", "mở bài hát", "mở nhạc", "bật bài hát", "bật nhạc", "phát bài hát", "nghe bài hát", "cho tôi nghe bài"
  const prefixRegex = /^(tìm\s+(kiếm\s+)?(bài\s+hát|bài|nhạc)?|mở\s+(bài\s+hát|bài|nhạc)?|bật\s+(bài\s+hát|bài|nhạc)?|phát\s+(bài\s+hát|bài|nhạc)?|nghe\s+(bài\s+hát|bài|nhạc)?|cho\s+(tôi|mình)\s+nghe(\s+bài)?)\s+/i;
  text = text.replace(prefixRegex, '').trim();

  // 3. Remove leading/trailing quotation marks
  text = text.replace(/^["'“”‘’]|["'“”‘’]$/g, '').trim();

  return text;
}

/**
 * Custom hook providing an optimized Web Speech Recognition engine.
 * Features:
 * - Hardware mic priming with Noise Suppression, Echo Cancellation & Auto Gain Control.
 * - Standard multi-frame hypothesis accumulator (avoids duplicate/dropped words).
 * - Silence auto-completion timer (snappy & responsive without awkward delay).
 * - Silent handling for no-speech timeouts.
 * - Concurrency protection against InvalidStateError.
 */
export default function useVoiceRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isStartingRef = useRef(false);
  const activeStreamRef = useRef(null);

  const isSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    isStartingRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore if already stopped
      }
    }
    if (activeStreamRef.current) {
      try {
        activeStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      activeStreamRef.current = null;
    }
    setIsListening(false);
  }, [clearSilenceTimer]);

  const startListening = useCallback(
    async ({
      lang = 'vi-VN',
      continuous = true,
      interimResults = true,
      silenceTimeoutMs = 1400, // Auto-stop after 1.4s of silence post-speech
      onResult = () => {},
      onEnd = () => {},
      onError = () => {},
      onSpeechStart = () => {},
    } = {}) => {
      if (!isSupported) {
        const errMsg = 'Trình duyệt chưa hỗ trợ nhận diện giọng nói Web Speech API.';
        setError(errMsg);
        onError(new Error(errMsg));
        return false;
      }

      if (isStartingRef.current) return false;
      isStartingRef.current = true;

      // Clean up any ongoing session
      stopListening();

      // 1. Prime microphone hardware with Noise Suppression & Echo Cancellation
      if (navigator?.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          activeStreamRef.current = stream;
        } catch (streamErr) {
          // If user denies mic or device busy, SpeechRecognition will capture it
          console.warn('[useVoiceRecognition] Audio constraint priming warning:', streamErr);
        }
      }

      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.lang = lang;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.maxAlternatives = 2;

      setTranscript('');
      setError(null);
      setIsListening(true);
      isStartingRef.current = false;

      let latestFullText = '';

      recognition.onspeechstart = () => {
        onSpeechStart();
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        // Standard speech accumulation over all result frames
        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || '';
          if (item.isFinal) {
            finalTranscript += (finalTranscript ? ' ' : '') + text.trim();
          } else {
            interimTranscript += (interimTranscript ? ' ' : '') + text.trim();
          }
        }

        const combined = (finalTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
        latestFullText = combined;
        setTranscript(combined);

        const isLastFinal = Boolean(event.results[event.results.length - 1]?.isFinal);
        onResult(combined, isLastFinal);

        // Reset silence detection timer whenever active speech is heard
        clearSilenceTimer();
        if (combined && silenceTimeoutMs > 0) {
          silenceTimerRef.current = setTimeout(() => {
            // Automatically stop after user finishes speaking and silence is detected
            stopListening();
          }, silenceTimeoutMs);
        }
      };

      recognition.onerror = (event) => {
        clearSilenceTimer();
        if (event.error === 'no-speech') {
          // Graceful silent timeout: do not annoy user with scary error toasts
          setIsListening(false);
          return;
        }

        let msg = 'Đã có lỗi xảy ra khi nhận diện giọng nói.';
        if (event.error === 'not-allowed') {
          msg = 'Vui lòng cho phép quyền truy cập Micro trên trình duyệt để sử dụng tính năng này.';
        } else if (event.error === 'network') {
          msg = 'Lỗi kết nối mạng khi xử lý giọng nói.';
        } else if (event.error === 'aborted') {
          setIsListening(false);
          return;
        }

        setError(msg);
        setIsListening(false);
        onError(new Error(msg));
      };

      recognition.onend = () => {
        clearSilenceTimer();
        setIsListening(false);
        if (activeStreamRef.current) {
          try {
            activeStreamRef.current.getTracks().forEach((track) => track.stop());
          } catch {
            // ignore
          }
          activeStreamRef.current = null;
        }

        const cleaned = cleanVoiceQuery(latestFullText);
        onEnd(cleaned, latestFullText);
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
        return true;
      } catch (err) {
        setIsListening(false);
        setError(err.message);
        onError(err);
        return false;
      }
    },
    [isSupported, stopListening, clearSilenceTimer]
  );

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isSupported,
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
  };
}
