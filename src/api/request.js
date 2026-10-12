import axios from "axios";

const service = axios.create({
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

service.interceptors.request.use(
  (config) => {
    // 注意：发往大模型的请求不再由前端携带密钥，
    // 统一走 /api 代理（本地 vite proxy / 线上 Vercel Serverless Function），
    // 由服务端补上 Authorization，前端 bundle 里搜不到任何 sk- 开头的字符串。
    //
    // 普通业务接口仍然使用登录后拿到的 token
    if (sessionStorage.getItem("token")) {
      const token = sessionStorage.getItem("token");
      config.headers["Authorization"] = "Bearer " + token;
    }
    return config;
  },
  (error) => {
    Promise.reject(error);
  }
);

service.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      if (error.request.status == 0) {
        error.message = "服务器发生错误，请检查服务器。";
      }
    }
    return Promise.reject(error);
  }
);

export default service;
