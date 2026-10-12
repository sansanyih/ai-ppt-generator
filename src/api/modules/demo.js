import request from "@/api/request";
import { data } from "~/server"; // /public/server
const baseUrl = data.baseUrl + "web_transport/"; // 添加代理(本地在vite.config.js添加，服务器在nginx添加)

// get使用案例
export function getList(param) {
  return request({
    url: baseUrl + "interfce/face1",
    method: "get",
    params: param,
  });
}

// post使用案例
export function saveList(data) {
  return request({
    url: baseUrl + "interfce/face1",
    method: "post",
    data,
  });
}

// delete使用案例
export function deleteList(param) {
  return request({
    url: baseUrl + "interfce/face1",
    method: "delete",
    params: param,
  });
}
