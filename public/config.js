// 说明：这两个地址都是「相对自己的后端」的地址
//   · 本地开发：/api 由 vite.config.js 的 server.proxy 转发到 https://api.deepseek.com
//   · 线上部署：/api 由 Vercel 的 api/[...path].js 转发（密钥只在服务端环境变量里）
// 所以前端代码里再也不会出现任何 API Key。
const QUERY_BASE_URL = "http://127.0.0.1:3000"; // 业务接口基础地址（本地 Node 后端）
const DEEP_SEEK = "/api"; // 大模型接口：统一走代理，不再直连 api.deepseek.com

/**
 * 注册到window对象上
 */
window.config = {
  baseUrl: QUERY_BASE_URL,
  deepseekUrl: DEEP_SEEK,
};
