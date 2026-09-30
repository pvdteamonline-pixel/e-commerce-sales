import React, { useMemo, useState } from "react";
import {
  Trash2,
  Plus,
  Edit,
  Lock,
  Download,
  Upload,
  Calendar,
  ShoppingCart,
  TrendingUp,
  Package,
  Info,
  ChevronLeft,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  DollarSign,
  Layers,
  Boxes,
  Tag,
  RotateCcw,
  Sparkles,
  Store,
  Zap,
  Coins,
  ArrowUpDown,
  Clock,
} from "lucide-react";
import * as XLSX from "xlsx";

import type { Order, Product, AppUser, UploadedDataset } from "../types";
import { ExcelTable } from "./ExcelTable";
import { DatasetViewer } from "./DatasetViewer";
import { DatePickerField } from "./DatePickerField";
import { resolveBrandName, extractOrdersFromDatasets, parseAndNormalizeDate, parseOrderStatus } from "../utils";
import { sanitizeCellForExport } from "../utils/security";

// Robust Date parser for chronological sorting
const parseFlexibleDate = (val: unknown): number | null => {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.getTime();
  if (typeof val === "number") {
    if (val > 30000 && val < 60000) {
      const ms = (val - 25569) * 86400 * 1000;
      return isNaN(ms) ? null : ms;
    }
    return isNaN(val) ? null : val;
  }
  const str = String(val).trim();
  if (!str || str === "—" || str === "-") return null;

  const dmyMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    if (year > 2400) year -= 543;
    const d = new Date(year, month, day, hour, minute, second);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  const ymdMatch = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    let year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minute = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const second = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;

    if (year > 2400) year -= 543;
    const d = new Date(year, month, day, hour, minute, second);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return parsed;

  return null;
};

const getDatasetPeriodLabel = (d: UploadedDataset): string | null => {
  if (!d || !d.sheets) return null;
  const thaiMonths = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  
  for (const sheet of d.sheets) {
    if (!sheet.rows || sheet.rows.length === 0) continue;
    const headers = sheet.headers || (sheet.rows[0] ? Object.keys(sheet.rows[0]) : []);
    const dateHeaders = headers.filter((h) => {
      const hl = String(h).toLowerCase();
      return hl.includes("date") || hl.includes("วันที่") || hl.includes("เวลา") || hl.includes("time") || hl.includes("รอบบิล") || hl.includes("สร้าง");
    });
    if (dateHeaders.length === 0) continue;

    const dates: string[] = [];
    const sampleLimit = Math.min(sheet.rows.length, 150);
    for (let i = 0; i < sampleLimit; i++) {
      const row = sheet.rows[i];
      if (!row) continue;
      for (const dh of dateHeaders) {
        const val = row[dh];
        if (val !== undefined && val !== null && val !== "") {
          const norm = parseAndNormalizeDate(val);
          if (norm && /^\d{4}-\d{2}-\d{2}$/.test(norm)) {
            dates.push(norm);
            break;
          }
        }
      }
      if (dates.length >= 30) break;
    }

    if (dates.length > 0) {
      dates.sort();
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];
      const minYear = minDate.substring(0, 4);
      const minMonth = parseInt(minDate.substring(5, 7), 10);
      const maxYear = maxDate.substring(0, 4);
      const maxMonth = parseInt(maxDate.substring(5, 7), 10);

      if (minYear === maxYear && minMonth === maxMonth) {
        const thYear = parseInt(minYear, 10) + 543;
        return `${thaiMonths[minMonth]} ${thYear}`;
      } else {
        const thYearMin = parseInt(minYear, 10) + 543;
        const thYearMax = parseInt(maxYear, 10) + 543;
        return `${thaiMonths[minMonth]} ${thYearMin} - ${thaiMonths[maxMonth]} ${thYearMax}`;
      }
    }
  }
  return null;
};

interface SalesTabProps {
  isDarkMode: boolean;
  currentUser: AppUser;
  salesSubTab: "income" | "products" | "orders" | "brands";
  setSalesSubTab: (
    val: "income" | "products" | "orders" | "brands",
  ) => void;
  products: Product[];
  orders: Order[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  channelFilter: string;
  setChannelFilter: (val: string) => void;
  setIsAddOrderOpen?: (val: boolean) => void;
  setIsAddProductOpen?: (val: boolean) => void;
  setEditingOrder?: (val: Order | null) => void;
  setIsEditOrderOpen?: (val: boolean) => void;
  handleDeleteAllOrders?: () => void;
  handleDeleteAllIncome?: () => void;
  handleDeleteOrder?: (id: string) => void;
  requestConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText?: string,
    cancelText?: string,
    type?: "danger" | "warning" | "info" | "trash",
  ) => void;
  formatCurrency: (val: number) => string;
  triggerAlert: (
    msg: string,
    type?: "success" | "warning" | "info" | "error",
  ) => void;
  roleStyles: { bgActive: string };
  setEditingProduct?: (p: Product | null) => void;
  setIsEditProductOpen?: (val: boolean) => void;
  handleDeleteProduct?: (id: string) => void;
  handleDeleteAllProducts?: () => void;
  setActiveTab?: (
    tab: "dashboard" | "sales" | "calculator" | "import-orders" | "users",
  ) => void;
  uploadedDatasets?: UploadedDataset[];
  productFiles?: UploadedDataset[];
  onDeleteDataset?: (id: string) => void;
  onImportOrders?: (orders: Order[], datasets: UploadedDataset[]) => void;
  onOpenImportModal?: (mode: "orders" | "income" | "all") => void;
  onOpenAddProductImport?: () => void;
}

interface ProductDetailsViewProps {
  product: {
    id?: string;
    name: string;
    brand: string;
    category: string;
    price: number;
    sales: number;
    revenue: number;
    stock: number;
    status: Product["status"];
  };
  orders: Order[];
  formatCurrency: (val: number) => string;
  isDarkMode: boolean;
  currentUser: AppUser;
  setEditingProduct?: (p: Product | null) => void;
  setIsEditProductOpen?: (val: boolean) => void;
  handleDeleteProduct?: (id: string) => void;
  requestConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
  ) => void;
}

const ProductDetailsView: React.FC<ProductDetailsViewProps> = ({
  product,
  orders,
  formatCurrency,
  isDarkMode,
  currentUser,
  setEditingProduct,
  setIsEditProductOpen,
  handleDeleteProduct,
  requestConfirm,
}) => {
  const productOrders = useMemo(() => {
    return orders.filter((o) => {
      const oName = (o.productName || o.itemName || "สินค้าทั่วไป").trim().toLowerCase();
      return oName === product.name.toLowerCase();
    });
  }, [product, orders]);

  const totalUnits = useMemo(() => {
    return productOrders.reduce(
      (sum, o) => (o.status !== "Refunded" ? sum + (o.quantity || 1) : sum),
      0,
    );
  }, [productOrders]);

  const totalRev = useMemo(() => {
    return productOrders.reduce(
      (sum, o) => (o.status !== "Refunded" ? sum + Number(o.total || 0) : sum),
      0,
    );
  }, [productOrders]);

  const stockBadge = (stock: number) => {
    if (stock === 0)
      return isDarkMode
        ? "bg-rose-950/30 text-rose-400 border-rose-900/30"
        : "bg-rose-50 text-rose-700 border-rose-100";
    if (stock <= 10)
      return isDarkMode
        ? "bg-amber-950/30 text-amber-400 border-amber-900/30"
        : "bg-amber-50 text-amber-700 border-amber-100";
    return isDarkMode
      ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/30"
      : "bg-emerald-50 text-emerald-700 border-emerald-100";
  };

  const stockLabel = (stock: number) => {
    if (stock === 0) return "หมดคลัง";
    if (stock <= 10) return `ใกล้หมด: ${stock} ชิ้น`;
    return `พร้อมขาย: ${stock} ชิ้น`;
  };

  return (
    <div
      className={`p-6 rounded-2xl border flex flex-col gap-6 ${
        isDarkMode ? "bg-neutral-900/60 border-neutral-800" : "bg-white/80 border-neutral-200/80"
      } backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.02)]`}
    >
      {/* Product Title / Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-neutral-200/70 dark:border-neutral-800 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-lg font-medium border ${
                isDarkMode
                  ? "bg-white/5 border-white/8 text-neutral-400"
                  : "bg-black/4 border-black/6 text-neutral-500"
              }`}
            >
              {product.category}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-lg font-medium border ${stockBadge(product.stock)}`}
            >
              {stockLabel(product.stock)}
            </span>
          </div>
          <h3 className="font-bold text-neutral-900 dark:text-white text-base md:text-lg mt-1.5">
            {product.name}
          </h3>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
            แบรนด์: {product.brand || "ทั่วไป"}
          </p>
        </div>

        {product.id && (
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={() => {
                const originalProduct: Product = {
                  id: product.id!,
                  name: product.name,
                  category: product.category as Product["category"],
                  brand: product.brand,
                  price: product.price,
                  stock: product.stock,
                  sales: product.sales,
                  revenue: product.revenue,
                  status: product.status,
                };
                setEditingProduct?.(originalProduct);
                setIsEditProductOpen?.(true);
              }}
              className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200/70 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-medium rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Edit className="h-3.5 w-3.5 text-neutral-500" />
              <span>แก้ไขสินค้า</span>
            </button>
            {(currentUser.role === "Admin" ||
              currentUser.role === "Manager") && (
              <button
                onClick={() =>
                  requestConfirm?.("ยืนยันการลบสินค้า",
                    `ลบรายการสินค้า "${product.name}" หรือไม่? ข้อมูลสต็อกสินค้าชิ้นนี้จะหายไปจากระบบ`,
                    () => handleDeleteProduct?.(product.id!),
                  )
                }
                className="px-3 py-1.5 bg-transparent hover:bg-rose-50 dark:hover:bg-rose-950/30 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium rounded-xl border border-transparent hover:border-rose-500/20 flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>ลบสินค้า</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "ราคาจำหน่าย",
            value: product.price > 0 ? formatCurrency(product.price) : "—",
            icon: <Info className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />,
          },
          {
            label: "คงเหลือในคลัง",
            value: `${product.stock} ชิ้น`,
            icon: <Package className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />,
          },
          {
            label: "จำหน่ายแล้ว",
            value: `${totalUnits} ชิ้น`,
            icon: <ShoppingCart className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />,
          },
          {
            label: "รายได้รวมสะสม",
            value: formatCurrency(totalRev),
            icon: <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
          },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-xl border ${
              isDarkMode ? "bg-neutral-850/50 border-neutral-800" : "bg-neutral-50/70 border-neutral-200/70"
            } flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
              <span className="text-xs font-medium">
                {kpi.label}
              </span>
              {kpi.icon}
            </div>
            <p className="text-lg font-mono font-bold text-neutral-900 dark:text-neutral-100 tracking-tight mt-1">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Transactions List */}
      <div className="space-y-3 mt-2">
        <div>
          <h4 className="text-xs font-black uppercase text-apple-primary tracking-wider mb-0.5">
            รายการประวัติยอดขายสินค้าชิ้นนี้ (คำสั่งซื้อล่าสุด)
          </h4>
          <p className="text-[10px] text-apple-secondary">
            แสดงประวัติคำสั่งซื้อทั้งหมดของสินค้าชิ้นนี้ที่มีการบันทึกในระบบ
          </p>
        </div>

        <div className="border border-apple-primary/10 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs borderless-table">
            <thead>
              <tr
                className={`border-b ${isDarkMode ? "border-white/6 bg-white/3" : "border-black/5 bg-black/2"}`}
              >
                <th className="px-4 py-2.5 font-bold text-apple-secondary text-[10px] uppercase tracking-wider">
                  รหัสออเดอร์
                </th>
                <th className="px-4 py-2.5 font-bold text-apple-secondary text-[10px] uppercase tracking-wider">
                  วันที่สั่ง
                </th>
                <th className="px-4 py-2.5 font-bold text-apple-secondary text-[10px] uppercase tracking-wider">
                  ชื่อลูกค้า
                </th>
                <th className="px-4 py-2.5 font-bold text-apple-secondary text-[10px] uppercase tracking-wider">
                  ช่องทาง
                </th>
                <th
                  className="px-4 py-2.5 font-bold text-apple-secondary text-[10px] uppercase tracking-wider"
                  style={{ textAlign: "center" }}
                >
                  จำนวน
                </th>
                <th
                  className="px-4 py-2.5 font-bold text-apple-secondary text-[10px] uppercase tracking-wider"
                  style={{ textAlign: "right" }}
                >
                  ยอดชำระ
                </th>
                <th className="px-4 py-2.5 font-bold text-apple-secondary text-[10px] uppercase tracking-wider">
                  สถานะ
                </th>
              </tr>
            </thead>
            <tbody className="no-dividers">
              {productOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center font-bold text-apple-tertiary"
                  >
                    ยังไม่มีประวัติการขายสินค้ารายการนี้
                  </td>
                </tr>
              ) : (
                productOrders.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-apple-tertiary transition-colors"
                  >
                    <td className="px-4 py-2 font-mono text-[10px] text-apple-secondary">
                      {o.id.replace(/-row-.*$/, "")}
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-apple-secondary">
                      {o.date}
                    </td>
                    <td className="px-4 py-2 font-bold text-apple-primary">
                      {o.customerName}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 text-[9px] font-bold rounded-lg border ${
                          isDarkMode
                            ? "bg-white/5 border-white/8 text-neutral-300"
                            : "bg-black/4 border-black/6 text-neutral-600"
                        }`}
                      >
                        {o.channel}
                      </span>
                    </td>
                    <td
                      className="px-4 py-2 font-bold text-apple-secondary"
                      style={{ textAlign: "center" }}
                    >
                      {o.quantity || 1} ชิ้น
                    </td>
                    <td
                      className="px-4 py-2 font-black text-apple-primary text-right"
                      style={{ textAlign: "right" }}
                    >
                      {formatCurrency(o.total || 0)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          o.status === "Paid"
                            ? isDarkMode
                              ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/30"
                              : "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : o.status === "Pending"
                              ? isDarkMode
                                ? "bg-amber-950/30 text-amber-400 border-amber-900/30"
                                : "bg-amber-50 text-amber-700 border-amber-100"
                              : isDarkMode
                                ? "bg-rose-950/30 text-rose-400 border-rose-900/30"
                                : "bg-rose-50 text-rose-700 border-rose-100"
                        }`}
                      >
                        {o.status === "Paid"
                          ? "ชำระแล้ว"
                          : o.status === "Pending"
                            ? "รอโอน"
                            : "คืนเงิน"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SalesTabComponent: React.FC<SalesTabProps> = (props) => {
  const {
    isDarkMode,
    currentUser,
    salesSubTab = "orders",
    products = [],
    searchQuery = "",
    channelFilter = "all",
    setChannelFilter = () => {},
    setIsAddProductOpen = () => {},
    setEditingOrder = () => {},
    setIsEditOrderOpen = () => {},
    handleDeleteAllOrders = () => {},
    handleDeleteAllIncome = () => {},
    handleDeleteOrder = () => {},
    requestConfirm,
    formatCurrency,
    triggerAlert,
    setActiveTab = () => {},
    uploadedDatasets = [],
    productFiles = [],
    onDeleteDataset = () => {},
    setEditingProduct = () => {},
    setIsEditProductOpen = () => {},
    handleDeleteProduct = () => {},
    handleDeleteAllProducts = () => {},
    onImportOrders,
    onOpenImportModal,
    onOpenAddProductImport,
  } = props;

  const ordersData = useMemo<Order[]>(() => {
    return (props.orders || []).filter((o) => !o.isIncome);
  }, [props.orders]);

  const incomeData = useMemo<Order[]>(() => {
    return (props.orders || []).filter((o) => o.isIncome);
  }, [props.orders]);

  const recordTypeFilter = useMemo<"order" | "income">(() => {
    if (salesSubTab === "income") {
      if (incomeData.length > 0) return "income";
      if (ordersData.length > 0) return "order";
      return "income";
    }
    return "order";
  }, [salesSubTab, incomeData.length, ordersData.length]);

  // Platform style & branding helper
  const getPlatformMeta = (platform: string) => {
    const p = (platform || "").toLowerCase().trim();
    if (p.includes("lazada")) {
      return {
        label: "LAZADA",
        bg: "bg-blue-500/10 dark:bg-blue-500/15",
        text: "text-blue-600 dark:text-blue-400",
        border: "border-blue-500/30 dark:border-blue-500/20",
        badgeBg: "bg-blue-600 dark:bg-blue-500 text-white",
        dot: "bg-blue-500",
        brandColor: "#2E2BB8",
      };
    } else if (p.includes("shopee")) {
      return {
        label: "Shopee",
        bg: "bg-orange-500/10 dark:bg-orange-500/15",
        text: "text-orange-600 dark:text-orange-400",
        border: "border-orange-500/30 dark:border-orange-500/20",
        badgeBg: "bg-orange-500 text-white",
        dot: "bg-orange-500",
        brandColor: "#EE4D2D",
      };
    } else if (p.includes("tiktok")) {
      return {
        label: "TikTok Shop",
        bg: "bg-rose-500/10 dark:bg-rose-500/15",
        text: "text-rose-600 dark:text-rose-400",
        border: "border-rose-500/30 dark:border-rose-500/20",
        badgeBg: "bg-rose-500 text-white",
        dot: "bg-rose-500",
        brandColor: "#FE2C55",
      };
    } else if (p.includes("facebook")) {
      return {
        label: "Facebook",
        bg: "bg-sky-500/10 dark:bg-sky-500/15",
        text: "text-sky-600 dark:text-sky-400",
        border: "border-sky-500/30 dark:border-sky-500/20",
        badgeBg: "bg-sky-600 dark:bg-sky-500 text-white",
        dot: "bg-sky-500",
        brandColor: "#1877F2",
      };
    } else if (p.includes("line")) {
      return {
        label: "LINE OA",
        bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
        text: "text-emerald-600 dark:text-emerald-400",
        border: "border-emerald-500/30 dark:border-emerald-500/20",
        badgeBg: "bg-emerald-500 text-white",
        dot: "bg-emerald-500",
        brandColor: "#06C755",
      };
    } else {
      return {
        label: "อื่นๆ",
        bg: "bg-neutral-500/10 dark:bg-neutral-500/15",
        text: "text-neutral-600 dark:text-neutral-400",
        border: "border-neutral-500/30 dark:border-neutral-500/20",
        badgeBg: "bg-neutral-500 text-white",
        dot: "bg-neutral-500",
        brandColor: "#6b7280",
      };
    }
  };

  const yearFilter = "All";

  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [activeProductPlatform, setActiveProductPlatform] = useState<
    "all" | "lazada" | "shopee" | "tiktok"
  >("all");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [brandStartDate, setBrandStartDate] = useState<string>("");
  const [brandEndDate, setBrandEndDate] = useState<string>("");
  const [brandDatePreset, setBrandDatePreset] = useState<"all" | "today" | "7days" | "30days" | "thisMonth" | "custom">("all");

  const handleBrandDatePreset = (preset: "all" | "today" | "7days" | "30days" | "thisMonth") => {
    setBrandDatePreset(preset);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === "all") {
      setBrandStartDate("");
      setBrandEndDate("");
    } else if (preset === "today") {
      setBrandStartDate(todayStr);
      setBrandEndDate(todayStr);
    } else if (preset === "7days") {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 6);
      setBrandStartDate(`${past7.getFullYear()}-${pad(past7.getMonth() + 1)}-${pad(past7.getDate())}`);
      setBrandEndDate(todayStr);
    } else if (preset === "30days") {
      const past30 = new Date();
      past30.setDate(past30.getDate() - 29);
      setBrandStartDate(`${past30.getFullYear()}-${pad(past30.getMonth() + 1)}-${pad(past30.getDate())}`);
      setBrandEndDate(todayStr);
    } else if (preset === "thisMonth") {
      const firstDay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
      setBrandStartDate(firstDay);
      setBrandEndDate(todayStr);
    }
  };

  const handleBrandCustomDateChange = (type: "start" | "end", val: string) => {
    setBrandDatePreset("custom");
    if (type === "start") setBrandStartDate(val);
    else setBrandEndDate(val);
  };
  const [brandProductSort, setBrandProductSort] = useState<{
    key: "name" | "sales" | "revenue";
    direction: "asc" | "desc";
  }>({ key: "revenue", direction: "desc" });
  const [selectedProduct, setSelectedProduct] = useState<{
    id?: string;
    name: string;
    brand: string;
    category: string;
    price: number;
    sales: number;
    revenue: number;
    stock: number;
    status: Product["status"];
  } | null>(null);
  const [isViewingDetails, setIsViewingDetails] = useState(false);
  const [productViewMode, setProductViewMode] = useState<"summary" | "raw">("summary");

  const [activeSheetName, setActiveSheetName] = useState<Record<string, string>>({}); // fileId -> sheetName

  const incomeDatasets = useMemo(() => {
    return uploadedDatasets.filter((d) => d.type === "income" || d.fileType === "income");
  }, [uploadedDatasets]);

  const orderDatasets = useMemo(() => {
    return uploadedDatasets.filter((d) => d.fileType !== "product" && (d.type as string) !== "product" && d.type !== "income" && d.fileType !== "income");
  }, [uploadedDatasets]);

  // 1. Extract all product orders from order datasets, product files, and direct orders
  const productOrderRecords = useMemo<Order[]>(() => {
    const nonIncomeDatasets = [
      ...(productFiles || []),
      ...(uploadedDatasets || []).filter(
        (ds) =>
          ds &&
          ds.fileType !== "income" &&
          (ds.type as string) !== "income" &&
          ds.kind !== "income" &&
          ds.kind !== "glossary" &&
          ds.kind !== "data" &&
          !ds.fileName.toLowerCase().includes("income") &&
          !ds.fileName.toLowerCase().includes("รายรับ") &&
          !ds.fileName.toLowerCase().includes("statement") &&
          !ds.fileName.toLowerCase().includes("โอนเงิน")
      ),
    ];

    const isStatementRow = (o: Order) => {
      if (!o) return true;
      if (o.isIncome || o.type === "income" || o.kind === "income") return true;
      const n = (o.productName || o.itemName || "").toLowerCase().trim();
      return (
        n.startsWith("รายการรายรับ") ||
        n.startsWith("รายการการรายรับ") ||
        n.startsWith("ค่าธรรมเนียม") ||
        n === "platform product name." ||
        n.includes("statement") ||
        n.includes("payout") ||
        n.includes("settlement")
      );
    };

    if (nonIncomeDatasets.length > 0) {
      const extracted = extractOrdersFromDatasets(nonIncomeDatasets, [], products);
      return extracted.filter((o) => !isStatementRow(o));
    }

    const directNonIncomeOrders = (ordersData.length > 0 ? ordersData : (props.orders || [])).filter(
      (o) => o && !o.isIncome && o.type !== "income" && o.kind !== "income"
    );

    const allDatasets = [...(productFiles || []), ...(uploadedDatasets || [])];
    const allExtracted = extractOrdersFromDatasets(allDatasets, directNonIncomeOrders, products);

    return allExtracted.filter((o) => !isStatementRow(o));
  }, [productFiles, uploadedDatasets, ordersData, props.orders, products]);

  const allowedOrders = useMemo(() => {
    const incomeLookup = new Map<string, Order>();
    incomeData.forEach((inc) => {
      if (inc && inc.id) {
        const cleanId = inc.id.replace(/-row-.*$/, "").trim().toLowerCase();
        incomeLookup.set(cleanId, inc);
      }
    });

    return productOrderRecords.map((o) => {
      if (o && o.id) {
        const cleanId = o.id.replace(/-row-.*$/, "").trim().toLowerCase();
        const matchedIncome = incomeLookup.get(cleanId);
        if (matchedIncome) {
          return {
            ...o,
            platformFee: matchedIncome.platformFee,
            shippingFee: matchedIncome.shippingFee,
            netIncome: matchedIncome.netIncome,
          };
        }
      }
      return o;
    });
  }, [productOrderRecords, incomeData]);

  const sidebarFiles = useMemo(() => {
    if (salesSubTab === "products") {
      const pFiles = productFiles.length > 0 ? productFiles : [];
      const fromUploaded = uploadedDatasets.filter(
        (d) => d.fileType === "product" || (d.type as string) === "product"
      );
      const combined = [...pFiles, ...fromUploaded];
      const uniqueMap = new Map<string, UploadedDataset>();
      combined.forEach((f) => uniqueMap.set(f.id, f));
      return Array.from(uniqueMap.values());
    }
    if (salesSubTab === "income") {
      return incomeDatasets;
    }
    return orderDatasets.length > 0 ? orderDatasets : uploadedDatasets;
  }, [salesSubTab, productFiles, incomeDatasets, orderDatasets, uploadedDatasets]);

  const filteredOrderDatasets = useMemo(() => {
    if (activeProductPlatform === "all") return sidebarFiles;
    return sidebarFiles.filter((d) => {
      let p = (d.platform || "").toLowerCase().trim();
      if (p === "tiktok shop") p = "tiktok";
      if (p === "line oa") p = "line";
      return p === activeProductPlatform;
    });
  }, [sidebarFiles, activeProductPlatform]);

  const platformCounts = useMemo(() => {
    const counts = { all: sidebarFiles.length, lazada: 0, shopee: 0, tiktok: 0 };
    sidebarFiles.forEach((d) => {
      let p = (d.platform || "").toLowerCase().trim();
      if (p === "tiktok shop") p = "tiktok";
      if (p === "line oa") p = "line";
      if (p === "lazada") counts.lazada += 1;
      else if (p === "shopee") counts.shopee += 1;
      else if (p === "tiktok") counts.tiktok += 1;
    });
    return counts;
  }, [sidebarFiles]);

  const currentActiveDatasetId = useMemo(() => {
    if (filteredOrderDatasets.length === 0) {
      return null;
    }
    if (
      activeDatasetId &&
      filteredOrderDatasets.some((d) => d.id === activeDatasetId)
    ) {
      return activeDatasetId;
    }
    return filteredOrderDatasets[0].id;
  }, [filteredOrderDatasets, activeDatasetId]);

  const activeDataset = useMemo(() => {
    if (!currentActiveDatasetId) return null;
    return sidebarFiles.find((d) => d.id === currentActiveDatasetId) || null;
  }, [sidebarFiles, currentActiveDatasetId]);

  const activeSheet = useMemo(() => {
    if (!activeDataset) return null;
    const sheetName = activeSheetName[activeDataset.id] || activeDataset.sheets[0]?.name;
    return activeDataset.sheets.find(s => s.name === sheetName) || activeDataset.sheets[0] || null;
  }, [activeDataset, activeSheetName]);

  const productsInFile = useMemo(() => {
    if (!currentActiveDatasetId) return [];

    const priceBlacklist = [
      "seller sku", "parent sku", "sku id", "lazada sku", "รหัส sku", "เลขอ้างอิง sku", "เลขอ้างอิง parent sku", "sku reference",
      "order id", "order no", "order no.", "order number", "tracking", "พัสดุ", "phone", "เบอร์โทร", "โทร", "zip", "postcode", "รหัสไปรษณีย์", "ไปรษณีย์",
      "coins", "cashback", "shipping fee", "ค่าจัดส่ง", "จำนวน", "qty", "quantity", "วันที่", "เวลา", "date", "time", "สถานะ", "status",
      "customer", "buyer", "recipient", "ผู้ซื้อ", "ลูกค้า", "ผู้รับ", "address", "ที่อยู่"
    ];

    const ds = productFiles.find((f) => f.id === currentActiveDatasetId) || activeDataset;
    const sheetName = ds ? (activeSheetName[ds.id] || ds.sheets[0]?.name) : undefined;
    const sheet = ds ? (ds.sheets.find((s) => s.name === sheetName) || ds.sheets[0]) : null;

    if (ds && sheet && sheet.rows && sheet.rows.length > 0) {
      const headers = sheet.headers || (sheet.rows[0] ? Object.keys(sheet.rows[0]) : []);
      const platform = (ds.platform || "unknown").toLowerCase();

      const findCol = (keywords: string[], blacklist: string[] = []): string | undefined => {
        const normalized = headers.map((h) => String(h || "").trim().toLowerCase());
        const cleaned = normalized.map((h) => h.replace(/[^a-z0-9\u0E00-\u0E7F]/gi, ""));

        // 1. Exact match
        for (const kw of keywords) {
          const target = kw.toLowerCase().trim();
          const idx = normalized.findIndex((h) => {
            if (blacklist.some((b) => h.includes(b.toLowerCase()))) return false;
            return h === target;
          });
          if (idx !== -1) return headers[idx];
        }

        // 2. Cleaned exact match
        for (const kw of keywords) {
          const targetClean = kw.replace(/[^a-z0-9\u0E00-\u0E7F]/gi, "").toLowerCase();
          const idx = cleaned.findIndex((ch, i) => {
            if (blacklist.some((b) => normalized[i].includes(b.toLowerCase()))) return false;
            return ch && ch === targetClean;
          });
          if (idx !== -1) return headers[idx];
        }

        // 3. Partial match
        const stopWords = new Set(["สินค้า", "ส่ง", "fee", "id", "จำนวน", "amount", "เวลา", "date", "ชำระ", "ยอด", "ราคา"]);
        for (const kw of keywords) {
          const target = kw.toLowerCase().trim();
          if (stopWords.has(target) || target.length < 3) continue;
          const idx = normalized.findIndex((h) => {
            if (blacklist.some((b) => h.includes(b.toLowerCase()))) return false;
            return h.includes(target);
          });
          if (idx !== -1) return headers[idx];
        }
        return undefined;
      };

      // Platform specific column resolution
      let keyName: string | undefined;
      let keySku: string | undefined;
      let keyPrice: string | undefined;
      let keyQty: string | undefined;
      let keyRev: string | undefined;
      const keyCategory: string | undefined = findCol(["หมวดหมู่", "หมวดหมู่หลัก", "category", "product_category"], ["สถานะ", "เหตุผล", "รหัส"]);
      const keyBrand: string | undefined = findCol(["แบรนด์", "แบรนด์สินค้า", "ยี่ห้อ", "brand", "product_brand"], ["สถานะ", "เหตุผล"]);
      const keyStockCol: string | undefined = findCol(["คงเหลือ", "จำนวนคงเหลือ", "สต็อก", "สต๊อก", "stock_qty", "inventory", "stock"], ["จำนวนเงิน", "ยอด", "ราคา", "ขาย"]);
      const keyStatus: string | undefined = findCol(["สถานะการสั่งซื้อ", "สถานะคำสั่งซื้อ", "สถานะ", "order status", "order_status", "status", "cancelation/return type", "cancellation/return type", "สถานะการชำระเงิน"]);
      const cancelKeys = headers.filter((h) => {
        const norm = String(h || "").toLowerCase().trim();
        return norm.includes("cancel") || norm.includes("ยกเลิก") || norm.includes("return") || norm.includes("คืนสินค้า") || norm.includes("คืนเงิน") || norm.includes("failed") || norm.includes("ล้มเหลว");
      });

      if (platform === "shopee") {
        keyName = findCol(["ชื่อสินค้า", "ชื่อสินค้า (product name)", "ชื่อรายละเอียดสินค้า", "ชื่อรายการสินค้า", "ชื่อตัวเลือก", "product name", "item name"], ["สถานะ", "เหตุผล", "ผู้ซื้อ", "ลูกค้า", "order", "fee"]);
        keySku = findCol(["เลขอ้างอิง sku (sku reference no.)", "รหัสสินค้า / sku (sku reference)", "เลขอ้างอิง sku", "เลขอ้างอิง parent sku", "seller sku", "sku"]);
        keyPrice = findCol(["ราคาขาย", "ราคาตั้งต้น", "ราคาต่อหน่วย", "สินค้าราคาปกติ", "ยอดเงิน / ราคาขาย (amount / net sales)", "ยอดเงิน / ราคาขาย"], priceBlacklist);
        keyQty = findCol(["จำนวน", "จำนวนสินค้า", "จำนวนชิ้น", "quantity", "qty", "ลำดับ / จำนวน (quantity / seq)", "จำนวน (quantity)"], ["price", "total", "amount", "fee", "parent sku", "sku id", "seller sku"]);
        keyRev = findCol([
          "ราคาขายสุทธิ",
          "ยอดเงิน / ราคาขาย (amount / net sales)",
          "ยอดขายรวม / รายรับสุทธิ (gross sales / net income)",
          "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)",
          "ราคาสินค้าที่ชำระโดยผู้ซื้อ",
          "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย",
          "ยอดรวมค่าสินค้า",
          "ราคาขาย"
        ], [...priceBlacklist, "ยอดรวมของคำสั่งซื้อ", "ยอดรวมคำสั่งซื้อ", "จำนวนเงินทั้งหมดที่โอนแล้ว", "จำนวนเงินทั้งหมด"]);
      } else if (platform === "tiktok") {
        keyName = findCol(["product name", "item name", "ชื่อสินค้า (product name)", "ชื่อสินค้า", "sku name"], ["status", "buyer", "fee", "cancel"]);
        keySku = findCol(["seller sku", "sku id", "sku", "รหัสสินค้า / sku (sku reference)"]);
        keyPrice = findCol([
          "sku unit original price", "sku unit original price (thb)", "sku unit price", "sku unit price (thb)", 
          "sku original price", "sku original price (thb)", "unit price", "item price", "retail price",
          "ราคาต่อหน่วยของ sku", "ราคาต่อหน่วยของ sku (thb)", "ราคาต่อหน่วย", "ราคาสินค้า", "ยอดเงิน / ราคาขาย (amount / net sales)"
        ], priceBlacklist);
        keyQty = findCol(["quantity", "item quantity", "sku quantity", "จำนวน", "จำนวนสินค้า", "ลำดับ / จำนวน (quantity / seq)", "จำนวน (quantity)"], ["price", "total", "amount", "fee", "sku id", "seller sku", "order id"]);
        keyRev = findCol([
          "sku subtotal after discount", "sku subtotal after discount (thb)", "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย", "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย (thb)",
          "ยอดเงิน / ราคาขาย (amount / net sales)", "ยอดขายรวม / รายรับสุทธิ (gross sales / net income)",
          "sku subtotal before discount", "sku subtotal before discount (thb)", "sku subtotal", "sku subtotal (thb)",
          "ยอดรวมค่าสินค้า", "ยอดรวมค่าสินค้า (thb)"
        ], [...priceBlacklist, "order subtotal amount", "order subtotal", "order amount", "buyer paid amount", "total amount", "ยอดรวมคำสั่งซื้อ", "ยอดชำระของผู้ซื้อ", "ยอดเงินตามคำสั่งซื้อ"]);
      } else if (platform === "lazada") {
        keyName = findCol(["item name", "itemname", "product name", "ชื่อสินค้า (product name)", "lazada sku", "seller sku", "ชื่อสินค้า"], ["status", "buyer", "fee", "cancel", "fee name"]);
        keySku = findCol(["lazada sku", "seller sku", "sku", "รหัสสินค้า / sku (sku reference)"]);
        keyPrice = findCol(["paid price", "paidprice", "unit price", "unitprice", "item price", "ราคาขายสุทธิ", "ยอดเงิน / ราคาขาย (amount / net sales)"], priceBlacklist);
        keyQty = findCol(["quantity", "qty", "item quantity", "จำนวน", "ลำดับ / จำนวน (quantity / seq)", "จำนวน (quantity)"], ["price", "total", "amount", "fee", "sku"]);
        keyRev = findCol(["paid price", "paidprice", "amount", "ยอดขายรวม", "ยอดรวม", "ยอดเงิน / ราคาขาย (amount / net sales)", "ยอดขายรวม / รายรับสุทธิ (gross sales / net income)"], priceBlacklist);
      } else {
        keyName = findCol(["ชื่อสินค้า (product name)", "ชื่อสินค้า", "product name", "item name", "ชื่อรายการสินค้า", "product", "item"], ["สถานะ", "เหตุผล", "ผู้ซื้อ", "ลูกค้า", "fee"]);
        keySku = findCol(["sku", "seller sku", "เลขอ้างอิง sku", "รหัสสินค้า / sku (sku reference)"]);
        keyPrice = findCol(["ราคาขาย", "ราคาต่อหน่วย", "unit price", "paid price", "ราคาสินค้า", "ยอดเงิน / ราคาขาย (amount / net sales)"], priceBlacklist);
        keyQty = findCol(["จำนวน", "quantity", "qty", "จำนวนสินค้า", "ลำดับ / จำนวน (quantity / seq)", "จำนวน (quantity)"], ["ราคา", "ยอด", "fee", "sku"]);
        keyRev = findCol(["ยอดรวม", "ยอดขาย", "revenue", "total", "amount", "ยอดเงิน / ราคาขาย (amount / net sales)", "ยอดขายรวม / รายรับสุทธิ (gross sales / net income)"], priceBlacklist);
      }

      // Universal fallback if keyName or keyRev/keyPrice was not found
      if (!keyName) {
        keyName = findCol(["ชื่อสินค้า (product name)", "ชื่อสินค้า", "ชื่อรายละเอียดสินค้า", "ชื่อรายการสินค้า", "product name", "item name", "รหัสสินค้า / sku (sku reference)", "รหัสสินค้า", "sku"]);
        if (!keyName && sheet.rows.length > 0) {
          const firstRow = sheet.rows[0];
          const candidateKeys = Object.keys(firstRow);
          for (let i = candidateKeys.length - 1; i >= 0; i--) {
            const k = candidateKeys[i];
            const val = firstRow[k];
            if (typeof val === "string" && val.trim().length > 1 && !/^\d+$/.test(val.trim()) && !val.includes("/") && !val.startsWith("IV") && !val.startsWith("50001")) {
              keyName = k;
              break;
            }
          }
        }
      }

      if (!keyPrice && !keyRev) {
        keyRev = findCol(["ยอดเงิน / ราคาขาย (amount / net sales)", "ยอดขายรวม / รายรับสุทธิ (gross sales / net income)", "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย", "ยอดรวมค่าสินค้า", "ราคาขายสุทธิ", "ยอดเงิน", "ยอดขาย", "total", "amount", "price"], priceBlacklist);
      }

      if (!keyQty) {
        keyQty = findCol(["ลำดับ / จำนวน (quantity / seq)", "จำนวน (quantity)", "จำนวน", "quantity", "qty"]);
      }

      const safeParseVal = (val: unknown): number => {
        if (val === null || val === undefined) return 0;
        if (typeof val === "number") return val;
        const s = String(val).trim();
        if (!s) return 0;
        const withoutCurrency = s.replace(/[฿$thbTHB%\s]/g, "");
        if (!/^[-+]?[\d,]*\.?\d+$/.test(withoutCurrency)) return 0;
        const clean = withoutCurrency.replace(/,/g, "");
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
      };

      // Group rows by Product Name strictly using this file's data
      const grouped: Record<
        string,
        {
          id?: string;
          name: string;
          brand: string;
          category: Product["category"];
          price: number;
          sales: number;
          revenue: number;
          stock: number;
          status: Product["status"];
          rawPrices: number[];
        }
      > = {};

      sheet.rows.forEach((row) => {
        // Exclude cancelled / refunded order rows so totals match net sales across tabs
        let isCancelled = false;
        if (keyStatus && row[keyStatus] !== undefined && row[keyStatus] !== null && String(row[keyStatus]).trim() !== "") {
          if (parseOrderStatus(row[keyStatus]) === "Refunded") {
            isCancelled = true;
          }
        }
        if (!isCancelled && cancelKeys.length > 0) {
          for (const ck of cancelKeys) {
            const v = row[ck];
            if (v === null || v === undefined || v === "") continue;
            const vStr = String(v).trim().toLowerCase();
            if (vStr === "-" || vStr === "—" || vStr === "none" || vStr === "null" || vStr === "n/a" || vStr.includes("ปกติ")) continue;
            if (
              vStr.includes("cancel") ||
              vStr.includes("ยกเลิก") ||
              vStr.includes("refund") ||
              vStr.includes("คืนเงิน") ||
              vStr.includes("return") ||
              vStr.includes("คืนสินค้า") ||
              vStr.includes("สินค้าถูกคืน") ||
              vStr.includes("ส่งคืน") ||
              vStr.includes("ล้มเหลว") ||
              vStr.includes("failed")
            ) {
              isCancelled = true;
              break;
            }
          }
        }
        if (isCancelled) {
          return;
        }

        let name = keyName && row[keyName] !== undefined && row[keyName] !== null ? String(row[keyName]).trim() : "";
        if (!name && keySku && row[keySku]) {
          name = String(row[keySku]).trim();
        }
        if (!name || name === "—" || name === "-" || name.toLowerCase() === "total" || name.toLowerCase() === "sum") {
          return;
        }

        const rawCat = keyCategory && row[keyCategory] ? String(row[keyCategory]).trim() : "";
        let category: Product["category"];
        const lCat = rawCat.toLowerCase();
        if (lCat.includes("apparel") || lCat.includes("เสื้อ") || lCat.includes("ผ้า") || lCat.includes("แฟชั่น")) category = "Apparel";
        else if (lCat.includes("home") || lCat.includes("บ้าน") || lCat.includes("ของใช้") || lCat.includes("living") || lCat.includes("kitchen")) category = "Home";
        else if (lCat.includes("beauty") || lCat.includes("งาม") || lCat.includes("สำอาง") || lCat.includes("skin") || lCat.includes("makeup") || lCat.includes("บำรุง") || lCat.includes("ผม") || lCat.includes("hair")) category = "Beauty";
        else if (lCat.includes("elect") || lCat.includes("ไฟ") || lCat.includes("คอม")) category = "Electronics";
        else {
          const n = (name || "").toLowerCase();
          if (/แปรง|หวี|มีดโกน|เคราติน|สบู่|ครีม|เซรั่ม|แชมพู|บำรุง|ลิป|แต่งหน้า|น้ำหอม|ทำผม|ตัดผม|บาร์เบอร์|ไดร์|มาส์ก|โพเมด|พู่ปัด|กระปุกแป้ง|กรรไกร|ห่วงต่อผม|กิ๊ฟต่อผม|หัวหุ่น|วิก|ปัตตาเลี่ยน|pomade|keratin|comb|brush|hair|beauty|cosmetic|masque|salon|barber/i.test(n)) category = "Beauty";
          else if (/เสื้อ|กางเกง|กระโปรง|เดรส|รองเท้า|ถุงเท้า|กระเป๋า|หมวก|แฟชั่น|cloth|shirt|pants|dress/i.test(n)) category = "Apparel";
          else if (/เตียง|หมอน|ผ้าปู|ครัว|แก้ว|จาน|โต๊ะ|เก้าอี้|ห้อง|ของใช้|กระจก|home|living|kitchen/i.test(n)) category = "Home";
          else if (/หูฟัง|ลำโพง|สายชาร์จ|แบต|กล้อง|คอม|มือถือ|เคส|ปลั๊ก|พัดลม|เมาส์|คีย์บอร์ด|gadget|phone/i.test(n)) category = "Electronics";
          else category = "Beauty";
        }

        const rawBrand = keyBrand && row[keyBrand] ? String(row[keyBrand]).trim() : "";
        const brand = resolveBrandName(rawBrand, name, row, products);

        // Price per unit from row
        let rowPrice = 0;
        if (keyPrice && row[keyPrice] !== undefined && row[keyPrice] !== null) {
          const pVal = safeParseVal(row[keyPrice]);
          if (pVal > 0 && pVal <= 50000) {
            rowPrice = pVal;
          }
        }

        // Quantity sold from row
        let rowQty = 1;
        if (keyQty && row[keyQty] !== undefined && row[keyQty] !== null && String(row[keyQty]).trim() !== "") {
          const qVal = safeParseVal(row[keyQty]);
          if (qVal > 0 && qVal < 100000) {
            rowQty = Math.round(qVal);
          }
        } else {
          // Fallback search for column "จำนวน"
          const qk = Object.keys(row).find(k => {
            const lk = k.trim().toLowerCase();
            return lk === "จำนวน" || lk === "quantity" || lk === "qty";
          });
          if (qk && row[qk] !== undefined) {
            const qVal = safeParseVal(row[qk]);
            if (qVal > 0 && qVal < 100000) {
              rowQty = Math.round(qVal);
            }
          }
        }

        // Revenue from row
        let rowRev = 0;
        if (keyRev && row[keyRev] !== undefined && row[keyRev] !== null) {
          const rVal = safeParseVal(row[keyRev]);
          if (rVal > 0 && rVal <= 50000 * rowQty) {
            rowRev = rVal;
          }
        }

        // Fallback for price & revenue from other possible column names if 0
        if (rowPrice === 0 && rowRev === 0) {
          const fallbackPriceKeys = [
            "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย",
            "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)",
            "ราคาสินค้าที่ชำระโดยผู้ซื้อ",
            "ราคาขายสุทธิ",
            "สินค้าราคาปกติ",
            "ราคาขาย",
            "ราคาตั้งต้น",
            "ราคาต่อหน่วย",
            "ยอดรวมค่าสินค้า",
            "paid price",
            "unit price",
            "item price"
          ];
          for (const fk of fallbackPriceKeys) {
            const matchedKey = Object.keys(row).find(k => k.trim().toLowerCase() === fk);
            if (matchedKey && row[matchedKey] !== undefined) {
              const p = safeParseVal(row[matchedKey]);
              if (p > 0 && p <= 50000) {
                rowPrice = p;
                break;
              }
            }
          }
        }

        // Reconcile row price and revenue
        const isUnitPriceKeyRev = (colName?: string): boolean => {
          if (!colName) return false;
          const l = colName.toLowerCase().trim();
          if (
            l.includes("หลังหักส่วนลด") ||
            l.includes("subtotal") ||
            l.includes("ยอดรวมค่าสินค้า") ||
            l.includes("ราคาขายสุทธิ") ||
            l.includes("ราคาสินค้าที่ชำระโดยผู้ซื้อ") ||
            l.includes("จำนวนเงินทั้งหมด")
          ) {
            return false;
          }
          return (
            l.includes("สินค้าราคาปกติ") ||
            l.includes("ราคาต่อหน่วย") ||
            l.includes("ราคาต่อชิ้น") ||
            l.includes("paid price") ||
            l.includes("paidprice") ||
            l.includes("unit price") ||
            l.includes("unitprice") ||
            l.includes("item price") ||
            l.includes("itemprice") ||
            l.includes("sku unit") ||
            l.includes("retail price") ||
            l === "ราคาขาย" ||
            l === "ราคาตั้งต้น" ||
            l === "ราคา" ||
            l === "price"
          );
        };

        if (rowRev > 0 && rowQty > 1 && isUnitPriceKeyRev(keyRev)) {
          rowRev = rowRev * rowQty;
        } else if (rowRev === 0 && rowPrice > 0) {
          rowRev = rowPrice * rowQty;
        } else if (rowPrice === 0 && rowRev > 0 && rowQty > 0) {
          rowPrice = Math.round((rowRev / rowQty) * 100) / 100;
        }

        // Stock from row
        let rowStock = 10;
        if (keyStockCol && row[keyStockCol] !== undefined && row[keyStockCol] !== null) {
          const sVal = parseInt(String(row[keyStockCol]).replace(/[^0-9]/g, ""), 10);
          if (!isNaN(sVal) && sVal >= 0 && sVal <= 100000) {
            rowStock = sVal;
          }
        }

        const matchedP = products.find((p) => p.name.toLowerCase() === name.toLowerCase());
        const groupKey = name.toLowerCase();
        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            id: matchedP?.id,
            name,
            brand: brand !== "ทั่วไป" ? brand : (matchedP?.brand || "ทั่วไป"),
            category: matchedP?.category || category,
            price: rowPrice > 0 ? rowPrice : 0,
            sales: 0,
            revenue: 0,
            stock: matchedP?.stock ?? rowStock,
            status: matchedP?.status || (rowStock === 0 ? "Out of Stock" : rowStock <= 10 ? "Low Stock" : "In Stock"),
            rawPrices: [],
          };
        }

        grouped[groupKey].sales += rowQty;
        grouped[groupKey].revenue += rowRev;
        if (rowPrice > 0) {
          grouped[groupKey].rawPrices.push(rowPrice);
        }
      });

      // Calculate final unit price per product for this file
      const resultList = Object.values(grouped).map((item) => {
        let finalPrice = 0;
        if (item.revenue > 0 && item.sales > 0) {
          finalPrice = Math.round((item.revenue / item.sales) * 100) / 100;
        } else if (item.rawPrices.length > 0) {
          finalPrice = Math.round((item.rawPrices.reduce((a, b) => a + b, 0) / item.rawPrices.length) * 100) / 100;
        } else if (item.price > 0) {
          finalPrice = item.price;
        }
        return {
          id: item.id || "",
          name: item.name,
          category: item.category,
          brand: item.brand,
          price: finalPrice,
          sales: item.sales,
          revenue: Math.round(item.revenue * 100) / 100,
          stock: item.stock,
          status: item.status,
        };
      });

      return resultList.sort((a, b) => b.revenue - a.revenue);
    }

    // Fallback when currentActiveDatasetId is 'all' or activeDataset has no rows
    const fileOrders = allowedOrders.filter((o) => {
      if (o.isIncome) return false;
      if (currentActiveDatasetId !== "all" && o.datasetId) return o.datasetId === currentActiveDatasetId;
      if (activeProductPlatform !== "all") {
        const channelLower = o.channel?.toLowerCase();
        const platformLower = activeProductPlatform.toLowerCase();
        if (channelLower === platformLower) return true;
        if (channelLower === "tiktok shop" && platformLower === "tiktok") return true;
        if (channelLower === "line oa" && platformLower === "line") return true;
        return false;
      }
      return true;
    });

    const summary: Record<
      string,
      {
        id?: string;
        name: string;
        brand: string;
        category: Product["category"];
        price: number;
        sales: number;
        revenue: number;
        stock: number;
        status: Product["status"];
      }
    > = {};

    fileOrders.forEach((o) => {
      let keyName = (o.productName || o.itemName || "").trim();
      if (!keyName || keyName === "ไม่ระบุสินค้า") {
        keyName = "สินค้าทั่วไป";
      }
      const groupKey = keyName.toLowerCase();
      const mainP = products.find((p) => p.name.toLowerCase() === groupKey);

      if (!summary[groupKey]) {
        const rawP = o.price ? Number(o.price) : (Number(o.total) > 0 && Number(o.quantity) > 0 ? Number(o.total) / Number(o.quantity) : 0);
        const itemPrice = !isNaN(rawP) && rawP > 0 && rawP < 1000000 ? rawP : 0;
        summary[groupKey] = {
          id: mainP?.id,
          name: keyName,
          brand: o.brand || mainP?.brand || "ทั่วไป",
          category: mainP?.category || "Beauty",
          price: itemPrice,
          sales: 0,
          revenue: 0,
          stock: mainP?.stock ?? 10,
          status: mainP?.status || "In Stock",
        };
      }

      if (o.status !== "Refunded") {
        summary[groupKey].sales += Number(o.quantity) || 1;
        summary[groupKey].revenue += Number(o.total) || 0;
      }
    });

    const combinedList = Object.values(summary).map((item) => {
      const avgPrice = item.revenue > 0 && item.sales > 0 ? Math.round((item.revenue / item.sales) * 100) / 100 : item.price;
      return {
        ...item,
        price: avgPrice,
        revenue: Math.round(item.revenue * 100) / 100,
      };
    });

    return combinedList.sort((a, b) => b.revenue - a.revenue);
  }, [currentActiveDatasetId, products, productFiles, activeSheetName, allowedOrders, activeDataset, activeProductPlatform]);

  const productKpis = useMemo(() => {
    if (productsInFile.length > 0) {
      const totalUniqueProducts = productsInFile.length;
      const totalQuantitySold = productsInFile.reduce((sum, p) => sum + (p.sales || 0), 0);
      const totalRevenue = productsInFile.reduce((sum, p) => sum + (p.revenue || 0), 0);
      const prodsWithPrice = productsInFile.filter((p) => p.price > 0);
      let averagePrice = 0;
      if (totalRevenue > 0 && totalQuantitySold > 0) {
        averagePrice = Math.round((totalRevenue / totalQuantitySold) * 100) / 100;
      } else if (totalRevenue > 0 && prodsWithPrice.length > 0) {
        averagePrice = Math.round((prodsWithPrice.reduce((sum, p) => sum + p.price, 0) / prodsWithPrice.length) * 100) / 100;
      }

      return {
        totalUniqueProducts,
        totalQuantitySold,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averagePrice,
      };
    }

    return {
      totalUniqueProducts: 0,
      totalQuantitySold: 0,
      totalRevenue: 0,
      averagePrice: 0,
    };
  }, [productsInFile]);

  const currentSelectedProduct = useMemo(() => {
    if (productsInFile.length === 0) return null;
    if (
      selectedProduct &&
      productsInFile.some((p) => p.name === selectedProduct.name)
    ) {
      return (
        productsInFile.find((p) => p.name === selectedProduct.name) || null
      );
    }
    return productsInFile[0];
  }, [productsInFile, selectedProduct]);

  const filteredOrdersData = useMemo(() => {
    const list = ordersData.length > 0 ? ordersData : (props.orders || []).filter((o) => !o.isIncome);
    return list.filter((o) => {
      const q = (searchQuery || "").toLowerCase().trim();
      const matchSearch =
        !q ||
        (o.customerName?.toLowerCase() || "").includes(q) ||
        (o.productName?.toLowerCase() || "").includes(q) ||
        (o.brand?.toLowerCase() || "").includes(q) ||
        (o.id?.toLowerCase() || "").includes(q);

      const chFilter = (channelFilter || "all").toLowerCase().trim();
      const matchChannel =
        chFilter === "all" ||
        (chFilter === "อื่นๆ"
          ? !["facebook", "line oa", "shopee", "lazada", "tiktok shop"].includes((o.channel || "").toLowerCase())
          : (o.channel || "").toLowerCase() === chFilter);

      const matchYear = yearFilter === "All" || (o.date && o.date.startsWith(yearFilter));

      return matchSearch && matchChannel && matchYear;
    });
  }, [ordersData, props.orders, searchQuery, channelFilter, yearFilter]);

  const [ordersSortConfig, setOrdersSortConfig] = useState<{
    key: "id" | "customerName" | "productName" | "quantity" | "channel" | "date" | "total" | "status";
    direction: "asc" | "desc";
  } | null>({ key: "date", direction: "desc" });

  const handleOrdersSort = (key: "id" | "customerName" | "productName" | "quantity" | "channel" | "date" | "total" | "status") => {
    if (!ordersSortConfig || ordersSortConfig.key !== key) {
      const initDir: "asc" | "desc" = ["id", "customerName", "productName", "channel", "status"].includes(key) ? "asc" : "desc";
      setOrdersSortConfig({ key, direction: initDir });
    } else if (ordersSortConfig.key === key) {
      if (ordersSortConfig.direction === "desc") {
        setOrdersSortConfig({ key, direction: "asc" });
      } else {
        setOrdersSortConfig(null);
      }
    }
  };

  const sortedOrdersData = useMemo(() => {
    if (!ordersSortConfig) return filteredOrdersData;
    const { key, direction } = ordersSortConfig;
    const mult = direction === "asc" ? 1 : -1;

    if (key === "date") {
      const mapped = filteredOrdersData.map((order, idx) => ({
        idx,
        order,
        time: parseFlexibleDate(order.date) ?? -Infinity,
        raw: order.date || ""
      }));
      mapped.sort((a, b) => {
        if (a.time !== -Infinity && b.time !== -Infinity) {
          const diff = a.time - b.time;
          return diff === 0 ? a.idx - b.idx : diff * mult;
        }
        const cmp = a.raw.localeCompare(b.raw);
        return cmp === 0 ? a.idx - b.idx : cmp * mult;
      });
      return mapped.map(m => m.order);
    }

    return [...filteredOrdersData].sort((a, b) => {
      if (key === "total") {
        return ((Number(a.total) || 0) - (Number(b.total) || 0)) * mult;
      }
      if (key === "quantity") {
        return ((Number(a.quantity) || 1) - (Number(b.quantity) || 1)) * mult;
      }
      if (key === "id") {
        return (a.id || "").localeCompare(b.id || "", "th", { numeric: true }) * mult;
      }
      if (key === "customerName") {
        return (a.customerName || "").localeCompare(b.customerName || "", "th") * mult;
      }
      if (key === "productName") {
        return (a.productName || "").localeCompare(b.productName || "", "th") * mult;
      }
      if (key === "channel") {
        return (a.channel || "").localeCompare(b.channel || "") * mult;
      }
      if (key === "status") {
        return (a.status || "").localeCompare(b.status || "") * mult;
      }
      return 0;
    });
  }, [filteredOrdersData, ordersSortConfig]);

  const filteredIncomeData = useMemo(() => {
    const list = incomeData.length > 0 ? incomeData : (props.orders || []).filter((o) => o.isIncome);
    return list.filter((o) => {
      const q = (searchQuery || "").toLowerCase().trim();
      const matchSearch =
        !q ||
        (o.customerName?.toLowerCase() || "").includes(q) ||
        (o.productName?.toLowerCase() || "").includes(q) ||
        (o.brand?.toLowerCase() || "").includes(q) ||
        (o.id?.toLowerCase() || "").includes(q);

      const chFilter = (channelFilter || "all").toLowerCase().trim();
      const matchChannel =
        chFilter === "all" ||
        (chFilter === "อื่นๆ"
          ? !["facebook", "line oa", "shopee", "lazada", "tiktok shop"].includes((o.channel || "").toLowerCase())
          : (o.channel || "").toLowerCase() === chFilter);

      const matchYear = yearFilter === "All" || (o.date && o.date.startsWith(yearFilter));

      return matchSearch && matchChannel && matchYear;
    });
  }, [incomeData, props.orders, searchQuery, channelFilter, yearFilter]);

  const ordersSummaryKpis = useMemo(() => {
    const totalSales = filteredOrdersData.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const totalQuantity = filteredOrdersData.reduce((s, o) => s + (Number(o.quantity) || 1), 0);
    const totalCount = filteredOrdersData.length;
    const paidCount = filteredOrdersData.filter((o) => o.status === "Paid").length;
    return { totalSales, totalQuantity, totalCount, paidCount };
  }, [filteredOrdersData]);

  const salesByBrandSummary = useMemo(() => {
    const summary: Record<
      string,
      { brand: string; productCount: number; sales: number; revenue: number }
    > = {};

    // 1. Gather all unique brands from products catalog AND all product orders
    const allBrands = new Set<string>();
    products.forEach((p) => {
      const b = resolveBrandName(p.brand, p.name, null, products);
      if (b) allBrands.add(b);
    });
    allowedOrders.forEach((o) => {
      const b = resolveBrandName(o.brand, o.productName, o, products);
      if (b) allBrands.add(b);
    });

    // 2. Initialize summary for all brands
    allBrands.forEach((b) => {
      summary[b] = {
        brand: b,
        productCount: 0,
        sales: 0,
        revenue: 0,
      };
    });

    // 3. Accumulate sales and revenue from filtered orders
    allowedOrders.forEach((o) => {
      if (o.status !== "Refunded") {
        const matchesChannel =
          channelFilter === "All" ||
          (channelFilter === "อื่นๆ"
            ? !["Facebook", "LINE OA", "Shopee", "Lazada", "TikTok Shop"].includes(o.channel)
            : o.channel === channelFilter);
        const matchesYear =
          yearFilter === "All" || (o.date && o.date.startsWith(yearFilter));

        const d = (o.date || "").split(" ")[0].split("T")[0];
        const matchesDate =
          (!brandStartDate || (d && d >= brandStartDate)) &&
          (!brandEndDate || (d && d <= brandEndDate));

        if (matchesChannel && matchesYear && matchesDate) {
          const b = resolveBrandName(o.brand, o.productName, o, products);
          if (!summary[b]) {
            summary[b] = { brand: b, productCount: 0, sales: 0, revenue: 0 };
          }
          const pName = (o.productName || "").trim();
          const mainP = products.find((p) => p.name.toLowerCase() === pName.toLowerCase());
          const qty = Number(o.quantity) || 1;
          let tot = Number(o.total || 0);
          if (mainP && mainP.price > 0 && (tot / qty > 50000 || tot <= 0)) {
            tot = mainP.price * qty;
          } else if (tot / qty > 50000) {
            const fallbackP = (o.price && Number(o.price) > 0 && Number(o.price) < 50000) ? Number(o.price) : 0;
            tot = fallbackP > 0 ? fallbackP * qty : 0;
          }
          summary[b].sales += qty;
          summary[b].revenue += tot;
        }
      }
    });

    // 4. Calculate unique product count for each brand from all orders and catalog (Fast O(N) pass)
    const brandProductsMap = new Map<string, Set<string>>();
    allowedOrders.forEach((o) => {
      const d = (o.date || "").split(" ")[0].split("T")[0];
      const matchesDate =
        (!brandStartDate || (d && d >= brandStartDate)) &&
        (!brandEndDate || (d && d <= brandEndDate));

      if (matchesDate && o.productName) {
        const orderBrand = resolveBrandName(o.brand, o.productName, o, products);
        let s = brandProductsMap.get(orderBrand);
        if (!s) {
          s = new Set<string>();
          brandProductsMap.set(orderBrand, s);
        }
        s.add(o.productName.trim());
      }
    });

    if (!brandStartDate && !brandEndDate) {
      products.forEach((p) => {
        const prodBrand = resolveBrandName(p.brand, p.name, null, products);
        if (prodBrand && p.name) {
          let s = brandProductsMap.get(prodBrand);
          if (!s) {
            s = new Set<string>();
            brandProductsMap.set(prodBrand, s);
          }
          s.add(p.name.trim());
        }
      });
    }

    Object.keys(summary).forEach((b) => {
      summary[b].productCount = brandProductsMap.get(b)?.size || 0;
    });

    // 5. Filter and Sort
    const query = (searchQuery || "").toLowerCase();
    const excludedBrandNames = new Set([
      "lazada",
      "shopee",
      "tiktok",
      "tiktok shop",
      "tiktokshop",
      "facebook",
      "line oa",
      "line",
      "pos",
      "statement",
      "รายรับ",
      "รายการรายรับ",
      "รายการการรายรับ",
      "income",
      "payout",
    ]);

    let result = Object.values(summary).filter((item) => {
      const bLower = item.brand.toLowerCase().trim();
      if (excludedBrandNames.has(bLower)) return false;
      return bLower.includes(query);
    });

    if (channelFilter !== "All") {
      result = result.filter((item) => item.sales > 0);
    }

    return result.sort((a, b) => b.revenue - a.revenue);
  }, [products, allowedOrders, searchQuery, channelFilter, yearFilter, brandStartDate, brandEndDate]);

  const totalAllBrandsSales = useMemo(() => {
    return salesByBrandSummary.reduce((sum, item) => sum + item.sales, 0);
  }, [salesByBrandSummary]);

  const activeBrandName = useMemo(() => {
    if (selectedBrand) return selectedBrand;
    return "all";
  }, [selectedBrand]);

  const productsForSelectedBrand = useMemo(() => {
    if (!activeBrandName) return [];

    const summary: Record<
      string,
      {
        name: string;
        brand: string;
        category: string;
        sales: number;
        revenue: number;
        price: number;
        stock: number;
      }
    > = {};

    allowedOrders.forEach((o) => {
      const orderBrand = resolveBrandName(o.brand, o.productName, o, products);
      const matchesBrand = activeBrandName === "all" || orderBrand === activeBrandName;
      if (matchesBrand) {
        const matchesChannel =
          channelFilter === "All" ||
          (channelFilter === "อื่นๆ"
            ? !["Facebook", "LINE OA", "Shopee", "Lazada", "TikTok Shop"].includes(o.channel)
            : o.channel === channelFilter);
        const matchesYear =
          yearFilter === "All" || (o.date && o.date.startsWith(yearFilter));

        const d = (o.date || "").split(" ")[0].split("T")[0];
        const matchesDate =
          (!brandStartDate || (d && d >= brandStartDate)) &&
          (!brandEndDate || (d && d <= brandEndDate));

        if (matchesChannel && matchesYear && matchesDate) {
          const productName = (o.productName || "สินค้าทั่วไป").trim();
          const mainP = products.find(
            (p) => p.name.toLowerCase() === productName.toLowerCase(),
          );

          if (!summary[productName]) {
            const rawPrice = mainP?.price || (o.price ? Number(o.price) : ((Number(o.total) || 0) / (Number(o.quantity) || 1)));
            const itemPrice = !isNaN(rawPrice) && rawPrice > 0 && rawPrice < 50000 ? rawPrice : (mainP?.price || 0);
            summary[productName] = {
              name: productName,
              brand: orderBrand,
              category: mainP?.category || (o.category as string) || "Beauty",
              sales: 0,
              revenue: 0,
              price: itemPrice,
              stock: mainP?.stock ?? 0,
            };
          }
          if (o.status !== "Refunded") {
            const qty = Number(o.quantity) || 1;
            let tot = Number(o.total || 0);
            if (mainP && mainP.price > 0 && (tot / qty > 50000 || tot <= 0)) {
              tot = mainP.price * qty;
            } else if (tot / qty > 50000) {
              const fallbackP = (o.price && Number(o.price) > 0 && Number(o.price) < 50000) ? Number(o.price) : summary[productName].price;
              tot = fallbackP > 0 ? fallbackP * qty : 0;
            }
            summary[productName].sales += qty;
            summary[productName].revenue += tot;
          }
        }
      }
    });

    // Also include catalog products if no date filter active and channel/year is 'All'
    if (channelFilter === "All" && yearFilter === "All" && !brandStartDate && !brandEndDate) {
      products.forEach((p) => {
        const prodBrand = resolveBrandName(p.brand, p.name, null, products);
        const matchesBrand = activeBrandName === "all" || prodBrand === activeBrandName;
        if (matchesBrand && p.name) {
          const pName = p.name.trim();
          if (!summary[pName]) {
            summary[pName] = {
              name: pName,
              brand: prodBrand,
              category: p.category || "Beauty",
              sales: 0,
              revenue: 0,
              price: p.price || 0,
              stock: p.stock ?? 0,
            };
          }
        }
      });
    }

    const sorted = Object.values(summary);

    if (brandProductSort.key === "name") {
      sorted.sort((a, b) => {
        return brandProductSort.direction === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      });
    } else if (brandProductSort.key === "sales") {
      sorted.sort((a, b) => {
        return brandProductSort.direction === "asc"
          ? a.sales - b.sales
          : b.sales - a.sales;
      });
    } else {
      sorted.sort((a, b) => {
        return brandProductSort.direction === "asc"
          ? a.revenue - b.revenue
          : b.revenue - a.revenue;
      });
    }

    return sorted;
  }, [allowedOrders, products, activeBrandName, channelFilter, yearFilter, brandProductSort, brandStartDate, brandEndDate]);

  const selectedBrandTotals = useMemo(() => {
    let sales = 0;
    let revenue = 0;
    productsForSelectedBrand.forEach((p) => {
      sales += p.sales;
      revenue += p.revenue;
    });
    return { sales, revenue };
  }, [productsForSelectedBrand]);

  const exportBrandToExcel = () => {
    if (!activeBrandName || productsForSelectedBrand.length === 0) {
      triggerAlert("ไม่มีข้อมูลสินค้าที่จะส่งออก", "warning");
      return;
    }
    const data = productsForSelectedBrand.map((p, idx) => ({
      "ลำดับ": idx + 1,
      "ชื่อสินค้า": sanitizeCellForExport(p.name),
      "แบรนด์": sanitizeCellForExport(p.brand || "ทั่วไป"),
      "หมวดหมู่": sanitizeCellForExport(p.category),
      "จำนวนที่ขายได้ (ชิ้น)": p.sales,
      "ราคาต่อชิ้น (฿)": p.price,
      "รายได้สุทธิ (฿)": p.revenue,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    const sheetTitle = activeBrandName === "all" ? "All_Products" : `Brand_${activeBrandName.slice(0, 20)}`;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle);
    XLSX.writeFile(workbook, `AeroSales_${activeBrandName === "all" ? "All_Products" : `Brand_${activeBrandName}`}_Report.xlsx`);
    triggerAlert(`ส่งออกรายงาน${activeBrandName === "all" ? "สินค้าทั้งหมด" : `แบรนด์ ${activeBrandName}`} สำเร็จ`, "success");
  };

  const toggleSort = (key: "name" | "sales" | "revenue") => {
    setBrandProductSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "desc" };
    });
  };

  const handleExportCSV = () => {
    if (salesSubTab === "products") {
      if (productsInFile.length === 0) {
        triggerAlert("ไม่มีข้อมูลสินค้าที่จะส่งออก", "warning");
        return;
      }
      const headers = ["ลำดับ", "ชื่อสินค้า", "หมวดหมู่", "แบรนด์", "ราคา (฿)", "ยอดขาย (ชิ้น)", "รายได้รวม (฿)", "คงเหลือ", "สถานะ"];
      const rows = productsInFile.map((p, idx) => [
        idx + 1,
        `"${(p.name || "").replace(/"/g, '""')}"`,
        `"${(p.category || "").replace(/"/g, '""')}"`,
        `"${(p.brand || "").replace(/"/g, '""')}"`,
        (p.price || 0).toFixed(2),
        p.sales || 0,
        (p.revenue || 0).toFixed(2),
        p.stock || 0,
        `"${p.status}"`
      ]);
      const csv = [
        `"รายงานสินค้า AeroSales"`,
        `"วันที่ออก:","${new Date().toLocaleString("th-TH")}"`,
        "",
        headers.join(","),
        ...rows.map((r) => r.join(","))
      ].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `aerosales_products_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      triggerAlert("ส่งออกข้อมูลสินค้าเป็นไฟล์ CSV เรียบร้อยแล้ว", "success");
      return;
    }

    if (salesSubTab === "brands") {
      if (salesByBrandSummary.length === 0) {
        triggerAlert("ไม่มีข้อมูลแบรนด์ที่จะส่งออก", "warning");
        return;
      }
      const headers = ["ลำดับ", "แบรนด์", "จำนวนสินค้า", "ยอดขาย (ชิ้น)", "ยอดขายรวม (฿)"];
      const rows = salesByBrandSummary.map((b, idx) => [
        idx + 1,
        `"${(b.brand || "").replace(/"/g, '""')}"`,
        b.productCount || 0,
        b.sales || 0,
        (b.revenue || 0).toFixed(2)
      ]);
      const csv = [
        `"รายงานสรุปยอดขายตามแบรนด์ AeroSales"`,
        `"วันที่ออก:","${new Date().toLocaleString("th-TH")}"`,
        "",
        headers.join(","),
        ...rows.map((r) => r.join(","))
      ].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `aerosales_brands_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      triggerAlert("ส่งออกข้อมูลแบรนด์เป็นไฟล์ CSV เรียบร้อยแล้ว", "success");
      return;
    }

    const isIncomeExport = recordTypeFilter === "income";
    const dataToExport = isIncomeExport ? filteredIncomeData : filteredOrdersData;

    if (dataToExport.length === 0) {
      triggerAlert("ไม่มีข้อมูลที่ตรงกับตัวกรองเพื่อส่งออก", "warning");
      return;
    }

    if (isIncomeExport) {
      const headers = [
        "รหัสอ้างอิง/Order ID",
        "วันที่ทำรายการ",
        "รายละเอียดสินค้า/บริการ",
        "แบรนด์",
        "ช่องทางขาย",
        "ยอดขายรวม/รายรับ (บาท)",
        "ค่าธรรมเนียมแพลตฟอร์ม (บาท)",
        "ค่าจัดส่ง (บาท)",
        "รายรับสุทธิ (บาท)",
        "สถานะ"
      ];

      const rows = dataToExport.map((o) => {
        const statusText =
          o.status === "Paid"
            ? "ชำระเงินสำเร็จ"
            : o.status === "Pending"
              ? "รอการตรวจสอบ"
              : "คืนเงินแล้ว";
        const net = o.netIncome ?? (Number(o.total || 0) - Number(o.platformFee || 0));
        return [
          `"${o.id}"`,
          `"${o.date}"`,
          `"${(o.productName || "รายการรายรับบัญชี").replace(/"/g, '""')}"`,
          `"${(o.brand || "").replace(/"/g, '""')}"`,
          `"${(o.channel || "").replace(/"/g, '""')}"`,
          (Number(o.total) || 0).toFixed(2),
          (Number(o.platformFee) || 0).toFixed(2),
          (Number(o.shippingFee) || 0).toFixed(2),
          net.toFixed(2),
          `"${statusText}"`,
        ];
      });

      const totalGross = dataToExport.reduce((s, o) => s + Number(o.total || 0), 0);
      const totalNet = dataToExport.reduce((s, o) => s + Number(o.netIncome ?? (Number(o.total || 0) - Number(o.platformFee || 0))), 0);

      const csv = [
        `"รายงานรายรับแพลตฟอร์ม AeroSales (Platform Income Report)"`,
        `"วันที่ออก:","${new Date().toLocaleString("th-TH")}"`,
        "",
        headers.map((h) => `"${h}"`).join(","),
        ...rows.map((r) => r.join(",")),
        `"รวม","","","","${dataToExport.length} รายการ",${totalGross.toFixed(2)},"","",${totalNet.toFixed(2)},""`,
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `aerosales_income_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      triggerAlert("ส่งออกข้อมูลรายรับเป็นไฟล์ CSV เรียบร้อยแล้ว", "success");
      return;
    }

    const headers = [
      "รหัสคำสั่งซื้อ",
      "วันที่บันทึกยอด",
      "ชื่อลูกค้า",
      "อีเมลลูกค้า",
      "ชื่อสินค้า",
      "จำนวนชิ้น",
      "แบรนด์สินค้า",
      "ช่องทางขาย",
      "ยอดเงิน (บาท)",
      "สถานะการชำระเงิน",
    ];

    const rows = filteredOrdersData.map((o) => {
      const statusText =
        o.status === "Paid"
          ? "ชำระเงินสำเร็จ"
          : o.status === "Pending"
            ? "รอการตรวจสอบ"
            : "คืนเงินแล้ว";
      return [
        `"${o.id}"`,
        `"${o.date}"`,
        `"${(o.customerName || "").replace(/"/g, '""')}"`,
        `"${(o.email || "").replace(/"/g, '""')}"`,
        `"${(o.productName || "").replace(/"/g, '""')}"`,
        o.quantity || 1,
        `"${(o.brand || "").replace(/"/g, '""')}"`,
        `"${(o.channel || "").replace(/"/g, '""')}"`,
        (o.total !== undefined ? o.total : 0).toFixed(2),
        `"${statusText}"`,
      ];
    });

    const totalVal = filteredOrdersData.reduce((s, o) => s + Number(o.total || 0), 0);

    const csv = [
      `"รายงานธุรกรรมการขาย AeroSales"`,
      `"วันที่ออก:","${new Date().toLocaleString("th-TH")}"`,
      "",
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((r) => r.join(",")),
      `"รวม","","","","","","${filteredOrdersData.length} รายการ",${totalVal.toFixed(2)},""`,
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `aerosales_orders_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    triggerAlert("ส่งออกข้อมูลเป็นไฟล์ CSV เรียบร้อยแล้ว", "success");
  };

  const handleExportExcel = () => {
    if (salesSubTab === "products") {
      if (productsInFile.length === 0) {
        triggerAlert("ไม่มีข้อมูลสินค้าที่จะส่งออก", "warning");
        return;
      }
      const headers = [
        ["รายงานสินค้า AeroSales (Products Report)"],
        [`วันที่ออกรายงาน: ${new Date().toLocaleString("th-TH")}`],
        [],
        ["ลำดับ", "ชื่อสินค้า", "หมวดหมู่", "แบรนด์", "ราคา (฿)", "ยอดขาย (ชิ้น)", "รายได้รวม (฿)", "คงเหลือ", "สถานะ"]
      ];
      const rows = productsInFile.map((p, idx) => [
        idx + 1,
        p.name,
        p.category,
        p.brand,
        p.price,
        p.sales,
        p.revenue,
        p.stock,
        p.status
      ]);
      const data = [...headers, ...rows];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = [
        { wch: 8 },
        { wch: 30 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 15 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, "รายการสินค้า");
      XLSX.writeFile(wb, `aerosales_products_${new Date().toISOString().split("T")[0]}.xlsx`);
      triggerAlert("ส่งออกข้อมูลสินค้าเป็น Excel เรียบร้อยแล้ว", "success");
      return;
    }

    if (salesSubTab === "brands") {
      if (salesByBrandSummary.length === 0) {
        triggerAlert("ไม่มีข้อมูลแบรนด์ที่จะส่งออก", "warning");
        return;
      }
      const headers = [
        ["รายงานสรุปยอดขายตามแบรนด์ AeroSales (Brand Summary Report)"],
        [`วันที่ออกรายงาน: ${new Date().toLocaleString("th-TH")}`],
        [],
        ["ลำดับ", "แบรนด์", "จำนวนสินค้า", "ยอดขาย (ชิ้น)", "ยอดขายรวม (฿)"]
      ];
      const rows = salesByBrandSummary.map((b, idx) => [
        idx + 1,
        sanitizeCellForExport(b.brand),
        b.productCount,
        b.sales,
        b.revenue
      ]);
      const data = [...headers, ...rows];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = [
        { wch: 8 },
        { wch: 25 },
        { wch: 15 },
        { wch: 15 },
        { wch: 18 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, "ยอดขายตามแบรนด์");
      XLSX.writeFile(wb, `aerosales_brands_${new Date().toISOString().split("T")[0]}.xlsx`);
      triggerAlert("ส่งออกรายงานแบรนด์เป็น Excel เรียบร้อยแล้ว", "success");
      return;
    }

    const isIncomeExport = recordTypeFilter === "income";
    const dataToExport = isIncomeExport ? filteredIncomeData : filteredOrdersData;

    if (dataToExport.length === 0) {
      triggerAlert("ไม่มีข้อมูลที่ตรงกับตัวกรองเพื่อส่งออก", "warning");
      return;
    }

    if (isIncomeExport) {
      const headers = [
        ["รายงานรายรับแพลตฟอร์ม AeroSales (Platform Income Report)"],
        [`วันที่ออกรายงาน: ${new Date().toLocaleString("th-TH")}`],
        [],
        [
          "รหัสอ้างอิง/Order ID",
          "วันที่ทำรายการ",
          "รายละเอียด",
          "แบรนด์",
          "ช่องทางขาย",
          "ยอดขายรวม (บาท)",
          "ค่าธรรมเนียมแพลตฟอร์ม",
          "ค่าจัดส่ง",
          "รายรับสุทธิ (บาท)",
          "สถานะ"
        ]
      ];

      const rows = dataToExport.map((o) => {
        const statusText =
          o.status === "Paid"
            ? "ชำระเงินสำเร็จ"
            : o.status === "Pending"
              ? "รอการตรวจสอบ"
              : "คืนเงินแล้ว";
        const net = o.netIncome ?? (Number(o.total || 0) - Number(o.platformFee || 0));
        return [
          sanitizeCellForExport(o.id),
          sanitizeCellForExport(o.date),
          sanitizeCellForExport(o.productName || "รายการรายรับบัญชี"),
          sanitizeCellForExport(o.brand || ""),
          sanitizeCellForExport(o.channel || ""),
          o.total !== undefined ? o.total : 0,
          o.platformFee !== undefined ? o.platformFee : 0,
          o.shippingFee !== undefined ? o.shippingFee : 0,
          net,
          statusText
        ];
      });

      const totalGross = dataToExport.reduce((s, o) => s + Number(o.total || 0), 0);
      const totalNet = dataToExport.reduce((s, o) => s + Number(o.netIncome ?? (Number(o.total || 0) - Number(o.platformFee || 0))), 0);

      const summaryRow = [
        "รวมทั้งหมด",
        "",
        "",
        "",
        `${dataToExport.length} รายการ`,
        totalGross,
        "",
        "",
        totalNet,
        ""
      ];

      const data = [...headers, ...rows, summaryRow];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);

      ws["!cols"] = [
        { wch: 24 },
        { wch: 15 },
        { wch: 30 },
        { wch: 15 },
        { wch: 15 },
        { wch: 18 },
        { wch: 18 },
        { wch: 15 },
        { wch: 18 },
        { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, "รายรับแพลตฟอร์ม");
      XLSX.writeFile(wb, `aerosales_income_${new Date().toISOString().split("T")[0]}.xlsx`);
      triggerAlert("ส่งออกข้อมูลรายรับเป็น Excel เรียบร้อยแล้ว", "success");
      return;
    }

    const headers = [
      ["รายงานธุรกรรมการขาย AeroSales (Sales Orders Report)"],
      [`วันที่ออกรายงาน: ${new Date().toLocaleString("th-TH")}`],
      [],
      [
        "รหัสคำสั่งซื้อ",
        "วันที่สั่งซื้อ",
        "ชื่อลูกค้า",
        "อีเมลลูกค้า",
        "ชื่อสินค้า",
        "จำนวนชิ้น",
        "แบรนด์สินค้า",
        "ช่องทางขาย",
        "ยอดเงิน (บาท)",
        "สถานะการชำระเงิน"
      ]
    ];

    const rows = filteredOrdersData.map((o) => {
      const statusText =
        o.status === "Paid"
          ? "ชำระเงินสำเร็จ"
          : o.status === "Pending"
            ? "รอการตรวจสอบ"
            : "คืนเงินแล้ว";
      return [
        sanitizeCellForExport(o.id),
        sanitizeCellForExport(o.date),
        sanitizeCellForExport(o.customerName),
        sanitizeCellForExport(o.email || ""),
        sanitizeCellForExport(o.productName),
        o.quantity || 1,
        sanitizeCellForExport(o.brand || ""),
        sanitizeCellForExport(o.channel || ""),
        o.total !== undefined ? o.total : "",
        statusText
      ];
    });

    const totalVal = filteredOrdersData.reduce((s, o) => s + Number(o.total || 0), 0);

    const summaryRow = [
      "รวมทั้งหมด",
      "",
      "",
      "",
      "",
      "",
      `${filteredOrdersData.length} รายการ`,
      "",
      totalVal,
      ""
    ];

    const data = [...headers, ...rows, summaryRow];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    ws["!cols"] = [
      { wch: 22 },
      { wch: 15 },
      { wch: 20 },
      { wch: 22 },
      { wch: 25 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "รายการคำสั่งซื้อ");
    XLSX.writeFile(wb, `aerosales_orders_${new Date().toISOString().split("T")[0]}.xlsx`);
    triggerAlert("ส่งออกข้อมูล Excel เรียบร้อยแล้ว", "success");
  };

  const statusBadge = (status: Order["status"]) => {
    if (status === "Paid")
      return isDarkMode
        ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/30"
        : "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (status === "Pending")
      return isDarkMode
        ? "bg-amber-950/30 text-amber-400 border-amber-900/30"
        : "bg-amber-50 text-amber-700 border-amber-100";
    return isDarkMode
      ? "bg-rose-950/30 text-rose-400 border-rose-900/30"
      : "bg-rose-50 text-rose-700 border-rose-100";
  };

  const statusLabel = (status: Order["status"]) =>
    status === "Paid"
      ? "ชำระแล้ว"
      : status === "Pending"
        ? "รอโอนเงิน"
        : "คืนเงิน";

  const thCls =
    "px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-apple-secondary whitespace-nowrap";
  const tdCls = "px-5 py-3.5 whitespace-nowrap";

  return (
    <div className="space-y-5">
      {/* Action Toolbar (ซ่อนในหน้าข้อมูลแบรนด์) */}
      {salesSubTab !== "brands" && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 sm:p-3 rounded-2xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl border border-neutral-200/90 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all">
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200 flex items-center gap-2 group cursor-default">
              <span className="p-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span>เครื่องมือจัดการ</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {salesSubTab === "products" ? (
              <button
                type="button"
                onClick={() => {
                  if (onOpenAddProductImport) {
                    onOpenAddProductImport();
                  } else if (onOpenImportModal) {
                    onOpenImportModal("orders");
                  }
                }}
                className="group relative overflow-hidden flex items-center justify-center gap-1.5 font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer bg-blue-600 hover:bg-blue-500 text-white shadow-xs hover:shadow-md hover:shadow-blue-500/25 active:scale-95 transition-all border border-blue-500/40 hover:-translate-y-0.5"
                title="นำเข้าไฟล์รายการสินค้า (Product Catalog)"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <Upload className="h-3.5 w-3.5 text-white group-hover:-translate-y-0.5 transition-transform duration-200" />
                <span>นำเข้าข้อมูลสินค้า</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onOpenImportModal) {
                    onOpenImportModal(salesSubTab === "income" ? "income" : "orders");
                  } else if (setActiveTab) {
                    setActiveTab("import-orders");
                  }
                }}
                className="group relative overflow-hidden flex items-center justify-center gap-1.5 font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer bg-blue-600 hover:bg-blue-500 text-white shadow-xs hover:shadow-md hover:shadow-blue-500/25 active:scale-95 transition-all border border-blue-500/40 hover:-translate-y-0.5"
                title={salesSubTab === "income" ? "นำเข้าไฟล์รายการยอดขาย (Income)" : "นำเข้าไฟล์รายการคำสั่งซื้อ (Orders)"}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <Upload className="h-3.5 w-3.5 text-white group-hover:-translate-y-0.5 transition-transform duration-200" />
                <span>{salesSubTab === "income" ? "นำเข้ารายการยอดขาย" : "นำเข้ารายการคำสั่งซื้อ"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="group flex items-center justify-center gap-1.5 font-medium text-xs px-3.5 py-2 rounded-xl cursor-pointer bg-white dark:bg-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200/90 dark:border-neutral-750 shadow-2xs hover:shadow-xs active:scale-95 transition-all hover:-translate-y-0.5"
            >
              <Printer className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 group-hover:-translate-y-0.5 transition-transform duration-200" />
              <span>พิมพ์/PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="group flex items-center justify-center gap-1.5 font-medium text-xs px-3.5 py-2 rounded-xl cursor-pointer bg-white dark:bg-neutral-850 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-neutral-700 dark:text-neutral-200 hover:text-emerald-700 dark:hover:text-emerald-400 border border-neutral-200/90 dark:border-neutral-750 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-2xs hover:shadow-xs active:scale-95 transition-all hover:-translate-y-0.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-200" />
              <span>ส่งออก Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="group flex items-center justify-center gap-1.5 font-medium text-xs px-3.5 py-2 rounded-xl cursor-pointer bg-white dark:bg-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200/90 dark:border-neutral-750 shadow-2xs hover:shadow-xs active:scale-95 transition-all hover:-translate-y-0.5"
            >
              <Download className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 group-hover:translate-y-0.5 transition-transform duration-200" />
              <span>CSV</span>
            </button>

            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-750 mx-1 hidden sm:block" />

            {(currentUser?.role === "Admin" || currentUser?.role === "Manager") && (
              <button
                type="button"
                onClick={() => {
                  if (salesSubTab === "products") {
                    requestConfirm?.(
                      "ยืนยันการล้างข้อมูลสินค้าทั้งหมด",
                      "คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลสินค้าและไฟล์ข้อมูลทั้งหมดในหน้านี้? ข้อมูลที่ถูกลบสามารถกู้คืนได้ที่ถังขยะ",
                      () => {
                        handleDeleteAllProducts?.();
                        if (orderDatasets.length > 0 || ordersData.length > 0) {
                          handleDeleteAllOrders?.();
                        }
                      },
                      "ล้างข้อมูลสินค้า",
                      "ยกเลิก",
                      "danger"
                    );
                  } else if (salesSubTab === "income") {
                    requestConfirm?.(
                      "ยืนยันการล้างข้อมูลรายรับทั้งหมด",
                      "คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลรายรับและไฟล์นำเข้ารายรับทั้งหมด? ข้อมูลที่ถูกลบสามารถกู้คืนได้ที่ถังขยะ",
                      handleDeleteAllIncome || (() => {}),
                      "ล้างข้อมูลรายรับ",
                      "ยกเลิก",
                      "danger"
                    );
                  } else {
                    requestConfirm?.(
                      "ยืนยันการล้างข้อมูลคำสั่งซื้อทั้งหมด",
                      "คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลคำสั่งซื้อและยอดขายทั้งหมด? ข้อมูลที่ถูกลบสามารถกู้คืนได้ที่ถังขยะ",
                      handleDeleteAllOrders || (() => {}),
                      "ล้างข้อมูลคำสั่งซื้อ",
                      "ยกเลิก",
                      "danger"
                    );
                  }
                }}
                className="group flex items-center justify-center gap-1.5 font-semibold text-xs px-3.5 py-2 rounded-xl cursor-pointer bg-rose-50 hover:bg-rose-100/90 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200/90 dark:border-rose-800/80 hover:border-rose-300 dark:hover:border-rose-700 shadow-2xs hover:shadow-xs hover:shadow-rose-500/10 active:scale-95 transition-all hover:-translate-y-0.5"
                title="ล้างข้อมูลทั้งหมดในหน้านี้"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-200" />
                <span>ล้างข้อมูลทั้งหมด</span>
              </button>
            )}

            {salesSubTab === "products" && (
              <button
                type="button"
                onClick={() => {
                  setIsAddProductOpen?.(true);
                }}
                className="group flex items-center justify-center gap-1.5 font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer bg-neutral-900 hover:bg-black text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 shadow-sm hover:shadow-md active:scale-95 transition-all hover:-translate-y-0.5"
              >
                <Plus className="h-3.5 w-3.5 group-hover:rotate-90 transition-transform duration-200" />
                <span>เพิ่มสินค้าใหม่</span>
              </button>
            )}
          </div>
        </div>
      )}


      {/* ── Subtab 1: Income (แสดงข้อมูลดิบไฟล์รายรับแพลตฟอร์มโดยตรง) ── */}
      {salesSubTab === "income" && (
        <div className="space-y-6 animate-fade-in">
          <DatasetViewer
            datasets={incomeDatasets}
            type="income"
            isDarkMode={isDarkMode}
            onDeleteDataset={onDeleteDataset}
            onImportOrders={onImportOrders}
            requestConfirm={requestConfirm}
            triggerAlert={triggerAlert}
            canUpload={false}
            channelFilter={channelFilter}
            setChannelFilter={setChannelFilter}
          />
        </div>
      )}

      {/* ── Subtab 2: Orders (รายการคำสั่งซื้อ) ── */}
      {salesSubTab === "orders" && (
        <div className="space-y-6 animate-fade-in">
          {/* Orders KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 md:gap-5">
            {/* KPI 1: Gross Sales */}
            <div
              className={`group relative overflow-hidden rounded-2xl border-2 p-4.5 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                isDarkMode
                  ? "bg-gradient-to-br from-emerald-950/30 via-neutral-900/90 to-teal-950/20 border-emerald-500/50 hover:border-emerald-400"
                  : "bg-gradient-to-br from-emerald-50/60 via-emerald-50/20 to-teal-50/40 border-emerald-300 hover:border-emerald-400 hover:shadow-[0_8px_25px_rgba(16,185,129,0.08)]"
              }`}
            >
              <div className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-emerald-500/10 blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500" />
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="flex items-center justify-between relative z-10">
                <div className="space-y-1.5">
                  <span className="text-xs font-bold tracking-tight text-neutral-600 dark:text-neutral-300 block">
                    ยอดขายรวมคำสั่งซื้อ
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base sm:text-lg text-emerald-600 dark:text-emerald-400 font-extrabold font-mono">
                      ฿
                    </span>
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
                      {ordersSummaryKpis.totalSales.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                    ยอดขายทั้งหมดตามตัวกรอง
                  </p>
                </div>
                <div className="p-3 rounded-2xl border shrink-0 transition-all duration-300 group-hover:scale-105 bg-emerald-100/80 text-emerald-600 border-emerald-300/80 dark:bg-emerald-900/50 dark:text-emerald-400 dark:border-emerald-700/60 shadow-xs">
                  <Coins className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* KPI 2: Total Items Sold */}
            <div
              className={`group relative overflow-hidden rounded-2xl border-2 p-4.5 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                isDarkMode
                  ? "bg-gradient-to-br from-purple-950/30 via-neutral-900/90 to-indigo-950/20 border-purple-500/50 hover:border-purple-400"
                  : "bg-gradient-to-br from-purple-50/60 via-purple-50/20 to-indigo-50/40 border-purple-300 hover:border-purple-400 hover:shadow-[0_8px_25px_rgba(168,85,247,0.08)]"
              }`}
            >
              <div className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-purple-500/10 blur-2xl group-hover:bg-purple-500/20 transition-all duration-500" />
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="flex items-center justify-between relative z-10">
                <div className="space-y-1.5">
                  <span className="text-xs font-bold tracking-tight text-neutral-600 dark:text-neutral-300 block">
                    จำนวนสินค้าที่ขายได้
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-purple-600 dark:text-purple-400 font-mono">
                      {ordersSummaryKpis.totalQuantity.toLocaleString()}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-neutral-400 dark:text-neutral-500">
                      ชิ้น
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                    รวมทุกชิ้นในคำสั่งซื้อ
                  </p>
                </div>
                <div className="p-3 rounded-2xl border shrink-0 transition-all duration-300 group-hover:scale-105 bg-purple-100/80 text-purple-600 border-purple-300/80 dark:bg-purple-900/50 dark:text-purple-400 dark:border-purple-700/60 shadow-xs">
                  <Package className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* KPI 3: Total Orders */}
            <div
              className={`group relative overflow-hidden rounded-2xl border-2 p-4.5 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                isDarkMode
                  ? "bg-gradient-to-br from-blue-950/30 via-neutral-900/90 to-sky-950/20 border-blue-500/50 hover:border-blue-400"
                  : "bg-gradient-to-br from-blue-50/60 via-blue-50/20 to-sky-50/40 border-blue-300 hover:border-blue-400 hover:shadow-[0_8px_25px_rgba(59,130,246,0.08)]"
              }`}
            >
              <div className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-blue-500/10 blur-2xl group-hover:bg-blue-500/20 transition-all duration-500" />
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="flex items-center justify-between relative z-10">
                <div className="space-y-1.5">
                  <span className="text-xs font-bold tracking-tight text-neutral-600 dark:text-neutral-300 block">
                    จำนวนคำสั่งซื้อ
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-blue-600 dark:text-blue-400 font-mono">
                      {ordersSummaryKpis.totalCount.toLocaleString()}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-neutral-400 dark:text-neutral-500">
                      ออเดอร์
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                    ตรงกับเงื่อนไขการค้นหา
                  </p>
                </div>
                <div className="p-3 rounded-2xl border shrink-0 transition-all duration-300 group-hover:scale-105 bg-blue-100/80 text-blue-600 border-blue-300/80 dark:bg-blue-900/50 dark:text-blue-400 dark:border-blue-700/60 shadow-xs">
                  <ShoppingCart className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* KPI 4: Paid Success */}
            <div
              className={`group relative overflow-hidden rounded-2xl border-2 p-4.5 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                isDarkMode
                  ? "bg-gradient-to-br from-teal-950/30 via-neutral-900/90 to-emerald-950/20 border-teal-500/50 hover:border-teal-400"
                  : "bg-gradient-to-br from-teal-50/60 via-teal-50/20 to-emerald-50/40 border-teal-300 hover:border-teal-400 hover:shadow-[0_8px_25px_rgba(20,184,166,0.08)]"
              }`}
            >
              <div className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-teal-500/10 blur-2xl group-hover:bg-teal-500/20 transition-all duration-500" />
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-teal-400 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="flex items-center justify-between relative z-10">
                <div className="space-y-1.5">
                  <span className="text-xs font-bold tracking-tight text-neutral-600 dark:text-neutral-300 block">
                    ชำระเงินสำเร็จ
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-teal-600 dark:text-teal-400 font-mono">
                      {ordersSummaryKpis.paidCount}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-neutral-400 dark:text-neutral-500">
                      / {ordersSummaryKpis.totalCount}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                    อัตราสำเร็จ:{" "}
                    <span className="font-bold text-teal-600 dark:text-teal-400">
                      {ordersSummaryKpis.totalCount > 0
                        ? Math.round((ordersSummaryKpis.paidCount / ordersSummaryKpis.totalCount) * 100)
                        : 0}
                      %
                    </span>
                  </p>
                </div>
                <div className="p-3 rounded-2xl border shrink-0 transition-all duration-300 group-hover:scale-105 bg-teal-100/80 text-teal-600 border-teal-300/80 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-700/60 shadow-xs">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left borderless-table">
                <thead>
                  <tr
                    className={`border-b ${
                      isDarkMode ? "border-white/6 bg-white/3" : "border-black/5 bg-black/2"
                    }`}
                  >
                    {[
                      { key: "id" as const, label: "เลขที่ออเดอร์", isKey: false },
                      { key: "customerName" as const, label: "ลูกค้า", isKey: false },
                      { key: "productName" as const, label: "สินค้า & แบรนด์", isKey: false },
                      { key: "quantity" as const, label: "จำนวนชิ้น", isNum: true, isKey: true },
                      { key: "channel" as const, label: "ช่องทาง", isKey: false },
                      { key: "date" as const, label: "วันที่", isKey: true },
                      { key: "total" as const, label: "ยอดขาย", isNum: true, isKey: true },
                      { key: "status" as const, label: "สถานะ", isKey: false },
                    ].map((col) => {
                      const isSorted = ordersSortConfig?.key === col.key;
                      const isAsc = ordersSortConfig?.direction === "asc";
                      let dirLabel = "";
                      if (isSorted) {
                        if (col.key === "date") dirLabel = isAsc ? "เก่าสุด" : "ล่าสุด";
                        else if (col.isNum) dirLabel = isAsc ? "น้อยสุด" : "มากสุด";
                        else dirLabel = isAsc ? "ก-ฮ" : "ฮ-ก";
                      }

                      return (
                        <th
                          key={col.key}
                          onClick={() => handleOrdersSort(col.key)}
                          className={`${thCls} select-none cursor-pointer group/th transition-all ${
                            isSorted
                              ? isDarkMode
                                ? "bg-blue-950/40 text-blue-400 font-extrabold"
                                : "bg-blue-50/80 text-blue-700 font-extrabold"
                              : col.isKey
                                ? "text-apple-primary hover:text-blue-500"
                                : "hover:text-apple-primary"
                          }`}
                          title={`คลิกเพื่อเรียงลำดับตาม ${col.label}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{col.label}</span>
                            {isSorted ? (
                              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-blue-500 text-white font-extrabold shadow-xs shrink-0">
                                <span className="text-[11px] leading-none">{isAsc ? "▲" : "▼"}</span>
                                <span className="text-[9px] font-bold">{dirLabel}</span>
                              </div>
                            ) : col.isKey ? (
                              <div className="text-blue-500/40 group-hover/th:text-blue-500 group-hover/th:opacity-100 transition-all shrink-0">
                                <ArrowUpDown className="h-3 w-3" />
                              </div>
                            ) : null}
                          </div>
                        </th>
                      );
                    })}
                    <th className={`${thCls} text-right`}>จัดการ</th>
                  </tr>
                </thead>
                <tbody className="no-dividers">
                  {sortedOrdersData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-16 text-center text-sm font-bold text-apple-tertiary">
                        <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        ไม่พบรายการคำสั่งซื้อที่ตรงกับตัวกรอง
                      </td>
                    </tr>
                  ) : (
                    sortedOrdersData.map((o) => {
                      const meta = getPlatformMeta(o.channel);
                      return (
                        <tr key={o.id} className="hover:bg-apple-tertiary transition-colors animate-fade-up-row">
                          <td className={`${tdCls} font-mono text-xs text-apple-secondary font-semibold`}>
                            {o.id.replace(/-row-.*$/, "")}
                          </td>
                          <td className={tdCls}>
                            <p className="font-bold text-sm text-apple-primary">{o.customerName}</p>
                            {o.email && <p className="text-xs text-apple-tertiary mt-0.5">{o.email}</p>}
                          </td>
                          <td className={tdCls}>
                            <p
                              className="font-semibold text-apple-primary text-sm max-w-[280px] truncate"
                              title={o.productName}
                            >
                              {o.productName}
                            </p>
                            {o.brand && (
                              <p className="text-[10px] text-apple-tertiary font-bold mt-0.5">
                                แบรนด์: {o.brand}
                              </p>
                            )}
                          </td>
                          <td className={`${tdCls} font-bold text-apple-secondary text-sm`}>
                            {o.quantity || 1} ชิ้น
                          </td>
                          <td className={tdCls}>
                            <span
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border ${meta.bg} ${meta.text} ${meta.border}`}
                            >
                              {o.channel}
                            </span>
                          </td>
                          <td className={`${tdCls} font-mono text-xs text-apple-secondary`}>
                            {o.date}
                          </td>
                          <td className={tdCls}>
                            <div className="font-black text-sm text-apple-primary">
                              {formatCurrency(o.total || 0)}
                            </div>
                          </td>
                          <td className={tdCls}>
                            <span
                              className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusBadge(
                                o.status
                              )}`}
                            >
                              {statusLabel(o.status)}
                            </span>
                          </td>
                          <td className={`${tdCls} text-right`}>
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditingOrder(o);
                                  setIsEditOrderOpen(true);
                                }}
                                className="p-1.5 text-apple-secondary hover:text-apple-primary hover:bg-apple-tertiary rounded-lg transition-all cursor-pointer"
                                title="แก้ไข"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              {(currentUser.role === "Admin" || currentUser.role === "Manager") ? (
                                <button
                                  onClick={() =>
                                    requestConfirm(
                                      "ยืนยันการลบ",
                                      `ลบรายการของ "${o.customerName}" ยอดเงิน ${formatCurrency(o.total || 0)}?`,
                                      () => handleDeleteOrder(o.id)
                                    )
                                  }
                                  className="p-1.5 text-apple-secondary hover:text-red-500 hover:bg-red-500/8 rounded-lg transition-all cursor-pointer"
                                  title="ลบ"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <span className="p-1.5">
                                  <Lock className="h-3.5 w-3.5 text-apple-tertiary" />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile/Tablet Card View */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
            {filteredOrdersData.length === 0 ? (
              <div className="col-span-full glass-card rounded-2xl p-8 text-center text-sm font-bold text-apple-tertiary">
                ไม่พบรายการที่ตรงกับตัวกรอง
              </div>
            ) : (
              filteredOrdersData.map((o) => {
                const meta = getPlatformMeta(o.channel);
                return (
                  <div
                    key={o.id}
                    className="glass-card rounded-2xl p-4 space-y-3 relative hover-scale-card"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-xs text-apple-secondary font-bold">
                        {o.id.replace(/-row-.*$/, "")}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${meta.bg} ${meta.text} ${meta.border}`}
                      >
                        {o.channel}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-apple-primary text-sm">
                        {o.customerName}
                      </h4>
                      <p className="text-xs text-apple-tertiary">{o.email}</p>
                    </div>

                    <div className="border-t border-apple-primary/40 pt-2 flex justify-between items-center text-xs">
                      <div>
                        <p className="text-apple-secondary font-semibold">
                          {o.productName} (x{o.quantity || 1})
                        </p>
                        <p className="text-[10px] text-apple-tertiary mt-0.5">
                          {o.brand}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-apple-secondary">{o.date}</p>
                      </div>
                    </div>

                    <div className="border-t border-apple-primary/40 pt-2.5 flex justify-between items-center">
                      <div>
                        <p className="font-black text-sm text-apple-primary">
                          {formatCurrency(o.total || 0)}
                        </p>
                        <p className="text-[10px] text-apple-secondary mt-0.5 font-bold">
                          สุทธิ:{" "}
                          <span className="text-emerald-500 font-extrabold">
                            {formatCurrency(
                              o.netIncome ?? (o.total || 0) - (o.platformFee || 0)
                            )}
                          </span>
                        </p>
                        {o.platformFee || o.shippingFee ? (
                          <p className="text-[9px] text-apple-tertiary mt-0.5">
                            ธรรมเนียม: {formatCurrency(o.platformFee || 0)}{" "}
                            | ส่ง: {formatCurrency(o.shippingFee || 0)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusBadge(
                            o.status
                          )}`}
                        >
                          {statusLabel(o.status)}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingOrder(o);
                              setIsEditOrderOpen(true);
                            }}
                            className="p-1 text-apple-secondary hover:text-apple-primary hover:bg-apple-tertiary rounded-lg transition-all cursor-pointer"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          {(currentUser.role === "Admin" || currentUser.role === "Manager") && (
                            <button
                              onClick={() =>
                                requestConfirm(
                                  "ยืนยันการลบ",
                                  `ลบรายการของ "${o.customerName}" ยอดเงิน ${formatCurrency(o.total || 0)}?`,
                                  () => handleDeleteOrder(o.id)
                                )
                              }
                              className="p-1 text-apple-secondary hover:text-red-500 hover:bg-red-500/8 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

            {/* ── Subtab 2: Products ── */}
      {salesSubTab === "products" && (
        <div className="space-y-6 animate-fade-in">
          {/* 1. Page Header Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Total Products */}
            <div
              className={`group relative p-5 rounded-2xl border flex items-center justify-between transition-all duration-300 overflow-hidden cursor-default hover:-translate-y-1 hover:shadow-lg ${
                isDarkMode
                  ? "bg-neutral-900/60 border-neutral-800 hover:border-blue-500/40"
                  : "bg-white/80 border-neutral-200/80 hover:border-blue-500/30"
              } backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.02)] before:absolute before:-right-8 before:-top-8 before:w-24 before:h-24 before:rounded-full before:bg-blue-500/10 before:opacity-0 group-hover:before:opacity-100 before:transition-all before:duration-500 before:blur-xl`}
            >
              <div className="space-y-1 relative z-10">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium block">
                    จำนวนสินค้าทั้งหมด
                  </span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    คลังสินค้า
                  </span>
                </div>
                <p className="text-2xl font-mono font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                  {productKpis.totalUniqueProducts} <span className="text-xs font-sans font-normal text-neutral-400">รายการ</span>
                </p>
              </div>
              <div className="relative z-10 w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/15 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300 shadow-2xs">
                <Package className="h-5 w-5" />
              </div>
            </div>

            {/* KPI 2: Units Sold */}
            <div
              className={`group relative p-5 rounded-2xl border flex items-center justify-between transition-all duration-300 overflow-hidden cursor-default hover:-translate-y-1 hover:shadow-lg ${
                isDarkMode
                  ? "bg-neutral-900/60 border-neutral-800 hover:border-purple-500/40"
                  : "bg-white/80 border-neutral-200/80 hover:border-purple-500/30"
              } backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.02)] before:absolute before:-right-8 before:-top-8 before:w-24 before:h-24 before:rounded-full before:bg-purple-500/10 before:opacity-0 group-hover:before:opacity-100 before:transition-all before:duration-500 before:blur-xl`}
            >
              <div className="space-y-1 relative z-10">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium block">
                    จำนวนชิ้นที่ขายได้รวม
                  </span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    คำสั่งซื้อ
                  </span>
                </div>
                <p className="text-2xl font-mono font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                  {productKpis.totalQuantitySold.toLocaleString()} <span className="text-xs font-sans font-normal text-neutral-400">ชิ้น</span>
                </p>
              </div>
              <div className="relative z-10 w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/15 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300 shadow-2xs">
                <ShoppingCart className="h-5 w-5" />
              </div>
            </div>

            {/* KPI 3: Revenue */}
            <div
              className={`group relative p-5 rounded-2xl border flex items-center justify-between transition-all duration-300 overflow-hidden cursor-default hover:-translate-y-1 hover:shadow-lg ${
                isDarkMode
                  ? "bg-neutral-900/60 border-neutral-800 hover:border-emerald-500/40"
                  : "bg-white/80 border-neutral-200/80 hover:border-emerald-500/30"
              } backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.02)] before:absolute before:-right-8 before:-top-8 before:w-24 before:h-24 before:rounded-full before:bg-emerald-500/10 before:opacity-0 group-hover:before:opacity-100 before:transition-all before:duration-500 before:blur-xl`}
            >
              <div className="space-y-1 relative z-10">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium block">
                    ยอดขายสินค้าสะสม
                  </span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    รายรับสุทธิ
                  </span>
                </div>
                <p className="text-2xl font-mono font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(productKpis.totalRevenue)}
                </p>
              </div>
              <div className="relative z-10 w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300 shadow-2xs">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            {/* KPI 4: Average Price */}
            <div
              className={`group relative p-5 rounded-2xl border flex items-center justify-between transition-all duration-300 overflow-hidden cursor-default hover:-translate-y-1 hover:shadow-lg ${
                isDarkMode
                  ? "bg-neutral-900/60 border-neutral-800 hover:border-amber-500/40"
                  : "bg-white/80 border-neutral-200/80 hover:border-amber-500/30"
              } backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.02)] before:absolute before:-right-8 before:-top-8 before:w-24 before:h-24 before:rounded-full before:bg-amber-500/10 before:opacity-0 group-hover:before:opacity-100 before:transition-all before:duration-500 before:blur-xl`}
            >
              <div className="space-y-1 relative z-10">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium block">
                    ราคาเฉลี่ยสินค้า
                  </span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    ต่อหน่วย
                  </span>
                </div>
                <p className="text-2xl font-mono font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                  {productKpis.averagePrice > 0 ? formatCurrency(productKpis.averagePrice) : "—"}
                </p>
              </div>
              <div className="relative z-10 w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/15 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300 shadow-2xs">
                <Info className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* 2. Platform Selector Tabs */}
          {!(isViewingDetails && currentSelectedProduct) && (
            <div className="inline-flex p-1 bg-neutral-100/90 dark:bg-neutral-900/80 backdrop-blur-md rounded-xl border border-neutral-200/70 dark:border-neutral-800 gap-1 overflow-x-auto max-w-full shadow-inner mobile-scroll-x">
              {([
                { id: "all" as const, label: "ทุกแพลตฟอร์ม", color: "bg-blue-500", glow: "shadow-blue-500/10" },
                { id: "lazada" as const, label: "Lazada", color: "bg-[#2E2BB8]", glow: "shadow-blue-600/15" },
                { id: "shopee" as const, label: "Shopee", color: "bg-[#EE4D2D]", glow: "shadow-orange-500/15" },
                { id: "tiktok" as const, label: "TikTok Shop", color: "bg-[#FE2C55]", glow: "shadow-rose-500/15" },
              ] as const).map((p) => {
                const isActive = activeProductPlatform === p.id;
                const count = p.id === "all" ? platformCounts.all : (platformCounts[p.id] || 0);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProductPlatform(p.id);
                      setActiveDatasetId(null);
                      setIsViewingDetails(false);
                      setSelectedProduct(null);
                    }}
                    className={`group shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer border ${
                      isActive
                        ? isDarkMode
                          ? `bg-neutral-800 border-neutral-700/80 text-white shadow-md ${p.glow} font-semibold scale-[1.02]`
                          : `bg-white border-neutral-200/80 text-neutral-900 shadow-xs ${p.glow} font-semibold scale-[1.02]`
                        : "bg-transparent border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    }`}
                  >
                    {p.id !== "all" && (
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.color} ${isActive ? "ring-2 ring-current/20 scale-110" : ""}`} />
                    )}
                    <span>{p.label}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md font-semibold transition-colors ${
                        isActive
                          ? isDarkMode
                            ? "bg-white/15 text-neutral-200"
                            : "bg-neutral-100 text-neutral-700"
                          : "bg-black/[0.04] dark:bg-white/[0.06] text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 3. Main Content Grid or Details */}
          {isViewingDetails && currentSelectedProduct ? (
            <div className="space-y-6 animate-fade-in">
              <button
                onClick={() => setIsViewingDetails(false)}
                className="btn-apple-secondary flex items-center justify-center gap-2 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] border border-black/5 dark:border-white/5 bg-apple-secondary hover:bg-apple-tertiary/40 w-fit"
              >
                <ChevronLeft className="h-4 w-4 text-apple-primary" />
                <span>ย้อนกลับไปยังรายการสินค้า</span>
              </button>

              <ProductDetailsView
                product={currentSelectedProduct}
                orders={allowedOrders.filter((o) => {
                  if (currentActiveDatasetId === "all") {
                    if (activeProductPlatform !== "all") {
                      const channelLower = o.channel?.toLowerCase();
                      const platformLower = activeProductPlatform.toLowerCase();
                      if (channelLower === platformLower) return true;
                      if (channelLower === "tiktok shop" && platformLower === "tiktok") return true;
                      if (channelLower === "line oa" && platformLower === "line") return true;
                      return false;
                    }
                    return true;
                  }
                  if (o.datasetId) return o.datasetId === currentActiveDatasetId;
                  if (orderDatasets.length === 1) return true;
                  const ds = orderDatasets.find((d) => d.id === currentActiveDatasetId);
                  if (!ds) return false;
                  const channelLower = o.channel?.toLowerCase();
                  const platformLower = ds.platform?.toLowerCase();
                  if (channelLower === platformLower) return true;
                  if (channelLower === "tiktok shop" && platformLower === "tiktok") return true;
                  if (channelLower === "line oa" && platformLower === "line") return true;
                  return false;
                })}
                formatCurrency={formatCurrency}
                isDarkMode={isDarkMode}
                currentUser={currentUser}
                setEditingProduct={setEditingProduct}
                setIsEditProductOpen={setIsEditProductOpen}
                handleDeleteProduct={handleDeleteProduct}
                requestConfirm={requestConfirm}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start animate-fade-in">
              {/* Uploaded Files Sidebar */}
              <div className="space-y-2 lg:col-span-1">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                    ไฟล์ที่อัปโหลดไว้
                  </span>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200/60 dark:border-neutral-700/60">
                    {filteredOrderDatasets.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {filteredOrderDatasets.length === 0 ? (
                    <div className="p-8 text-center text-xs text-neutral-400 dark:text-neutral-500 border border-dashed rounded-2xl border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex flex-col items-center justify-center gap-2.5 transition-all">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 dark:text-neutral-500 shadow-2xs">
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>
                      <span className="text-[11px] leading-relaxed">ไม่มีไฟล์ข้อมูลสำหรับช่องทางนี้</span>
                    </div>
                  ) : (
                    <>
                      {filteredOrderDatasets.map((d) => {
                        const isActive = currentActiveDatasetId === d.id;
                        const pfColor =
                          d.platform === "lazada"
                            ? "bg-[#2E2BB8]"
                            : d.platform === "shopee"
                              ? "bg-[#EE4D2D]"
                              : d.platform === "tiktok"
                                ? "bg-[#FE2C55]"
                                : d.platform === "facebook"
                                  ? "bg-[#1877F2]"
                                  : d.platform === "line"
                                    ? "bg-[#06C755]"
                                    : "bg-neutral-400";
                        return (
                          <div
                            key={d.id}
                            onClick={() => {
                              setActiveDatasetId(d.id);
                              setIsViewingDetails(false);
                              setSelectedProduct(null);
                            }}
                            className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all duration-200 relative overflow-hidden select-none flex flex-col justify-between gap-2.5 ${
                              isActive
                                ? isDarkMode
                                  ? "border-neutral-700 bg-neutral-850 shadow-2xs"
                                  : "border-neutral-300 bg-white shadow-2xs"
                                : isDarkMode
                                  ? "bg-neutral-900/60 border-neutral-800 hover:bg-neutral-850/60 hover:border-neutral-750"
                                  : "bg-white/80 border-neutral-200/80 hover:bg-white hover:border-neutral-300"
                            }`}
                          >
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                              style={{
                                backgroundColor:
                                  d.platform === "lazada"
                                    ? "#2E2BB8"
                                    : d.platform === "shopee"
                                      ? "#EE4D2D"
                                      : d.platform === "tiktok"
                                        ? "#FE2C55"
                                        : d.platform === "facebook"
                                          ? "#1877F2"
                                          : d.platform === "line"
                                            ? "#06C755"
                                            : "#7A8699",
                              }}
                            />
                            <div className="space-y-1 pl-1">
                              <h4 className="text-xs font-semibold text-neutral-900 dark:text-white truncate pr-4" title={d.fileName}>
                                {d.fileName}
                              </h4>
                              {(() => {
                                const periodLabel = getDatasetPeriodLabel(d);
                                return periodLabel ? (
                                  <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-medium border border-blue-200/50 dark:border-blue-800/40">
                                    <Calendar className="h-2.5 w-2.5 shrink-0" />
                                    <span>ข้อมูล: {periodLabel}</span>
                                  </div>
                                ) : null;
                              })()}
                              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>นำเข้า: {d.uploadedAt}</span>
                              </p>
                            </div>
                            <div className="flex items-center justify-between pl-1">
                              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-md text-white ${pfColor}`}>
                                {d.platform.toUpperCase()}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestConfirm(
                                    "ยืนยันการลบไฟล์ข้อมูล",
                                    `คุณแน่ใจหรือไม่ว่าต้องการลบไฟล์ "${d.fileName}"? ข้อมูลยอดขายและรายการสินค้าที่นำเข้าจากไฟล์นี้จะถูกลบออก (สามารถกู้คืนได้ที่ถังขยะ)`,
                                    () => onDeleteDataset(d.id),
                                    "ลบไฟล์ข้อมูล",
                                    "ยกเลิก",
                                    "danger"
                                  );
                                }}
                                className="text-neutral-400 hover:text-rose-500 p-1 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                                title="ลบไฟล์ข้อมูลนี้"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>

              {/* Products list and Details Display Area */}
              <div className="lg:col-span-3 space-y-6">
                {currentActiveDatasetId === "all" ? (
                  /* Render Combined Product Sales Summary */
                  <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
                    <div className={`px-6 py-4 border-b ${isDarkMode ? "border-white/6 bg-white/3" : "border-black/5 bg-black/2"} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                      <div>
                        <h4 className="font-bold text-sm text-apple-primary">
                          {salesSubTab === "products" ? "สรุปข้อมูลสินค้าในคลังทั้งหมด" : "สรุปรายการยอดขายสินค้าทุกไฟล์รวมกัน"}
                        </h4>
                        <p className="text-xs mt-0.5 text-apple-secondary">
                          {salesSubTab === "products" ? "แสดงรายการสินค้าในคลังพร้อมจำนวนชิ้นที่ขายได้และรายได้สะสม" : "แสดงรายการสินค้าพร้อมจำนวนชิ้นที่ขายได้และรายได้สุทธิสะสมจากทุกไฟล์อัปโหลด"}
                        </p>
                      </div>
                    </div>
                    
                    {/* Desktop Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-left borderless-table">
                        <thead>
                          <tr className={`border-b ${isDarkMode ? "border-white/6 bg-white/3" : "border-black/5 bg-black/2"}`}>
                            <th className={thCls}>ลำดับ</th>
                            <th className={thCls}>ชื่อสินค้า</th>
                            <th className={thCls}>แบรนด์</th>
                            <th className={thCls}>หมวดหมู่</th>
                            <th className={`${thCls} text-right`}>ราคาขาย</th>
                            <th className={`${thCls} text-center`}>จำนวนขาย</th>
                            <th className={`${thCls} text-right`}>ยอดขายสินค้า</th>
                            <th className={`${thCls} text-center`}>สต็อก</th>
                            <th className={`${thCls} text-center`}>สถานะ</th>
                          </tr>
                        </thead>
                        <tbody className="no-dividers">
                          {productsInFile.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="px-5 py-12 text-center text-xs font-bold text-apple-secondary italic">
                                ไม่มีข้อมูลสินค้าที่มียอดจำหน่าย
                              </td>
                            </tr>
                          ) : (
                            productsInFile.map((prod, idx) => {
                              let badgeColor = "bg-neutral-100 text-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-400";
                              if (prod.status === "In Stock") {
                                badgeColor = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400";
                              } else if (prod.status === "Low Stock") {
                                badgeColor = "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400";
                              } else if (prod.status === "Out of Stock") {
                                badgeColor = "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400";
                              }

                              return (
                                <tr 
                                  key={idx} 
                                  className="hover:bg-apple-tertiary transition-colors animate-fade-up-row cursor-pointer"
                                  onClick={() => {
                                    setSelectedProduct({
                                      id: prod.id || "",
                                      name: prod.name,
                                      category: prod.category || "Beauty",
                                      brand: prod.brand,
                                      price: prod.price,
                                      sales: prod.sales,
                                      revenue: prod.revenue,
                                      stock: prod.stock,
                                      status: prod.status
                                    });
                                    setIsViewingDetails(true);
                                  }}
                                >
                                  <td className={`${tdCls} font-mono text-xs text-apple-secondary`}>{idx + 1}</td>
                                  <td className={`${tdCls} font-bold text-blue-500 hover:underline max-w-[280px] truncate`} title={prod.name}>
                                    {prod.name}
                                  </td>
                                  <td className={`${tdCls} font-medium text-apple-secondary`}>{prod.brand || "ทั่วไป"}</td>
                                  <td className={`${tdCls} text-apple-secondary`}>{prod.category || "Electronics"}</td>
                                  <td className={`${tdCls} font-mono text-right font-semibold`}>{Number(prod.price) > 0 ? formatCurrency(Number(prod.price)) : "—"}</td>
                                  <td className={`${tdCls} font-mono text-center font-bold`}>{(Number(prod.sales) || 0).toLocaleString()} ชิ้น</td>
                                  <td className={`${tdCls} font-mono text-right font-black text-emerald-500`}>{formatCurrency(Number(prod.revenue) || 0)}</td>
                                  <td className={`${tdCls} font-mono text-center`}>{(Number(prod.stock) || 0).toLocaleString()} ชิ้น</td>
                                  <td className={`${tdCls} text-center`}>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border border-transparent ${badgeColor}`}>
                                      {prod.status === "In Stock" ? "มีสินค้า" : prod.status === "Low Stock" ? "สต็อกต่ำ" : "หมด"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card List View */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 lg:hidden">
                      {productsInFile.length === 0 ? (
                        <div className="col-span-full py-8 text-center text-xs font-bold text-apple-secondary italic">
                          ไม่มีข้อมูลสินค้าที่มียอดจำหน่าย
                        </div>
                      ) : (
                        productsInFile.map((prod, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => {
                              setSelectedProduct({
                                id: prod.id || "",
                                name: prod.name,
                                category: prod.category || "Beauty",
                                brand: prod.brand || "ทั่วไป",
                                price: Number(prod.price) || 0,
                                sales: Number(prod.sales) || 0,
                                revenue: Number(prod.revenue) || 0,
                                stock: Number(prod.stock) || 0,
                                status: prod.status
                              });
                              setIsViewingDetails(true);
                            }}
                            className="p-4 rounded-xl border border-apple-primary/10 bg-apple-secondary/30 space-y-2 cursor-pointer hover:bg-apple-tertiary transition-colors"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-[10px] font-mono text-apple-tertiary font-bold">#{idx + 1}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                prod.status === "In Stock" ? "bg-emerald-500/10 text-emerald-500" : prod.status === "Low Stock" ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"
                              } border border-transparent`}>
                                {prod.status === "In Stock" ? "มีสินค้า" : prod.status === "Low Stock" ? "สต็อกต่ำ" : "หมด"}
                              </span>
                            </div>
                            <h5 className="font-bold text-apple-primary text-xs line-clamp-2 hover:text-blue-500">{prod.name}</h5>
                            <div className="flex justify-between items-center text-[10px] pt-1 border-t border-apple-primary/10">
                              <div>
                                <span className="text-apple-tertiary block">แบรนด์</span>
                                <span className="font-bold text-apple-secondary">{prod.brand || "ทั่วไป"}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-apple-tertiary block">ยอดขาย</span>
                                <span className="font-black text-emerald-500">{formatCurrency(Number(prod.revenue) || 0)} ({(Number(prod.sales) || 0).toLocaleString()} ชิ้น)</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : activeDataset ? (
                  <>
                    {/* Header info */}
                    <div
                      className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isDarkMode ? "bg-neutral-900 border-white/5" : "bg-white border-black/5"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded text-white ${
                              activeDataset.platform === "lazada"
                                  ? "bg-[#2E2BB8]"
                                  : activeDataset.platform === "shopee"
                                    ? "bg-[#EE4D2D]"
                                    : activeDataset.platform === "tiktok"
                                      ? "bg-[#FE2C55]"
                                      : activeDataset.platform === "facebook"
                                        ? "bg-[#1877F2]"
                                        : activeDataset.platform === "line"
                                          ? "bg-[#06C755]"
                                          : "bg-neutral-400"
                            }`}
                          >
                            {activeDataset.platform.toUpperCase()}
                          </span>
                          <h3 className="text-xs font-black text-apple-primary truncate max-w-sm md:max-w-md">
                            {activeDataset.fileName}
                          </h3>
                        </div>
                        <p className="text-[10px] text-apple-secondary font-medium">
                          {activeDataset.uploadedAt === "—"
                            ? `แผ่นงาน ${activeDataset.sheets.length} ชีต`
                            : `นำเข้าเมื่อ: ${activeDataset.uploadedAt} · แผ่นงาน ${activeDataset.sheets.length} ชีต · ยอดรวมหน้า ${activeSheet?.rows.length || 0} แถว`}
                        </p>
                      </div>

                      {/* Header controls: Sheets tabs & raw vs summary toggle */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        {/* Sheets Selection Tabs */}
                        {activeDataset.sheets.length > 1 && activeSheet && (
                          <div className="flex bg-apple-tertiary/20 p-1 rounded-xl border border-apple-primary/10 gap-1 overflow-x-auto">
                            {activeDataset.sheets.map((s) => {
                              const isSheetActive = activeSheet.name === s.name;
                              return (
                                <button
                                  key={s.name}
                                  onClick={() => {
                                    setActiveSheetName((prev) => ({
                                      ...prev,
                                      [activeDataset.id]: s.name,
                                    }));
                                  }}
                                  className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap cursor-pointer transition-all ${
                                    isSheetActive
                                      ? isDarkMode
                                        ? "bg-neutral-800 text-white shadow"
                                        : "bg-white text-black shadow-sm"
                                      : "bg-transparent text-apple-secondary hover:text-apple-primary"
                                  }`}
                                >
                                  {s.name} ({s.rows.length})
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* View Mode Toggle */}
                        <div className="flex bg-apple-tertiary/20 p-1 rounded-xl border border-apple-primary/10 gap-1">
                          <button
                            type="button"
                            onClick={() => setProductViewMode("summary")}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap cursor-pointer transition-all ${
                              productViewMode === "summary"
                                ? isDarkMode
                                  ? "bg-neutral-800 text-white shadow"
                                  : "bg-white text-black shadow-sm"
                                : "bg-transparent text-apple-secondary hover:text-apple-primary"
                            }`}
                          >
                            สรุปยอดสินค้า
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductViewMode("raw")}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap cursor-pointer transition-all ${
                              productViewMode === "raw"
                                ? isDarkMode
                                  ? "bg-neutral-800 text-white shadow"
                                  : "bg-white text-black shadow-sm"
                                : "bg-transparent text-apple-secondary hover:text-apple-primary"
                            }`}
                          >
                            ตารางแผ่นงานดิบ
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* View content based on view mode */}
                    {productViewMode === "summary" ? (
                      /* File Product Sales Summary */
                      <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
                        {/* Desktop Table View */}
                        <div className="hidden lg:block overflow-x-auto">
                          <table className="w-full text-left borderless-table">
                            <thead>
                              <tr className={`border-b ${isDarkMode ? "border-white/6 bg-white/3" : "border-black/5 bg-black/2"}`}>
                                <th className={thCls}>ลำดับ</th>
                                <th className={thCls}>ชื่อสินค้า</th>
                                <th className={thCls}>แบรนด์</th>
                                <th className={thCls}>หมวดหมู่</th>
                                <th className={`${thCls} text-right`}>ราคาขาย</th>
                                <th className={`${thCls} text-center`}>จำนวนขาย</th>
                                <th className={`${thCls} text-right`}>ยอดขายสินค้า</th>
                                <th className={`${thCls} text-center`}>สต็อก</th>
                                <th className={`${thCls} text-center`}>สถานะ</th>
                              </tr>
                            </thead>
                            <tbody className="no-dividers">
                              {productsInFile.length === 0 ? (
                                <tr>
                                  <td colSpan={9} className="px-5 py-12 text-center text-xs font-bold text-apple-secondary italic">
                                    ไม่มีข้อมูลสินค้าที่มียอดจำหน่ายในไฟล์นี้
                                  </td>
                                </tr>
                              ) : (
                                productsInFile.map((prod, idx) => {
                                  let badgeColor = "bg-neutral-100 text-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-400";
                                  if (prod.status === "In Stock") {
                                    badgeColor = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400";
                                  } else if (prod.status === "Low Stock") {
                                    badgeColor = "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400";
                                  } else if (prod.status === "Out of Stock") {
                                    badgeColor = "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400";
                                  }

                                  return (
                                    <tr 
                                      key={idx} 
                                      className="hover:bg-apple-tertiary transition-colors animate-fade-up-row cursor-pointer"
                                      onClick={() => {
                                        setSelectedProduct({
                                          id: prod.id || "",
                                          name: prod.name,
                                          category: prod.category || "Beauty",
                                          brand: prod.brand,
                                          price: prod.price,
                                          sales: prod.sales,
                                          revenue: prod.revenue,
                                          stock: prod.stock,
                                          status: prod.status
                                        });
                                        setIsViewingDetails(true);
                                      }}
                                    >
                                      <td className={`${tdCls} font-mono text-xs text-apple-secondary`}>{idx + 1}</td>
                                      <td className={`${tdCls} font-bold text-blue-500 hover:underline max-w-[280px] truncate`} title={prod.name}>
                                        {prod.name}
                                      </td>
                                      <td className={`${tdCls} font-medium text-apple-secondary`}>{prod.brand || "ทั่วไป"}</td>
                                      <td className={`${tdCls} text-apple-secondary`}>{prod.category || "Electronics"}</td>
                                      <td className={`${tdCls} font-mono text-right font-semibold`}>{Number(prod.price) > 0 ? formatCurrency(Number(prod.price)) : "—"}</td>
                                      <td className={`${tdCls} font-mono text-center font-bold`}>{(Number(prod.sales) || 0).toLocaleString()} ชิ้น</td>
                                      <td className={`${tdCls} font-mono text-right font-black text-emerald-500`}>{formatCurrency(Number(prod.revenue) || 0)}</td>
                                      <td className={`${tdCls} font-mono text-center`}>{(Number(prod.stock) || 0).toLocaleString()} ชิ้น</td>
                                      <td className={`${tdCls} text-center`}>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border border-transparent ${badgeColor}`}>
                                          {prod.status === "In Stock" ? "มีสินค้า" : prod.status === "Low Stock" ? "สต็อกต่ำ" : "หมด"}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Card List View */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 lg:hidden">
                          {productsInFile.length === 0 ? (
                            <div className="col-span-full py-8 text-center text-xs font-bold text-apple-secondary italic">
                              ไม่มีข้อมูลสินค้าที่มียอดจำหน่ายในไฟล์นี้
                            </div>
                          ) : (
                            productsInFile.map((prod, idx) => (
                              <div 
                                key={idx} 
                                onClick={() => {
                                  setSelectedProduct({
                                    id: prod.id || "",
                                    name: prod.name,
                                    category: prod.category || "Beauty",
                                    brand: prod.brand || "ทั่วไป",
                                    price: Number(prod.price) || 0,
                                    sales: Number(prod.sales) || 0,
                                    revenue: Number(prod.revenue) || 0,
                                    stock: Number(prod.stock) || 0,
                                    status: prod.status
                                  });
                                  setIsViewingDetails(true);
                                }}
                                className="p-4 rounded-xl border border-apple-primary/10 bg-apple-secondary/30 space-y-2 cursor-pointer hover:bg-apple-tertiary transition-colors"
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <span className="text-[10px] font-mono text-apple-tertiary font-bold">#{idx + 1}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    prod.status === "In Stock" ? "bg-emerald-500/10 text-emerald-500" : prod.status === "Low Stock" ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"
                                  } border border-transparent`}>
                                    {prod.status === "In Stock" ? "มีสินค้า" : prod.status === "Low Stock" ? "สต็อกต่ำ" : "หมด"}
                                  </span>
                                </div>
                                <h5 className="font-bold text-apple-primary text-xs line-clamp-2 hover:text-blue-500">{prod.name}</h5>
                                <div className="flex justify-between items-center text-[10px] pt-1 border-t border-apple-primary/10">
                                  <div>
                                    <span className="text-apple-tertiary block">แบรนด์</span>
                                    <span className="font-bold text-apple-secondary">{prod.brand || "ทั่วไป"}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-apple-tertiary block">ยอดขาย</span>
                                    <span className="font-black text-emerald-500">{formatCurrency(Number(prod.revenue) || 0)} ({(Number(prod.sales) || 0).toLocaleString()} ชิ้น)</span>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : (
                      /* File Raw Grid (Excel Table) */
                      activeSheet ? (
                        <ExcelTable
                          headers={activeSheet.headers}
                          rows={activeSheet.rows}
                          isDarkMode={isDarkMode}
                        />
                      ) : (
                        <div
                          className={`p-8 text-center border-2 border-dashed rounded-3xl ${
                            isDarkMode ? "border-white/5 bg-white/[0.01]" : "border-black/5 bg-apple-tertiary/10"
                          }`}
                        >
                          <p className="text-xs text-apple-secondary">ไม่พบรายการข้อมูลสินค้า</p>
                        </div>
                      )
                    )}
                  </>
                ) : (
                  <div
                    className={`p-16 text-center border rounded-2xl flex flex-col items-center justify-center transition-all ${
                      isDarkMode ? "bg-neutral-900/60 border-neutral-800" : "bg-white/80 border-neutral-200/80"
                    } backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.02)]`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-center mb-3.5 text-neutral-400 dark:text-neutral-500 shadow-2xs">
                      <FileSpreadsheet className="h-6 w-6 stroke-[1.5]" />
                    </div>
                    <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">ไม่มีไฟล์ข้อมูลเปิดอยู่</h3>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 max-w-sm mx-auto leading-relaxed">
                      ไม่พบไฟล์ข้อมูลสำหรับช่องทางนี้ หรือกรุณาเลือกไฟล์ทางด้านซ้ายเพื่อเปิดดูข้อมูล
                    </p>
                  </div>
                )}
              </div>


            </div>
          )}
        </div>
      )}

      {/* ── Subtab 3: Brands ── */}
      {salesSubTab === "brands" && (
        <div className="space-y-6">
          {/* Brand Date Filter Bar */}
          <div className="glass-card bg-white dark:bg-neutral-900/90 rounded-2xl p-4 sm:p-5 animate-fade-in flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/40 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
                <Calendar className="h-5 w-5 stroke-[1.8]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm sm:text-base text-neutral-800 dark:text-neutral-100">
                    ช่วงเวลาข้อมูลแบรนด์
                  </h4>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/70 dark:border-blue-800/50">
                    <Zap className="h-2.5 w-2.5 fill-blue-500 text-blue-500" />
                    ตัวกรองวันที่
                  </span>
                </div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                  เลือกช่วงวันที่เพื่อดูสรุปยอดจำหน่ายและรายได้ตามแบรนด์
                </p>
              </div>
            </div>

            {/* Presets & Custom Date Pickers */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              {/* Quick Presets Segmented Bar */}
              <div className="flex items-center p-1 rounded-2xl border border-neutral-300/80 dark:border-neutral-700 bg-neutral-100/80 dark:bg-neutral-800/70 shadow-2xs">
                {[
                  { id: "all" as const, label: "ทั้งหมด" },
                  { id: "today" as const, label: "วันนี้" },
                  { id: "7days" as const, label: "7 วัน" },
                  { id: "30days" as const, label: "30 วัน" },
                  { id: "thisMonth" as const, label: "เดือนนี้" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleBrandDatePreset(item.id)}
                    className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                      brandDatePreset === item.id
                        ? "bg-blue-600 dark:bg-blue-500 text-white shadow-sm font-semibold"
                        : "font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Date Pickers */}
              <div className="flex items-center gap-1.5">
                <DatePickerField
                  value={brandStartDate}
                  onChange={(val) => handleBrandCustomDateChange("start", val)}
                  placeholder="เริ่มต้น"
                  className="relative flex items-center justify-between bg-white dark:bg-neutral-900 border border-neutral-300/80 dark:border-neutral-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl px-3 py-1.5 min-h-[36px] transition-all cursor-pointer select-none text-xs font-medium text-neutral-700 dark:text-neutral-200 w-[125px] sm:w-[130px] shadow-2xs"
                  textClassName="text-xs font-medium text-neutral-700 dark:text-neutral-200 mr-2 flex-1 text-left whitespace-nowrap"
                />
                <span className="text-neutral-400 font-normal text-xs px-0.5">–</span>
                <DatePickerField
                  value={brandEndDate}
                  onChange={(val) => handleBrandCustomDateChange("end", val)}
                  placeholder="สิ้นสุด"
                  className="relative flex items-center justify-between bg-white dark:bg-neutral-900 border border-neutral-300/80 dark:border-neutral-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-xl px-3 py-1.5 min-h-[36px] transition-all cursor-pointer select-none text-xs font-medium text-neutral-700 dark:text-neutral-200 w-[125px] sm:w-[130px] shadow-2xs"
                  textClassName="text-xs font-medium text-neutral-700 dark:text-neutral-200 mr-2 flex-1 text-left whitespace-nowrap"
                />
                {(brandStartDate || brandEndDate || brandDatePreset !== "all") && (
                  <button
                    type="button"
                    onClick={() => handleBrandDatePreset("all")}
                    className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 font-semibold cursor-pointer px-2 py-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0"
                    title="ล้างตัวกรองวันที่"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>รีเซ็ต</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Brand Selector Pills */}
          {salesByBrandSummary.length > 0 && (
            <div className="glass-card rounded-2xl p-4 sm:p-5 animate-fade-in space-y-3 border border-apple-primary/10 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-apple-secondary">
                    เลือกสินค้าหรือแบรนด์ที่ต้องการดูรายละเอียด
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-apple-tertiary">
                  พบ {salesByBrandSummary.length} แบรนด์
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {/* Pill for All Products */}
                <button
                  onClick={() => setSelectedBrand("all")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    activeBrandName === "all"
                      ? "bg-blue-600 dark:bg-blue-500 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30 font-extrabold scale-[1.02]"
                      : isDarkMode
                        ? "bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white border border-white/8"
                        : "bg-black/5 text-neutral-700 hover:bg-black/8 hover:text-neutral-900 border border-black/5"
                  }`}
                >
                  <Store className="h-3.5 w-3.5 opacity-80" />
                  <span>สินค้าทั้งหมด</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeBrandName === "all" ? "bg-white/20 text-white" : "bg-black/5 dark:bg-white/10 text-apple-secondary"}`}>
                    {totalAllBrandsSales.toLocaleString()} ชิ้น
                  </span>
                </button>

                {salesByBrandSummary.map((item, idx) => {
                  const isActive = activeBrandName === item.brand;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedBrand(item.brand)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        isActive
                          ? "bg-blue-600 dark:bg-blue-500 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30 font-extrabold scale-[1.02]"
                          : isDarkMode
                            ? "bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white border border-white/8"
                            : "bg-black/5 text-neutral-700 hover:bg-black/8 hover:text-neutral-900 border border-black/5"
                      }`}
                    >
                      <span>{item.brand}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${isActive ? "bg-white/20 text-white" : "bg-black/5 dark:bg-white/10 text-apple-secondary"}`}>
                        {item.sales.toLocaleString()} ชิ้น
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detailed Product view of Active Brand / All Products */}
          {activeBrandName && (
            <div className="space-y-6">
              {/* Brand Detailed KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
                {/* KPI 1: Gross Sales */}
                <div className="glass-card rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg border border-emerald-500/20 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/[0.03] to-transparent group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-black uppercase tracking-wider text-apple-secondary">
                      {activeBrandName === "all" ? "รายรับรวมสินค้าทั้งหมด" : "รายรับรวมแบรนด์"}
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                      <DollarSign className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-mono font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                    {formatCurrency(selectedBrandTotals.revenue)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-apple-primary/5 text-[11px] text-apple-tertiary font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>รายได้สุทธิหลังหักรายการยกเลิก</span>
                  </div>
                </div>

                {/* KPI 2: Total Units Sold */}
                <div className="glass-card rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg border border-blue-500/20 dark:border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-blue-500/[0.03] to-transparent group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-black uppercase tracking-wider text-apple-secondary">
                      จำนวนชิ้นที่จำหน่าย
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-mono font-black text-apple-primary tracking-tight">
                    {selectedBrandTotals.sales.toLocaleString()}{" "}
                    <span className="text-sm font-bold text-apple-secondary font-sans">ชิ้น</span>
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-apple-primary/5 text-[11px] text-apple-tertiary font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>ปริมาณการจัดส่งสินค้าออกสำเร็จ</span>
                  </div>
                </div>

                {/* KPI 3: Unique SKUs */}
                <div className="glass-card rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg border border-indigo-500/20 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-indigo-500/[0.03] to-transparent group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-black uppercase tracking-wider text-apple-secondary">
                      ความหลากหลายสินค้า
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                      <Layers className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-mono font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                    {productsForSelectedBrand.length}{" "}
                    <span className="text-sm font-bold text-apple-secondary font-sans">รายการ</span>
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-apple-primary/5 text-[11px] text-apple-tertiary font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <span>จำนวน SKU สินค้าที่จำหน่ายจริง</span>
                  </div>
                </div>

                {/* KPI 4: Brand AOV */}
                <div className="glass-card rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg border border-rose-500/20 dark:border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-rose-500/[0.03] to-transparent group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-black uppercase tracking-wider text-apple-secondary">
                      ราคาเฉลี่ยต่อชิ้น
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-mono font-black text-rose-600 dark:text-rose-400 tracking-tight">
                    {selectedBrandTotals.sales > 0 && selectedBrandTotals.revenue > 0
                      ? formatCurrency(selectedBrandTotals.revenue / selectedBrandTotals.sales)
                      : "—"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-apple-primary/5 text-[11px] text-apple-tertiary font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>มูลค่าถัวเฉลี่ยต่อหน่วยสินค้า</span>
                  </div>
                </div>
              </div>

              {/* Table Container Card */}
              <div className="glass-card rounded-2xl overflow-hidden animate-fade-in border border-apple-primary/10 shadow-xs">
                <div
                  className={`px-5 sm:px-6 py-4 border-b ${isDarkMode ? "border-white/6 bg-white/[0.02]" : "border-black/5 bg-black/[0.015]"} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Store className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-apple-primary">
                          {activeBrandName === "all" ? "รายละเอียดสินค้าทั้งหมด" : `รายละเอียดสินค้าแบรนด์: ${activeBrandName}`}
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {productsForSelectedBrand.length} รายการ
                        </span>
                      </div>
                      <p className="text-xs mt-0.5 text-apple-secondary">
                        {activeBrandName === "all"
                          ? "แสดงรายละเอียดสินค้าทุกแบรนด์จำแนกยอดขายและรายได้ (คลิกหัวตารางเพื่อเรียงข้อมูล)"
                          : `แสดงรายละเอียดสินค้าเฉพาะแบรนด์ ${activeBrandName} จำแนกยอดขายและรายได้ (คลิกหัวตารางเพื่อเรียงข้อมูล)`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 no-print shrink-0">
                    <button
                      onClick={exportBrandToExcel}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 select-none text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      ส่งออก Excel
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 select-none text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer"
                    >
                      <Printer className="h-4 w-4" />
                      พิมพ์รายงาน
                    </button>
                    {selectedBrand && selectedBrand !== "all" && (
                      <button
                        onClick={() => setSelectedBrand("all")}
                        className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 font-extrabold cursor-pointer px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors"
                        title="ดูสินค้าทั้งหมดทุกแบรนด์"
                      >
                        ดูสินค้าทั้งหมด
                      </button>
                    )}
                  </div>
                </div>

                {/* Desktop table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left borderless-table">
                    <thead>
                      <tr
                        className={`border-b ${isDarkMode ? "border-white/6 bg-white/[0.03]" : "border-black/5 bg-black/[0.02]"}`}
                      >
                        <th
                          onClick={() => toggleSort("name")}
                          className={`${thCls} w-2/4 cursor-pointer hover:text-blue-500 transition-colors select-none py-3.5`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>ชื่อสินค้า</span>
                            <span className={`text-xs ${brandProductSort.key === "name" ? "text-blue-500 dark:text-blue-400 font-black" : "text-neutral-400 opacity-60"}`}>
                              {brandProductSort.key === "name" ? (brandProductSort.direction === "asc" ? "▲" : "▼") : "⇅"}
                            </span>
                          </div>
                        </th>
                        <th
                          onClick={() => toggleSort("sales")}
                          className={`${thCls} w-1/4 text-center cursor-pointer hover:text-blue-500 transition-colors select-none py-3.5`}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span>ชิ้นที่ขายได้</span>
                            <span className={`text-xs ${brandProductSort.key === "sales" ? "text-blue-500 dark:text-blue-400 font-black" : "text-neutral-400 opacity-60"}`}>
                              {brandProductSort.key === "sales" ? (brandProductSort.direction === "asc" ? "▲" : "▼") : "⇅"}
                            </span>
                          </div>
                        </th>
                        <th
                          onClick={() => toggleSort("revenue")}
                          className={`${thCls} w-1/4 text-right cursor-pointer hover:text-blue-500 transition-colors select-none py-3.5`}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <span>รายได้สุทธิ</span>
                            <span className={`text-xs ${brandProductSort.key === "revenue" ? "text-blue-500 dark:text-blue-400 font-black" : "text-neutral-400 opacity-60"}`}>
                              {brandProductSort.key === "revenue" ? (brandProductSort.direction === "asc" ? "▲" : "▼") : "⇅"}
                            </span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="no-dividers">
                      {productsForSelectedBrand.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-5 py-16 text-center"
                          >
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-apple-primary/10 flex items-center justify-center text-apple-tertiary">
                                <Boxes className="h-7 w-7 stroke-[1.5]" />
                              </div>
                              <p className="text-sm font-bold text-apple-primary">
                                ไม่พบสินค้าตามตัวกรองที่เลือก
                              </p>
                              <p className="text-xs text-apple-secondary max-w-xs">
                                ลองปรับเปลี่ยนช่วงเวลาหรือเลือกตัวกรองแบรนด์อื่นเพื่อดูข้อมูลยอดขาย
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        productsForSelectedBrand.map((prod, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-blue-500/[0.04] dark:hover:bg-blue-500/[0.06] transition-colors animate-fade-up-row"
                          >
                            <td
                              className={`${tdCls} font-bold text-apple-primary text-sm max-w-sm truncate w-2/4 py-3.5`}
                              title={prod.name}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <span className="text-[11px] font-mono text-apple-tertiary shrink-0 w-6 text-right">
                                  {idx + 1}.
                                </span>
                                {activeBrandName === "all" && prod.brand && (
                                  <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                    {prod.brand}
                                  </span>
                                )}
                                <span className="truncate font-semibold text-apple-primary hover:text-blue-500 transition-colors">
                                  {prod.name}
                                </span>
                              </div>
                            </td>
                            <td
                              className={`${tdCls} text-center font-mono font-bold text-apple-primary w-1/4 py-3.5`}
                            >
                              <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 text-apple-primary font-mono text-xs">
                                {prod.sales.toLocaleString()} ชิ้น
                              </span>
                            </td>
                            <td
                              className={`${tdCls} text-right font-black font-mono text-emerald-600 dark:text-emerald-400 w-1/4 py-3.5 text-sm`}
                            >
                              {formatCurrency(prod.revenue)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {productsForSelectedBrand.length > 0 && (
                      <tfoot className="border-t-2 border-apple-primary/20 bg-apple-tertiary/30">
                        <tr className="font-extrabold text-apple-primary">
                          <td className={`${tdCls} font-black w-2/4 py-4`}>
                            <div className="flex items-center gap-2">
                              <span>รวมทั้งหมด</span>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400">
                                {productsForSelectedBrand.length} รายการสินค้า
                              </span>
                            </div>
                          </td>
                          <td
                            className={`${tdCls} text-center font-mono font-black text-apple-primary w-1/4 py-4 text-sm`}
                          >
                            {selectedBrandTotals.sales.toLocaleString()} ชิ้น
                          </td>
                          <td
                            className={`${tdCls} text-right font-mono font-black text-emerald-600 dark:text-emerald-400 w-1/4 py-4 text-base`}
                          >
                            {formatCurrency(selectedBrandTotals.revenue)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Mobile view */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 lg:hidden">
                  {productsForSelectedBrand.length === 0 ? (
                    <div className="col-span-full py-12 text-center flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 flex items-center justify-center text-apple-tertiary">
                        <Boxes className="h-6 w-6 stroke-[1.5]" />
                      </div>
                      <p className="text-xs font-bold text-apple-primary">
                        ไม่พบสินค้าตามตัวกรองที่เลือก
                      </p>
                    </div>
                  ) : (
                    <>
                      {productsForSelectedBrand.map((prod, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl border border-apple-primary/10 bg-apple-secondary/20 hover:bg-apple-secondary/40 space-y-2.5 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h5
                              className="font-bold text-apple-primary text-xs line-clamp-2"
                              title={prod.name}
                            >
                              {prod.name}
                            </h5>
                            {activeBrandName === "all" && prod.brand && (
                              <span className="shrink-0 px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                {prod.brand}
                              </span>
                            )}
                          </div>
                          <div className="border-t border-apple-primary/10 pt-2 flex justify-between items-center text-[10px]">
                            <div>
                              <span className="text-apple-tertiary">ยอดจำหน่าย</span>
                              <p className="font-mono font-bold text-apple-primary mt-0.5">
                                {prod.sales.toLocaleString()} ชิ้น
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-apple-tertiary">รายได้สุทธิ</span>
                              <p className="font-mono font-black text-emerald-600 dark:text-emerald-400 mt-0.5 text-xs">
                                {formatCurrency(prod.revenue)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Mobile summary card for products */}
                      <div className="col-span-full p-4 rounded-2xl border bg-gradient-to-br from-blue-500/10 via-apple-tertiary/40 to-transparent border-blue-500/20 space-y-3">
                        <div className="flex justify-between items-center font-black text-apple-primary text-sm">
                          <span>
                            ยอดรวมทั้งหมด ({productsForSelectedBrand.length} รายการ)
                          </span>
                        </div>
                        <div className="border-t border-apple-primary/20 pt-2.5 flex justify-between items-center text-xs font-bold text-apple-primary">
                          <div>
                            <span className="text-apple-secondary text-[11px]">รวมยอดจำหน่าย</span>
                            <p className="text-sm font-mono font-bold mt-0.5">
                              {selectedBrandTotals.sales.toLocaleString()} ชิ้น
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-apple-secondary text-[11px]">รวมรายได้สุทธิ</span>
                            <p className="text-base font-mono font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {formatCurrency(selectedBrandTotals.revenue)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export const SalesTab = React.memo(SalesTabComponent);
