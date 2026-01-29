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

// ----------------------------------------------------------
// Standardized API Response Types
// ----------------------------------------------------------

/**
 * Pagination metadata for list endpoints
 */
export interface PagingMeta {
  count: number;      // Items in current response
  total: number;      // Total items available
  limit: number;      // Items per page/request
  offset?: number;    // Offset-based pagination
  page?: number;      // Page-based pagination
  pages?: number;     // Total pages (for page-based)
  hasMore?: boolean;  // More items available
}

/**
 * Sort metadata
 */
export interface SortMeta {
  field: string;
  order: "asc" | "desc";
}

/**
 * Response metadata container
 * Allows additional properties for backward compatibility
 */
export interface ResponseMeta {
  paging?: PagingMeta;
  filters?: Record<string, any>;
  sort?: SortMeta;
  [key: string]: any; // Allow additional properties for backward compatibility
}

/**
 * Standard API error response
 */
export interface ApiError {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
  requestId: string;
}

/**
 * Standard API success response
 */
export interface ApiResponse<TData = unknown, TMeta = ResponseMeta> {
  data: TData;
  requestId: string;
  message?: string;
  _metadata?: TMeta;
}

  