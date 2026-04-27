import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { getZoyaResponse } from './gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Visualizer } from './components/Visualizer';

type AppState = 'idle' | 'listening' | 'processing' | 'speaking';

export default function App() {
  const [state, setState] = useState<AppState>('idle');
  const [transcript, setTranscript] = useState('');
  const [zoyaText, setZoyaText] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const fakeLevelIntervalRef = useRef<number>(0);
  const transcriptRef = useRef('');

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';
      
      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const result = event.results[current][0].transcript;
        setTranscript(result);
      };
      
      recognition.onend = () => {
        setState((prev) => {
          if (prev === 'listening') {
             processTranscript();
             return 'processing';
          }
          return prev;
        });
        stopAudioAnalysis();
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setState('idle');
        stopAudioAnalysis();
      };
      
      recognitionRef.current = recognition;
    } else {
      console.warn('Speech Recognition API not supported in this browser.');
    }
    
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.getVoices();
    
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      stopAudioAnalysis();
      window.speechSynthesis.cancel();
    };
  }, []);

  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
      microphoneRef.current.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setAudioLevel(average / 128);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err) {
      console.error('Error accessing microphone for visualizer', err);
    }
  };

  const stopAudioAnalysis = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (microphoneRef.current) microphoneRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    microphoneRef.current = null;
    setAudioLevel(0);
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition API is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    window.speechSynthesis.cancel();
    setTranscript('');
    setZoyaText('');
    setState('listening');
    recognitionRef.current.start();
    startAudioAnalysis();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const tryOpen = (url: string, successReply: string) => {
    const newWindow = window.open(url, '_blank');
    if (!newWindow) {
      speak(successReply + " Par browser ne popup block kar diya. Please allow popups!");
    } else {
      speak(successReply);
    }
  };

  const processTranscript = async () => {
    const text = transcriptRef.current.trim();
    if (!text) {
      setState('idle');
      return;
    }
    
    const lowerText = text.toLowerCase();
    let handled = false;
    
    const openMatch = lowerText.match(/^open\s+(.+)$/);
    const playMatch = lowerText.match(/^play\s+(.+?)\s+on\s+youtube$/);
    const spotifyMatch = lowerText.match(/^search\s+(.+?)\s+on\s+spotify$/);
    const waMatch = lowerText.match(/^send a whatsapp message to\s+(.+?)\s+saying\s+(.+)$/);
    
    if (openMatch) {
      const website = openMatch[1].replace(/\s+/g, '');
      tryOpen(`https://www.${website}.com`, `Opening ${website}, Ashwani ke liye kuch bhi...`);
      handled = true;
    } else if (playMatch) {
      const query = encodeURIComponent(playMatch[1]);
      tryOpen(`https://www.youtube.com/results?search_query=${query}`, `Chalo, playing ${playMatch[1]} on YouTube. Enjoy!`);
      handled = true;
    } else if (spotifyMatch) {
      const query = encodeURIComponent(spotifyMatch[1]);
      tryOpen(`https://open.spotify.com/search/${query}`, `Searching ${spotifyMatch[1]} on Spotify. Kya music taste hai tumhara!`);
      handled = true;
    } else if (waMatch) {
      const number = waMatch[1].replace(/[^0-9]/g, '');
      const message = encodeURIComponent(waMatch[2]);
      tryOpen(`https://web.whatsapp.com/send?phone=${number}&text=${message}`, `Sending message to ${number}. Uff, itne messages!`);
      handled = true;
    }
    
    if (!handled) {
      try {
        const responseText = await getZoyaResponse(text);
        speak(responseText);
      } catch (error) {
        console.error(error);
        speak("Uff, mera dimag kharab ho gaya hai. Network error, Ashwani!");
      }
    }
  };

  const speak = (text: string) => {
    setZoyaText(text);
    setState('speaking');
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    const voices = window.speechSynthesis.getVoices();
    const indianVoice = voices.find(v => v.lang.includes('en-IN') && v.name.toLowerCase().includes('female')) 
                     || voices.find(v => v.lang.includes('en-IN'))
                     || voices.find(v => v.name.toLowerCase().includes('female'))
                     || voices[0];
    if (indianVoice) {
      utterance.voice = indianVoice;
    }
    
    utterance.pitch = 1.1;
    utterance.rate = 1.0;
    
    utterance.onstart = () => {
      fakeLevelIntervalRef.current = window.setInterval(() => {
        setAudioLevel(Math.random() * 0.6 + 0.2);
      }, 100);
    };
    
    utterance.onend = () => {
      clearInterval(fakeLevelIntervalRef.current);
      setAudioLevel(0);
      setState('idle');
    };
    
    utterance.onerror = () => {
      clearInterval(fakeLevelIntervalRef.current);
      setAudioLevel(0);
      setState('idle');
    };
    
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center relative overflow-hidden font-sans">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-900/20 rounded-full blur-[120px]" />
      </div>
      
      <div className="z-10 flex flex-col items-center w-full max-w-3xl px-6">
        <Visualizer state={state} audioLevel={audioLevel} />
        
        <div className="mt-12 h-32 flex flex-col items-center justify-center text-center w-full">
          <AnimatePresence mode="wait">
            {state === 'listening' && (
              <motion.p 
                key="listening"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-2xl text-gray-300 font-light tracking-wide max-w-2xl"
              >
                {transcript || "Listening..."}
              </motion.p>
            )}
            {state === 'processing' && (
              <motion.div 
                key="processing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center space-x-3 text-gray-400"
              >
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-lg tracking-widest uppercase text-sm">Thinking</span>
              </motion.div>
            )}
            {state === 'speaking' && (
              <motion.p 
                key="speaking"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-2xl text-white font-medium tracking-tight max-w-2xl leading-relaxed"
              >
                {zoyaText}
              </motion.p>
            )}
            {state === 'idle' && (
              <motion.p 
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-gray-500 tracking-widest uppercase text-sm font-semibold"
              >
                Zoya is sleeping
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        
        <button
          onClick={state === 'idle' ? startListening : stopListening}
          className={`mt-16 group relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-500 ${
            state === 'idle' 
              ? 'bg-white/5 hover:bg-white/10 border border-white/10' 
              : 'bg-red-500/20 border border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.4)]'
          } backdrop-blur-xl`}
        >
          {state === 'idle' ? (
            <Mic className="w-10 h-10 text-gray-300 group-hover:text-white transition-colors" />
          ) : (
            <MicOff className="w-10 h-10 text-red-400" />
          )}
        </button>
        <p className="mt-6 text-xs text-gray-500 uppercase tracking-widest font-semibold">
          {state === 'idle' ? 'Tap to Wake Zoya' : 'Tap to Stop'}
        </p>
      </div>
    </div>
  );
}
