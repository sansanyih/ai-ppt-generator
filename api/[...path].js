// DeepSeek 流式代理（Vercel Serverless Function · Edge Runtime）
//
// 作用：把浏览器发往 /api/** 的请求转发到 https://api.deepseek.com/**，
//      并在服务端补上 Authorization 头。
// 这样前端 bundle 里永远不会出现 sk- 开头的密钥（可以被任何人 F12 拿走）。
//
// 本地开发不经过这里：由 vite.config.js 里的 server.proxy 完成同样的事。
//
// 例：POST /api/chat/completions  ->  POST https://api.deepseek.com/chat/completions
//     GET  /api/user/balance      ->  GET  https://api.deepseek.com/user/balance
export const config = { runtime: 'edge' }

const UPSTREAM = 'https://api.deepseek.com'

export default async function handler(request) {
  // 兼容两种变量名，优先用不带 VITE_ 前缀的（Vite 不会把不带前缀的变量打进前端包）
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY

  if (!apiKey) {
    return json({ error: '服务端未配置 DEEPSEEK_API_KEY，请在 Vercel 环境变量里设置' }, 500)
  }

  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api\/?/, '')

  if (!path) {
    return json({ error: '缺少要转发的接口路径，例如 /api/chat/completions' }, 400)
  }

  const hasBody = !['GET', 'HEAD'].includes(request.method)

  const upstream = await fetch(`${UPSTREAM}/${path}${url.search}`, {
    method: request.method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: hasBody ? await request.text() : undefined,
  })

  // 直接把上游响应（含 SSE 流）透传回浏览器，不做缓冲
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      'cache-control': 'no-cache, no-transform',
    },
  })
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
