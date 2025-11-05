'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { useFeishuLogin } from '@/hooks/useFeishuLogin'
import { chatDB } from '@/lib/database/ChatDatabaseIntegration'
import { 
  Database, 
  Users, 
  MessageCircle, 
  BarChart3, 
  Search,
  Calendar,
  Heart,
  CheckCircle,
  Clock,
  TrendingUp,
  Activity
} from 'lucide-react'

export default function DatabaseDashboardPage() {
  const { isLoggedIn, userInfo } = useFeishuLogin()
  const [loading, setLoading] = useState(false)
  const [userStats, setUserStats] = useState<any>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [emotionAnalytics, setEmotionAnalytics] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  useEffect(() => {
    if (isLoggedIn) {
      loadDashboardData()
    }
  }, [isLoggedIn])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // 初始化数据库用户
      await chatDB.initializeUser()
      
      // 加载用户统计
      const stats = await chatDB.getUserStats()
      setUserStats(stats)
      
      // 加载对话历史
      const convs = await chatDB.getUserConversations(1, 10)
      setConversations(convs)
      
      // 加载情绪分析
      const emotions = await chatDB.getEmotionAnalytics(30)
      setEmotionAnalytics(emotions)
      
    } catch (error) {
      console.error('❌ 加载仪表板数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    try {
      const results = await chatDB.searchConversations(searchQuery)
      setSearchResults(results)
    } catch (error) {
      console.error('❌ 搜索失败:', error)
    }
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString('zh-CN')
  }

  const getEmotionColor = (score: number) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-blue-600'
    if (score >= 4) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription>
              请先登录飞书账号以查看数据库仪表板
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Database className="h-8 w-8 text-blue-600" />
              数据库仪表板
            </h1>
            <p className="text-gray-600 mt-1">
              查看您的对话数据、情绪分析和学习统计
            </p>
          </div>
          <Button onClick={loadDashboardData} disabled={loading}>
            {loading ? '加载中...' : '刷新数据'}
          </Button>
        </div>

        {/* 用户信息卡片 */}
        {userInfo && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                用户信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {userInfo.avatar && (
                  <img 
                    src={userInfo.avatar} 
                    alt={userInfo.name}
                    className="w-12 h-12 rounded-full"
                  />
                )}
                <div>
                  <h3 className="font-medium">{userInfo.name}</h3>
                  <p className="text-sm text-gray-600">{userInfo.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 统计概览 */}
        {userStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{userStats.conversations?.total || 0}</p>
                    <p className="text-sm text-gray-600">总对话数</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Activity className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{userStats.conversations?.messages || 0}</p>
                    <p className="text-sm text-gray-600">总消息数</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Heart className="h-8 w-8 text-red-600" />
                  <div>
                    <p className={`text-2xl font-bold ${getEmotionColor(userStats.emotions?.averageScore || 5)}`}>
                      {userStats.emotions?.averageScore?.toFixed(1) || '5.0'}
                    </p>
                    <p className="text-sm text-gray-600">平均情绪分数</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold">{userStats.learning?.completedTasks || 0}</p>
                    <p className="text-sm text-gray-600">已完成任务</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 主要内容区域 */}
        <Tabs defaultValue="conversations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="conversations">对话历史</TabsTrigger>
            <TabsTrigger value="emotions">情绪分析</TabsTrigger>
            <TabsTrigger value="search">搜索</TabsTrigger>
            <TabsTrigger value="analytics">数据分析</TabsTrigger>
          </TabsList>

          {/* 对话历史 */}
          <TabsContent value="conversations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  最近对话
                </CardTitle>
              </CardHeader>
              <CardContent>
                {conversations.length > 0 ? (
                  <div className="space-y-4">
                    {conversations.map((conv) => (
                      <div key={conv.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{conv.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">
                              {conv.messages.length} 条消息
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              创建于: {formatDate(conv.createdAt)}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {formatDate(conv.updatedAt)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    暂无对话记录
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 情绪分析 */}
          <TabsContent value="emotions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  情绪趋势分析
                </CardTitle>
              </CardHeader>
              <CardContent>
                {emotionAnalytics.length > 0 ? (
                  <div className="space-y-4">
                    {emotionAnalytics.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-medium">{item._id.date}</p>
                          <p className="text-sm text-gray-600">
                            {item.messageCount} 条消息
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${getEmotionColor(item.avgScore)}`}>
                            {item.avgScore.toFixed(1)}
                          </p>
                          <p className="text-xs text-gray-500">平均分数</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    暂无情绪分析数据
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 搜索 */}
          <TabsContent value="search">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  搜索对话
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="输入搜索关键词..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch}>搜索</Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">搜索结果 ({searchResults.length})</h4>
                    {searchResults.map((result) => (
                      <div key={result.id} className="border rounded-lg p-3">
                        <h5 className="font-medium">{result.title}</h5>
                        <p className="text-sm text-gray-600 mt-1">
                          创建于: {formatDate(result.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 数据分析 */}
          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  数据分析
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userStats ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">学习统计</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>学习时间:</span>
                          <span>{userStats.learning?.totalStudyTime || 0} 分钟</span>
                        </div>
                        <div className="flex justify-between">
                          <span>计划任务:</span>
                          <span>{userStats.learning?.plannedTasks || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>完成任务:</span>
                          <span>{userStats.learning?.completedTasks || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>完成率:</span>
                          <span>{userStats.learning?.completionRate?.toFixed(1) || 0}%</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">情绪统计</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>周平均分数:</span>
                          <span className={getEmotionColor(userStats.emotions?.weeklyAverage || 5)}>
                            {userStats.emotions?.weeklyAverage?.toFixed(1) || '5.0'}
                          </span>
                        </div>
                        <div>
                          <span>常见标签:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {userStats.emotions?.commonTags?.map((tag: string, index: number) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    暂无分析数据
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
