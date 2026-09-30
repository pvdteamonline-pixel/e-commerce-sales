import { supabase } from "../supabaseClient";
import type { AppUser, Product, Order, AuditLog, UploadedDataset, AppNotification, TrashItem } from "../types";

// ==================== USERS ====================
export async function fetchUsersFromSupabase(): Promise<AppUser[] | null> {
  try {
    const { data, error } = await supabase.from("users").select("*");
    if (error) {
      console.warn("Supabase: Error fetching users:", error.message);
      return null;
    }
    if (!data) return [];
    return data.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username,
      role: u.role,
      status: u.status,
      password: u.password,
      tasks: Array.isArray(u.tasks) ? u.tasks : [],
    }));
  } catch (err) {
    console.error("Supabase fetch users failed:", err);
    return null;
  }
}

export async function syncUserToSupabase(user: AppUser): Promise<boolean> {
  try {
    const { error } = await supabase.from("users").upsert({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      password: user.password,
      tasks: user.tasks || [],
    });
    if (error) {
      console.error("Supabase sync user error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase sync user failed:", err);
    return false;
  }
}

export async function deleteUserFromSupabase(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) {
      console.error("Supabase delete user error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase delete user failed:", err);
    return false;
  }
}

// ==================== PRODUCTS ====================
export async function fetchProductsFromSupabase(): Promise<Product[] | null> {
  try {
    const { data, error } = await supabase.from("Orders").select("*");
    if (error) {
      console.warn("Supabase: Error fetching products:", error.message);
      return null;
    }
    if (!data) return [];
    return data.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category as Product["category"],
      brand: p.brand,
      price: Number(p.price) || 0,
      sales: Number(p.sales) || 0,
      revenue: Number(p.revenue) || 0,
      stock: Number(p.stock) || 0,
      status: p.status as Product["status"],
    }));
  } catch (err) {
    console.error("Supabase fetch products failed:", err);
    return null;
  }
}

export async function syncProductsToSupabase(products: Product[]): Promise<boolean> {
  if (products.length === 0) return true;
  try {
    const payload = products.map((p) => ({
      id: String(p.id),
      name: String(p.name || "Unnamed Product"),
      category: String(p.category || "General"),
      brand: String(p.brand || "ทั่วไป"),
      price: Number(p.price) || 0,
      sales: Number(p.sales) || 0,
      revenue: Number(p.revenue) || 0,
      stock: Number(p.stock) || 0,
      status: String(p.status || (p.stock > 10 ? "In Stock" : p.stock > 0 ? "Low Stock" : "Out of Stock")),
    }));

    // Deduplicate by ID to prevent PostgreSQL "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const uniqueProductsMap = new Map<string, typeof payload[0]>();
    for (const item of payload) {
      uniqueProductsMap.set(item.id, item);
    }
    const deduplicatedPayload = Array.from(uniqueProductsMap.values());

    const chunkSize = 100;
    for (let i = 0; i < deduplicatedPayload.length; i += chunkSize) {
      const chunk = deduplicatedPayload.slice(i, i + chunkSize);
      const { error } = await supabase.from("Orders").upsert(chunk, { onConflict: "id" });
      if (error) {
        console.error(`Supabase sync products to Orders error (chunk ${i}):`, error.message);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error("Supabase sync products to Orders failed:", err);
    return false;
  }
}

export async function deleteProductFromSupabase(productId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("Orders").delete().eq("id", productId);
    if (error) {
      console.error("Supabase delete product error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase delete product failed:", err);
    return false;
  }
}

export async function deleteAllProductsFromSupabase(): Promise<boolean> {
  try {
    const { error } = await supabase.from("Orders").delete().neq("id", "___NON_EXISTING___");
    if (error) {
      console.error("Supabase delete all products error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase delete all products failed:", err);
    return false;
  }
}

// ==================== ORDERS / INCOME ====================
export async function fetchOrdersFromSupabase(): Promise<Order[] | null> {
  try {
    const { data, error } = await supabase.from("Income").select("*");
    if (error) {
      console.warn("Supabase: Error fetching income/orders:", error.message);
      return null;
    }
    if (!data) return [];
    return data.map((o) => ({
      id: o.id,
      customerName: o.customer_name,
      email: o.email || "",
      productName: o.product_name,
      brand: o.brand,
      channel: o.channel,
      total: Number(o.total) || 0,
      quantity: Number(o.quantity) || 1,
      status: o.status as Order["status"],
      date: o.date,
      shippingFee: Number(o.shipping_fee) || 0,
      platformFee: Number(o.platform_fee) || 0,
      netIncome: Number(o.net_income) || 0,
      hasTotal: true,
      hasNetIncome: true,
      hasPlatformFee: true,
      hasShippingFee: true,
      hasDate: true,
    }));
  } catch (err) {
    console.error("Supabase fetch orders/income failed:", err);
    return null;
  }
}

export async function syncOrdersToSupabase(orders: Order[]): Promise<boolean> {
  if (orders.length === 0) return true;
  try {
    const payload = orders.map((o) => ({
      id: String(o.id),
      customer_name: String(o.customerName || "Customer"),
      email: o.email || null,
      product_name: String(o.productName || "Product"),
      brand: String(o.brand || "Brand"),
      channel: String(o.channel || "Shopee"),
      total: Number(o.total) || 0,
      quantity: Number(o.quantity) || 1,
      status: o.status || "Paid",
      date: (o.date && o.date.length === 10) ? o.date : new Date().toISOString().split("T")[0],
      shipping_fee: Number(o.shippingFee) || 0,
      platform_fee: Number(o.platformFee) || 0,
      net_income: Number(o.netIncome) || 0,
    }));

    // Deduplicate by ID to prevent PostgreSQL "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const uniqueOrdersMap = new Map<string, typeof payload[0]>();
    for (const item of payload) {
      uniqueOrdersMap.set(item.id, item);
    }
    const deduplicatedPayload = Array.from(uniqueOrdersMap.values());

    // Chunk by 100 for safety
    const chunkSize = 100;
    for (let i = 0; i < deduplicatedPayload.length; i += chunkSize) {
      const chunk = deduplicatedPayload.slice(i, i + chunkSize);
      const { error } = await supabase.from("Income").upsert(chunk, { onConflict: "id" });
      if (error) {
        console.error(`Supabase sync income/orders error (chunk ${i}):`, error.message);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error("Supabase sync income/orders failed:", err);
    return false;
  }
}

export async function deleteOrderFromSupabase(orderId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("Income").delete().eq("id", orderId);
    if (error) {
      console.error("Supabase delete income/order error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase delete income/order failed:", err);
    return false;
  }
}

export async function deleteOrdersByIdsFromSupabase(orderIds: string[]): Promise<boolean> {
  if (!orderIds || orderIds.length === 0) return true;
  try {
    const chunkSize = 100;
    for (let i = 0; i < orderIds.length; i += chunkSize) {
      const chunk = orderIds.slice(i, i + chunkSize);
      const { error } = await supabase.from("Income").delete().in("id", chunk);
      if (error) {
        console.error(`Supabase delete income/orders chunk error:`, error.message);
      }
    }
    return true;
  } catch (err) {
    console.error("Supabase delete income/orders by IDs failed:", err);
    return false;
  }
}

export async function deleteAllOrdersFromSupabase(): Promise<boolean> {
  try {
    const { error } = await supabase.from("Income").delete().neq("id", "___NON_EXISTING___");
    if (error) {
      console.error("Supabase delete all income/orders error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase delete all income/orders failed:", err);
    return false;
  }
}

// ==================== AUDIT LOGS ====================
export async function fetchAuditLogsFromSupabase(): Promise<AuditLog[] | null> {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.warn("Supabase: Error fetching audit_logs:", error.message);
      return null;
    }
    if (!data) return [];
    return data.map((l) => ({
      id: l.id,
      action: l.action as AuditLog["action"],
      targetType: l.target_type as AuditLog["targetType"],
      targetId: l.target_id,
      timestamp: l.timestamp,
      performedBy: l.performed_by,
      details: l.details,
      newData: l.new_data || undefined,
    }));
  } catch (err) {
    console.error("Supabase fetch audit logs failed:", err);
    return null;
  }
}

export async function addAuditLogToSupabase(log: AuditLog): Promise<boolean> {
  try {
    const { error } = await supabase.from("audit_logs").upsert([
      {
        id: log.id,
        action: log.action,
        target_type: log.targetType,
        target_id: log.targetId,
        timestamp: log.timestamp,
        performed_by: log.performedBy,
        details: log.details,
        new_data: log.newData || null,
      },
    ], { onConflict: "id" });
    if (error) {
      console.error("Supabase add audit log error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase add audit log failed:", err);
    return false;
  }
}

// ==================== UPLOADED DATASETS ====================
export async function fetchDatasetsFromSupabase(): Promise<UploadedDataset[] | null> {
  try {
    const { data, error } = await supabase.from("uploaded_datasets").select("*").order("uploaded_at", { ascending: false });
    if (error) {
      console.warn("Supabase: Error fetching uploaded_datasets:", error.message);
      return null;
    }
    if (!data) return [];
    return data.map((d) => ({
      id: d.id,
      fileName: d.file_name,
      platform: d.platform,
      type: d.type,
      sheets: Array.isArray(d.sheets) ? d.sheets : [],
      uploadedAt: d.uploaded_at,
      fileType: d.file_type || "sales",
      dateRange: d.date_range || {},
    }));
  } catch (err) {
    console.error("Supabase fetch datasets failed:", err);
    return null;
  }
}

export async function syncDatasetToSupabase(dataset: UploadedDataset): Promise<boolean> {
  try {
    let validDate = new Date().toISOString();
    if (dataset.uploadedAt) {
      const parsed = Date.parse(dataset.uploadedAt);
      if (!isNaN(parsed)) {
        validDate = new Date(parsed).toISOString();
      }
    }
    const { error } = await supabase.from("uploaded_datasets").upsert({
      id: String(dataset.id),
      file_name: String(dataset.fileName || "Dataset"),
      platform: dataset.platform || "unknown",
      type: dataset.type || "order",
      sheets: Array.isArray(dataset.sheets) ? dataset.sheets : [],
      uploaded_at: validDate,
      file_type: dataset.fileType || "sales",
      date_range: dataset.dateRange || {},
    });
    if (error) {
      console.error("Supabase sync dataset error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase sync dataset failed:", err);
    return false;
  }
}

export async function deleteDatasetFromSupabase(datasetId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("uploaded_datasets").delete().eq("id", datasetId);
    if (error) {
      console.error("Supabase delete dataset error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase delete dataset failed:", err);
    return false;
  }
}

// ==================== NOTIFICATIONS ====================
export async function fetchNotificationsFromSupabase(): Promise<AppNotification[] | null> {
  try {
    const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(60);
    if (error) {
      console.warn("Supabase: Error fetching notifications:", error.message);
      return null;
    }
    if (!data) return [];
    return data.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      targetRoles: Array.isArray(n.target_roles) ? n.target_roles : undefined,
      targetUserId: n.target_user_id || undefined,
      senderId: n.sender_id || undefined,
      senderName: n.sender_name || "System",
      senderRole: n.sender_role || "System",
      timestamp: n.timestamp || new Date().toLocaleString("th-TH"),
      readBy: Array.isArray(n.read_by) ? n.read_by : [],
      actionTab: n.action_tab || "dashboard",
      priority: n.priority || "normal",
      actionType: n.action_type || "create",
    }));
  } catch (err) {
    console.error("Supabase fetch notifications failed:", err);
    return null;
  }
}

export async function syncNotificationToSupabase(notif: AppNotification): Promise<boolean> {
  try {
    const { error } = await supabase.from("notifications").upsert({
      id: notif.id,
      title: notif.title,
      message: notif.message,
      type: notif.type || "system",
      target_roles: notif.targetRoles || ["Admin", "Manager", "User"],
      target_user_id: notif.targetUserId || null,
      sender_id: notif.senderId || null,
      sender_name: notif.senderName || "System",
      sender_role: notif.senderRole || "System",
      timestamp: notif.timestamp || new Date().toLocaleString("th-TH"),
      read_by: notif.readBy || [],
      action_tab: notif.actionTab || "dashboard",
      priority: notif.priority || "normal",
      action_type: notif.actionType || "create",
    });
    if (error) {
      console.error("Supabase sync notification error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase sync notification failed:", err);
    return false;
  }
}

export async function deleteNotificationFromSupabase(notifId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("notifications").delete().eq("id", notifId);
    if (error) {
      console.error("Supabase delete notification error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase delete notification failed:", err);
    return false;
  }
}

export async function clearAllNotificationsFromSupabase(): Promise<boolean> {
  try {
    const { error } = await supabase.from("notifications").delete().neq("id", "___NON_EXISTING___");
    if (error) {
      console.error("Supabase clear notifications error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase clear notifications failed:", err);
    return false;
  }
}

// ==================== TRASH BIN ====================
export async function fetchTrashFromSupabase(): Promise<TrashItem[] | null> {
  try {
    const { data, error } = await supabase.from("trash_bin").select("*").order("created_at", { ascending: false });
    if (error) {
      console.warn("Supabase: Error fetching trash_bin:", error.message);
      return null;
    }
    if (!data) return [];
    return data.map((t) => ({
      id: t.id,
      title: t.title,
      itemType: t.item_type,
      itemCount: Number(t.item_count) || 1,
      data: t.data,
      deletedAt: t.deleted_at || new Date().toLocaleString("th-TH"),
      deletedBy: t.deleted_by || "System",
      deletedByRole: t.deleted_by_role || "Admin",
      details: t.details || undefined,
    }));
  } catch (err) {
    console.error("Supabase fetch trash failed:", err);
    return null;
  }
}

export async function syncTrashItemToSupabase(item: TrashItem): Promise<boolean> {
  try {
    const { error } = await supabase.from("trash_bin").upsert({
      id: item.id,
      title: item.title,
      item_type: item.itemType,
      item_count: item.itemCount || 1,
      data: item.data || {},
      deleted_at: item.deletedAt || new Date().toLocaleString("th-TH"),
      deleted_by: item.deletedBy || "System",
      deleted_by_role: item.deletedByRole || "Admin",
      details: item.details || null,
    });
    if (error) {
      console.error("Supabase sync trash item error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase sync trash item failed:", err);
    return false;
  }
}

export async function deleteTrashItemFromSupabase(trashId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("trash_bin").delete().eq("id", trashId);
    if (error) {
      console.error("Supabase delete trash item error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase delete trash item failed:", err);
    return false;
  }
}

export async function clearTrashFromSupabase(): Promise<boolean> {
  try {
    const { error } = await supabase.from("trash_bin").delete().neq("id", "___NON_EXISTING___");
    if (error) {
      console.error("Supabase clear trash error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Supabase clear trash failed:", err);
    return false;
  }
}

// ==================== FULL APP STATE SYNC ====================
export async function fetchFullAppStateFromSupabase(): Promise<{
  products: Product[];
  orders: Order[];
  systemUsers: AppUser[];
  auditLogs: AuditLog[];
  uploadedDatasets: UploadedDataset[];
  productFiles: UploadedDataset[];
  trashItems: TrashItem[];
  notifications: AppNotification[];
} | null> {
  try {
    const [
      users,
      products,
      orders,
      datasets,
      notifications,
      trash,
      auditLogs,
    ] = await Promise.all([
      fetchUsersFromSupabase(),
      fetchProductsFromSupabase(),
      fetchOrdersFromSupabase(),
      fetchDatasetsFromSupabase(),
      fetchNotificationsFromSupabase(),
      fetchTrashFromSupabase(),
      fetchAuditLogsFromSupabase(),
    ]);

    // If all essential queries failed (e.g., offline or bad network), return null
    if (!users && !products && !orders && !datasets) {
      return null;
    }

    const allDatasets = datasets || [];
    const productFiles = allDatasets.filter(
      (d) =>
        d.fileType === "product" ||
        (d.type as string) === "product" ||
        d.fileType === "order" ||
        (d.type as string) === "order" ||
        (!d.fileType && d.type !== "income" && !d.fileName.toLowerCase().includes("income") && !d.fileName.toLowerCase().includes("รายรับ") && !d.fileName.toLowerCase().includes("statement"))
    );
    const uploadedDatasets = allDatasets;

    return {
      systemUsers: users || [],
      products: products || [],
      orders: orders || [],
      uploadedDatasets,
      productFiles,
      notifications: notifications || [],
      trashItems: trash || [],
      auditLogs: auditLogs || [],
    };
  } catch (err) {
    console.error("Failed to fetch full app state from Supabase:", err);
    return null;
  }
}

export async function syncFullAppStateToSupabase(payload: {
  products?: Product[];
  orders?: Order[];
  systemUsers?: AppUser[];
  auditLogs?: AuditLog[];
  uploadedDatasets?: UploadedDataset[];
  productFiles?: UploadedDataset[];
  trashItems?: TrashItem[];
  notifications?: AppNotification[];
}): Promise<void> {
  try {
    const syncPromises: Promise<unknown>[] = [];

    if (payload.products && payload.products.length > 0) {
      syncPromises.push(syncProductsToSupabase(payload.products));
    }

    if (payload.orders && payload.orders.length > 0) {
      syncPromises.push(syncOrdersToSupabase(payload.orders));
    }

    if (payload.systemUsers && payload.systemUsers.length > 0) {
      for (const u of payload.systemUsers) {
        syncPromises.push(syncUserToSupabase(u));
      }
    }

    // Merge datasets uniquely by id to prevent duplicate sync or flipping fileType
    const datasetMap = new Map<string, UploadedDataset>();
    if (payload.uploadedDatasets) {
      for (const ds of payload.uploadedDatasets) {
        if (ds && ds.id) {
          datasetMap.set(ds.id, ds);
        }
      }
    }
    if (payload.productFiles) {
      for (const pf of payload.productFiles) {
        if (pf && pf.id) {
          // If already in map, keep existing or merge cleanly without overriding
          const existing = datasetMap.get(pf.id);
          datasetMap.set(pf.id, {
            ...pf,
            fileType: pf.fileType || existing?.fileType || "product",
          });
        }
      }
    }
    for (const ds of datasetMap.values()) {
      syncPromises.push(syncDatasetToSupabase(ds));
    }

    if (payload.trashItems) {
      for (const t of payload.trashItems) {
        syncPromises.push(syncTrashItemToSupabase(t));
      }
    }

    if (payload.notifications) {
      for (const n of payload.notifications) {
        syncPromises.push(syncNotificationToSupabase(n));
      }
    }

    await Promise.allSettled(syncPromises);
  } catch (err) {
    console.error("Failed to sync full app state to Supabase:", err);
  }
}


