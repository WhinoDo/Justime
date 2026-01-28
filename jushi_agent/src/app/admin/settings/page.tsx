'use client'

import ModelConfigPage from '@/app/model-config/page'

export default function AdminSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900">系统设置</h2>
                <p className="text-gray-500">
                    管理系统的全局参数和默认配置
                </p>
            </div>

            {/* 
        复用现有的模型配置页面组件 
        在更复杂的系统中，这里应该是一个独立的 AdminSettings 组件，
        包含除了 LLM 之外的其他系统设置（如注册开关、公告设置等）。
        但为了 MVP，直接嵌入 LLM 配置即可。
      */}
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                <div className="p-6">
                    <ModelConfigPage />
                </div>
            </div>
        </div>
    )
}
