/**
 * API连接测试脚本
 * 用于验证硅基流动API密钥配置是否正确
 * 
 * 使用方法: npm run test:api
 */

require('dotenv').config({ path: './.env.local' })
const { OpenAI } = require('openai')

const apiKey = process.env.SILICONFLOW_API_KEY

if (!apiKey) {
  console.error('❌ 错误：未找到 SILICONFLOW_API_KEY')
  console.error('   请检查 .env.local 文件')
  process.exit(1)
}

console.log('✅ 成功读取 API 密钥')

const client = new OpenAI({
  apiKey,
  baseURL: 'https://api.siliconflow.cn/v1',
})

async function testConnection() {
  console.log('🔍 正在测试API连接...')
  
  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: '你好' }],
      max_tokens: 10,
    })
    
    console.log('✅ API连接成功！')
    console.log('📝 响应:', response.choices[0].message.content)
    console.log('\n🎉 你的 API 密钥配置正确，可以正常工作！')
  } catch (error) {
    console.error('\n❌ API测试失败')
    console.error('   可能的原因：')
    console.error('   1. API密钥无效或已过期')
    console.error('   2. 网络无法访问 https://api.siliconflow.cn')
    console.error('   3. 账户余额不足')
    console.error('\n详细错误:', error.message)
    process.exit(1)
  }
}

testConnection() 