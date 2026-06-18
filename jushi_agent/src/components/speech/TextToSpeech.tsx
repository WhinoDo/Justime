'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Play, Square, Loader2, Volume2, AlertCircle } from 'lucide-react'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

interface TextToSpeechProps {
  text: string
  className?: string
  disabled?: boolean
  autoPlay?: boolean
}

type TTSState = 'idle' | 'loading' | 'playing' | 'done' | 'error'

export function TextToSpeech({ text, className, disabled, autoPlay }: TextToSpeechProps) {
  const [state, setState] = useState<TTSState>('idle')
  const [error, setError] = useState<string | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel()
      }
    }
  }, [])

  const speak = useCallback(() => {
    if (!text.trim() || disabled) return
    if (!synthRef.current) {
      setError('浏览器不支持语音合成')
      setState('error')
      return
    }

    // Cancel any ongoing speech
    synthRef.current.cancel()

    setState('loading')
    setError(null)

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

    utterance.onstart = () => setState('playing')
    utterance.onend = () => setState('done')
    utterance.onerror = (e) => {
      if (e.error !== 'canceled') {
        setError('语音播放失败')
        setState('error')
      }
    }

    utteranceRef.current = utterance

    // Small delay to ensure voices are loaded
    const voices = synthRef.current.getVoices()
    const zhVoice = voices.find(
      (v) => v.lang.startsWith('zh') && v.name.includes('Female'),
    )
    if (zhVoice) utterance.voice = zhVoice

    synthRef.current.speak(utterance)
  }, [text, disabled])

  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel()
    }
    setState('idle')
  }, [])

  const handleClick = useCallback(() => {
    if (state === 'playing') {
      stop()
    } else {
      speak()
    }
  }, [state, speak, stop])

  // Auto-play when text changes
  useEffect(() => {
    if (autoPlay && text.trim()) {
      const timer = setTimeout(() => speak(), 300)
      return () => clearTimeout(timer)
    }
  }, [text, autoPlay, speak])

  if (!text.trim()) return null

  const isSupported = typeof window !== 'undefined' && !!window.speechSynthesis

  if (!isSupported) {
    return (
      <div className={cn('flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300', className)}>
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span>您的浏览器不支持语音合成</span>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        onClick={handleClick}
        disabled={disabled || state === 'loading'}
        className={cn(
          'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200',
          state === 'idle' &&
            'border border-white/20 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white',
          state === 'playing' &&
            'bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/30',
          state === 'done' &&
            'border border-green-500/30 bg-green-500/10 text-green-300',
          (disabled || state === 'loading') && 'cursor-not-allowed opacity-50',
        )}
        title={state === 'playing' ? '停止播放' : '播放语音'}
      >
        {state === 'loading' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === 'playing' ? (
          <Square className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
        <span>
          {state === 'idle' && '播放语音'}
          {state === 'loading' && '准备中...'}
          {state === 'playing' && '播放中'}
          {state === 'done' && '已播放'}
        </span>
      </button>

      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  )
}
