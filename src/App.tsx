/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, lazy, Suspense, useMemo, useCallback } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Upload,
  Users,
  ChevronDown,
  AlertTriangle,
  Check,
  XCircle,
  Info,
  X,
  Menu,
  Search,
  Download,
  LogOut,
  BarChart3,
  Lock,
  Settings as SettingsIcon,
  Package,
  Coins,
  Bell,
  Megaphone,
  Trash2,
} from "lucide-react";

// Lazy-loaded components
const DashboardTab = lazy(() => import("./components/DashboardTab").then(m => ({ default: m.DashboardTab })));
const SalesTab = lazy(() => import("./components/SalesTab").then(m => ({ default: m.SalesTab })));
const CalculatorTab = lazy(() => import("./components/CalculatorTab").then(m => ({ default: m.CalculatorTab })));
const ImportOrdersTab = lazy(() => import("./components/ImportOrdersTab").then(m => ({ default: m.ImportOrdersTab })));
// Users tab component
const UsersTab = lazy(() => import("./components/UsersTab").then(m => ({ default: m.UsersTab })));
const LoginScreen = lazy(() => import("./components/LoginScreen").then(m => ({ default: m.LoginScreen })));
const SettingsTab = lazy(() => import("./components/SettingsTab").then(m => ({ default: m.SettingsTab })));
import {
  AddProductModal,
  AddOrderModal,
  EditOrderModal,
  EditProductModal,
  AddUserModal,
  ConfirmationModal,
  AuditLogsModal,
  SendNotificationModal,
  AllNotificationsModal,
  TrashRecoveryModal,
} from "./components/Modals";
import { getInitials, maskCustomerName, getNotificationVisualInfo } from "./utils";
import { getTranslation } from "./utils/i18n";
import { reevaluateOrdersStatus, convertDatasetToOrders, detectPlatform } from "./utils/fileParser";
import { getLoginLockoutStatus, recordFailedLogin, resetFailedLogins } from "./utils/security";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ConfettiEffect } from "./components/ConfettiEffect";
import { initialUsersList, initialNotifications } from "./mockData";
import type {
  Product,
  Order,
  AppUser,
  AuditLog,
  UploadedDataset,
  AppNotification,
  TrashItem,
} from "./types";
import {
  fetchUsersFromSupabase,
  fetchProductsFromSupabase,
  fetchOrdersFromSupabase,
  fetchAuditLogsFromSupabase,
  fetchDatasetsFromSupabase,
  fetchNotificationsFromSupabase,
  fetchTrashFromSupabase,
  syncOrdersToSupabase,
  syncProductsToSupabase,
  syncUserToSupabase,
  deleteUserFromSupabase,
  deleteProductFromSupabase,
  deleteAllProductsFromSupabase,
  deleteOrdersByIdsFromSupabase,
  deleteAllOrdersFromSupabase,
  addAuditLogToSupabase,
  syncDatasetToSupabase,
  deleteDatasetFromSupabase,
  syncNotificationToSupabase,
  deleteNotificationFromSupabase,
  clearAllNotificationsFromSupabase,
  syncTrashItemToSupabase,
  deleteTrashItemFromSupabase,
  clearTrashFromSupabase,
} from "./services/supabaseService";

interface RemoteSyncPayload {
  products?: Product[];
  orders?: Order[];
  systemUsers?: AppUser[];
  auditLogs?: AuditLog[];
  uploadedDatasets?: UploadedDataset[];
  productFiles?: UploadedDataset[];
  trashItems?: TrashItem[];
  notifications?: AppNotification[];
  adminUnreadCount?: number;
  [key: string]: unknown;
}

const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const formatterUSD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const formatterJPY = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" });
const formatterTHB = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" });

export default function App() {
  if (typeof window !== "undefined" && !localStorage.getItem("hasPurgedAllSalesData_v18")) {
    try {
      localStorage.removeItem("orders");
      localStorage.removeItem("mock_supabase_orders");
      localStorage.removeItem("income_data");
      localStorage.removeItem("uploadedDatasets");
      localStorage.removeItem("productFiles");
      localStorage.removeItem("trash_bin_items");
      localStorage.setItem("hasPurgedAllSalesData_v18", "true");
      // Also clear Supabase datasets and orders
      deleteAllOrdersFromSupabase().catch(() => {});
      fetchDatasetsFromSupabase().then((ds) => {
        if (ds && ds.length > 0) {
          ds.forEach((d) => deleteDatasetFromSupabase(d.id).catch(() => {}));
        }
      }).catch(() => {});
    } catch (e) {
      console.warn("Failed to clear sales data in localStorage:", e);
    }
  }

  const [uploadedDatasets, setUploadedDatasets] = useState<UploadedDataset[]>(
    () => {
      try {
        const saved = localStorage.getItem("uploadedDatasets");
        if (saved) {
          const parsed: UploadedDataset[] = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            let hasChanges = false;
            const normalized = parsed.map((ds) => {
              if (!ds.platform || ds.platform === "unknown") {
                const detected = detectPlatform(ds.fileName, ds.sheets?.[0]?.headers || []);
                if (detected !== "unknown") {
                  hasChanges = true;
                  return { ...ds, platform: detected };
                }
              }
              return ds;
            });
            if (hasChanges) {
              try {
                localStorage.setItem("uploadedDatasets", JSON.stringify(normalized));
              } catch (e) {
                console.warn("Failed to persist normalized datasets:", e);
              }
            }
            return normalized;
          }
        }
        return [];
      } catch {
        return [];
      }
    },
  );

  const [productFiles, setProductFiles] = useState<UploadedDataset[]>(
    () => {
      try {
        const saved = localStorage.getItem("productFiles");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    },
  );


  // --- Old Site States ---
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    // ล้าง session ถาวรใน localStorage เดิมออก เพื่อความปลอดภัย
    try {
      localStorage.removeItem("currentUser");
    } catch {
      // Ignore errors when localStorage is unavailable
    }

    const saved = sessionStorage.getItem("currentUser");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "sales" | "calculator" | "users" | "settings" | "import-orders"
  >(() => {
    const saved = localStorage.getItem("activeTab");
    if (
      saved === "dashboard" ||
      saved === "sales" ||
      saved === "calculator" ||
      saved === "users" ||
      saved === "settings" ||
      saved === "import-orders"
    ) {
      return saved;
    }
    return "dashboard";
  });

  const [languageSetting, setLanguageSetting] = useState<string>(() => {
    return localStorage.getItem("languageSetting") || "th";
  });
  const [fontSetting, setFontSetting] = useState<string>(() => {
    return localStorage.getItem("fontSetting") || "IBM Plex Sans Thai";
  });
  const [currencySetting, setCurrencySetting] = useState<string>(() => {
    return localStorage.getItem("currencySetting") || "THB";
  });
  const [calendarSetting, setCalendarSetting] = useState<string>(() => {
    return localStorage.getItem("calendarSetting") || "buddhist";
  });
  const [notificationsSetting, setNotificationsSetting] = useState<boolean>(() => {
    return localStorage.getItem("notificationsSetting") === "true";
  });

  const [isAuditLogsModalOpen, setIsAuditLogsModalOpen] = useState(false);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [trashItems, setTrashItems] = useState<TrashItem[]>(() => {
    try {
      const saved = localStorage.getItem("trash_bin_items");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [salesSubTab, setSalesSubTab] = useState<
    "products" | "brands" | "orders" | "income"
  >("income");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importModalMode, setImportModalMode] = useState<"orders" | "income" | "all">("all");
  const [addProductInitialTab, setAddProductInitialTab] = useState<"manual" | "import">("manual");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState("All");

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem("products");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((p) => ({
            ...p,
            price: typeof p.price === "number" && p.price > 0 && p.price <= 50000 ? p.price : 0,
          }));
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    let savedDs: UploadedDataset[] = [];
    let savedProductFiles: UploadedDataset[] = [];

    try {
      const rawDs = localStorage.getItem("uploadedDatasets");
      if (rawDs) savedDs = JSON.parse(rawDs);
    } catch {
      savedDs = [];
    }

    try {
      const rawPf = localStorage.getItem("productFiles");
      if (rawPf) savedProductFiles = JSON.parse(rawPf);
    } catch {
      savedProductFiles = [];
    }

    const allCurrentDatasets = [...(Array.isArray(savedDs) ? savedDs : []), ...(Array.isArray(savedProductFiles) ? savedProductFiles : [])];
    const currentDatasetIds = new Set(allCurrentDatasets.map((d) => d.id).filter(Boolean));

    // If datasets currently exist, they are the single source of truth for all file-based orders
    if (allCurrentDatasets.length > 0) {
      const freshOrders = allCurrentDatasets.flatMap((ds) => {
        try {
          return convertDatasetToOrders(ds);
        } catch (e) {
          console.warn("Failed to convert dataset to orders:", e);
          return [];
        }
      });

      // Keep only purely manual orders created by user (not from files/datasets)
      let manualOrders: Order[] = [];
      try {
        const savedOrders = localStorage.getItem("orders");
        if (savedOrders) {
          const parsed = JSON.parse(savedOrders);
          if (Array.isArray(parsed)) {
            manualOrders = parsed.filter((o: Order) => {
              if (!o || !o.id) return false;
              if (o.datasetId) return currentDatasetIds.has(o.datasetId);
              if (o.fileName) return false;
              return o.isManual || o.id.startsWith("ORD-MANUAL-") || o.id.startsWith("MANUAL-");
            });
          }
        }
      } catch (error) {
        console.warn("Failed to parse manual orders from localStorage", error);
      }

      const seenIds = new Set<string>();
      const result: Order[] = [];
      [...freshOrders, ...manualOrders].forEach((o) => {
        if (!o || !o.id) return;
        const key = o.id.trim().toLowerCase();
        if (!seenIds.has(key)) {
          seenIds.add(key);
          result.push(o);
        }
      });
      return result;
    }

    // Fallback: If no uploaded datasets exist, load saved orders and income from localStorage
    let ordersList: Order[] = [];
    try {
      const savedOrders = localStorage.getItem("orders");
      if (savedOrders) {
        const parsed = JSON.parse(savedOrders);
        if (Array.isArray(parsed)) {
          ordersList = parsed.filter((o: Order) => {
            const unit = (o.total || 0) / (o.quantity || 1);
            return unit <= 50000;
          });
        }
      }
    } catch (error) {
      console.warn("Failed to parse orders from localStorage", error);
    }

    let incomeList: Order[] = [];
    try {
      const savedIncome = localStorage.getItem("income_data");
      if (savedIncome) {
        const parsed = JSON.parse(savedIncome);
        if (Array.isArray(parsed)) {
          incomeList = parsed;
        }
      }
    } catch (error) {
      console.warn("Failed to parse income from localStorage", error);
    }

    const seenIds = new Set<string>();
    const result: Order[] = [];
    [...ordersList, ...incomeList].forEach((o) => {
      if (!o || !o.id) return;
      const key = o.id.trim().toLowerCase();
      if (!seenIds.has(key)) {
        seenIds.add(key);
        result.push(o);
      }
    });
    return result;
  });

  const [systemUsers, setSystemUsers] = useState<AppUser[]>(() => {
    const saved = localStorage.getItem("systemUsers");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((u: AppUser) => {
            const match = initialUsersList.find((iu) => iu.id === u.id);
            return {
              ...match,
              ...u,
              tasks: u.tasks || match?.tasks || []
            };
          });
        }
      } catch {
        // ignore
      }
    }
    return initialUsersList;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem("auditLogs");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [adminUnreadCount, setAdminUnreadCount] = useState<number>(() => {
    return parseInt(localStorage.getItem("adminUnreadCount") || "0", 10);
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem("appNotifications");
      return saved ? JSON.parse(saved) : initialNotifications;
    } catch {
      return initialNotifications;
    }
  });

  const [isSendNotificationModalOpen, setIsSendNotificationModalOpen] = useState(false);
  const [isAllNotificationsModalOpen, setIsAllNotificationsModalOpen] = useState(false);
  const [headerNotificationFilter, setHeaderNotificationFilter] = useState<"all" | "mine" | "activity" | "system">("all");

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isEditOrderOpen, setIsEditOrderOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    icon?: "trash" | "warning" | "info" | "danger";
  } | null>(null);

  const [dirtyStates, setDirtyStates] = useState<Record<string, boolean>>({});

  const updateDirtyState = (id: string, isDirty: boolean) => {
    setDirtyStates((prev) => {
      if (prev[id] === isDirty) return prev;
      return { ...prev, [id]: isDirty };
    });
  };

  const hasUnsavedChanges = Object.values(dirtyStates).some(Boolean);

  const [alertToast, setAlertToast] = useState<string | null>(null);
  const [alertToastType, setAlertToastType] = useState<
    "success" | "warning" | "info" | "error"
  >("success");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<"sales" | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("theme") === "dark";
  });

  // --- Alert Trigger Helper ---
  const triggerAlert = useCallback((
    msg: string,
    type?: "success" | "warning" | "info" | "error",
  ) => {
    let alertType = type || "success";
    if (!type) {
      const lower = msg.toLowerCase();
      if (
        lower.includes("จำกัด") ||
        lower.includes("ไม่มีสิทธิ์") ||
        lower.includes("ระงับ") ||
        lower.includes("ต้อง") ||
        lower.includes("กรุณา")
      ) {
        alertType = "warning";
      } else if (
        lower.includes("ลบ") ||
        lower.includes("ปฏิเสธ") ||
        lower.includes("ยกเลิก")
      ) {
        alertType = "error";
      } else if (
        lower.includes("ส่ง") ||
        lower.includes("คำร้อง") ||
        lower.includes("รออนุมัติ") ||
        lower.includes("แสดงรายการ") ||
        lower.includes("ไม่มีการแจ้งเตือน")
      ) {
        alertType = "info";
      }
    }
    setAlertToastType(alertType);
    setAlertToast(msg);
  }, []);

  // --- Notification Engine for Manager & Employee ---
  const userNotifications = useMemo(() => {
    if (!currentUser) return [];
    return notifications.filter((notif) => {
      if (notif.targetUserId) {
        if (notif.targetUserId !== currentUser.id) {
          if (currentUser.role !== "Admin" && notif.senderId !== currentUser.id) return false;
        }
      } else if (notif.targetRoles && notif.targetRoles.length > 0) {
        if (!notif.targetRoles.includes(currentUser.role)) return false;
      }
      return true;
    });
  }, [notifications, currentUser]);

  const userUnreadCount = useMemo(() => {
    if (!currentUser) return 0;
    return userNotifications.filter((n) => !n.readBy.includes(currentUser.id)).length;
  }, [userNotifications, currentUser]);

  const sendNotification = (
    notifData: Omit<AppNotification, "id" | "timestamp" | "readBy">,
  ) => {
    const newNotif: AppNotification = {
      id: `NOTIF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toLocaleString("th-TH", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
      readBy: [],
      ...notifData,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // If targeted to currentUser or all, and notificationsSetting is active, trigger alert toast
    const isTargetedToCurrent =
      !notifData.targetUserId || notifData.targetUserId === currentUser?.id;
    const isRoleTargeted =
      !notifData.targetRoles ||
      (currentUser && notifData.targetRoles.includes(currentUser.role));

    if (isTargetedToCurrent && isRoleTargeted && notificationsSetting) {
      triggerAlert(
        `📢 ${notifData.title}: ${notifData.message}`,
        notifData.priority === "urgent"
          ? "error"
          : notifData.priority === "important"
            ? "warning"
            : "info",
      );
    }
  };

  const handleMarkNotificationAsRead = (id: string) => {
    if (!currentUser) return;
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id && !n.readBy.includes(currentUser.id)
          ? { ...n, readBy: [...n.readBy, currentUser.id] }
          : n,
      ),
    );
  };

  const handleMarkAllNotificationsAsRead = () => {
    if (!currentUser) return;
    setNotifications((prev) =>
      prev.map((n) =>
        !n.readBy.includes(currentUser.id)
          ? { ...n, readBy: [...n.readBy, currentUser.id] }
          : n,
      ),
    );
    triggerAlert("ทำเครื่องหมายว่าอ่านทั้งหมดแล้ว");
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    deleteNotificationFromSupabase(id);
  };

  const handleClearAllNotifications = () => {
    if (!currentUser) return;
    if (currentUser.role === "Admin") {
      setNotifications([]);
      localStorage.removeItem("appNotifications");
      clearAllNotificationsFromSupabase();
    } else {
      setNotifications((prev) =>
        prev.filter((n) => n.targetUserId !== currentUser.id && !n.readBy.includes(currentUser.id)),
      );
    }
    triggerAlert("ล้างรายการแจ้งเตือนแล้ว");
  };

  // --- Effects ---
  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    } catch (e) {
      console.warn("Failed to save theme setting to localStorage:", e);
    }
  }, [isDarkMode]);

  useEffect(() => {
    let fontValue = '"IBM Plex Sans Thai", "Inter", sans-serif';
    if (fontSetting === "Noto Sans Thai") {
      fontValue = '"Noto Sans Thai", "Inter", sans-serif';
    } else if (fontSetting === "Sarabun") {
      fontValue = '"Sarabun", "Inter", sans-serif';
    }
    document.documentElement.style.setProperty("--font-family-setting", fontValue);
  }, [fontSetting]);

  useEffect(() => {
    document.documentElement.lang = languageSetting || "th";
    try {
      localStorage.setItem("languageSetting", languageSetting || "th");
    } catch (e) {
      console.warn("Failed to save languageSetting to localStorage:", e);
    }
  }, [languageSetting]);

  useEffect(() => {
    if (alertToast) {
      const timer = setTimeout(() => setAlertToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [alertToast]);

  // Global Escape key listener for closing active popovers, menus and dropdowns smoothly
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsProfileOpen(false);
        setIsNotificationOpen(false);
        setActiveDropdown(null);
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // --- Supabase Initial Data Fetching ---
  useEffect(() => {
    let isMounted = true;
    async function loadDataFromSupabase() {
      try {
        const [remoteUsers, remoteProducts, remoteOrders, remoteLogs, remoteDatasets, remoteNotifs, remoteTrash] = await Promise.all([
          fetchUsersFromSupabase(),
          fetchProductsFromSupabase(),
          fetchOrdersFromSupabase(),
          fetchAuditLogsFromSupabase(),
          fetchDatasetsFromSupabase(),
          fetchNotificationsFromSupabase(),
          fetchTrashFromSupabase(),
        ]);

        if (!isMounted) return;

        if (remoteUsers && remoteUsers.length > 0) {
          const merged = remoteUsers.map((ru) => {
            const local = initialUsersList.find((iu) => iu.id === ru.id || iu.username === ru.username);
            return {
              ...local,
              ...ru,
              password: ru.password || local?.password || "admin1234",
              tasks: Array.isArray(ru.tasks) && ru.tasks.length > 0 ? ru.tasks : local?.tasks || [],
            };
          });
          setSystemUsers(merged);
        }
        if (remoteProducts !== null) {
          setProducts(remoteProducts);
        }
        if (remoteLogs !== null && remoteLogs.length > 0) {
          setAuditLogs(remoteLogs);
        }
        if (remoteDatasets !== null && remoteDatasets.length > 0) {
          setUploadedDatasets(remoteDatasets);
        } else {
          const savedDatasets = localStorage.getItem("uploadedDatasets");
          if (savedDatasets) {
            try {
              const parsed = JSON.parse(savedDatasets);
              if (Array.isArray(parsed) && parsed.length > 0) {
                parsed.forEach((d) => syncDatasetToSupabase(d));
              }
            } catch (e) {
              console.warn("Failed to sync initial local datasets to Supabase:", e);
            }
          }
        }
        if (remoteNotifs !== null && remoteNotifs.length > 0) {
          setNotifications(remoteNotifs);
        }
        if (remoteTrash !== null && remoteTrash.length > 0) {
          setTrashItems(remoteTrash);
        }
        if (remoteOrders !== null && remoteOrders.length > 0) {
          setOrders(remoteOrders);
        } else {
          const savedOrders = localStorage.getItem("orders");
          const savedIncome = localStorage.getItem("income_data");
          const allLocalOrders: Order[] = [];
          if (savedOrders) {
            try {
              const p = JSON.parse(savedOrders);
              if (Array.isArray(p)) allLocalOrders.push(...p);
            } catch (err) {
              console.warn("Error parsing savedOrders:", err);
            }
          }
          if (savedIncome) {
            try {
              const p = JSON.parse(savedIncome);
              if (Array.isArray(p)) allLocalOrders.push(...p);
            } catch (err) {
              console.warn("Error parsing savedIncome:", err);
            }
          }
          if (allLocalOrders.length > 0) {
            syncOrdersToSupabase(allLocalOrders);
          }
        }
      } catch (err) {
        console.error("Failed to load initial data from Supabase:", err);
      }
    }
    loadDataFromSupabase();
    return () => {
      isMounted = false;
    };
  }, []);

  // --- Debounced LocalStorage & Supabase Synchronization ---
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("products", JSON.stringify(products));
        if (products.length > 0) {
          syncProductsToSupabase(products);
        }
      } catch (e) {
        console.warn("Failed to save products to localStorage:", e);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [products]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const regularOrders = orders.filter((o) => !o.isIncome);
        const incomeOrders = orders.filter((o) => o.isIncome);
        localStorage.setItem("orders", JSON.stringify(regularOrders));
        localStorage.setItem("income_data", JSON.stringify(incomeOrders));
        localStorage.setItem("mock_supabase_orders", JSON.stringify(orders));
        window.dispatchEvent(new Event("mock_supabase_orders_updated"));

        if (orders.length > 0) {
          syncOrdersToSupabase(orders);
        }
      } catch (e) {
        console.warn("Failed to save orders to localStorage:", e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [orders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("systemUsers", JSON.stringify(systemUsers));
        if (systemUsers.length > 0) {
          systemUsers.forEach((u) => syncUserToSupabase(u));
        }
      } catch (e) {
        console.warn("Failed to save systemUsers to localStorage:", e);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [systemUsers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("auditLogs", JSON.stringify(auditLogs));
        if (auditLogs.length > 0) {
          addAuditLogToSupabase(auditLogs[0]);
        }
      } catch (e) {
        console.warn("Failed to save auditLogs to localStorage:", e);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [auditLogs]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("appNotifications", JSON.stringify(notifications));
        if (notifications.length > 0) {
          notifications.forEach((n) => syncNotificationToSupabase(n));
        }
      } catch (e) {
        console.warn("Failed to save appNotifications to localStorage:", e);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem("adminUnreadCount", adminUnreadCount.toString());
    } catch (e) {
      console.warn("Failed to save adminUnreadCount to localStorage:", e);
    }
  }, [adminUnreadCount]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("uploadedDatasets", JSON.stringify(uploadedDatasets));
        if (uploadedDatasets.length > 0) {
          uploadedDatasets.forEach((d) => syncDatasetToSupabase(d));
        }
      } catch (e) {
        console.warn("Failed to save uploadedDatasets to localStorage:", e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [uploadedDatasets]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("productFiles", JSON.stringify(productFiles));
      } catch (e) {
        console.warn("Failed to save productFiles to localStorage:", e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [productFiles]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("trash_bin_items", JSON.stringify(trashItems));
        if (trashItems.length > 0) {
          trashItems.forEach((t) => syncTrashItemToSupabase(t));
        }
      } catch (e) {
        console.warn("Failed to save trash_bin_items to localStorage:", e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [trashItems]);

  useEffect(() => {
    try {
      localStorage.removeItem("currentUser");
      if (currentUser) {
        sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
      } else {
        sessionStorage.removeItem("currentUser");
      }
    } catch (e) {
      console.warn("Failed to save currentUser to sessionStorage:", e);
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem("activeTab", activeTab);
    } catch (e) {
      console.warn("Failed to save activeTab to localStorage:", e);
    }
  }, [activeTab]);

  // --- Cross-Device Data Syncing & Polling ---
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  // Cleanup orphan orders that don't belong to any uploaded dataset, ensure all uploaded datasets have orders, & reevaluate order status and totals
  useEffect(() => {
    if (!isInitialLoadComplete) return;

    setOrders((prevOrders) => {
      const datasetIds = new Set(uploadedDatasets.map((d) => d.id));
      const orderDatasetIds = new Set(prevOrders.map((o) => o.datasetId).filter(Boolean));

      let hasOrphanOrInflated = false;
      for (let i = 0; i < prevOrders.length; i++) {
        const o = prevOrders[i];
        if (o.datasetId && !datasetIds.has(o.datasetId)) {
          hasOrphanOrInflated = true;
          break;
        }
        const unit = (o.total || 0) / (o.quantity || 1);
        if (unit > 50000) {
          hasOrphanOrInflated = true;
          break;
        }
      }

      let hasMissingDatasetOrders = false;
      if (uploadedDatasets.length > 0) {
        for (let i = 0; i < uploadedDatasets.length; i++) {
          const d = uploadedDatasets[i];
          if (!orderDatasetIds.has(d.id)) {
            hasMissingDatasetOrders = true;
            break;
          }
        }
      }

      if (!hasOrphanOrInflated && !hasMissingDatasetOrders) {
        return prevOrders;
      }

      const manualOrders = prevOrders.filter(
        (o) => !o.datasetId && ((o.total || 0) / (o.quantity || 1) <= 50000)
      );

      let freshDatasetOrders: Order[] = [];
      if (uploadedDatasets.length > 0) {
        freshDatasetOrders = uploadedDatasets.flatMap((ds) => {
          try {
            return convertDatasetToOrders(ds);
          } catch {
            return [];
          }
        });
      }

      const combined = [...freshDatasetOrders, ...manualOrders];
      const reevaluated = reevaluateOrdersStatus(combined, uploadedDatasets);

      if (
        reevaluated.length === prevOrders.length &&
        reevaluated.every((o, idx) => o.id === prevOrders[idx]?.id && o.status === prevOrders[idx]?.status && o.total === prevOrders[idx]?.total)
      ) {
        return prevOrders;
      }

      return reevaluated;
    });
  }, [uploadedDatasets, isInitialLoadComplete]);
  
  // Keep ref of local state for sync & polling to avoid stale closures
  const localStateRef = useRef({
    products,
    orders,
    systemUsers,
    auditLogs,
    uploadedDatasets,
    productFiles,
    trashItems,
    notifications,
    adminUnreadCount
  });

  useEffect(() => {
    localStateRef.current = {
      products,
      orders,
      systemUsers,
      auditLogs,
      uploadedDatasets,
      productFiles,
      trashItems,
      notifications,
      adminUnreadCount
    };
  }, [products, orders, systemUsers, auditLogs, uploadedDatasets, productFiles, trashItems, notifications, adminUnreadCount]);

  // Fast SSE connection tracking & adaptive polling
  const isSSEConnectedRef = useRef<boolean>(false);
  const lastPostTimeRef = useRef<number>(0);
  const isSyncingFromRemoteRef = useRef<boolean>(false);

  // Fast equality check for collection updates to avoid expensive full JSON serialization on every tick
  const hasCollectionChanged = <T extends { id?: string | number }>(incoming: T[] | undefined, current: T[]): boolean => {
    if (!Array.isArray(incoming)) return false;
    if (incoming.length !== current.length) return true;
    if (incoming.length === 0) return false;
    // Check first, middle, and last item ID / object reference
    if (incoming[0]?.id !== current[0]?.id) return true;
    const mid = Math.floor(incoming.length / 2);
    if (incoming[mid]?.id !== current[mid]?.id) return true;
    const last = incoming.length - 1;
    if (incoming[last]?.id !== current[last]?.id) return true;
    return false;
  };

  // Helper function to apply incoming remote sync data from SSE, Polling, or BroadcastChannel
  const applyRemoteSyncData = useCallback((data: RemoteSyncPayload | Record<string, unknown> | null | undefined, isFromSSE: boolean = false) => {
    if (!data || typeof data !== "object") return;

    const currentLocal = localStateRef.current;
    const prevUploadedCount = currentLocal.uploadedDatasets.length;
    const prevProductFilesCount = currentLocal.productFiles.length;
    const prevTrashCount = currentLocal.trashItems.length;

    let hasChanges = false;

    // Normalizing Users
    let mergedUsers: AppUser[] | undefined = undefined;
    if (Array.isArray(data.systemUsers)) {
      mergedUsers = (data.systemUsers as AppUser[]).map((u: AppUser) => {
        const match = initialUsersList.find((iu) => iu.id === u.id);
        return {
          ...match,
          ...u,
          tasks: u.tasks || match?.tasks || []
        };
      });
    }

    const normalizedData: RemoteSyncPayload = {
      ...(data as RemoteSyncPayload),
      ...(mergedUsers !== undefined ? { systemUsers: mergedUsers } : {})
    };

    isSyncingFromRemoteRef.current = true;

    if (Array.isArray(normalizedData.products) && hasCollectionChanged(normalizedData.products, currentLocal.products)) {
      setProducts(normalizedData.products);
      hasChanges = true;
    }
    if (Array.isArray(normalizedData.orders) && hasCollectionChanged(normalizedData.orders, currentLocal.orders)) {
      setOrders(normalizedData.orders);
      hasChanges = true;
    }
    if (Array.isArray(normalizedData.systemUsers) && hasCollectionChanged(normalizedData.systemUsers, currentLocal.systemUsers)) {
      setSystemUsers(normalizedData.systemUsers);
      hasChanges = true;
    }
    if (Array.isArray(normalizedData.auditLogs) && hasCollectionChanged(normalizedData.auditLogs, currentLocal.auditLogs)) {
      setAuditLogs(normalizedData.auditLogs);
      hasChanges = true;
    }
    if (Array.isArray(normalizedData.uploadedDatasets) && hasCollectionChanged(normalizedData.uploadedDatasets, currentLocal.uploadedDatasets)) {
      setUploadedDatasets(normalizedData.uploadedDatasets);
      hasChanges = true;
    }
    if (Array.isArray(normalizedData.productFiles) && hasCollectionChanged(normalizedData.productFiles, currentLocal.productFiles)) {
      setProductFiles(normalizedData.productFiles);
      hasChanges = true;
    }
    if (Array.isArray(normalizedData.trashItems) && hasCollectionChanged(normalizedData.trashItems, currentLocal.trashItems)) {
      setTrashItems(normalizedData.trashItems);
      hasChanges = true;
    }
    if (Array.isArray(normalizedData.notifications) && hasCollectionChanged(normalizedData.notifications, currentLocal.notifications)) {
      setNotifications(normalizedData.notifications);
      hasChanges = true;
    }
    if (typeof normalizedData.adminUnreadCount === "number" && normalizedData.adminUnreadCount !== currentLocal.adminUnreadCount) {
      setAdminUnreadCount(normalizedData.adminUnreadCount);
      hasChanges = true;
    }

    // Trigger visual toast when action happened on another device
    if (hasChanges && isFromSSE) {
      const newUploadedCount = Array.isArray(normalizedData.uploadedDatasets) ? normalizedData.uploadedDatasets.length : prevUploadedCount;
      const newProductFilesCount = Array.isArray(normalizedData.productFiles) ? normalizedData.productFiles.length : prevProductFilesCount;
      const newTrashCount = Array.isArray(normalizedData.trashItems) ? normalizedData.trashItems.length : prevTrashCount;

      if (newUploadedCount > prevUploadedCount || newProductFilesCount > prevProductFilesCount) {
        triggerAlert("📥 มีการนำเข้าไฟล์ข้อมูลใหม่จากอุปกรณ์อื่น", "info");
      } else if (newTrashCount > prevTrashCount || newUploadedCount < prevUploadedCount || newProductFilesCount < prevProductFilesCount) {
        triggerAlert("🗑️ มีการอัปเดตข้อมูล / ลบไฟล์จากอุปกรณ์อื่น (ดูได้ที่ถังขยะ)", "info");
      }
    }

    setTimeout(() => {
      isSyncingFromRemoteRef.current = false;
    }, 200);
  }, [triggerAlert]);

  // BroadcastChannel for instant same-browser multi-tab sync
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        const channel = new BroadcastChannel("aerosales_realtime_sync");
        broadcastChannelRef.current = channel;
        channel.onmessage = (event) => {
          if (event.data && event.data.type === "sync" && event.data.data) {
            applyRemoteSyncData(event.data.data, false);
          }
        };
      } catch (err) {
        console.warn("BroadcastChannel not supported or error:", err);
      }
    }
    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [applyRemoteSyncData]);

  // 1. Initial fetch & database bootstrapping
  useEffect(() => {
    let isMounted = true;
    
    const fetchInitialData = async () => {
      try {
        const res = await fetch("/api/data");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        
        if (isMounted) {
          if (data && (Array.isArray(data.orders) || Array.isArray(data.products) || Array.isArray(data.systemUsers) || Array.isArray(data.uploadedDatasets))) {
            // Server has data! Update states from server.
            applyRemoteSyncData(data, false);
          } else {
            // Server is empty! Bootstrap server using local cache
            const localProducts = localStorage.getItem("products");
            const localOrders = localStorage.getItem("orders");
            const localUsers = localStorage.getItem("systemUsers");
            const localLogs = localStorage.getItem("auditLogs");
            const localDatasets = localStorage.getItem("uploadedDatasets");
            const localProductFiles = localStorage.getItem("productFiles");
            const localTrash = localStorage.getItem("trash_bin_items");
            const localNotifs = localStorage.getItem("appNotifications");
            const localUnread = localStorage.getItem("adminUnreadCount");
            
            let parsedUsers = initialUsersList;
            if (localUsers) {
              try {
                const parsed = JSON.parse(localUsers);
                if (Array.isArray(parsed)) {
                  parsedUsers = parsed.map((u: AppUser) => {
                    const match = initialUsersList.find((iu) => iu.id === u.id);
                    return {
                      ...match,
                      ...u,
                      tasks: u.tasks || match?.tasks || []
                    };
                  });
                }
              } catch {
                // ignore parsing error
              }
            }

            const parsedProducts = safeJsonParse<Product[]>(localProducts, []);
            const parsedOrders = safeJsonParse<Order[]>(localOrders, []);
            const parsedLogs = safeJsonParse<AuditLog[]>(localLogs, []);
            const parsedDatasets = safeJsonParse<UploadedDataset[]>(localDatasets, []);
            const parsedProductFiles = safeJsonParse<UploadedDataset[]>(localProductFiles, []);
            const parsedTrash = safeJsonParse<TrashItem[]>(localTrash, []);
            const parsedNotifs = safeJsonParse<AppNotification[]>(localNotifs, initialNotifications);

            const bootstrapPayload = {
              products: parsedProducts,
              orders: parsedOrders,
              systemUsers: parsedUsers,
              auditLogs: parsedLogs,
              uploadedDatasets: parsedDatasets,
              productFiles: parsedProductFiles,
              trashItems: parsedTrash,
              notifications: parsedNotifs,
              adminUnreadCount: localUnread ? parseInt(localUnread, 10) : 0
            };
            
            // Save to server
            await fetch("/api/data", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(bootstrapPayload)
            });
            
            setProducts(bootstrapPayload.products);
            setOrders(bootstrapPayload.orders);
            setSystemUsers(bootstrapPayload.systemUsers);
            setAuditLogs(bootstrapPayload.auditLogs);
            setUploadedDatasets(bootstrapPayload.uploadedDatasets);
            setProductFiles(bootstrapPayload.productFiles);
            setTrashItems(bootstrapPayload.trashItems);
            setNotifications(bootstrapPayload.notifications);
            setAdminUnreadCount(bootstrapPayload.adminUnreadCount);
          }
        }
      } catch (err) {
        console.error("Failed to sync initial data:", err);
      } finally {
        if (isMounted) {
          setIsInitialLoadComplete(true);
        }
      }
    };
    
    fetchInitialData();
    
    return () => {
      isMounted = false;
    };
  }, [applyRemoteSyncData]);

  // 2. Real-Time Server-Sent Events (SSE) Listener with Auto Reconnect
  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connectSSE = () => {
      try {
        eventSource = new EventSource("/api/events");

        eventSource.onopen = () => {
          isSSEConnectedRef.current = true;
        };

        eventSource.onmessage = (event) => {
          try {
            if (!event.data) return;
            const parsed = JSON.parse(event.data);
            if (parsed.type === "sync" && parsed.data) {
              applyRemoteSyncData(parsed.data, true);
            }
          } catch (e) {
            console.warn("Error processing SSE message:", e);
          }
        };

        eventSource.onerror = () => {
          isSSEConnectedRef.current = false;
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectSSE, 4000);
        };
      } catch (err) {
        isSSEConnectedRef.current = false;
        console.warn("SSE connection error:", err);
      }
    };

    connectSSE();

    // Fast sync when mobile / browser tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetch("/api/data")
          .then((res) => res.json())
          .then((data) => applyRemoteSyncData(data, false))
          .catch(() => {
            // ignore visibility fetch error
          });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    window.addEventListener("online", handleVisibilityChange);

    return () => {
      isSSEConnectedRef.current = false;
      if (eventSource) {
        eventSource.close();
      }
      clearTimeout(reconnectTimeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
      window.removeEventListener("online", handleVisibilityChange);
    };
  }, [applyRemoteSyncData]);

  // 3. Smart Fallback Polling (Only runs if SSE is disconnected, every 15s)
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    let isMounted = true;
    
    const pollData = async () => {
      // If SSE is active, skip polling completely to save CPU and Network
      if (!isSSEConnectedRef.current) {
        const startTime = Date.now();
        try {
          const res = await fetch("/api/data");
          if (res.ok) {
            const data = await res.json();
            if (isMounted && startTime >= lastPostTimeRef.current) {
              applyRemoteSyncData(data, false);
            }
          }
        } catch {
          // Polling silent catch
        }
      }

      if (isMounted) {
        timerId = setTimeout(pollData, isSSEConnectedRef.current ? 30000 : 15000);
      }
    };
    
    timerId = setTimeout(pollData, 15000);
    
    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, [applyRemoteSyncData]);

  // 4. Save modifications to server (Debounced & Broadcasted)
  useEffect(() => {
    if (!isInitialLoadComplete || isSyncingFromRemoteRef.current) return;

    const timer = setTimeout(() => {
      const payload = {
        products,
        orders,
        systemUsers,
        auditLogs,
        uploadedDatasets,
        productFiles,
        trashItems,
        notifications,
        adminUnreadCount
      };
      
      const saveToServer = async () => {
        const postTime = Date.now();
        lastPostTimeRef.current = postTime;
        try {
          const payloadStr = JSON.stringify(payload);
          const res = await fetch("/api/data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payloadStr
          });
          if (!res.ok) throw new Error("Failed to save");

          // Broadcast to other tabs in same browser immediately
          if (broadcastChannelRef.current) {
            try {
              broadcastChannelRef.current.postMessage({ type: "sync", data: payload });
            } catch {
              // BroadcastChannel postMessage error ignore
            }
          }
        } catch (err) {
          console.error("Failed to save data to server:", err);
        }
      };
      
      saveToServer();
    }, 600);

    return () => clearTimeout(timer);
  }, [
    products,
    orders,
    systemUsers,
    auditLogs,
    uploadedDatasets,
    productFiles,
    trashItems,
    notifications,
    adminUnreadCount,
    isInitialLoadComplete
  ]);

  useEffect(() => {
    if (currentUser?.role === "Admin" && isAuditLogsModalOpen) {
      setAdminUnreadCount(0);
    }
  }, [isAuditLogsModalOpen, currentUser]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setDirtyStates((prev) => ({
      ...prev,
      settings: false,
      userTasks: false,
    }));
    if (activeTab !== "sales") {
      setChannelFilter("All");
    }
  }, [activeTab]);

  useEffect(() => {
    if (currentUser) {
      const updatedUser = systemUsers.find((u) => u.id === currentUser.id);
      if (updatedUser) {
        if (updatedUser.status === "Inactive") {
          setCurrentUser(null);
          triggerAlert("บัญชีของคุณถูกระงับการใช้งาน", "warning");
        } else {
          const tasksChanged = JSON.stringify(updatedUser.tasks) !== JSON.stringify(currentUser.tasks);
          const roleChanged = updatedUser.role !== currentUser.role;
          const nameChanged = updatedUser.name !== currentUser.name;
          const passwordChanged = updatedUser.password !== currentUser.password;
          
          if (tasksChanged || roleChanged || nameChanged || passwordChanged) {
            setCurrentUser(updatedUser);
            
            // Check if activeTab is still permitted
            const hasDashboard = updatedUser.role === "Admin" || updatedUser.tasks?.includes("ดูแดชบอร์ด");
            const hasSales = updatedUser.role === "Admin" || updatedUser.tasks?.includes("ดูรายงานยอดขาย");
            const hasCalc = updatedUser.role === "Admin" || updatedUser.tasks?.includes("เครื่องคำนวณส่วนต่าง");
            const hasImport = updatedUser.role === "Admin" || updatedUser.role === "Manager" || updatedUser.tasks?.includes("นำเข้าข้อมูล Excel");
            const hasUsers = updatedUser.role === "Admin" || (updatedUser.role === "Manager" && updatedUser.tasks?.includes("จัดการผู้ใช้งาน"));
            
            let isCurrentTabPermitted = false;
            if (activeTab === "dashboard" && hasDashboard) isCurrentTabPermitted = true;
            else if (activeTab === "sales" && hasSales) isCurrentTabPermitted = true;
            else if (activeTab === "calculator" && hasCalc) isCurrentTabPermitted = true;
            else if (activeTab === "import-orders" && hasImport) isCurrentTabPermitted = true;
            else if (activeTab === "users" && hasUsers) isCurrentTabPermitted = true;
            
            if (!isCurrentTabPermitted) {
              let fallbackTab: typeof activeTab;
              if (hasDashboard) fallbackTab = "dashboard";
              else if (hasSales) fallbackTab = "sales";
              else if (hasCalc) fallbackTab = "calculator";
              else if (hasImport) fallbackTab = "import-orders";
              else if (hasUsers) fallbackTab = "users";
              else fallbackTab = "dashboard";
              
              setActiveTab(fallbackTab);
            }
          }
        }
      }
    }
  }, [systemUsers, currentUser, activeTab, triggerAlert]);



  // --- Currency Formatter ---
  const formatCurrency = useCallback((val: number) => {
    if (currencySetting === "USD") {
      return formatterUSD.format(val);
    }
    if (currencySetting === "JPY") {
      return formatterJPY.format(val);
    }
    return formatterTHB.format(val);
  }, [currencySetting]);

  // --- Confirmation Request Helper ---
  const requestConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText?: string,
    cancelText?: string,
    icon?: "trash" | "warning" | "info" | "danger",
  ) => {
    setConfirmModalConfig({ title, message, onConfirm, confirmText, cancelText, icon });
    setIsConfirmModalOpen(true);
  }, []);

  const handleDashboardChannelClick = useCallback((channel: string) => {
    setChannelFilter(channel);
    setSalesSubTab("income");
    setActiveTab("sales");
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  }, []);

  const handleOpenImportModal = useCallback((mode: "orders" | "income" | "all") => {
    setImportModalMode(mode);
    setIsImportModalOpen(true);
  }, []);

  const handleOpenAddProductImport = useCallback(() => {
    setAddProductInitialTab("import");
    setIsAddProductOpen(true);
  }, []);

  const handleSettingsDirtyChange = useCallback((isDirty: boolean) => {
    updateDirtyState("settings", isDirty);
  }, []);

  const handleUserTasksDirtyChange = useCallback((isDirty: boolean) => {
    updateDirtyState("userTasks", isDirty);
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleLoginSubmit called with:", { loginIdentifier, loginPassword, systemUsersCount: systemUsers.length });
    if (!loginIdentifier || !loginPassword) {
      console.log("Empty identifier or password");
      return;
    }

    // Check brute-force lockout status
    const lockout = getLoginLockoutStatus();
    if (lockout.isLocked) {
      setLoginError(`ระบบถูกระงับชั่วคราวเนื่องจากพิมพ์รหัสผ่านผิดเกินกำหนด กรุณารอ ${lockout.remainingSeconds} วินาที`);
      return;
    }

    const user = systemUsers.find(
      (u) =>
        (u.email.toLowerCase() === loginIdentifier.toLowerCase() ||
          u.username.toLowerCase() === loginIdentifier.toLowerCase()) &&
        u.status === "Active",
    );
    console.log("Found user:", user?.username, "Matches password:", user?.password === loginPassword);

    if (user && user.password === loginPassword) {
      // Successful login -> Reset failed attempts counter
      resetFailedLogins();

      setCurrentUser(user);
      setLoginIdentifier("");
      setLoginPassword("");
      setLoginError(null);
      
      let initialTab: typeof activeTab = "dashboard";
      if (user.role !== "Admin") {
        const hasDashboard = user.tasks?.includes("ดูแดชบอร์ด");
        const hasSales = user.tasks?.includes("ดูรายงานยอดขาย");
        const hasCalc = user.tasks?.includes("เครื่องคำนวณส่วนต่าง");
        const hasImport = user.role === "Manager" || user.tasks?.includes("นำเข้าข้อมูล Excel");
        const hasUsers = user.role === "Manager" && user.tasks?.includes("จัดการผู้ใช้งาน");

        if (hasDashboard) initialTab = "dashboard";
        else if (hasSales) initialTab = "sales";
        else if (hasCalc) initialTab = "calculator";
        else if (hasImport) initialTab = "import-orders";
        else if (hasUsers) initialTab = "users";
        else initialTab = "dashboard";
      }
      setActiveTab(initialTab);
    } else {
      // Record failed attempt for rate limiting & brute-force mitigation
      const updatedLockout = recordFailedLogin();

      const inactiveUser = systemUsers.find(
        (u) =>
          u.email.toLowerCase() === loginIdentifier.toLowerCase() ||
          u.username.toLowerCase() === loginIdentifier.toLowerCase(),
      );

      if (updatedLockout.isLocked) {
        setLoginError(`พิมพ์รหัสผ่านผิดเกิน ${updatedLockout.failedAttempts} ครั้ง ระบบระงับชั่วคราว ${updatedLockout.remainingSeconds} วินาทีเพื่อความปลอดภัย`);
      } else {
        const remainingAttempts = 5 - updatedLockout.failedAttempts;
        setLoginError(
          inactiveUser && inactiveUser.status === "Inactive"
            ? "บัญชีผู้ใช้นี้ถูกระงับการใช้งานชั่วคราว"
            : `อีเมล/ชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง (เหลือโอกาสอีก ${remainingAttempts} ครั้ง)`
        );
      }
    }
  };

  const handleResetPassword = (userId: string, newPass: string) => {
    const target = systemUsers.find((u) => u.id === userId);
    if (!target) return;

    setSystemUsers((prevUsers) =>
      prevUsers.map((u) => (u.id === userId ? { ...u, password: newPass } : u))
    );

    const log: AuditLog = {
      id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
      action: "Edit",
      targetType: "user",
      targetId: userId,
      timestamp: new Date().toLocaleString("th-TH"),
      performedBy: target.name,
      details: `รีเซ็ตรหัสผ่านสำหรับบัญชีผู้ใช้: ${target.name} (${target.role})`,
      previousData: JSON.stringify(target),
      newData: JSON.stringify({ ...target, password: newPass }),
    };

    setAuditLogs((prevLogs) => [log, ...prevLogs]);
    if (currentUser && currentUser.role !== "Admin") {
      setAdminUnreadCount((c) => c + 1);
    }

    sendNotification({
      title: `รีเซ็ตรหัสผ่าน: ${target.name}`,
      message: `${currentUser?.name || target.name} (${currentUser?.role || target.role}) ได้ทำการรีเซ็ตรหัสผ่านสำหรับบัญชี ${target.name} (${target.role})`,
      type: "activity",
      actionType: "edit",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
      senderRole: currentUser?.role,
      actionTab: "users",
      priority: "important",
    });
  };

  // --- Product CRUD ---
  const handleCreateProducts = (
    newProds: {
      name: string;
      category: Product["category"];
      brand: string;
      price: number;
      stock: number;
    }[],
  ) => {
    const created: Product[] = newProds.map((p) => {
      const status =
        p.stock === 0
          ? "Out of Stock"
          : p.stock <= 10
            ? "Low Stock"
            : "In Stock";
      return {
        id: `PROD-${Math.floor(1000 + Math.random() * 9000)}`,
        name: p.name,
        category: p.category,
        brand: p.brand || "ทั่วไป",
        price: p.price,
        sales: 0,
        revenue: 0,
        stock: p.stock,
        status,
      };
    });
    const updated = [...created, ...products];
    setProducts(updated);
    syncProductsToSupabase(updated);
    setIsAddProductOpen(false);
    triggerAlert(
      `เพิ่มรายการสินค้าใหม่ ${newProds.length} รายการเข้าคลังเรียบร้อย`,
    );

    const prodNames = newProds.map((p) => `"${p.name}" (ราคา: ${p.price.toLocaleString()} ฿, คลัง: ${p.stock.toLocaleString()} ชิ้น)`).slice(0, 5).join(", ");
    const remainingCount = newProds.length > 5 ? ` และอีก ${newProds.length - 5} รายการ` : "";

    sendNotification({
      title: `เพิ่มสินค้าใหม่เข้าคลัง (${newProds.length} รายการ)`,
      message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้เพิ่มสินค้าเข้าคลัง: ${prodNames}${remainingCount}`,
      type: "inventory",
      actionType: "create",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
      senderRole: currentUser?.role,
      actionTab: "sales",
      priority: "normal",
    });
  };

  const handleImportProductFiles = useCallback((newFiles: UploadedDataset[]) => {
    try {
      setProductFiles((prev) => {
        const existingIds = new Set(prev.map((d) => d.id));
        const filtered = newFiles.filter((d) => !existingIds.has(d.id));
        return [...prev, ...filtered];
      });

      // Extract products from dataset sheets if available and auto-sync to Supabase Orders table
      const extractedProducts: Product[] = [];
      newFiles.forEach((file) => {
        if (file.sheets) {
          file.sheets.forEach((sheet) => {
            if (sheet.rows && Array.isArray(sheet.rows)) {
              sheet.rows.forEach((row: Record<string, unknown>) => {
                const name = String(row["ชื่อสินค้า"] || row["ชื่อ"] || row["Product Name"] || row["name"] || "").trim();
                if (name) {
                  const price = Number(row["ราคา"] || row["Price"] || row["price"] || 0);
                  const stock = Number(row["สต็อก"] || row["จำนวนสต็อก"] || row["Stock"] || row["stock"] || 0);
                  const brand = String(row["แบรนด์"] || row["Brand"] || row["brand"] || "ทั่วไป").trim();
                  const category = (row["หมวดหมู่"] || row["Category"] || row["category"] || "General") as Product["category"];
                  
                  extractedProducts.push({
                    id: `PROD-${Math.floor(1000 + Math.random() * 9000)}`,
                    name,
                    category: category || "General",
                    brand: brand || "ทั่วไป",
                    price: isNaN(price) ? 0 : price,
                    sales: 0,
                    revenue: 0,
                    stock: isNaN(stock) ? 0 : stock,
                    status: stock === 0 ? "Out of Stock" : stock <= 10 ? "Low Stock" : "In Stock",
                  });
                }
              });
            }
          });
        }
      });

      if (extractedProducts.length > 0) {
        setProducts((prev) => {
          const map = new Map<string, Product>();
          prev.forEach((p) => map.set(p.name.toLowerCase().trim(), p));
          extractedProducts.forEach((p) => {
            const key = p.name.toLowerCase().trim();
            if (!map.has(key)) {
              map.set(key, p);
            }
          });
          const merged = Array.from(map.values());
          syncProductsToSupabase(merged);
          return merged;
        });
      }
    } catch (e) {
      console.error("Failed to import product files:", e);
      triggerAlert("เกิดข้อผิดพลาดในการนำเข้าไฟล์สินค้า", "error");
    }
  }, [triggerAlert]);

  const handleEditProductSubmit = (updatedProd: Product) => {
    const prev = products.find((p) => p.id === updatedProd.id);
    if (!prev) return;
    const updated = products.map((p) => (p.id === updatedProd.id ? updatedProd : p));
    setProducts(updated);
    syncProductsToSupabase(updated);
    setIsEditProductOpen(false);
    setEditingProduct(null);

    const changesList: string[] = [];
    if (prev.name !== updatedProd.name) changesList.push(`ชื่อ: "${prev.name}" ➔ "${updatedProd.name}"`);
    if (prev.category !== updatedProd.category) changesList.push(`หมวดหมู่: "${prev.category}" ➔ "${updatedProd.category}"`);
    if (prev.brand !== updatedProd.brand) changesList.push(`แบรนด์: "${prev.brand}" ➔ "${updatedProd.brand}"`);
    if (prev.price !== updatedProd.price) changesList.push(`ราคา: ${prev.price.toLocaleString()} ฿ ➔ ${updatedProd.price.toLocaleString()} ฿`);
    if (prev.stock !== updatedProd.stock) changesList.push(`สต็อก: ${prev.stock.toLocaleString()} ➔ ${updatedProd.stock.toLocaleString()} ชิ้น`);
    const changesStr = changesList.length > 0 ? changesList.join(" | ") : "ไม่มีการเปลี่ยนแปลงค่า";

    const log: AuditLog = {
      id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
      action: "Edit",
      targetType: "product",
      targetId: updatedProd.id,
      timestamp: new Date().toLocaleString("th-TH"),
      performedBy: currentUser?.name || "System",
      details: `แก้ไขข้อมูลสินค้า ${updatedProd.name} (แก้ไข: ${changesStr})`,
      previousData: JSON.stringify(prev),
      newData: JSON.stringify(updatedProd),
    };

    setAuditLogs((prevLogs) => [log, ...prevLogs]);
    if (currentUser?.role !== "Admin") {
      setAdminUnreadCount((c) => c + 1);
    }

    sendNotification({
      title: `แก้ไขข้อมูลสินค้า: ${updatedProd.name}`,
      message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้แก้ไขข้อมูลสินค้า "${updatedProd.name}" (รหัส: ${updatedProd.id}) รายละเอียด: [${changesStr}]`,
      type: "inventory",
      actionType: "edit",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
      senderRole: currentUser?.role,
      actionTab: "sales",
      priority: "normal",
    });

    triggerAlert(`แก้ไขข้อมูลสินค้าสำเร็จ (แก้ไข: ${changesStr})`);
  };

  const addToTrash = (
    title: string,
    itemType: TrashItem["itemType"],
    data: unknown,
    itemCount: number = 1,
    details?: string,
  ) => {
    const newItem: TrashItem = {
      id: `TRASH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title,
      itemType,
      itemCount,
      data,
      deletedAt: new Date().toLocaleString("th-TH"),
      deletedBy: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"})`,
      deletedByRole: currentUser?.role || "System",
      details,
    };
    setTrashItems((prev) => [newItem, ...prev.slice(0, 49)]);
  };

  const handleRestoreTrashItem = (item: TrashItem) => {
    if (currentUser?.role !== "Admin" && currentUser?.role !== "Manager") {
      triggerAlert("ปฏิเสธการเข้าถึง: เฉพาะ แอดมิน และ ผู้จัดการ เท่านั้นที่มีสิทธิ์กู้คืนข้อมูล");
      return;
    }

    try {
      if (item.itemType === "product") {
        const prod = item.data as Product;
        setProducts((prev) => {
          if (prev.some((p) => p.id === prod.id || p.name.toLowerCase() === prod.name.toLowerCase())) {
            return prev.map((p) => (p.id === prod.id ? prod : p));
          }
          return [prod, ...prev];
        });
      } else if (item.itemType === "bulk_products") {
        const payload = item.data as { products: Product[]; productFiles?: UploadedDataset[] };
        if (payload.products && payload.products.length > 0) {
          setProducts((prev) => {
            const map = new Map<string, Product>();
            prev.forEach((p) => map.set(p.name.toLowerCase(), p));
            payload.products.forEach((p) => map.set(p.name.toLowerCase(), p));
            return Array.from(map.values());
          });
        }
        if (payload.productFiles && payload.productFiles.length > 0) {
          setProductFiles((prev) => {
            const existingIds = new Set(prev.map((d) => d.id));
            const newFiles = payload.productFiles!.filter((d) => !existingIds.has(d.id));
            return [...newFiles, ...prev];
          });
        }
      } else if (item.itemType === "order" || item.itemType === "income") {
        const ord = item.data as Order;
        setOrders((prev) => {
          if (prev.some((o) => o.id === ord.id)) return prev;
          return [ord, ...prev];
        });
        if (!ord.isIncome) {
          setProducts((prevProducts) => {
            return prevProducts.map((p) => {
              if (p.name.toLowerCase().trim() === (ord.productName || "").toLowerCase().trim()) {
                const qty = ord.quantity || 1;
                const isRefunded = ord.status === "Refunded";
                const newStock = Math.max(0, p.stock - qty);
                return {
                  ...p,
                  sales: isRefunded ? p.sales : p.sales + qty,
                  revenue: isRefunded ? p.revenue : p.revenue + (ord.total || 0),
                  stock: newStock,
                  status: newStock === 0 ? "Out of Stock" : newStock <= 10 ? "Low Stock" : "In Stock",
                };
              }
              return p;
            });
          });
        }
      } else if (item.itemType === "bulk_orders") {
        if (Array.isArray(item.data)) {
          const ords = item.data as Order[];
          setOrders((prev) => {
            const existingIds = new Set(prev.map((o) => o.id));
            const toAdd = ords.filter((o) => !existingIds.has(o.id));
            return [...toAdd, ...prev];
          });
        } else if (item.data && typeof item.data === "object") {
          const payload = item.data as { orders?: Order[]; datasets?: UploadedDataset[] };
          let ords = payload.orders || [];
          const dsets = payload.datasets || [];
          if (dsets.length > 0) {
            setUploadedDatasets((prev) => {
              const existingIds = new Set(prev.map((d) => d.id));
              const newDatasets = dsets.filter((d) => !existingIds.has(d.id));
              return [...newDatasets, ...prev];
            });
          }
          if (ords.length === 0 && dsets.length > 0) {
            ords = dsets.flatMap((ds) => {
              try { return convertDatasetToOrders(ds); } catch { return []; }
            });
          }
          if (ords.length > 0) {
            setOrders((prev) => {
              const existingIds = new Set(prev.map((o) => o.id));
              const toAdd = ords.filter((o) => !existingIds.has(o.id));
              return [...toAdd, ...prev];
            });
            setProducts((prevProducts) => {
              let updated = [...prevProducts];
              ords.forEach((o) => {
                if (o.isIncome) return;
                const pName = (o.productName || "").toLowerCase().trim();
                if (!pName) return;
                const qty = o.quantity || 1;
                const isRefunded = o.status === "Refunded";
                updated = updated.map((p) => {
                  if (p.name.toLowerCase().trim() === pName) {
                    const newStock = Math.max(0, p.stock - qty);
                    return {
                      ...p,
                      sales: isRefunded ? p.sales : p.sales + qty,
                      revenue: isRefunded ? p.revenue : p.revenue + (o.total || 0),
                      stock: newStock,
                      status: newStock === 0 ? "Out of Stock" : newStock <= 10 ? "Low Stock" : "In Stock",
                    };
                  }
                  return p;
                });
              });
              return updated;
            });
          }
        }
      } else if (item.itemType === "bulk_income") {
        if (Array.isArray(item.data)) {
          const incs = item.data as Order[];
          setOrders((prev) => {
            const existingIds = new Set(prev.map((o) => o.id));
            const toAdd = incs.filter((o) => !existingIds.has(o.id));
            return [...toAdd, ...prev];
          });
        } else if (item.data && typeof item.data === "object") {
          const payload = item.data as { orders?: Order[]; datasets?: UploadedDataset[] };
          let incs = payload.orders || [];
          const dsets = payload.datasets || [];
          if (dsets.length > 0) {
            setUploadedDatasets((prev) => {
              const existingIds = new Set(prev.map((d) => d.id));
              const newDatasets = dsets.filter((d) => !existingIds.has(d.id));
              return [...newDatasets, ...prev];
            });
          }
          if (incs.length === 0 && dsets.length > 0) {
            incs = dsets.flatMap((ds) => {
              try { return convertDatasetToOrders(ds); } catch { return []; }
            });
          }
          if (incs.length > 0) {
            setOrders((prev) => {
              const existingIds = new Set(prev.map((o) => o.id));
              const toAdd = incs.filter((o) => !existingIds.has(o.id));
              return [...toAdd, ...prev];
            });
          }
        }
      } else if (item.itemType === "dataset") {
        const payload = item.data as { dataset: UploadedDataset; orders?: Order[] };
        if (payload.dataset) {
          const isProductFile = payload.dataset.fileType === "product" || (payload.dataset.type as string) === "product";
          if (isProductFile) {
            setProductFiles((prev) => {
              const exists = prev.some((d) => d.id === payload.dataset.id);
              return exists ? prev : [payload.dataset, ...prev];
            });
          } else {
            setUploadedDatasets((prev) => {
              const exists = prev.some((d) => d.id === payload.dataset.id);
              return exists ? prev : [payload.dataset, ...prev];
            });
          }

          let ordersToRestore = (payload.orders && payload.orders.length > 0) ? payload.orders : [];
          if (ordersToRestore.length === 0) {
            try {
              ordersToRestore = convertDatasetToOrders(payload.dataset);
            } catch (err) {
              console.warn("Failed to convert restored dataset to orders:", err);
            }
          }

          if (ordersToRestore.length > 0) {
            setOrders((prev) => {
              const existingIds = new Set(prev.map((o) => o.id));
              const toAdd = ordersToRestore.filter((o) => !existingIds.has(o.id));
              const updated = [...toAdd, ...prev];
              return reevaluateOrdersStatus(updated, isProductFile ? uploadedDatasets : [payload.dataset, ...uploadedDatasets]);
            });

            // Re-apply product stats
            setProducts((prevProducts) => {
              let updated = [...prevProducts];
              ordersToRestore.forEach((o) => {
                if (o.isIncome) return;
                const pName = (o.productName || "").toLowerCase().trim();
                if (!pName) return;
                const qty = o.quantity || 1;
                const isRefunded = o.status === "Refunded";
                updated = updated.map((p) => {
                  if (p.name.toLowerCase().trim() === pName) {
                    const newStock = Math.max(0, p.stock - qty);
                    return {
                      ...p,
                      sales: isRefunded ? p.sales : p.sales + qty,
                      revenue: isRefunded ? p.revenue : p.revenue + (o.total || 0),
                      stock: newStock,
                      status: newStock === 0 ? "Out of Stock" : newStock <= 10 ? "Low Stock" : "In Stock",
                    };
                  }
                  return p;
                });
              });
              return updated;
            });
          }
        }
      }

      setTrashItems((prev) => {
        const next = prev.filter((t) => t.id !== item.id);
        try {
          localStorage.setItem("trash_bin_items", JSON.stringify(next));
        } catch (e) {
          console.warn("Failed to sync trash_bin_items:", e);
        }
        return next;
      });
      deleteTrashItemFromSupabase(item.id);

      // Dispatch update event immediately
      setTimeout(() => {
        window.dispatchEvent(new Event("mock_supabase_orders_updated"));
      }, 50);

      triggerAlert(`กู้คืนข้อมูล "${item.title}" เรียบร้อยแล้ว`, "success");

      sendNotification({
        title: `กู้คืนข้อมูล: ${item.title}`,
        message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้กู้คืนข้อมูล "${item.title}" (${item.itemCount} รายการ) กลับสู่ระบบเรียบร้อยแล้ว`,
        type: "system",
        actionType: "create",
        targetRoles: ["Admin", "Manager"],
        senderId: currentUser?.id,
        senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
        senderRole: currentUser?.role,
        priority: "important",
      });
    } catch (e) {
      console.error("Failed to restore trash item:", e);
      triggerAlert("เกิดข้อผิดพลาดในการกู้คืนข้อมูล", "error");
    }
  };

  const handleDeleteTrashItemPermanently = (id: string) => {
    if (currentUser?.role !== "Admin" && currentUser?.role !== "Manager") {
      triggerAlert("ปฏิเสธการเข้าถึง: เฉพาะ แอดมิน และ ผู้จัดการ เท่านั้นที่มีสิทธิ์ลบถาวร");
      return;
    }
    const target = trashItems.find((t) => t.id === id);
    requestConfirm(
      "ยืนยันการลบรายการถาวร",
      `คุณแน่ใจหรือไม่ว่าต้องการลบ "${target?.title || "รายการนี้"}" ออกจากถังขยะแบบถาวร? เมื่อลบแล้วจะไม่สามารถกู้คืนได้อีก`,
      () => {
        setTrashItems((prev) => prev.filter((t) => t.id !== id));
        deleteTrashItemFromSupabase(id);
        triggerAlert("ลบข้อมูลออกจากถังขยะถาวรเรียบร้อยแล้ว", "info");
      },
      "ลบถาวร",
      "ยกเลิก",
      "trash"
    );
  };

  const handleEmptyTrash = () => {
    if (currentUser?.role !== "Admin" && currentUser?.role !== "Manager") {
      triggerAlert("ปฏิเสธการเข้าถึง: เฉพาะ แอดมิน และ ผู้จัดการ เท่านั้นที่มีสิทธิ์ล้างถังขยะ");
      return;
    }
    requestConfirm(
      "ยืนยันการล้างถังขยะทั้งหมด",
      "คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมดในถังขยะแบบถาวร? เมื่อลบแล้วจะไม่สามารถกู้คืนได้อีก",
      () => {
        setTrashItems([]);
        clearTrashFromSupabase();
        try {
          localStorage.removeItem("trash_bin_items");
        } catch (e) {
          console.warn("Failed to clear trash storage:", e);
        }
        triggerAlert("ล้างถังขยะทั้งหมดเรียบร้อยแล้ว", "info");
      },
      "ล้างถังขยะถาวร",
      "ยกเลิก",
      "trash"
    );
  };

  const handleDeleteProduct = (id: string) => {
    if (currentUser?.role !== "Admin" && currentUser?.role !== "Manager") {
      triggerAlert("ปฏิเสธการเข้าถึง: ไม่มีสิทธิ์ในการลบสินค้าคงคลัง");
      return;
    }
    const prev = products.find((p) => p.id === id);
    if (!prev) return;
    addToTrash(`สินค้า: ${prev.name}`, "product", prev, 1, `ราคา ${prev.price.toLocaleString()} ฿, สต็อก ${prev.stock} ชิ้น`);
    setProducts((prevProds) => prevProds.filter((p) => p.id !== id));
    deleteProductFromSupabase(id);

    const log: AuditLog = {
      id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
      action: "Delete",
      targetType: "product",
      targetId: id,
      timestamp: new Date().toLocaleString("th-TH"),
      performedBy: currentUser?.name || "System",
      details: `ลบรายการสินค้า ${prev.name} ออกจากคลัง (ส่งไปยังถังขยะ)`,
      previousData: JSON.stringify(prev),
    };

    setAuditLogs((prevLogs) => [log, ...prevLogs]);
    if (currentUser?.role !== "Admin") {
      setAdminUnreadCount((c) => c + 1);
    }

    sendNotification({
      title: `ลบรายการสินค้า: ${prev.name}`,
      message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้ลบสินค้า "${prev.name}" (รหัส: ${prev.id}, แบรนด์: ${prev.brand || "ทั่วไป"}, หมวดหมู่: ${prev.category}, ราคา: ${prev.price.toLocaleString()} ฿, คงเหลือ: ${prev.stock.toLocaleString()} ชิ้น) ออกจากคลังสินค้า`,
      type: "inventory",
      actionType: "delete",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
      senderRole: currentUser?.role,
      actionTab: "sales",
      priority: "important",
    });

    triggerAlert("ลบรายการสินค้าแล้ว (สามารถกู้คืนได้ที่ถังขยะ)", "info");
  };

  const handleDeleteAllProducts = () => {
    if (currentUser?.role !== "Admin" && currentUser?.role !== "Manager") {
      triggerAlert("ปฏิเสธการเข้าถึง: ไม่มีสิทธิ์ในการล้างข้อมูลสินค้า");
      return;
    }
        const deletedCount = products.length;
    if (deletedCount > 0 || productFiles.length > 0) {
      addToTrash(
        "ล้างข้อมูลสินค้าและแคตตาล็อกทั้งหมด",
        "bulk_products",
        { products: [...products], productFiles: [...productFiles] },
        deletedCount,
        `สินค้า ${deletedCount} รายการ และไฟล์แคตตาล็อก ${productFiles.length} ไฟล์`
      );
    }
    setProducts([]);
    setProductFiles([]);
    deleteAllProductsFromSupabase();
    productFiles.forEach((f) => deleteDatasetFromSupabase(f.id));
    try {
      localStorage.removeItem("products");
      localStorage.removeItem("productFiles");
    } catch (e) {
      console.warn("Failed to remove products keys from localStorage:", e);
    }

    const log: AuditLog = {
      id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
      action: "Delete",
      targetType: "product",
      targetId: "ALL",
      timestamp: new Date().toLocaleString("th-TH"),
      performedBy: currentUser?.name || "System",
      details: "ล้างข้อมูลรายการสินค้าและไฟล์สินค้านำเข้าทั้งหมดสำเร็จ (ส่งไปยังถังขยะ)",
    };

    setAuditLogs((prevLogs) => [log, ...prevLogs]);
    if (currentUser?.role !== "Admin") {
      setAdminUnreadCount((c) => c + 1);
    }

    sendNotification({
      title: "ล้างข้อมูลสินค้าคงคลังทั้งหมด",
      message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้ทำการล้างข้อมูลสินค้าคงคลังและไฟล์แคตตาล็อกทั้งหมด (${deletedCount} รายการ)`,
      type: "inventory",
      actionType: "delete",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
      senderRole: currentUser?.role,
      actionTab: "sales",
      priority: "urgent",
    });

    triggerAlert("ล้างข้อมูลสินค้าคงคลังทั้งหมดแล้ว (สามารถกู้คืนได้ที่ถังขยะ)", "success");
  };

  const handleDeleteDataset = (id: string) => {
    const targetDataset = uploadedDatasets.find((d) => d.id === id) || productFiles.find((d) => d.id === id);
    
    const datasetOrderIds = new Set<string>();
    if (targetDataset) {
      try {
        const parsedOrders = convertDatasetToOrders(targetDataset);
        parsedOrders.forEach((po) => {
          if (po.id) {
            datasetOrderIds.add(po.id.toLowerCase().trim());
            const cleanId = po.id.replace(/-row-.*$/, "").trim().toLowerCase();
            if (cleanId) datasetOrderIds.add(cleanId);
          }
        });
      } catch (err) {
        console.warn("Failed to parse orders from dataset for deletion matching", err);
      }
    }

    const isOrderOfDataset = (o: Order): boolean => {
      if (!o) return false;
      if (o.datasetId && (o.datasetId === id || (targetDataset && o.datasetId === targetDataset.id))) {
        return true;
      }
      if (o.id) {
        const cleanId = o.id.replace(/-row-.*$/, "").trim().toLowerCase();
        if (datasetOrderIds.has(o.id.toLowerCase().trim()) || (cleanId && datasetOrderIds.has(cleanId))) {
          return true;
        }
      }
      return false;
    };

    const ordersToDelete = orders.filter(isOrderOfDataset);
    const remainingOrders = orders.filter((o) => !isOrderOfDataset(o));

    if (targetDataset) {
      addToTrash(
        `ไฟล์ข้อมูล: ${targetDataset.fileName}`,
        "dataset",
        { dataset: targetDataset, orders: ordersToDelete },
        ordersToDelete.length || 1,
        `ไฟล์ ${targetDataset.fileName} (คำสั่งซื้อเกี่ยวข้อง ${ordersToDelete.length} รายการ)`
      );
    }

    if (ordersToDelete.length > 0) {
      setProducts((prevProducts) => {
        let updated = [...prevProducts];
        ordersToDelete.forEach((o) => {
          updated = updated.map((p) => {
            if (p.name.toLowerCase() === o.productName.toLowerCase()) {
              const stock = p.stock + (o.quantity || 1);
              let sales = p.sales;
              let revenue = p.revenue;
              if (o.status !== "Refunded") {
                sales = Math.max(0, sales - (o.quantity || 1));
                revenue = Math.max(0, revenue - (o.total || 0));
              }
              const status =
                stock === 0
                  ? "Out of Stock"
                  : stock <= 10
                    ? "Low Stock"
                    : "In Stock";
              return { ...p, sales, revenue, stock, status };
            }
            return p;
          });
        });
        return updated;
      });

      triggerAlert(
        `ลบข้อมูลไฟล์และปรับปรุงยอดสต็อกสำหรับคำสั่งซื้อจำนวน ${ordersToDelete.length} รายการแล้ว (สามารถกู้คืนได้ที่ถังขยะ)`,
        "info",
      );
    } else {
      triggerAlert(
        `ลบไฟล์ข้อมูล "${targetDataset?.fileName || id}" เรียบร้อยแล้ว`,
        "info",
      );
    }

    setOrders(remainingOrders);

    const remainingUploadedDatasets = uploadedDatasets.filter((d) => d.id !== id);
    const remainingProductFiles = productFiles.filter((d) => d.id !== id);

    setUploadedDatasets(remainingUploadedDatasets);
    setProductFiles(remainingProductFiles);
    deleteDatasetFromSupabase(id);

    // Delete associated orders from Supabase
    if (ordersToDelete.length > 0 || datasetOrderIds.size > 0) {
      const idsToDelete = ordersToDelete.map((o) => o.id).filter(Boolean);
      Array.from(datasetOrderIds).forEach((did) => {
        if (!idsToDelete.includes(did)) idsToDelete.push(did);
      });
      deleteOrdersByIdsFromSupabase(idsToDelete);
    }
    if (remainingOrders.length === 0) {
      deleteAllOrdersFromSupabase();
    }

    try {
      const regularOrders = remainingOrders.filter(o => !o.isIncome);
      const incomeOrders = remainingOrders.filter(o => o.isIncome);
      localStorage.setItem("orders", JSON.stringify(regularOrders));
      localStorage.setItem("income_data", JSON.stringify(incomeOrders));
      localStorage.setItem("mock_supabase_orders", JSON.stringify(remainingOrders));
      localStorage.setItem("uploadedDatasets", JSON.stringify(remainingUploadedDatasets));
      localStorage.setItem("productFiles", JSON.stringify(remainingProductFiles));
      window.dispatchEvent(new Event("mock_supabase_orders_updated"));
    } catch (e) {
      console.warn("Failed to sync localStorage on dataset delete:", e);
    }

    const log: AuditLog = {
      id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
      action: "Delete",
      targetType: "order",
      targetId: id,
      timestamp: new Date().toLocaleString("th-TH"),
      performedBy: currentUser?.name || "System",
      details: `ลบไฟล์ข้อมูล "${targetDataset?.fileName || id}" (คำสั่งซื้อเกี่ยวข้อง: ${ordersToDelete.length} รายการ) (ส่งไปยังถังขยะ)`,
    };
    setAuditLogs((prevLogs) => [log, ...prevLogs]);
    if (currentUser?.role !== "Admin") {
      setAdminUnreadCount((c) => c + 1);
    }

    sendNotification({
      title: `ลบไฟล์ข้อมูลนำเข้า: ${targetDataset?.fileName || id}`,
      message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้ลบไฟล์ "${targetDataset?.fileName || id}" ออกจากระบบ (คำสั่งซื้อเกี่ยวข้อง: ${ordersToDelete.length} รายการ ถูกนำออกและคืนสต็อกสินค้าเรียบร้อย)`,
      type: "import",
      actionType: "delete",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
      senderRole: currentUser?.role,
      actionTab: "sales",
      priority: "important",
    });
  };

  const handleImportOrders = (newOrders: Order[], newDatasets: UploadedDataset[]) => {
    // 1. Only overwrite datasets if their exact ID matches an incoming dataset
    const newDatasetIds = new Set(newDatasets.map(d => d.id));
    const datasetIdsToDelete = uploadedDatasets
      .filter(d => newDatasetIds.has(d.id))
      .map(d => d.id);
      
    // Build a Map of products by lowercased name for O(1) instant lookups (prevents UI freeze)
    const productMap = new Map<string, Product>();
    products.forEach((p) => {
      productMap.set(p.name.toLowerCase().trim(), { ...p });
    });

    let updatedOrders = [...orders];
    
    datasetIdsToDelete.forEach(id => {
      const ordersToDelete = updatedOrders.filter((o) => o.datasetId === id);
      ordersToDelete.forEach((o) => {
        const prodKey = (o.productName || "").toLowerCase().trim();
        const p = productMap.get(prodKey);
        if (p) {
          const stock = p.stock + (o.quantity || 1);
          let sales = p.sales;
          let revenue = p.revenue;
          if (o.status !== "Refunded") {
            sales = Math.max(0, sales - (o.quantity || 1));
            revenue = Math.max(0, revenue - (o.total || 0));
          }
          p.stock = stock;
          p.sales = sales;
          p.revenue = revenue;
          p.status =
            stock === 0
              ? "Out of Stock"
              : stock <= 10
                ? "Low Stock"
                : "In Stock";
        }
      });
      updatedOrders = updatedOrders.filter((o) => o.datasetId !== id);
    });
    
    const remainingDatasets = uploadedDatasets.filter(d => !newDatasetIds.has(d.id));
    
    // De-duplicate orders by Order ID: update matching orders or append new ones
    const incomingOrderIds = new Set(newOrders.map(o => o.id));
    const nonDuplicatedOldOrders = updatedOrders.filter(o => !incomingOrderIds.has(o.id));
    const finalOrders = [...newOrders, ...nonDuplicatedOldOrders];
    
    // Update products for the NEW orders using fast Map lookup
    newOrders.forEach((o) => {
      if (o.isIncome) return;
      const prodKey = (o.productName || "").toLowerCase().trim();
      const p = productMap.get(prodKey);
      if (p) {
        const qty = o.quantity || 1;
        const newStock = Math.max(0, p.stock - qty);
        const isRefunded = o.status === "Refunded";
        p.stock = newStock;
        p.sales = isRefunded ? p.sales : p.sales + qty;
        p.revenue = isRefunded ? p.revenue : p.revenue + (o.total || 0);
        p.status =
          newStock === 0
            ? "Out of Stock"
            : newStock <= 10
              ? "Low Stock"
              : "In Stock";
      }
    });
    
    const updatedProducts = Array.from(productMap.values());
    setProducts(updatedProducts);
    syncProductsToSupabase(updatedProducts);
    setOrders(finalOrders);
    setUploadedDatasets([...remainingDatasets, ...newDatasets]);
    newDatasets.forEach((d) => syncDatasetToSupabase(d));
    syncOrdersToSupabase(newOrders);

    const log: AuditLog = {
      id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
      action: "Import",
      targetType: "order",
      targetId: "IMPORT",
      timestamp: new Date().toLocaleString("th-TH"),
      performedBy: currentUser?.name || "System",
      details: `นำเข้าข้อมูลคำสั่งซื้อยอดขายจำนวน ${newOrders.length} รายการ จาก ${newDatasets.length} ไฟล์สำเร็จ`,
    };
    setAuditLogs((prevLogs) => [log, ...prevLogs]);

    if (currentUser?.role !== "Admin") {
      setAdminUnreadCount((c) => c + 1);
    }

    // Send notifications to Managers & Admin
    sendNotification({
      title: `นำเข้าข้อมูลคำสั่งซื้อใหม่ ${newOrders.length} รายการ`,
      message: `${currentUser?.name || "พนักงาน"} (${currentUser?.role}) ได้นำเข้าไฟล์ ${newDatasets.map((d) => d.fileName).join(", ")} จำนวน ${newOrders.length} รายการ เข้าสู่ระบบเรียบร้อยแล้ว`,
      type: "import",
      actionType: "import",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name || "System"} (${currentUser?.role})`,
      senderRole: currentUser?.role,
      actionTab: "sales",
      priority: "normal",
    });

    // Confirmation notification for the user who imported
    if (currentUser) {
      sendNotification({
        title: "การนำเข้าไฟล์ข้อมูลสำเร็จ",
        message: `คุณได้นำเข้าไฟล์ ${newDatasets.map((d) => d.fileName).join(", ")} จำนวน ${newOrders.length} รายการ เรียบร้อยแล้ว`,
        type: "import",
        actionType: "import",
        targetUserId: currentUser.id,
        senderName: "ระบบนำเข้าข้อมูล",
        senderRole: "System",
        actionTab: "sales",
        priority: "normal",
      });
    }
  };

  // --- Order CRUD ---
  const handleCreateOrder = (e: {
    customerName: string;
    email?: string;
    productName: string;
    brand?: string;
    channel: string;
    total: number;
    quantity: number;
    status: Order["status"];
    date?: string;
    shippingFee?: number;
    platformFee?: number;
    netIncome?: number;
  }) => {
    const prod = products.find((p) => p.name === e.productName);
    const newOrder: Order = {
      id: `ORD-${Math.floor(89000 + Math.random() * 900)}`,
      customerName: e.customerName,
      email:
        e.email ||
        `${e.customerName.toLowerCase().replace(/[^a-zA-Z0-9]/g, "")}@example.com`,
      productName: e.productName,
      brand: prod ? prod.brand : e.brand || "ทั่วไป",
      channel: e.channel,
      total: e.total,
      quantity: e.quantity,
      status: e.status,
      date: e.date || new Date().toISOString().split("T")[0],
      shippingFee: e.shippingFee,
      platformFee: e.platformFee,
      netIncome: e.netIncome,
    };

    setOrders((prev) => [newOrder, ...prev]);
    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        if (p.name.toLowerCase() === e.productName.toLowerCase()) {
          const newStock = Math.max(0, p.stock - e.quantity);
          const isRefunded = e.status === "Refunded";
          return {
            ...p,
            sales: isRefunded ? p.sales : p.sales + e.quantity,
            revenue: isRefunded ? p.revenue : p.revenue + e.total,
            stock: newStock,
            status:
              newStock === 0
                ? "Out of Stock"
                : newStock <= 10
                  ? "Low Stock"
                  : "In Stock",
          };
        }
        return p;
      }),
    );

    setIsAddOrderOpen(false);

    sendNotification({
      title: `บันทึกคำสั่งซื้อใหม่: ${newOrder.id}`,
      message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้บันทึกคำสั่งซื้อใหม่สำหรับลูกค้า ${maskCustomerName(newOrder.customerName)} (สินค้า: ${newOrder.productName}, จำนวน: ${newOrder.quantity} ชิ้น, ยอดเงิน: ${(newOrder.total || 0).toLocaleString()} ฿, ช่องทาง: ${newOrder.channel}, สถานะ: ${newOrder.status})`,
      type: "order",
      actionType: "create",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
      senderRole: currentUser?.role,
      actionTab: "sales",
      priority: "normal",
    });

    triggerAlert("บันทึกคำสั่งซื้อสำเร็จเรียบร้อยแล้ว");
  };

  const handleEditOrderSubmit = (updatedOrder: Order) => {
    const prev = orders.find((o) => o.id === updatedOrder.id);
    if (!prev) return;

    setOrders((prevOrders) =>
      prevOrders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)),
    );
    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        let sales = p.sales;
        let revenue = p.revenue;
        let stock = p.stock;
        const wasPrevProd =
          p.name.toLowerCase() === prev.productName.toLowerCase();
        const isCurrProd =
          p.name.toLowerCase() === updatedOrder.productName.toLowerCase();

        if (wasPrevProd) {
          stock += prev.quantity || 1;
          if (prev.status !== "Refunded") {
            sales = Math.max(0, sales - (prev.quantity || 1));
            revenue = Math.max(0, revenue - (prev.total || 0));
          }
        }
        if (isCurrProd) {
          stock = Math.max(0, stock - (updatedOrder.quantity || 1));
          if (updatedOrder.status !== "Refunded") {
            sales += updatedOrder.quantity || 1;
            revenue += (updatedOrder.total || 0);
          }
        }
        const status =
          stock === 0 ? "Out of Stock" : stock <= 10 ? "Low Stock" : "In Stock";
        return {
          ...p,
          sales,
          revenue,
          stock,
          status,
        };
      }),
    );

    setIsEditOrderOpen(false);
    setEditingOrder(null);

    const changesList: string[] = [];
    if (prev.customerName !== updatedOrder.customerName) changesList.push(`ชื่อลูกค้า: "${maskCustomerName(prev.customerName)}" ➔ "${maskCustomerName(updatedOrder.customerName)}"`);
    if (prev.email !== updatedOrder.email) changesList.push(`อีเมล: "${prev.email || "-"}" ➔ "${updatedOrder.email || "-"}"`);
    if (prev.productName !== updatedOrder.productName) changesList.push(`สินค้า: "${prev.productName}" ➔ "${updatedOrder.productName}"`);
    if (prev.brand !== updatedOrder.brand) changesList.push(`แบรนด์: "${prev.brand || "-"}" ➔ "${updatedOrder.brand || "-"}"`);
    if (prev.channel !== updatedOrder.channel) changesList.push(`ช่องทาง: "${prev.channel}" ➔ "${updatedOrder.channel}"`);
    if (prev.quantity !== updatedOrder.quantity) changesList.push(`จำนวน: ${prev.quantity || 1} ➔ ${updatedOrder.quantity || 1} ชิ้น`);
    if (prev.total !== updatedOrder.total) changesList.push(`ยอดสุทธิ: ${(prev.total || 0).toLocaleString()} ฿ ➔ ${(updatedOrder.total || 0).toLocaleString()} ฿`);
    if (prev.platformFee !== updatedOrder.platformFee) changesList.push(`ค่าธรรมเนียม: ${(prev.platformFee || 0).toLocaleString()} ฿ ➔ ${(updatedOrder.platformFee || 0).toLocaleString()} ฿`);
    if (prev.shippingFee !== updatedOrder.shippingFee) changesList.push(`ค่าจัดส่ง: ${(prev.shippingFee || 0).toLocaleString()} ฿ ➔ ${(updatedOrder.shippingFee || 0).toLocaleString()} ฿`);
    if (prev.netIncome !== updatedOrder.netIncome) changesList.push(`รายรับสุทธิ: ${(prev.netIncome || 0).toLocaleString()} ฿ ➔ ${(updatedOrder.netIncome || 0).toLocaleString()} ฿`);
    if (prev.status !== updatedOrder.status) changesList.push(`สถานะ: "${prev.status}" ➔ "${updatedOrder.status}"`);
    if (prev.date !== updatedOrder.date) changesList.push(`วันที่: "${prev.date}" ➔ "${updatedOrder.date}"`);
    const changesStr = changesList.length > 0 ? changesList.join(" | ") : "ไม่มีการเปลี่ยนแปลงค่า";

    const log: AuditLog = {
      id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
      action: "Edit",
      targetType: "order",
      targetId: updatedOrder.id,
      timestamp: new Date().toLocaleString("th-TH"),
      performedBy: currentUser?.name || "System",
      details: `แก้ไขคำสั่งซื้อ ${updatedOrder.id} ของลูกค้า ${maskCustomerName(updatedOrder.customerName)} (แก้ไข: ${changesStr})`,
      previousData: JSON.stringify(prev),
      newData: JSON.stringify(updatedOrder),
    };

    setAuditLogs((prevLogs) => [log, ...prevLogs]);
    if (currentUser?.role !== "Admin") {
      setAdminUnreadCount((c) => c + 1);
    }

    sendNotification({
      title: `แก้ไขคำสั่งซื้อ: ${updatedOrder.id}`,
      message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้แก้ไขคำสั่งซื้อ ${updatedOrder.id} (ลูกค้า: ${maskCustomerName(updatedOrder.customerName)}, สินค้า: ${updatedOrder.productName}) รายละเอียด: [${changesStr}]`,
      type: "order",
      actionType: "edit",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
      senderRole: currentUser?.role,
      actionTab: "sales",
      priority: "normal",
    });

    triggerAlert(`แก้ไขข้อมูลคำสั่งซื้อสำเร็จ (แก้ไข: ${changesStr})`);
  };

  const handleDeleteOrder = (id: string) => {
    if (currentUser?.role !== "Admin" && currentUser?.role !== "Manager") {
      triggerAlert("ปฏิเสธการเข้าถึง: ไม่มีสิทธิ์ในการลบรายการสั่งซื้อ");
      return;
    }
    const prev = orders.find((o) => o.id === id);
    if (!prev) return;

    addToTrash(
      `คำสั่งซื้อ: ${prev.productName || "ไม่ระบุสินค้า"} (#${id})`,
      "order",
      prev,
      1,
      `ลูกค้า: ${prev.customerName || "ไม่ระบุ"}, ยอด: ${(prev.total || 0).toLocaleString()} ฿`
    );

    const remainingOrders = orders.filter((o) => o.id !== id);
    setOrders(remainingOrders);
    try {
      const regularOrders = remainingOrders.filter(o => !o.isIncome);
      const incomeOrders = remainingOrders.filter(o => o.isIncome);
      localStorage.setItem("orders", JSON.stringify(regularOrders));
      localStorage.setItem("income_data", JSON.stringify(incomeOrders));
      localStorage.setItem("mock_supabase_orders", JSON.stringify(remainingOrders));
      window.dispatchEvent(new Event("mock_supabase_orders_updated"));
    } catch (e) {
      console.warn("Failed to sync localStorage on order delete:", e);
    }

    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        if (p.name.toLowerCase() === prev.productName.toLowerCase()) {
          const stock = p.stock + (prev.quantity || 1);
          let sales = p.sales;
          let revenue = p.revenue;
          if (prev.status !== "Refunded") {
            sales = Math.max(0, sales - (prev.quantity || 1));
            revenue = Math.max(0, revenue - (prev.total || 0));
          }
          const status =
            stock === 0 ? "Out of Stock" : stock <= 10 ? "Low Stock" : "In Stock";
          return { ...p, sales, revenue, stock, status };
        }
        return p;
      })
    );
    const log: AuditLog = {
      id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
      action: "Delete",
      targetType: "order",
      targetId: id,
      timestamp: new Date().toLocaleString("th-TH"),
      performedBy: currentUser?.name || "System",
      details: `ลบรายการคำสั่งซื้อ ${id} ของลูกค้า ${maskCustomerName(prev?.customerName || "")} (ส่งไปยังถังขยะ)`,
      previousData: JSON.stringify(prev),
    };

    setAuditLogs((prevLogs) => [log, ...prevLogs]);
    if (currentUser?.role !== "Admin") {
      setAdminUnreadCount((c) => c + 1);
    }

    sendNotification({
      title: `ลบคำสั่งซื้อ: ${id}`,
      message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้ลบคำสั่งซื้อ ${id} ของลูกค้า ${maskCustomerName(prev?.customerName || "")} (สินค้า: ${prev?.productName}, จำนวน: ${prev?.quantity || 1} ชิ้น, ยอดเงิน: ${(prev?.total || 0).toLocaleString()} ฿, ช่องทาง: ${prev?.channel}, สถานะ: ${prev?.status}, วันที่: ${prev?.date})`,
      type: "order",
      actionType: "delete",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
      senderRole: currentUser?.role,
      actionTab: "sales",
      priority: "important",
    });

    triggerAlert("ลบรายการคำสั่งซื้อแล้ว (สามารถกู้คืนได้ที่ถังขยะ)", "info");
  };

  const handleDeleteAllOrders = () => {
    if (currentUser?.role !== "Admin" && currentUser?.role !== "Manager") {
      triggerAlert(
        "ปฏิเสธการเข้าถึง: ไม่มีสิทธิ์ในการล้างข้อมูลคำสั่งซื้อ",
      );
      return;
    }
    const ordersToDelete = orders.filter((o) => !o.isIncome);
    const orderDatasetsToDelete = uploadedDatasets.filter(
      (d) => d.type === "order" || d.fileType === "order" || (d.fileType !== "product" && (d.type as string) !== "product" && d.type !== "income" && d.fileType !== "income")
    );

    if (ordersToDelete.length > 0 || orderDatasetsToDelete.length > 0) {
      addToTrash(
        "ล้างข้อมูลคำสั่งซื้อทั้งหมด",
        "bulk_orders",
        { orders: ordersToDelete, datasets: orderDatasetsToDelete },
        ordersToDelete.length + orderDatasetsToDelete.length,
        `คำสั่งซื้อทั้งหมด ${ordersToDelete.length} รายการ และไฟล์ ${orderDatasetsToDelete.length} ไฟล์`
      );
      setProducts((prevProducts) => {
        let updated = [...prevProducts];
        ordersToDelete.forEach((o) => {
          updated = updated.map((p) => {
            if (p.name.toLowerCase() === o.productName.toLowerCase()) {
              const stock = p.stock + (o.quantity || 1);
              let sales = p.sales;
              let revenue = p.revenue;
              if (o.status !== "Refunded") {
                sales = Math.max(0, sales - (o.quantity || 1));
                revenue = Math.max(0, revenue - (o.total || 0));
              }
              const status =
                stock === 0
                  ? "Out of Stock"
                  : stock <= 10
                    ? "Low Stock"
                    : "In Stock";
              return { ...p, sales, revenue, stock, status };
            }
            return p;
          });
        });
        return updated;
      });
    }

    // Keep only income orders
    const remainingOrders = orders.filter((o) => o.isIncome);
    setOrders(remainingOrders);

    // Keep only non-order datasets
    const remainingDatasets = uploadedDatasets.filter(
      (d) => !orderDatasetsToDelete.some((od) => od.id === d.id)
    );
    setUploadedDatasets(remainingDatasets);

    orderDatasetsToDelete.forEach((d) => {
      deleteDatasetFromSupabase(d.id);
    });
    if (ordersToDelete.length > 0) {
      const ids = ordersToDelete.map((o) => o.id).filter(Boolean);
      deleteOrdersByIdsFromSupabase(ids);
    }
    if (remainingOrders.length === 0) {
      deleteAllOrdersFromSupabase();
    }

    try {
      localStorage.removeItem("orders");
      localStorage.setItem("uploadedDatasets", JSON.stringify(remainingDatasets));
      localStorage.setItem("mock_supabase_orders", JSON.stringify(remainingOrders));
      window.dispatchEvent(new Event("mock_supabase_orders_updated"));
    } catch (e) {
      console.warn("Failed to remove keys from localStorage:", e);
    }

    const log: AuditLog = {
      id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
      action: "Delete",
      targetType: "order",
      targetId: "ALL_ORDERS",
      timestamp: new Date().toLocaleString("th-TH"),
      performedBy: currentUser?.name || "System",
      details: `ล้างข้อมูลธุรกรรมคำสั่งซื้อและไฟล์คำสั่งซื้อทั้งหมดสำเร็จ (ส่งไปยังถังขยะ)`,
    };

    setAuditLogs((prevLogs) => [log, ...prevLogs]);
    if (currentUser?.role !== "Admin") {
      setAdminUnreadCount((c) => c + 1);
    }

    sendNotification({
      title: "ล้างข้อมูลคำสั่งซื้อทั้งหมด",
      message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้ทำการล้างข้อมูลธุรกรรมคำสั่งซื้อทั้งหมดในระบบ (${ordersToDelete.length} รายการ, ${orderDatasetsToDelete.length} ไฟล์)`,
      type: "order",
      actionType: "delete",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
      senderRole: currentUser?.role,
      actionTab: "sales",
      priority: "urgent",
    });

    triggerAlert("ล้างข้อมูลคำสั่งซื้อทั้งหมดแล้ว (สามารถกู้คืนได้ที่ถังขยะ)", "success");
  };

  const handleDeleteAllIncome = () => {
    if (currentUser?.role !== "Admin" && currentUser?.role !== "Manager") {
      triggerAlert(
        "ปฏิเสธการเข้าถึง: ไม่มีสิทธิ์ในการล้างข้อมูลรายรับ",
      );
      return;
    }

    const incomeOrdersToDelete = orders.filter((o) => o.isIncome);
    const incomeDatasetsToDelete = uploadedDatasets.filter(
      (d) => d.type === "income" || d.fileType === "income" || (d.fileType !== "product" && (d.type as string) !== "product")
    );

    if (incomeOrdersToDelete.length > 0 || incomeDatasetsToDelete.length > 0) {
      addToTrash(
        "ล้างข้อมูลรายรับทั้งหมด",
        "bulk_income",
        { orders: incomeOrdersToDelete, datasets: incomeDatasetsToDelete },
        incomeOrdersToDelete.length + incomeDatasetsToDelete.length,
        `ข้อมูลรายรับทั้งหมด ${incomeOrdersToDelete.length} รายการ และไฟล์รายรับ ${incomeDatasetsToDelete.length} ไฟล์`
      );
    }
    // Keep only regular orders
    const remainingOrders = orders.filter((o) => !o.isIncome);
    setOrders(remainingOrders);

    // Keep only non-income datasets
    const remainingDatasets = uploadedDatasets.filter(
      (d) => !incomeDatasetsToDelete.some((id) => id.id === d.id)
    );
    setUploadedDatasets(remainingDatasets);

    incomeDatasetsToDelete.forEach((d) => {
      deleteDatasetFromSupabase(d.id);
    });
    if (incomeOrdersToDelete.length > 0) {
      const incomeIds = incomeOrdersToDelete.map((o) => o.id).filter(Boolean);
      deleteOrdersByIdsFromSupabase(incomeIds);
    }
    if (remainingOrders.length === 0) {
      deleteAllOrdersFromSupabase();
    }

    try {
      localStorage.removeItem("income_data");
      localStorage.setItem("uploadedDatasets", JSON.stringify(remainingDatasets));
      localStorage.setItem("mock_supabase_orders", JSON.stringify(remainingOrders));
      window.dispatchEvent(new Event("mock_supabase_orders_updated"));
    } catch (e) {
      console.warn("Failed to remove income_data from localStorage:", e);
    }

    const log: AuditLog = {
      id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
      action: "Delete",
      targetType: "income",
      targetId: "ALL_INCOME",
      timestamp: new Date().toLocaleString("th-TH"),
      performedBy: currentUser?.name || "System",
      details: "ล้างข้อมูลรายการรายรับและไฟล์นำเข้ารายรับทั้งหมดสำเร็จ (ส่งไปยังถังขยะ)",
    };

    setAuditLogs((prevLogs) => [log, ...prevLogs]);
    if (currentUser?.role !== "Admin") {
      setAdminUnreadCount((c) => c + 1);
    }

    sendNotification({
      title: "ล้างข้อมูลรายรับทั้งหมด",
      message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้ทำการล้างข้อมูลรายรับและไฟล์รายรับทั้งหมดในระบบ (${incomeOrdersToDelete.length} รายการ, ${incomeDatasetsToDelete.length} ไฟล์)`,
      type: "order",
      actionType: "delete",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
      senderRole: currentUser?.role,
      actionTab: "sales",
      priority: "urgent",
    });

    triggerAlert("ล้างข้อมูลรายรับทั้งหมดแล้ว (สามารถกู้คืนได้ที่ถังขยะ)", "success");
  };

  const handleUpdateAccountSettings = (updatedUser: AppUser) => {
    const isPasswordChanged = currentUser && updatedUser.password !== currentUser.password;
    setCurrentUser(updatedUser);
    setSystemUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
    );
    const log: AuditLog = {
      id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
      action: "Edit",
      targetType: "user",
      targetId: updatedUser.id,
      timestamp: new Date().toLocaleString("th-TH"),
      performedBy: currentUser?.name || "System",
      details: isPasswordChanged 
        ? `แก้ไขรหัสผ่านบัญชีผู้ใช้ในหน้าตั้งค่า (${updatedUser.name})`
        : `แก้ไขข้อมูลบัญชีผู้ใช้ในหน้าตั้งค่า (${updatedUser.name})`,
    };
    setAuditLogs((prev) => [log, ...prev]);
    
    sendNotification({
      title: isPasswordChanged ? "เปลี่ยนรหัสผ่านบัญชีผู้ใช้" : "อัปเดตข้อมูลบัญชีผู้ใช้",
      message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้ทำการอัปเดตข้อมูลบัญชีผู้ใช้ ${updatedUser.name} (${updatedUser.role})`,
      type: "activity",
      actionType: "edit",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
      senderRole: currentUser?.role,
      actionTab: "users",
      priority: "normal",
    });

    if (isPasswordChanged) {
      triggerAlert("เปลี่ยนรหัสผ่านสำเร็จ", "success");
    } else {
      triggerAlert("บันทึกข้อมูลบัญชีผู้ใช้เรียบร้อยแล้ว", "success");
    }
  };

  // --- JSON Data Backup & Restore ---
  const handleBackupData = () => {
    try {
      const backupObj = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        products,
        orders,
        systemUsers,
        auditLogs,
        uploadedDatasets,
      };
      const jsonStr = JSON.stringify(backupObj, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const today = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `phanvadee_backup_${today}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const log: AuditLog = {
        id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
        action: "System",
        targetType: "user",
        targetId: "BACKUP",
        timestamp: new Date().toLocaleString("th-TH"),
        performedBy: currentUser?.name || "System",
        details: "สำรองข้อมูลระบบเป็นไฟล์ JSON",
      };

      setAuditLogs((prevLogs) => [log, ...prevLogs]);
      if (currentUser?.role !== "Admin") {
        setAdminUnreadCount((c) => c + 1);
      }
      triggerAlert("สำรองข้อมูลสำเร็จ ดาวน์โหลดไฟล์แล้ว", "success");
    } catch {
      triggerAlert("เกิดข้อผิดพลาดในการสำรองข้อมูล", "error");
    }
  };

  const handleRestoreData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object")
          throw new Error("ไฟล์ JSON ไม่ถูกต้อง");
        if (
          !Array.isArray(parsed.products) ||
          !Array.isArray(parsed.orders) ||
          !Array.isArray(parsed.systemUsers)
        ) {
          throw new Error(
            "โครงสร้างไฟล์ข้อมูลไม่ถูกต้อง (ขาดตารางข้อมูลสินค้า ออเดอร์ หรือผู้ใช้งาน)",
          );
        }
        requestConfirm(
          "ยืนยันการกู้คืนข้อมูล",
          "คำเตือน: การกู้คืนข้อมูลจะทำการลบและเขียนทับข้อมูลสินค้า ออเดอร์ และผู้ใช้งานในเครื่องนี้ทั้งหมดด้วยข้อมูลจากไฟล์สำรอง คุณแน่ใจหรือไม่?",
          () => {
            setProducts(parsed.products);
            setOrders(parsed.orders);
            setSystemUsers(parsed.systemUsers);
            if (Array.isArray(parsed.uploadedDatasets)) {
              setUploadedDatasets(parsed.uploadedDatasets);
            } else {
              setUploadedDatasets([]);
            }
            const logs = Array.isArray(parsed.auditLogs)
              ? parsed.auditLogs
              : [];
            setAuditLogs([
              {
                id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
                action: "System",
                targetType: "user",
                targetId: "RESTORE",
                timestamp: new Date().toLocaleString("th-TH"),
                performedBy: currentUser?.name || "System",
                details: "กู้คืนข้อมูลระบบจากไฟล์สำรอง JSON",
              },
              ...logs,
            ]);
            if (currentUser?.role !== "Admin") {
              setAdminUnreadCount((c) => c + 1);
            }

            sendNotification({
              title: "กู้คืนข้อมูลระบบจากไฟล์สำรอง",
              message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้กู้คืนข้อมูลระบบจากไฟล์สำรอง JSON (สินค้า: ${parsed.products.length} รายการ, คำสั่งซื้อ: ${parsed.orders.length} รายการ, ผู้ใช้งาน: ${parsed.systemUsers.length} รายการ)`,
              type: "system",
              targetRoles: ["Admin", "Manager"],
              senderId: currentUser?.id,
              senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
              senderRole: currentUser?.role,
              actionTab: "dashboard",
              priority: "urgent",
            });

            triggerAlert(
              "กู้คืนข้อมูลสำเร็จ ระบบอัปเดตเรียบร้อยแล้ว",
              "success",
            );
          },
        );
      } catch (err: unknown) {
        triggerAlert(
          err instanceof Error
            ? err.message
            : "ไฟล์ไม่ถูกต้องหรือไม่รองรับรูปแบบนี้",
          "error",
        );
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  // --- User Management ---
  const handleCreateUser = (t: {
    name: string;
    email: string;
    role: AppUser["role"];
    password: AppUser["password"];
  }) => {
    if (t.password.length < 6) {
      triggerAlert("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (
      currentUser?.role === "Manager" &&
      (t.role === "Manager" || t.role === "Admin")
    ) {
      triggerAlert(
        "สิทธิ์จำกัด: ผู้จัดการสามารถสร้างบัญชีผู้ใช้ระดับพนักงาน (User) ได้เท่านั้น",
      );
      return;
    }

    const newUser: AppUser = {
      id: `USR-${Math.floor(100 + Math.random() * 900)}`,
      name: t.name,
      email: t.email,
      username: t.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
      role: t.role,
      status: "Active",
      password: t.password,
      tasks: [],
    };

    setSystemUsers((prev) => [...prev, newUser]);
    setIsAddUserOpen(false);

    const log: AuditLog = {
      id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
      action: "Edit",
      targetType: "user",
      targetId: newUser.id,
      timestamp: new Date().toLocaleString("th-TH"),
      performedBy: currentUser?.name || "System",
      details: `สร้างบัญชีผู้ใช้ใหม่ระบบ: ${newUser.name} (${newUser.role})`,
      newData: JSON.stringify(newUser),
    };

    setAuditLogs((prevLogs) => [log, ...prevLogs]);
    if (currentUser?.role !== "Admin") {
      setAdminUnreadCount((c) => c + 1);
    }

    sendNotification({
      title: `สร้างบัญชีผู้ใช้ใหม่: ${newUser.name}`,
      message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้สร้างบัญชีผู้ใช้ใหม่ "${newUser.name}" (บทบาท: ${newUser.role}, อีเมล: ${newUser.email}, ชื่อผู้ใช้: ${newUser.username})`,
      type: "activity",
      actionType: "create",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
      senderRole: currentUser?.role,
      actionTab: "users",
      priority: "normal",
    });

    triggerAlert(`สร้างบัญชีผู้ใช้ใหม่สำเร็จ: ${newUser.name}`);
  };

  const handleDeleteUser = (id: string) => {
    const target = systemUsers.find((u) => u.id === id);
    if (!target) return;
    if (
      currentUser?.role === "Manager" &&
      (target.role === "Manager" || target.role === "Admin")
    ) {
      triggerAlert(
        "สิทธิ์จำกัด: ผู้จัดการไม่สามารถลบบัญชีแอดมินหรือผู้จัดการท่านอื่นได้",
      );
      return;
    }
    if (id === currentUser?.id) {
      triggerAlert("ไม่สามารถลบบัญชีของคุณเองที่กำลังใช้งานอยู่ได้");
      return;
    }

    const remainingUsers = systemUsers.filter((u) => u.id !== id);
    setSystemUsers(remainingUsers);
    try {
      localStorage.setItem("systemUsers", JSON.stringify(remainingUsers));
    } catch (e) {
      console.warn("Failed to update systemUsers in localStorage:", e);
    }

    deleteUserFromSupabase(id);

    const log: AuditLog = {
      id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
      action: "Delete",
      targetType: "user",
      targetId: id,
      timestamp: new Date().toLocaleString("th-TH"),
      performedBy: currentUser?.name || "System",
      details: `ลบบัญชีผู้ใช้งานระบบ: ${target.name} (${target.role})`,
      previousData: JSON.stringify(target),
    };

    setAuditLogs((prevLogs) => [log, ...prevLogs]);
    if (currentUser?.role !== "Admin") {
      setAdminUnreadCount((c) => c + 1);
    }

    sendNotification({
      title: `ลบบัญชีผู้ใช้งาน: ${target.name}`,
      message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้ลบบัญชีผู้ใช้งาน "${target.name}" (บทบาท: ${target.role}, อีเมล: ${target.email}, ชื่อผู้ใช้: ${target.username}) ออกจากระบบ`,
      type: "activity",
      actionType: "delete",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
      senderRole: currentUser?.role,
      actionTab: "users",
      priority: "important",
    });

    triggerAlert(`ลบสิทธิ์การใช้งานบัญชี ${target.name} เรียบร้อยแล้ว`);
  };

  const handleToggleUserStatus = (id: string) => {
    const target = systemUsers.find((u) => u.id === id);
    if (target) {
      if (currentUser?.role === "Manager" && target.role === "Admin") {
        triggerAlert(
          "สิทธิ์จำกัด: ผู้จัดการไม่สามารถเปลี่ยนสถานะบัญชีแอดมินได้",
        );
        return;
      }
      if (id === currentUser?.id) {
        triggerAlert("ไม่สามารถระงับสิทธิ์บัญชีของคุณเองที่กำลังใช้งานอยู่ได้");
        return;
      }
      const newStatus = target.status === "Active" ? "Inactive" : "Active";
      setSystemUsers((prevUsers) =>
        prevUsers.map((u) => {
          if (u.id === id) {
            return { ...u, status: newStatus };
          }
          return u;
        }),
      );

      sendNotification({
        title: `เปลี่ยนสถานะบัญชีผู้ใช้: ${target.name}`,
        message: `${currentUser?.name || "ผู้ใช้"} (${currentUser?.role || "System"}) ได้เปลี่ยนสถานะบัญชี "${target.name}" เป็น ${newStatus === "Active" ? "เปิดใช้งาน (Active)" : "ระงับชั่วคราว (Inactive)"}`,
        type: "activity",
        actionType: "edit",
        targetRoles: ["Admin", "Manager"],
        senderId: currentUser?.id,
        senderName: `${currentUser?.name || "System"} (${currentUser?.role || "System"})`,
        senderRole: currentUser?.role,
        actionTab: "users",
        priority: "normal",
      });

      triggerAlert(
        `เปลี่ยนสถานะบัญชี ${target.name} เป็น ${
          newStatus === "Active" ? "เปิดใช้งาน" : "ระงับชั่วคราว"
        } เรียบร้อยแล้ว`,
      );
    }
  };

  const handleUpdateUserTasks = (userId: string, newTasks: string[]) => {
    const isManagerAllowed =
      currentUser?.role === "Manager" &&
      currentUser.tasks?.includes("จัดการผู้ใช้งาน");
    if (currentUser?.role !== "Admin" && !isManagerAllowed) {
      triggerAlert("สิทธิ์จำกัด: คุณไม่มีสิทธิ์กำหนดงานที่รับผิดชอบ", "error");
      return;
    }
    const target = systemUsers.find((u) => u.id === userId);
    if (!target) return;

    if (currentUser?.role === "Manager" && target.role === "Admin") {
      triggerAlert("สิทธิ์จำกัด: ผู้จัดการไม่สามารถแก้ไขงานของแอดมินได้", "error");
      return;
    }

    setSystemUsers((prevUsers) =>
      prevUsers.map((u) => {
        if (u.id === userId) {
          return { ...u, tasks: newTasks };
        }
        return u;
      })
    );

    const log: AuditLog = {
      id: `LOG-${Math.floor(10000 + Math.random() * 90000)}`,
      action: "Edit",
      targetType: "user",
      targetId: userId,
      timestamp: new Date().toLocaleString("th-TH"),
      performedBy: currentUser?.name || "System",
      details: `แก้ไขงานที่รับผิดชอบของ: ${target.name} (${target.role}) เป็น [${newTasks.join(", ")}]`,
      previousData: JSON.stringify(target),
      newData: JSON.stringify({ ...target, tasks: newTasks }),
    };

    setAuditLogs((prevLogs) => [log, ...prevLogs]);

    // Send direct notification to the employee
    sendNotification({
      title: "อัปเดตสิทธิ์งานที่รับผิดชอบของคุณ",
      message: `${currentUser?.name} (${currentUser?.role}) ได้อัปเดตงานที่คุณรับผิดชอบ: ${newTasks.length > 0 ? newTasks.join(", ") : "ไม่มีงานที่กำหนด"}`,
      type: "task",
      actionType: "edit",
      targetRoles: ["User", "Manager"],
      targetUserId: target.id,
      senderId: currentUser?.id,
      senderName: `${currentUser?.name} (${currentUser?.role})`,
      senderRole: currentUser?.role,
      actionTab: "dashboard",
      priority: "important",
    });

    // Notify Managers & Admins about the change
    sendNotification({
      title: `มอบหมายงานให้ ${target.name}`,
      message: `${currentUser?.name} ได้กำหนดงานให้ ${target.name} (${target.role}): [${newTasks.join(", ")}]`,
      type: "activity",
      actionType: "edit",
      targetRoles: ["Admin", "Manager"],
      senderId: currentUser?.id,
      senderName: `${currentUser?.name} (${currentUser?.role})`,
      senderRole: currentUser?.role,
      actionTab: "users",
      priority: "normal",
    });

    triggerAlert(`ปรับปรุงงานที่รับผิดชอบของ ${target.name} เรียบร้อยแล้ว`, "success");
  };

  // --- Auth Guard ---
  if (!currentUser) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f2f2f7] dark:bg-black">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      }>
        <LoginScreen
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          loginIdentifier={loginIdentifier}
          setLoginIdentifier={setLoginIdentifier}
          loginPassword={loginPassword}
          setLoginPassword={setLoginPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          loginError={loginError}
          setLoginError={setLoginError}
          handleLoginSubmit={handleLoginSubmit}
          systemUsers={systemUsers}
          onResetPassword={handleResetPassword}
        />
      </Suspense>
    );
  }

  // --- Render Navigation Helper ---
  const navItemClass = (tabName: string) => {
    const isActive = activeTab === tabName;
    const activeStyle = isDarkMode
      ? "bg-white text-black font-bold shadow-xs scale-[1.02]"
      : "bg-black text-white font-bold shadow-xs scale-[1.02]";
    const normalStyle = isDarkMode
      ? "text-neutral-400 hover:text-white hover:bg-white/6 font-medium"
      : "text-neutral-600 hover:text-black hover:bg-black/5 font-medium";
    return `flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-all duration-200 cursor-pointer ${
      isActive ? activeStyle : normalStyle
    }`;
  };

  const t = getTranslation(languageSetting);

  const getRoleText = (role: string) => {
    if (role === "Admin") return t.admin;
    if (role === "Manager") return t.manager;
    return t.employee;
  };

  const roleStyles = {
    bgActive: isDarkMode
      ? "bg-white/10 text-white font-bold"
      : "bg-black/8 text-black font-bold",
  };

  const navigationItems = [
    ...(currentUser.role === "Admin" || currentUser.tasks?.includes("ดูแดชบอร์ด")
      ? [
          {
            tab: "dashboard",
            label: t.navDashboard,
            icon: <LayoutDashboard className="h-4 w-4" />,
          },
        ]
      : []),
    ...(currentUser.role === "Admin" || currentUser.tasks?.includes("ดูรายงานยอดขาย")
      ? [
          {
            tab: "sales",
            label: t.navSales,
            icon: <ShoppingBag className="h-4 w-4" />,
            hasSub: true,
          },
        ]
      : []),


    ...(currentUser.role === "Admin" || (currentUser.role === "Manager" && currentUser.tasks?.includes("จัดการผู้ใช้งาน"))
      ? [
          {
            tab: "users",
            label: t.navUsers,
            icon: <Users className="h-4 w-4" />,
          },
        ]
      : []),
    {
      tab: "settings",
      label: t.navSettings,
      icon: <SettingsIcon className="h-4 w-4" />,
    },
  ];

  return (
    <div
      className={`flex flex-col h-screen ${
        isDarkMode ? "bg-black text-[#f5f5f7]" : "bg-white text-[#111827]"
      } overflow-hidden font-sans relative transition-colors duration-500`}
    >
      {/* Aurora Background Effects */}
      <div className="aurora-bg">
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
        <div className="aurora-blob aurora-3" />
        <div className="absolute w-72 h-72 rounded-full bg-blue-500/8 blur-3xl animate-float-slow top-1/4 left-1/3 pointer-events-none" />
        <div className="absolute w-96 h-96 rounded-full bg-purple-500/8 blur-3xl animate-float-slower bottom-1/3 right-1/4 pointer-events-none" />
      </div>

      {/* Alert Toast Notification */}
      {alertToast && (
        <div
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[80] bg-neutral-900/96 backdrop-blur-md border border-neutral-800 border-l-4 px-4 py-3 rounded-2xl flex items-center justify-between gap-4 shadow-2xl animate-slide-down w-[calc(100%-2rem)] max-w-sm"
          style={{
            borderLeftColor:
              alertToastType === "success"
                ? "#10b981"
                : alertToastType === "warning"
                  ? "#f59e0b"
                  : alertToastType === "error"
                    ? "#ef4444"
                    : "#3b82f6",
          }}
        >
          <div className="flex items-center gap-2.5">
            {alertToastType === "success" && (
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="h-3.5 w-3.5" />
              </div>
            )}
            {alertToastType === "warning" && (
              <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-3.5 w-3.5" />
              </div>
            )}
            {alertToastType === "error" && (
              <div className="h-7 w-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                <XCircle className="h-3.5 w-3.5" />
              </div>
            )}
            {alertToastType === "info" && (
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <Info className="h-3.5 w-3.5" />
              </div>
            )}
            <span className="text-xs font-bold text-white leading-snug">
              {alertToast}
            </span>
          </div>
          <button
            onClick={() => setAlertToast(null)}
            className="text-neutral-500 hover:text-white transition-colors cursor-pointer p-1 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Top Header Navigation */}
      <header
        className={`h-14 flex items-center justify-between px-4 md:px-5 sticky top-0 z-[60] select-none border-b transition-colors duration-500 glass-panel shrink-0 ${
          isDarkMode
            ? "bg-black/85 border-white/8"
            : "bg-white/90 border-black/6"
        }`}
      >
        <div className="flex items-center gap-3 md:gap-4 relative z-40 pointer-events-auto">
          <button
            type="button"
            title="กลับสู่หน้าแดชบอร์ด"
            onClick={(e) => {
              e.preventDefault();
              const handleNavigate = () => {
                try {
                  localStorage.setItem("activeTab", "dashboard");
                } catch (e) {
                  console.warn("Failed to set activeTab in localStorage:", e);
                }
                window.location.href = "/";
              };

              if (hasUnsavedChanges) {
                requestConfirm(
                  "มีข้อมูลที่ยังไม่ได้บันทึก",
                  "มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?",
                  handleNavigate,
                  "ออกจากหน้านี้",
                  "ยกเลิก",
                  "warning"
                );
              } else {
                handleNavigate();
              }
            }}
            className="flex items-center shrink-0 hover:opacity-80 active:scale-98 transition-all cursor-pointer focus:outline-none relative z-40 pointer-events-auto select-none no-underline py-0.5 border-none bg-transparent"
          >
            <img
              src="/logo.png"
              alt="Phanvadee Logo"
              className={`h-8.5 sm:h-10 md:h-11 max-h-11 max-w-[160px] sm:max-w-[220px] w-auto object-contain transition-all shrink-0 select-none ${
                isDarkMode ? "invert brightness-200" : ""
              }`}
            />
          </button>
          <div
            className={`h-5 sm:h-6 w-px hidden lg:block ${isDarkMode ? "bg-white/10" : "bg-black/10"}`}
          />

          <nav className="hidden lg:flex items-center gap-1">
            {/* Dashboard Link */}
            {(currentUser.role === "Admin" ||
              currentUser.tasks?.includes("ดูแดชบอร์ด")) && (
              <button
                onClick={() => {
                  setActiveTab("dashboard");
                  setActiveDropdown(null);
                  setIsProfileOpen(false);
                }}
                className={navItemClass("dashboard")}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>{t.navDashboard}</span>
              </button>
            )}

            {/* Sales Dropdown */}
            {(currentUser.role === "Admin" ||
              currentUser.tasks?.includes("ดูรายงานยอดขาย")) && (
              <div className="relative">
                <button
                  onClick={() => {
                    setActiveDropdown(
                      activeDropdown === "sales" ? null : "sales",
                    );
                    setIsProfileOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === "sales"
                      ? isDarkMode
                        ? "bg-white text-black font-bold shadow-xs"
                        : "bg-black text-white font-bold shadow-xs"
                      : isDarkMode
                        ? "text-neutral-400 hover:text-white hover:bg-white/6 font-medium"
                        : "text-neutral-600 hover:text-black hover:bg-black/5 font-medium"
                  }`}
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>
                    {activeTab === "sales"
                      ? salesSubTab === "income"
                        ? t.navSalesIncome
                        : salesSubTab === "products"
                          ? t.navSalesProducts
                          : salesSubTab === "brands"
                            ? t.navSalesBrands
                            : t.navSalesIncome
                      : t.navSales}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      activeDropdown === "sales" ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {activeDropdown === "sales" && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setActiveDropdown(null)}
                    />
                    <div
                      className={`absolute top-full left-0 mt-2 w-56 border rounded-2xl shadow-2xl z-50 p-2 space-y-0.5 animate-scale-in backdrop-blur-xl ${
                        isDarkMode
                          ? "bg-[#1a1a1a]/96 border-white/8"
                          : "bg-white/96 border-black/6"
                      }`}
                    >
                      {(
                        [
                          {
                            icon: Coins,
                            label: t.navSalesIncome,
                            sub: languageSetting === "en" ? "View imported revenue data" : "ดูข้อมูลจากรายการยอดขายที่นำเข้า",
                            subtab: "income",
                          },
                          {
                            icon: Package,
                            label: t.navSalesProducts,
                            sub: languageSetting === "en" ? "Inventory & product details" : "ดูข้อมูลสินค้าและสต็อกในคลัง",
                            subtab: "products",
                          },
                          {
                            icon: BarChart3,
                            label: t.navSalesBrands,
                            sub: languageSetting === "en" ? "Brand analytics & statistics" : "สถิติและรายงานสรุปตามแบรนด์",
                            subtab: "brands",
                          },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.subtab}
                          onClick={() => {
                            setActiveTab("sales");
                            setSalesSubTab(item.subtab);
                            setChannelFilter("All");
                            setActiveDropdown(null);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                            isDarkMode ? "hover:bg-white/6" : "hover:bg-black/4"
                          }`}
                        >
                          <div
                            className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isDarkMode
                                ? "bg-white/8 text-neutral-300"
                                : "bg-black/5 text-neutral-600"
                            }`}
                          >
                            <item.icon className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p
                              className={`text-xs font-bold ${isDarkMode ? "text-white" : "text-black"}`}
                            >
                              {item.label}
                            </p>
                            <p
                              className={`text-[10px] mt-0.5 ${isDarkMode ? "text-neutral-500" : "text-neutral-400"}`}
                            >
                              {item.sub}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}




            {/* Users Link (Admin/Manager only) */}
            {(currentUser.role === "Admin" ||
              (currentUser.role === "Manager" && currentUser.tasks?.includes("จัดการผู้ใช้งาน"))) && (
              <button
                onClick={() => {
                  setActiveTab("users");
                  setActiveDropdown(null);
                  setIsProfileOpen(false);
                }}
                className={navItemClass("users")}
              >
                <Users className="h-4 w-4" />
                <span>{t.navUsers}</span>
                {currentUser.role === "Admin" && adminUnreadCount > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse ml-1" />
                )}
              </button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Notification Center Bell Icon (For Manager, Employee & Admin) */}
          <div className="relative">
            <button
              onClick={() => {
                setIsNotificationOpen(!isNotificationOpen);
                setIsProfileOpen(false);
                setActiveDropdown(null);
              }}
              className={`relative p-2 rounded-lg transition-all cursor-pointer ${
                isDarkMode
                  ? "text-neutral-500 hover:text-white hover:bg-white/6"
                  : "text-neutral-400 hover:text-black hover:bg-black/5"
              }`}
              title={t.notifications}
            >
              <Bell className="h-4 w-4" />
              {userUnreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center animate-pulse shadow-xs">
                  {userUnreadCount > 99 ? "99+" : userUnreadCount}
                </span>
              )}
            </button>

            {isNotificationOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsNotificationOpen(false)}
                />
                <div
                  className={`absolute top-full right-[-45px] sm:right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-sm sm:max-w-md border rounded-2xl shadow-2xl z-50 p-3.5 animate-scale-in backdrop-blur-xl transition-all ${
                    isDarkMode
                      ? "bg-[#161618]/95 border-neutral-800 text-white shadow-black/80 ring-1 ring-white/5"
                      : "bg-white/95 border-neutral-200/90 text-neutral-900 shadow-neutral-900/10 ring-1 ring-black/5"
                  }`}
                >
                  {/* Popover Header */}
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-neutral-100 dark:border-neutral-800/70">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-1.5">
                        <Bell className="h-3.5 w-3.5 text-blue-500" />
                        <span>{t.notifications}</span>
                      </span>
                      {userUnreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-500/20">
                          {userUnreadCount} {t.newBadge}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      {(currentUser.role === "Admin" || currentUser.role === "Manager") && (
                        <button
                          onClick={() => {
                            setIsSendNotificationModalOpen(true);
                            setIsNotificationOpen(false);
                          }}
                          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Megaphone className="h-3 w-3" />
                          <span>{t.broadcast}</span>
                        </button>
                      )}

                      {userUnreadCount > 0 && (
                        <button
                          onClick={() => {
                            handleMarkAllNotificationsAsRead();
                          }}
                          className="text-[11px] font-medium text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer transition-colors"
                        >
                          {t.markAllRead}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filter Tabs (Segmented Control) */}
                  <div className="flex items-center gap-1 p-0.5 rounded-xl bg-neutral-200/50 dark:bg-neutral-800/60 mb-2.5 overflow-x-auto no-scrollbar">
                    {[
                      { id: "all", label: t.filterAll },
                      { id: "mine", label: t.filterMine },
                      { id: "activity", label: t.filterActivity },
                      { id: "system", label: t.filterSystem },
                    ].map((tab) => {
                      const isActive = headerNotificationFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setHeaderNotificationFilter(tab.id as typeof headerNotificationFilter)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] whitespace-nowrap transition-all duration-150 cursor-pointer ${
                            isActive
                              ? isDarkMode
                                ? "bg-neutral-900 text-white font-semibold shadow-xs"
                                : "bg-white text-neutral-900 font-semibold shadow-xs"
                              : isDarkMode
                                ? "text-neutral-400 hover:text-white font-medium"
                                : "text-neutral-600 hover:text-neutral-950 font-medium"
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Notification List */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5 custom-scrollbar">
                    {(() => {
                      const filteredNotifications = userNotifications.filter((notif) => {
                        if (headerNotificationFilter === "mine") {
                          return notif.targetUserId === currentUser.id || notif.type === "task";
                        }
                        if (headerNotificationFilter === "activity") {
                          return notif.type === "import" || notif.type === "activity" || notif.type === "order";
                        }
                        if (headerNotificationFilter === "system") {
                          return notif.type === "inventory" || notif.type === "system";
                        }
                        return true;
                      });

                      if (filteredNotifications.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <p className="text-xs text-neutral-400 font-medium">
                              {t.noNotificationsInCat}
                            </p>
                          </div>
                        );
                      }

                      return filteredNotifications.slice(0, 4).map((notif) => {
                        const isRead = notif.readBy.includes(currentUser.id);
                        const visualBadge = getNotificationVisualInfo(notif);
                        return (
                          <div
                            key={notif.id}
                            className={`p-3 rounded-xl text-xs transition-all border relative ${
                              isRead
                                ? isDarkMode
                                  ? "bg-neutral-900/30 hover:bg-neutral-900/60 border-neutral-800/60"
                                  : "bg-neutral-50/60 hover:bg-white border-neutral-200/60"
                                : isDarkMode
                                  ? "bg-[#1a1a1c] border-blue-500/30 shadow-xs ring-1 ring-blue-500/10"
                                  : "bg-white border-blue-500/25 shadow-xs ring-1 ring-blue-500/10"
                            }`}
                          >
                            {!isRead && (
                              <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-r-full" />
                            )}
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-md border uppercase tracking-wider ${visualBadge.badgeClass}`}
                                >
                                  {visualBadge.label}
                                </span>

                                {notif.priority === "urgent" && (
                                  <span className="px-1.5 py-0.5 text-[8px] font-semibold rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                    {t.urgentBadge}
                                  </span>
                                )}
                              </div>

                              <span className="text-[10px] text-neutral-400">
                                {notif.timestamp.split(" ")[1] || notif.timestamp}
                              </span>
                            </div>

                            <p
                              className={`font-semibold line-clamp-1 leading-snug ${
                                isRead ? "text-neutral-600 dark:text-neutral-400" : "text-neutral-900 dark:text-white"
                              }`}
                            >
                              {notif.title}
                            </p>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-0.5 leading-relaxed font-normal">
                              {notif.message}
                            </p>

                            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-neutral-100 dark:border-neutral-800/60">
                              <span className="text-[10px] text-neutral-400">
                                {t.fromSender}: <strong className="font-semibold text-neutral-600 dark:text-neutral-300">{notif.senderName}</strong>
                              </span>

                              <div className="flex items-center gap-2">
                                {notif.actionTab && (
                                  <button
                                    onClick={() => {
                                      handleMarkNotificationAsRead(notif.id);
                                      setActiveTab(notif.actionTab as typeof activeTab);
                                      setIsNotificationOpen(false);
                                    }}
                                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer group"
                                  >
                                    <span>{t.openThisPage}</span>
                                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                                  </button>
                                )}

                                {!isRead && (
                                  <button
                                    onClick={() => handleMarkNotificationAsRead(notif.id)}
                                    className="text-[10px] font-medium text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                                  >
                                    {t.markAsRead}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Popover Footer */}
                  <div className="pt-2.5 mt-2.5 border-t border-neutral-100 dark:border-neutral-800/70 flex items-center justify-between text-xs">
                    {currentUser.role === "Admin" && (
                      <button
                        onClick={() => {
                          setIsAuditLogsModalOpen(true);
                          setIsNotificationOpen(false);
                        }}
                        className="text-[11px] font-medium text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:underline cursor-pointer transition-colors"
                      >
                        Audit Logs ({auditLogs.length})
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsAllNotificationsModalOpen(true);
                        setIsNotificationOpen(false);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer ml-auto group"
                    >
                      <span>{t.viewAllNotifications} ({userNotifications.length})</span>
                      <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Trash & Recovery button */}
          {(currentUser.role === "Admin" || currentUser.role === "Manager") && (
            <button
              onClick={() => {
                setIsTrashModalOpen(true);
                setIsProfileOpen(false);
                setIsNotificationOpen(false);
              }}
              className={`relative p-2 rounded-lg transition-colors cursor-pointer text-sm hidden sm:block ${
                trashItems.length > 0
                  ? "text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  : isDarkMode
                    ? "text-neutral-500 hover:text-white hover:bg-white/6"
                    : "text-neutral-400 hover:text-black hover:bg-black/5"
              }`}
              title={`${t.trashRecovery} (${trashItems.length})`}
            >
              <Trash2 className="h-4 w-4" />
              {trashItems.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 bg-red-500 text-white font-black text-[9px] rounded-full flex items-center justify-center animate-pulse">
                  {trashItems.length}
                </span>
              )}
            </button>
          )}

          {/* Settings button */}
          <button
            onClick={() => {
              setActiveTab("settings");
              setIsProfileOpen(false);
              setIsNotificationOpen(false);
              setActiveDropdown(null);
            }}
            className={`p-2 rounded-lg transition-colors cursor-pointer text-sm hidden sm:block ${
              activeTab === "settings"
                ? isDarkMode
                  ? "text-white bg-white/10"
                  : "text-black bg-black/8"
                : isDarkMode
                  ? "text-neutral-500 hover:text-white hover:bg-white/6"
                  : "text-neutral-400 hover:text-black hover:bg-black/5"
            }`}
            title={t.navSettings}
          >
            <SettingsIcon className="h-4 w-4" />
          </button>

          {/* Theme switcher */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-lg transition-colors cursor-pointer text-sm hidden sm:block ${
              isDarkMode
                ? "text-neutral-500 hover:text-white hover:bg-white/6"
                : "text-neutral-400 hover:text-black hover:bg-black/5"
            }`}
          >
            {isDarkMode ? "☀️" : "🌙"}
          </button>
          <div
            className={`h-4 w-px mx-1 hidden lg:block ${isDarkMode ? "bg-white/10" : "bg-black/10"}`}
          />

          {/* User Profile dropdown */}
          <div className="relative flex">
            <button
              onClick={() => {
                setIsProfileOpen(!isProfileOpen);
                setIsNotificationOpen(false);
                setActiveDropdown(null);
              }}
              className={`flex items-center gap-1.5 px-1.5 py-1 rounded-lg transition-all cursor-pointer ${
                isDarkMode ? "hover:bg-white/6" : "hover:bg-black/4"
              }`}
            >
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  className="h-7 w-7 rounded-full object-cover border border-apple-primary/10 shrink-0"
                  alt="Avatar"
                />
              ) : (
                <div
                  className={`h-7 w-7 rounded-full font-black flex items-center justify-center text-xs ${
                    isDarkMode ? "bg-white text-black" : "bg-black text-white"
                  }`}
                >
                  {getInitials(currentUser.name)}
                </div>
              )}
              <div className="hidden lg:flex flex-col items-start">
                <span
                  className={`text-xs font-bold leading-tight ${isDarkMode ? "text-white" : "text-black"}`}
                >
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-neutral-400 leading-tight">
                  {getRoleText(currentUser.role)}
                </span>
              </div>
              <ChevronDown
                className={`h-3 w-3 text-neutral-400 transition-transform hidden lg:block ${
                  isProfileOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isProfileOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsProfileOpen(false)}
                />
                <div
                  className={`absolute top-full right-0 mt-2 w-48 border rounded-2xl shadow-2xl z-50 p-2.5 animate-scale-in backdrop-blur-xl ${
                    isDarkMode
                      ? "bg-[#1a1a1a]/96 border-white/8"
                      : "bg-white/96 border-black/6"
                  }`}
                >
                  <div className="px-2 pt-1 pb-3 border-b border-apple-primary">
                    <p
                      className={`text-xs font-bold ${isDarkMode ? "text-white" : "text-black"}`}
                    >
                      {currentUser.name}
                    </p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      {currentUser.email}
                    </p>
                    <div
                      className={`mt-2 inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-md ${
                        isDarkMode
                          ? "bg-white/8 text-neutral-400"
                          : "bg-black/5 text-neutral-500"
                      }`}
                    >
                      <Users className="h-2.5 w-2.5" />
                      <span>
                        {getRoleText(currentUser.role)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleBackupData}
                    className={`w-full flex items-center gap-2 px-2 py-2 mt-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      isDarkMode
                        ? "text-neutral-300 hover:bg-white/8 hover:text-white"
                        : "text-neutral-700 hover:bg-black/5 hover:text-black"
                    }`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{t.backupData}</span>
                  </button>

                  <label
                    className={`w-full flex items-center gap-2 px-2 py-2 mt-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      isDarkMode
                        ? "text-neutral-300 hover:bg-white/8 hover:text-white"
                        : "text-neutral-700 hover:bg-black/5 hover:text-black"
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{t.restoreData}</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleRestoreData}
                      className="hidden"
                    />
                  </label>

                  {(currentUser.role === "Admin" || currentUser.role === "Manager") && (
                    <button
                      onClick={() => {
                        setIsTrashModalOpen(true);
                        setIsProfileOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2 py-2 mt-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        isDarkMode
                          ? "text-rose-400 hover:bg-rose-500/10"
                          : "text-rose-600 hover:bg-rose-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{t.trashRecovery}</span>
                      </div>
                      {trashItems.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black">
                          {trashItems.length}
                        </span>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setCurrentUser(null);
                      setIsProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-2 mt-1.5 text-red-500 hover:bg-red-500/8 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>{t.logout}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mobile menu trigger */}
          <button
            onClick={() => {
              setIsMobileMenuOpen(!isMobileMenuOpen);
              setIsProfileOpen(false);
              setIsNotificationOpen(false);
              setActiveDropdown(null);
            }}
            className={`lg:hidden p-2 rounded-lg transition-colors cursor-pointer ${
              isDarkMode
                ? "text-neutral-400 hover:text-white hover:bg-white/6"
                : "text-neutral-500 hover:text-black hover:bg-black/5"
            }`}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile navigation menu overlay */}
      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-20 lg:hidden bg-black/15 transition-all duration-300 animate-fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div
            className={`fixed top-15 right-4 left-4 sm:max-w-md sm:mx-auto z-50 lg:hidden border rounded-2xl shadow-2xl animate-menu-slide-down max-h-[calc(100vh-5rem)] overflow-y-auto ${
              isDarkMode
                ? "bg-[#141414]/98 border-neutral-800 text-white"
                : "bg-white/98 border-neutral-200 text-black"
            }`}
          >
            <div className="p-4 space-y-1">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (activeTab === "dashboard" || activeTab === "calculator") {
                      setActiveTab("sales");
                      setSalesSubTab("income");
                      setChannelFilter("All");
                    }
                  }}
                  placeholder={t.searchPlaceholder}
                  className={`w-full rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none border transition-all ${
                    isDarkMode
                      ? "bg-white/6 border-white/8 text-white placeholder-neutral-600 focus:bg-white/10 focus:border-white/20"
                      : "bg-black/5 border-black/6 text-black placeholder-neutral-400 focus:bg-white focus:border-black/15"
                  }`}
                />
              </div>

              <div className="space-y-1">
                {navigationItems.map((item) => (
                  <div key={item.tab}>
                    <button
                      onClick={() => {
                        if (item.tab === "calculator") {
                          setActiveTab("dashboard");
                          setIsMobileMenuOpen(false);
                          setTimeout(() => {
                            document.getElementById("monthly-calculator-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }, 100);
                          return;
                        }
                        setActiveTab(item.tab as typeof activeTab);
                        if (item.tab === "sales") {
                          setSalesSubTab("income");
                          setChannelFilter("All");
                        }
                        if (!item.hasSub) {
                          setIsMobileMenuOpen(false);
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                        activeTab === item.tab
                          ? isDarkMode
                            ? "bg-white text-black font-bold shadow-sm"
                            : "bg-black text-white font-bold shadow-sm"
                          : isDarkMode
                            ? "text-neutral-400 hover:text-white hover:bg-white/6"
                            : "text-neutral-500 hover:text-black hover:bg-black/5"
                      }`}
                    >
                      {item.icon}
                      <span>
                        {item.tab === "sales" && activeTab === "sales"
                          ? salesSubTab === "income"
                            ? t.navSalesIncome
                            : salesSubTab === "products"
                              ? t.navSalesProducts
                              : salesSubTab === "brands"
                                ? t.navSalesBrands
                                : t.navSalesIncome
                          : item.label}
                      </span>
                      {item.hasSub && (
                        <ChevronDown
                          className={`h-3.5 w-3.5 ml-auto transition-transform ${
                            activeTab === "sales" ? "rotate-180" : ""
                          }`}
                        />
                      )}
                    </button>

                    {item.hasSub && activeTab === "sales" && (
                      <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-neutral-700/10 pl-2">
                        {(
                          [
                            {
                              label: t.navSalesIncome,
                              subtab: "income",
                            },
                            {
                              label: t.navSalesProducts,
                              subtab: "products",
                            },
                            { label: t.navSalesBrands, subtab: "brands" },
                          ] as const
                        ).map((subItem) => (
                          <button
                            key={subItem.subtab}
                            onClick={() => {
                              setSalesSubTab(subItem.subtab);
                              setChannelFilter("All");
                              setIsMobileMenuOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 rounded-xl text-sm transition-all cursor-pointer ${
                              salesSubTab === subItem.subtab
                                ? isDarkMode
                                  ? "text-white font-bold bg-white/8"
                                  : "text-black font-bold bg-black/6"
                                : isDarkMode
                                  ? "text-neutral-500 hover:text-white hover:bg-white/4"
                                  : "text-neutral-400 hover:text-black hover:bg-black/3"
                            }`}
                          >
                            {subItem.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div
                className={`mt-3 pt-3 border-t ${isDarkMode ? "border-white/8" : "border-black/6"}`}
              >
                <div className="flex items-center gap-3 px-4 py-2 mb-2 bg-neutral-500/5 rounded-2xl">
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      className="h-8 w-8 rounded-full object-cover border border-apple-primary/10 shrink-0"
                      alt="Avatar"
                    />
                  ) : (
                    <div
                      className={`h-8 w-8 rounded-full font-black flex items-center justify-center text-xs shrink-0 ${
                        isDarkMode ? "bg-white text-black" : "bg-black text-white"
                      }`}
                    >
                      {getInitials(currentUser.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-bold truncate ${isDarkMode ? "text-white" : "text-black"}`}
                    >
                      {currentUser.name}
                    </p>
                    <p className="text-xs text-neutral-400 truncate">
                      {getRoleText(currentUser.role)}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all ${
                      isDarkMode
                        ? "bg-white/10 text-yellow-400"
                        : "bg-black/5 text-gray-600"
                    }`}
                  >
                    {isDarkMode ? "☀️" : "🌙"}
                  </button>
                </div>

                <div className="flex gap-2 mb-2 px-1">
                  <button
                    onClick={() => {
                      handleBackupData();
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      isDarkMode
                        ? "bg-white/5 border-white/8 text-white hover:bg-white/10"
                        : "bg-black/5 border-black/6 text-black hover:bg-black/8"
                    }`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{t.backupData}</span>
                  </button>
                  <label
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      isDarkMode
                        ? "bg-white/5 border-white/8 text-white hover:bg-white/10"
                        : "bg-black/5 border-black/6 text-black hover:bg-black/8"
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{t.restoreData}</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        handleRestoreData(e);
                        setIsMobileMenuOpen(false);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <button
                  onClick={() => {
                    setCurrentUser(null);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-red-500 hover:bg-red-500/8 rounded-xl text-sm font-bold transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t.logout}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main View Area */}
      <main className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden overflow-y-auto relative transition-colors duration-500 bg-apple-primary text-apple-primary touch-scroll pb-24 lg:pb-6">
        {/* Original Website Tabs Rendered inside default padding container */}
        <div className={`space-y-4 md:space-y-6 flex-1 relative z-10 w-full max-w-full min-w-0 ${activeTab === "import-orders" ? "p-3 sm:p-4 md:p-6 w-full max-w-full px-3 sm:px-6 md:px-8" : "p-3 sm:p-4 md:p-6"}`}>
          {!isInitialLoadComplete ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <p className="text-xs text-apple-secondary animate-pulse">กำลังโหลดข้อมูลระบบ...</p>
            </div>
          ) : (
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            }>
            {currentUser.role !== "Admin" && (!currentUser.tasks || currentUser.tasks.length === 0) && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center p-6 space-y-3 glass-card rounded-3xl border border-apple-primary bg-apple-secondary animate-fade-in">
                <Lock className="h-10 w-10 text-rose-500/80 animate-pulse" />
                <h3 className="font-extrabold text-base text-apple-primary">ยังไม่ได้รับสิทธิ์การใช้งาน</h3>
                <p className="text-xs text-apple-secondary max-w-xs leading-relaxed">บัญชีนี้ยังไม่มีสิทธิ์เข้าถึงฟีเจอร์ใด ๆ กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อทำการเปิดสิทธิ์สวิตช์การทำงาน</p>
              </div>
            )}

            {activeTab === "dashboard" && (currentUser.role === "Admin" || currentUser.tasks?.includes("ดูแดชบอร์ด")) && (
              <ErrorBoundary>
                <DashboardTab
                  isDarkMode={isDarkMode}
                  orders={orders}
                  products={products}
                  productFiles={productFiles}
                  uploadedDatasets={uploadedDatasets}
                  formatCurrency={formatCurrency}
                  setActiveTab={setActiveTab}
                  setSalesSubTab={setSalesSubTab}
                  onChannelClick={handleDashboardChannelClick}
                />
              </ErrorBoundary>
            )}

            {activeTab === "sales" && (currentUser.role === "Admin" || currentUser.tasks?.includes("ดูรายงานยอดขาย")) && (
              <ErrorBoundary>
                <SalesTab
                  isDarkMode={isDarkMode}
                  currentUser={currentUser}
                  salesSubTab={salesSubTab}
                  setSalesSubTab={setSalesSubTab}
                  products={products}
                  orders={orders}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  channelFilter={channelFilter}
                  setChannelFilter={setChannelFilter}
                  setIsAddProductOpen={setIsAddProductOpen}
                  setIsAddOrderOpen={setIsAddOrderOpen}
                  setIsEditOrderOpen={setIsEditOrderOpen}
                  setEditingOrder={setEditingOrder}
                  handleDeleteOrder={handleDeleteOrder}
                  handleDeleteAllOrders={handleDeleteAllOrders}
                  handleDeleteAllIncome={handleDeleteAllIncome}
                  requestConfirm={requestConfirm}
                  formatCurrency={formatCurrency}
                  triggerAlert={triggerAlert}
                  roleStyles={roleStyles}
                  setEditingProduct={setEditingProduct}
                  setIsEditProductOpen={setIsEditProductOpen}
                  handleDeleteProduct={handleDeleteProduct}
                  handleDeleteAllProducts={handleDeleteAllProducts}
                  uploadedDatasets={uploadedDatasets}
                  productFiles={productFiles}
                  onDeleteDataset={handleDeleteDataset}
                  onImportOrders={handleImportOrders}
                  setActiveTab={setActiveTab}
                  onOpenImportModal={handleOpenImportModal}
                  onOpenAddProductImport={handleOpenAddProductImport}
                />
              </ErrorBoundary>
            )}

            {activeTab === "calculator" && (currentUser.role === "Admin" || currentUser.tasks?.includes("เครื่องคำนวณส่วนต่าง")) && (
              <ErrorBoundary>
                <CalculatorTab
                  isDarkMode={isDarkMode}
                  orders={orders}
                  products={products}
                  productFiles={productFiles}
                  uploadedDatasets={uploadedDatasets}
                  formatCurrency={formatCurrency}
                />
              </ErrorBoundary>
            )}

            {activeTab === "users" && (currentUser.role === "Admin" || (currentUser.role === "Manager" && currentUser.tasks?.includes("จัดการผู้ใช้งาน"))) && (
              <ErrorBoundary>
                <UsersTab
                  isDarkMode={isDarkMode}
                  currentUser={currentUser}
                  systemUsers={systemUsers}
                  searchQuery={searchQuery}
                  setIsAddUserOpen={setIsAddUserOpen}
                  handleDeleteUser={handleDeleteUser}
                  toggleUserStatus={handleToggleUserStatus}
                  requestConfirm={requestConfirm}
                  handleUpdateUserTasks={handleUpdateUserTasks}
                  onDirtyChange={handleUserTasksDirtyChange}
                />
              </ErrorBoundary>
            )}

            {activeTab === "import-orders" && (currentUser.role === "Admin" || currentUser.role === "Manager" || currentUser.tasks?.includes("นำเข้าข้อมูล Excel")) && (
              <ErrorBoundary>
                <ImportOrdersTab
                  isModal={false}
                  isOpen={true}
                  isDarkMode={isDarkMode}
                  products={products}
                  onImportProducts={handleCreateProducts}
                  productFiles={productFiles}
                  uploadedDatasets={uploadedDatasets}
                  onDeleteDataset={handleDeleteDataset}
                  requestConfirm={requestConfirm}
                  onImportProductFiles={handleImportProductFiles}
                  triggerAlert={triggerAlert}
                  setActiveTab={setActiveTab}
                  onImportOrders={handleImportOrders}
                  mode={importModalMode || (salesSubTab === "income" ? "income" : salesSubTab === "orders" ? "orders" : "all")}
                />
              </ErrorBoundary>
            )}

            {activeTab === "settings" && currentUser && (
              <ErrorBoundary>
                <SettingsTab
                  isDarkMode={isDarkMode}
                  setIsDarkMode={setIsDarkMode}
                  currentUser={currentUser}
                  onSaveAccount={handleUpdateAccountSettings}
                  fontSetting={fontSetting}
                  setFontSetting={setFontSetting}
                  currencySetting={currencySetting}
                  setCurrencySetting={setCurrencySetting}
                  calendarSetting={calendarSetting}
                  setCalendarSetting={setCalendarSetting}
                  notificationsSetting={notificationsSetting}
                  setNotificationsSetting={setNotificationsSetting}
                  triggerAlert={triggerAlert}
                  languageSetting={languageSetting}
                  setLanguageSetting={setLanguageSetting}
                  onDirtyChange={handleSettingsDirtyChange}
                />
              </ErrorBoundary>
            )}
          </Suspense>
          )}
        </div>
      </main>

      {/* Mobile & Tablet Bottom Navigation Dock (<= 1024px) */}
      <nav className="mobile-bottom-nav lg:hidden">
        {(currentUser.role === "Admin" || currentUser.tasks?.includes("ดูแดชบอร์ด")) && (
          <button
            onClick={() => {
              setActiveTab("dashboard");
              setIsMobileMenuOpen(false);
            }}
            className={`mobile-bottom-nav-item ${activeTab === "dashboard" ? "active" : "text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"}`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-[10px]">แดชบอร์ด</span>
          </button>
        )}

        {(currentUser.role === "Admin" || currentUser.tasks?.includes("ดูรายงานยอดขาย")) && (
          <button
            onClick={() => {
              setActiveTab("sales");
              if (activeTab !== "sales") {
                setSalesSubTab("income");
                setChannelFilter("All");
              }
              setIsMobileMenuOpen(false);
            }}
            className={`mobile-bottom-nav-item ${activeTab === "sales" ? "active" : "text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"}`}
          >
            <ShoppingBag className="h-5 w-5" />
            <span className="text-[10px]">ยอดขาย</span>
          </button>
        )}




        {(currentUser.role === "Admin" || (currentUser.role === "Manager" && currentUser.tasks?.includes("จัดการผู้ใช้งาน"))) && (
          <button
            onClick={() => {
              setActiveTab("users");
              setIsMobileMenuOpen(false);
            }}
            className={`mobile-bottom-nav-item ${activeTab === "users" ? "active" : "text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"}`}
          >
            <Users className="h-5 w-5" />
            <span className="text-[10px]">ผู้ใช้</span>
            {currentUser.role === "Admin" && adminUnreadCount > 0 && (
              <span className="absolute top-1 right-2.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        )}

        <button
          onClick={() => {
            setIsMobileMenuOpen(!isMobileMenuOpen);
            setIsProfileOpen(false);
            setIsNotificationOpen(false);
          }}
          className={`mobile-bottom-nav-item ${isMobileMenuOpen ? "active" : "text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"}`}
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px]">เมนู</span>
        </button>
      </nav>


      {/* Global Modals Portal Container */}
      {isAddProductOpen && (
        <AddProductModal
          isOpen={isAddProductOpen}
          onClose={() => {
            setIsAddProductOpen(false);
            setAddProductInitialTab("manual");
            updateDirtyState("addProduct", false);
          }}
          onSubmit={handleCreateProducts}
          isDarkMode={isDarkMode}
          onDirtyChange={(isDirty) => updateDirtyState("addProduct", isDirty)}
          initialTab={addProductInitialTab}
          productFiles={productFiles}
          onImportProductFiles={handleImportProductFiles}
        />
      )}
      {isAddOrderOpen && (
        <AddOrderModal
          isOpen={isAddOrderOpen}
          onClose={() => {
            setIsAddOrderOpen(false);
            updateDirtyState("addOrder", false);
          }}
          products={products}
          onSubmit={handleCreateOrder}
          isDarkMode={isDarkMode}
          onDirtyChange={(isDirty) => updateDirtyState("addOrder", isDirty)}
        />
      )}
      {isEditOrderOpen && (
        <EditOrderModal
          isOpen={isEditOrderOpen}
          onClose={() => {
            setIsEditOrderOpen(false);
            setEditingOrder(null);
            updateDirtyState("editOrder", false);
          }}
          editingOrder={editingOrder}
          products={products}
          onSubmit={handleEditOrderSubmit}
          isDarkMode={isDarkMode}
          onDirtyChange={(isDirty) => updateDirtyState("editOrder", isDirty)}
        />
      )}
      {isEditProductOpen && (
        <EditProductModal
          isOpen={isEditProductOpen}
          onClose={() => {
            setIsEditProductOpen(false);
            setEditingProduct(null);
            updateDirtyState("editProduct", false);
          }}
          editingProduct={editingProduct}
          onSubmit={handleEditProductSubmit}
          isDarkMode={isDarkMode}
          onDirtyChange={(isDirty) => updateDirtyState("editProduct", isDirty)}
        />
      )}
      {isAddUserOpen && (
        <AddUserModal
          isOpen={isAddUserOpen}
          onClose={() => {
            setIsAddUserOpen(false);
            updateDirtyState("addUser", false);
          }}
          currentUser={currentUser}
          onSubmit={handleCreateUser}
          isDarkMode={isDarkMode}
          onDirtyChange={(isDirty) => updateDirtyState("addUser", isDirty)}
        />
      )}
      {isConfirmModalOpen && (
        <ConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => {
            setIsConfirmModalOpen(false);
            setConfirmModalConfig(null);
          }}
          config={confirmModalConfig}
          isDarkMode={isDarkMode}
          currentUser={currentUser}
        />
      )}
      {isAuditLogsModalOpen && (
        <AuditLogsModal
          isOpen={isAuditLogsModalOpen}
          onClose={() => setIsAuditLogsModalOpen(false)}
          auditLogs={auditLogs}
          setAuditLogs={setAuditLogs}
          requestConfirm={requestConfirm}
          formatCurrency={formatCurrency}
          currentUser={currentUser}
        />
      )}
      {isSendNotificationModalOpen && (
        <SendNotificationModal
          isOpen={isSendNotificationModalOpen}
          onClose={() => setIsSendNotificationModalOpen(false)}
          currentUser={currentUser}
          systemUsers={systemUsers}
          onSend={(newNotif) => {
            sendNotification(newNotif);
            triggerAlert("ส่งการแจ้งเตือนเรียบร้อยแล้ว", "success");
          }}
          isDarkMode={isDarkMode}
        />
      )}
      {isAllNotificationsModalOpen && (
        <AllNotificationsModal
          isOpen={isAllNotificationsModalOpen}
          onClose={() => setIsAllNotificationsModalOpen(false)}
          notifications={notifications}
          currentUser={currentUser}
          onMarkAsRead={handleMarkNotificationAsRead}
          onMarkAllAsRead={handleMarkAllNotificationsAsRead}
          onDeleteNotification={handleDeleteNotification}
          onClearAll={handleClearAllNotifications}
          onNavigate={(tab) => {
            setActiveTab(tab as typeof activeTab);
          }}
          isDarkMode={isDarkMode}
          onOpenSendModal={() => {
            setIsAllNotificationsModalOpen(false);
            setIsSendNotificationModalOpen(true);
          }}
        />
      )}
      {isTrashModalOpen && (
        <TrashRecoveryModal
          isOpen={isTrashModalOpen}
          onClose={() => setIsTrashModalOpen(false)}
          trashItems={trashItems}
          onRestore={handleRestoreTrashItem}
          onDeletePermanently={handleDeleteTrashItemPermanently}
          onEmptyTrash={handleEmptyTrash}
          isDarkMode={isDarkMode}
          currentUser={currentUser}
          formatCurrency={formatCurrency}
        />
      )}
      {isImportModalOpen && (
        <Suspense fallback={null}>
          <ImportOrdersTab
            isModal={true}
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            isDarkMode={isDarkMode}
            products={products}
            onImportProducts={handleCreateProducts}
            productFiles={productFiles}
            uploadedDatasets={uploadedDatasets}
            onDeleteDataset={handleDeleteDataset}
            requestConfirm={requestConfirm}
            onImportProductFiles={handleImportProductFiles}
            triggerAlert={triggerAlert}
            setActiveTab={setActiveTab}
            onImportOrders={handleImportOrders}
            mode={importModalMode}
          />
        </Suspense>
      )}
      {showConfetti && (
        <ConfettiEffect onComplete={() => setShowConfetti(false)} />
      )}
    </div>
  );
}
