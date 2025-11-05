'use client'

import React, { useState } from 'react'
import { TaskPlanner, TaskItem } from '@/lib/ai/task-planner'
import { TaskSelector } from '@/components/chat/TaskSelector'
import { LoginStatus } from '@/components/feishu/LoginStatus'
import { LoginButton, PrimaryLoginButton, OutlineLoginButton } from '@/components/feishu/LoginButton'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'

export default function TestTasksPage() {
  const [message, setMessage] = useState('')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [planText, setPlanText] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const testMessages = [
    '我明天有个重要的项目演示，需要准备PPT、练习演讲，还要准备demo，感觉时间不够用',
    '下周要考试了，需要复习数学、英语和计算机科学，每科都有很多内容',
    '我想制定一个健身计划，包括跑步、力量训练和瑜伽，希望能坚持下去',
    '公司要求我在本月底完成一个新功能的开发，包括前端界面、后端API和数据库设计'
  ]

  const handleAnalyze = () => {
    const hasTaskPlanning = TaskPlanner.analyzeMessage(message)
    
    if (hasTaskPlanning) {
      // 模拟 AI 回复
      const mockAiResponse = `
## 📅 任务计划

根据您的需求，我为您制定了以下详细计划：

### 🎯 项目演示准备计划

**第一阶段：内容准备**
- 整理项目核心要点和亮点
- 收集相关数据和案例

**第二阶段：PPT制作**
- 设计演示文稿结构
- 制作精美的幻灯片

**第三阶段：演讲练习**
- 熟悉演讲内容
- 进行多次模拟演练

## 🔧 结构化数据

\`\`\`json
{
  "hasTasks": true,
  "tasks": [
    {
      "id": "task_1",
      "title": "整理项目要点",
      "description": "收集项目核心要点、亮点和相关数据",
      "startTime": "2025-01-04T09:00:00.000Z",
      "endTime": "2025-01-04T11:00:00.000Z",
      "priority": "high",
      "category": "准备工作",
      "reminders": [30, 10]
    },
    {
      "id": "task_2", 
      "title": "制作演示PPT",
      "description": "设计并制作项目演示的幻灯片",
      "startTime": "2025-01-04T14:00:00.000Z",
      "endTime": "2025-01-04T17:00:00.000Z",
      "priority": "high",
      "category": "制作",
      "reminders": [15]
    },
    {
      "id": "task_3",
      "title": "演讲练习",
      "description": "熟悉演讲内容并进行模拟演练",
      "startTime": "2025-01-04T19:00:00.000Z", 
      "endTime": "2025-01-04T21:00:00.000Z",
      "priority": "medium",
      "category": "练习",
      "reminders": [10]
    },
    {
      "id": "task_4",
      "title": "准备演示Demo",
      "description": "准备项目演示所需的Demo和测试数据",
      "startTime": "2025-01-05T09:00:00.000Z",
      "endTime": "2025-01-05T12:00:00.000Z", 
      "priority": "high",
      "category": "技术准备",
      "location": "办公室",
      "reminders": [30, 15]
    }
  ]
}
\`\`\`
      `
      
      const taskResult = TaskPlanner.parseTaskResponse(mockAiResponse)
      setTasks(taskResult.tasks)
      setPlanText(taskResult.planText)
    } else {
      setTasks([])
      setPlanText('该消息不包含任务安排需求')
    }
  }

  const handleTaskAdded = (taskId: string, success: boolean) => {
    if (success) {
      setTasks(prev => prev.filter(task => task.id !== taskId))
      console.log(`任务 ${taskId} 已成功添加到飞书日历`)
    } else {
      console.error(`任务 ${taskId} 添加失败`)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🎯 任务规划功能测试
        </h1>
        <p className="text-gray-600">
          测试 AI 任务检测和飞书日程添加功能
        </p>
      </div>

      <div className="space-y-6">
        {/* 登录状态 */}
        <LoginStatus onLoginChange={setIsLoggedIn} />

        {/* 输入区域 */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold mb-4">📝 输入消息</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              测试消息：
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="输入包含任务安排的消息..."
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
            />
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">或选择预设消息：</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {testMessages.map((msg, index) => (
                <button
                  key={index}
                  onClick={() => setMessage(msg)}
                  className="p-2 text-left text-sm bg-gray-50 hover:bg-gray-100 rounded border transition-colors"
                >
                  {msg.substring(0, 50)}...
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!message.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            🔍 分析任务
          </button>
        </div>

        {/* 计划文本显示 */}
        {planText && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">📋 AI 生成的计划</h2>
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded">
                {planText}
              </pre>
            </div>
          </div>
        )}

        {/* 任务选择器 */}
        {tasks.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">🎯 任务选择器</h2>
              {!isLoggedIn && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded">
                  ⚠️ 请先登录飞书账号
                </div>
              )}
            </div>
            <TaskSelector
              tasks={tasks}
              onTaskAdded={handleTaskAdded}
            />
          </div>
        )}

        {/* 登录按钮示例 */}
        <div className="bg-green-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-green-900 mb-4">🔗 登录按钮示例</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <PrimaryLoginButton />
              <OutlineLoginButton />
              <LoginButton variant="ghost" size="sm">
                小按钮
              </LoginButton>
              <LoginButton
                variant="outline"
                useWindow={true}
                onLoginSuccess={() => alert('登录成功！')}
                onLoginCancel={() => alert('登录取消')}
              >
                弹窗登录
              </LoginButton>
            </div>
            <p className="text-sm text-green-700">
              这些按钮都会跳转到飞书授权页面：<br />
              <code className="text-xs break-all">{FeishuLoginRedirect.getLoginUrl()}</code>
            </p>
          </div>
        </div>

        {/* 使用说明 */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">📖 使用说明</h2>
          <div className="text-blue-800 space-y-2">
            <p>1. 在上方输入包含任务安排、时间规划等内容的消息</p>
            <p>2. 点击"分析任务"按钮，系统会检测是否包含任务规划需求</p>
            <p>3. 如果检测到任务，会显示 AI 生成的计划和结构化的任务列表</p>
            <p>4. 每个任务都有"Yes"和"No"按钮，选择"Yes"会将任务添加到飞书日历</p>
            <p>5. 确保已登录飞书账号，否则添加任务会失败</p>
            <p>6. 所有登录跳转都会使用本地登录页面，确保一致的登录体验</p>
          </div>
        </div>
      </div>
    </div>
  )
}
