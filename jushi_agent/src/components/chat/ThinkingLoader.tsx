'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Brain, Search, Calculator, Calendar } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ThinkingLoaderProps {
    input: string
}

export function ThinkingLoader({ input }: ThinkingLoaderProps) {
    const [step, setStep] = useState(0)

    // Determine intent based on input keywords
    const isTaskDecomposition = /分解|拆解|计划|方案|项目/.test(input)
    const isCalendar = /日程|提醒|会议|预约|明天|下周/.test(input)
    const isSearch = /搜索|查找|查询|是谁|什么/.test(input)

    // Define steps based on intent
    const steps = [
        { text: '正在分析意图...', icon: Brain, duration: 1500 },
        ...(isTaskDecomposition ? [
            { text: '正在构建工作结构(WBS)...', icon: Calculator, duration: 2500 },
            { text: '正在拆解子任务...', icon: Sparkles, duration: 2500 },
        ] : []),
        ...(isCalendar ? [
            { text: '正在检查日历冲突...', icon: Calendar, duration: 1500 },
            { text: '正在规划日程...', icon: Calendar, duration: 1500 },
        ] : []),
        ...(isSearch ? [
            { text: '正在检索知识库...', icon: Search, duration: 2000 },
            { text: '正在整合信息...', icon: Sparkles, duration: 2000 },
        ] : []),
        // Fallback steps if no specific intent or after specific steps
        { text: '正在调用工具...', icon: Sparkles, duration: 2000 },
        { text: '正在生成回答...', icon: Sparkles, duration: 3000 },
        { text: '正在完善细节...', icon: Sparkles, duration: 5000 },
    ]

    // Filter steps to avoid redundant generic ones if specific ones exist? 
    // Actually, we want a linear progression.
    // Let's just use the constructed array but ensure unique keys if needed.

    useEffect(() => {
        let currentStep = 0
        let timeoutId: NodeJS.Timeout

        const nextStep = () => {
            if (currentStep >= steps.length - 1) return // Stay on last step

            const duration = steps[currentStep].duration
            timeoutId = setTimeout(() => {
                currentStep++
                setStep(currentStep)
                nextStep()
            }, duration)
        }

        nextStep()

        return () => clearTimeout(timeoutId)
    }, [input]) // Reset if input changes (though usually component unmounts on response)

    const CurrentIcon = steps[step].icon || Sparkles

    return (
        <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50/50 dark:bg-gray-800/30">
            <div className="relative flex items-center justify-center w-8 h-8">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-md">
                    <CurrentIcon className="w-4 h-4 text-white animate-pulse" />
                </div>
            </div>

            <div className="flex flex-col">
                <AnimatePresence mode="wait">
                    <motion.span
                        key={step}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.3 }}
                        className="text-sm font-medium text-gray-600 dark:text-gray-300"
                    >
                        {steps[step].text}
                    </motion.span>
                </AnimatePresence>
            </div>

            {/* Typing Dots */}
            <div className="flex gap-1 ml-2">
                <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                    className="w-1 h-1 bg-gray-400 rounded-full"
                />
                <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                    className="w-1 h-1 bg-gray-400 rounded-full"
                />
                <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                    className="w-1 h-1 bg-gray-400 rounded-full"
                />
            </div>
        </div>
    )
}
