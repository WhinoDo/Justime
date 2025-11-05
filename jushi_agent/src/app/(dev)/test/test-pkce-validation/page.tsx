'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, Info, RefreshCw } from 'lucide-react'

export default function TestPKCEValidationPage() {
  const [codeVerifier, setCodeVerifier] = useState('')
  const [validationResult, setValidationResult] = useState<any>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // 当前实现的生成函数
  const generateCodeVerifier = (): string => {
    const array = new Uint8Array(32)
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array)
    } else {
      // 服务端环境fallback
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
    }
    
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  // 符合RFC 7636标准的生成函数
  const generateRFC7636CodeVerifier = (): string => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
    const length = 43 + Math.floor(Math.random() * (128 - 43 + 1)) // 43-128字符
    
    let result = ''
    const array = new Uint8Array(length)
    
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array)
    } else {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
    }
    
    for (let i = 0; i < length; i++) {
      result += charset[array[i] % charset.length]
    }
    
    return result
  }

  // 验证code_verifier是否符合RFC 7636标准
  const validateCodeVerifier = (code: string) => {
    const results = {
      length: {
        value: code.length,
        valid: code.length >= 43 && code.length <= 128,
        requirement: '43-128 字符'
      },
      charset: {
        valid: /^[A-Za-z0-9\-._~]*$/.test(code),
        requirement: '[A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"',
        invalidChars: code.split('').filter(char => !/[A-Za-z0-9\-._~]/.test(char))
      },
      overall: false
    }
    
    results.overall = results.length.valid && results.charset.valid
    
    return results
  }

  const testCurrentImplementation = () => {
    setIsGenerating(true)
    setTimeout(() => {
      const code = generateCodeVerifier()
      setCodeVerifier(code)
      setValidationResult(validateCodeVerifier(code))
      setIsGenerating(false)
    }, 100)
  }

  const testRFC7636Implementation = () => {
    setIsGenerating(true)
    setTimeout(() => {
      const code = generateRFC7636CodeVerifier()
      setCodeVerifier(code)
      setValidationResult(validateCodeVerifier(code))
      setIsGenerating(false)
    }, 100)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-6 w-6 text-blue-600" />
              PKCE Code Verifier 标准验证
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">RFC 7636 标准要求</p>
                  <ul className="text-sm space-y-1 ml-4 list-disc">
                    <li><strong>长度限制：</strong> 最短 43 字符，最长 128 字符</li>
                    <li><strong>可用字符集：</strong> [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"</li>
                    <li><strong>示例值：</strong> <code className="bg-gray-100 px-1 rounded">TxYmzM4PHLBlqm5NtnCmwxMH8mFlRWl_ipie3O0aVzo</code></li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex gap-4">
              <Button 
                onClick={testCurrentImplementation} 
                disabled={isGenerating}
                className="flex-1"
              >
                {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                测试当前实现
              </Button>
              
              <Button 
                onClick={testRFC7636Implementation}
                disabled={isGenerating}
                variant="outline"
                className="flex-1"
              >
                {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                测试标准实现
              </Button>
            </div>

            {codeVerifier && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">生成的 Code Verifier:</h3>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <code className="text-sm font-mono break-all">{codeVerifier}</code>
                  </div>
                </div>

                {validationResult && (
                  <div className="space-y-4">
                    <Alert variant={validationResult.overall ? "default" : "destructive"}>
                      {validationResult.overall ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <AlertDescription>
                        <div className="space-y-2">
                          <p className="font-medium">
                            {validationResult.overall ? 
                              '✅ 符合 RFC 7636 标准' : 
                              '❌ 不符合 RFC 7636 标准'
                            }
                          </p>
                        </div>
                      </AlertDescription>
                    </Alert>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader className="pb-3">
                          <h4 className="font-medium">长度验证</h4>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {validationResult.length.valid ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                              <span className="text-sm">
                                实际长度: {validationResult.length.value}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600">
                              要求: {validationResult.length.requirement}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <h4 className="font-medium">字符集验证</h4>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {validationResult.charset.valid ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                              <span className="text-sm">
                                {validationResult.charset.valid ? '字符集合法' : '含有非法字符'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600">
                              要求: {validationResult.charset.requirement}
                            </p>
                            {validationResult.charset.invalidChars.length > 0 && (
                              <p className="text-xs text-red-600">
                                非法字符: {validationResult.charset.invalidChars.join(', ')}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Alert>
              <RefreshCw className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">实现对比</p>
                  <ul className="text-sm space-y-1 ml-4 list-disc">
                    <li><strong>当前实现：</strong> 使用 Base64URL 编码，可能产生不符合长度要求的结果</li>
                    <li><strong>标准实现：</strong> 直接从允许的字符集中随机选择，确保符合 RFC 7636</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
