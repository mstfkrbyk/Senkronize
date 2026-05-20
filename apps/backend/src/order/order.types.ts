export interface BulkResult {
  success: number;
  failed: number;
  errors: { id: string; message: string }[];
}

export interface SerializedOrderNote {
  id: string;
  orderId: string;
  userId: string;
  userName: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}
