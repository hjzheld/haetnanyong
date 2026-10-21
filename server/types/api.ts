export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
}

export interface ApiContext {
  user: AuthUser;
}
