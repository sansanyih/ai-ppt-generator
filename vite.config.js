import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 第三个参数传 "" 表示加载所有变量（不只是 VITE_ 前缀的）
  const env = loadEnv(mode, process.cwd(), "");
  // 兼容两种变量名，优先不带 VITE_ 前缀的那个（不带前缀的不会被 Vite 打进前端包）
  const apiKey = env.DEEPSEEK_API_KEY || env.VITE_DEEPSEEK_API_KEY;

  return {
    plugins: [vue()],
    css: {
      preprocessorOptions: {
        scss: {},
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"), // 设置 @ 别名指向 src 目录
      },
    },
    server: {
      proxy: {
        // 浏览器只请求 /api/**，真实密钥由这里的 Node 进程补上，不会进浏览器
        // 线上则由 Vercel 的 api/[...path].js 做同样的事
        "/api": {
          target: "https://api.deepseek.com",
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (apiKey) {
                proxyReq.setHeader("Authorization", `Bearer ${apiKey}`);
              } else {
                console.warn(
                  "[vite] 未找到 DEEPSEEK_API_KEY，请复制 .env.example 为 .env.local 并填入你的 Key"
                );
              }
            });
          },
        },
      },
    },
  };
});
