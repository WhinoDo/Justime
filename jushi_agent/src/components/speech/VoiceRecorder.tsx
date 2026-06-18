'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Loader2, Mic, Square, CheckCircle2, AlertCircle } from 'lucide-react'

interface VoiceRecorderProps {
  onTranscript: (text: string) => void
  className?: string
  disabled?: boolean
}

type RecorderState = 'idle' | 'recording' | 'processing' | 'done' | 'error'

export function VoiceRecorder({ onTranscript, className, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const isSupported =
    typeof window !== 'undefined' &&
    (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition)

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (recognitionRef.current) {
      recognitionRef.current.abort()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    recognitionRef.current = null
    chunksRef.current = []
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const startRecording = useCallback(async () => {
    setError(null)
    setState('recording')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Set up SpeechRecognition for real-time ASR
      const SpeechRecognitionAPI =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'zh-CN'
        recognitionRef.current = recognition

        recognition.onresult = (event: any) => {
          let finalTranscript = ''
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript
            }
          }
          if (finalTranscript) {
            onTranscript(finalTranscript)
          }
        }

        recognition.onerror = () => {
          // SpeechRecognition errors are non-fatal; continue recording
        }

        recognition.start()
      }

      // Set up MediaRecorder as fallback / audio capture
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        // Clean up stream after stop
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
      }

      recorder.start(1000)
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问'
          : '无法访问麦克风，请检查设备连接'
      setError(message)
      setState('error')
    }
  }, [onTranscript])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setState('done')
    setTimeout(() => setState('idle'), 1500)
  }, [])

  const handleClick = useCallback(() => {
    if (disabled) return
    if (state === 'recording') {
      stopRecording()
    } else {
      startRecording()
    }
  }, [disabled, state, startRecording, stopRecording])

  if (!isSupported) {
    return (
      <div className={cn('flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300', className)}>
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span>您的浏览器不支持语音识别，请使用 Chrome 或 Edge</span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <button
        onClick={handleClick}
        disabled={disabled || state === 'processing'}
        className={cn(
          'group relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300',
          state === 'idle' &&
            'border-2 border-white/30 bg-white/10 text-white/70 hover:border-white/50 hover:bg-white/20 hover:text-white',
          state === 'recording' && 'animate-pulse border-2 border-red-400 bg-red-500/20 text-red-300 shadow-lg shadow-red-500/20',
          state === 'done' && 'border-2 border-green-400 bg-green-500/20 text-green-300',
          state === 'error' && 'border-2 border-amber-400 bg-amber-500/20 text-amber-300',
          (disabled || state === 'processing') && 'cursor-not-allowed opacity-50',
        )}
        title={
          state === 'idle'
            ? '点击开始录音'
            : state === 'recording'
              ? '点击停止录音'
              : '录音完成'
        }
      >
        {state === 'processing' ? (
          <Loader2 className="h-7 w-7 animate-spin" />
        ) : state === 'recording' ? (
          <Square className="h-5 w-5" />
        ) : state === 'done' ? (
          <CheckCircle2 className="h-7 w-7" />
        ) : (
          <Mic className="h-7 w-7" />
        )}

        {/* Ripple effect when recording */}
        {state === 'recording' && (
          <>
            <span className="absolute inset-0 animate-ping rounded-full border-2 border-red-400/40" />
            <span className="absolute inset-0 animate-ping rounded-full border-2 border-red-400/20" style={{ animationDelay: '0.5s' }} />
          </>
        )}
      </button>

      <span className="text-xs text-white/50">
        {state === 'idle' && '点击麦克风开始语音输入'}
        {state === 'recording' && '正在录音，点击停止'}
        {state === 'done' && '录音完成'}
        {state === 'error' && '录音失败'}
      </span>

      {error && (
        <p className="text-xs text-red-300">{error}</p>
      )}
    </div>
  )
}
