'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Slider } from '@/components/ui/slider'
import { ChatGenerator } from '@/lib/ai/chat-generator'
import { EmotionAnalyzer } from '@/lib/ai/emotion-analyzer'
import { TaskPlanner } from '@/lib/ai/task-planner'
import { TimeUtils } from '@/lib/utils/time'
import { Heart, Brain, Clock, MessageCircle, Sparkles } from 'lucide-react'

export default function EmotionTaskTestPage() {
  const [userMessage, setUserMessage] = useState('')
  const [emotionScore, setEmotionScore] = useState([5])
  const [emotionTags, setEmotionTags] = useState<string[]>(['焦虑', '压力'])
  const [aiResponse, setAiResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [testResults, setTestResults] = useState<{
    emotionAnalysis?: any
    taskDetection?: any
    finalResponse?: string
  }>({})

  const testScenarios = [
    {
      name: '高压力学生',
      message: '我明天要考试，还有作业没写完，感觉时间不够用了，很焦虑怎么办',
      emotion: 3,
      tags: ['焦虑', '压力', '紧张']
    },
    {
      name: '疲惫用户',
      message: '这周课程太多了，我需要安排一下学习时间，但是感觉好累',
      emotion: 4,
      tags: ['疲惫', '困扰', '无力']
    },
    {
      name: '迷茫用户',
      message: '不知道怎么规划明天的学习，有数学、英语和物理要复习',
      emotion: 5,
      tags: ['迷茫', '困惑']
    },
    {
      name: '积极用户',
      message: '我想制定一个高效的学习计划，明天有三门课要准备',
      emotion: 7,
      tags: ['积极', '主动']
    }
  ]

  const handleTest = async () => {
    if (!userMessage.trim()) return

    setIsLoading(true)
    setTestResults({})

    try {
      // 1. 情绪分析
      console.log('🔍 开始情绪分析...')
      const emotionAnalysis = EmotionAnalyzer.analyzeEmotion(userMessage)
      
      // 2. 任务检测
      console.log('📋 开始任务检测...')
      const taskDetection = await TaskPlanner.detectTaskPlanning(userMessage)
      
      // 3. 生成AI响应
      console.log('🤖 生成AI响应...')
      const timeContext = TimeUtils.getCurrentTimeContext()
      const chatGenerator = new ChatGenerator()
      
      const response = await chatGenerator.generateResponse(
        userMessage,
        emotionScore[0],
        emotionTags,
        taskDetection.hasTaskPlanning,
        timeContext
      )

      setTestResults({
        emotionAnalysis,
        taskDetection,
        finalResponse: response
      })
      
      setAiResponse(response)
      
    } catch (error) {
      console.error('测试失败:', error)
      setAiResponse(`测试失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const loadScenario = (scenario: typeof testScenarios[0]) => {
    setUserMessage(scenario.message)
    setEmotionScore([scenario.emotion])
    setEmotionTags(scenario.tags)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              情绪安抚 + 任务规划测试
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>
                测试AI是否能够先进行情绪安抚，然后再提供任务规划。验证新的响应格式是否包含情感支持部分。
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 输入区域 */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  用户输入
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">用户消息</label>
                  <Textarea
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                    placeholder="输入包含情绪和任务需求的消息..."
                    rows={4}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    情绪分数: {emotionScore[0]}/10
                  </label>
                  <Slider
                    value={emotionScore}
                    onValueChange={setEmotionScore}
                    max={10}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">情绪标签</label>
                  <div className="flex flex-wrap gap-2">
                    {emotionTags.map((tag, index) => (
                      <Badge key={index} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleTest} 
                  disabled={isLoading || !userMessage.trim()}
                  className="w-full"
                >
                  {isLoading ? '测试中...' : '开始测试'}
                </Button>
              </CardContent>
            </Card>

            {/* 测试场景 */}
            <Card>
              <CardHeader>
                <CardTitle>预设测试场景</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2">
                  {testScenarios.map((scenario, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => loadScenario(scenario)}
                      className="justify-start text-left"
                    >
                      <div>
                        <div className="font-medium">{scenario.name}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {scenario.message.substring(0, 50)}...
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 结果区域 */}
          <div className="space-y-4">
            {/* AI响应 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-500" />
                  AI响应结果
                </CardTitle>
              </CardHeader>
              <CardContent>
                {aiResponse ? (
                  <div className="space-y-4">
                    <div className="prose prose-sm max-w-none">
                      <div className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg">
                        {aiResponse}
                      </div>
                    </div>
                    
                    {/* 响应分析 */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2">响应分析</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span>包含情绪支持:</span>
                          {aiResponse.includes('💝') || aiResponse.includes('情绪') || aiResponse.includes('理解') ? (
                            <Badge className="bg-green-500">✓ 是</Badge>
                          ) : (
                            <Badge variant="destructive">✗ 否</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span>包含任务规划:</span>
                          {aiResponse.includes('📅') || aiResponse.includes('计划') || aiResponse.includes('安排') ? (
                            <Badge className="bg-green-500">✓ 是</Badge>
                          ) : (
                            <Badge variant="destructive">✗ 否</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span>包含结构化数据:</span>
                          {aiResponse.includes('```json') ? (
                            <Badge className="bg-green-500">✓ 是</Badge>
                          ) : (
                            <Badge variant="destructive">✗ 否</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    点击"开始测试"查看AI响应
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 分析结果 */}
            {testResults.emotionAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-green-500" />
                    分析过程
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">情绪分析结果</h4>
                    <div className="text-sm bg-blue-50 p-3 rounded">
                      <div>分数: {testResults.emotionAnalysis.score}/10</div>
                      <div>标签: {testResults.emotionAnalysis.tags.join(', ')}</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">任务检测结果</h4>
                    <div className="text-sm bg-green-50 p-3 rounded">
                      <div>包含任务: {testResults.taskDetection?.hasTaskPlanning ? '是' : '否'}</div>
                      {testResults.taskDetection?.confidence && (
                        <div>置信度: {testResults.taskDetection.confidence}</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
