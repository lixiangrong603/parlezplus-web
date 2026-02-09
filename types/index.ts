// 导出所有类型定义
export * from './worker';

// 前端其他类型定义
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Omit<import('./worker').User, 'password_hash'>;
}
