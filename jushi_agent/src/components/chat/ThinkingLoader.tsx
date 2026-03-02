'use client'

import { useState, useEffect, useMemo } from 'react'
import { Sparkles, Brain, Search, Calculator, Calendar } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

interface ThinkingLoaderProps {
    input: string
}

interface ThinkingStep {
    text: string
    icon: LucideIcon
    duration: number
}

export function ThinkingLoader({ input }: ThinkingLoaderProps) {
    const [step, setStep] = useState(0)

    const normalizedInput = input.trim().toLowerCase()
    const isGreeting = /^[你您]好|^hello|^hi|在吗/i.test(input.trim())
    const isTaskDecomposition = /分解|拆解|计划|方案|项目|路线图|里程碑/.test(input)
    const isCalendar = /日程|提醒|会议|预约|明天|后天|下周|时间安排/.test(input)
    const isSearch = /搜索|查找|查询|最新|新闻|资料来源|web|网页/.test(input)
    const isKnowledge = /知识库|文档|资料|pdf|文件|串\.pdf|readme|查一下|定义/.test(input)
    const isCode = /代码|报错|bug|python|java|javascript|typescript|js|tsx|sql|接口/.test(normalizedInput)

    const jitter = (base: number, amplitude: number) => {
        const delta = Math.floor(Math.random() * amplitude)
        return base + delta
    }

    const steps = useMemo<ThinkingStep[]>(() => {
        const baseSteps: ThinkingStep[] = [
            { text: '正在解析语义...', icon: Brain, duration: jitter(1000, 500) },
        ]

        if (isGreeting) {
            return [
                ...baseSteps,
                { text: '正在构建回复...', icon: Sparkles, duration: jitter(1200, 400) },
            ]
        }

        const specificSteps: ThinkingStep[] = []

        if (isTaskDecomposition) {
            specificSteps.push(
                { text: '正在构建工作结构(WBS)...', icon: Calculator, duration: jitter(1800, 1000) },
                { text: '正在评估任务耗时...', icon: Calendar, duration: jitter(1600, 700) }
            )
        } else if (isCalendar) {
            specificSteps.push(
                { text: '正在提取时间要素...', icon: Calendar, duration: jitter(1300, 600) },
                { text: '正在检查日程冲突...', icon: Search, duration: jitter(1500, 800) }
            )
        } else if (isKnowledge) {
            specificSteps.push(
                { text: '正在转换为向量查询...', icon: Brain, duration: jitter(1300, 500) },
                { text: '正在检索本地知识库...', icon: Search, duration: jitter(1800, 900) }
            )
        } else if (isCode) {
            specificSteps.push(
                { text: '正在分析代码逻辑...', icon: Calculator, duration: jitter(1500, 800) },
                { text: '正在推导修复方案...', icon: Brain, duration: jitter(1800, 1000) }
            )
        } else if (isSearch) {
            specificSteps.push(
                { text: '正在调用搜索引擎...', icon: Search, duration: jitter(1700, 900) },
                { text: '正在整合全网信息...', icon: Sparkles, duration: jitter(1500, 800) }
            )
        }

        if (specificSteps.length === 0) {
            specificSteps.push(
                { text: '正在进行逻辑推理...', icon: Brain, duration: jitter(1500, 700) },
                { text: '正在组织语言...', icon: Sparkles, duration: jitter(1800, 1000) }
            )
            return [...baseSteps, ...specificSteps]
        }

        return [
            ...baseSteps,
            ...specificSteps,
            { text: '正在生成最终结论...', icon: Sparkles, duration: jitter(1800, 1200) },
        ]
    }, [input, isCalendar, isCode, isGreeting, isKnowledge, isSearch, isTaskDecomposition])

    useEffect(() => {
        setStep(0)
        let currentStep = 0
        let timeoutId: ReturnType<typeof setTimeout> | undefined

        const scheduleNext = () => {
            if (currentStep >= steps.length - 1) {
                return
            }
            timeoutId = setTimeout(() => {
                currentStep += 1
                setStep(currentStep)
                scheduleNext()
            }, steps[currentStep].duration)
        }

        scheduleNext()

        return () => {
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [steps])

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
