import React, { useMemo, useState } from "react";
import {
  Search,
  Trash2,
  Plus,
  Edit,
  Lock,
  Download,
  Bell,
  Upload,
  Calendar,
  ShoppingCart,
  TrendingUp,
  Package,
  Info,
  ChevronLeft,
  Printer,
  FileSpreadsheet,
  Globe,
  Layers,
} from "lucide-react";
import * as XLSX from "xlsx";

import type { Order, Product, AppUser, UploadedDataset } from "../types";
import { DatasetViewer } from "./DatasetViewer";
import { ExcelTable } from "./ExcelTable";

interface SalesTabProps {
  isDarkMode: boolean;
  currentUser: AppUser;
  salesSubTab: "transactions" | "products" | "brands" | "uploaded-files";
  setSalesSubTab: (
    val: "transactions" | "products" | "brands" | "uploaded-files",
  ) => void;
  products: Product[];
  orders: Order[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  channelFilter: string;
  setChannelFilter: (val: string) => void;
  setIsAddOrderOpen: (val: boolean) => void;
  setIsAddProductOpen: (val: boolean) => void;
  setEditingOrder: (val: Order | null) => void;
  setIsEditOrderOpen: (val: boolean) => void;
  handleDeleteAllOrders: () => void;
  handleDeleteOrder: (id: string) => void;
  requestConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
  ) => void;
  formatCurrency: (val: number) => string;
  triggerAlert: (
    msg: string,
    type?: "success" | "warning" | "info" | "error",
  ) => void;
  roleStyles: { bgActive: string };
  setEditingProduct: (p: Product | null) => void;
  setIsEditProductOpen: (val: boolean) => void;
  handleDeleteProduct: (id: string) => void;
  handleDeleteAllProducts: () => void;
  setIsAuditLogsModalOpen: (val: boolean) => void;
  setActiveTab: (
    tab: "dashboard" | "sales" | "calculator" | "import-orders" | "users",
  ) => void;
  uploadedDatasets: UploadedDataset[];
  productFiles: UploadedDataset[];
  onDeleteDataset: (id: string) => void;
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
  setEditingProduct: (p: Product | null) => void;
  setIsEditProductOpen: (val: boolean) => void;
  handleDeleteProduct: (id: string) => void;
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
      className={`p-5 rounded-3xl border flex flex-col gap-6 ${
        isDarkMode ? "bg-neutral-900 border-white/5" : "bg-white border-black/5"
      }`}
    >
      {/* Product Title / Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-apple-primary/10 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border ${
                isDarkMode
                  ? "bg-white/5 border-white/8 text-neutral-400"
                  : "bg-black/4 border-black/6 text-neutral-500"
              }`}
            >
              {product.category}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border ${stockBadge(product.stock)}`}
            >
              {stockLabel(product.stock)}
            </span>
          </div>
          <h3 className="font-extrabold text-apple-primary text-base md:text-lg mt-1.5">
            {product.name}
          </h3>
          <p className="text-[10px] font-bold text-apple-secondary mt-0.5">
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
                setEditingProduct(originalProduct);
                setIsEditProductOpen(true);
              }}
              className="px-3 py-1.5 bg-apple-tertiary hover:bg-apple-tertiary/80 text-apple-primary text-[10px] font-black rounded-lg border border-apple-primary/10 flex items-center gap-1 cursor-pointer transition-all"
            >
              <Edit className="h-3.5 w-3.5" />
              <span>แก้ไขสินค้า</span>
            </button>
            {(currentUser.role === "Admin" ||
              currentUser.role === "Manager") && (
              <button
                onClick={() =>
                  requestConfirm(
                    "ยืนยันการลบสินค้า",
                    `ลบรายการสินค้า "${product.name}" หรือไม่? ข้อมูลสต็อกสินค้าชิ้นนี้จะหายไปจากระบบ`,
                    () => handleDeleteProduct(product.id!),
                  )
                }
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-[10px] font-black rounded-lg border border-rose-500/20 flex items-center gap-1 cursor-pointer transition-all"
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
            value: formatCurrency(product.price),
            icon: <Info className="h-4 w-4 text-blue-500" />,
            bg: "bg-blue-500/5 border-blue-500/10",
          },
          {
            label: "คงเหลือในคลัง",
            value: `${product.stock} ชิ้น`,
            icon: <Package className="h-4 w-4 text-purple-500" />,
            bg: "bg-purple-500/5 border-purple-500/10",
          },
          {
            label: "จำหน่ายแล้ว",
            value: `${totalUnits} ชิ้น`,
            icon: <ShoppingCart className="h-4 w-4 text-amber-500" />,
            bg: "bg-amber-500/5 border-amber-500/10",
          },
          {
            label: "รายได้รวมสะสม",
            value: formatCurrency(totalRev),
            icon: <TrendingUp className="h-4 w-4 text-emerald-500" />,
            bg: "bg-emerald-500/5 border-emerald-500/10",
          },
        ].map((kpi, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-2xl border ${kpi.bg} flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between text-apple-secondary mb-1">
              <span className="text-[9px] font-bold uppercase tracking-wider">
                {kpi.label}
              </span>
              {kpi.icon}
            </div>
            <p className="text-base md:text-lg font-black text-apple-primary tracking-tight mt-1">
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

const KEY_MAPS_PRODUCT = {
  name: ["product name", "ชื่อสินค้า", "ชื่อรายละเอียดสินค้า", "สินค้า", "name", "product_name"],
  category: ["category", "หมวดหมู่หลัก", "หมวดหมู่", "กลุ่มสินค้า", "product_category"],
  brand: ["brand", "แบรนด์สินค้า", "แบรนด์", "ยี่ห้อ", "product_brand"],
  price: ["price", "ราคาขาย", "ราคา", "ราคาตั้ง", "product_price", "ขาย"],
  stock: ["stock", "จำนวนสินค้า", "จำนวนคลัง", "จำนวน", "คงเหลือ", "คลัง", "สต็อก", "stock_qty", "qty"]
};

export const SalesTab: React.FC<SalesTabProps> = (props) => {
  const {
    isDarkMode,
    currentUser,
    salesSubTab,
    setSalesSubTab,
    products,
    searchQuery,
    setSearchQuery,
    channelFilter,
    setChannelFilter,
    setIsAddOrderOpen,
    setIsAddProductOpen,
    setEditingOrder,
    setIsEditOrderOpen,
    handleDeleteAllOrders,
    handleDeleteOrder,
    requestConfirm,
    formatCurrency,
    triggerAlert,
    roleStyles,
    handleDeleteAllProducts,
    setIsAuditLogsModalOpen,
    setActiveTab,
    uploadedDatasets,
    productFiles,
    onDeleteDataset,
    setEditingProduct,
    setIsEditProductOpen,
    handleDeleteProduct,
  } = props;

  const [ordersData, setOrdersData] = useState<Order[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("orders") || "[]");
    } catch {
      return [];
    }
  });

  const [incomeData, setIncomeData] = useState<Order[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("income_data") || "[]");
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    const handleUpdate = () => {
      try {
        setOrdersData(JSON.parse(localStorage.getItem("orders") || "[]"));
        setIncomeData(JSON.parse(localStorage.getItem("income_data") || "[]"));
      } catch (e) {
        console.warn("Failed to load data from localStorage:", e);
      }
    };
    window.addEventListener("mock_supabase_orders_updated", handleUpdate);
    return () => {
      window.removeEventListener("mock_supabase_orders_updated", handleUpdate);
    };
  }, []);

  const handleClearAllProductData = () => {
    localStorage.removeItem("orders");
    localStorage.removeItem("mock_supabase_orders");
    localStorage.removeItem("products");
    localStorage.removeItem("productFiles");
    localStorage.removeItem("uploadedDatasets");
    localStorage.removeItem("income_data");

    setIncomeData([]);
    setOrdersData([]);
    setSelectedProduct(null);
    setIsViewingDetails(false);

    if (handleDeleteAllProducts) {
      handleDeleteAllProducts();
    }
    if (handleDeleteAllOrders) {
      handleDeleteAllOrders();
    }

    triggerAlert("ล้างข้อมูลสินค้าและคำสั่งซื้อทั้งหมดสำเร็จ", "success");
  };

  const [yearFilter, setYearFilter] = useState("All");
  const [recordTypeFilter, setRecordTypeFilter] = useState<
    "order" | "income"
  >("order");

  const salesChannelStyle = useMemo(() => {
    switch (channelFilter) {
      case "Facebook": return "text-[#1877F2] dark:text-[#4f95ff]";
      case "LINE OA": return "text-[#06C755] dark:text-[#39d97a]";
      case "Shopee": return "text-[#EE4D2D] dark:text-[#ff6c50]";
      case "Lazada": return "text-[#2E2BB8] dark:text-[#5c59f0]";
      case "TikTok Shop": return "text-[#FE2C55] dark:text-[#ff5577]";
      case "อื่นๆ": return "text-purple-500 dark:text-purple-400";
      default: return "text-blue-500 dark:text-blue-400";
    }
  }, [channelFilter]);

  const salesYearStyle = useMemo(() => {
    switch (yearFilter) {
      case "2026": return "text-indigo-500 dark:text-indigo-400";
      case "2025": return "text-teal-500 dark:text-teal-400";
      case "2024": return "text-amber-500 dark:text-amber-400";
      default: return "text-rose-500 dark:text-rose-400";
    }
  }, [yearFilter]);

  const [fileViewerType, setFileViewerType] = useState<"income" | "order">(
    "order",
  );

  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [productViewMode, setProductViewMode] = useState<"summary" | "raw">("summary");
  const [activeProductPlatform, setActiveProductPlatform] = useState<
    "all" | "lazada" | "shopee" | "tiktok" | "facebook" | "line"
  >("all");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
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

  const [activeSheetName, setActiveSheetName] = useState<Record<string, string>>({}); // fileId -> sheetName

  const orderDatasets = useMemo(() => {
    return uploadedDatasets.filter((d) => d.fileType !== "product");
  }, [uploadedDatasets]);

  const allowedOrders = useMemo(() => {
    const incomeLookup = new Map<string, Order>();
    incomeData.forEach((inc) => {
      if (inc && inc.id) {
        const cleanId = inc.id.replace(/-row-.*$/, "").trim().toLowerCase();
        incomeLookup.set(cleanId, inc);
      }
    });

    return ordersData.map((o) => {
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
  }, [ordersData, incomeData]);

  const sidebarFiles = useMemo(() => {
    if (salesSubTab === "products") {
      return productFiles;
    }
    return orderDatasets;
  }, [salesSubTab, productFiles, orderDatasets]);

  const filteredOrderDatasets = useMemo(() => {
    if (activeProductPlatform === "all") return sidebarFiles;
    return sidebarFiles.filter((d) => d.platform === activeProductPlatform);
  }, [sidebarFiles, activeProductPlatform]);

  const currentActiveDatasetId = useMemo(() => {
    if (filteredOrderDatasets.length === 0) {
      if (incomeData.length > 0 || ordersData.length > 0) return "all";
      return null;
    }
    if (activeDatasetId === "all") {
      return filteredOrderDatasets.length === 1 ? filteredOrderDatasets[0].id : "all";
    }
    if (
      activeDatasetId &&
      filteredOrderDatasets.some((d) => d.id === activeDatasetId)
    ) {
      return activeDatasetId;
    }
    return filteredOrderDatasets.length === 1 ? filteredOrderDatasets[0].id : "all"; // Default to first file if only 1, otherwise "all" to show combined view
  }, [filteredOrderDatasets, activeDatasetId, incomeData, ordersData]);

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

    const isProductFile = productFiles.some((f) => f.id === currentActiveDatasetId);

    if (isProductFile) {
      const ds = productFiles.find((f) => f.id === currentActiveDatasetId);
      if (!ds) return [];
      const sheetName = activeSheetName[ds.id] || ds.sheets[0]?.name;
      const sheet = ds.sheets.find((s) => s.name === sheetName) || ds.sheets[0];
      if (!sheet) return [];

      return sheet.rows.map((row) => {
        const getVal = (keys: string[]) => {
          const matchedKey = Object.keys(row).find(k => keys.some(x => k.toLowerCase().includes(x)));
          return matchedKey ? row[matchedKey] : undefined;
        };

        const name = String(getVal(KEY_MAPS_PRODUCT.name) || "").trim();
        const rawCategory = String(getVal(KEY_MAPS_PRODUCT.category) || "");
        const category: Product["category"] =
          rawCategory === "Electronics" ||
          rawCategory === "Apparel" ||
          rawCategory === "Home" ||
          rawCategory === "Beauty"
            ? rawCategory
            : "Electronics";
        const brand = String(getVal(KEY_MAPS_PRODUCT.brand) || "ทั่วไป");
        const price = Number(getVal(KEY_MAPS_PRODUCT.price) || 0);
        const stock = Number(getVal(KEY_MAPS_PRODUCT.stock) || 0);

        // Compute sales and revenue by searching orders in the system for this product!
        const matchingOrders = allowedOrders.filter(o => o.productName && o.productName.toLowerCase() === name.toLowerCase() && o.status !== "Refunded");
        const sales = matchingOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
        const revenue = matchingOrders.reduce((sum, o) => sum + (o.total || 0), 0);

        const status: Product["status"] = stock === 0 ? "Out of Stock" : stock <= 10 ? "Low Stock" : "In Stock";

        return {
          id: "",
          name,
          category,
          brand,
          price,
          sales,
          revenue,
          stock,
          status
        };
      }).filter(p => p.name !== "");
    }

    if (currentActiveDatasetId === "all" && salesSubTab === "products") {
      if (products && products.length > 0) {
        return products.map((p) => {
          const matchingOrders = allowedOrders.filter(o => {
            if (o.productName && o.productName.toLowerCase() === p.name.toLowerCase() && o.status !== "Refunded") {
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
            return false;
          });
          const sales = matchingOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
          const revenue = matchingOrders.reduce((sum, o) => sum + (o.total || 0), 0);
          return {
            ...p,
            sales,
            revenue
          };
        });
      } else {
        const summary: Record<string, Product> = {};
        allowedOrders.forEach((o) => {
          if (o.isIncome || !o.productName) return;
          if (activeProductPlatform !== "all") {
            const channelLower = o.channel?.toLowerCase();
            const platformLower = activeProductPlatform.toLowerCase();
            const matchesPlatform = channelLower === platformLower ||
              (channelLower === "tiktok shop" && platformLower === "tiktok") ||
              (channelLower === "line oa" && platformLower === "line");
            if (!matchesPlatform) return;
          }
          const keyName = o.productName.trim();
          if (!keyName) return;
          const lowerName = keyName.toLowerCase();
          if (!summary[lowerName]) {
            summary[lowerName] = {
              id: "",
              name: keyName,
              brand: o.brand || "ทั่วไป",
              category: "Electronics",
              price: (o.total || 0) / (o.quantity || 1) || 0,
              sales: 0,
              revenue: 0,
              stock: 0,
              status: "In Stock"
            };
          }
          if (o.status !== "Refunded") {
            summary[lowerName].sales += o.quantity || 1;
            summary[lowerName].revenue += Number(o.total || 0);
          }
        });
        return Object.values(summary).sort((a, b) => b.revenue - a.revenue);
      }
    }

    const fileOrders = allowedOrders.filter((o) => {
      if (o.isIncome) return false;
      if (currentActiveDatasetId === "all") {
        if (activeProductPlatform !== "all") {
          const channelLower = o.channel?.toLowerCase();
          const platformLower = activeProductPlatform.toLowerCase();
          if (channelLower === platformLower) return true;
          if (channelLower === "tiktok shop" && platformLower === "tiktok")
            return true;
          if (channelLower === "line oa" && platformLower === "line") return true;
          return false;
        }
        return true;
      }
      if (o.datasetId) return o.datasetId === currentActiveDatasetId;
      const ds = orderDatasets.find((d) => d.id === currentActiveDatasetId);
      if (!ds) return false;
      const channelLower = o.channel?.toLowerCase();
      const platformLower = ds.platform?.toLowerCase();
      if (channelLower === platformLower) return true;
      if (channelLower === "tiktok shop" && platformLower === "tiktok")
        return true;
      if (channelLower === "line oa" && platformLower === "line") return true;
      return false;
    });

    const summary: Record<
      string,
      {
        id?: string;
        name: string;
        brand: string;
        category: string;
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
      const mainP = products.find(
        (p) => p.name.toLowerCase() === keyName.toLowerCase(),
      );

      if (!summary[keyName]) {
        summary[keyName] = {
          id: mainP?.id,
          name: keyName,
          brand: o.brand || mainP?.brand || "ทั่วไป",
          category: mainP?.category || "Beauty",
          price: mainP?.price || (o.total || 0) / (o.quantity || 1),
          sales: 0,
          revenue: 0,
          stock: mainP?.stock ?? 0,
          status: mainP?.status || "In Stock",
        };
      }

      if (o.status !== "Refunded") {
        summary[keyName].sales += o.quantity || 1;
        summary[keyName].revenue += Number(o.total || 0);
      }
    });

    return Object.values(summary).sort((a, b) => b.revenue - a.revenue);
  }, [currentActiveDatasetId, products, activeProductPlatform, orderDatasets, productFiles, salesSubTab, activeSheetName, allowedOrders]);

  // filteredProductsInFile is unused, removed

  const productKpis = useMemo(() => {
    const totalUniqueProducts = productsInFile.length;
    const totalQuantitySold = productsInFile.reduce((sum, p) => sum + p.sales, 0);
    const totalRevenue = productsInFile.reduce((sum, p) => sum + p.revenue, 0);
    const averagePrice =
      totalUniqueProducts > 0
        ? productsInFile.reduce((sum, p) => sum + p.price, 0) / totalUniqueProducts
        : 0;

    return {
      totalUniqueProducts,
      totalQuantitySold,
      totalRevenue,
      averagePrice,
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
    return ordersData.filter((o) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        (o.customerName?.toLowerCase() || "").includes(q) ||
        (o.productName?.toLowerCase() || "").includes(q) ||
        (o.brand?.toLowerCase() || "").includes(q) ||
        (o.id?.toLowerCase() || "").includes(q);

      return (
        matchSearch &&
        (channelFilter === "All" ||
          (channelFilter === "อื่นๆ"
            ? !["Facebook", "LINE OA", "Shopee", "Lazada", "TikTok Shop"].includes(o.channel)
            : o.channel === channelFilter)) &&
        (yearFilter === "All" || o.date.startsWith(yearFilter))
      );
    });
  }, [ordersData, searchQuery, channelFilter, yearFilter]);

  const filteredIncomeData = useMemo(() => {
    return incomeData.filter((o) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        (o.productName?.toLowerCase() || "").includes(q) ||
        (o.brand?.toLowerCase() || "").includes(q) ||
        (o.id?.toLowerCase() || "").includes(q);

      return (
        matchSearch &&
        (channelFilter === "All" ||
          (channelFilter === "อื่นๆ"
            ? !["Facebook", "LINE OA", "Shopee", "Lazada", "TikTok Shop"].includes(o.channel)
            : o.channel === channelFilter)) &&
        (yearFilter === "All" || o.date.startsWith(yearFilter))
      );
    });
  }, [incomeData, searchQuery, channelFilter, yearFilter]);

  const filteredOrders = useMemo(() => {
    return recordTypeFilter === "income" ? filteredIncomeData : filteredOrdersData;
  }, [recordTypeFilter, filteredIncomeData, filteredOrdersData]);

  const salesByBrandSummary = useMemo(() => {
    const summary: Record<
      string,
      { brand: string; productCount: number; sales: number; revenue: number }
    > = {};

    // 1. Gather all unique brands from orders (and products as fallback)
    const allBrands = new Set<string>();
    products.forEach((p) => allBrands.add(p.brand || "ทั่วไป"));
    allowedOrders.forEach((o) => {
      const matchRecordType =
        (recordTypeFilter === "income" && o.isIncome) ||
        (recordTypeFilter === "order" && !o.isIncome);
      if (matchRecordType) {
        allBrands.add(o.brand || "ทั่วไป");
      }
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
        const matchRecordType =
          (recordTypeFilter === "income" && o.isIncome) ||
          (recordTypeFilter === "order" && !o.isIncome);

        const matchesChannel =
          channelFilter === "All" ||
          (channelFilter === "อื่นๆ"
            ? !["Facebook", "LINE OA", "Shopee", "Lazada", "TikTok Shop"].includes(o.channel)
            : o.channel === channelFilter);
        const matchesYear =
          yearFilter === "All" || o.date.startsWith(yearFilter);

        if (matchRecordType && matchesChannel && matchesYear) {
          const b = o.brand || "ทั่วไป";
          if (!summary[b]) {
            summary[b] = { brand: b, productCount: 0, sales: 0, revenue: 0 };
          }
          summary[b].sales += o.quantity || 1;
          summary[b].revenue += Number(o.total || 0);
        }
      }
    });

    // 4. Calculate unique product count for each brand from all orders
    Object.keys(summary).forEach((b) => {
      const uniqueProductNames = new Set<string>();

      // Look in orders
      allowedOrders.forEach((o) => {
        const matchRecordType =
          (recordTypeFilter === "income" && o.isIncome) ||
          (recordTypeFilter === "order" && !o.isIncome);
        if (matchRecordType) {
          const orderBrand = o.brand || "ทั่วไป";
          if (orderBrand === b) {
            uniqueProductNames.add(o.productName);
          }
        }
      });

      // Look in products as fallback
      products.forEach((p) => {
        const prodBrand = p.brand || "ทั่วไป";
        if (prodBrand === b) {
          uniqueProductNames.add(p.name);
        }
      });

      summary[b].productCount = uniqueProductNames.size;
    });

    // 5. Filter and Sort
    const query = searchQuery.toLowerCase();
    let result = Object.values(summary).filter((item) =>
      item.brand.toLowerCase().includes(query),
    );

    if (channelFilter !== "All") {
      result = result.filter((item) => item.sales > 0);
    }

    return result.sort((a, b) => b.revenue - a.revenue);
  }, [products, allowedOrders, searchQuery, channelFilter, yearFilter, recordTypeFilter]);

  const activeBrandName = useMemo(() => {
    if (selectedBrand) return selectedBrand;
    if (salesByBrandSummary.length > 0) return salesByBrandSummary[0].brand;
    return null;
  }, [selectedBrand, salesByBrandSummary]);

  const productsForSelectedBrand = useMemo(() => {
    if (!activeBrandName) return [];

    const summary: Record<
      string,
      {
        name: string;
        category: string;
        sales: number;
        revenue: number;
        price: number;
        stock: number;
      }
    > = {};

    allowedOrders.forEach((o) => {
      const orderBrand = o.brand || "ทั่วไป";
      if (orderBrand === activeBrandName && !o.isIncome) {
        const matchesChannel =
          channelFilter === "All" ||
          (channelFilter === "อื่นๆ"
            ? !["Facebook", "LINE OA", "Shopee", "Lazada", "TikTok Shop"].includes(o.channel)
            : o.channel === channelFilter);
        const matchesYear =
          yearFilter === "All" || o.date.startsWith(yearFilter);

        if (matchesChannel && matchesYear) {
          const mainP = products.find(
            (p) => p.name.toLowerCase() === o.productName.toLowerCase(),
          );

          if (!summary[o.productName]) {
            summary[o.productName] = {
              name: o.productName,
              category: mainP?.category || "Beauty",
              sales: 0,
              revenue: 0,
              price: mainP?.price || (o.total || 0) / (o.quantity || 1),
              stock: mainP?.stock ?? 0,
            };
          }
          if (o.status !== "Refunded") {
            summary[o.productName].sales += o.quantity || 1;
            summary[o.productName].revenue += Number(o.total || 0);
          }
        }
      }
    });

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
  }, [allowedOrders, products, activeBrandName, channelFilter, yearFilter, brandProductSort]);

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
      triggerAlert("ไม่มีข้อมูลแบรนด์ที่จะส่งออก", "warning");
      return;
    }
    const data = productsForSelectedBrand.map((p, idx) => ({
      "ลำดับ": idx + 1,
      "ชื่อสินค้า": p.name,
      "หมวดหมู่": p.category,
      "จำนวนที่ขายได้ (ชิ้น)": p.sales,
      "ราคาต่อชิ้น (฿)": p.price,
      "รายได้สุทธิ (฿)": p.revenue,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Brand_${activeBrandName.slice(0, 20)}`);
    XLSX.writeFile(workbook, `AeroSales_Brand_Report_${activeBrandName}.xlsx`);
    triggerAlert(`ส่งออกรายงานแบรนด์ ${activeBrandName} สำเร็จ`, "success");
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
    const isIncome = recordTypeFilter === "income";
    const dataToExport = isIncome ? filteredIncomeData : filteredOrdersData;

    if (dataToExport.length === 0) {
      triggerAlert("ไม่มีข้อมูลที่ตรงกับตัวกรองเพื่อส่งออก", "warning");
      return;
    }

    const headers = isIncome ? [
      "Order ID",
      "รายละเอียดสินค้า",
      "ช่องทาง",
      "รายรับรวม (Gross)",
      "หักค่าธรรมเนียม",
      "สุทธิ (Net)",
      "วันที่ทำรายการ"
    ] : [
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

    const rows = dataToExport.map((o) => {
      if (isIncome) {
        return [
          `"${o.id}"`,
          `"${o.productName || "รายการรายรับบัญชี"}"`,
          `"${o.channel || ""}"`,
          (o.total !== undefined ? o.total : 0).toFixed(2),
          (o.platformFee !== undefined ? o.platformFee : 0).toFixed(2),
          (o.netIncome ?? (o.total || 0) - (o.platformFee || 0)).toFixed(2),
          `"${o.date}"`
        ];
      } else {
        const statusText =
          o.status === "Paid"
            ? "ชำระเงินสำเร็จ"
            : o.status === "Pending"
              ? "รอการตรวจสอบ"
              : "คืนเงินแล้ว";
        return [
          `"${o.id}"`,
          `"${o.date}"`,
          `"${o.customerName}"`,
          `"${o.email || ""}"`,
          `"${o.productName}"`,
          o.quantity || 1,
          `"${o.brand || ""}"`,
          `"${o.channel || ""}"`,
          (o.total !== undefined ? o.total : 0).toFixed(2),
          `"${statusText}"`,
        ];
      }
    });

    const totalVal = dataToExport.reduce((s, o) => {
      if (isIncome) {
        return s + Number(o.netIncome ?? (o.total || 0) - (o.platformFee || 0));
      } else {
        return s + Number(o.total || 0);
      }
    }, 0);

    const csv = [
      isIncome ? `"รายงานรายรับแพลตฟอร์ม AeroSales"` : `"รายงานธุรกรรม AeroSales"`,
      `"วันที่ออก:","${new Date().toLocaleString("th-TH")}"`,
      "",
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((r) => r.join(",")),
      isIncome
        ? `"รวมสุทธิ","","","","",${totalVal.toFixed(2)},"${dataToExport.length} รายการ"`
        : `"รวม","","","","","","${dataToExport.length} รายการ",${totalVal.toFixed(2)},""`,
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `aerosales_${isIncome ? "income" : "transactions"}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    triggerAlert("ส่งออกข้อมูลเป็นไฟล์ CSV เรียบร้อยแล้ว");
  };

  const handleExportExcel = () => {
    const isIncome = recordTypeFilter === "income";
    const dataToExport = isIncome ? filteredIncomeData : filteredOrdersData;

    if (dataToExport.length === 0) {
      triggerAlert("ไม่มีข้อมูลที่ตรงกับตัวกรองเพื่อส่งออก", "warning");
      return;
    }

    const headers = [
      [isIncome ? "รายงานรายรับแพลตฟอร์ม AeroSales (Platform Income Report)" : "รายงานธุรกรรมการขาย AeroSales (Sales Transactions Report)"],
      [`วันที่ออกรายงาน: ${new Date().toLocaleString("th-TH")}`],
      [],
      isIncome ? [
        "Order ID",
        "รายละเอียดสินค้า",
        "ช่องทาง",
        "รายรับรวม (Gross)",
        "หักค่าธรรมเนียม",
        "สุทธิ (Net)",
        "วันที่ทำรายการ"
      ] : [
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

    const rows = dataToExport.map((o) => {
      if (isIncome) {
        return [
          o.id,
          o.productName || "รายการรายรับบัญชี",
          o.channel || "",
          o.total || 0,
          o.platformFee || 0,
          o.netIncome ?? (o.total || 0) - (o.platformFee || 0),
          o.date
        ];
      } else {
        const statusText =
          o.status === "Paid"
            ? "ชำระเงินสำเร็จ"
            : o.status === "Pending"
              ? "รอการตรวจสอบ"
              : "คืนเงินแล้ว";
        return [
          o.id,
          o.date,
          o.customerName,
          o.email || "",
          o.productName,
          o.quantity || 1,
          o.brand || "",
          o.channel || "",
          o.total !== undefined ? o.total : "",
          statusText
        ];
      }
    });

    const totalVal = dataToExport.reduce((s, o) => {
      if (isIncome) {
        return s + Number(o.netIncome ?? (o.total || 0) - (o.platformFee || 0));
      } else {
        return s + Number(o.total || 0);
      }
    }, 0);

    const summaryRow = isIncome ? [
      "รวมสุทธิทั้งหมด",
      "",
      "",
      "",
      "",
      totalVal,
      `${dataToExport.length} รายการ`
    ] : [
      "รวมทั้งหมด",
      "",
      "",
      "",
      "",
      "",
      `${dataToExport.length} รายการ`,
      "",
      totalVal,
      ""
    ];

    const data = [...headers, ...rows, summaryRow];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    ws["!cols"] = isIncome ? [
      { wch: 22 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 }
    ] : [
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

    XLSX.utils.book_append_sheet(wb, ws, isIncome ? "รายรับแพลตฟอร์ม" : "ประวัติการสั่งซื้อ");
    XLSX.writeFile(wb, `aerosales_${isIncome ? "income" : "transactions"}_${new Date().toISOString().split("T")[0]}.xlsx`);
    triggerAlert("ส่งออกข้อมูลเรียบร้อยแล้ว", "success");
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

  const inputCls = `input-apple w-full rounded-xl py-2 px-3 text-xs font-normal focus:outline-none cursor-pointer`;
  const thCls =
    "px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-apple-secondary whitespace-nowrap";
  const tdCls = "px-5 py-3.5 whitespace-nowrap";

  return (
    <div className="space-y-5">
      {/* Subtab Switcher (Desktop & Mobile) */}
      <div className="flex overflow-x-auto pb-2 gap-2 border-b border-apple-primary/10 mobile-scroll-x">
        {[
          { id: "uploaded-files" as const, label: "รายการยอดขาย" },
          { id: "products" as const, label: "ข้อมูลสินค้า" },
          { id: "brands" as const, label: "รายงานแบรนด์" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSalesSubTab(t.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              salesSubTab === t.id
                ? isDarkMode
                  ? "bg-white text-black font-black shadow-md"
                  : "bg-black text-white font-black shadow-md"
                : isDarkMode
                  ? "text-neutral-400 hover:text-white hover:bg-white/6"
                  : "text-neutral-500 hover:text-black hover:bg-black/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-end gap-2 w-full">
        {salesSubTab === "transactions" && (
          <>
            <button
              onClick={() => setActiveTab("import-orders")}
              className="btn-apple-secondary flex items-center justify-center gap-1.5 font-bold text-xs px-4 py-2 rounded-xl cursor-pointer w-full sm:w-auto"
            >
              <Upload className="h-3.5 w-3.5" />
              นำเข้าออเดอร์
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-apple-secondary flex items-center justify-center gap-1.5 font-bold text-xs px-4 py-2 rounded-xl cursor-pointer w-full sm:w-auto"
            >
              <Printer className="h-3.5 w-3.5" />
              พิมพ์/บันทึก PDF
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center justify-center gap-1.5 font-black text-xs px-4 py-2 rounded-xl cursor-pointer w-full sm:w-auto bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              ส่งออก Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="btn-apple-secondary flex items-center justify-center gap-1.5 font-bold text-xs px-4 py-2 rounded-xl cursor-pointer w-full sm:w-auto opacity-75"
            >
              <Download className="h-3.5 w-3.5" />
              ส่งออก CSV
            </button>
            {currentUser?.role === "Admin" && (
              <>
                <button
                  onClick={() =>
                    requestConfirm(
                      "ยืนยันการล้างข้อมูลทั้งหมด",
                      "คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลยอดขายทั้งหมด? ข้อมูลที่ถูกลบไม่สามารถกู้คืนได้",
                      handleDeleteAllOrders,
                    )
                  }
                  className="btn-apple-secondary flex items-center justify-center gap-1.5 font-bold text-xs px-4 py-2 rounded-xl cursor-pointer w-full sm:w-auto"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  ล้างข้อมูลทั้งหมด
                </button>
                <button
                  onClick={() => setIsAddOrderOpen(true)}
                  className={`flex items-center justify-center gap-1.5 ${roleStyles.bgActive} font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer cta-glow-btn w-full sm:w-auto`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  บันทึกยอดขายใหม่
                </button>
              </>
            )}
          </>
        )}
        {salesSubTab === "products" && (
          <>
            {currentUser?.role === "Admin" && (
              <button
                onClick={() =>
                  requestConfirm(
                    "ยืนยันการล้างข้อมูลสินค้าทั้งหมด",
                    "คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลสินค้าและคำสั่งซื้อทั้งหมด? ข้อมูลทั้งหมดที่เกี่ยวข้องจะถูกลบและไม่สามารถกู้คืนได้",
                    handleClearAllProductData,
                  )
                }
                className="btn-apple-secondary flex items-center justify-center gap-1.5 font-bold text-xs px-4 py-2 rounded-xl cursor-pointer w-full sm:w-auto"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                ล้างข้อมูลสินค้าทั้งหมด
              </button>
            )}
            <button
              onClick={() => setIsAddProductOpen(true)}
              className={`flex items-center justify-center gap-1.5 ${roleStyles.bgActive} font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer cta-glow-btn w-full sm:w-auto`}
            >
              <Plus className="h-3.5 w-3.5" />
              เพิ่มสินค้าในร้าน
            </button>
          </>
        )}
      </div>

      {/* Filters (Shared across tabs) */}
      {salesSubTab !== "uploaded-files" &&
        salesSubTab !== "products" && (
          <div
            className={`grid grid-cols-1 min-[769px]:grid-cols-3 gap-4 p-5 rounded-2xl border transition-colors ${isDarkMode ? "bg-white/3 border-white/6" : "bg-white border-black/6 shadow-sm"}`}
          >
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5 text-apple-secondary">
                ค้นหา
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-apple-tertiary pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาลูกค้า สินค้า แบรนด์..."
                  className={`${inputCls} pl-8`}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5 text-apple-secondary">
                ปี
              </label>
              <div className="relative flex items-center">
                <Calendar className={`absolute left-2.5 h-3.5 w-3.5 ${salesYearStyle} pointer-events-none transition-colors duration-300`} />
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className={`${inputCls} pl-8`}
                >
                  <option value="All">ทุกปี</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5 text-apple-secondary">
                ช่องทาง
              </label>
              <div className="relative flex items-center">
                <Globe className={`absolute left-2.5 h-3.5 w-3.5 ${salesChannelStyle} pointer-events-none transition-colors duration-300`} />
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className={`${inputCls} pl-8`}
                >
                  <option value="All">ทุกช่องทาง</option>
                  <option value="Facebook">Facebook</option>
                  <option value="LINE OA">LINE OA</option>
                  <option value="Shopee">Shopee</option>
                  <option value="Lazada">Lazada</option>
                  <option value="TikTok Shop">TikTok Shop</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>
            </div>
          </div>
        )}

      {/* ── Subtab 1: Transactions ── */}
      {salesSubTab === "transactions" && (
        <div className="space-y-4">
          {/* Record Type Filter Toggle */}
          <div className="flex bg-apple-tertiary/40 p-1 rounded-2xl gap-1 border border-apple-primary/5 shadow-inner w-fit mb-2">
            <button
              type="button"
              onClick={() => setRecordTypeFilter("order")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                recordTypeFilter === "order"
                  ? "bg-apple-primary text-apple-secondary shadow-sm"
                  : "text-apple-secondary hover:text-apple-primary bg-transparent"
              }`}
            >
              คำสั่งซื้อ
            </button>
            <button
              type="button"
              onClick={() => setRecordTypeFilter("income")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                recordTypeFilter === "income"
                  ? "bg-apple-primary text-apple-secondary shadow-sm"
                  : "text-apple-secondary hover:text-apple-primary bg-transparent"
              }`}
            >
              รายรับแพลตฟอร์ม
            </button>
          </div>

          {/* Table */}
          {/* Desktop View — แสดงตารางบนคอมพิวเตอร์ */}
          <div className="hidden lg:block glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              {recordTypeFilter === "income" ? (
                <table className="w-full text-left borderless-table">
                  <thead>
                    <tr className={`border-b ${isDarkMode ? "border-white/6 bg-white/3" : "border-black/5 bg-black/2"}`}>
                      <th className={thCls}>Order ID</th>
                      <th className={thCls}>รายละเอียด</th>
                      <th className={thCls}>ช่องทาง</th>
                      <th className={`${thCls} text-right`}>รายรับรวม (Gross)</th>
                      <th className={`${thCls} text-right`}>หักค่าธรรมเนียม</th>
                      <th className={`${thCls} text-right`}>สุทธิ (Net)</th>
                      <th className={thCls}>วันที่ทำรายการ</th>
                      <th className={`${thCls} text-right`}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="no-dividers">
                    {filteredIncomeData.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-16 text-center text-sm font-bold text-apple-tertiary">
                          ไม่พบรายการที่ตรงกับตัวกรอง
                        </td>
                      </tr>
                    ) : (
                      filteredIncomeData.map((o) => (
                        <tr key={o.id} className="hover:bg-apple-tertiary transition-colors animate-fade-up-row">
                          <td className={`${tdCls} font-mono text-xs text-apple-secondary font-semibold`}>
                            {o.id.replace(/-row-.*$/, "")}
                          </td>
                          <td className={`${tdCls} font-semibold text-apple-primary text-sm max-w-[250px] truncate`} title={o.productName || "รายการรายรับบัญชี"}>
                            {o.productName || "รายการรายรับบัญชี"}
                          </td>
                          <td className={tdCls}>
                            <span className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border ${isDarkMode ? "bg-white/5 border-white/8 text-neutral-300" : "bg-black/4 border-black/6 text-neutral-600"}`}>
                              {o.channel}
                            </span>
                          </td>
                          <td className={`${tdCls} font-mono text-right text-sm font-semibold`}>
                            {formatCurrency(o.total || 0)}
                          </td>
                          <td className={`${tdCls} font-mono text-right text-rose-500 font-semibold text-sm`}>
                            -{formatCurrency(o.platformFee || 0)}
                          </td>
                          <td className={`${tdCls} font-mono text-right font-black text-emerald-500 text-sm`}>
                            {formatCurrency(o.netIncome ?? (o.total || 0) - (o.platformFee || 0))}
                          </td>
                          <td className={`${tdCls} font-mono text-xs text-apple-secondary`}>
                            {o.date}
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
                                      `ลบรายการธุรกรรมรายรับ "substitute" ยอดเงิน ${formatCurrency(o.total || 0)}?`.replace('substitute', o.id.replace(/-row-.*$/, "")),
                                      () => handleDeleteOrder(o.id),
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
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left borderless-table">
                  <thead>
                    <tr className={`border-b ${isDarkMode ? "border-white/6 bg-white/3" : "border-black/5 bg-black/2"}`}>
                      <th className={thCls}>เลขที่ออเดอร์</th>
                      <th className={thCls}>ลูกค้า</th>
                      <th className={thCls}>สินค้า</th>
                      <th className={thCls}>จำนวน</th>
                      <th className={thCls}>ช่องทาง</th>
                      <th className={thCls}>วันที่</th>
                      <th className={thCls}>ยอดขาย</th>
                      <th className={thCls}>สถานะ</th>
                      <th className={`${thCls} text-right`}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="no-dividers">
                    {filteredOrdersData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-5 py-16 text-center text-sm font-bold text-apple-tertiary">
                          ไม่พบรายการที่ตรงกับตัวกรอง
                        </td>
                      </tr>
                    ) : (
                      filteredOrdersData.map((o) => (
                        <tr key={o.id} className="hover:bg-apple-tertiary transition-colors animate-fade-up-row">
                          <td className={`${tdCls} font-mono text-xs text-apple-secondary font-semibold`}>
                            {o.id.replace(/-row-.*$/, "")}
                          </td>
                          <td className={tdCls}>
                            <p className="font-bold text-sm text-apple-primary">{o.customerName}</p>
                            {o.email && <p className="text-xs text-apple-tertiary mt-0.5">{o.email}</p>}
                          </td>
                          <td className={`${tdCls} font-semibold text-apple-primary text-sm max-w-[280px] truncate`} title={o.productName}>
                            {o.productName}
                          </td>
                          <td className={`${tdCls} font-bold text-apple-secondary text-sm`}>
                            {o.quantity || 1} ชิ้น
                          </td>
                          <td className={tdCls}>
                            <span className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border ${isDarkMode ? "bg-white/5 border-white/8 text-neutral-300" : "bg-black/4 border-black/6 text-neutral-600"}`}>
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
                            <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusBadge(o.status)}`}>
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
                                      () => handleDeleteOrder(o.id),
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
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Mobile/Tablet Card View — แสดงรายการการ์ดบนมือถือและแท็บเล็ต */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
            {filteredOrders.length === 0 ? (
              <div className="col-span-full glass-card rounded-2xl p-8 text-center text-sm font-bold text-apple-tertiary">
                ไม่พบรายการที่ตรงกับตัวกรอง
              </div>
            ) : (
              filteredOrders.map((o) => {
                const isIncomeRow = recordTypeFilter === "income";
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
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${isDarkMode ? "bg-white/5 border-white/8 text-neutral-300" : "bg-black/4 border-black/6 text-neutral-600"}`}
                      >
                        {o.channel}
                      </span>
                    </div>

                    {isIncomeRow ? (
                      <div>
                        <h4
                          className="font-bold text-apple-primary text-sm truncate"
                          title={o.productName}
                        >
                          {o.productName || "รายการรายรับบัญชี"}
                        </h4>
                        <p className="text-xs text-apple-tertiary">
                          ธุรกรรมการเงินแพลตฟอร์ม
                        </p>
                      </div>
                    ) : (
                      <div>
                        <h4 className="font-bold text-apple-primary text-sm">
                          {o.customerName}
                        </h4>
                        <p className="text-xs text-apple-tertiary">{o.email}</p>
                      </div>
                    )}

                    <div className="border-t border-apple-primary/40 pt-2 flex justify-between items-center text-xs">
                      <div>
                        {isIncomeRow ? (
                          <p className="text-apple-secondary font-semibold">
                            ยอดรวม: {formatCurrency(o.total || 0)}
                          </p>
                        ) : (
                          <p className="text-apple-secondary font-semibold">
                            {o.productName} (x{o.quantity || 1})
                          </p>
                        )}
                        <p className="text-[10px] text-apple-tertiary mt-0.5">
                          {isIncomeRow ? "—" : o.brand}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-apple-secondary">
                      {o.date}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-apple-primary/40 pt-2.5 flex justify-between items-center">
                      <div>
                        {isIncomeRow ? (
                          <>
                            <p className="font-black text-sm text-apple-primary">
                              สุทธิ:{" "}
                              <span className="text-emerald-500 font-extrabold">
                                {formatCurrency(
                                  o.netIncome ?? (o.total || 0) - (o.platformFee || 0),
                                )}
                              </span>
                            </p>
                            {o.platformFee || o.shippingFee ? (
                              <p className="text-[9px] text-apple-tertiary mt-0.5">
                                ธรรมเนียม: -{formatCurrency(o.platformFee || 0)}{" "}
                                | ส่ง: {formatCurrency(o.shippingFee || 0)}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <p className="font-black text-sm text-apple-primary">
                              {formatCurrency(o.total || 0)}
                            </p>
                            <p className="text-[10px] text-apple-secondary mt-0.5 font-bold">
                              สุทธิ:{" "}
                              <span className="text-emerald-500 font-extrabold">
                                {formatCurrency(
                                  o.netIncome ?? (o.total || 0) - (o.platformFee || 0),
                                )}
                              </span>
                            </p>
                            {o.platformFee || o.shippingFee ? (
                              <p className="text-[9px] text-apple-tertiary mt-0.5">
                                ธรรมเนียม: {formatCurrency(o.platformFee || 0)}{" "}
                                | ส่ง: {formatCurrency(o.shippingFee || 0)}
                              </p>
                            ) : null}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusBadge(o.status)}`}
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
                          {currentUser.role === "Admin" ||
                          currentUser.role === "Manager" ? (
                            <button
                              onClick={() =>
                                requestConfirm(
                                  "ยืนยันการลบ",
                                  isIncomeRow
                                    ? `ลบรายการธุรกรรมการเงิน ${o.id.replace(/-row-.*$/, "")} ยอดเงิน ${formatCurrency(o.total || 0)}?`
                                    : `ลบรายการของ "${o.customerName}" ยอดเงิน ${formatCurrency(o.total || 0)}?`,
                                  () => handleDeleteOrder(o.id),
                                )
                              }
                              className="p-1 text-apple-secondary hover:text-red-500 hover:bg-red-500/8 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="p-1">
                              <Lock className="h-3.5 w-3.5 text-apple-tertiary" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex justify-center pt-6 pb-2 border-t border-apple-primary/10 mt-6">
            <button
              onClick={() => setIsAuditLogsModalOpen(true)}
              className="btn-apple-secondary flex items-center justify-center gap-2 font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Bell className="h-4 w-4" />
              ดูประวัติย้อนหลัง (Audit Logs)
            </button>
          </div>
        </div>
      )}

      {/* ── Subtab 2: Products ── */}
      {salesSubTab === "products" && (
        <div className="space-y-6 animate-fade-in">
          {/* 1. Page Header Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1 */}
            <div
              className={`p-5 rounded-2xl border flex items-center justify-between shadow-xs ${
                isDarkMode ? "bg-neutral-900 border-white/5" : "bg-white border-black/5"
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] text-apple-secondary font-black uppercase tracking-wider block">
                  จำนวนสินค้าทั้งหมด
                </span>
                <p className="text-xl font-mono font-black text-apple-primary">
                  {productKpis.totalUniqueProducts} รายการ
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                <Package className="h-5 w-5" />
              </div>
            </div>

            {/* KPI 2 */}
            <div
              className={`p-5 rounded-2xl border flex items-center justify-between shadow-xs ${
                isDarkMode ? "bg-neutral-900 border-white/5" : "bg-white border-black/5"
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] text-apple-secondary font-black uppercase tracking-wider block">
                  จำนวนชิ้นที่ขายได้รวม
                </span>
                <p className="text-xl font-mono font-black text-apple-primary">
                  {productKpis.totalQuantitySold.toLocaleString()} ชิ้น
                </p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
                <ShoppingCart className="h-5 w-5" />
              </div>
            </div>

            {/* KPI 3 */}
            <div
              className={`p-5 rounded-2xl border flex items-center justify-between shadow-xs ${
                isDarkMode ? "bg-neutral-900 border-white/5" : "bg-white border-black/5"
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] text-apple-secondary font-black uppercase tracking-wider block">
                  ยอดขายสินค้าสะสม
                </span>
                <p className="text-xl font-mono font-black text-emerald-500 font-bold">
                  {formatCurrency(productKpis.totalRevenue)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            {/* KPI 4 */}
            <div
              className={`p-5 rounded-2xl border flex items-center justify-between shadow-xs ${
                isDarkMode ? "bg-neutral-900 border-white/5" : "bg-white border-black/5"
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] text-apple-secondary font-black uppercase tracking-wider block">
                  ราคาเฉลี่ยสินค้า
                </span>
                <p className="text-xl font-mono font-black text-rose-500 font-bold">
                  {formatCurrency(productKpis.averagePrice)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500">
                <Info className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* 2. Platform Selector Tabs */}
          {!(isViewingDetails && currentSelectedProduct) && (
            <div className="flex overflow-x-auto pb-1 p-1.5 bg-apple-tertiary/40 rounded-2xl gap-2 border border-apple-primary/5 shadow-inner mobile-scroll-x">
              {([
                { id: "all" as const, label: "ทุกแพลตฟอร์ม", color: "bg-blue-500" },
                { id: "lazada" as const, label: "Lazada", color: "bg-[#2E2BB8]" },
                { id: "shopee" as const, label: "Shopee", color: "bg-[#EE4D2D]" },
                { id: "tiktok" as const, label: "TikTok Shop", color: "bg-[#FE2C55]" },
                { id: "facebook" as const, label: "Facebook", color: "bg-[#1877F2]" },
                { id: "line" as const, label: "LINE OA", color: "bg-[#06C755]" },
              ] as const).map((p) => {
                const isActive = activeProductPlatform === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProductPlatform(p.id);
                      setActiveDatasetId(null);
                      setIsViewingDetails(false);
                      setSelectedProduct(null);
                    }}
                    className={`flex-1 md:flex-none shrink-0 whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-black transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer border ${
                      isActive
                        ? isDarkMode
                          ? "bg-neutral-800 border-white/10 text-white shadow-md shadow-black/30"
                          : "bg-white border-black/5 text-black shadow-sm"
                        : "bg-transparent border-transparent text-apple-secondary hover:text-apple-primary hover:bg-apple-tertiary/50"
                    }`}
                  >
                    {p.id !== "all" && <span className={`w-2 h-2 rounded-full shrink-0 ${p.color}`} />}
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 3. Empty State or Main Content Grid */}
          {ordersData.length === 0 && incomeData.length === 0 ? (
            <div
              className={`p-12 text-center border-2 border-dashed rounded-3xl ${
                isDarkMode ? "border-white/5 bg-white/[0.01]" : "border-black/5 bg-apple-tertiary/10"
              }`}
            >
              <Upload className="h-10 w-10 text-apple-secondary mx-auto mb-3" />
              <h3 className="text-sm font-black text-apple-primary">ไม่มีไฟล์ข้อมูลคำสั่งซื้อที่อัปโหลดไว้</h3>
              <p className="text-xs text-apple-secondary mt-1 max-w-sm mx-auto leading-relaxed">
                กรุณาไปที่หน้า "นำเข้าออเดอร์" เพื่ออัปโหลดรายงานคำสั่งซื้อ (Orders) เข้าสู่ระบบก่อน
              </p>
            </div>
          ) : isViewingDetails && currentSelectedProduct ? (
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
                <span className="text-[10px] font-black uppercase tracking-wider text-apple-secondary px-1 block mb-1">
                  ไฟล์ที่อัปโหลดไว้ ({filteredOrderDatasets.length})
                </span>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">


                  {filteredOrderDatasets.length === 0 ? (
                    <div className="p-4 text-center text-xs text-apple-secondary border rounded-xl border-dashed">
                      ไม่มีไฟล์ข้อมูลสำหรับช่องทางนี้
                    </div>
                  ) : (
                    <>
                      {/* Show Combined view card only when there are multiple datasets */}
                      {filteredOrderDatasets.length > 1 && (
                        <div
                          onClick={() => {
                            setActiveDatasetId("all");
                            setIsViewingDetails(false);
                            setSelectedProduct(null);
                          }}
                          className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all relative overflow-hidden select-none flex flex-col justify-between gap-3 ${
                            currentActiveDatasetId === "all"
                              ? isDarkMode
                                ? "border-blue-500/50 bg-blue-500/5 shadow-md shadow-blue-500/5"
                                : "border-blue-500/40 bg-blue-50/50 shadow-sm"
                              : isDarkMode
                                ? "bg-white/3 border-white/5 hover:bg-white/5"
                                : "bg-apple-secondary border-black/5 hover:bg-apple-tertiary/40"
                          }`}
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                          <div className="space-y-1 pl-1">
                            <h4 className="text-xs font-black text-apple-primary truncate pr-4">
                              แสดงข้อมูลรวมทุกไฟล์
                            </h4>
                            <p className="text-[9px] text-apple-secondary flex items-center gap-1">
                              <Layers className="h-3 w-3 shrink-0" />
                              <span>{salesSubTab === "products" ? `รวมข้อมูลสินค้าทั้งหมด ${filteredOrderDatasets.length} ไฟล์` : `รวมรายงานออเดอร์ทั้งหมด ${filteredOrderDatasets.length} ไฟล์`}</span>
                            </p>
                          </div>
                          <div className="flex items-center justify-between pl-1">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white bg-blue-500">
                              COMBINED
                            </span>
                          </div>
                        </div>
                      )}

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
                            className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all relative overflow-hidden select-none flex flex-col justify-between gap-3 ${
                              isActive
                                ? isDarkMode
                                  ? "border-blue-500/50 bg-blue-500/5 shadow-md shadow-blue-500/5"
                                  : "border-blue-500/40 bg-blue-50/50 shadow-sm"
                                : isDarkMode
                                  ? "bg-white/3 border-white/5 hover:bg-white/5"
                                  : "bg-apple-secondary border-black/5 hover:bg-apple-tertiary/40"
                            }`}
                          >
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1"
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
                              <h4 className="text-xs font-black text-apple-primary truncate pr-4" title={d.fileName}>
                                {d.fileName}
                              </h4>
                              <p className="text-[9px] text-apple-secondary flex items-center gap-1">
                                <Calendar className="h-3 w-3 shrink-0" />
                                <span>{d.uploadedAt}</span>
                              </p>
                            </div>
                            <div className="flex items-center justify-between pl-1">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${pfColor}`}>
                                {d.platform.toUpperCase()}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestConfirm(
                                    "ยืนยันการลบไฟล์",
                                    `คุณแน่ใจหรือไม่ว่าต้องการลบไฟล์ "${d.fileName}"? ข้อมูลยอดขายทั้งหมดที่อัปโหลดจากไฟล์นี้จะถูกลบออกด้วย`,
                                    () => onDeleteDataset(d.id),
                                  );
                                }}
                                className="text-rose-500 hover:text-rose-600 p-1 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
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
                                  <td className={`${tdCls} font-medium text-apple-secondary`}>{prod.brand}</td>
                                  <td className={`${tdCls} text-apple-secondary`}>{prod.category}</td>
                                  <td className={`${tdCls} font-mono text-right font-semibold`}>{formatCurrency(prod.price)}</td>
                                  <td className={`${tdCls} font-mono text-center font-bold`}>{prod.sales.toLocaleString()} ชิ้น</td>
                                  <td className={`${tdCls} font-mono text-right font-black text-emerald-500`}>{formatCurrency(prod.revenue)}</td>
                                  <td className={`${tdCls} font-mono text-center`}>{prod.stock} ชิ้น</td>
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
                                brand: prod.brand,
                                price: prod.price,
                                sales: prod.sales,
                                revenue: prod.revenue,
                                stock: prod.stock,
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
                              }`}>
                                {prod.status === "In Stock" ? "มีสินค้า" : prod.status === "Low Stock" ? "สต็อกต่ำ" : "หมด"}
                              </span>
                            </div>
                            <h5 className="font-bold text-apple-primary text-xs line-clamp-2 hover:text-blue-500">{prod.name}</h5>
                            <div className="flex justify-between items-center text-[10px] pt-1 border-t border-apple-primary/10">
                              <div>
                                <span className="text-apple-tertiary block">แบรนด์</span>
                                <span className="font-bold text-apple-secondary">{prod.brand}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-apple-tertiary block">ยอดขาย</span>
                                <span className="font-black text-emerald-500">{formatCurrency(prod.revenue)} ({prod.sales} ชิ้น)</span>
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
                                      <td className={`${tdCls} font-medium text-apple-secondary`}>{prod.brand}</td>
                                      <td className={`${tdCls} text-apple-secondary`}>{prod.category}</td>
                                      <td className={`${tdCls} font-mono text-right font-semibold`}>{formatCurrency(prod.price)}</td>
                                      <td className={`${tdCls} font-mono text-center font-bold`}>{prod.sales.toLocaleString()} ชิ้น</td>
                                      <td className={`${tdCls} font-mono text-right font-black text-emerald-500`}>{formatCurrency(prod.revenue)}</td>
                                      <td className={`${tdCls} font-mono text-center`}>{prod.stock} ชิ้น</td>
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
                                    brand: prod.brand,
                                    price: prod.price,
                                    sales: prod.sales,
                                    revenue: prod.revenue,
                                    stock: prod.stock,
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
                                    <span className="font-bold text-apple-secondary">{prod.brand}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-apple-tertiary block">ยอดขาย</span>
                                    <span className="font-black text-emerald-500">{formatCurrency(prod.revenue)} ({prod.sales} ชิ้น)</span>
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
                    className={`p-12 text-center border rounded-3xl flex flex-col items-center justify-center ${
                      isDarkMode ? "bg-neutral-900 border-white/5" : "bg-white border-black/5"
                    }`}
                  >
                    <Info className="h-8 w-8 text-apple-secondary mb-3" />
                    <h3 className="text-sm font-black text-apple-primary">ไม่มีไฟล์ข้อมูลเปิดอยู่</h3>
                    <p className="text-xs text-apple-secondary mt-1 max-w-sm mx-auto leading-relaxed">
                      ไม่พบไฟล์ข้อมูลสำหรับช่องทางนี้ หรือกรุณาเลือกไฟล์เพื่อเปิดดูข้อมูล
                    </p>
                  </div>
                )}
              </div>

              {/* Audit Logs button */}
              <div className="col-span-full flex justify-center pt-6 pb-2 border-t border-apple-primary/10 mt-6">
                <button
                  onClick={() => setIsAuditLogsModalOpen(true)}
                  className="btn-apple-secondary flex items-center justify-center gap-2 font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Bell className="h-4 w-4" />
                  ดูประวัติย้อนหลัง (Audit Logs)
                </button>
            </div>
            </div>
          )}
        </div>
      )}

      {/* ── Subtab 3: Brands ── */}
      {salesSubTab === "brands" && (
        <div className="space-y-6">
          {/* Brand Selector Pills — แสดงเฉพาะเมื่อมีมากกว่า 1 แบรนด์ */}
          {salesByBrandSummary.length > 1 && (
            <div className="glass-card rounded-2xl p-5 animate-fade-in space-y-3">
              <span className="block text-[10px] font-black uppercase tracking-wider text-apple-secondary">
                เลือกสินค้าที่ต้องการดูรายละเอียด
              </span>
              <div className="flex flex-wrap gap-2">
                {salesByBrandSummary.map((item, idx) => {
                  const isActive = activeBrandName === item.brand;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedBrand(item.brand)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                          : isDarkMode
                            ? "bg-white/5 text-neutral-300 hover:bg-white/8 border border-white/5"
                            : "bg-black/5 text-neutral-600 hover:bg-black/8 border border-black/5"
                      }`}
                    >
                      {item.brand} ({item.sales} ชิ้น)
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detailed Product view of Active Brand */}
          {activeBrandName && (
            <div className="space-y-6">
              {/* Brand Detailed KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
                {/* KPI 1: Gross Sales */}
                <div className="glass-card dot-grid-bg rounded-2xl p-5 relative transition-all duration-300 hover-scale-card border border-apple-primary/10 border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-500/5 to-transparent">
                  <span className="text-[10px] font-black uppercase tracking-wider text-apple-secondary block mb-1">
                    รายรับรวมแบรนด์
                  </span>
                  <p className="text-xl md:text-2xl font-mono font-black text-emerald-500">
                    {formatCurrency(selectedBrandTotals.revenue)}
                  </p>
                  <p className="text-[10px] text-apple-tertiary mt-2 font-medium">
                    รายได้สุทธิหลังหักรายการยกเลิก
                  </p>
                </div>

                {/* KPI 2: Total Units Sold */}
                <div className="glass-card dot-grid-bg rounded-2xl p-5 relative transition-all duration-300 hover-scale-card border border-apple-primary/10 border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-500/5 to-transparent">
                  <span className="text-[10px] font-black uppercase tracking-wider text-apple-secondary block mb-1">
                    จำนวนชิ้นที่จำหน่าย
                  </span>
                  <p className="text-xl md:text-2xl font-mono font-black text-apple-primary">
                    {selectedBrandTotals.sales.toLocaleString()} ชิ้น
                  </p>
                  <p className="text-[10px] text-apple-tertiary mt-2 font-medium">
                    ปริมาณการจัดส่งสินค้าออกสำเร็จ
                  </p>
                </div>

                {/* KPI 3: Unique SKUs */}
                <div className="glass-card dot-grid-bg rounded-2xl p-5 relative transition-all duration-300 hover-scale-card border border-apple-primary/10 border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-500/5 to-transparent">
                  <span className="text-[10px] font-black uppercase tracking-wider text-apple-secondary block mb-1">
                    ความหลากหลายสินค้า
                  </span>
                  <p className="text-xl md:text-2xl font-mono font-black text-blue-500">
                    {productsForSelectedBrand.length} รายการ
                  </p>
                  <p className="text-[10px] text-apple-tertiary mt-2 font-medium">
                    จำนวน SKU สินค้าที่จำหน่ายจริง
                  </p>
                </div>

                {/* KPI 4: Brand AOV */}
                <div className="glass-card dot-grid-bg rounded-2xl p-5 relative transition-all duration-300 hover-scale-card border border-apple-primary/10 border-l-4 border-l-rose-500 bg-gradient-to-r from-rose-500/5 to-transparent">
                  <span className="text-[10px] font-black uppercase tracking-wider text-apple-secondary block mb-1">
                    ราคาเฉลี่ยต่อชิ้น
                  </span>
                  <p className="text-xl md:text-2xl font-mono font-black text-rose-500">
                    {formatCurrency(
                      selectedBrandTotals.sales > 0
                        ? selectedBrandTotals.revenue / selectedBrandTotals.sales
                        : 0
                    )}
                  </p>
                  <p className="text-[10px] text-apple-tertiary mt-2 font-medium">
                    มูลค่าถัวเฉลี่ยต่อหน่วยสินค้า
                  </p>
                </div>
              </div>

              <div className="glass-card rounded-2xl overflow-hidden animate-fade-in">
              <div
                className={`px-6 py-4 border-b ${isDarkMode ? "border-white/6 bg-white/3" : "border-black/5 bg-black/2"} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
              >
                <div>
                  <h4 className="font-bold text-sm text-apple-primary">
                    รายละเอียดสินค้า
                  </h4>
                  <p className="text-xs mt-0.5 text-apple-secondary">
                    แสดงรายละเอียดสินค้าจำแนกยอดขายและรายได้ (สามารถคลิกหัวตารางเพื่อเรียงข้อมูล)
                  </p>
                </div>
                <div className="flex items-center gap-2 no-print">
                  <button
                    onClick={exportBrandToExcel}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-apple-primary bg-apple-secondary hover:bg-apple-tertiary select-none text-[10px] font-black transition-all text-apple-primary cursor-pointer min-h-[44px]"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                    ส่งออก Excel
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-apple-primary bg-apple-secondary hover:bg-apple-tertiary select-none text-[10px] font-black transition-all text-apple-primary cursor-pointer min-h-[44px]"
                  >
                    <Printer className="h-3.5 w-3.5 text-blue-500" />
                    พิมพ์รายงาน
                  </button>
                  {selectedBrand && (
                    <button
                      onClick={() => setSelectedBrand(null)}
                      className="text-xs text-rose-500 hover:text-rose-600 font-extrabold cursor-pointer ml-1"
                    >
                      คืนค่าเริ่มต้น
                    </button>
                  )}
                </div>
              </div>

              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left borderless-table">
                  <thead>
                    <tr
                      className={`border-b ${isDarkMode ? "border-white/6 bg-white/3" : "border-black/5 bg-black/2"}`}
                    >
                      <th
                        onClick={() => toggleSort("name")}
                        className={`${thCls} w-2/4 cursor-pointer hover:text-apple-primary transition-colors select-none`}
                      >
                        ชื่อสินค้า{" "}
                        <span className={brandProductSort.key === "name" ? "text-blue-500 dark:text-blue-400" : "text-neutral-400 dark:text-neutral-600"}>
                          {brandProductSort.key === "name" ? (brandProductSort.direction === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      </th>
                      <th
                        onClick={() => toggleSort("sales")}
                        className={`${thCls} w-1/4 text-center cursor-pointer hover:text-apple-primary transition-colors select-none`}
                      >
                        ชิ้นที่ขายได้{" "}
                        <span className={brandProductSort.key === "sales" ? "text-blue-500 dark:text-blue-400" : "text-neutral-400 dark:text-neutral-600"}>
                          {brandProductSort.key === "sales" ? (brandProductSort.direction === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      </th>
                      <th
                        onClick={() => toggleSort("revenue")}
                        className={`${thCls} w-1/4 text-right cursor-pointer hover:text-apple-primary transition-colors select-none`}
                      >
                        รายได้สุทธิ{" "}
                        <span className={brandProductSort.key === "revenue" ? "text-blue-500 dark:text-blue-400" : "text-neutral-400 dark:text-neutral-600"}>
                          {brandProductSort.key === "revenue" ? (brandProductSort.direction === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="no-dividers">
                    {productsForSelectedBrand.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-5 py-8 text-center text-xs font-bold text-apple-secondary"
                        >
                          ไม่พบสินค้าที่มียอดจำหน่ายของแบรนด์นี้ตามตัวกรองที่เลือก
                        </td>
                      </tr>
                    ) : (
                      productsForSelectedBrand.map((prod, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-apple-tertiary transition-colors animate-fade-up-row"
                        >
                          <td
                            className={`${tdCls} font-bold text-apple-primary text-sm max-w-sm truncate w-2/4`}
                            title={prod.name}
                          >
                            {prod.name}
                          </td>
                          <td
                            className={`${tdCls} text-center font-mono font-bold text-apple-primary w-1/4`}
                          >
                            {prod.sales} ชิ้น
                          </td>
                          <td
                            className={`${tdCls} text-right font-black text-apple-primary w-1/4`}
                          >
                            {formatCurrency(prod.revenue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {productsForSelectedBrand.length > 0 && (
                    <tfoot className="border-t-2 border-apple-primary/20">
                      <tr className="font-extrabold text-apple-primary bg-apple-tertiary/40">
                        <td className={`${tdCls} font-black w-2/4`}>
                          รวมทั้งหมด ({productsForSelectedBrand.length}{" "}
                          รายการสินค้า)
                        </td>
                        <td
                          className={`${tdCls} text-center font-black text-apple-primary w-1/4`}
                        >
                          {selectedBrandTotals.sales} ชิ้น
                        </td>
                        <td
                          className={`${tdCls} text-right font-black text-apple-primary w-1/4`}
                        >
                          {formatCurrency(selectedBrandTotals.revenue)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Mobile view */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 lg:hidden">
                {productsForSelectedBrand.length === 0 ? (
                  <div className="col-span-full p-8 text-center text-xs font-bold text-apple-secondary">
                    ไม่พบสินค้าที่มียอดจำหน่ายของแบรนด์นี้ตามตัวกรองที่เลือก
                  </div>
                ) : (
                  <>
                    {productsForSelectedBrand.map((prod, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-apple-primary/10 bg-apple-secondary/30 space-y-2"
                      >
                        <h5
                          className="font-bold text-apple-primary text-xs line-clamp-2"
                          title={prod.name}
                        >
                          {prod.name}
                        </h5>
                        <div className="border-t border-apple-primary/10 pt-2 flex justify-between items-center text-[10px]">
                          <div>
                            <span className="text-apple-tertiary">ยอดขาย</span>
                            <p className="font-bold text-apple-secondary mt-0.5">
                              {prod.sales} ชิ้น
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-apple-tertiary">
                              รายได้สุทธิ
                            </span>
                            <p className="font-black text-emerald-500 mt-0.5">
                              {formatCurrency(prod.revenue)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Mobile summary card for products */}
                    <div className="col-span-full p-4 rounded-2xl border bg-apple-tertiary/40 border-apple-primary/10 space-y-3">
                      <div className="flex justify-between items-center font-black text-apple-primary text-sm">
                        <span>
                          ยอดรวมทั้งหมด ({productsForSelectedBrand.length}{" "}
                          รายการสินค้า)
                        </span>
                      </div>
                      <div className="border-t border-apple-primary/20 pt-2 flex justify-between items-center text-xs font-bold text-apple-primary">
                        <div>
                          <span>รวมยอดจำหน่าย</span>
                          <p className="text-sm mt-0.5">
                            {selectedBrandTotals.sales} ชิ้น
                          </p>
                        </div>
                        <div className="text-right">
                          <span>รวมรายได้สุทธิ</span>
                          <p className="text-sm text-blue-500 mt-0.5">
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

      {salesSubTab === "uploaded-files" && (
        <div className="space-y-4 animate-fade-in">
          {/* File Type Filter Toggle */}
          <div className="flex bg-apple-tertiary/40 p-1 rounded-2xl gap-1 border border-apple-primary/5 shadow-inner w-fit">
            <button
              type="button"
              onClick={() => setFileViewerType("order")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                fileViewerType === "order"
                  ? isDarkMode
                    ? "bg-white text-black shadow-sm font-black border border-white/10"
                    : "bg-black text-white shadow-sm font-black border border-black/5"
                  : isDarkMode
                    ? "text-neutral-400 hover:text-white"
                    : "text-neutral-500 hover:text-black"
              }`}
            >
              ไฟล์คำสั่งซื้อ (Order Files)
            </button>
            <button
              type="button"
              onClick={() => setFileViewerType("income")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                fileViewerType === "income"
                  ? isDarkMode
                    ? "bg-white text-black shadow-sm font-black border border-white/10"
                    : "bg-black text-white shadow-sm font-black border border-black/5"
                  : isDarkMode
                    ? "text-neutral-400 hover:text-white"
                    : "text-neutral-500 hover:text-black"
              }`}
            >
              ไฟล์รายรับแพลตฟอร์ม (Income Files)
            </button>
          </div>

          <DatasetViewer
            datasets={orderDatasets}
            type={fileViewerType}
            isDarkMode={isDarkMode}
            onDeleteDataset={onDeleteDataset}
            requestConfirm={requestConfirm}
          />
        </div>
      )}
    </div>
  );
};
