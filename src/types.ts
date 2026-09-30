export interface Product {
  id: string;
  name: string;
  category: "Electronics" | "Apparel" | "Home" | "Beauty" | "General";
  brand: string;
  price: number;
  sales: number;
  revenue: number;
  stock: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
  image?: string;
}

export interface OrderRecord {
  id: string;
  customerName: string;
  productName: string;
  quantity: number;
  price: number;
  channel: string;
  date: string;
  
  // Optional properties from Order for flexibility and backwards compatibility
  email?: string;
  brand?: string;
  status?: "Paid" | "Pending" | "Refunded";
  datasetId?: string;
  sheetName?: string;
  sheetRowIndices?: number[];
  orderNumber?: string;
  itemName?: string;
  unitPrice?: number;
  paidPrice?: number;
  category?: string;
}

export interface IncomeRecord {
  id: string;
  orderId: string; // สำหรับอ้างอิง
  total: number;
  platformFee: number;
  shippingFee: number;
  netIncome: number;
  date: string;
  channel: string;
  
  // Optional properties for flexibility and backwards compatibility
  datasetId?: string;
  sheetName?: string;
  sheetRowIndices?: number[];
}

export interface Order {
  id: string;
  customerName: string;
  email: string;
  productName: string;
  brand: string;
  channel: string;
  total?: number;
  quantity: number;
  status: "Paid" | "Pending" | "Refunded";
  date: string; // YYYY-MM-DD
  shippingFee?: number;
  platformFee?: number;
  netIncome?: number;
  netIncomeFallback?: "none" | "calculated" | "estimated_no_fees" | "na";
  isIncome?: boolean;
  datasetId?: string;
  sheetName?: string;
  sheetRowIndices?: number[];
  hasTotal?: boolean;
  hasNetIncome?: boolean;
  hasPlatformFee?: boolean;
  hasShippingFee?: boolean;
  hasDate?: boolean;
  orderNumber?: string;
  itemName?: string;
  unitPrice?: number;
  paidPrice?: number;
  type?: "order" | "income";
  kind?: "order" | "income";
  category?: string;
  stock?: number;
  
  // New properties for supporting OrderRecord and IncomeRecord integration
  price?: number;
  orderId?: string;
  fileName?: string;
  datasetName?: string;
  isCancelled?: boolean;
  isReturnRefund?: boolean;
  cancelReason?: string;
  isManual?: boolean;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: "Admin" | "Manager" | "User";
  status: "Active" | "Inactive";
  password: string;
  tasks?: string[];
  avatar?: string;
  phone?: string;
}

export interface ApprovalRequest {
  id: string;
  type: "order" | "user" | "income" | "orderRecord" | "incomeRecord";
  targetId: string;
  targetName: string;
  details: string;
  requestedBy: string;
  date: string;
}

export interface AuditLog {
  id: string;
  action: "Edit" | "Delete" | "Import" | "System";
  targetType: "order" | "product" | "user" | "income" | "orderRecord" | "incomeRecord";
  targetId: string;
  timestamp: string;
  performedBy: string;
  details: string;
  previousData?: string;
  newData?: string;
}

export interface SheetData {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
  hidden?: boolean;
  Hidden?: boolean;
}

export interface UploadedDataset {
  id: string;
  fileName: string;
  platform: "lazada" | "shopee" | "tiktok" | "facebook" | "line" | "unknown";
  type: "income" | "order" | "orderRecord" | "incomeRecord";
  sheets: SheetData[];
  uploadedAt: string;
  fileType?: "product" | "sales" | "income" | "order" | "orderRecord" | "incomeRecord";
  kind?: string;
  dateRange?: { min?: string; max?: string };
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "task" | "import" | "inventory" | "order" | "activity" | "system" | "announcement";
  targetRoles?: ("Admin" | "Manager" | "User")[];
  targetUserId?: string;
  senderId?: string;
  senderName: string;
  senderRole?: "Admin" | "Manager" | "User" | "System";
  timestamp: string;
  readBy: string[];
  actionTab?: "dashboard" | "sales" | "calculator" | "users" | "settings" | "dataset";
  priority?: "normal" | "important" | "urgent";
  actionType?: "create" | "import" | "edit" | "delete";
}

export interface TrashItem {
  id: string;
  title: string;
  itemType: "product" | "order" | "income" | "dataset" | "bulk_products" | "bulk_orders" | "bulk_income" | "all_data";
  itemCount: number;
  data: unknown;
  deletedAt: string;
  deletedBy: string;
  deletedByRole?: string;
  details?: string;
}


