export interface Todo {
    _id: string;
    title: string;
    completed: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface CreateTodoRequest {
    title: string;
  }
  
  export interface UpdateTodoRequest {
    title?: string;
    completed?: boolean;
  }
  
  export interface TodoQuery {
    q?: string;
  }
  
  export interface ApiError {
    error: {
      message: string;
      code: string;
      details?: unknown;
    };
    requestId: string;
  }

export interface ApiResponse<TData = unknown, TMeta = Record<string, any>> {
  data: TData;
  requestId: string;
  _metadata?: TMeta;
}
  