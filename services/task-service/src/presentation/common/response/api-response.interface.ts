export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta: {
    timestamp: string;
    requestId?: string;
    errorCode?: string;
    [key: string]: any;
  };
}