'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'

export default function TestUIPage() {
  const [switchValue, setSwitchValue] = useState(false)
  const [sliderValue, setSliderValue] = useState([50])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">UI组件测试</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Switch测试 */}
        <Card>
          <CardHeader>
            <CardTitle>Switch 组件</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="test-switch"
                checked={switchValue}
                onCheckedChange={setSwitchValue}
              />
              <Label htmlFor="test-switch">
                开关状态: {switchValue ? '开启' : '关闭'}
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Slider测试 */}
        <Card>
          <CardHeader>
            <CardTitle>Slider 组件</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>滑块值: {sliderValue[0]}</Label>
              <Slider
                value={sliderValue}
                onValueChange={setSliderValue}
                max={100}
                min={0}
                step={1}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs测试 */}
        <Card>
          <CardHeader>
            <CardTitle>Tabs 组件</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="tab1" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="tab1">标签1</TabsTrigger>
                <TabsTrigger value="tab2">标签2</TabsTrigger>
                <TabsTrigger value="tab3">标签3</TabsTrigger>
              </TabsList>
              <TabsContent value="tab1" className="mt-4">
                <p>这是标签1的内容</p>
              </TabsContent>
              <TabsContent value="tab2" className="mt-4">
                <p>这是标签2的内容</p>
              </TabsContent>
              <TabsContent value="tab3" className="mt-4">
                <p>这是标签3的内容</p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* DropdownMenu测试 */}
        <Card>
          <CardHeader>
            <CardTitle>DropdownMenu 组件</CardTitle>
          </CardHeader>
          <CardContent>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">打开菜单</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>选项 1</DropdownMenuItem>
                <DropdownMenuItem>选项 2</DropdownMenuItem>
                <DropdownMenuItem>选项 3</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
