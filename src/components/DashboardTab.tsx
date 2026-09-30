import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Calendar,
  LineChart,
  PieChart as PieChartIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ShoppingBag,
  Zap,
  Package,
  Search,
  X,
  ArrowRight,
  Copy,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Trophy,
  Crown,
  Filter,
  Sparkles,
  RotateCcw,
  HelpCircle,
  Download,
  Printer,
  FileSpreadsheet,
  Tag,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import type { Order, Product, UploadedDataset } from "../types";
import {
  maskCustomerName,
  resolveBrandName,
  extractOrdersFromDatasets,
  formatDateDisplay,
} from "../utils";
import { convertDatasetToOrders } from "../utils/fileParser";
import { ConfettiEffect } from "./ConfettiEffect";
import { CalculatorTab } from "./CalculatorTab";
import { DatePickerField } from "./DatePickerField";

// Helper to extract numeric Gross order amount accurately (supporting both order and income records)
const getOrderGrossAmount = (o: Order): number => {
  if (o.isCancelled) {
    if (typeof o.total === "number" && o.total > 0) return o.total;
    if (typeof o.paidPrice === "number" && o.paidPrice > 0) return o.paidPrice;
    if (typeof o.price === "number" && o.price > 0) return o.price * (o.quantity || 1);
    if (typeof o.unitPrice === "number" && o.unitPrice > 0) return o.unitPrice * (o.quantity || 1);
  }

  const netBasedGross = typeof o.netIncome === "number" && o.netIncome !== 0
    ? Math.abs(o.netIncome + (o.platformFee || 0) + (o.shippingFee || 0))
    : 0;

  if (o.isIncome && netBasedGross > 0) {
    if (typeof o.total === "number" && o.total > netBasedGross) {
      return o.total;
    }
    return netBasedGross;
  }

  if (typeof o.total === "number" && o.total !== 0) {
    return Math.max(Math.abs(o.total), netBasedGross);
  }
  if (typeof o.paidPrice === "number" && o.paidPrice !== 0) return Math.abs(o.paidPrice);
  if (typeof o.price === "number" && o.price !== 0) return Math.abs(o.price);
  if (typeof o.unitPrice === "number" && o.unitPrice !== 0) return Math.abs(o.unitPrice);
  if (netBasedGross > 0) return netBasedGross;
  return Math.abs(o.total || 0);
};

// Helper to determine if an order was cancelled before fulfillment/completion
const isCancelledOrder = (o: Order): boolean => {
  if (o.isCancelled) return true;
  if (o.cancelReason && !o.isReturnRefund) return true;
  const rawStatus = (o.status || "").toLowerCase();
  const rawReason = (o.cancelReason || "").toLowerCase();
  const rawData = `${o.productName || ""} ${o.itemName || ""} ${o.customerName || ""} ${o.orderNumber || ""} ${o.cancelReason || ""}`.toLowerCase();
  if (
    o.isCancelled ||
    rawStatus.includes("cancel") ||
    rawStatus.includes("ยกเลิก") ||
    rawReason.includes("cancel") ||
    rawReason.includes("ยกเลิก") ||
    rawData.includes("cancel") ||
    rawData.includes("ยกเลิก")
  ) {
    return true;
  }
  return false;
};

// Helper to determine if an order was returned, refunded or cancelled
const isRefundOrder = (o: Order): boolean => {
  if (o.isReturnRefund) return true;
  if (o.status === "Refunded") return true;
  if ((o.total || 0) < 0 || (o.netIncome || 0) < 0) return true;
  if (o.isCancelled) return true;
  const rawStatus = (o.status || "").toLowerCase();
  const rawReason = (o.cancelReason || "").toLowerCase();
  const rawData = `${o.productName || ""} ${o.itemName || ""} ${o.customerName || ""} ${o.orderNumber || ""} ${rawStatus} ${rawReason}`.toLowerCase();
  return (
    rawData.includes("refund") ||
    rawData.includes("คืนเงิน") ||
    rawData.includes("return") ||
    rawData.includes("คืนสินค้า") ||
    rawData.includes("ส่งคืน") ||
    rawData.includes("cancel") ||
    rawData.includes("ยกเลิก")
  );
};

interface DashboardTabProps {
  isDarkMode: boolean;
  orders: Order[];
  products?: Product[];
  productFiles?: UploadedDataset[];
  uploadedDatasets?: UploadedDataset[];
  formatCurrency: (val: number) => string;
  setActiveTab: (
    val:
      | "dashboard"
      | "sales"
      | "calculator"
      | "import-orders"
      | "users"
      | "settings",
  ) => void;
  setSalesSubTab?: (val: "income" | "products" | "orders" | "brands") => void;
  onChannelClick?: (channel: string) => void;
}


interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  metricInfo: {
    label: string;
    key: string;
    color: string;
  };
  activeMetric: string;
  formatCurrency: (value: number) => string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  metricInfo,
  activeMetric,
  formatCurrency,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const val = payload[0]?.value || 0;

  let displayVal = `${val.toLocaleString()} รายการ`;
  if (
    activeMetric === "revenue" ||
    activeMetric === "netIncome" ||
    activeMetric === "cancelled" ||
    activeMetric === "refund_sales" ||
    activeMetric === "aov"
  ) {
    displayVal = formatCurrency(val);
  } else if (activeMetric === "conversions" || activeMetric === "profitMargin") {
    displayVal = `${val.toFixed(1)}%`;
  } else if (activeMetric === "customers") {
    displayVal = `${val.toLocaleString()} ชิ้น`;
  }

  return (
    <div className="bg-neutral-900/90 dark:bg-neutral-800/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl border border-white/10 text-xs flex flex-col gap-1 z-50 min-w-[140px] animate-scale-in">
      <span className="text-neutral-400 font-medium text-[10px] uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: metricInfo.color }}
          />
          <span className="font-semibold">{metricInfo.label}:</span>
        </div>
        <span className="font-bold font-mono text-white text-[13px]">
          {displayVal}
        </span>
      </div>
    </div>
  );
};

interface CustomYAxisTickProps {
  x?: number;
  y?: number;
  payload?: {
    value: string;
  };
  isDarkMode: boolean;
  onChannelClick?: (channel: string) => void;
}

const CustomYAxisTick: React.FC<CustomYAxisTickProps> = ({
  x,
  y,
  payload,
  isDarkMode,
  onChannelClick,
}) => {
  if (!payload) return null;
  return (
    <g
      transform={`translate(${x ?? 0},${y ?? 0})`}
      onClick={() => onChannelClick?.(payload.value)}
      style={{ cursor: "pointer" }}
      className="hover:opacity-75 transition-opacity"
    >
      <text
        x={-10}
        y={4}
        textAnchor="end"
        fill={isDarkMode ? "#f5f5f7" : "#171717"}
        fontSize={13.5}
        fontWeight="700"
      >
        {payload.value}
      </text>
    </g>
  );
};

const DashboardTabComponent: React.FC<DashboardTabProps> = ({
  isDarkMode,
  orders,
  products = [],
  productFiles = [],
  uploadedDatasets = [],
  formatCurrency,
  setActiveTab,
  setSalesSubTab,
  onChannelClick,
}) => {
  const kpiScrollRef = useRef<HTMLDivElement>(null);
  const [kpiCarouselPage, setKpiCarouselPage] = useState<0 | 1>(0);

  const scrollKpiCards = (direction: "left" | "right") => {
    if (kpiScrollRef.current) {
      const scrollAmount = kpiScrollRef.current.clientWidth;
      const targetLeft = direction === "left" ? 0 : scrollAmount;
      kpiScrollRef.current.scrollTo({ left: targetLeft, behavior: "smooth" });
      setKpiCarouselPage(direction === "left" ? 0 : 1);
    }
  };

  const handleKpiScroll = () => {
    if (kpiScrollRef.current) {
      const scrollLeft = kpiScrollRef.current.scrollLeft;
      const clientWidth = kpiScrollRef.current.clientWidth;
      if (scrollLeft > clientWidth * 0.3) {
        setKpiCarouselPage(1);
      } else {
        setKpiCarouselPage(0);
      }
    }
  };

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionSortKey, setTransactionSortKey] = useState<"date" | "gross" | "net" | "product">("date");
  const [transactionSortDir, setTransactionSortDir] = useState<"asc" | "desc">("desc");
  const [topProductsMetric, setTopProductsMetric] = useState<"units" | "revenue">("units");
  const [topProductsLimit, setTopProductsLimit] = useState<5 | 10>(5);
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 2400);
  };

  const handleCopyOrderId = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedOrderId(id);
    showToast(`📋 คัดลอกเลขออเดอร์ #${id.length > 15 ? id.substring(0, 15) + '...' : id} สำเร็จแล้ว!`);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  const handleSortToggle = (key: "date" | "gross" | "net" | "product") => {
    if (transactionSortKey === key) {
      setTransactionSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setTransactionSortKey(key);
      setTransactionSortDir("desc");
    }
    setCurrentPage(1);
  };

  // Extract and normalize all order records from orders prop, productFiles and uploadedDatasets
  const allCombinedOrders = useMemo<Order[]>(() => {
    const combined: Order[] = [];
    const seenOrderKeys = new Set<string>();

    const processDataset = (ds: UploadedDataset) => {
      if (!ds) return;
      try {
        const dsOrders = convertDatasetToOrders(ds);
        dsOrders.forEach((o) => {
          if (!o || !o.id) return;
          const key = o.id.trim().toLowerCase();
          if (!seenOrderKeys.has(key)) {
            seenOrderKeys.add(key);
            combined.push({
              ...o,
              datasetId: ds.id,
              fileName: ds.fileName,
              datasetName: ds.fileName,
            });
          }
        });
      } catch (e) {
        console.warn("Failed to convert dataset to orders in DashboardTab:", e);
      }
    };

    if (uploadedDatasets && uploadedDatasets.length > 0) {
      uploadedDatasets.forEach(processDataset);
    }
    if (productFiles && productFiles.length > 0) {
      productFiles.forEach(processDataset);
    }
    if (orders && orders.length > 0) {
      orders.forEach((o) => {
        if (!o || !o.id) return;
        const key = o.id.trim().toLowerCase();
        if (!seenOrderKeys.has(key)) {
          seenOrderKeys.add(key);
          combined.push(o);
        }
      });
    }

    return combined;
  }, [orders, productFiles, uploadedDatasets]);

  // 1. All product orders (คัดกรองเฉพาะจากไฟล์ข้อมูลสินค้าและคำสั่งซื้อ Orders เท่านั้น ไม่เอาไฟล์ income)
  const productOrderRecords = useMemo<Order[]>(() => {
    const productAndOrderDatasets = [
      ...(productFiles || []),
      ...(uploadedDatasets || []).filter((ds) => {
        if (!ds) return false;
        const name = (ds.fileName || "").toLowerCase();
        const fType = (ds.fileType || ds.type || ds.kind || "").toLowerCase();
        if (fType === "income" || fType === "glossary" || fType === "data")
          return false;
        if (
          name.includes("income") ||
          name.includes("รายรับ") ||
          name.includes("statement") ||
          name.includes("โอนเงิน") ||
          name.includes("payout") ||
          name.includes("settlement") ||
          name.includes("transaction") ||
          name.includes("finance")
        ) {
          return false;
        }
        return true;
      }),
    ];

    const directOrderRecords = (orders || []).filter((o) => {
      if (!o || o.isIncome || o.type === "income" || o.kind === "income")
        return false;
      const id = (o.id || "").toLowerCase();
      if (id.startsWith("ord-f_") || id.startsWith("inc-")) return false;
      const name = (o.productName || o.itemName || "").toLowerCase();
      if (
        name.startsWith("รายการการรายรับ") ||
        name.startsWith("รายการรายรับ") ||
        name.includes("statement")
      ) {
        return false;
      }
      return true;
    });

    const extracted = extractOrdersFromDatasets(
      productAndOrderDatasets,
      directOrderRecords,
      products,
    );
    const filtered = extracted.filter((o) => {
      if (!o || o.isIncome || o.type === "income" || o.kind === "income")
        return false;
      const id = (o.id || "").toLowerCase();
      if (id.startsWith("ord-f_") || id.startsWith("inc-")) return false;
      const name = (o.productName || o.itemName || "").toLowerCase();
      if (
        name.startsWith("รายการการรายรับ") ||
        name.startsWith("รายการรายรับ") ||
        name.includes("statement")
      ) {
        return false;
      }
      return true;
    });

    if (filtered.length > 0) return filtered;

    // Fallback: If only statement/income datasets exist, extract product & brand records from all datasets
    const allDatasets = [...(productFiles || []), ...(uploadedDatasets || [])];
    const allDirectOrders = orders || [];
    return extractOrdersFromDatasets(allDatasets, allDirectOrders, products).filter((o) => {
      if (!o) return false;
      const name = (o.productName || o.itemName || "").toLowerCase();
      return (
        !name.startsWith("รายการการรายรับ") &&
        !name.startsWith("รายการรายรับ") &&
        !name.includes("statement")
      );
    });
  }, [productFiles, uploadedDatasets, orders, products]);

  // 2. All income datasets & records
  const incomeDatasets = useMemo<UploadedDataset[]>(() => {
    return (uploadedDatasets || []).filter(
      (ds) =>
        ds &&
        (ds.fileType === "income" ||
          (ds.type as string) === "income" ||
          ds.kind === "income" ||
          ds.fileName.toLowerCase().includes("income") ||
          ds.fileName.toLowerCase().includes("รายรับ") ||
          ds.fileName.toLowerCase().includes("โอนเงิน") ||
          ds.fileName.toLowerCase().includes("statement") ||
          ds.fileName.toLowerCase().includes("payout")),
    );
  }, [uploadedDatasets]);

  const directIncomeOrders = useMemo<Order[]>(() => {
    return (orders || []).filter(
      (o) => o && (o.isIncome || o.type === "income" || o.kind === "income"),
    );
  }, [orders]);

  const incomeRecords = useMemo<Order[]>(() => {
    return extractOrdersFromDatasets(
      incomeDatasets,
      directIncomeOrders,
      products,
    );
  }, [incomeDatasets, directIncomeOrders, products]);

  // 3. ข้อมูลคำสั่งซื้อสินค้า (Order Records) พร้อมผูกค่าธรรมเนียม/สุทธิจาก Income ถ้ามี
  const orderRecordsWithIncome = useMemo<Order[]>(() => {
    if (productOrderRecords.length > 0) {
      const incomeLookup = new Map<string, Order>();
      incomeRecords.forEach((inc) => {
        if (inc && inc.id) {
          const cleanId = inc.id
            .replace(/-row-.*$/, "")
            .trim()
            .toLowerCase();
          incomeLookup.set(cleanId, inc);
        }
      });

      return productOrderRecords.map((o) => {
        if (o && o.id) {
          const cleanId = o.id
            .replace(/-row-.*$/, "")
            .trim()
            .toLowerCase();
          const matchedIncome = incomeLookup.get(cleanId);
          if (matchedIncome) {
            const finalTotal =
              o.total && o.total > 0
                ? o.total
                : matchedIncome.total && matchedIncome.total > 0
                  ? matchedIncome.total
                  : Math.max(
                      0,
                      (matchedIncome.netIncome ?? 0) +
                        (matchedIncome.platformFee ?? 0) +
                        (matchedIncome.shippingFee ?? 0),
                    );
            return {
              ...o,
              total: finalTotal > 0 ? finalTotal : o.total,
              platformFee: matchedIncome.platformFee ?? o.platformFee,
              shippingFee: matchedIncome.shippingFee ?? o.shippingFee,
              netIncome: matchedIncome.netIncome ?? o.netIncome,
              date: !o.date || o.date === "" ? matchedIncome.date : o.date,
            };
          }
        }
        return o;
      });
    }
    return productOrderRecords;
  }, [productOrderRecords, incomeRecords]);

  // 4. Financial & dashboard summary records (รวมและประมวลผลข้อมูลจากไฟล์ที่นำเข้าทั้งหมดอย่างถูกต้อง)
  const selectedRecords = useMemo<Order[]>(() => {
    if (incomeRecords.length > 0) return incomeRecords;
    if (orderRecordsWithIncome.length > 0) return orderRecordsWithIncome;
    if (productOrderRecords.length > 0) return productOrderRecords;
    return allCombinedOrders;
  }, [incomeRecords, orderRecordsWithIncome, productOrderRecords, allCombinedOrders]);

  const defaultDateRange = useMemo(() => {
    // Collect all valid dates from all datasets & orders
    const dateSet = new Set<string>();
    const scanDates = (list: Order[]) => {
      list.forEach((o) => {
        if (!o || !o.date) return;
        const d = o.date.split(" ")[0].split("T")[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          dateSet.add(d);
        }
      });
    };

    scanDates(allCombinedOrders);
    scanDates(productOrderRecords);
    scanDates(incomeRecords);

    if (dateSet.size > 0) {
      const sortedDates = Array.from(dateSet).sort();
      return {
        startDate: sortedDates[0],
        endDate: sortedDates[sortedDates.length - 1],
      };
    }

    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const today = `${year}-${month}-${day}`;

    const dPast = new Date();
    dPast.setDate(dPast.getDate() - 30);
    const pYear = dPast.getFullYear();
    const pMonth = String(dPast.getMonth() + 1).padStart(2, "0");
    const pDay = String(dPast.getDate()).padStart(2, "0");

    return {
      startDate: `${pYear}-${pMonth}-${pDay}`,
      endDate: today,
    };
  }, [allCombinedOrders, productOrderRecords, incomeRecords]);

  // Dashboard date state is completely independent of other tabs/calculator
  const [userStartDate, setUserStartDate] = useState<string | null>(null);
  const [userEndDate, setUserEndDate] = useState<string | null>(null);

  // Clean up any legacy localStorage date filter keys on mount so dashboard is completely independent
  useEffect(() => {
    try {
      localStorage.removeItem("dashboard_filter_startDate");
      localStorage.removeItem("dashboard_filter_endDate");
    } catch {
      // ignore
    }
  }, []);

  const customStartDate = userStartDate ?? defaultDateRange.startDate;
  const customEndDate = userEndDate ?? defaultDateRange.endDate;
  const setCustomStartDate = (date: string) => setUserStartDate(date);
  const setCustomEndDate = (date: string) => setUserEndDate(date);

  const todayRange = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;
    return { start: todayStr, end: todayStr };
  }, []);

  const last7DaysRange = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    const dPast = new Date();
    dPast.setDate(dPast.getDate() - 6);
    const pYear = dPast.getFullYear();
    const pMonth = String(dPast.getMonth() + 1).padStart(2, "0");
    const pDay = String(dPast.getDate()).padStart(2, "0");
    const pastStr = `${pYear}-${pMonth}-${pDay}`;

    return { start: pastStr, end: todayStr };
  }, []);

  const last30DaysRange = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    const dPast = new Date();
    dPast.setDate(dPast.getDate() - 29);
    const pYear = dPast.getFullYear();
    const pMonth = String(dPast.getMonth() + 1).padStart(2, "0");
    const pDay = String(dPast.getDate()).padStart(2, "0");
    const pastStr = `${pYear}-${pMonth}-${pDay}`;

    return { start: pastStr, end: todayStr };
  }, []);

  const handleExportChannelCSV = () => {
    // 1. Channel summary
    const totalOrders = channelSalesData.reduce(
      (sum, item) => sum + item.count,
      0,
    );
    const totalRev = totalChannelRevenue;

    // 2. Source for items (to calculate brand units, sales, and top products)
    const sourceForItems =
      orderRecordsWithIncome.length > 0
        ? orderRecordsWithIncome
        : productOrderRecords.length > 0
          ? productOrderRecords
          : selectedRecords;

    // Brand mapping: revenue, unitsSold, orderCount
    const brandMap: Record<
      string,
      { revenue: number; unitsSold: number; orderCount: number }
    > = {};

    // Channel x Brand breakdown mapping
    const channelBrandMap: Record<
      string,
      Record<string, { unitsSold: number; revenue: number; orderCount: number }>
    > = {};

    // Best-selling products mapping
    const productMap: Record<
      string,
      {
        productName: string;
        brand: string;
        channelCounts: Record<string, number>;
        unitsSold: number;
        revenue: number;
        orderCount: number;
      }
    > = {};

    sourceForItems.forEach((o) => {
      if (!o || !o.date || o.status === "Refunded" || o.isIncome) return;
      const dStr = o.date.split(" ")[0].split("T")[0];
      if (dStr >= customStartDate && dStr <= customEndDate) {
        const rawName = (o.productName || o.itemName || "").trim();
        const brand = resolveBrandName(o.brand, rawName, o, products);
        const channel = o.channel || "อื่นๆ";
        const qty = o.quantity && o.quantity > 0 ? o.quantity : 1;
        const total = Number(o.total) || 0;

        // Brand Map
        if (!brandMap[brand]) {
          brandMap[brand] = { revenue: 0, unitsSold: 0, orderCount: 0 };
        }
        brandMap[brand].unitsSold += qty;
        brandMap[brand].revenue += total;
        brandMap[brand].orderCount += 1;

        // Channel x Brand Map
        if (!channelBrandMap[channel]) {
          channelBrandMap[channel] = {};
        }
        if (!channelBrandMap[channel][brand]) {
          channelBrandMap[channel][brand] = {
            unitsSold: 0,
            revenue: 0,
            orderCount: 0,
          };
        }
        channelBrandMap[channel][brand].unitsSold += qty;
        channelBrandMap[channel][brand].revenue += total;
        channelBrandMap[channel][brand].orderCount += 1;

        // Filter valid product names for best selling products list
        const lower = rawName.toLowerCase();
        const isValidProductName =
          rawName &&
          rawName.length >= 2 &&
          rawName !== "-" &&
          rawName !== "--" &&
          rawName !== "/" &&
          rawName !== "\\" &&
          rawName !== "..." &&
          lower !== "total" &&
          lower !== "sum" &&
          lower !== "grand total" &&
          lower !== "subtotal" &&
          lower !== "ยอดรวม" &&
          lower !== "ยอดขายรวม" &&
          lower !== "ชื่อสินค้า" &&
          lower !== "product name" &&
          lower !== "item name" &&
          !lower.startsWith("รายการสินค้า") &&
          !lower.startsWith("รายการการรายรับ") &&
          !lower.startsWith("รายการรายรับ") &&
          !lower.includes("statement");

        if (isValidProductName) {
          if (!productMap[rawName]) {
            productMap[rawName] = {
              productName: rawName,
              brand: brand,
              channelCounts: {},
              unitsSold: 0,
              revenue: 0,
              orderCount: 0,
            };
          }
          productMap[rawName].unitsSold += qty;
          productMap[rawName].revenue += total;
          productMap[rawName].orderCount += 1;
          productMap[rawName].channelCounts[channel] =
            (productMap[rawName].channelCounts[channel] || 0) + qty;
        }
      }
    });

    // Report Headers
    const reportTitle = `"รายงานวิเคราะห์ยอดขายตามช่องทางขาย แบรนด์ และสินค้าขายดี (Channel, Brand & Top Products Report)"`;
    const storeNameRow = `"ชื่อร้านค้า:","Phanvadee Store"`;
    const periodRow = `"ช่วงเวลาเลือก:","${formatDateDisplay(customStartDate)} ถึง ${formatDateDisplay(customEndDate)}"`;
    const generatedRow = `"วันที่ออกรายงาน:","${new Date().toLocaleString("th-TH")}"`;

    // --- Section 1: Sales by Channel ---
    const sec1Header = `"================================================================"`;
    const sec1Title = `"1. สรุปยอดขายตามช่องทางการขาย (Sales by Channel Overview)"`;
    const headers1 = [
      "ช่องทางขาย (Channel)",
      "จำนวนออเดอร์ (Orders)",
      "ยอดขายรวมสะสม (Revenue THB)",
      "คิดเป็นเปอร์เซ็นต์ (%)",
    ];
    const rows1 = channelSalesData.map((item) => {
      const percentage =
        totalRev > 0 ? ((item.value / totalRev) * 100).toFixed(1) : "0.0";
      return [
        `"${item.name}"`,
        item.count,
        item.value.toFixed(2),
        `"${percentage}%"`,
      ];
    });
    const summaryRow1 = [
      `"รวมทุกช่องทาง (Total Channels)"`,
      totalOrders,
      totalRev.toFixed(2),
      `"100.0%"`,
    ];

    // --- Section 2: Sales & Units by Brand (สรุปแยกตามแต่ละแบรนด์ว่าขายไปกี่ชิ้น) ---
    const sec2Header = `"================================================================"`;
    const sec2Title = `"2. สรุปยอดขายและจำนวนชิ้นแยกตามแบรนด์ (Sales & Units Sold by Brand)"`;
    const headers2 = [
      "แบรนด์สินค้า (Brand)",
      "จำนวนชิ้นที่ขายได้ (Units Sold)",
      "จำนวนออเดอร์ (Orders)",
      "ยอดขายรวมสุทธิ (Total Revenue THB)",
      "สัดส่วนยอดขาย (%)",
    ];

    const sortedBrands = Object.entries(brandMap).sort(
      (a, b) => b[1].revenue - a[1].revenue || b[1].unitsSold - a[1].unitsSold,
    );
    const totalBrandRevenue = sortedBrands.reduce(
      (sum, [, b]) => sum + b.revenue,
      0,
    );
    const totalBrandUnits = sortedBrands.reduce(
      (sum, [, b]) => sum + b.unitsSold,
      0,
    );
    const totalBrandOrders = sortedBrands.reduce(
      (sum, [, b]) => sum + b.orderCount,
      0,
    );

    const rows2 = sortedBrands.map(([brandName, bData]) => {
      const pct =
        totalBrandRevenue > 0
          ? ((bData.revenue / totalBrandRevenue) * 100).toFixed(1)
          : "0.0";
      const safeBrand = brandName.replace(/"/g, '""');
      return [
        `"${safeBrand}"`,
        bData.unitsSold,
        bData.orderCount,
        bData.revenue.toFixed(2),
        `"${pct}%"`,
      ];
    });
    const summaryRow2 = [
      `"รวมทุกแบรนด์ (Total Brands)"`,
      totalBrandUnits,
      totalBrandOrders,
      totalBrandRevenue.toFixed(2),
      `"100.0%"`,
    ];

    // --- Section 3: Channel x Brand Breakdown (แจกแจงแต่ละช่องทางขายแบรนด์ใดไปกี่ชิ้น) ---
    const sec3Header = `"================================================================"`;
    const sec3Title = `"3. รายละเอียดช่องทางขายและแบรนด์ (Channel & Brand Breakdown)"`;
    const headers3 = [
      "ช่องทางขาย (Channel)",
      "แบรนด์สินค้า (Brand)",
      "จำนวนชิ้นที่ขายได้ (Units Sold)",
      "จำนวนออเดอร์ (Orders)",
      "ยอดขายรวมสุทธิ (Revenue THB)",
    ];

    const rows3: string[][] = [];
    Object.keys(channelBrandMap)
      .sort()
      .forEach((chName) => {
        const brandsInChannel = Object.entries(channelBrandMap[chName]).sort(
          (a, b) =>
            b[1].revenue - a[1].revenue || b[1].unitsSold - a[1].unitsSold,
        );
        brandsInChannel.forEach(([bName, bInfo]) => {
          rows3.push([
            `"${chName.replace(/"/g, '""')}"`,
            `"${bName.replace(/"/g, '""')}"`,
            String(bInfo.unitsSold),
            String(bInfo.orderCount),
            bInfo.revenue.toFixed(2),
          ]);
        });
      });

    // --- Section 4: Best-Selling Products (สินค้าขายดี) ---
    const sec4Header = `"================================================================"`;
    const sec4Title = `"4. สรุปอันดับสินค้าขายดี (Best-Selling Products)"`;
    const headers4 = [
      "อันดับ (Rank)",
      "ชื่อสินค้า (Product Name)",
      "แบรนด์สินค้า (Brand)",
      "ช่องทางขายหลัก (Top Channel)",
      "จำนวนชิ้นที่ขายได้ (Units Sold)",
      "จำนวนออเดอร์ (Orders)",
      "ยอดขายรวมสุทธิ (Total Revenue THB)",
      "ราคาเฉลี่ยต่อชิ้น (Avg Price THB)",
      "สัดส่วนยอดขาย (%)",
    ];

    const sortedProducts = Object.values(productMap).sort(
      (a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold,
    );
    const totalProdRev = sortedProducts.reduce((sum, p) => sum + p.revenue, 0);
    const totalProdUnits = sortedProducts.reduce(
      (sum, p) => sum + p.unitsSold,
      0,
    );
    const totalProdOrders = sortedProducts.reduce(
      (sum, p) => sum + p.orderCount,
      0,
    );

    const rows4 = sortedProducts.map((p, idx) => {
      const pct =
        totalProdRev > 0
          ? ((p.revenue / totalProdRev) * 100).toFixed(1)
          : "0.0";
      const avgP =
        p.unitsSold > 0 ? (p.revenue / p.unitsSold).toFixed(2) : "0.00";
      let topCh = "-";
      let maxChUnits = 0;
      Object.entries(p.channelCounts).forEach(([ch, count]) => {
        if (count > maxChUnits) {
          maxChUnits = count;
          topCh = ch;
        }
      });

      return [
        String(idx + 1),
        `"${p.productName.replace(/"/g, '""')}"`,
        `"${p.brand.replace(/"/g, '""')}"`,
        `"${topCh.replace(/"/g, '""')}"`,
        String(p.unitsSold),
        String(p.orderCount),
        p.revenue.toFixed(2),
        avgP,
        `"${pct}%"`,
      ];
    });

    const summaryRow4 = [
      `"รวมสินค้าทั้งหมด (Total Products)"`,
      `"-"`,
      `"-"`,
      `"-"`,
      String(totalProdUnits),
      String(totalProdOrders),
      totalProdRev.toFixed(2),
      totalProdUnits > 0 ? (totalProdRev / totalProdUnits).toFixed(2) : "0.00",
      `"100.0%"`,
    ];

    // Combine all sections into a single complete CSV
    const csvContent = [
      reportTitle,
      storeNameRow,
      periodRow,
      generatedRow,
      "",
      sec1Header,
      sec1Title,
      sec1Header,
      headers1.map((h) => `"${h}"`).join(","),
      ...rows1.map((row) => row.join(",")),
      summaryRow1.join(","),
      "",
      sec2Header,
      sec2Title,
      sec2Header,
      headers2.map((h) => `"${h}"`).join(","),
      ...rows2.map((row) => row.join(",")),
      summaryRow2.join(","),
      "",
      sec3Header,
      sec3Title,
      sec3Header,
      headers3.map((h) => `"${h}"`).join(","),
      ...rows3.map((row) => row.join(",")),
      "",
      sec4Header,
      sec4Title,
      sec4Header,
      headers4.map((h) => `"${h}"`).join(","),
      ...rows4.map((row) => row.join(",")),
      summaryRow4.join(","),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `phanvadee_channel_report_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportBrandCSV = () => {
    const brandMap: Record<string, { revenue: number; count: number }> = {};
    selectedRecords.forEach((o) => {
      if (o.status !== "Refunded") {
        const b = resolveBrandName(o.brand, o.productName, o, products);
        if (!brandMap[b]) {
          brandMap[b] = { revenue: 0, count: 0 };
        }
        brandMap[b].revenue += Number(o.total || 0);
        brandMap[b].count += o.quantity || 1;
      }
    });

    const totalRevenue = Object.values(brandMap).reduce(
      (sum, b) => sum + b.revenue,
      0,
    );

    const reportTitle = `"รายงานวิเคราะห์ยอดขายตามแบรนด์สินค้า (Sales Analysis by Brand Report)"`;
    const storeNameRow = `"ชื่อร้านค้า:","Phanvadee Store"`;
    const periodRow = `"ช่วงเวลาเลือก:","${formatDateDisplay(customStartDate)} ถึง ${formatDateDisplay(customEndDate)}"`;
    const generatedRow = `"วันที่ออกรายงาน:","${new Date().toLocaleString("th-TH")}"`;

    const headers = [
      "แบรนด์สินค้า (Brand)",
      "จำนวนชิ้นที่ขายได้ (Items Sold)",
      "ยอดเงินรวมสุทธิ (Total Revenue THB)",
      "ส่วนแบ่งยอดขาย (%)",
    ];

    const rows = Object.keys(brandMap).map((brandName) => {
      const bData = brandMap[brandName];
      const percentage =
        totalRevenue > 0
          ? ((bData.revenue / totalRevenue) * 100).toFixed(1)
          : "0.0";
      return [
        `"${brandName}"`,
        bData.count,
        bData.revenue.toFixed(2),
        `"${percentage}%"`,
      ];
    });

    const totalItems = Object.values(brandMap).reduce(
      (sum, b) => sum + b.count,
      0,
    );
    const summaryRow = [
      `"รวมทั้งหมด (Total)"`,
      totalItems,
      totalRevenue.toFixed(2),
      `"100.0%"`,
    ];

    const csvContent = [
      reportTitle,
      storeNameRow,
      periodRow,
      generatedRow,
      "", // Empty line for separation
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((row) => row.join(",")),
      summaryRow.join(","),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `phanvadee_brand_report_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };



  const [activeMetric, setActiveMetric] = useState<
    | "revenue"
    | "orders"
    | "conversions"
    | "customers"
    | "cancelled"
    | "refund_orders"
    | "refund_sales"
    | "aov"
  >("revenue");

  // Dynamic Dashboard Charts Engine
  const chartData = useMemo(() => {
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const list = [];
    const start = new Date(customStartDate);
    const end = new Date(customEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end)
      return [];
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const limit = Math.min(diffDays, 90);

    const curr = new Date(start);
    const monthsShort = [
      "ม.ค.",
      "ก.พ.",
      "มี.ค.",
      "เม.ย.",
      "พ.ค.",
      "มิ.ย.",
      "ก.ค.",
      "ส.ค.",
      "ก.ย.",
      "ต.ค.",
      "พ.ย.",
      "ธ.ค.",
    ];

    const dateMap = new Map<string, Order[]>();
    for (let i = 0; i < allCombinedOrders.length; i++) {
      const o = allCombinedOrders[i];
      if (o.date) {
        const d = o.date.split(" ")[0].split("T")[0];
        if (d >= customStartDate && d <= customEndDate) {
          let arr = dateMap.get(d);
          if (!arr) {
            arr = [];
            dateMap.set(d, arr);
          }
          arr.push(o);
        }
      }
    }

    for (let i = 0; i <= limit; i++) {
      const dateStr = formatDate(curr);
      const dayAllRecords = dateMap.get(dateStr) || [];

      const dayActiveRecords: Order[] = [];
      const dayCancelledRecords: Order[] = [];
      const dayRefundRecords: Order[] = [];

      for (let j = 0; j < dayAllRecords.length; j++) {
        const o = dayAllRecords[j];
        if (isCancelledOrder(o)) {
          dayCancelledRecords.push(o);
        } else if (isRefundOrder(o)) {
          dayRefundRecords.push(o);
        } else {
          dayActiveRecords.push(o);
        }
      }

      let rev = 0;
      let itemsSold = 0;
      for (let j = 0; j < dayActiveRecords.length; j++) {
        const o = dayActiveRecords[j];
        rev += getOrderGrossAmount(o);
        itemsSold += (o.quantity || 1);
      }
      const ords = dayActiveRecords.length;

      let cancSales = 0;
      for (let j = 0; j < dayCancelledRecords.length; j++) {
        cancSales += getOrderGrossAmount(dayCancelledRecords[j]);
      }

      const refOrds = dayRefundRecords.length;
      let refSales = 0;
      for (let j = 0; j < dayRefundRecords.length; j++) {
        refSales += getOrderGrossAmount(dayRefundRecords[j]);
      }

      const dayAov = ords > 0 ? Math.round((rev / ords) * 100) / 100 : 0;

      list.push({
        label: `${curr.getDate()} ${monthsShort[curr.getMonth()]}`,
        revenue: Math.round(rev * 100) / 100,
        orders: ords,
        conversions: ords > 0 ? +(2.0 + (ords % 3) * 0.5).toFixed(1) : 0,
        customers: itemsSold,
        cancelled: Math.round(cancSales * 100) / 100,
        refund_orders: refOrds,
        refund_sales: Math.round(refSales * 100) / 100,
        aov: dayAov,
      });
      curr.setDate(curr.getDate() + 1);
    }
    return list;
  }, [allCombinedOrders, customStartDate, customEndDate]);

  // Dynamically compute a uniform interval so ticks are spaced consistently
  const xAxisInterval = useMemo(() => {
    const len = chartData.length;
    if (len <= 8) return 0;
    if (len <= 15) return 1;
    if (len <= 32) return Math.ceil(len / 7) - 1;
    if (len <= 60) return Math.ceil(len / 8) - 1;
    return Math.ceil(len / 9) - 1;
  }, [chartData.length]);

  // Aggregate stats based on active dataset
  const stats = useMemo(() => {
    const filteredRecords = selectedRecords.filter((o) => {
      if (o.status === "Refunded" || !o.date) return false;
      const dStr = o.date.split(" ")[0].split("T")[0];
      return dStr >= customStartDate && dStr <= customEndDate;
    });

    const totalRev =
      Math.round(
        filteredRecords.reduce((acc, o) => acc + Number(o.total || 0), 0) * 100,
      ) / 100;
    const totalOrd = filteredRecords.length;
    const totalCust = filteredRecords.reduce(
      (acc, o) => acc + (o.quantity || 1),
      0,
    );
    const avgConv = totalOrd > 0 ? +(2.0 + (totalOrd % 3) * 0.5).toFixed(1) : 0;

    // Calculate refunded orders in the selected date range
    const refundedCount = selectedRecords.filter((o) => {
      if (o.status !== "Refunded" || !o.date) return false;
      const dStr = o.date.split(" ")[0].split("T")[0];
      return dStr >= customStartDate && dStr <= customEndDate;
    }).length;

    return {
      revenue: totalRev,
      orders: totalOrd,
      conversions: avgConv,
      customers: totalCust,
      refunded: refundedCount,
    };
  }, [selectedRecords, customStartDate, customEndDate]);

  // Income & Fees calculations (filtered by date range)
  const financialStats = useMemo(() => {
    const filteredRecords = selectedRecords.filter((o) => {
      if (o.status === "Refunded" || !o.date) return false;
      const dStr = o.date.split(" ")[0].split("T")[0];
      return dStr >= customStartDate && dStr <= customEndDate;
    });

    const grossIncome =
      Math.round(
        filteredRecords.reduce((acc, o) => acc + (o.total ?? 0), 0) * 100,
      ) / 100;
    const platformFees =
      Math.round(
        filteredRecords.reduce((acc, o) => acc + (o.platformFee ?? 0), 0) * 100,
      ) / 100;
    const shippingFees =
      Math.round(
        filteredRecords.reduce((acc, o) => acc + (o.shippingFee ?? 0), 0) * 100,
      ) / 100;
    const netIncome =
      Math.round(
        filteredRecords.reduce(
          (acc, o) =>
            acc +
            (o.netIncome ??
              (o.total ?? 0) - (o.platformFee ?? 0) - (o.shippingFee ?? 0)),
          0,
        ) * 100,
      ) / 100;

    return {
      grossIncome,
      platformFees,
      shippingFees,
      netIncome,
      count: filteredRecords.length,
    };
  }, [selectedRecords, customStartDate, customEndDate]);

  const totalNetIncome = financialStats.netIncome;
  const totalPlatformFees = financialStats.platformFees;
  const totalShippingFee = financialStats.shippingFees;

  // Monthly Buckets for uploaded datasets (ดึงเฉพาะเดือนที่พบในไฟล์ที่อัปโหลดเข้ามาจริง)
  const uploadedMonthsList = useMemo(() => {
    const monthBuckets = new Map<string, Order[]>();
    allCombinedOrders.forEach((o) => {
      if (!o.date) return;
      const d = o.date.split(" ")[0].split("T")[0];
      const match = d.match(/^(\d{4}-\d{2})/);
      if (!match) return;
      const mKey = match[1];
      if (!monthBuckets.has(mKey)) {
        monthBuckets.set(mKey, []);
      }
      monthBuckets.get(mKey)!.push(o);
    });

    const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const sortedKeys = Array.from(monthBuckets.keys()).sort();

    return sortedKeys.map((mKey) => {
      const mOrders = monthBuckets.get(mKey) || [];
      const [yearStr, monthStr] = mKey.split("-");
      const year = parseInt(yearStr, 10);
      const mIndex = parseInt(monthStr, 10) - 1;
      const beYear = year > 2400 ? year : year + 543;
      const label = `${thaiMonths[mIndex] || monthStr} ${beYear}`;

      const cancelledOrders = mOrders.filter(isCancelledOrder);
      const cancelledSales = Math.round(
        cancelledOrders.reduce((acc, o) => acc + getOrderGrossAmount(o), 0) * 100
      ) / 100;

      const refundOrders = mOrders.filter(isRefundOrder);
      const refundSales = Math.round(
        refundOrders.reduce((acc, o) => acc + getOrderGrossAmount(o), 0) * 100
      ) / 100;

      const activeOrders = mOrders.filter((o) => !isCancelledOrder(o) && !isRefundOrder(o));
      const activeGross = activeOrders.reduce((acc, o) => acc + getOrderGrossAmount(o), 0);
      const aov = activeOrders.length > 0 ? Math.round((activeGross / activeOrders.length) * 100) / 100 : 0;

      const nonRefunded = mOrders.filter((o) => o.status !== "Refunded");
      const revenue = Math.round(
        nonRefunded.reduce((acc, o) => acc + Number(o.total || 0), 0) * 100
      ) / 100;
      const ordersCount = nonRefunded.length;
      const customers = nonRefunded.reduce((acc, o) => acc + (o.quantity || 1), 0);
      const conversions = ordersCount > 0 ? +(2.0 + (ordersCount % 3) * 0.5).toFixed(1) : 0;

      return {
        monthKey: mKey,
        label,
        orders: mOrders,
        revenue,
        ordersCount,
        customers,
        conversions,
        cancelledOrdersCount: cancelledOrders.length,
        cancelledSales,
        refundOrdersCount: refundOrders.length,
        refundSales,
        aov,
      };
    });
  }, [allCombinedOrders]);

  // Extended seller KPI stats (All 8 Metrics with uploaded months sequential comparison)
  const extendedStats = useMemo(() => {
    const allFiltered = allCombinedOrders.filter((o) => {
      if (!o.date) return false;
      const dStr = o.date.split(" ")[0].split("T")[0];
      return dStr >= customStartDate && dStr <= customEndDate;
    });

    // Cancelled orders & sales
    const cancelledOrders = allFiltered.filter(isCancelledOrder);
    const cancelledSales = Math.round(
      cancelledOrders.reduce((acc, o) => acc + getOrderGrossAmount(o), 0) * 100
    ) / 100;
    const cancelledUnitsCount = cancelledOrders.reduce((acc, o) => acc + (o.quantity || 1), 0);
    const cancelledOrdersCount = cancelledOrders.length;

    // Refund orders & sales
    const refundOrders = allFiltered.filter(isRefundOrder);
    const refundSales = Math.round(
      refundOrders.reduce((acc, o) => acc + getOrderGrossAmount(o), 0) * 100
    ) / 100;
    const refundUnitsCount = refundOrders.reduce((acc, o) => acc + (o.quantity || 1), 0);
    const refundOrdersCount = refundOrders.length;

    // Active orders for AOV calculation
    const activeOrders = allFiltered.filter((o) => !isCancelledOrder(o) && !isRefundOrder(o));
    const activeGross = activeOrders.reduce((acc, o) => acc + getOrderGrossAmount(o), 0);
    const aov = activeOrders.length > 0
      ? Math.round((activeGross / activeOrders.length) * 100) / 100
      : (stats.orders > 0 ? stats.revenue / stats.orders : 0);

    const calcGrowth = (currVal: number, prevVal?: number): number => {
      if (prevVal === undefined || prevVal === null || prevVal === 0) {
        if (currVal > 0) return 100;
        return 0;
      }
      return Math.round(((currVal - prevVal) / prevVal) * 10000) / 100;
    };

    const startM = customStartDate.slice(0, 7);
    const endM = customEndDate.slice(0, 7);
    const isSingleMonth = startM === endM && /^\d{4}-\d{2}$/.test(startM);

    let prevMonthLabel: string;
    let revenueGrowthPercent: number;
    let ordersGrowthPercent: number;
    let conversionsGrowthPercent: number;
    let customersGrowthPercent: number;
    let cancelledGrowthPercent: number;
    let refundOrdersGrowthPercent: number;
    let refundSalesGrowthPercent: number;
    let aovGrowthPercent: number;

    if (isSingleMonth) {
      const foundIdx = uploadedMonthsList.findIndex((m) => m.monthKey === startM);
      if (foundIdx > 0) {
        const prevM = uploadedMonthsList[foundIdx - 1];
        prevMonthLabel = "เดือนก่อนหน้า";
        revenueGrowthPercent = calcGrowth(stats.revenue, prevM.revenue);
        ordersGrowthPercent = calcGrowth(stats.orders, prevM.ordersCount);
        conversionsGrowthPercent = calcGrowth(stats.conversions, prevM.conversions);
        customersGrowthPercent = calcGrowth(stats.customers, prevM.customers);
        cancelledGrowthPercent = calcGrowth(cancelledSales, prevM.cancelledSales);
        refundOrdersGrowthPercent = calcGrowth(refundOrders.length, prevM.refundOrdersCount);
        refundSalesGrowthPercent = calcGrowth(refundSales, prevM.refundSales);
        aovGrowthPercent = calcGrowth(aov, prevM.aov);
      } else if (foundIdx === 0 && uploadedMonthsList.length > 1) {
        prevMonthLabel = "เดือนฐานแรก";
        revenueGrowthPercent = 0;
        ordersGrowthPercent = 0;
        conversionsGrowthPercent = 0;
        customersGrowthPercent = 0;
        cancelledGrowthPercent = 0;
        refundOrdersGrowthPercent = 0;
        refundSalesGrowthPercent = 0;
        aovGrowthPercent = 0;
      } else {
        prevMonthLabel = "เดือนฐานแรก";
        revenueGrowthPercent = 0;
        ordersGrowthPercent = 0;
        conversionsGrowthPercent = 0;
        customersGrowthPercent = 0;
        cancelledGrowthPercent = 0;
        refundOrdersGrowthPercent = 0;
        refundSalesGrowthPercent = 0;
        aovGrowthPercent = 0;
      }
    } else {
      // Multiple months or all time range: compare the latest uploaded month with the previous uploaded month in the dataset
      if (uploadedMonthsList.length > 1) {
        const latest = uploadedMonthsList[uploadedMonthsList.length - 1];
        const prev = uploadedMonthsList[uploadedMonthsList.length - 2];
        prevMonthLabel = "เดือนก่อนหน้า";
        revenueGrowthPercent = calcGrowth(latest.revenue, prev.revenue);
        ordersGrowthPercent = calcGrowth(latest.ordersCount, prev.ordersCount);
        conversionsGrowthPercent = calcGrowth(latest.conversions, prev.conversions);
        customersGrowthPercent = calcGrowth(latest.customers, prev.customers);
        cancelledGrowthPercent = calcGrowth(latest.cancelledSales, prev.cancelledSales);
        refundOrdersGrowthPercent = calcGrowth(latest.refundOrdersCount, prev.refundOrdersCount);
        refundSalesGrowthPercent = calcGrowth(latest.refundSales, prev.refundSales);
        aovGrowthPercent = calcGrowth(latest.aov, prev.aov);
      } else {
        prevMonthLabel = "เดือนฐานแรก";
        revenueGrowthPercent = 0;
        ordersGrowthPercent = 0;
        conversionsGrowthPercent = 0;
        customersGrowthPercent = 0;
        cancelledGrowthPercent = 0;
        refundOrdersGrowthPercent = 0;
        refundSalesGrowthPercent = 0;
        aovGrowthPercent = 0;
      }
    }

    return {
      cancelledOrdersCount,
      cancelledUnitsCount,
      cancelledSales,
      refundOrdersCount: refundOrdersCount || stats.refunded,
      refundUnitsCount,
      refundSales,
      aov,
      prevMonthLabel,
      revenueGrowthPercent,
      ordersGrowthPercent,
      conversionsGrowthPercent,
      customersGrowthPercent,
      cancelledGrowthPercent,
      refundOrdersGrowthPercent,
      refundSalesGrowthPercent,
      aovGrowthPercent,
    };
  }, [allCombinedOrders, customStartDate, customEndDate, stats, uploadedMonthsList]);

  // Dynamic Channels Dashboard Analyzer
  const channelSalesData = useMemo(() => {
    const channelMap: Record<
      Order["channel"],
      { revenue: number; count: number }
    > = {
      "TikTok Shop": { revenue: 0, count: 0 },
      Shopee: { revenue: 0, count: 0 },
      Lazada: { revenue: 0, count: 0 },
      Facebook: { revenue: 0, count: 0 },
      "LINE OA": { revenue: 0, count: 0 },
      อื่นๆ: { revenue: 0, count: 0 },
    };

    selectedRecords.forEach((o) => {
      if (!o.date || o.status === "Refunded") return;
      const dStr = o.date.split(" ")[0].split("T")[0];
      if (dStr >= customStartDate && dStr <= customEndDate) {
        const rawChan = o.channel || "อื่นๆ";
        const chanLower = rawChan.toLowerCase().trim();
        let c: Order["channel"] = "อื่นๆ";
        if (chanLower === "lazada" || chanLower.startsWith("laz") || chanLower.includes("ลาซาด้า")) c = "Lazada";
        else if (chanLower === "shopee" || chanLower.startsWith("sp") || chanLower.includes("ช้อปปี้") || chanLower.includes("ช็อปปี้")) c = "Shopee";
        else if (chanLower.includes("tiktok") || chanLower.startsWith("tt") || chanLower.includes("ติ๊กต๊อก") || chanLower.includes("ติ๊กตอก")) c = "TikTok Shop";
        else if (chanLower === "facebook" || chanLower.startsWith("fb") || chanLower.includes("เฟส") || chanLower.includes("เฟซ")) c = "Facebook";
        else if (chanLower.includes("line") || chanLower.startsWith("line") || chanLower.includes("ไลน์")) c = "LINE OA";
        else if (
          [
            "TikTok Shop",
            "Shopee",
            "Lazada",
            "Facebook",
            "LINE OA",
            "อื่นๆ",
          ].includes(rawChan as Order["channel"])
        ) {
          c = rawChan as Order["channel"];
        }

        const amt = Number(o.total || 0);
        if (amt > 0 || o.isIncome) {
          channelMap[c].revenue += amt;
          channelMap[c].count += 1;
        }
      }
    });

    const channels: Order["channel"][] = [
      "TikTok Shop",
      "Shopee",
      "Lazada",
      "Facebook",
      "LINE OA",
      "อื่นๆ",
    ];

    const colors: Record<string, string> = {
      "TikTok Shop": isDarkMode ? "#25f4ee" : "#111111",
      Shopee: "#ee4d2d",
      Lazada: isDarkMode ? "#5c59f0" : "#2E2BB8",
      Facebook: "#1877f2",
      "LINE OA": "#00c300",
      อื่นๆ: isDarkMode ? "#767676" : "#a3a3a3",
    };

    return channels.map((key) => ({
      name: key,
      value: channelMap[key].revenue,
      count: channelMap[key].count,
      color: colors[key] || (isDarkMode ? "#767676" : "#a3a3a3"),
    }));
  }, [selectedRecords, isDarkMode, customStartDate, customEndDate]);

  // Total channel revenue for percentages
  const totalChannelRevenue = useMemo(() => {
    return channelSalesData.reduce((acc, item) => acc + item.value, 0);
  }, [channelSalesData]);

  // Best-Selling Products / Top Items Calculation (ดึงเฉพาะจาก ข้อมูลสินค้า Order)
  const topProducts = useMemo(() => {
    if (
      orderRecordsWithIncome.length === 0 &&
      productOrderRecords.length === 0
    ) {
      return [];
    }

    const productMap: Record<
      string,
      {
        productName: string;
        brand: string;
        unitsSold: number;
        revenue: number;
        orderCount: number;
      }
    > = {};

    const sourceForTopProducts =
      orderRecordsWithIncome.length > 0
        ? orderRecordsWithIncome
        : productOrderRecords;

    sourceForTopProducts.forEach((o) => {
      if (!o || !o.date || o.status === "Refunded" || o.isIncome) return;
      const dStr = o.date.split(" ")[0].split("T")[0];
      if (dStr >= customStartDate && dStr <= customEndDate) {
        const name = (o.productName || o.itemName || "").trim();
        const lower = name.toLowerCase();
        if (
          !name ||
          name.length < 2 ||
          name === "-" ||
          name === "--" ||
          name === "/" ||
          name === "\\" ||
          name === "..." ||
          lower === "total" ||
          lower === "sum" ||
          lower === "grand total" ||
          lower === "subtotal" ||
          lower === "ยอดรวม" ||
          lower === "ยอดขายรวม" ||
          lower === "ชื่อสินค้า" ||
          lower === "product name" ||
          lower === "item name" ||
          lower.startsWith("รายการสินค้า") ||
          lower.startsWith("รายการการรายรับ") ||
          lower.startsWith("รายการรายรับ") ||
          lower.includes("statement")
        ) {
          return;
        }

        const brand = resolveBrandName(o.brand, name, o, products);
        const qty = o.quantity && o.quantity > 0 ? o.quantity : 1;
        const total = Number(o.total) || 0;

        if (!productMap[name]) {
          productMap[name] = {
            productName: name,
            brand: brand,
            unitsSold: 0,
            revenue: 0,
            orderCount: 0,
          };
        }
        productMap[name].unitsSold += qty;
        productMap[name].revenue += total;
        productMap[name].orderCount += 1;
      }
    });

    return Object.values(productMap)
      .sort((a, b) =>
        topProductsMetric === "revenue"
          ? b.revenue - a.revenue || b.unitsSold - a.unitsSold
          : b.unitsSold - a.unitsSold || b.revenue - a.revenue,
      )
      .slice(0, topProductsLimit);
  }, [
    orderRecordsWithIncome,
    productOrderRecords,
    customStartDate,
    customEndDate,
    products,
    topProductsMetric,
    topProductsLimit,
  ]);

  const totalTopProductsRevenue = useMemo(() => {
    return topProducts.reduce((acc, p) => acc + p.revenue, 0);
  }, [topProducts]);

  const maxTopMetricValue = useMemo(() => {
    if (topProducts.length === 0) return 0;
    return Math.max(
      ...topProducts.map((p) =>
        topProductsMetric === "revenue" ? p.revenue : p.unitsSold,
      ),
      1,
    );
  }, [topProducts, topProductsMetric]);

  // Base raw transaction list (ดึงรายการคำสั่งซื้อจาก Order และ Income files ที่นำเข้าทั้งหมด)
  const baseTransactionsList = useMemo(() => {
    if (orderRecordsWithIncome.length > 0 && orderRecordsWithIncome.some((o) => !o.isIncome)) {
      return orderRecordsWithIncome;
    }
    if (productOrderRecords.length > 0) {
      return productOrderRecords;
    }
    if (incomeRecords.length > 0) {
      return incomeRecords;
    }
    return allCombinedOrders;
  }, [orderRecordsWithIncome, productOrderRecords, incomeRecords, allCombinedOrders]);

  // Dynamic Channel Filter Options with counts
  const channelFilterOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    baseTransactionsList.forEach((o) => {
      const ch = o.channel || "ทั่วไป";
      counts[ch] = (counts[ch] || 0) + 1;
    });

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return [
      { key: "all", label: "ทั้งหมด", count: baseTransactionsList.length },
      ...entries.map(([ch, cnt]) => ({ key: ch, label: ch, count: cnt })),
    ];
  }, [baseTransactionsList]);

  // Helper to determine accurate status (e.g. negative amounts / reversals are Refunded, not Paid)
  const getEffectiveOrderStatus = (o: Order): "Paid" | "Pending" | "Refunded" => {
    const rawNet = Number(
      o.netIncome ??
        Number(o.total || 0) - Number(o.platformFee || 0) - Number(o.shippingFee || 0),
    );
    if (
      rawNet < 0 ||
      Number(o.total || 0) < 0 ||
      o.status === "Refunded" ||
      o.isReturnRefund ||
      (o.id && (o.id.startsWith("SR") || o.id.startsWith("#SR"))) ||
      (o.orderNumber && (o.orderNumber.startsWith("SR") || o.orderNumber.startsWith("#SR")))
    ) {
      return "Refunded";
    }
    return o.status || "Paid";
  };

  // Dynamic Status Filter Options with counts
  const statusFilterOptions = useMemo(() => {
    const counts: Record<string, number> = { Paid: 0, Pending: 0, Refunded: 0 };
    baseTransactionsList.forEach((o) => {
      const st = getEffectiveOrderStatus(o);
      counts[st] = (counts[st] || 0) + 1;
    });

    return [
      { key: "all", label: "ทุกสถานะ", count: baseTransactionsList.length, color: "bg-apple-tertiary" },
      { key: "Paid", label: "ชำระแล้ว", count: counts.Paid || 0, color: "bg-emerald-500" },
      { key: "Pending", label: "รอโอน", count: counts.Pending || 0, color: "bg-amber-500" },
      { key: "Refunded", label: "คืนเงิน", count: counts.Refunded || 0, color: "bg-rose-500" },
    ];
  }, [baseTransactionsList]);

  // Filtered Transactions List with search + channel + status + sort
  const allFilteredTransactions = useMemo(() => {
    if (baseTransactionsList.length === 0) return [];

    return baseTransactionsList
      .filter((o) => {
        // Channel filter
        if (selectedChannelFilter !== "all" && (o.channel || "ทั่วไป") !== selectedChannelFilter) {
          return false;
        }

        // Status filter
        if (selectedStatusFilter !== "all" && getEffectiveOrderStatus(o) !== selectedStatusFilter) {
          return false;
        }

        // Search query filter
        if (transactionSearch.trim()) {
          const q = transactionSearch.toLowerCase();
          const matchId = (o.id || "").toLowerCase().includes(q);
          const matchName = (o.productName || o.itemName || "").toLowerCase().includes(q);
          const matchCust = (o.customerName || "").toLowerCase().includes(q);
          const matchBrand = (o.brand || "").toLowerCase().includes(q);
          const matchChan = (o.channel || "").toLowerCase().includes(q);
          if (!matchId && !matchName && !matchCust && !matchBrand && !matchChan) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (transactionSortKey === "date") {
          comparison = (a.date || "").localeCompare(b.date || "");
        } else if (transactionSortKey === "gross") {
          comparison = (Number(a.total) || 0) - (Number(b.total) || 0);
        } else if (transactionSortKey === "net") {
          const netA = Number(
            a.netIncome ??
              Number(a.total || 0) - Number(a.platformFee || 0) - Number(a.shippingFee || 0),
          );
          const netB = Number(
            b.netIncome ??
              Number(b.total || 0) - Number(b.platformFee || 0) - Number(b.shippingFee || 0),
          );
          comparison = netA - netB;
        } else if (transactionSortKey === "product") {
          const nameA = a.productName || a.itemName || "";
          const nameB = b.productName || b.itemName || "";
          comparison = nameA.localeCompare(nameB);
        }
        return transactionSortDir === "asc" ? comparison : -comparison;
      });
  }, [
    baseTransactionsList,
    selectedChannelFilter,
    selectedStatusFilter,
    transactionSearch,
    transactionSortKey,
    transactionSortDir,
  ]);

  // Filtered Summary Stats
  const filteredSummaryStats = useMemo(() => {
    const count = allFilteredTransactions.length;
    const isOnlyRefunds = selectedStatusFilter === "Refunded";

    const gross = allFilteredTransactions.reduce((sum, o) => {
      const g = Number(o.total || 0);
      if (isOnlyRefunds) {
        return sum + Math.abs(g);
      }
      if (o.status === "Refunded") {
        // If it's a negative adjustment transaction (e.g. -250), deduct it
        return sum + (g < 0 ? g : 0);
      }
      return sum + g;
    }, 0);

    const net = allFilteredTransactions.reduce((sum, o) => {
      const rawNet = Number(
        o.netIncome ??
          Number(o.total || 0) - Number(o.platformFee || 0) - Number(o.shippingFee || 0),
      );
      if (isOnlyRefunds) {
        return sum + (rawNet < 0 ? rawNet : -Math.abs(Number(o.total || 0)));
      }
      if (o.status === "Refunded") {
        // If this refund was recorded as a negative deduction (e.g. TikTok adjustment -250), include it
        return sum + (rawNet < 0 ? rawNet : 0);
      }
      return sum + rawNet;
    }, 0);

    const paidCount = allFilteredTransactions.filter((o) => (o.status || "Paid") === "Paid").length;
    const successRate = count > 0 ? ((paidCount / count) * 100).toFixed(0) : "0";

    return { count, gross, net, paidCount, successRate };
  }, [allFilteredTransactions, selectedStatusFilter]);

  // Pagination calculations
  const effectivePageSize = pageSize === 0 ? allFilteredTransactions.length || 1 : pageSize;
  const totalPages = Math.max(1, Math.ceil(allFilteredTransactions.length / effectivePageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedTransactions = useMemo(() => {
    if (pageSize === 0) return allFilteredTransactions;
    const start = (safeCurrentPage - 1) * pageSize;
    return allFilteredTransactions.slice(start, start + pageSize);
  }, [allFilteredTransactions, safeCurrentPage, pageSize]);

  const metricInfo = (() => {
    switch (activeMetric) {
      case "orders":
        return {
          label: "จำนวนธุรกรรมสั่งซื้อ",
          key: "orders",
          color: isDarkMode ? "#22d3ee" : "#0891b2",
        };
      case "conversions":
        return {
          label: "อัตราคอนเวอร์ชั่น (%)",
          key: "conversions",
          color: isDarkMode ? "#34d399" : "#059669",
        };
      case "customers":
        return {
          label: "จำนวนยอดชิ้นสินค้าที่จำหน่ายได้",
          key: "customers",
          color: isDarkMode ? "#fb7185" : "#e11d48",
        };
      case "cancelled":
        return {
          label: "ยอดขายที่ยกเลิก (บาท)",
          key: "cancelled",
          color: isDarkMode ? "#34d399" : "#10b981",
        };
      case "refund_orders":
        return {
          label: "คำสั่งซื้อที่คืนเงิน/คืนสินค้า",
          key: "refund_orders",
          color: isDarkMode ? "#f43f5e" : "#e11d48",
        };
      case "refund_sales":
        return {
          label: "ยอดขายที่คืนเงิน/คืนสินค้า (บาท)",
          key: "refund_sales",
          color: isDarkMode ? "#94a3b8" : "#64748b",
        };
      case "aov":
        return {
          label: "ยอดขายเฉลี่ยต่อคำสั่งซื้อ (บาท)",
          key: "aov",
          color: isDarkMode ? "#fbbf24" : "#f59e0b",
        };
      default:
        return {
          label: "ยอดขายรวมสะสม (บาท)",
          key: "revenue",
          color: isDarkMode ? "#818cf8" : "#4f46e5",
        };
    }
  })();

  const roleStyles = {
    textActive: isDarkMode ? "text-[#f5f5f7]" : "text-neutral-700",
  };

  return (
    <div className="space-y-6">
      {/* Header and filters controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 shadow-xs border border-neutral-800/80 dark:border-neutral-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-500 animate-pulse" />
              <span>Real-Time Sales Tracker</span>
            </span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            สรุปยอดจำหน่ายในระบบ
          </h3>
          <p className="text-xs sm:text-sm font-medium mt-1 text-neutral-500 dark:text-neutral-400">
            เลือกช่วงเวลา เพื่ออัปเดตการวิเคราะห์ยอดขายตามวันที่และช่องทางขาย
          </p>
        </div>

        {/* Date filter & Export controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 no-print w-full xl:w-auto">
          {/* Unified Date Filter Controls */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 bg-white/90 dark:bg-neutral-900/90 p-1.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs backdrop-blur-xl animate-fade-up">
            {/* Compact Date Range Pickers */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-1 text-xs font-bold text-neutral-600 dark:text-neutral-300 pl-1.5 pr-0.5">
                <Calendar className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <span className="text-[11px] font-bold whitespace-nowrap">ช่วงวันที่:</span>
              </div>
              <div className="w-28 sm:w-32 md:w-36">
                <DatePickerField
                  value={customStartDate}
                  onChange={setCustomStartDate}
                />
              </div>
              <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 px-0.5">–</span>
              <div className="w-28 sm:w-32 md:w-36">
                <DatePickerField
                  value={customEndDate}
                  onChange={setCustomEndDate}
                />
              </div>
            </div>

            {/* Quick Presets (วันนี้, 7 วัน, 30 วันล่าสุด, ทั้งหมด) - แสดงเฉพาะที่หน้าแดชบอร์ด (Slide 0) */}
            {kpiCarouselPage === 0 && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-t md:border-t-0 md:border-l border-neutral-200/60 dark:border-neutral-800/60 pt-1.5 md:pt-0 md:pl-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate(todayRange.start);
                    setCustomEndDate(todayRange.end);
                  }}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    customStartDate === todayRange.start && customEndDate === todayRange.end
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border-neutral-900 dark:border-white shadow-xs"
                      : "bg-white/80 dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-700"
                  }`}
                >
                  วันนี้
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate(last7DaysRange.start);
                    setCustomEndDate(last7DaysRange.end);
                  }}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    customStartDate === last7DaysRange.start && customEndDate === last7DaysRange.end
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border-neutral-900 dark:border-white shadow-xs"
                      : "bg-white/80 dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-700"
                  }`}
                >
                  7 วัน
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate(last30DaysRange.start);
                    setCustomEndDate(last30DaysRange.end);
                  }}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    customStartDate === last30DaysRange.start && customEndDate === last30DaysRange.end
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border-neutral-900 dark:border-white shadow-xs"
                      : "bg-white/80 dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-700"
                  }`}
                >
                  30 วันล่าสุด
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUserStartDate(null);
                    setUserEndDate(null);
                  }}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    (userStartDate === null && userEndDate === null) ||
                    (customStartDate === defaultDateRange.startDate && customEndDate === defaultDateRange.endDate)
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border-neutral-900 dark:border-white shadow-xs"
                      : "bg-white/80 dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-700"
                  }`}
                >
                  ทั้งหมด
                </button>
              </div>
            )}

            {/* ปุ่มทุกช่วงเวลา สำหรับหน้าเครื่องคำนวณ (Slide 1) */}
            {kpiCarouselPage === 1 && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-t md:border-t-0 md:border-l border-neutral-200/60 dark:border-neutral-800/60 pt-1.5 md:pt-0 md:pl-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setUserStartDate(null);
                    setUserEndDate(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    (userStartDate === null && userEndDate === null) ||
                    (customStartDate === defaultDateRange.startDate && customEndDate === defaultDateRange.endDate)
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border-neutral-900 dark:border-white shadow-xs"
                      : "bg-white/80 dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-700"
                  }`}
                >
                  ทุกช่วงเวลา
                </button>
              </div>
            )}
          </div>

          {/* Export Report Dropdown (เฉพาะหน้าแดชบอร์ดหลัก) */}
          {kpiCarouselPage === 0 && (
            <div className="relative w-full sm:w-auto shrink-0">
              <button
                onClick={() => setIsExportOpen(!isExportOpen)}
                className={`group flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl transition-all duration-300 font-bold text-xs cursor-pointer select-none w-full sm:w-auto border shadow-md hover:shadow-xl active:scale-[0.98] ${
                  isExportOpen
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border-neutral-950 dark:border-white ring-4 ring-neutral-900/15 dark:ring-white/25 scale-[1.02]"
                    : "bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-950 border-neutral-800 dark:border-neutral-200 hover:-translate-y-0.5"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-1.5 rounded-lg transition-transform duration-300 group-hover:scale-110 ${
                      isExportOpen
                        ? "bg-white/20 text-white"
                        : "bg-white/15 dark:bg-neutral-950/10 text-white dark:text-neutral-950"
                    }`}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </div>
                  <span className="tracking-wide">ส่งออกรายงาน</span>
                </div>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-300 opacity-80 group-hover:opacity-100 ${
                    isExportOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isExportOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsExportOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl shadow-2xl z-50 p-2 text-neutral-800 dark:text-neutral-100 animate-scale-in">
                    <div className="px-3 py-1.5 mb-1 flex items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800/80 pb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                        ตัวเลือกการส่งออก (แดชบอร์ดหลัก)
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 whitespace-nowrap shrink-0">
                        3 รายการ
                      </span>
                    </div>

                    <div className="space-y-1">
                      {/* PDF Print option */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsExportOpen(false);
                          setTimeout(() => window.print(), 100);
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-neutral-100/90 dark:hover:bg-neutral-800/80 transition-all cursor-pointer flex items-center gap-3 group/item"
                      >
                        <div className="h-9 w-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 flex items-center justify-center shrink-0 group-hover/item:scale-105 transition-transform">
                          <Printer className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 group-hover/item:text-rose-600 dark:group-hover/item:text-rose-400 transition-colors">
                              พิมพ์รายงานสรุปแดชบอร์ด
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100/70 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                              PDF
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                            พิมพ์หรือบันทึกหน้าสรุปข้อมูลเป็น PDF
                          </p>
                        </div>
                      </button>

                      {/* Sales Channel CSV option */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsExportOpen(false);
                          handleExportChannelCSV();
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-neutral-100/90 dark:hover:bg-neutral-800/80 transition-all cursor-pointer flex items-center gap-3 group/item"
                      >
                        <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 flex items-center justify-center shrink-0 group-hover/item:scale-105 transition-transform">
                          <FileSpreadsheet className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 group-hover/item:text-emerald-600 dark:group-hover/item:text-emerald-400 transition-colors">
                              รายงานตามช่องทางขาย
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                              CSV
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                            แยกยอดขาย ออเดอร์ แบรนด์ และสินค้าขายดี
                          </p>
                        </div>
                      </button>

                      {/* Brand CSV option */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsExportOpen(false);
                          handleExportBrandCSV();
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-neutral-100/90 dark:hover:bg-neutral-800/80 transition-all cursor-pointer flex items-center gap-3 group/item"
                      >
                        <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-center shrink-0 group-hover/item:scale-105 transition-transform">
                          <Tag className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400 transition-colors">
                              รายงานตามแบรนด์สินค้า
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100/70 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50">
                              CSV
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                            สรุปยอดขาย กำไร และจำนวนชิ้นรายแบรนด์
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 8 KPI Cards Unified Horizontal Carousel (พร้อมปุ่มเลื่อนซ้าย-ขวา) */}
      <div className="relative group/kpi-carousel w-full">
        {/* Left Arrow Button */}
        <button
          type="button"
          onClick={() => scrollKpiCards("left")}
          className="absolute -left-3 sm:-left-3.5 top-1/2 -translate-y-1/2 z-30 h-8 w-8 rounded-full bg-white/95 dark:bg-neutral-900/95 shadow-md border border-neutral-200/90 dark:border-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-105 active:scale-95 transition-all opacity-90 group-hover/kpi-carousel:opacity-100 cursor-pointer backdrop-blur-md"
          aria-label="เลื่อนซ้าย"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Right Arrow Button */}
        <button
          type="button"
          onClick={() => scrollKpiCards("right")}
          className="absolute -right-3 sm:-right-3.5 top-1/2 -translate-y-1/2 z-30 h-8 w-8 rounded-full bg-white/95 dark:bg-neutral-900/95 shadow-md border border-neutral-200/90 dark:border-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-105 active:scale-95 transition-all opacity-90 group-hover/kpi-carousel:opacity-100 cursor-pointer backdrop-blur-md"
          aria-label="เลื่อนขวา"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Cards Scroll Container */}
        <div
          ref={kpiScrollRef}
          onScroll={handleKpiScroll}
          className="flex overflow-x-auto no-scrollbar scroll-smooth snap-x gap-3.5 sm:gap-4 py-1"
        >
          {/* 1. Revenue Card */}
          <div
            onClick={() => setActiveMetric("revenue")}
            className={`min-w-[270px] sm:min-w-[calc(50%-0.75rem)] lg:min-w-[calc(25%-0.75rem)] w-[270px] sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-0.75rem)] shrink-0 snap-start p-4 sm:p-5 rounded-2xl cursor-pointer relative overflow-hidden animate-fade-up delay-100 glass-card transition-all duration-300 border flex flex-col justify-between select-none ${
              activeMetric === "revenue"
                ? "border-indigo-500/50 dark:border-indigo-400/50 ring-2 ring-indigo-500/10 dark:ring-indigo-400/20 bg-gradient-to-b from-indigo-500/[0.04] to-transparent shadow-md"
                : "border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                      activeMetric === "revenue"
                        ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <DollarSign className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-xs sm:text-[13px] font-bold tracking-tight text-neutral-700 dark:text-neutral-200 truncate">
                    ยอดขายรวมสะสม
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    activeMetric === "revenue"
                      ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200/60 dark:border-neutral-700/60"
                  }`}
                >
                  ✦ Revenue
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight break-words">
                {formatCurrency(stats.revenue)}
              </p>
            </div>
            <div className="mt-3.5 space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                {totalPlatformFees === 0 && totalShippingFee === 0 ? (
                  <>
                    <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                        เฉลี่ย/ออเดอร์
                      </span>
                      <span
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-bold block truncate mt-0.5"
                        title={formatCurrency(stats.orders > 0 ? stats.revenue / stats.orders : 0)}
                      >
                        {formatCurrency(stats.orders > 0 ? stats.revenue / stats.orders : 0)}
                      </span>
                    </div>
                    <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                        สำเร็จ
                      </span>
                      <span
                        className="text-xs text-emerald-600 dark:text-emerald-400 font-bold block truncate mt-0.5"
                        title={`${stats.orders} รายการ`}
                      >
                        {stats.orders} รายการ
                      </span>
                    </div>
                    <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                        ชิ้นที่จำหน่าย
                      </span>
                      <span
                        className="text-xs text-amber-600 dark:text-amber-400 font-bold block truncate mt-0.5"
                        title={`${stats.customers} ชิ้น`}
                      >
                        {stats.customers} ชิ้น
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                        สุทธิโอน
                      </span>
                      <span
                        className="text-xs text-emerald-600 dark:text-emerald-400 font-bold block truncate mt-0.5"
                        title={formatCurrency(totalNetIncome)}
                      >
                        {formatCurrency(totalNetIncome)}
                      </span>
                    </div>
                    <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                        ค่าธรรมเนียม
                      </span>
                      <span
                        className="text-xs text-rose-600 dark:text-rose-400 font-bold block truncate mt-0.5"
                        title={`-${formatCurrency(totalPlatformFees)}`}
                      >
                        -{formatCurrency(totalPlatformFees)}
                      </span>
                    </div>
                    <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                        ค่าจัดส่ง
                      </span>
                      <span
                        className="text-xs text-amber-600 dark:text-amber-400 font-bold block truncate mt-0.5"
                        title={`-${formatCurrency(totalShippingFee)}`}
                      >
                        -{formatCurrency(totalShippingFee)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 2. Orders Card */}
          <div
            onClick={() => setActiveMetric("orders")}
            className={`min-w-[270px] sm:min-w-[calc(50%-0.75rem)] lg:min-w-[calc(25%-0.75rem)] w-[270px] sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-0.75rem)] shrink-0 snap-start p-4 sm:p-5 rounded-2xl cursor-pointer relative overflow-hidden animate-fade-up delay-200 glass-card transition-all duration-300 border flex flex-col justify-between select-none ${
              activeMetric === "orders"
                ? "border-cyan-500/50 dark:border-cyan-400/50 ring-2 ring-cyan-500/10 dark:ring-cyan-400/20 bg-gradient-to-b from-cyan-500/[0.04] to-transparent shadow-md"
                : "border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                      activeMetric === "orders"
                        ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <ShoppingBag className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-xs sm:text-[13px] font-bold tracking-tight text-neutral-700 dark:text-neutral-200 truncate">
                    ธุรกรรมสั่งซื้อทั้งหมด
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    activeMetric === "orders"
                      ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200/60 dark:border-neutral-700/60"
                  }`}
                >
                  ✓ Orders
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight break-words">
                {stats.orders}{" "}
                <span className="text-xs sm:text-sm font-semibold text-neutral-400">
                  ORDERS
                </span>
              </p>
            </div>
            <div className="mt-3.5 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                    สำเร็จ
                  </span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold block truncate mt-0.5">
                    {stats.orders} รายการ
                  </span>
                </div>
                <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                    คืนเงิน/ยกเลิก
                  </span>
                  <span className="text-xs text-rose-600 dark:text-rose-400 font-bold block truncate mt-0.5">
                    {stats.refunded} รายการ
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Conversions Card */}
          <div
            onClick={() => setActiveMetric("conversions")}
            className={`min-w-[270px] sm:min-w-[calc(50%-0.75rem)] lg:min-w-[calc(25%-0.75rem)] w-[270px] sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-0.75rem)] shrink-0 snap-start p-4 sm:p-5 rounded-2xl cursor-pointer relative overflow-hidden animate-fade-up delay-300 glass-card transition-all duration-300 border flex flex-col justify-between select-none ${
              activeMetric === "conversions"
                ? "border-emerald-500/50 dark:border-emerald-400/50 ring-2 ring-emerald-500/10 dark:ring-emerald-400/20 bg-gradient-to-b from-emerald-500/[0.04] to-transparent shadow-md"
                : "border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                      activeMetric === "conversions"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <Zap className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-xs sm:text-[13px] font-bold tracking-tight text-neutral-700 dark:text-neutral-200 truncate">
                    อัตราความสำเร็จเฉลี่ย
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    activeMetric === "conversions"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200/60 dark:border-neutral-700/60"
                  }`}
                >
                  ⚡ Conversion
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight break-words">
                {stats.conversions}%
              </p>
            </div>
            <div className="mt-3.5 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                    เป้าหมาย
                  </span>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold block truncate mt-0.5">
                    1.5%
                  </span>
                </div>
                <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                    ประสิทธิภาพ
                  </span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold block truncate mt-0.5">
                    เสถียร
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Customers (Items Sold) Card */}
          <div
            onClick={() => setActiveMetric("customers")}
            className={`min-w-[270px] sm:min-w-[calc(50%-0.75rem)] lg:min-w-[calc(25%-0.75rem)] w-[270px] sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-0.75rem)] shrink-0 snap-start p-4 sm:p-5 rounded-2xl cursor-pointer relative overflow-hidden animate-fade-up delay-400 glass-card transition-all duration-300 border flex flex-col justify-between select-none ${
              activeMetric === "customers"
                ? "border-rose-500/50 dark:border-rose-400/50 ring-2 ring-rose-500/10 dark:ring-rose-400/20 bg-gradient-to-b from-rose-500/[0.04] to-transparent shadow-md"
                : "border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                      activeMetric === "customers"
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <Package className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-xs sm:text-[13px] font-bold tracking-tight text-neutral-700 dark:text-neutral-200 truncate">
                    ยอดจำนวนชิ้นที่จำหน่าย
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    activeMetric === "customers"
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200/60 dark:border-neutral-700/60"
                  }`}
                >
                  📦 Items Sold
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight break-words">
                {stats.customers}{" "}
                <span className="text-xs sm:text-sm font-semibold text-neutral-400">
                  PCS
                </span>
              </p>
            </div>
            <div className="mt-3.5 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                    ชิ้นต่อออเดอร์
                  </span>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold block truncate mt-0.5">
                    {stats.orders > 0 ? (stats.customers / stats.orders).toFixed(1) : "0.0"} PCS
                  </span>
                </div>
                <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                    จัดส่งสำเร็จ
                  </span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold block truncate mt-0.5">
                    {stats.customers} ชิ้น
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. ยอดขายที่ยกเลิก */}
          <div
            onClick={() => setActiveMetric("cancelled")}
            className={`min-w-[270px] sm:min-w-[calc(50%-0.75rem)] lg:min-w-[calc(25%-0.75rem)] w-[270px] sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-0.75rem)] shrink-0 snap-start p-4 sm:p-5 rounded-2xl cursor-pointer relative overflow-hidden animate-fade-up glass-card transition-all duration-300 border flex flex-col justify-between select-none ${
              activeMetric === "cancelled"
                ? "border-emerald-500/50 dark:border-emerald-400/50 ring-2 ring-emerald-500/10 dark:ring-emerald-400/20 bg-gradient-to-b from-emerald-500/[0.04] to-transparent shadow-md"
                : "border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                      activeMetric === "cancelled"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <X className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-xs sm:text-[13px] font-bold tracking-tight text-neutral-700 dark:text-neutral-200 truncate">
                    ยอดขายที่ยกเลิก
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                      activeMetric === "cancelled"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200/60 dark:border-neutral-700/60"
                    }`}
                  >
                    ✕ Cancelled
                  </span>
                  <div className="relative group/tooltip shrink-0">
                    <HelpCircle className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors" />
                    <div className="absolute right-0 top-6 z-40 hidden group-hover/tooltip:block w-64 p-2.5 text-[11px] font-normal rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xl border border-white/10 pointer-events-none leading-relaxed">
                      มูลค่ายอดขายรวมของคำสั่งซื้อที่ถูกยกเลิก (คำนวณจากไฟล์รายงานคำสั่งซื้อ Order หากนำเข้าเฉพาะไฟล์รายรับ Income จะเป็น ฿0.00)
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight break-words">
                {formatCurrency(extendedStats.cancelledSales)}
              </p>
            </div>
            <div className="mt-3.5 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                    สินค้าที่ยกเลิก
                  </span>
                  <span className="text-xs text-rose-600 dark:text-rose-400 font-bold block truncate mt-0.5">
                    {extendedStats.cancelledUnitsCount || 0} ชิ้น
                  </span>
                </div>
                <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                    คำสั่งซื้อที่ยกเลิก
                  </span>
                  <span className="text-xs text-neutral-700 dark:text-neutral-300 font-bold block truncate mt-0.5">
                    {extendedStats.cancelledOrdersCount || 0} รายการ
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-1.5 text-[11px] font-medium pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
                <span className="text-neutral-400 dark:text-neutral-500 truncate text-[11px]">
                  {extendedStats.prevMonthLabel === "เดือนฐานแรก" ? "เดือนฐานแรกในระบบ" : "เทียบเดือนก่อนหน้า"}
                </span>
                {extendedStats.prevMonthLabel === "เดือนฐานแรก" ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    ฐานแรก
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      extendedStats.cancelledGrowthPercent > 0
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : extendedStats.cancelledGrowthPercent < 0
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                    }`}
                  >
                    <span>{extendedStats.cancelledGrowthPercent > 0 ? "▲" : extendedStats.cancelledGrowthPercent < 0 ? "▼" : "•"}</span>
                    <span>{extendedStats.cancelledGrowthPercent > 0 ? `+${Math.abs(extendedStats.cancelledGrowthPercent).toFixed(2)}%` : `${extendedStats.cancelledGrowthPercent.toFixed(2)}%`}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 6. คำสั่งซื้อที่คืนเงิน/คืนสินค้า */}
          <div
            onClick={() => setActiveMetric("refund_orders")}
            className={`min-w-[270px] sm:min-w-[calc(50%-0.75rem)] lg:min-w-[calc(25%-0.75rem)] w-[270px] sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-0.75rem)] shrink-0 snap-start p-4 sm:p-5 rounded-2xl cursor-pointer relative overflow-hidden animate-fade-up glass-card transition-all duration-300 border flex flex-col justify-between select-none ${
              activeMetric === "refund_orders"
                ? "border-rose-500/50 dark:border-rose-400/50 ring-2 ring-rose-500/10 dark:ring-rose-400/20 bg-gradient-to-b from-rose-500/[0.04] to-transparent shadow-md"
                : "border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                      activeMetric === "refund_orders"
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <RotateCcw className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-xs sm:text-[13px] font-bold tracking-tight text-neutral-700 dark:text-neutral-200 truncate">
                    คำสั่งซื้อที่คืนเงิน/คืนสินค้า
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                      activeMetric === "refund_orders"
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200/60 dark:border-neutral-700/60"
                    }`}
                  >
                    ↩ Refund
                  </span>
                  <div className="relative group/tooltip shrink-0">
                    <HelpCircle className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors" />
                    <div className="absolute right-0 top-6 z-40 hidden group-hover/tooltip:block w-64 p-2.5 text-[11px] font-normal rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xl border border-white/10 pointer-events-none leading-relaxed">
                      จำนวนคำสั่งซื้อที่มีการส่งคืนสินค้าหรือขอคืนเงิน (รองรับทั้งจากไฟล์ Order และรายการหักลบในไฟล์ Income)
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight break-words">
                {extendedStats.refundOrdersCount}{" "}
                <span className="text-xs sm:text-sm font-semibold text-neutral-400">
                  ORDERS
                </span>
              </p>
            </div>
            <div className="mt-3.5 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                    สินค้าที่ขอคืน
                  </span>
                  <span className="text-xs text-rose-600 dark:text-rose-400 font-bold block truncate mt-0.5">
                    {extendedStats.refundUnitsCount || 0} ชิ้น
                  </span>
                </div>
                <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                    คำสั่งซื้อที่ขอคืน
                  </span>
                  <span className="text-xs text-neutral-700 dark:text-neutral-300 font-bold block truncate mt-0.5">
                    {extendedStats.refundOrdersCount} รายการ
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-1.5 text-[11px] font-medium pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
                <span className="text-neutral-400 dark:text-neutral-500 truncate text-[11px]">
                  {extendedStats.prevMonthLabel === "เดือนฐานแรก" ? "เดือนฐานแรกในระบบ" : "เทียบเดือนก่อนหน้า"}
                </span>
                {extendedStats.prevMonthLabel === "เดือนฐานแรก" ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    ฐานแรก
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      extendedStats.refundOrdersGrowthPercent > 0
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : extendedStats.refundOrdersGrowthPercent < 0
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                    }`}
                  >
                    <span>{extendedStats.refundOrdersGrowthPercent > 0 ? "▲" : extendedStats.refundOrdersGrowthPercent < 0 ? "▼" : "•"}</span>
                    <span>{extendedStats.refundOrdersGrowthPercent > 0 ? `+${Math.abs(extendedStats.refundOrdersGrowthPercent).toFixed(2)}%` : `${extendedStats.refundOrdersGrowthPercent.toFixed(2)}%`}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 7. ยอดขายที่คืนเงิน/คืนสินค้า */}
          <div
            onClick={() => setActiveMetric("refund_sales")}
            className={`min-w-[270px] sm:min-w-[calc(50%-0.75rem)] lg:min-w-[calc(25%-0.75rem)] w-[270px] sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-0.75rem)] shrink-0 snap-start p-4 sm:p-5 rounded-2xl cursor-pointer relative overflow-hidden animate-fade-up glass-card transition-all duration-300 border flex flex-col justify-between select-none ${
              activeMetric === "refund_sales"
                ? "border-indigo-500/50 dark:border-indigo-400/50 ring-2 ring-indigo-500/10 dark:ring-indigo-400/20 bg-gradient-to-b from-indigo-500/[0.04] to-transparent shadow-md"
                : "border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                      activeMetric === "refund_sales"
                        ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <DollarSign className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-xs sm:text-[13px] font-bold tracking-tight text-neutral-700 dark:text-neutral-200 truncate">
                    ยอดขายที่คืนเงิน/คืนสินค้า
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                      activeMetric === "refund_sales"
                        ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200/60 dark:border-neutral-700/60"
                    }`}
                  >
                    ฿ Refund
                  </span>
                  <div className="relative group/tooltip shrink-0">
                    <HelpCircle className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors" />
                    <div className="absolute right-0 top-6 z-40 hidden group-hover/tooltip:block w-64 p-2.5 text-[11px] font-normal rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xl border border-white/10 pointer-events-none leading-relaxed">
                      มูลค่ายอดเงินรวมของคำสั่งซื้อที่มีการขอคืนเงินหรือคืนสินค้า (รองรับทั้งจากไฟล์ Order และ Income)
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight break-words">
                {formatCurrency(extendedStats.refundSales)}
              </p>
            </div>
            <div className="mt-3.5 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                    มูลค่าที่หักคืน
                  </span>
                  <span className="text-xs text-rose-600 dark:text-rose-400 font-bold block truncate mt-0.5">
                    {formatCurrency(extendedStats.refundSales)}
                  </span>
                </div>
                <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                    สัดส่วนยอดขาย
                  </span>
                  <span className="text-xs text-neutral-700 dark:text-neutral-300 font-bold block truncate mt-0.5">
                    {stats.revenue > 0 ? ((extendedStats.refundSales / stats.revenue) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-1.5 text-[11px] font-medium pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
                <span className="text-neutral-400 dark:text-neutral-500 truncate text-[11px]">
                  {extendedStats.prevMonthLabel === "เดือนฐานแรก" ? "เดือนฐานแรกในระบบ" : "เทียบเดือนก่อนหน้า"}
                </span>
                {extendedStats.prevMonthLabel === "เดือนฐานแรก" ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    ฐานแรก
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      extendedStats.refundSalesGrowthPercent > 0
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : extendedStats.refundSalesGrowthPercent < 0
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                    }`}
                  >
                    <span>{extendedStats.refundSalesGrowthPercent > 0 ? "▲" : extendedStats.refundSalesGrowthPercent < 0 ? "▼" : "•"}</span>
                    <span>{extendedStats.refundSalesGrowthPercent > 0 ? `+${Math.abs(extendedStats.refundSalesGrowthPercent).toFixed(2)}%` : `${extendedStats.refundSalesGrowthPercent.toFixed(2)}%`}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 8. ยอดขายเฉลี่ยต่อคำสั่งซื้อ */}
          <div
            onClick={() => setActiveMetric("aov")}
            className={`min-w-[270px] sm:min-w-[calc(50%-0.75rem)] lg:min-w-[calc(25%-0.75rem)] w-[270px] sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-0.75rem)] shrink-0 snap-start p-4 sm:p-5 rounded-2xl cursor-pointer relative overflow-hidden animate-fade-up glass-card transition-all duration-300 border flex flex-col justify-between select-none ${
              activeMetric === "aov"
                ? "border-amber-500/50 dark:border-amber-400/50 ring-2 ring-amber-500/10 dark:ring-amber-400/20 bg-gradient-to-b from-amber-500/[0.04] to-transparent shadow-md"
                : "border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                      activeMetric === "aov"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <Trophy className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-xs sm:text-[13px] font-bold tracking-tight text-neutral-700 dark:text-neutral-200 truncate">
                    ยอดขายเฉลี่ยต่อคำสั่งซื้อ
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                      activeMetric === "aov"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200/60 dark:border-neutral-700/60"
                    }`}
                  >
                    ★ Avg Order
                  </span>
                  <div className="relative group/tooltip shrink-0">
                    <HelpCircle className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors" />
                    <div className="absolute right-0 top-6 z-40 hidden group-hover/tooltip:block w-56 p-2.5 text-[11px] font-normal rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xl border border-white/10 pointer-events-none leading-relaxed">
                      ยอดขายเฉลี่ยต่อหนึ่งคำสั่งซื้อ (Average Order Value - AOV)
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight break-words">
                {formatCurrency(extendedStats.aov)}
              </p>
            </div>
            <div className="mt-3.5 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                    สูตรคำนวณ
                  </span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-bold block truncate mt-0.5">
                    ยอดขาย ÷ คำสั่งซื้อ
                  </span>
                </div>
                <div className="bg-neutral-50/80 dark:bg-neutral-800/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block leading-tight font-medium">
                    ระดับความเสถียร
                  </span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold block truncate mt-0.5">
                    ปกติ
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-1.5 text-[11px] font-medium pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
                <span className="text-neutral-400 dark:text-neutral-500 truncate text-[11px]">
                  {extendedStats.prevMonthLabel === "เดือนฐานแรก" ? "เดือนฐานแรกในระบบ" : "เทียบเดือนก่อนหน้า"}
                </span>
                {extendedStats.prevMonthLabel === "เดือนฐานแรก" ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    ฐานแรก
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      extendedStats.aovGrowthPercent > 0
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : extendedStats.aovGrowthPercent < 0
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                    }`}
                  >
                    <span>{extendedStats.aovGrowthPercent > 0 ? "▲" : extendedStats.aovGrowthPercent < 0 ? "▼" : "•"}</span>
                    <span>{extendedStats.aovGrowthPercent > 0 ? `+${Math.abs(extendedStats.aovGrowthPercent).toFixed(2)}%` : `${extendedStats.aovGrowthPercent.toFixed(2)}%`}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>


      {kpiCarouselPage === 1 ? (
        /* เมื่อเลื่อนมาที่หน้านี้ (Cards 5-8) จะเปลี่ยนเป็นฟีเจอร์คำนวณที่หน้าแดชบอร์ด */
        <div className="animate-fade-up">
          <CalculatorTab
            isDarkMode={isDarkMode}
            orders={orders}
            products={products}
            productFiles={productFiles}
            uploadedDatasets={uploadedDatasets}
            formatCurrency={formatCurrency}
            initialStartDate={customStartDate}
            initialEndDate={customEndDate}
            activeMetricFilter={activeMetric}
            hideSellerMetricCards={true}
          />
        </div>
      ) : (
        <div className="space-y-6 animate-fade-up">
          {/* Graphic Charts: Date Trend Line Chart & Sales Channel Bar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* 1. ยอดขายตามวันที่ (Sales Trend Line/Area Chart) */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-4 sm:p-6 flex flex-col justify-between animate-fade-up delay-500 min-w-0">
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm sm:text-base font-bold flex items-center gap-2 text-apple-primary">
                <LineChart
                  className={`h-4.5 w-4.5 ${roleStyles.textActive} shrink-0`}
                />
                <span>แนวโน้มยอดขายสินค้าตามช่วงเวลา</span>
              </h4>
              <p className="text-xs mt-0.5 text-apple-secondary">
                กราฟแนวโน้มแสดงตัวแปรสถิติ: <strong>{metricInfo.label}</strong>{" "}
                ในช่วง{" "}
                {`ตั้งแต่วันที่ ${formatDateDisplay(customStartDate)} ถึง ${formatDateDisplay(customEndDate)}`}
              </p>
            </div>

            <div className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-apple-secondary/20 text-apple-secondary shrink-0 self-start sm:self-auto">
              ✨ ข้อมูลรวมทั้งหมด
            </div>
          </div>

          <div className="h-64 sm:h-80 w-full min-w-0">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-apple-tertiary font-bold text-sm">
                ไม่มีข้อมูลยอดขายบันทึกไว้ในช่วงเวลานี้
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="dashboardMetricGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={metricInfo.color}
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor={metricInfo.color}
                        stopOpacity={0.01}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={
                      isDarkMode
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.04)"
                    }
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    stroke={isDarkMode ? "#86868b" : "#8e8e93"}
                    fontSize={13}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                    interval={xAxisInterval}
                  />
                  <YAxis
                    stroke={isDarkMode ? "#86868b" : "#8e8e93"}
                    fontSize={13}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => {
                      if (
                        activeMetric === "revenue" ||
                        activeMetric === "cancelled" ||
                        activeMetric === "refund_sales" ||
                        activeMetric === "aov"
                      ) {
                        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                        if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                        return v;
                      }
                      if (activeMetric === "conversions") return `${v}%`;
                      return v;
                    }}
                    dx={-10}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        metricInfo={metricInfo}
                        activeMetric={activeMetric}
                        formatCurrency={formatCurrency}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey={metricInfo.key}
                    stroke={metricInfo.color}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#dashboardMetricGrad)"
                    activeDot={{
                      r: 5,
                      strokeWidth: 2,
                      fill: isDarkMode ? "#1c1c1e" : "#fff",
                      stroke: metricInfo.color,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 2. สัดส่วนช่องทางขาย (Sales Channel Distribution Bar Chart) */}
        <div className="glass-card rounded-2xl p-4 sm:p-6 flex flex-col justify-between animate-fade-up delay-500 min-w-0">
          <div>
            <h4 className="text-base font-bold flex items-center gap-2 mb-1 text-apple-primary">
              <PieChartIcon className="h-4.5 w-4.5 text-apple-tertiary" />
              ส่วนแบ่งรายได้ตามช่องทางขาย
            </h4>
            <p className="text-xs text-apple-secondary font-medium">
              รวมยอดขายจำแนกตามช่องทาง: TikTok, Shopee, Lazada, Facebook, LINE
              OA, และอื่นๆ
            </p>
          </div>

          <div className="h-56 w-full my-4">
            {totalChannelRevenue === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-apple-tertiary font-bold text-xs gap-1">
                <span>ไม่มีสถิติช่องทางจำหน่ายขณะนี้</span>
                <span className="text-[11px] font-normal opacity-75">
                  (อัปโหลดไฟล์ในหน้ารายการยอดขายเพื่อแสดงผล)
                </span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={channelSalesData}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                  onClick={(state) => {
                    if (state && state.activeLabel) {
                      onChannelClick?.(String(state.activeLabel));
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={
                      <CustomYAxisTick
                        isDarkMode={isDarkMode}
                        onChannelClick={onChannelClick}
                      />
                    }
                    tickLine={false}
                    axisLine={false}
                    width={95}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? "#1c1c1e" : "#fff",
                      borderColor: isDarkMode ? "#2c2c2e" : "#e5e5e5",
                      borderRadius: "12px",
                      fontSize: "13.5px",
                      color: isDarkMode ? "#f5f5f7" : "#171717",
                    }}
                    formatter={(value, _, props) => [
                      `${formatCurrency(Number(value))} (${props.payload.count} ออเดอร์)`,
                      "ยอดเงินสะสม",
                    ]}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={14}>
                    {channelSalesData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        style={{ cursor: "pointer" }}
                        className="hover:opacity-85 transition-opacity"
                        onClick={() => onChannelClick?.(entry.name)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Channel details breakdown list */}
          {totalChannelRevenue > 0 && (
            <div className="space-y-1 pt-3 border-t border-apple-primary mt-2">
              {channelSalesData.map((item, idx) => {
                const percentageNum =
                  totalChannelRevenue > 0
                    ? (item.value / totalChannelRevenue) * 100
                    : 0;
                const percentage = percentageNum.toFixed(1);
                return (
                  <div
                    key={idx}
                    onClick={() => onChannelClick?.(item.name)}
                    className="space-y-1 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/30 p-2 -mx-2 rounded-xl transition-all active:scale-[0.98] select-none"
                  >
                    <div className="flex items-center justify-between text-xs sm:text-sm font-bold">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-apple-primary font-bold">
                          {item.name}
                        </span>
                        <span className="text-xs text-apple-tertiary font-medium">
                          ({item.count} รายการ)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-apple-primary font-bold">
                          {formatCurrency(item.value)}
                        </span>
                        <span className="text-xs text-apple-secondary font-bold bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md border border-apple-primary/10">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800/80 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          backgroundColor: item.color,
                          width: `${percentageNum}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Scrolling Brand Ticker Marquee */}
      <div className="py-4 marquee-container bg-apple-secondary/10 my-2 rounded-xl shadow-inner">
        <div className="marquee-content font-condensed text-xs font-bold text-apple-secondary tracking-widest">
          <span>PHANVADEE</span>
          <span>•</span>
          <span>BARBER BRAIN</span>
          <span>•</span>
          <span>VALENTE</span>
          <span>•</span>
          <span>L'ANGEL</span>
          <span>•</span>
          <span>MONETTI</span>
          <span>•</span>
          <span>PHANVADEE</span>
          <span>•</span>
          <span>BARBER BRAIN</span>
          <span>•</span>
          <span>VALENTE</span>
          <span>•</span>
          <span>L'ANGEL</span>
          <span>•</span>
          <span>MONETTI</span>

          {/* Duplicate content to make it scroll seamlessly */}
          <span>•</span>
          <span>PHANVADEE</span>
          <span>•</span>
          <span>BARBER BRAIN</span>
          <span>•</span>
          <span>VALENTE</span>
          <span>•</span>
          <span>L'ANGEL</span>
          <span>•</span>
          <span>MONETTI</span>
          <span>•</span>
          <span>PHANVADEE</span>
          <span>•</span>
          <span>BARBER BRAIN</span>
          <span>•</span>
          <span>VALENTE</span>
          <span>•</span>
          <span>L'ANGEL</span>
          <span>•</span>
          <span>MONETTI</span>
        </div>
      </div>

      {/* Bottom Section: Recent Transactions / Income List & Best Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions & Orders (lg:col-span-2) */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-6 sm:p-7 animate-fade-up delay-500 flex flex-col justify-between space-y-5">
          <div>
            {/* Header with Title & Quick Jump */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-apple-primary/8">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h4 className="text-base sm:text-lg font-bold text-apple-primary tracking-tight">
                    รายการธุรกรรมและคำสั่งซื้อล่าสุด
                  </h4>
                  <span className="text-[11px] font-semibold text-apple-secondary bg-apple-secondary/80 px-2.5 py-0.5 rounded-full border border-apple-primary/10 shadow-xs">
                    {allFilteredTransactions.length} รายการ
                  </span>
                  {(selectedChannelFilter !== "all" || selectedStatusFilter !== "all" || transactionSearch) && (
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20 flex items-center gap-1 animate-pulse">
                      <Sparkles className="h-3 w-3" />
                      กำลังกรอง
                    </span>
                  )}
                </div>
                <p className="text-xs text-apple-tertiary font-normal mt-1">
                  รายการคำสั่งซื้อสินค้าที่นำเข้าล่าสุด พร้อมรายละเอียดสุทธิโอน สถานะ และตัวกรองอัจฉริยะ
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => {
                    setSalesSubTab?.("orders");
                    setActiveTab("sales");
                  }}
                  className="text-xs font-semibold text-apple-secondary hover:text-apple-primary transition-all flex items-center gap-1 cursor-pointer group bg-apple-secondary/50 hover:bg-apple-secondary px-3 py-1.5 rounded-xl border border-apple-primary/10 shadow-xs"
                >
                  <span>ระบบยอดขาย</span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform text-apple-tertiary group-hover:text-apple-primary" />
                </button>
              </div>
            </div>

            {/* Quick Interactive Search & Filter Segment Controls */}
            <div className="pt-4 pb-2 space-y-3">
              {/* Search Bar - Sleek Floating Input */}
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-apple-tertiary/70" />
                <input
                  type="text"
                  placeholder="ค้นหาเลขออเดอร์, สินค้า, แบรนด์, ลูกค้า, ช่องทาง..."
                  value={transactionSearch}
                  onChange={(e) => {
                    setTransactionSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-neutral-100/70 hover:bg-neutral-100 focus:bg-white dark:bg-neutral-800/60 dark:hover:bg-neutral-800/80 dark:focus:bg-neutral-800 border border-neutral-200/60 focus:border-blue-500/50 dark:border-neutral-700/60 rounded-2xl pl-10 pr-9 py-2.5 text-xs text-apple-primary placeholder-apple-tertiary/60 outline-none transition-all shadow-2xs"
                />
                {transactionSearch && (
                  <button
                    onClick={() => {
                      setTransactionSearch("");
                      setCurrentPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-apple-tertiary hover:text-apple-primary hover:bg-apple-secondary transition-colors cursor-pointer"
                    title="ล้างคำค้นหา"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Interactive Filter Pills Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                {/* Channel Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-[11px]">
                  <span className="text-[10px] font-semibold text-apple-tertiary shrink-0 mr-1 flex items-center gap-1 uppercase tracking-wider">
                    <Filter className="h-3 w-3" />
                    ช่องทาง:
                  </span>
                  {channelFilterOptions.map((opt) => {
                    const isSelected = selectedChannelFilter === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => {
                          setSelectedChannelFilter(opt.key);
                          setCurrentPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-full font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm font-semibold scale-102"
                            : "bg-neutral-100/80 hover:bg-neutral-200/80 dark:bg-neutral-800/80 dark:hover:bg-neutral-700/80 text-apple-secondary border border-neutral-200/40 dark:border-neutral-700/40"
                        }`}
                      >
                        {opt.key !== "all" && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                            style={{
                              backgroundColor:
                                channelSalesData.find((c) => c.name === opt.key)?.color ||
                                "#737373",
                            }}
                          />
                        )}
                        <span>{opt.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isSelected
                              ? "bg-white/20 dark:bg-black/20 text-inherit font-bold"
                              : "bg-neutral-200/60 dark:bg-neutral-700/60 text-apple-tertiary font-medium"
                          }`}
                        >
                          {opt.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto text-[11px]">
                  <span className="text-[10px] font-semibold text-apple-tertiary shrink-0 mr-1 uppercase tracking-wider">
                    สถานะ:
                  </span>
                  {statusFilterOptions.map((st) => {
                    const isSelected = selectedStatusFilter === st.key;
                    return (
                      <button
                        key={st.key}
                        onClick={() => {
                          setSelectedStatusFilter(st.key);
                          setCurrentPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-full font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm font-semibold"
                            : "bg-neutral-100/80 hover:bg-neutral-200/80 dark:bg-neutral-800/80 dark:hover:bg-neutral-700/80 text-apple-secondary border border-neutral-200/40 dark:border-neutral-700/40"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${st.color}`} />
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Filter Chips & Live Mini-KPI Ribbon */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-2xl bg-neutral-100/50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-800/60 text-xs backdrop-blur-xs">
                {/* Active Tags or Status Message */}
                <div className="flex items-center gap-2 flex-wrap">
                  {transactionSearch || selectedChannelFilter !== "all" || selectedStatusFilter !== "all" ? (
                    <>
                      <span className="text-[11px] font-semibold text-apple-tertiary">ตัวกรอง:</span>
                      {transactionSearch && (
                        <span className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full text-[11px] font-medium shadow-xs">
                          <span>"{transactionSearch}"</span>
                          <button
                            onClick={() => {
                              setTransactionSearch("");
                              setCurrentPage(1);
                            }}
                            className="hover:text-blue-800 dark:hover:text-blue-200 cursor-pointer p-0.5 rounded-full hover:bg-blue-500/20"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {selectedChannelFilter !== "all" && (
                        <span className="inline-flex items-center gap-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 px-2.5 py-1 rounded-full text-[11px] font-medium shadow-xs">
                          <span>ช่องทาง: {selectedChannelFilter}</span>
                          <button
                            onClick={() => {
                              setSelectedChannelFilter("all");
                              setCurrentPage(1);
                            }}
                            className="hover:text-purple-800 dark:hover:text-purple-200 cursor-pointer p-0.5 rounded-full hover:bg-purple-500/20"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {selectedStatusFilter !== "all" && (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[11px] font-medium shadow-xs">
                          <span>สถานะ: {selectedStatusFilter === "Paid" ? "ชำระแล้ว" : selectedStatusFilter === "Pending" ? "รอโอน" : "คืนเงิน"}</span>
                          <button
                            onClick={() => {
                              setSelectedStatusFilter("all");
                              setCurrentPage(1);
                            }}
                            className="hover:text-emerald-800 dark:hover:text-emerald-200 cursor-pointer p-0.5 rounded-full hover:bg-emerald-500/20"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setTransactionSearch("");
                          setSelectedChannelFilter("all");
                          setSelectedStatusFilter("all");
                          setCurrentPage(1);
                        }}
                        className="text-[11px] font-semibold text-apple-tertiary hover:text-apple-primary underline ml-1 cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                        ล้างทั้งหมด
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-apple-tertiary text-[11px]">
                      <Package className="h-3.5 w-3.5" />
                      <span>แสดงคำสั่งซื้อที่บันทึกไว้ในระบบทั้งหมด</span>
                    </div>
                  )}
                </div>

                {/* Mini Summary Stats for Filtered Subset */}
                <div className="flex items-center gap-3.5 text-[11px] font-semibold shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-neutral-200/60 dark:border-neutral-800/60">
                  <div className="flex items-center gap-1 text-apple-secondary">
                    <span className="text-apple-tertiary font-normal">ยอดรวม:</span>
                    <span className="font-mono text-apple-primary font-bold">{formatCurrency(filteredSummaryStats.gross)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-apple-tertiary font-normal">สุทธิโอน:</span>
                    <span className={`font-mono font-bold ${
                      filteredSummaryStats.net < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {formatCurrency(filteredSummaryStats.net)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-apple-tertiary">
                    <span className="font-normal">สำเร็จ:</span>
                    <span className="text-apple-primary font-bold">{filteredSummaryStats.successRate}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 mt-3 bg-neutral-50/50 dark:bg-neutral-900/30">
              <table className="w-full text-left text-xs borderless-table">
                <thead>
                  <tr className="bg-neutral-100/70 dark:bg-neutral-800/50 text-apple-tertiary text-[11px] font-semibold border-b border-neutral-200/60 dark:border-neutral-800/60 whitespace-nowrap select-none">
                    <th className="py-3 pr-4 pl-4 font-semibold">
                      เลขที่ออเดอร์
                    </th>
                    <th className="py-3 px-3 font-semibold">
                      <button
                        onClick={() => handleSortToggle("date")}
                        className="inline-flex items-center gap-1 hover:text-apple-primary transition-colors cursor-pointer"
                        title="คลิกเพื่อเรียงตามวันที่"
                      >
                        <span>วันที่</span>
                        {transactionSortKey === "date" ? (
                          transactionSortDir === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-apple-primary" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-apple-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="h-2.5 w-2.5 opacity-40 hover:opacity-100" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3 font-semibold">
                      <button
                        onClick={() => handleSortToggle("product")}
                        className="inline-flex items-center gap-1 hover:text-apple-primary transition-colors cursor-pointer"
                        title="คลิกเพื่อเรียงตามชื่อสินค้า"
                      >
                        <span>สินค้า / รายการ</span>
                        {transactionSortKey === "product" ? (
                          transactionSortDir === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-apple-primary" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-apple-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="h-2.5 w-2.5 opacity-40 hover:opacity-100" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3 font-semibold">แบรนด์</th>
                    <th className="py-3 px-3 font-semibold">ช่องทาง</th>
                    <th className="py-3 px-3 text-right font-semibold">
                      <button
                        onClick={() => handleSortToggle("gross")}
                        className="inline-flex items-center gap-1 ml-auto hover:text-apple-primary transition-colors cursor-pointer"
                        title="คลิกเพื่อเรียงตามยอดรวม"
                      >
                        <span>ยอดรวม</span>
                        {transactionSortKey === "gross" ? (
                          transactionSortDir === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-apple-primary" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-apple-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="h-2.5 w-2.5 opacity-40 hover:opacity-100" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3 text-right font-bold text-apple-primary">
                      <button
                        onClick={() => handleSortToggle("net")}
                        className="inline-flex items-center gap-1 ml-auto hover:text-emerald-500 transition-colors cursor-pointer"
                        title="คลิกเพื่อเรียงตามยอดสุทธิโอน"
                      >
                        <span>สุทธิโอน</span>
                        {transactionSortKey === "net" ? (
                          transactionSortDir === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-emerald-500" />
                          )
                        ) : (
                          <ArrowUpDown className="h-2.5 w-2.5 opacity-40 hover:opacity-100" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 pl-3 pr-3 text-center font-semibold">
                      สถานะ
                    </th>
                    <th className="py-3 pr-4 pl-1 text-center font-semibold w-10">
                      ดู
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/40 dark:divide-neutral-800/40">
                  {paginatedTransactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-12 text-center text-apple-tertiary text-xs font-medium"
                      >
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="w-11 h-11 rounded-full bg-apple-secondary/60 flex items-center justify-center text-apple-tertiary">
                            <Search className="h-4.5 w-4.5" />
                          </div>
                          <p className="font-bold text-apple-primary">
                            {transactionSearch || selectedChannelFilter !== "all" || selectedStatusFilter !== "all"
                              ? "ไม่พบคำสั่งซื้อที่ตรงกับเงื่อนไขการค้นหา"
                              : "ยังไม่มีรายการคำสั่งซื้อในระบบ"}
                          </p>
                          <p className="text-[11px] text-apple-tertiary max-w-sm">
                            {transactionSearch || selectedChannelFilter !== "all" || selectedStatusFilter !== "all"
                              ? "ลองปรับเปลี่ยนคำค้นหา หรือคลิกล้างตัวกรองเพื่อดูรายการทั้งหมด"
                              : "นำเข้าไฟล์คำสั่งซื้อจาก Shopee, Lazada, TikTok ในแท็บ 'นำเข้ายอดขาย'"}
                          </p>
                          {(transactionSearch || selectedChannelFilter !== "all" || selectedStatusFilter !== "all") && (
                            <button
                              onClick={() => {
                                setTransactionSearch("");
                                setSelectedChannelFilter("all");
                                setSelectedStatusFilter("all");
                                setCurrentPage(1);
                              }}
                              className="mt-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-apple-primary text-apple-invert hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5 shadow-sm"
                            >
                              <RotateCcw className="h-3 w-3" />
                              ล้างตัวกรองทั้งหมด
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map((o, idx) => {
                      const gross = Number(o.total || 0);
                      const effectiveStatus = getEffectiveOrderStatus(o);
                      const isRefund = effectiveStatus === "Refunded";
                      const rawNet = Number(
                        o.netIncome ??
                          gross -
                            Number(o.platformFee || 0) -
                            Number(o.shippingFee || 0),
                      );
                      const net = isRefund && rawNet > 0 ? 0 : rawNet;
                      const displayTitle =
                        o.productName ||
                        o.itemName ||
                        (o.isIncome ? "รายการรายรับบัญชี" : "สินค้าทั่วไป");
                      const brandName = resolveBrandName(
                        o.brand,
                        o.productName,
                        o,
                        products,
                      );

                      return (
                        <tr
                          key={o.id ? `${o.id}-${idx}` : idx}
                          onClick={() => setSelectedOrderForDetail(o)}
                          className="transition-all hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 group cursor-pointer"
                          title="คลิกเพื่อดูรายละเอียดคำสั่งซื้อ"
                        >
                          {/* Order ID */}
                          <td className="py-3.5 pr-4 pl-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-apple-secondary group-hover:text-apple-primary transition-colors">
                              <span>
                                #
                                {o.id
                                  ? o.id.length > 13
                                    ? o.id.substring(0, 13) + "…"
                                    : o.id
                                  : "-"}
                              </span>
                              {o.id && (
                                <button
                                  onClick={(e) => handleCopyOrderId(o.id!, e)}
                                  title="คัดลอกเลขที่ออเดอร์"
                                  className="opacity-0 group-hover:opacity-100 text-apple-tertiary hover:text-apple-primary hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 p-1 rounded-md transition-all cursor-pointer"
                                >
                                  {copiedOrderId === o.id ? (
                                    <Check className="h-3 w-3 text-emerald-500 animate-scale-in" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-3 text-xs text-apple-tertiary whitespace-nowrap font-normal">
                            {o.date || "-"}
                          </td>

                          {/* Product Details */}
                          <td className="py-3.5 px-3 text-apple-primary max-w-[220px] min-w-[140px]">
                            <div
                              className="font-medium text-xs text-apple-primary truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                              title={displayTitle}
                            >
                              {displayTitle}
                            </div>
                            {o.customerName && (
                              <div className="text-[10px] text-apple-tertiary truncate font-normal mt-0.5">
                                {maskCustomerName(o.customerName)}
                              </div>
                            )}
                          </td>

                          {/* Brand - Clean Borderless Soft Badge */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span className="text-[11px] font-medium text-apple-secondary bg-neutral-100 dark:bg-neutral-800/80 px-2.5 py-0.5 rounded-full">
                              {brandName}
                            </span>
                          </td>

                          {/* Channel */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-apple-secondary">
                              <span
                                className="w-2 h-2 rounded-full shadow-xs"
                                style={{
                                  backgroundColor:
                                    channelSalesData.find(
                                      (c) => c.name === o.channel,
                                    )?.color || "#737373",
                                }}
                              />
                              <span>{o.channel || "ทั่วไป"}</span>
                            </span>
                          </td>

                          {/* Gross Amount */}
                          <td className={`py-3.5 px-3 font-mono text-xs whitespace-nowrap text-right ${
                            gross < 0
                              ? "text-rose-600 dark:text-rose-400 font-semibold"
                              : "text-apple-tertiary font-normal"
                          }`}>
                            {formatCurrency(gross)}
                          </td>

                          {/* Net Amount */}
                          <td className="py-3.5 px-3 whitespace-nowrap text-right">
                            <span
                              className={`font-mono text-xs font-bold ${
                                net < 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : net === 0
                                    ? "text-apple-tertiary font-normal"
                                    : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {formatCurrency(net)}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 pl-3 pr-3 whitespace-nowrap text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-2xs ${
                                effectiveStatus === "Paid"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : effectiveStatus === "Pending"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  effectiveStatus === "Paid"
                                    ? "bg-emerald-500 animate-pulse"
                                    : effectiveStatus === "Pending"
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                                }`}
                              />
                              <span>
                                {effectiveStatus === "Paid"
                                  ? "ชำระแล้ว"
                                  : effectiveStatus === "Pending"
                                    ? "รอโอน"
                                    : "คืนเงิน"}
                              </span>
                            </span>
                          </td>

                          {/* Quick View Button */}
                          <td className="py-3.5 pr-4 pl-1 text-center whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrderForDetail(o);
                              }}
                              title="ดูรายละเอียดคำสั่งซื้อ"
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-apple-tertiary hover:text-apple-primary hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 transition-all cursor-pointer shadow-xs"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View (< md) */}
            <div className="space-y-2.5 md:hidden pt-2">
              {paginatedTransactions.length === 0 ? (
                <div className="py-8 text-center px-3 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 bg-neutral-100/40 dark:bg-neutral-800/20 space-y-2">
                  <p className="text-xs font-semibold text-apple-primary">
                    {transactionSearch || selectedChannelFilter !== "all" || selectedStatusFilter !== "all"
                      ? "ไม่พบข้อมูลตามคำค้นหาที่ระบุ"
                      : "ยังไม่มีรายการคำสั่งซื้อ"}
                  </p>
                  <p className="text-[10px] text-apple-tertiary">
                    {transactionSearch || selectedChannelFilter !== "all" || selectedStatusFilter !== "all"
                      ? "ลองค้นหาด้วยเลขออเดอร์ สินค้า หรือแบรนด์อื่น"
                      : "นำเข้าไฟล์ข้อมูลออเดอร์เพื่อแสดงที่นี่"}
                  </p>
                  {(transactionSearch || selectedChannelFilter !== "all" || selectedStatusFilter !== "all") && (
                    <button
                      onClick={() => {
                        setTransactionSearch("");
                        setSelectedChannelFilter("all");
                        setSelectedStatusFilter("all");
                        setCurrentPage(1);
                      }}
                      className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-apple-primary text-apple-invert cursor-pointer"
                    >
                      ล้างตัวกรอง
                    </button>
                  )}
                </div>
              ) : (
                paginatedTransactions.map((o, idx) => {
                  const gross = Number(o.total || 0);
                  const effectiveStatus = getEffectiveOrderStatus(o);
                  const isRefund = effectiveStatus === "Refunded";
                  const rawNet = Number(
                    o.netIncome ??
                      gross -
                        Number(o.platformFee || 0) -
                        Number(o.shippingFee || 0),
                  );
                  const net = isRefund && rawNet > 0 ? 0 : rawNet;
                  const displayTitle =
                    o.productName ||
                    o.itemName ||
                    (o.isIncome ? "รายการรายรับบัญชี" : "สินค้าทั่วไป");
                  const brandName = resolveBrandName(
                    o.brand,
                    o.productName,
                    o,
                    products,
                  );

                  return (
                    <div
                      key={o.id ? `${o.id}-${idx}` : idx}
                      onClick={() => setSelectedOrderForDetail(o)}
                      className="p-4 rounded-2xl border border-neutral-200/60 dark:border-neutral-800/60 bg-neutral-100/40 dark:bg-neutral-800/30 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50 space-y-2.5 cursor-pointer active:scale-[0.99] transition-all shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1 font-mono text-[11px] font-semibold text-apple-secondary">
                          <span>
                            #
                            {o.id
                              ? o.id.length > 14
                                ? o.id.substring(0, 14) + "…"
                                : o.id
                              : "-"}
                          </span>
                          {o.id && (
                            <button
                              onClick={(e) => handleCopyOrderId(o.id!, e)}
                              className="text-apple-tertiary hover:text-apple-primary p-0.5"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] font-semibold text-apple-secondary bg-neutral-100 dark:bg-neutral-800/80 px-2.5 py-0.5 rounded-full">
                          {o.channel || "ทั่วไป"}
                        </span>
                      </div>

                      <div>
                        <div className="font-semibold text-xs text-apple-primary line-clamp-1">
                          {displayTitle}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-apple-tertiary mt-1">
                          <span>{brandName}</span>
                          <span>{o.date || "-"}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-neutral-200/50 dark:border-neutral-800/50 text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] ${
                            gross < 0 ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-apple-tertiary"
                          }`}>
                            รวม: {formatCurrency(gross)}
                          </span>
                          <span className={`font-bold font-mono ${
                            net < 0
                              ? "text-rose-600 dark:text-rose-400"
                              : net === 0
                                ? "text-apple-tertiary font-normal"
                                : "text-emerald-600 dark:text-emerald-400"
                          }`}>
                            สุทธิ: {formatCurrency(net)}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            effectiveStatus === "Paid"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : effectiveStatus === "Pending"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {effectiveStatus === "Paid"
                            ? "ชำระแล้ว"
                            : effectiveStatus === "Pending"
                              ? "รอโอน"
                              : "คืนเงิน"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls & Rows per page selector */}
            {allFilteredTransactions.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-neutral-200/50 dark:border-neutral-800/50 mt-3 text-xs text-apple-secondary">
                {/* Rows Per Page */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-apple-tertiary font-medium">แสดงต่อหน้า:</span>
                  <div className="flex items-center bg-neutral-100 dark:bg-neutral-800/80 p-0.5 rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 text-[11px]">
                    {[5, 10, 20, 50, 0].map((size) => {
                      const isSelected = pageSize === size;
                      return (
                        <button
                          key={size}
                          onClick={() => {
                            setPageSize(size);
                            setCurrentPage(1);
                          }}
                          className={`px-2.5 py-0.5 rounded-lg font-medium transition-all cursor-pointer ${
                            isSelected
                              ? "bg-white dark:bg-neutral-700 text-apple-primary shadow-xs font-bold"
                              : "text-apple-tertiary hover:text-apple-primary"
                          }`}
                        >
                          {size === 0 ? "ทั้งหมด" : size}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[11px] text-apple-tertiary hidden sm:inline">
                    ({safeCurrentPage > 0 ? (safeCurrentPage - 1) * effectivePageSize + 1 : 0} -{" "}
                    {Math.min(safeCurrentPage * effectivePageSize, allFilteredTransactions.length)} จาก{" "}
                    {allFilteredTransactions.length})
                  </span>
                </div>

                {/* Page Navigation */}
                {pageSize > 0 && totalPages > 1 && (
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPage <= 1}
                      className="p-1.5 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 bg-neutral-100/60 hover:bg-neutral-200/60 dark:bg-neutral-800/60 dark:hover:bg-neutral-700/60 text-apple-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                      title="หน้าก่อนหน้า"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>

                    <div className="flex items-center gap-1 text-xs font-semibold px-2">
                      <span className="text-apple-primary">หน้า {safeCurrentPage}</span>
                      <span className="text-apple-tertiary font-normal">/ {totalPages}</span>
                    </div>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage >= totalPages}
                      className="p-1.5 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 bg-neutral-100/60 hover:bg-neutral-200/60 dark:bg-neutral-800/60 dark:hover:bg-neutral-700/60 text-apple-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                      title="หน้าถัดไป"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Gamified Best Selling Products (lg:col-span-1) */}
        <div className="glass-card rounded-3xl p-6 sm:p-7 animate-fade-up delay-500 flex flex-col justify-between space-y-5">
          <div>
            {/* Header with Metric & Limit Toggles */}
            <div className="flex flex-col gap-3.5 pb-4 border-b border-neutral-200/50 dark:border-neutral-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 shadow-xs">
                    <Trophy className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-base sm:text-lg font-bold text-apple-primary tracking-tight">
                      สินค้าขายดี {topProductsLimit} อันดับแรก
                    </h4>
                    <p className="text-[11px] text-apple-tertiary font-normal">
                      จัดอันดับตาม{topProductsMetric === "revenue" ? "ยอดขายรวม (฿)" : "จำนวนชิ้น"}
                    </p>
                  </div>
                </div>

                {/* Limit Switcher (5 / 10) */}
                <div className="flex items-center bg-neutral-100 dark:bg-neutral-800/80 p-0.5 rounded-xl text-[10px] border border-neutral-200/50 dark:border-neutral-700/50">
                  <button
                    onClick={() => setTopProductsLimit(5)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      topProductsLimit === 5
                        ? "bg-white dark:bg-neutral-700 text-apple-primary shadow-xs font-bold"
                        : "text-apple-tertiary hover:text-apple-primary"
                    }`}
                  >
                    Top 5
                  </button>
                  <button
                    onClick={() => setTopProductsLimit(10)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      topProductsLimit === 10
                        ? "bg-white dark:bg-neutral-700 text-apple-primary shadow-xs font-bold"
                        : "text-apple-tertiary hover:text-apple-primary"
                    }`}
                  >
                    Top 10
                  </button>
                </div>
              </div>

              {/* Metric Toggle Pill */}
              <div className="flex items-center bg-neutral-100 dark:bg-neutral-800/80 p-1 rounded-2xl text-xs border border-neutral-200/50 dark:border-neutral-700/50 w-full">
                <button
                  onClick={() => setTopProductsMetric("units")}
                  className={`flex-1 py-1.5 rounded-xl font-medium transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                    topProductsMetric === "units"
                      ? "bg-white dark:bg-neutral-700 text-apple-primary shadow-xs font-bold"
                      : "text-apple-tertiary hover:text-apple-primary"
                  }`}
                >
                  <Package className="h-3.5 w-3.5" />
                  <span>จำนวนชิ้น</span>
                </button>
                <button
                  onClick={() => setTopProductsMetric("revenue")}
                  className={`flex-1 py-1.5 rounded-xl font-medium transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                    topProductsMetric === "revenue"
                      ? "bg-white dark:bg-neutral-700 text-apple-primary shadow-xs font-bold"
                      : "text-apple-tertiary hover:text-apple-primary"
                  }`}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>ยอดขาย ฿</span>
                </button>
              </div>
            </div>

            {topProducts.length === 0 ? (
              <div className="py-14 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-11 h-11 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 text-apple-tertiary/70 flex items-center justify-center mb-2.5 border border-neutral-200/50 dark:border-neutral-700/50">
                  <Trophy className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <p className="text-xs font-bold text-apple-primary">
                  ไม่มีสถิติสินค้าขายดีในช่วงเวลานี้
                </p>
                <p className="text-[11px] text-apple-tertiary font-normal mt-0.5 max-w-[200px]">
                  ระบบจะจัดอันดับอัตโนมัติเมื่อมีข้อมูลยอดขาย
                </p>
                <button
                  onClick={() => setActiveTab("sales")}
                  className="mt-3 text-[11px] font-semibold text-apple-secondary hover:text-apple-primary flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>ดูสถิติยอดขาย</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {topProducts.map((prod, idx) => {
                  const currentMetricVal =
                    topProductsMetric === "revenue"
                      ? prod.revenue
                      : prod.unitsSold;
                  const pct =
                    maxTopMetricValue > 0
                      ? (currentMetricVal / maxTopMetricValue) * 100
                      : 0;
                  const sharePct =
                    totalTopProductsRevenue > 0
                      ? ((prod.revenue / totalTopProductsRevenue) * 100).toFixed(1)
                      : "0";

                  // Rank Medal Badging
                  const isGold = idx === 0;
                  const isSilver = idx === 1;
                  const isBronze = idx === 2;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setTransactionSearch(prod.productName);
                        setCurrentPage(1);
                        if (isGold) {
                          setShowConfetti(true);
                          setTimeout(() => setShowConfetti(false), 3000);
                          showToast(`🎉 สินค้าขายดีอันดับ 1: "${prod.productName}"`);
                        } else {
                          showToast(`🔍 กรองคำสั่งซื้อ: "${prod.productName}"`);
                        }
                      }}
                      className={`p-3.5 rounded-2xl transition-all space-y-2.5 cursor-pointer group border ${
                        isGold
                          ? "bg-amber-500/[0.06] hover:bg-amber-500/[0.12] border-amber-500/25 shadow-xs"
                          : isSilver
                            ? "bg-slate-500/[0.04] hover:bg-slate-500/[0.09] border-slate-500/20"
                            : isBronze
                              ? "bg-orange-500/[0.04] hover:bg-orange-500/[0.09] border-orange-500/20"
                              : "bg-neutral-100/40 hover:bg-neutral-100/70 dark:bg-neutral-800/30 dark:hover:bg-neutral-800/60 border-neutral-200/50 dark:border-neutral-800/50"
                      }`}
                      title="คลิกเพื่อกรองในตารางคำสั่งซื้อ"
                    >
                      <div className="flex items-start justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Rank Medal Badge */}
                          <div
                            className={`w-7 h-7 rounded-xl shrink-0 flex items-center justify-center font-mono font-black text-xs shadow-xs ${
                              isGold
                                ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white ring-2 ring-amber-400/30"
                                : isSilver
                                  ? "bg-gradient-to-br from-slate-300 to-slate-500 text-white"
                                  : isBronze
                                    ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white"
                                    : "bg-neutral-100 dark:bg-neutral-800 text-apple-tertiary border border-neutral-200/50 dark:border-neutral-700/50 font-bold"
                            }`}
                          >
                            {isGold ? (
                              <Crown className="h-4 w-4" />
                            ) : (
                              <span>{idx + 1}</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div
                              className="font-semibold text-xs text-apple-primary truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                              title={prod.productName}
                            >
                              {prod.productName}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-apple-tertiary font-normal mt-0.5">
                              <span className="font-medium text-apple-secondary">{prod.brand}</span>
                              <span>•</span>
                              <span className="text-blue-600 dark:text-blue-400 font-semibold bg-blue-500/10 px-1.5 py-0.2 rounded-full">{sharePct}% ของท็อป</span>
                            </div>
                          </div>
                        </div>

                        {/* Stats Summary */}
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-apple-primary block font-mono">
                            {topProductsMetric === "revenue"
                              ? formatCurrency(prod.revenue)
                              : `${prod.unitsSold} ชิ้น`}
                          </span>
                          <div className="text-[10px] text-apple-tertiary font-normal mt-0.5 font-mono">
                            {topProductsMetric === "revenue"
                              ? `${prod.unitsSold} ชิ้น`
                              : formatCurrency(prod.revenue)}
                          </div>
                        </div>
                      </div>

                      {/* Vibrant Gradient Progress Bar */}
                      <div className="w-full h-1.5 bg-neutral-200/60 dark:bg-neutral-700/50 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${
                            isGold
                              ? "bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 shadow-sm"
                              : isSilver
                                ? "bg-gradient-to-r from-slate-400 to-cyan-500"
                                : isBronze
                                  ? "bg-gradient-to-r from-amber-600 to-orange-500"
                                  : "bg-gradient-to-r from-blue-500 to-indigo-500"
                          }`}
                          style={{
                            width: `${pct}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Minimalist Order Detail Modal */}
      {selectedOrderForDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setSelectedOrderForDetail(null)}
        >
          <div
            className="bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800/80 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-neutral-200/60 dark:border-neutral-800/60">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-apple-tertiary">
                  รายละเอียดคำสั่งซื้อ
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 font-mono text-sm font-bold text-apple-primary">
                  <span>#{selectedOrderForDetail.id || "N/A"}</span>
                  {selectedOrderForDetail.id && (
                    <button
                      onClick={(e) =>
                        handleCopyOrderId(selectedOrderForDetail.id!, e)
                      }
                      title="คัดลอกรหัสออเดอร์"
                      className="text-apple-tertiary hover:text-apple-primary p-1 rounded hover:bg-apple-secondary transition-colors cursor-pointer"
                    >
                      {copiedOrderId === selectedOrderForDetail.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderForDetail(null)}
                className="p-1 rounded-lg text-apple-tertiary hover:text-apple-primary hover:bg-apple-secondary transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body Info */}
            <div className="space-y-3 text-xs">
              {/* Product info */}
              <div className="p-3 rounded-xl bg-neutral-100/60 dark:bg-neutral-800/40 space-y-1">
                <div className="text-[10px] text-apple-tertiary font-medium">
                  สินค้า
                </div>
                <div className="font-semibold text-apple-primary text-sm line-clamp-2">
                  {selectedOrderForDetail.productName ||
                    selectedOrderForDetail.itemName ||
                    "สินค้าทั่วไป"}
                </div>
                <div className="flex items-center justify-between text-apple-secondary text-[11px] pt-1">
                  <span>
                    แบรนด์:{" "}
                    <strong>
                      {resolveBrandName(
                        selectedOrderForDetail.brand,
                        selectedOrderForDetail.productName,
                        selectedOrderForDetail,
                        products,
                      )}
                    </strong>
                  </span>
                  <span>
                    จำนวน:{" "}
                    <strong>
                      {selectedOrderForDetail.quantity &&
                      selectedOrderForDetail.quantity > 0
                        ? selectedOrderForDetail.quantity
                        : 1}{" "}
                      ชิ้น
                    </strong>
                  </span>
                </div>
              </div>

              {/* Order Meta details grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60">
                  <div className="text-[10px] text-apple-tertiary">วันที่</div>
                  <div className="font-medium text-apple-primary mt-0.5">
                    {selectedOrderForDetail.date || "-"}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60">
                  <div className="text-[10px] text-apple-tertiary">ช่องทาง</div>
                  <div className="font-medium text-apple-primary mt-0.5">
                    {selectedOrderForDetail.channel || "ทั่วไป"}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60">
                  <div className="text-[10px] text-apple-tertiary">ลูกค้า</div>
                  <div className="font-medium text-apple-primary mt-0.5 truncate">
                    {selectedOrderForDetail.customerName
                      ? maskCustomerName(selectedOrderForDetail.customerName)
                      : "ลูกค้าทั่วไป"}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60">
                  <div className="text-[10px] text-apple-tertiary">สถานะ</div>
                  <div className="font-medium text-apple-primary mt-0.5">
                    {(() => {
                      const modalEffectiveStatus = getEffectiveOrderStatus(selectedOrderForDetail);
                      return (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            modalEffectiveStatus === "Paid"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : modalEffectiveStatus === "Pending"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {modalEffectiveStatus === "Paid"
                            ? "ชำระแล้ว"
                            : modalEffectiveStatus === "Pending"
                              ? "รอโอน"
                              : "คืนเงิน"}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 space-y-2">
                <div className="text-[11px] font-semibold text-apple-secondary">
                  สรุปการเงิน
                </div>
                <div className="flex justify-between text-apple-secondary">
                  <span>ยอดรวมคำสั่งซื้อ (Gross)</span>
                  <span className="font-mono">
                    {formatCurrency(Number(selectedOrderForDetail.total || 0))}
                  </span>
                </div>
                {Number(selectedOrderForDetail.platformFee || 0) > 0 && (
                  <div className="flex justify-between text-rose-500 text-[11px]">
                    <span>หักค่าธรรมเนียมแพลตฟอร์ม</span>
                    <span className="font-mono">
                      -{formatCurrency(Number(selectedOrderForDetail.platformFee))}
                    </span>
                  </div>
                )}
                {Number(selectedOrderForDetail.shippingFee || 0) > 0 && (
                  <div className="flex justify-between text-rose-500 text-[11px]">
                    <span>หักค่าขนส่ง/บริการ</span>
                    <span className="font-mono">
                      -{formatCurrency(Number(selectedOrderForDetail.shippingFee))}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60 flex justify-between items-center text-sm font-bold">
                  <span className="text-apple-primary">สุทธิโอนเข้าบัญชี</span>
                  {(() => {
                    const isModalOrderRefund = selectedOrderForDetail.status === "Refunded";
                    const rawModalNet = Number(
                      selectedOrderForDetail.netIncome ??
                        Number(selectedOrderForDetail.total || 0) -
                          Number(selectedOrderForDetail.platformFee || 0) -
                          Number(selectedOrderForDetail.shippingFee || 0),
                    );
                    const modalNet = isModalOrderRefund && rawModalNet > 0 ? 0 : rawModalNet;
                    return (
                      <span className={`font-mono font-bold ${
                        modalNet < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : modalNet === 0
                            ? "text-apple-tertiary font-medium"
                            : "text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {formatCurrency(modalNet)}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  const id = selectedOrderForDetail.id;
                  setSelectedOrderForDetail(null);
                  if (id) {
                    setTransactionSearch(id);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium text-apple-secondary hover:text-apple-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              >
                กรองคำสั่งซื้อนี้
              </button>
              <button
                onClick={() => setSelectedOrderForDetail(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-apple-primary text-apple-invert rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      )}

      {/* Celebratory Confetti Effect */}
      {showConfetti && (
        <ConfettiEffect onComplete={() => setShowConfetti(false)} />
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-up max-w-sm">
          <div className="bg-neutral-900/95 dark:bg-neutral-800/95 backdrop-blur-xl text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 text-xs font-medium">
            <span className="flex-1">{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-white/60 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Dynamic print stylesheet */}
      <style>{`
        @media print {
          /* Hide non-printable elements */
          header, nav, aside, footer, button, .marquee-container, .no-print, .bg-apple-secondary p-1 {
            display: none !important;
          }
          
          /* Force light theme for prints */
          body, html, main, .bg-apple-primary {
            background: #ffffff !important;
            color: #111111 !important;
          }
          
          /* Remove cards borders, shadows, backgrounds */
          .glass-card {
            border: 1px solid rgba(0, 0, 0, 0.15) !important;
            box-shadow: none !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
          }

          /* Ensure responsive charts scale correctly */
          .recharts-responsive-container {
            width: 100% !important;
            height: 300px !important;
          }

          /* Optimize grids */
          .grid {
            display: grid !important;
            gap: 1rem !important;
          }

          .grid-cols-4 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .grid-cols-3, .lg\\:grid-cols-3 {
            grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
          }
          
          /* Spacing cleanups */
          main, div {
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .p-8 {
            padding: 1rem !important;
          }
          
          tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
};

export const DashboardTab = React.memo(DashboardTabComponent);
