'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { VoiceRecorder } from './VoiceRecorder'
import { TextToSpeech } from './TextToSpeech'
import { JushiGlassPanel } from '@/components/layout/JushiGlassPanel'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Trash2, Copy, Check, ArrowLeftRight, Loader2 } from 'lucide-react'

interface SpeechPanelProps {
  className?: string
}

export function SpeechPanel({ className }: SpeechPanelProps) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'asr' | 'tts'>('asr')
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleTranscript = useCallback((transcript: string) => {
    setText((prev) => {
      const combined = prev ? `${prev}${transcript}` : transcript
      return combined
    })
  }, [])

  const handleClear = useCallback(() => {
    setText('')
    setCopied(false)
  }, [])

  const handleCopy = useCallback(async () => {
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [text])

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'asr' ? 'tts' : 'asr'))
  }, [])

  return (
    <JushiGlassPanel
      className={cn(
        'flex w-full max-w-2xl flex-col gap-6 rounded-[32px] p-6 md:p-8',
        className,
      )}
    >
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          {mode === 'asr' ? '语音输入' : '文字转语音'}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleMode}
          className="border-white/20 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
          {mode === 'asr' ? '切换为文字转语音' : '切换为语音输入'}
        </Button>
      </div>

      {mode === 'asr' ? (
        /* ASR Mode: Voice Input → Text */
        <>
          <VoiceRecorder onTranscript={handleTranscript} disabled={isLoading} />

          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="语音识别结果将显示在这里，你也可以直接输入文本..."
              className="min-h-[160px] resize-y border-white/10 bg-white/5 text-white placeholder:text-white/30"
              disabled={isLoading}
            />
            {text && (
              <div className="absolute right-2 top-2 flex gap-1">
                <button
                  onClick={handleCopy}
                  className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  title="复制文本"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={handleClear}
                  className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  title="清空"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {text && (
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm text-white/50">
                共 {text.length} 个字符
              </span>
              <div className="flex items-center gap-2">
                <TextToSpeech text={text} />
              </div>
            </div>
          )}
        </>
      ) : (
        /* TTS Mode: Text → Voice Output */
        <div className="flex flex-col gap-6">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入要转换为语音的文本..."
            className="min-h-[160px] resize-y border-white/10 bg-white/5 text-white placeholder:text-white/30"
          />

          {text && (
            <div className="flex items-center justify-center">
              <TextToSpeech text={text} className="scale-110" />
            </div>
          )}
        </div>
      )}

      {/* Info footer */}
      <p className="text-center text-xs text-white/30">
        {mode === 'asr'
          ? '点击麦克风按钮开始语音输入，支持中文语音识别'
          : '输入文字后点击播放按钮，浏览器将朗读文本内容'}
      </p>
    </JushiGlassPanel>
  )
}
