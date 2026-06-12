'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    ChevronLeft,
    Chrome,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Loader2,
    HelpCircle,
    Lock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

interface NotebookLMStatus {
    configured: boolean
    method: 'file' | 'env' | 'none'
    status: 'active' | 'expired' | 'not_configured'
    message: string
}

export default function AdminNotebookLMPage() {
    const [statusData, setStatusData] = useState<NotebookLMStatus | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [authJson, setAuthJson] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const fetchStatus = async () => {
        setIsLoading(true)
        setErrorMessage(null)
        try {
            const response = await fetch(API_ENDPOINTS.ADMIN.NOTEBOOKLM, {
                credentials: 'include',
                cache: 'no-store'
            })
            const result = await response.json()
            if (result.success && result.data) {
                setStatusData(result.data)
            } else {
                throw new Error(result.message || '获取状态失败')
            }
        } catch (error) {
            console.error('获取 NotebookLM 状态失败:', error)
            setErrorMessage(error instanceof Error ? error.message : '无法获取 NotebookLM 配置状态')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSaveAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!authJson.trim()) return

        setIsSubmitting(true)
        setErrorMessage(null)
        setSuccessMessage(null)

        try {
            const response = await fetch(API_ENDPOINTS.ADMIN.NOTEBOOKLM, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ auth_json: authJson.trim() })
            })

            const result = await response.json()
            if (result.success) {
                setSuccessMessage(result.message || '凭证更新并验证成功！')
                setAuthJson('')
                await fetchStatus()
            } else {
                throw new Error(result.message || result.error || '验证凭证失败')
            }
        } catch (error) {
            console.error('保存 NotebookLM 凭证失败:', error)
            setErrorMessage(error instanceof Error ? error.message : '更新凭证失败，请检查 JSON 格式或网络连接')
        } finally {
            setIsSubmitting(false)
        }
    }

    useEffect(() => {
        void fetchStatus()
    }, [])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/admin/settings">
                        <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 p-2 h-9 rounded-xl">
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-white">NotebookLM 谷歌认证</h2>
                        <p className="text-white/60 mt-1 text-sm">配置和管理系统全局 Google 账号登录态。</p>
                    </div>
                </div>
                <Button
                    onClick={fetchStatus}
                    disabled={isLoading}
                    variant="outline"
                    className="h-9 px-4 border-white/15 bg-white/5 text-white/90 hover:bg-white/10 rounded-xl text-xs"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                            同步状态...
                        </>
                    ) : '刷新状态'}
                </Button>
            </div>

            {/* Status Panel */}
            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white/5 backdrop-blur-md border border-white/15 rounded-3xl p-6 shadow-xl space-y-6">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Chrome className="w-5 h-5 text-indigo-300" />
                            当前登录与配置状态
                        </h3>

                        {isLoading && !statusData ? (
                            <div className="flex items-center justify-center py-12 text-white/55 gap-2">
                                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                                正在查询谷歌账号登录状态...
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-white/60">配置状态:</span>
                                    {statusData?.status === 'active' ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            账号已连接 (Active)
                                        </span>
                                    ) : statusData?.status === 'expired' ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-400/30">
                                            <XCircle className="w-3.5 h-3.5" />
                                            登录态过期 (Expired)
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/60 border border-white/10">
                                            <Lock className="w-3.5 h-3.5" />
                                            未配置 (Not Configured)
                                        </span>
                                    )}
                                </div>

                                <div className="rounded-2xl bg-black/40 border border-white/5 p-4 space-y-3.5">
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div>
                                            <p className="text-white/40 mb-1">加载来源</p>
                                            <p className="font-mono text-white/90 font-semibold">
                                                {statusData?.method === 'env' ? '🔒 环境变量 (NOTEBOOKLM_AUTH_JSON)' :
                                                 statusData?.method === 'file' ? '📁 物理凭证文件 (storage_state.json)' : '无'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-white/40 mb-1">自检时间</p>
                                            <p className="text-white/90 font-semibold">{new Date().toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="border-t border-white/5 pt-3">
                                        <p className="text-xs text-white/45 mb-1">系统消息说明</p>
                                        <p className={`text-xs font-medium ${statusData?.status === 'active' ? 'text-emerald-300/80' : 'text-white/70'}`}>
                                            ℹ️ {statusData?.message || '无消息。'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Form to submit credentials */}
                    <div className="bg-white/5 backdrop-blur-md border border-white/15 rounded-3xl p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-white mb-4">更新谷歌登录态</h3>
                        <form onSubmit={handleSaveAuth} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs text-white/50 block font-medium">粘贴 storage_state.json 的 JSON 字符串</label>
                                <textarea
                                    value={authJson}
                                    onChange={(e) => setAuthJson(e.target.value)}
                                    placeholder='{ "cookies": [ ... ], "origins": [ ... ] }'
                                    className="w-full h-44 rounded-2xl bg-black/30 border border-white/15 px-4 py-3 text-xs font-mono text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-indigo-400/40"
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>

                            {successMessage && (
                                <div className="p-3.5 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    {successMessage}
                                </div>
                            )}

                            {errorMessage && (
                                <div className="p-3.5 rounded-xl border bg-rose-500/10 border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <div>
                                        <p className="font-semibold">操作失败</p>
                                        <p className="opacity-90 leading-relaxed mt-0.5">{errorMessage}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || !authJson.trim()}
                                    className="h-10 px-6 bg-indigo-500/30 hover:bg-indigo-500/40 text-indigo-100 border border-indigo-400/30 rounded-xl"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            验证并保存凭证...
                                        </>
                                    ) : '保存并生效 🔒'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Right Guide Panel */}
                <div className="space-y-6">
                    <div className="bg-white/5 backdrop-blur-md border border-white/15 rounded-3xl p-6 shadow-xl space-y-4">
                        <h3 className="text-md font-semibold text-white flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-sky-400" />
                            如何获取存储状态 JSON？
                        </h3>
                        <div className="text-xs text-white/70 space-y-3.5 leading-relaxed">
                            <p>由于 NotebookLM 并未开放面向独立开发者的谷歌官方 API，我们使用底层的爬虫 CLI 工具来驱动 Google 账号工作。获取登录态有两种方案：</p>
                            
                            <div className="space-y-1.5 border-t border-white/5 pt-3">
                                <p className="font-bold text-white/90">方案一：在宿主机终端直接授权（推荐）</p>
                                <p>1. SSH 登录运行本后端的服务器主机；</p>
                                <p>2. 进入虚拟环境，运行以下命令：</p>
                                <code className="block bg-black/40 border border-white/10 px-2 py-1 rounded font-mono text-[10px] text-indigo-300">
                                    notebooklm login
                                </code>
                                <p>3. 按照屏幕提示，在弹出的窗口或点击授权 URL 完成 Google 登录，文件将自动写入 <code>~/.notebooklm/storage_state.json</code>，此处刷新即可看到 Active 状态。</p>
                            </div>

                            <div className="space-y-1.5 border-t border-white/5 pt-3">
                                <p className="font-bold text-white/90">方案二：通过本地生成后粘贴上传</p>
                                <p>1. 在本地电脑命令行安装并执行：</p>
                                <code className="block bg-black/40 border border-white/10 px-2 py-1 rounded font-mono text-[10px] text-indigo-300">
                                    pip install notebooklm-py
                                </code>
                                <code className="block bg-black/40 border border-white/10 px-2 py-1 rounded font-mono text-[10px] text-indigo-300">
                                    notebooklm login
                                </code>
                                <p>2. 在本地登录成功后，打开本地主目录下的 <code>~/.notebooklm/storage_state.json</code>；</p>
                                <p>3. 复制其完整的 JSON 内容，并在此页面的输入框中粘贴，然后点击 **保存并生效**。</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
