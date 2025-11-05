/**
 * 后端配置管理
 */

export interface BackendConfig {
  // 项目信息
  PROJECT_NAME: string;
  VERSION: string;
  API_V1_STR: string;
  
  // 服务器配置
  HOST: string;
  PORT: number;
  DEBUG: boolean;
  
  // 飞书配置
  FEISHU_CLIENT_ID: string;
  FEISHU_CLIENT_SECRET: string;
  FEISHU_BASE_URL: string;
  
  // CORS配置
  ALLOWED_ORIGINS: string[];
}

export const backendConfig: BackendConfig = {
  // 项目信息
  PROJECT_NAME: "聚石智能助手后端服务",
  VERSION: "1.0.0",
  API_V1_STR: "/api/v1",
  
  // 服务器配置
  HOST: process.env.HOST || "127.0.0.1",
  PORT: parseInt(process.env.PORT || "8080"),
  DEBUG: process.env.NODE_ENV === "development",
  
  // 飞书配置
  FEISHU_CLIENT_ID: process.env.FEISHU_CLIENT_ID || "",
  FEISHU_CLIENT_SECRET: process.env.FEISHU_CLIENT_SECRET || "",
  FEISHU_BASE_URL: "https://open.feishu.cn/open-apis",
  
  // CORS配置
  ALLOWED_ORIGINS: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://192.168.1.4:3000"
  ]
};
