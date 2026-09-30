import React, { useMemo, useState, useRef } from "react";
import {
  Calculator,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  SearchX,
  FileSpreadsheet,
  Layers,
  BarChart3,
  ArrowRightLeft,
  Eye,
  HelpCircle,
  X,
  RotateCcw,
  Tag,
  SlidersHorizontal,
  TrendingUp,
  ArrowRight,
  Target,
  ShoppingBag,
  DollarSign,
  Trophy,
} from "lucide-react";
import type { Order, Product, UploadedDataset } from "../types";
import { maskCustomerName, resolveBrandName } from "../utils";
import { convertDatasetToOrders } from "../utils/fileParser";

interface CalculatorTabProps {
  isDarkMode: boolean;
  orders: Order[];
  products?: Product[];
  productFiles?: UploadedDataset[];
  uploadedDatasets?: UploadedDataset[];
  formatCurrency: (val: number) => string;
  initialStartDate?: string;
  initialEndDate?: string;
  activeMetricFilter?: string;
  hideSellerMetricCards?: boolean;
}

export interface ProductCalculationItem {
  id?: string;
  name: string;
  brand: string;
  category: string;
  image?: string;
  price: number;
  sales: number;
  grossRevenue: number;
  refundQuantity: number;
  refundAmount: number;
  platformFee: number;
  shippingFee: number;
  netIncome: number;
  hasIncome: boolean;
  stock: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
  channels: string[];
  orderCount: number;
  percentage: number;
}

export interface MonthSummaryData {
  monthKey: string; // "YYYY-MM"
  label: string;
  shortLabel: string;
  year: number;
  month: number;
  gross: number;
  refunded: number;
  net: number;
  actualPlatformFee: number;
  actualShippingFee: number;
  actualNetPayout: number;
  totalOrders: number;
  paidOrdersCount: number;
  refundedOrdersCount: number;
  refundOrdersCount: number;
  cancelledOrdersCount: number;
  cancelledSales: number;
  refundSales: number;
  totalUnitsSold: number;
  aov: number;
  grossAov: number;
  fileCount: number;
  fileNames: string[];
  orders: Order[];
  prevMonthKey?: string;
  grossGrowthPercent: number | null;
  grossDeltaAmount: number;
  netGrowthPercent: number | null;
  netDeltaAmount: number;
  payoutGrowthPercent: number | null;
  payoutDeltaAmount: number;
  ordersGrowthPercent: number | null;
  ordersDeltaCount: number;
  unitsGrowthPercent: number | null;
  unitsDeltaCount: number;
  cancelledGrowthPercent: number | null;
  refundOrdersGrowthPercent: number | null;
  refundSalesGrowthPercent: number | null;
  aovGrowthPercent: number | null;
  aovDeltaAmount?: number;
  feePercent: number;
  shippingPercent: number;
  payoutPercent: number;
}

export interface FileSummaryData {
  id: string;
  fileName: string;
  platform: string;
  fileType: string;
  uploadedAt?: string;
  dateRangeStr: string;
  minDate: string;
  maxDate: string;
  months: string[];
  totalRows: number;
  gross: number;
  refunded: number;
  net: number;
  actualPlatformFee: number;
  actualShippingFee: number;
  actualNetPayout: number;
  totalOrders: number;
  totalUnitsSold: number;
  aov: number;
  payoutPercent: number;
  feePercent: number;
}

export interface ProductMonthTrend {
  name: string;
  brand: string;
  category: string;
  currentSales: number;
  currentRevenue: number;
  compareSales: number;
  compareRevenue: number;
  salesDelta: number;
  revenueDelta: number;
  salesGrowthPercent: number | null;
  revenueGrowthPercent: number | null;
  currentStock: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

const formatMonthLabel = (monthKey: string, short = false): string => {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || "-";
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const mIndex = parseInt(monthStr, 10) - 1;
  const beYear = year > 2400 ? year : year + 543;
  if (mIndex >= 0 && mIndex < 12) {
    const mName = short ? THAI_MONTHS_SHORT[mIndex] : THAI_MONTHS[mIndex];
    return `${mName} ${beYear}`;
  }
  return monthKey;
};

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

// Helper to extract numeric Net order amount / Net Payout
const getOrderNetAmount = (o: Order): number => {
  if (typeof o.netIncome === "number" && o.netIncome !== 0) return o.netIncome;
  const gross = getOrderGrossAmount(o);
  return Math.max(0, gross - (o.platformFee || 0) - (o.shippingFee || 0));
};

const isRefundedOrder = (o: Order): boolean => {
  if (o.status === "Refunded") return true;
  if ((o.total || 0) < 0 || (o.netIncome || 0) < 0) return true;
  return false;
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

// Helper to extract product initials
const getProductInitials = (name: string): string => {
  const clean = (name || "").replace(/[^\w\sก-๙]/g, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase().slice(0, 2);
  }
  return clean.slice(0, 2).toUpperCase() || "PR";
};



const CalculatorTabComponent: React.FC<CalculatorTabProps> = ({
  isDarkMode,
  orders,
  products = [],
  productFiles = [],
  uploadedDatasets = [],
  formatCurrency,
  initialStartDate,
  initialEndDate,
  activeMetricFilter,
  hideSellerMetricCards = false,
}) => {
  // View mode tab state: "overview" | "monthly" | "files" | "products"
  const [viewMode, setViewMode] = useState<"overview" | "monthly" | "files" | "products">("overview");

  // Extract and normalize all order records from orders prop, productFiles and uploadedDatasets
  const allOrders = useMemo<Order[]>(() => {
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
        console.warn("Failed to convert dataset to orders in CalculatorTab:", e);
      }
    };

    // 1. Process uploadedDatasets
    if (uploadedDatasets && uploadedDatasets.length > 0) {
      uploadedDatasets.forEach(processDataset);
    }

    // 2. Process productFiles (which may also contain order sheets or product order files like TikTok order)
    if (productFiles && productFiles.length > 0) {
      productFiles.forEach(processDataset);
    }

    // 3. Add direct orders passed in prop (if not already included from dataset)
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

  // Extract min and max date from all combined orders for initial range
  const { initialMinDate, initialMaxDate } = useMemo(() => {
    const dates: string[] = [];
    allOrders.forEach((o) => {
      if (o.date) dates.push(o.date);
    });
    productFiles.forEach((ds) => {
      const dRange = ds.dateRange;
      if (dRange?.min) dates.push(dRange.min);
      if (dRange?.max) dates.push(dRange.max);
    });
    uploadedDatasets.forEach((ds) => {
      const dRange = ds.dateRange;
      if (dRange?.min) dates.push(dRange.min);
      if (dRange?.max) dates.push(dRange.max);
    });

    if (dates.length === 0) {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const todayStr = `${year}-${month}-${day}`;
      return { initialMinDate: todayStr, initialMaxDate: todayStr };
    }
    const cleanDates = dates
      .map((d) => d.split(" ")[0].split("T")[0])
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (cleanDates.length === 0) {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const todayStr = `${year}-${month}-${day}`;
      return { initialMinDate: todayStr, initialMaxDate: todayStr };
    }
    const minDate = cleanDates.reduce((min, d) => (d < min ? d : min), cleanDates[0]);
    const maxDate = cleanDates.reduce((max, d) => (d > max ? d : max), cleanDates[0]);
    return { initialMinDate: minDate, initialMaxDate: maxDate };
  }, [allOrders, productFiles, uploadedDatasets]);

  const defaultStart = initialStartDate || initialMinDate;
  const defaultEnd = initialEndDate || initialMaxDate;

  const [calcStartDate, setCalcStartDate] = useState<string>(defaultStart);
  const [calcEndDate, setCalcEndDate] = useState<string>(defaultEnd);
  const [prevMinDate, setPrevMinDate] = useState<string>(defaultStart);
  const [prevMaxDate, setPrevMaxDate] = useState<string>(defaultEnd);

  // Automatically adjust calculation date range when initial range changes
  if (prevMinDate !== defaultStart || prevMaxDate !== defaultEnd) {
    setPrevMinDate(defaultStart);
    setPrevMaxDate(defaultEnd);
    setCalcStartDate(defaultStart);
    setCalcEndDate(defaultEnd);
  }

  // Filter & Pagination controls state
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("All");
  
  const initialStatusFromProp = useMemo<"all" | "paid" | "pending" | "refund" | "cancelled">(() => {
    if (activeMetricFilter === "cancelled") return "cancelled";
    if (activeMetricFilter === "refund_orders" || activeMetricFilter === "refund_sales") return "refund";
    return "all";
  }, [activeMetricFilter]);

  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending" | "refund" | "cancelled">(initialStatusFromProp);
  const [brandFilter, setBrandFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "gross_desc" | "gross_asc" | "qty_desc" | "qty_asc" | "net_desc" | "net_asc">("date_desc");
  const [selectedFileFilter, setSelectedFileFilter] = useState<string>("All");
  const [recordTypeFilter, setRecordTypeFilter] = useState<"all" | "income" | "order">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // 1. =========================================================================
  // MONTHLY AGGREGATION & MOM ENGINE (การคำนวณและเปรียบเทียบสถิติรายเดือน)
  // =========================================================================
  const monthlyDataList = useMemo<MonthSummaryData[]>(() => {
    const monthBuckets = new Map<string, Order[]>();

    allOrders.forEach((o) => {
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

    // Sort months chronologically ascending (oldest to newest)
    const sortedKeys = Array.from(monthBuckets.keys()).sort();

    const result: MonthSummaryData[] = [];

    sortedKeys.forEach((mKey, idx) => {
      const mOrders = monthBuckets.get(mKey) || [];
      const [yearStr, monthStr] = mKey.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      // Prioritize income records if available for accurate fee & net payout calculations
      const incomeRecords = mOrders.filter((o) => o.isIncome);
      const orderRecords = mOrders.filter((o) => !o.isIncome);
      let targetOrders: Order[] = [];

      if (incomeRecords.length > 0 && orderRecords.length > 0) {
        const incomeLookup = new Set<string>();
        incomeRecords.forEach((inc) => {
          if (inc.id) {
            incomeLookup.add(inc.id.replace(/-row-.*$/, "").replace(/-lazada$/, "").trim().toLowerCase());
          }
        });
        targetOrders.push(...incomeRecords);
        orderRecords.forEach((ord) => {
          const cleanOrdId = ord.id ? ord.id.replace(/-row-.*$/, "").replace(/-lazada$/, "").trim().toLowerCase() : "";
          if (!cleanOrdId || !incomeLookup.has(cleanOrdId)) {
            targetOrders.push(ord);
          }
        });
      } else {
        targetOrders = [...mOrders];
      }

      const gross = targetOrders.reduce((s, o) => s + getOrderGrossAmount(o), 0);
      const refunded = targetOrders.reduce((s, o) => (isRefundedOrder(o) ? s + getOrderGrossAmount(o) : s), 0);
      const net = Math.max(0, gross - refunded);
      const nonRefunded = targetOrders.filter((o) => !isRefundedOrder(o));
      const paidOrders = targetOrders.filter((o) => !isRefundedOrder(o) && o.status === "Paid");
      const refundedOrders = targetOrders.filter((o) => isRefundedOrder(o));

      const actualPlatformFee = targetOrders.reduce((s, o) => s + (o.platformFee || 0), 0);
      const actualShippingFee = targetOrders.reduce((s, o) => s + (o.shippingFee || 0), 0);
      const actualNetPayout = nonRefunded.reduce((s, o) => s + getOrderNetAmount(o), 0);

      // Actual cancelled orders from file
      const cancelledOrders = targetOrders.filter(isCancelledOrder);
      const cancelledSales = Math.round(cancelledOrders.reduce((s, o) => s + getOrderGrossAmount(o), 0) * 100) / 100;
      const cancelledOrdersCount = cancelledOrders.length;

      // Actual refund/return orders from file
      const refundOrders = targetOrders.filter(isRefundOrder);
      const refundOrdersCount = refundOrders.length;
      const refundSales = Math.round(refundOrders.reduce((s, o) => s + getOrderGrossAmount(o), 0) * 100) / 100;

      const totalUnitsSold = nonRefunded.reduce((s, o) => s + (o.quantity || 1), 0);
      const totalOrders = targetOrders.length;
      const aov = totalOrders > 0 ? Math.round((gross / totalOrders) * 100) / 100 : 0;
      const grossAov = totalOrders > 0 ? Math.round((gross / totalOrders) * 100) / 100 : 0;

      // Unique file names contributing to this month
      const fileNamesSet = new Set<string>();
      targetOrders.forEach((o) => {
        if (o.fileName) fileNamesSet.add(o.fileName);
        else if (o.datasetName) fileNamesSet.add(o.datasetName);
      });
      const fileNames = Array.from(fileNamesSet);

      // Previous month calculation for MoM growth %
      const prevMonth = idx > 0 ? result[idx - 1] : undefined;

      const calcGrowth = (currVal: number, prevVal?: number): number | null => {
        if (prevVal === undefined || prevVal === null) return null;
        if (prevVal === 0) {
          if (currVal > 0) return 100;
          if (currVal === 0) return 0;
          return 0;
        }
        return Math.round(((currVal - prevVal) / prevVal) * 10000) / 100;
      };

      const grossGrowthPercent = prevMonth ? calcGrowth(gross, prevMonth.gross) : null;
      const grossDeltaAmount = prevMonth ? Math.round((gross - prevMonth.gross) * 100) / 100 : 0;

      const netGrowthPercent = prevMonth ? calcGrowth(net, prevMonth.net) : null;
      const netDeltaAmount = prevMonth ? Math.round((net - prevMonth.net) * 100) / 100 : 0;

      const payoutGrowthPercent = prevMonth ? calcGrowth(actualNetPayout, prevMonth.actualNetPayout) : null;
      const payoutDeltaAmount = prevMonth ? Math.round((actualNetPayout - prevMonth.actualNetPayout) * 100) / 100 : 0;

      const ordersGrowthPercent = prevMonth ? calcGrowth(totalOrders, prevMonth.totalOrders) : null;
      const ordersDeltaCount = prevMonth ? totalOrders - prevMonth.totalOrders : 0;

      const unitsGrowthPercent = prevMonth ? calcGrowth(totalUnitsSold, prevMonth.totalUnitsSold) : null;
      const unitsDeltaCount = prevMonth ? totalUnitsSold - prevMonth.totalUnitsSold : 0;

      const cancelledGrowthPercent = prevMonth ? calcGrowth(cancelledSales, prevMonth.cancelledSales) : null;
      const refundOrdersGrowthPercent = prevMonth ? calcGrowth(refundOrdersCount, prevMonth.refundOrdersCount) : null;
      const refundSalesGrowthPercent = prevMonth ? calcGrowth(refundSales, prevMonth.refundSales) : null;
      const aovGrowthPercent = prevMonth ? calcGrowth(aov, prevMonth.aov) : null;
      const aovDeltaAmount = prevMonth ? Math.round((aov - prevMonth.aov) * 100) / 100 : 0;

      const feePercent = gross > 0 ? Math.round((actualPlatformFee / gross) * 1000) / 10 : 0;
      const shippingPercent = gross > 0 ? Math.round((actualShippingFee / gross) * 1000) / 10 : 0;
      const payoutPercent = gross > 0 ? Math.round((actualNetPayout / gross) * 1000) / 10 : 0;

      result.push({
        monthKey: mKey,
        label: formatMonthLabel(mKey, false),
        shortLabel: formatMonthLabel(mKey, true),
        year,
        month,
        gross: Math.round(gross * 100) / 100,
        refunded: Math.round(refunded * 100) / 100,
        net: Math.round(net * 100) / 100,
        actualPlatformFee: Math.round(actualPlatformFee * 100) / 100,
        actualShippingFee: Math.round(actualShippingFee * 100) / 100,
        actualNetPayout: Math.round(actualNetPayout * 100) / 100,
        totalOrders,
        paidOrdersCount: paidOrders.length,
        refundedOrdersCount: refundedOrders.length,
        refundOrdersCount,
        cancelledOrdersCount,
        cancelledSales,
        refundSales,
        totalUnitsSold,
        aov,
        grossAov,
        fileCount: fileNames.length,
        fileNames,
        orders: targetOrders,
        prevMonthKey: prevMonth?.monthKey,
        grossGrowthPercent,
        grossDeltaAmount,
        netGrowthPercent,
        netDeltaAmount,
        payoutGrowthPercent,
        payoutDeltaAmount,
        ordersGrowthPercent,
        ordersDeltaCount,
        unitsGrowthPercent,
        unitsDeltaCount,
        cancelledGrowthPercent,
        refundOrdersGrowthPercent,
        refundSalesGrowthPercent,
        aovGrowthPercent,
        aovDeltaAmount,
        feePercent,
        shippingPercent,
        payoutPercent,
      });
    });

    return result;
  }, [allOrders]);

  // Summary across all periods (ทุกช่วงเวลา - รวมทุกเดือนในระบบ)
  const allTimeSummaryData = useMemo<MonthSummaryData>(() => {
    const targetOrders = allOrders;
    const gross = targetOrders.reduce((s, o) => s + getOrderGrossAmount(o), 0);
    const refunded = targetOrders.reduce((s, o) => (isRefundedOrder(o) ? s + getOrderGrossAmount(o) : s), 0);
    const net = Math.max(0, gross - refunded);
    const nonRefunded = targetOrders.filter((o) => !isRefundedOrder(o));
    const paidOrders = targetOrders.filter((o) => !isRefundedOrder(o) && o.status === "Paid");
    const refundedOrders = targetOrders.filter((o) => isRefundedOrder(o));

    const actualPlatformFee = targetOrders.reduce((s, o) => s + (o.platformFee || 0), 0);
    const actualShippingFee = targetOrders.reduce((s, o) => s + (o.shippingFee || 0), 0);
    const actualNetPayout = nonRefunded.reduce((s, o) => s + getOrderNetAmount(o), 0);

    const cancelledOrders = targetOrders.filter(isCancelledOrder);
    const cancelledSales = Math.round(cancelledOrders.reduce((s, o) => s + getOrderGrossAmount(o), 0) * 100) / 100;
    const cancelledOrdersCount = cancelledOrders.length;

    const refundOrders = targetOrders.filter(isRefundOrder);
    const refundOrdersCount = refundOrders.length;
    const refundSales = Math.round(refundOrders.reduce((s, o) => s + getOrderGrossAmount(o), 0) * 100) / 100;

    const totalUnitsSold = nonRefunded.reduce((s, o) => s + (o.quantity || 1), 0);
    const totalOrders = targetOrders.length;
    const aov = totalOrders > 0 ? Math.round((gross / totalOrders) * 100) / 100 : 0;
    const grossAov = totalOrders > 0 ? Math.round((gross / totalOrders) * 100) / 100 : 0;

    const fileNamesSet = new Set<string>();
    targetOrders.forEach((o) => {
      if (o.fileName) fileNamesSet.add(o.fileName);
      else if (o.datasetName) fileNamesSet.add(o.datasetName);
    });

    return {
      monthKey: "all",
      label: "ทุกช่วงเวลา (ข้อมูลรวมทั้งหมด)",
      shortLabel: "ทุกช่วงเวลา",
      year: 0,
      month: 0,
      gross: Math.round(gross * 100) / 100,
      refunded: Math.round(refunded * 100) / 100,
      net: Math.round(net * 100) / 100,
      actualPlatformFee: Math.round(actualPlatformFee * 100) / 100,
      actualShippingFee: Math.round(actualShippingFee * 100) / 100,
      actualNetPayout: Math.round(actualNetPayout * 100) / 100,
      totalOrders,
      paidOrdersCount: paidOrders.length,
      refundedOrdersCount: refundedOrders.length,
      refundOrdersCount,
      cancelledOrdersCount,
      cancelledSales,
      refundSales,
      totalUnitsSold,
      aov,
      grossAov,
      fileCount: fileNamesSet.size,
      fileNames: Array.from(fileNamesSet),
      orders: targetOrders,
      grossGrowthPercent: null,
      grossDeltaAmount: 0,
      netGrowthPercent: null,
      netDeltaAmount: 0,
      payoutGrowthPercent: null,
      payoutDeltaAmount: 0,
      ordersGrowthPercent: null,
      ordersDeltaCount: 0,
      unitsGrowthPercent: null,
      unitsDeltaCount: 0,
      cancelledGrowthPercent: null,
      refundOrdersGrowthPercent: null,
      refundSalesGrowthPercent: null,
      aovGrowthPercent: null,
      feePercent: gross > 0 ? Math.round((actualPlatformFee / gross) * 1000) / 10 : 0,
      shippingPercent: gross > 0 ? Math.round((actualShippingFee / gross) * 1000) / 10 : 0,
      payoutPercent: gross > 0 ? Math.round((actualNetPayout / gross) * 1000) / 10 : 0,
    };
  }, [allOrders]);

  // Default selected months for comparison mode
  const latestMonthKey = monthlyDataList.length > 0 ? monthlyDataList[monthlyDataList.length - 1].monthKey : "";
  const prevMonthKey = monthlyDataList.length > 1 ? monthlyDataList[monthlyDataList.length - 2].monthKey : "";

  const [primaryMonthKey, setPrimaryMonthKey] = useState<string>("");
  const [compareMonthKey, setCompareMonthKey] = useState<string>("");

  const isInitialAllTime = defaultStart.slice(0, 7) !== defaultEnd.slice(0, 7) || (defaultStart === initialMinDate && defaultEnd === initialMaxDate);
  const defaultPrimaryMonth = isInitialAllTime ? "all" : (latestMonthKey || "all");
  const activePrimaryMonth = primaryMonthKey || defaultPrimaryMonth;
  const activeCompareMonth = compareMonthKey || (
    activePrimaryMonth !== "all" && monthlyDataList.length > 1
      ? (monthlyDataList.find((_, i) => i > 0 && monthlyDataList[i].monthKey === activePrimaryMonth)
          ? monthlyDataList[monthlyDataList.findIndex((m) => m.monthKey === activePrimaryMonth) - 1].monthKey
          : prevMonthKey)
      : ""
  );

  const primaryMonthData = useMemo(() => {
    if (activePrimaryMonth === "all") return allTimeSummaryData;
    return monthlyDataList.find((m) => m.monthKey === activePrimaryMonth) || allTimeSummaryData || monthlyDataList[monthlyDataList.length - 1];
  }, [monthlyDataList, activePrimaryMonth, allTimeSummaryData]);

  const compareMonthData = useMemo(() => {
    if (!activeCompareMonth) return undefined;
    if (activeCompareMonth === "all") return allTimeSummaryData;
    return monthlyDataList.find((m) => m.monthKey === activeCompareMonth);
  }, [monthlyDataList, activeCompareMonth, allTimeSummaryData]);

  // 2. =========================================================================
  // FILE / DATASET BREAKDOWN AGGREGATION (การรวมข้อมูลแยกตามไฟล์ที่อัปโหลด)
  // =========================================================================
  const fileSummaryList = useMemo<FileSummaryData[]>(() => {
    const allDatasets = [...(uploadedDatasets || []), ...(productFiles || [])];
    const uniqueDatasetsMap = new Map<string, UploadedDataset>();
    allDatasets.forEach((ds) => {
      if (ds && ds.id && !uniqueDatasetsMap.has(ds.id)) {
        uniqueDatasetsMap.set(ds.id, ds);
      }
    });

    const datasetOrdersMap = new Map<string, Order[]>();
    allOrders.forEach((o) => {
      if (!o.datasetId) return;
      if (!datasetOrdersMap.has(o.datasetId)) {
        datasetOrdersMap.set(o.datasetId, []);
      }
      datasetOrdersMap.get(o.datasetId)!.push(o);
    });

    const summaries: FileSummaryData[] = [];

    uniqueDatasetsMap.forEach((ds, dsId) => {
      const dsOrders = datasetOrdersMap.get(dsId) || [];
      const dates = dsOrders.map((o) => o.date).filter(Boolean);
      const minD = dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : ds.dateRange?.min || "-";
      const maxD = dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : ds.dateRange?.max || "-";

      const monthsSet = new Set<string>();
      dates.forEach((d) => {
        const m = d.split(" ")[0].split("T")[0].slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(m)) monthsSet.add(m);
      });

      const gross = dsOrders.reduce((s, o) => s + getOrderGrossAmount(o), 0);
      const refunded = dsOrders.reduce((s, o) => (isRefundedOrder(o) ? s + getOrderGrossAmount(o) : s), 0);
      const net = Math.max(0, gross - refunded);
      const actualPlatformFee = dsOrders.reduce((s, o) => s + (o.platformFee || 0), 0);
      const actualShippingFee = dsOrders.reduce((s, o) => s + (o.shippingFee || 0), 0);
      const nonRefunded = dsOrders.filter((o) => !isRefundedOrder(o));
      const actualNetPayout = nonRefunded.reduce((s, o) => s + getOrderNetAmount(o), 0);
      const totalUnitsSold = nonRefunded.reduce((s, o) => s + (o.quantity || 1), 0);
      const totalOrders = dsOrders.length;
      const aov = nonRefunded.length > 0 ? Math.round((net / nonRefunded.length) * 100) / 100 : 0;

      let totalRows = 0;
      ds.sheets?.forEach((sh) => {
        totalRows += sh.rows?.length || 0;
      });

      const dateRangeStr = minD !== "-" && maxD !== "-" ? `${minD} ถึง ${maxD}` : "ไม่ระบุช่วงวันที่";

      summaries.push({
        id: ds.id,
        fileName: ds.fileName || `ไฟล์นำเข้า-${ds.id}`,
        platform: ds.platform ? ds.platform.toUpperCase() : "SHOPEE",
        fileType: ds.fileType || ds.type || "orders",
        uploadedAt: ds.uploadedAt,
        dateRangeStr,
        minDate: minD,
        maxDate: maxD,
        months: Array.from(monthsSet),
        totalRows: totalRows || totalOrders,
        gross: Math.round(gross * 100) / 100,
        refunded: Math.round(refunded * 100) / 100,
        net: Math.round(net * 100) / 100,
        actualPlatformFee: Math.round(actualPlatformFee * 100) / 100,
        actualShippingFee: Math.round(actualShippingFee * 100) / 100,
        actualNetPayout: Math.round(actualNetPayout * 100) / 100,
        totalOrders,
        totalUnitsSold,
        aov,
        payoutPercent: gross > 0 ? Math.round((actualNetPayout / gross) * 1000) / 10 : 0,
        feePercent: gross > 0 ? Math.round((actualPlatformFee / gross) * 1000) / 10 : 0,
      });
    });

    return summaries.sort((a, b) => b.gross - a.gross);
  }, [uploadedDatasets, productFiles, allOrders]);

  // 3. =========================================================================
  // PRODUCT MONTH-OVER-MONTH PERFORMANCE COMPARISON (การเปรียบเทียบผลงานสินค้า MoM)
  // =========================================================================
  const productMonthTrends = useMemo<ProductMonthTrend[]>(() => {
    if (!primaryMonthData) return [];

    const primaryOrders = primaryMonthData.orders || [];
    const compareOrders = compareMonthData?.orders || [];

    const productMap = new Map<string, {
      name: string;
      brand: string;
      category: string;
      currentSales: number;
      currentRevenue: number;
      compareSales: number;
      compareRevenue: number;
    }>();

    primaryOrders.forEach((o) => {
      const rawName = (o.productName || o.itemName || "").trim() || "สินค้าทั่วไป";
      const key = rawName.toLowerCase();
      const gross = getOrderGrossAmount(o);
      const isRefund = isRefundedOrder(o);
      const qty = o.quantity || 1;

      if (!productMap.has(key)) {
        productMap.set(key, {
          name: rawName,
          brand: resolveBrandName(o.brand, rawName, o, products),
          category: o.category || "Electronics",
          currentSales: 0,
          currentRevenue: 0,
          compareSales: 0,
          compareRevenue: 0,
        });
      }

      const item = productMap.get(key)!;
      if (!isRefund) {
        item.currentSales += qty;
        item.currentRevenue += gross;
      }
    });

    compareOrders.forEach((o) => {
      const rawName = (o.productName || o.itemName || "").trim() || "สินค้าทั่วไป";
      const key = rawName.toLowerCase();
      const gross = getOrderGrossAmount(o);
      const isRefund = isRefundedOrder(o);
      const qty = o.quantity || 1;

      if (!productMap.has(key)) {
        productMap.set(key, {
          name: rawName,
          brand: resolveBrandName(o.brand, rawName, o, products),
          category: o.category || "Electronics",
          currentSales: 0,
          currentRevenue: 0,
          compareSales: 0,
          compareRevenue: 0,
        });
      }

      const item = productMap.get(key)!;
      if (!isRefund) {
        item.compareSales += qty;
        item.compareRevenue += gross;
      }
    });

    const result: ProductMonthTrend[] = [];

    productMap.forEach((val) => {
      const matchCatalog = products.find((p) => p.name.toLowerCase() === val.name.toLowerCase());
      const stock = matchCatalog?.stock ?? 10;
      let stockStatus: "In Stock" | "Low Stock" | "Out of Stock" = matchCatalog?.status || "In Stock";
      if (stock <= 0) stockStatus = "Out of Stock";
      else if (stock <= 15) stockStatus = "Low Stock";

      const salesDelta = val.currentSales - val.compareSales;
      const revenueDelta = Math.round((val.currentRevenue - val.compareRevenue) * 100) / 100;

      const salesGrowthPercent = val.compareSales > 0
        ? Math.round(((val.currentSales - val.compareSales) / val.compareSales) * 1000) / 10
        : (val.currentSales > 0 ? 100 : 0);

      const revenueGrowthPercent = val.compareRevenue > 0
        ? Math.round(((val.currentRevenue - val.compareRevenue) / val.compareRevenue) * 1000) / 10
        : (val.currentRevenue > 0 ? 100 : 0);

      result.push({
        name: val.name,
        brand: val.brand,
        category: val.category,
        currentSales: val.currentSales,
        currentRevenue: Math.round(val.currentRevenue * 100) / 100,
        compareSales: val.compareSales,
        compareRevenue: Math.round(val.compareRevenue * 100) / 100,
        salesDelta,
        revenueDelta,
        salesGrowthPercent,
        revenueGrowthPercent,
        currentStock: stock,
        status: stockStatus,
      });
    });

    return result.sort((a, b) => b.currentRevenue - a.currentRevenue);
  }, [primaryMonthData, compareMonthData, products]);

  // 4. =========================================================================
  // OVERVIEW RANGE METRICS (คำนวณตามช่วงวันที่เลือก)
  // =========================================================================
  const metrics = useMemo(() => {
    const rangeOrders = allOrders.filter((o) => {
      if (!o.date) return false;
      const dStr = o.date.split(" ")[0].split("T")[0];
      const matchDate = dStr >= calcStartDate && dStr <= calcEndDate;
      if (!matchDate) return false;
      if (selectedFileFilter !== "All" && o.datasetId !== selectedFileFilter && o.fileName !== selectedFileFilter) {
        return false;
      }
      if (recordTypeFilter === "income") return Boolean(o.isIncome);
      if (recordTypeFilter === "order") return !o.isIncome;
      return true;
    });

    const targetOrderRecords: Order[] = [];

    if (recordTypeFilter === "income") {
      targetOrderRecords.push(...rangeOrders.filter((o) => o.isIncome));
    } else if (recordTypeFilter === "order") {
      targetOrderRecords.push(...rangeOrders.filter((o) => !o.isIncome));
    } else {
      const incomeRecords = rangeOrders.filter((o) => o.isIncome);
      const orderRecords = rangeOrders.filter((o) => !o.isIncome);

      if (incomeRecords.length > 0 && orderRecords.length > 0) {
        const incomeLookup = new Set<string>();
        incomeRecords.forEach((inc) => {
          if (inc.id) {
            incomeLookup.add(inc.id.replace(/-row-.*$/, "").replace(/-lazada$/, "").trim().toLowerCase());
          }
        });

        targetOrderRecords.push(...incomeRecords);
        orderRecords.forEach((ord) => {
          const cleanOrdId = ord.id ? ord.id.replace(/-row-.*$/, "").replace(/-lazada$/, "").trim().toLowerCase() : "";
          if (!cleanOrdId || !incomeLookup.has(cleanOrdId)) {
            targetOrderRecords.push(ord);
          }
        });
      } else {
        targetOrderRecords.push(...rangeOrders);
      }
    }

    targetOrderRecords.sort((a, b) => {
      if (b.date !== a.date) return b.date > a.date ? 1 : -1;
      const aIsRefund = isRefundedOrder(a) ? 1 : 0;
      const bIsRefund = isRefundedOrder(b) ? 1 : 0;
      if (aIsRefund !== bIsRefund) return aIsRefund - bIsRefund;
      return 0;
    });

    if (targetOrderRecords.length > 0) {
      const gross = targetOrderRecords.reduce((s, o) => s + getOrderGrossAmount(o), 0);
      const refunded = targetOrderRecords.reduce(
        (s, o) => (isRefundedOrder(o) ? s + getOrderGrossAmount(o) : s),
        0,
      );
      const net = Math.max(0, gross - refunded);
      const paid = targetOrderRecords.filter((o) => !isRefundedOrder(o) && o.status === "Paid");
      const nonRefunded = targetOrderRecords.filter((o) => !isRefundedOrder(o));

      const actualPlatformFee = targetOrderRecords.reduce((s, o) => s + (o.platformFee || 0), 0);
      const actualShippingFee = targetOrderRecords.reduce((s, o) => s + (o.shippingFee || 0), 0);
      const actualNetPayout = nonRefunded.reduce((s, o) => s + getOrderNetAmount(o), 0);

      // Actual cancelled orders from file
      const cancelledOrders = targetOrderRecords.filter(isCancelledOrder);
      const cancelledSales = Math.round(cancelledOrders.reduce((s, o) => s + getOrderGrossAmount(o), 0) * 100) / 100;
      const cancelledOrdersCount = cancelledOrders.length;

      // Actual refund/return orders from file
      const refundOrders = targetOrderRecords.filter(isRefundOrder);
      const refundOrdersCount = refundOrders.length;
      const refundSales = Math.round(refundOrders.reduce((s, o) => s + getOrderGrossAmount(o), 0) * 100) / 100;

      const grossAov = targetOrderRecords.length > 0 ? Math.round((gross / targetOrderRecords.length) * 100) / 100 : 0;
      const netAov = targetOrderRecords.length > 0 ? Math.round((gross / targetOrderRecords.length) * 100) / 100 : 0;
      const totalUnitsSold = nonRefunded.reduce((s, o) => s + (o.quantity || 1), 0);

      return {
        gross: Math.round(gross * 100) / 100,
        refunded: Math.round(refunded * 100) / 100,
        net: Math.round(net * 100) / 100,
        aov: netAov,
        grossAov,
        cancelledSales,
        cancelledOrdersCount,
        refundSales,
        refundOrdersCount,
        total: targetOrderRecords.length,
        totalUnitsSold,
        paidCount: paid.length,
        pendingCount: targetOrderRecords.filter((o) => !isRefundedOrder(o) && o.status === "Pending").length,
        refundedCount: targetOrderRecords.filter((o) => isRefundedOrder(o)).length,
        list: targetOrderRecords,
        actualPlatformFee: Math.round(actualPlatformFee * 100) / 100,
        actualShippingFee: Math.round(actualShippingFee * 100) / 100,
        actualNetPayout: Math.round(actualNetPayout * 100) / 100,
      };
    }

    return {
      gross: 0,
      refunded: 0,
      net: 0,
      aov: 0,
      grossAov: 0,
      cancelledSales: 0,
      cancelledOrdersCount: 0,
      refundSales: 0,
      refundOrdersCount: 0,
      total: 0,
      totalUnitsSold: 0,
      paidCount: 0,
      pendingCount: 0,
      refundedCount: 0,
      list: [],
      actualPlatformFee: 0,
      actualShippingFee: 0,
      actualNetPayout: 0,
    };
  }, [allOrders, calcStartDate, calcEndDate, recordTypeFilter, selectedFileFilter]);

  // Metric selection state for "แนวโน้มของตัวชี้วัดที่เลือก"
  type MetricKey = "cancelledSales" | "refundOrdersCount" | "refundSales" | "aov";
  const [selectedMetricKey, setSelectedMetricKey] = useState<MetricKey>("cancelledSales");
  const cardScrollContainerRef = useRef<HTMLDivElement>(null);

  // Comparison metrics for the selected date range against the previous equivalent period or previous month
  const rangeComparison = useMemo(() => {
    const startM = calcStartDate.slice(0, 7);
    const endM = calcEndDate.slice(0, 7);
    const isSingleMonth = startM === endM && /^\d{4}-\d{2}$/.test(startM);

    const calcDeltaPct = (curr: number, prev: number): number | null => {
      if (prev === 0) {
        if (curr > 0) return 100;
        if (curr === 0) return null;
        return 0;
      }
      return Math.round(((curr - prev) / prev) * 10000) / 100;
    };

    if (isSingleMonth) {
      const foundIdx = monthlyDataList.findIndex((m) => m.monthKey === startM);
      if (foundIdx > 0) {
        const prevM = monthlyDataList[foundIdx - 1];

        return {
          prevMonthLabel: prevM.shortLabel,
          grossGrowthPercent: calcDeltaPct(metrics.gross, prevM.gross),
          grossDelta: Math.round((metrics.gross - prevM.gross) * 100) / 100,
          payoutGrowthPercent: calcDeltaPct(metrics.actualNetPayout, prevM.actualNetPayout),
          payoutDelta: Math.round((metrics.actualNetPayout - prevM.actualNetPayout) * 100) / 100,
          ordersGrowthPercent: calcDeltaPct(metrics.total, prevM.totalOrders),
          ordersDelta: metrics.total - prevM.totalOrders,
          unitsGrowthPercent: calcDeltaPct(metrics.totalUnitsSold, prevM.totalUnitsSold),
          unitsDelta: metrics.totalUnitsSold - prevM.totalUnitsSold,
          cancelledGrowthPercent: calcDeltaPct(metrics.cancelledSales, prevM.cancelledSales),
          refundOrdersGrowthPercent: calcDeltaPct(metrics.refundOrdersCount, prevM.refundOrdersCount),
          refundSalesGrowthPercent: calcDeltaPct(metrics.refundSales, prevM.refundSales),
          aovGrowthPercent: calcDeltaPct(metrics.aov, prevM.aov),
          prevCancelledSales: prevM.cancelledSales,
          prevRefundOrdersCount: prevM.refundOrdersCount,
          prevRefundSales: prevM.refundSales,
          prevAov: prevM.aov,
        };
      } else if (foundIdx === 0) {
        return {
          prevMonthLabel: "เดือนฐานแรก",
          grossGrowthPercent: null,
          grossDelta: 0,
          payoutGrowthPercent: null,
          payoutDelta: 0,
          ordersGrowthPercent: null,
          ordersDelta: 0,
          unitsGrowthPercent: null,
          unitsDelta: 0,
          cancelledGrowthPercent: null,
          refundOrdersGrowthPercent: null,
          refundSalesGrowthPercent: null,
          aovGrowthPercent: null,
          prevCancelledSales: 0,
          prevRefundOrdersCount: 0,
          prevRefundSales: 0,
          prevAov: 0,
        };
      }
    }

    // Default or range comparison calculation
    if (monthlyDataList.length > 1) {
      const latest = monthlyDataList[monthlyDataList.length - 1];
      const prev = monthlyDataList[monthlyDataList.length - 2];
      return {
        prevMonthLabel: `เดือนล่าสุด vs ${prev.shortLabel}`,
        grossGrowthPercent: latest.grossGrowthPercent,
        grossDelta: latest.grossDeltaAmount,
        payoutGrowthPercent: latest.payoutGrowthPercent,
        payoutDelta: latest.payoutDeltaAmount,
        ordersGrowthPercent: latest.ordersGrowthPercent,
        ordersDelta: latest.ordersDeltaCount,
        unitsGrowthPercent: latest.unitsGrowthPercent,
        unitsDelta: latest.unitsDeltaCount,
        cancelledGrowthPercent: latest.cancelledGrowthPercent,
        refundOrdersGrowthPercent: latest.refundOrdersGrowthPercent,
        refundSalesGrowthPercent: latest.refundSalesGrowthPercent,
        aovGrowthPercent: latest.aovGrowthPercent,
        prevCancelledSales: prev.cancelledSales,
        prevRefundOrdersCount: prev.refundOrdersCount,
        prevRefundSales: prev.refundSales,
        prevAov: prev.aov,
      };
    }

    return {
      prevMonthLabel: "เดือนก่อนหน้า",
      grossGrowthPercent: null,
      grossDelta: 0,
      payoutGrowthPercent: null,
      payoutDelta: 0,
      ordersGrowthPercent: null,
      ordersDelta: 0,
      unitsGrowthPercent: null,
      unitsDelta: 0,
      cancelledGrowthPercent: null,
      refundOrdersGrowthPercent: null,
      refundSalesGrowthPercent: null,
      aovGrowthPercent: null,
      prevCancelledSales: 0,
      prevRefundOrdersCount: 0,
      prevRefundSales: 0,
      prevAov: 0,
    };
  }, [calcStartDate, calcEndDate, monthlyDataList, metrics]);

  // List of unique channels available
  const availableChannels = useMemo(() => {
    const standardChannels = ["TikTok Shop", "Lazada", "Shopee", "Facebook", "LINE OA"];
    const channels = new Set<string>(standardChannels);
    metrics.list.forEach((o) => {
      if (o.channel) channels.add(o.channel);
    });
    return ["All", ...Array.from(channels)];
  }, [metrics.list]);

  // List of unique brands available
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    metrics.list.forEach((o) => {
      const b = resolveBrandName(o.brand, o.productName, o, products);
      if (b && b !== "ไม่ระบุแบรนด์" && b !== "General" && b.trim()) {
        brands.add(b.trim());
      }
    });
    return ["All", ...Array.from(brands).sort()];
  }, [metrics.list, products]);

  // List of unique categories available
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    metrics.list.forEach((o) => {
      if (o.category && o.category.trim() && o.category.trim() !== "-") {
        cats.add(o.category.trim());
      }
    });
    return ["All", ...Array.from(cats).sort()];
  }, [metrics.list]);

  // Counts for each status tab
  const statusCounts = useMemo(() => {
    let all = 0;
    let paid = 0;
    let pending = 0;
    let refund = 0;
    let cancelled = 0;

    metrics.list.forEach((o) => {
      all++;
      const isCanc = isCancelledOrder(o);
      const isRef = isRefundedOrder(o) || isRefundOrder(o);

      if (isCanc) {
        cancelled++;
      } else if (isRef) {
        refund++;
      } else if (o.status === "Paid") {
        paid++;
      } else if (o.status === "Pending") {
        pending++;
      }
    });

    return { all, paid, pending, refund, cancelled };
  }, [metrics.list]);

  // Filter and sort orders list based on search, channel, status, brand, category, and sortBy
  const filteredOrdersList = useMemo(() => {
    const list = metrics.list.filter((o) => {
      const q = searchQuery.trim().toLowerCase();
      const resolvedBrand = resolveBrandName(o.brand, o.productName, o, products);
      const matchSearch =
        !q ||
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.productName && o.productName.toLowerCase().includes(q)) ||
        (resolvedBrand && resolvedBrand.toLowerCase().includes(q)) ||
        (o.category && o.category.toLowerCase().includes(q));

      const matchChannel =
        channelFilter === "All" ||
        !channelFilter ||
        o.channel === channelFilter;

      const isCanc = isCancelledOrder(o);
      const isRef = isRefundedOrder(o) || isRefundOrder(o);

      let matchStatus = true;
      if (statusFilter === "paid") {
        matchStatus = !isCanc && !isRef && o.status === "Paid";
      } else if (statusFilter === "pending") {
        matchStatus = !isCanc && !isRef && o.status === "Pending";
      } else if (statusFilter === "refund") {
        matchStatus = isRef;
      } else if (statusFilter === "cancelled") {
        matchStatus = isCanc;
      }

      const matchBrand =
        brandFilter === "All" ||
        !brandFilter ||
        resolvedBrand === brandFilter;

      const matchCategory =
        categoryFilter === "All" ||
        !categoryFilter ||
        o.category === categoryFilter;

      return matchSearch && matchChannel && matchStatus && matchBrand && matchCategory;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "date_desc") {
        return (b.date || "").localeCompare(a.date || "");
      }
      if (sortBy === "date_asc") {
        return (a.date || "").localeCompare(b.date || "");
      }
      if (sortBy === "gross_desc") {
        return getOrderGrossAmount(b) - getOrderGrossAmount(a);
      }
      if (sortBy === "gross_asc") {
        return getOrderGrossAmount(a) - getOrderGrossAmount(b);
      }
      if (sortBy === "qty_desc") {
        return (b.quantity || 1) - (a.quantity || 1);
      }
      if (sortBy === "qty_asc") {
        return (a.quantity || 1) - (b.quantity || 1);
      }
      if (sortBy === "net_desc") {
        return getOrderNetAmount(b) - getOrderNetAmount(a);
      }
      if (sortBy === "net_asc") {
        return getOrderNetAmount(a) - getOrderNetAmount(b);
      }
      return 0;
    });
  }, [metrics.list, searchQuery, channelFilter, statusFilter, brandFilter, categoryFilter, sortBy, products]);



  // Check if any filter is active
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    channelFilter !== "All" ||
    statusFilter !== "all" ||
    brandFilter !== "All" ||
    categoryFilter !== "All" ||
    recordTypeFilter !== "all" ||
    selectedFileFilter !== "All" ||
    sortBy !== "date_desc"
  );

  const resetAllFilters = () => {
    setSearchQuery("");
    setChannelFilter("All");
    setStatusFilter("all");
    setBrandFilter("All");
    setCategoryFilter("All");
    setRecordTypeFilter("all");
    setSelectedFileFilter("All");
    setSortBy("date_desc");
    setCurrentPage(1);
  };

  const [prevFilterParams, setPrevFilterParams] = useState({
    searchQuery,
    channelFilter,
    statusFilter,
    brandFilter,
    categoryFilter,
    sortBy,
    selectedFileFilter,
    recordTypeFilter,
    calcStartDate,
    calcEndDate,
    itemsPerPage,
  });

  if (
    prevFilterParams.searchQuery !== searchQuery ||
    prevFilterParams.channelFilter !== channelFilter ||
    prevFilterParams.statusFilter !== statusFilter ||
    prevFilterParams.brandFilter !== brandFilter ||
    prevFilterParams.categoryFilter !== categoryFilter ||
    prevFilterParams.sortBy !== sortBy ||
    prevFilterParams.selectedFileFilter !== selectedFileFilter ||
    prevFilterParams.recordTypeFilter !== recordTypeFilter ||
    prevFilterParams.calcStartDate !== calcStartDate ||
    prevFilterParams.calcEndDate !== calcEndDate ||
    prevFilterParams.itemsPerPage !== itemsPerPage
  ) {
    setPrevFilterParams({
      searchQuery,
      channelFilter,
      statusFilter,
      brandFilter,
      categoryFilter,
      sortBy,
      selectedFileFilter,
      recordTypeFilter,
      calcStartDate,
      calcEndDate,
      itemsPerPage,
    });
    setCurrentPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filteredOrdersList.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredOrdersList.length);
  const paginatedList = filteredOrdersList.slice(startIndex, endIndex);

  const getChannelBadgeClass = (channel: string) => {
    const low = (channel || "").toLowerCase();
    if (low.includes("tiktok")) {
      return isDarkMode
        ? "bg-zinc-800 text-white border-zinc-700"
        : "bg-zinc-900 text-white border-zinc-800";
    }
    if (low.includes("shopee")) {
      return isDarkMode
        ? "bg-orange-950/40 text-orange-400 border-orange-800/60"
        : "bg-orange-50 text-orange-600 border-orange-200";
    }
    if (low.includes("lazada")) {
      return isDarkMode
        ? "bg-blue-950/40 text-blue-400 border-blue-800/60"
        : "bg-blue-50 text-blue-600 border-blue-200";
    }
    if (low.includes("facebook")) {
      return isDarkMode
        ? "bg-sky-950/40 text-sky-400 border-sky-800/60"
        : "bg-sky-50 text-sky-600 border-sky-200";
    }
    if (low.includes("line")) {
      return isDarkMode
        ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/60"
        : "bg-emerald-50 text-emerald-600 border-emerald-200";
    }
    return isDarkMode
      ? "bg-slate-800/60 text-slate-300 border-slate-700"
      : "bg-slate-100 text-slate-700 border-slate-200";
  };

  const renderStatusBadge = (status: Order["status"], isRefund: boolean, isCancelled?: boolean) => {
    if (isCancelled) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
            isDarkMode
              ? "bg-slate-800 text-slate-300 border-slate-700"
              : "bg-slate-100 text-slate-700 border-slate-200"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
          ยกเลิกแล้ว
        </span>
      );
    }
    if (isRefund) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
            isDarkMode
              ? "bg-rose-950/50 text-rose-400 border-rose-800/60"
              : "bg-rose-50 text-rose-600 border-rose-200"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          หักคืนเงิน
        </span>
      );
    }
    if (status === "Pending") {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
            isDarkMode
              ? "bg-amber-950/50 text-amber-400 border-amber-800/60"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          รอโอน
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
          isDarkMode
            ? "bg-emerald-950/50 text-emerald-300 border-emerald-800/60"
            : "bg-emerald-50 text-emerald-700 border-emerald-200"
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        สำเร็จ
      </span>
    );
  };

  const renderDeltaBadge = (percent: number | null, deltaAmount?: number, isCurrency = true) => {
    if (percent === null) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
          - ฐานเดือนแรก
        </span>
      );
    }

    const isPositive = percent > 0;
    const isZero = percent === 0;

    if (isZero) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
          0.0% ทรงตัว
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold rounded-lg font-mono border ${
          isPositive
            ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800/60"
            : "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800/60"
        }`}
      >
        <span>{isPositive ? "▲" : "▼"}</span>
        <span>{isPositive ? `+${percent.toFixed(1)}%` : `${percent.toFixed(1)}%`}</span>
        {deltaAmount !== undefined && (
          <span className="font-normal opacity-80 ml-0.5">
            ({isPositive ? "+" : ""}{isCurrency ? formatCurrency(deltaAmount) : deltaAmount.toLocaleString()})
          </span>
        )}
      </span>
    );
  };

  const monthlyMoMMetrics = useMemo(() => {
    if (!primaryMonthData) {
      return {
        cancelledSales: 0,
        refundOrdersCount: 0,
        refundSales: 0,
        aov: 0,
        cancelledGrowthPercent: null,
        refundOrdersGrowthPercent: null,
        refundSalesGrowthPercent: null,
        aovGrowthPercent: null,
      };
    }

    const calcGrowth = (currVal: number, prevVal?: number): number | null => {
      if (prevVal === undefined || prevVal === null) return null;
      if (prevVal === 0) {
        if (currVal > 0) return 100;
        if (currVal === 0) return null;
        return 0;
      }
      return Math.round(((currVal - prevVal) / prevVal) * 10000) / 100;
    };

    const prevCanc = compareMonthData ? compareMonthData.cancelledSales : undefined;
    const prevRefOrders = compareMonthData ? compareMonthData.refundOrdersCount : undefined;
    const prevRefSales = compareMonthData ? compareMonthData.refundSales : undefined;
    const prevAov = compareMonthData ? compareMonthData.aov : undefined;

    return {
      cancelledSales: primaryMonthData.cancelledSales,
      refundOrdersCount: primaryMonthData.refundOrdersCount,
      refundSales: primaryMonthData.refundSales,
      aov: primaryMonthData.aov,
      cancelledGrowthPercent: compareMonthData ? calcGrowth(primaryMonthData.cancelledSales, prevCanc) : primaryMonthData.cancelledGrowthPercent,
      refundOrdersGrowthPercent: compareMonthData ? calcGrowth(primaryMonthData.refundOrdersCount, prevRefOrders) : primaryMonthData.refundOrdersGrowthPercent,
      refundSalesGrowthPercent: compareMonthData ? calcGrowth(primaryMonthData.refundSales, prevRefSales) : primaryMonthData.refundSalesGrowthPercent,
      aovGrowthPercent: compareMonthData ? calcGrowth(primaryMonthData.aov, prevAov) : primaryMonthData.aovGrowthPercent,
    };
  }, [primaryMonthData, compareMonthData]);

  // Helper to render the 4 Seller-Center-Style Metric Cards
  const renderSellerMetricCards = (
    data: {
      cancelledSales: number;
      refundOrdersCount: number;
      refundSales: number;
      aov: number;
      cancelledGrowthPercent: number | null;
      refundOrdersGrowthPercent: number | null;
      refundSalesGrowthPercent: number | null;
      aovGrowthPercent: number | null;
    },
    sublabel = "เทียบกับเดือนที่ผ่านมา"
  ) => {
    const cards = [
      {
        key: "cancelledSales" as MetricKey,
        title: "ยอดขายที่ยกเลิก",
        tooltip: "มูลค่ายอดขายรวมของคำสั่งซื้อทั้งหมดที่ถูกยกเลิก (ก่อนชำระเงิน หรือยกเลิกโดยระบบ/ลูกค้า/ร้านค้า)",
        value: formatCurrency(data.cancelledSales),
        percent: data.cancelledGrowthPercent,
        topBarColor: "bg-emerald-500",
        activeBorderColor: "border-emerald-500/50 dark:border-emerald-400/50 ring-2 ring-emerald-500/10 dark:ring-emerald-400/20 bg-gradient-to-b from-emerald-500/[0.04] to-transparent shadow-md",
        activeBg: "",
        invertDeltaColor: true,
        icon: <X className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />,
        badgeText: "✕ Cancelled",
      },
      {
        key: "refundOrdersCount" as MetricKey,
        title: "คำสั่งซื้อที่คืนเงิน/คืนสินค้า",
        tooltip: "จำนวนคำสั่งซื้อที่มีการส่งคืนสินค้าหรือขอคืนเงินสำเร็จ",
        value: data.refundOrdersCount.toLocaleString(),
        percent: data.refundOrdersGrowthPercent,
        topBarColor: "bg-rose-500",
        activeBorderColor: "border-rose-500/50 dark:border-rose-400/50 ring-2 ring-rose-500/10 dark:ring-rose-400/20 bg-gradient-to-b from-rose-500/[0.04] to-transparent shadow-md",
        activeBg: "",
        invertDeltaColor: true,
        icon: <RotateCcw className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400" />,
        badgeText: "↩ Refund",
      },
      {
        key: "refundSales" as MetricKey,
        title: "ยอดขายที่คืนเงิน/คืนสินค้า",
        tooltip: "มูลค่ายอดเงินรวมของคำสั่งซื้อที่มีการขอคืนเงินหรือคืนสินค้า",
        value: formatCurrency(data.refundSales),
        percent: data.refundSalesGrowthPercent,
        topBarColor: "bg-indigo-500",
        activeBorderColor: "border-indigo-500/50 dark:border-indigo-400/50 ring-2 ring-indigo-500/10 dark:ring-indigo-400/20 bg-gradient-to-b from-indigo-500/[0.04] to-transparent shadow-md",
        activeBg: "",
        invertDeltaColor: true,
        icon: <DollarSign className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />,
        badgeText: "฿ Refund",
      },
      {
        key: "aov" as MetricKey,
        title: "ยอดขายเฉลี่ยต่อคำสั่งซื้อ",
        tooltip: "ยอดขายเฉลี่ยต่อหนึ่งคำสั่งซื้อ (Average Order Value - AOV) คำนวณจากยอดขายรวมหารด้วยจำนวนคำสั่งซื้อ",
        value: formatCurrency(data.aov),
        percent: data.aovGrowthPercent,
        topBarColor: "bg-amber-500",
        activeBorderColor: "border-amber-500/50 dark:border-amber-400/50 ring-2 ring-amber-500/10 dark:ring-amber-400/20 bg-gradient-to-b from-amber-500/[0.04] to-transparent shadow-md",
        activeBg: "",
        invertDeltaColor: false,
        icon: <Trophy className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />,
        badgeText: "★ Avg Order",
      },
    ];

    const scrollCards = (direction: "left" | "right") => {
      if (cardScrollContainerRef.current) {
        const amount = direction === "left" ? -300 : 300;
        cardScrollContainerRef.current.scrollBy({ left: amount, behavior: "smooth" });
      }
    };

    return (
      <div className="relative group/carousel w-full">
        {/* Left Arrow Button */}
        <button
          type="button"
          onClick={() => scrollCards("left")}
          className="absolute -left-3 sm:-left-3.5 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-white/95 dark:bg-neutral-900/95 shadow-md border border-neutral-200/90 dark:border-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-105 active:scale-95 transition-all opacity-90 group-hover/carousel:opacity-100 cursor-pointer backdrop-blur-md"
          aria-label="เลื่อนซ้าย"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Cards Grid Container */}
        <div
          ref={cardScrollContainerRef}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth py-1"
        >
          {cards.map((card) => {
            const isSelected = selectedMetricKey === card.key;
            return (
              <div
                key={card.key}
                onClick={() => {
                  setSelectedMetricKey(card.key);
                  if (viewMode === "overview") {
                    if (card.key === "cancelledSales") {
                      setStatusFilter((prev) => (prev === "cancelled" ? "all" : "cancelled"));
                    } else if (card.key === "refundOrdersCount" || card.key === "refundSales") {
                      setStatusFilter((prev) => (prev === "refund" ? "all" : "refund"));
                    }
                  }
                }}
                className={`relative rounded-2xl border transition-all duration-300 p-4 sm:p-5 cursor-pointer overflow-hidden glass-card flex flex-col justify-between select-none ${
                  isSelected
                    ? `${card.activeBorderColor} shadow-md`
                    : "border-neutral-200/80 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5"
                }`}
              >
                <div>
                  {/* Header: Icon + Title + Info Tooltip */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                        {card.icon}
                      </div>
                      <span
                        className={`text-xs sm:text-[13px] font-bold truncate transition-colors ${
                          isSelected ? "text-neutral-900 dark:text-white" : "text-neutral-700 dark:text-neutral-200"
                        }`}
                        title={card.title}
                      >
                        {card.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200/60 dark:border-neutral-700/60">
                        {card.badgeText}
                      </span>
                      <div className="relative group/tooltip shrink-0">
                        <HelpCircle className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors" />
                        <div className="absolute right-0 top-6 z-40 hidden group-hover/tooltip:block w-56 p-2.5 text-[11px] font-normal rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xl border border-white/10 pointer-events-none leading-relaxed">
                          {card.tooltip}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main Value */}
                  <div className="my-2">
                    <p className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight break-words">
                      {card.value}
                    </p>
                  </div>
                </div>

                {/* Bottom Comparison Subline */}
                <div className="pt-2.5 border-t border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium truncate mr-1">
                    {sublabel}
                  </span>
                  {(() => {
                    const pct = card.percent;
                    if (pct === null || pct === undefined) {
                      return (
                        <span className="text-[10px] font-semibold text-neutral-500 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 whitespace-nowrap">
                          {compareMonthData ? "• 0.00%" : "เดือนฐานแรก"}
                        </span>
                      );
                    }
                    if (pct === 0) {
                      return (
                        <span className="text-[10px] font-semibold text-neutral-500 px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 whitespace-nowrap">
                          • 0.00%
                        </span>
                      );
                    }
                    const isUp = pct > 0;
                    const colorCls = isUp
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
                    return (
                      <span className={`text-[10px] font-bold flex items-center gap-0.5 px-2 py-0.5 rounded-full whitespace-nowrap ${colorCls}`}>
                        <span>{isUp ? "▲" : "▼"}</span>
                        <span>{isUp ? `+${Math.abs(pct).toFixed(2)}%` : `-${Math.abs(pct).toFixed(2)}%`}</span>
                      </span>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Arrow Button */}
        <button
          type="button"
          onClick={() => scrollCards("right")}
          className="absolute -right-3 sm:-right-3.5 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-white/95 dark:bg-neutral-900/95 shadow-md border border-neutral-200/90 dark:border-neutral-700 flex items-center justify-center text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:scale-105 active:scale-95 transition-all opacity-90 group-hover/carousel:opacity-100 cursor-pointer backdrop-blur-md"
          aria-label="เลื่อนขวา"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  // Core financial comparison between primaryMonthData and compareMonthData
  const coreMoMComparison = useMemo(() => {
    if (!primaryMonthData) return null;

    const calcGrowth = (curr: number, prev?: number): number | null => {
      if (prev === undefined || prev === null) return null;
      if (prev === 0) {
        if (curr > 0) return 100;
        if (curr === 0) return 0;
        return 0;
      }
      return Math.round(((curr - prev) / prev) * 10000) / 100;
    };

    const prevGross = compareMonthData?.gross;
    const prevPayout = compareMonthData?.actualNetPayout;
    const prevOrders = compareMonthData?.totalOrders;
    const prevAov = compareMonthData?.aov;

    return {
      grossGrowth: calcGrowth(primaryMonthData.gross, prevGross),
      grossDelta: prevGross !== undefined ? Math.round((primaryMonthData.gross - prevGross) * 100) / 100 : 0,
      payoutGrowth: calcGrowth(primaryMonthData.actualNetPayout, prevPayout),
      payoutDelta: prevPayout !== undefined ? Math.round((primaryMonthData.actualNetPayout - prevPayout) * 100) / 100 : 0,
      ordersGrowth: calcGrowth(primaryMonthData.totalOrders, prevOrders),
      ordersDelta: prevOrders !== undefined ? primaryMonthData.totalOrders - prevOrders : 0,
      aovGrowth: calcGrowth(primaryMonthData.aov, prevAov),
      aovDelta: prevAov !== undefined ? Math.round((primaryMonthData.aov - prevAov) * 100) / 100 : 0,
    };
  }, [primaryMonthData, compareMonthData]);

  const thCls = "px-4 py-3.5 text-[11px] font-bold text-apple-primary whitespace-nowrap tracking-wider uppercase";
  const tdCls = "px-4 py-3.5 whitespace-nowrap";

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0 animate-fade-in pb-10">
      {/* Header & Main Navigation Bar */}
      <div className="glass-card rounded-2xl p-5 sm:p-6 no-print border border-neutral-200/80 dark:border-neutral-800 shadow-sm backdrop-blur-xl bg-white/90 dark:bg-neutral-900/90">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-neutral-200/70 dark:border-neutral-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
              <Calculator className="h-5.5 w-5.5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                  เครื่องคำนวณยอดขาย & วัดผลรายเดือน
                </h3>
                <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 tracking-wide">
                  {monthlyDataList.length} เดือนที่พบในไฟล์
                </span>
                <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tracking-wide">
                  {fileSummaryList.length} ไฟล์นำเข้า
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-normal">
                วัดค่ายอดขายรวม รายรับสุทธิ ค่าธรรมเนียม และวิเคราะห์ % เพิ่มขึ้น/ลดลง (MoM Growth) จากไฟล์ที่อัปโหลดในแต่ละเดือน
              </p>
            </div>
          </div>
        </div>

        {/* Month Selector Pills (แถบเลือกตามเดือน) */}
        {monthlyDataList.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-b border-neutral-200/70 dark:border-neutral-800 pb-4">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-800 dark:text-neutral-200 shrink-0">
              <Calendar className="h-4 w-4 text-indigo-500 shrink-0" />
              <span>เลือกตามเดือน:</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => {
                  setPrimaryMonthKey("all");
                  setCompareMonthKey("");
                  setCalcStartDate(initialMinDate);
                  setCalcEndDate(initialMaxDate);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  activePrimaryMonth === "all"
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : "bg-white/80 dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-700"
                }`}
              >
                <span>ทุกช่วงเวลา</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                  activePrimaryMonth === "all" ? "bg-white/20 text-white" : "bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                }`}>
                  ทั้งหมด
                </span>
              </button>

              {monthlyDataList.map((m, idx) => {
                const isActive = activePrimaryMonth === m.monthKey;
                const prevM = idx > 0 ? monthlyDataList[idx - 1] : null;

                return (
                  <button
                    key={m.monthKey}
                    type="button"
                    onClick={() => {
                      setPrimaryMonthKey(m.monthKey);
                      if (prevM) {
                        setCompareMonthKey(prevM.monthKey);
                      } else {
                        setCompareMonthKey("");
                      }
                      const [yearStr, monthStr] = m.monthKey.split("-");
                      const year = parseInt(yearStr, 10);
                      const month = parseInt(monthStr, 10);
                      const lastDay = new Date(year, month, 0).getDate();
                      setCalcStartDate(`${m.monthKey}-01`);
                      setCalcEndDate(`${m.monthKey}-${String(lastDay).padStart(2, "0")}`);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      isActive
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-white/80 dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-700"
                    }`}
                  >
                    <span>{m.shortLabel}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                      isActive ? "bg-white/20 text-white" : "bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                    }`}>
                      {m.totalOrders} รายการ
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* View Mode Switcher Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div className="inline-flex p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700/80 gap-1 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setViewMode("overview")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                viewMode === "overview"
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>ภาพรวม & รายการคำนวณ</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("monthly")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                viewMode === "monthly"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>เปรียบเทียบรายเดือน (MoM)</span>
              {monthlyDataList.length > 1 && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("files")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                viewMode === "files"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>แยกตามไฟล์ที่อัปโหลด</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-white/20">
                {fileSummaryList.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("products")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                viewMode === "products"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>แนวโน้มสินค้า MoM</span>
            </button>
          </div>


        </div>
      </div>
      {viewMode === "monthly" && (
        <div className="space-y-4 sm:space-y-6">
          {/* Comparison Selector Card */}
          <div className="glass-card rounded-2xl p-5 sm:p-6 border border-indigo-500/20 shadow-[0_1px_3px_rgba(99,102,241,0.04),0_4px_16px_-2px_rgba(99,102,241,0.06)]">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-neutral-100 dark:border-neutral-800/80">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white">
                    เครื่องมือเปรียบเทียบข้อมูลรายเดือน (Month-over-Month Comparison)
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    เปรียบเทียบผลต่างจำนวนเงิน (Δ) และอัตราเติบโต (% Growth) ในแต่ละเดือน
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80">
                  {primaryMonthData?.label} {compareMonthData ? `vs ${compareMonthData.label}` : activePrimaryMonth === "all" ? "(ภาพรวมทุกช่วงเวลา)" : "vs เดือนฐานแรก"}
                </span>
              </div>
            </div>

            {/* Sequential Month Chain Selector */}
            {monthlyDataList.length > 0 && (
              <div className="my-4 pb-4 border-b border-neutral-100 dark:border-neutral-800/80">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
                    <span>ลำดับเดือนที่อัปโหลด (คลิกเพื่อดูการเปรียบเทียบอัตโนมัติ):</span>
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {monthlyDataList.length} เดือนในระบบ
                  </span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  {/* All Time Option in Chain */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setPrimaryMonthKey("all");
                        setCompareMonthKey("");
                        setCalcStartDate(initialMinDate);
                        setCalcEndDate(initialMaxDate);
                      }}
                      className={`group px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-start gap-0.5 border ${
                        activePrimaryMonth === "all"
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20"
                          : "bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-neutral-200/80 dark:border-neutral-700 hover:border-indigo-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>ทุกช่วงเวลา</span>
                        {activePrimaryMonth === "all" && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] bg-white text-indigo-700 font-extrabold">
                            กำลังดู
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono">
                        <span className={activePrimaryMonth === "all" ? "text-indigo-100" : "text-neutral-500 dark:text-neutral-400"}>
                          {formatCurrency(allTimeSummaryData.gross)}
                        </span>
                        <span className={activePrimaryMonth === "all" ? "text-indigo-200" : "text-neutral-400 font-medium"}>
                          (รวมทั้งหมด)
                        </span>
                      </div>
                    </button>
                    <ArrowRight className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                  </div>

                  {monthlyDataList.map((m, idx) => {
                    const isPrimary = m.monthKey === activePrimaryMonth;
                    const prevM = idx > 0 ? monthlyDataList[idx - 1] : null;
                    const isUp = m.grossGrowthPercent !== null && m.grossGrowthPercent > 0;
                    const isDown = m.grossGrowthPercent !== null && m.grossGrowthPercent < 0;

                    return (
                      <div key={m.monthKey} className="flex items-center gap-1 shrink-0">
                        {idx > 0 && (
                          <ArrowRight className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setPrimaryMonthKey(m.monthKey);
                            if (prevM) {
                              setCompareMonthKey(prevM.monthKey);
                            } else {
                              setCompareMonthKey("");
                            }
                          }}
                          className={`group px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-start gap-0.5 border ${
                            isPrimary
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20"
                              : "bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-neutral-200/80 dark:border-neutral-700 hover:border-indigo-300"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{m.shortLabel}</span>
                            {isPrimary && (
                              <span className="px-1.5 py-0.2 rounded text-[8px] bg-white text-indigo-700 font-extrabold">
                                กำลังดู
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-mono">
                            <span className={isPrimary ? "text-indigo-100" : "text-neutral-500 dark:text-neutral-400"}>
                              {formatCurrency(m.gross)}
                            </span>
                            {m.grossGrowthPercent !== null ? (
                              <span className={`font-bold ${
                                isPrimary
                                  ? "text-white font-extrabold"
                                  : isUp
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : isDown
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-neutral-400"
                              }`}>
                                {isUp ? "▲+" : isDown ? "▼" : "•"}
                                {Math.abs(m.grossGrowthPercent).toFixed(1)}%
                              </span>
                            ) : (
                              <span className={isPrimary ? "text-indigo-200" : "text-neutral-400 font-medium"}>
                                (ฐานแรก)
                              </span>
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1.5">
                  1. เดือนหลักที่ต้องการวิเคราะห์ (Primary Month):
                </label>
                <div className="relative">
                  <select
                    value={activePrimaryMonth}
                    onChange={(e) => {
                      setPrimaryMonthKey(e.target.value);
                      if (e.target.value === "all") {
                        setCompareMonthKey("");
                        setCalcStartDate(initialMinDate);
                        setCalcEndDate(initialMaxDate);
                      } else {
                        const pIdx = monthlyDataList.findIndex((m) => m.monthKey === e.target.value);
                        if (pIdx > 0) {
                          setCompareMonthKey(monthlyDataList[pIdx - 1].monthKey);
                        } else {
                          setCompareMonthKey("");
                        }
                      }
                    }}
                    className="w-full py-2.5 pl-3.5 pr-10 text-xs sm:text-sm font-bold rounded-xl border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-xs appearance-none transition-all"
                  >
                    <option value="all">🌟 ทุกช่วงเวลา (ข้อมูลรวมทั้งหมด - ยอดขาย {formatCurrency(allTimeSummaryData.gross)})</option>
                    {monthlyDataList.map((m) => (
                      <option key={m.monthKey} value={m.monthKey}>
                        {m.label} (ยอดขาย {formatCurrency(m.gross)})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-1.5">
                  2. เดือนที่ต้องการเปรียบเทียบ (Compare Against):
                </label>
                <div className="relative">
                  <select
                    value={activeCompareMonth}
                    onChange={(e) => setCompareMonthKey(e.target.value)}
                    className="w-full py-2.5 pl-3.5 pr-10 text-xs sm:text-sm font-bold rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-xs appearance-none transition-all"
                  >
                    <option value="">-- เลือกเดือนเพื่อเปรียบเทียบ --</option>
                    {activePrimaryMonth !== "all" && (
                      <option value="all">🌟 ทุกช่วงเวลา (ข้อมูลรวมทั้งหมด)</option>
                    )}
                    {monthlyDataList.map((m) => (
                      <option key={m.monthKey} value={m.monthKey} disabled={m.monthKey === activePrimaryMonth}>
                        {m.label} (ยอดขาย {formatCurrency(m.gross)})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400 flex items-center justify-center">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Core Performance Summary Cards (MoM Comparison) */}
          {primaryMonthData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {/* Gross Revenue Card */}
              <div className="glass-card rounded-2xl p-4 sm:p-5 border border-indigo-500/20 bg-white dark:bg-[#151923] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm font-bold text-neutral-500 dark:text-neutral-400">
                      ยอดขายรวม (Gross)
                    </span>
                    <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                      <DollarSign className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400 tracking-tight">
                    {formatCurrency(primaryMonthData.gross)}
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {compareMonthData ? `vs ${compareMonthData.shortLabel}` : "เดือนฐานแรก"}
                  </span>
                  {renderDeltaBadge(coreMoMComparison?.grossGrowth ?? null, coreMoMComparison?.grossDelta)}
                </div>
              </div>

              {/* Net Payout Card */}
              <div className="glass-card rounded-2xl p-4 sm:p-5 border border-emerald-500/20 bg-white dark:bg-[#151923] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm font-bold text-neutral-500 dark:text-neutral-400">
                      เงินโอนสุทธิ (Payout)
                    </span>
                    <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                    {formatCurrency(primaryMonthData.actualNetPayout)}
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {compareMonthData ? `vs ${compareMonthData.shortLabel}` : "เดือนฐานแรก"}
                  </span>
                  {renderDeltaBadge(coreMoMComparison?.payoutGrowth ?? null, coreMoMComparison?.payoutDelta)}
                </div>
              </div>

              {/* Total Orders Card */}
              <div className="glass-card rounded-2xl p-4 sm:p-5 border border-cyan-500/20 bg-white dark:bg-[#151923] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm font-bold text-neutral-500 dark:text-neutral-400">
                      คำสั่งซื้อทั้งหมด
                    </span>
                    <span className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400">
                      <ShoppingBag className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black font-mono text-cyan-600 dark:text-cyan-400 tracking-tight">
                    {primaryMonthData.totalOrders.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">ออเดอร์</span>
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {compareMonthData ? `vs ${compareMonthData.shortLabel}` : "เดือนฐานแรก"}
                  </span>
                  {renderDeltaBadge(coreMoMComparison?.ordersGrowth ?? null, coreMoMComparison?.ordersDelta, false)}
                </div>
              </div>

              {/* AOV Purchasing Power Card */}
              <div className="glass-card rounded-2xl p-4 sm:p-5 border border-amber-500/20 bg-white dark:bg-[#151923] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm font-bold text-neutral-500 dark:text-neutral-400">
                      ยอดเฉลี่ย AOV (กำลังซื้อ)
                    </span>
                    <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                      <Target className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-600 dark:text-amber-400 tracking-tight">
                    {formatCurrency(primaryMonthData.aov)}
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {compareMonthData ? `vs ${compareMonthData.shortLabel}` : "เดือนฐานแรก"}
                  </span>
                  {renderDeltaBadge(coreMoMComparison?.aovGrowth ?? null, coreMoMComparison?.aovDelta)}
                </div>
              </div>
            </div>
          )}

          {/* 4 Seller-Center-Style Metric Cards (MoM Comparison) */}
          {!hideSellerMetricCards && primaryMonthData &&
            renderSellerMetricCards(
              monthlyMoMMetrics,
              compareMonthData ? `เทียบกับ ${compareMonthData.shortLabel}` : "เทียบกับเดือนที่ผ่านมา"
            )}

          {/* Monthly Comparison Table (ตารางเปรียบเทียบทุกเดือน) */}
          <div className="glass-card rounded-2xl p-5 sm:p-6 border border-neutral-200/70 dark:border-neutral-800/70 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
              <div>
                <h4 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white">
                  ตารางสรุปผลการดำเนินงานและการเติบโตรายเดือน (Monthly MoM Growth Table)
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  คำนวณจากไฟล์และรายการคำสั่งซื้อทั้งหมดแยกตามแต่ละเดือน (คลิกแถวเพื่อเลือกวิเคราะห์เดือนนั้น)
                </p>
              </div>
              <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80">
                รวมทั้งหมด {monthlyDataList.length} เดือน
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-neutral-200/70 dark:border-neutral-800/70 bg-white/40 dark:bg-neutral-900/40">
              <table className="w-full text-left borderless-table">
                <thead>
                  <tr className={`border-b ${isDarkMode ? "border-neutral-800 bg-neutral-800/40" : "border-neutral-100 bg-neutral-50/80"}`}>
                    <th className={thCls}>เดือน / ปี</th>
                    <th className={thCls}>ยอดขายรวม (Gross)</th>
                    <th className={thCls}>การเติบโต (MoM)</th>
                    <th className={thCls}>หักคืนเงิน</th>
                    <th className={thCls}>ค่าธรรมเนียม (% สัดส่วน)</th>
                    <th className={thCls}>ค่าจัดส่ง</th>
                    <th className={thCls}>เงินโอนสุทธิ (Payout)</th>
                    <th className={thCls}>ออเดอร์ (ชิ้น)</th>
                    <th className={thCls}>ยอดเฉลี่ย AOV (กำลังซื้อ)</th>
                  </tr>
                </thead>
                <tbody className="no-dividers">
                  {monthlyDataList.map((m, idx) => {
                    const isSelected = m.monthKey === activePrimaryMonth;
                    const prevM = idx > 0 ? monthlyDataList[idx - 1] : null;
                    return (
                      <tr
                        key={m.monthKey}
                        onClick={() => {
                          setPrimaryMonthKey(m.monthKey);
                          if (prevM) {
                            setCompareMonthKey(prevM.monthKey);
                          } else {
                            setCompareMonthKey("");
                          }
                        }}
                        className={`transition-colors border-b border-neutral-100 dark:border-neutral-800/60 last:border-none cursor-pointer ${
                          isSelected
                            ? "bg-indigo-50/60 dark:bg-indigo-950/40 font-semibold"
                            : "hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40"
                        }`}
                      >
                        <td className={tdCls}>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-neutral-800 dark:text-neutral-100">
                              {m.label}
                            </span>
                            {isSelected && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-600 text-white font-bold">
                                เดือนหลัก
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                            {m.fileCount > 0 ? `${m.fileCount} ไฟล์นำเข้า` : "คำสั่งซื้อตรง"}
                          </span>
                        </td>
                        <td className={`${tdCls} font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400`}>
                          {formatCurrency(m.gross)}
                        </td>
                        <td className={tdCls}>
                          {renderDeltaBadge(m.grossGrowthPercent, m.grossDeltaAmount)}
                        </td>
                        <td className={`${tdCls} font-mono text-xs text-rose-500`}>
                          {m.refunded > 0 ? `- ${formatCurrency(m.refunded)}` : "฿0.00"}
                        </td>
                        <td className={tdCls}>
                          <div className="space-y-0.5">
                            <span className="font-mono text-xs text-purple-600 dark:text-purple-400 font-bold">
                              {formatCurrency(m.actualPlatformFee)}
                            </span>
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                              ({m.feePercent}% ของยอดขาย)
                            </span>
                          </div>
                        </td>
                        <td className={`${tdCls} font-mono text-xs text-sky-600 dark:text-sky-400`}>
                          {formatCurrency(m.actualShippingFee)}
                        </td>
                        <td className={tdCls}>
                          <div className="space-y-0.5">
                            <span className="font-mono font-extrabold text-xs text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(m.actualNetPayout)}
                            </span>
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                              (รับจริง {m.payoutPercent}%)
                            </span>
                          </div>
                        </td>
                        <td className={tdCls}>
                          <span className="font-mono font-bold text-xs text-neutral-800 dark:text-neutral-100">
                            {m.totalOrders.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 ml-1 font-normal">
                            ({m.totalUnitsSold.toLocaleString()} ชิ้น)
                          </span>
                        </td>
                        <td className={tdCls}>
                          <div className="font-mono text-xs text-neutral-800 dark:text-neutral-100 font-bold">
                            {formatCurrency(m.aov)}
                          </div>
                          <div className="mt-0.5">
                            {renderDeltaBadge(m.aovGrowthPercent, m.aovDeltaAmount)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: FILE BREAKDOWN (สรุปแยกตามไฟล์ที่อัปโหลดในแต่ละเดือน)
          ========================================================================= */}
      {viewMode === "files" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="glass-card rounded-2xl p-5 sm:p-6 border border-purple-500/20 shadow-[0_1px_3px_rgba(168,85,247,0.04),0_4px_16px_-2px_rgba(168,85,247,0.06)]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800/80">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white">
                    สรุปยอดขายแยกตามไฟล์ที่อัปโหลด (Uploaded File Breakdown)
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    ตรวจสอบยอดขาย ยอดหัก และเงินโอนสุทธิของแต่ละไฟล์ Excel/CSV ที่นำเข้ามาในระบบ
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800/80">
                {fileSummaryList.length} ไฟล์ทั้งหมด
              </span>
            </div>

            {fileSummaryList.length === 0 ? (
              <div className="py-12 text-center text-neutral-400 dark:text-neutral-500">
                <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="font-bold text-sm">ยังไม่มีข้อมูลไฟล์ที่อัปโหลด</p>
                <p className="text-xs mt-0.5">สามารถนำเข้าไฟล์ยอดขายหรือรายรับได้ที่แท็บ "นำเข้าข้อมูล Excel"</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
                {fileSummaryList.map((file) => (
                  <div
                    key={file.id}
                    className="glass-card rounded-2xl p-4.5 border border-neutral-200/70 dark:border-neutral-800/70 hover:border-purple-500/40 transition-all duration-200 shadow-xs flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="min-w-0 flex-1">
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border mb-1 inline-block ${getChannelBadgeClass(file.platform)}`}>
                            {file.platform}
                          </span>
                          <h5 className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-white truncate" title={file.fileName}>
                            {file.fileName}
                          </h5>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                          {file.totalRows} แถว
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs mt-3">
                        <div className="flex justify-between">
                          <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">ยอดขายรวม:</span>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(file.gross)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">ค่าธรรมเนียม:</span>
                          <span className="font-mono text-purple-600 dark:text-purple-400">
                            {formatCurrency(file.actualPlatformFee)} ({file.feePercent}%)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">ค่าจัดส่ง:</span>
                          <span className="font-mono text-sky-600 dark:text-sky-400">
                            {formatCurrency(file.actualShippingFee)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-neutral-100 dark:border-neutral-800/80 pt-1.5 font-bold">
                          <span className="text-emerald-700 dark:text-emerald-400 text-[11px]">รับจริงสุทธิ:</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(file.actualNetPayout)} ({file.payoutPercent}%)
                          </span>
                        </div>
                      </div>

                      {file.months.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex flex-wrap gap-1">
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mr-1">เดือน:</span>
                          {file.months.map((m) => (
                            <span key={m} className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80">
                              {formatMonthLabel(m, true)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate max-w-[140px]" title={file.dateRangeStr}>
                        {file.dateRangeStr}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFileFilter(file.id);
                          setViewMode("overview");
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition-all cursor-pointer"
                      >
                        <Eye className="h-3 w-3" />
                        <span>ดูรายการไฟล์นี้</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: PRODUCT MONTHLY TRENDS (แนวโน้มและอัตราเติบโตของสินค้า MoM)
          ========================================================================= */}
      {viewMode === "products" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="glass-card rounded-2xl p-5 sm:p-6 border border-teal-500/20 shadow-[0_1px_3px_rgba(20,184,166,0.04),0_4px_16px_-2px_rgba(20,184,166,0.06)]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800/80">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white">
                    การวิเคราะห์สินค้าแยกรายเดือน (Product MoM Growth Trends)
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    ดูยอดขายและจำนวนชิ้นของสินค้าแต่ละรายการใน {primaryMonthData?.label} เทียบกับ {compareMonthData ? compareMonthData.label : "เดือนก่อน"} ว่าเพิ่มหรือลดลงกี่ %
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 border border-teal-200/80 dark:border-teal-800/80">
                {productMonthTrends.length} สินค้าที่มียอด
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-neutral-200/70 dark:border-neutral-800/70 bg-white/40 dark:bg-neutral-900/40 mt-5">
              <table className="w-full text-left borderless-table">
                <thead>
                  <tr className={`border-b ${isDarkMode ? "border-neutral-800 bg-neutral-800/40" : "border-neutral-100 bg-neutral-50/80"}`}>
                    <th className={thCls}>ชื่อสินค้า / แบรนด์</th>
                    <th className={thCls}>ยอดขายเดือนนี้</th>
                    <th className={thCls}>เทียบเดือนก่อน</th>
                    <th className={thCls}>การเติบโต (% MoM)</th>
                    <th className={thCls}>จำนวนชิ้นขาย (เดือนนี้)</th>
                    <th className={thCls}>ผลต่างชิ้น (Δ)</th>
                    <th className={thCls}>สถานะสต็อก</th>
                  </tr>
                </thead>
                <tbody className="no-dividers">
                  {productMonthTrends.map((p) => {
                    const initials = getProductInitials(p.name);
                    return (
                      <tr key={p.name} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors border-b border-neutral-100 dark:border-neutral-800/60 last:border-none">
                        <td className={tdCls}>
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-[10px] flex items-center justify-center shrink-0 border border-neutral-200/60 dark:border-neutral-700/60">
                              {initials}
                            </div>
                            <div className="min-w-0 max-w-[280px]">
                              <p className="font-bold text-neutral-800 dark:text-neutral-100 text-xs truncate" title={p.name}>
                                {p.name}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                                <span>{p.brand}</span>
                                {p.category && (
                                    <>
                                      <span>·</span>
                                      <span>{p.category}</span>
                                    </>
                                  )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={`${tdCls} font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400`}>
                          {formatCurrency(p.currentRevenue)}
                        </td>
                        <td className={`${tdCls} font-mono text-xs text-neutral-500 dark:text-neutral-400`}>
                          {formatCurrency(p.compareRevenue)}
                        </td>
                        <td className={tdCls}>
                          {renderDeltaBadge(p.revenueGrowthPercent, p.revenueDelta)}
                        </td>
                        <td className={`${tdCls} font-mono text-xs text-neutral-800 dark:text-neutral-100 font-bold`}>
                          {p.currentSales.toLocaleString()} ชิ้น
                        </td>
                        <td className={tdCls}>
                          <span className={`font-mono text-xs font-bold ${p.salesDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {p.salesDelta >= 0 ? `+${p.salesDelta}` : p.salesDelta} ชิ้น
                          </span>
                        </td>
                        <td className={tdCls}>
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                            p.status === "Out of Stock"
                              ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400"
                              : p.status === "Low Stock"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                          }`}>
                            {p.currentStock} ชิ้น ({p.status})
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 4: OVERVIEW & CALCULATION LIST (ภาพรวมและรายการคำสั่งซื้อ)
          ========================================================================= */}
      {viewMode === "overview" && (
        <div className="space-y-4 sm:space-y-6">
          {/* Active File Filter Banner if set */}
          {selectedFileFilter !== "All" && (
            <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                  กำลังกรองดูเฉพาะไฟล์: {fileSummaryList.find((f) => f.id === selectedFileFilter)?.fileName || selectedFileFilter}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFileFilter("All")}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-600 text-white hover:bg-purple-700 cursor-pointer"
              >
                ล้างตัวกรองไฟล์ (ดูทั้งหมด)
              </button>
            </div>
          )}



          {/* 4 Seller-Center-Style Metric Cards (Overview Mode) */}
          {!hideSellerMetricCards && renderSellerMetricCards(
            {
              cancelledSales: metrics.cancelledSales,
              refundOrdersCount: metrics.refundOrdersCount,
              refundSales: metrics.refundSales,
              aov: metrics.aov,
              cancelledGrowthPercent: rangeComparison.cancelledGrowthPercent,
              refundOrdersGrowthPercent: rangeComparison.refundOrdersGrowthPercent,
              refundSalesGrowthPercent: rangeComparison.refundSalesGrowthPercent,
              aovGrowthPercent: rangeComparison.aovGrowthPercent,
            },
            `เทียบกับ${rangeComparison.prevMonthLabel || "เดือนที่ผ่านมา"}`
          )}

          {/* Main Data Section: Orders Calculation List */}
          <div className="glass-card rounded-2xl p-5 sm:p-6 border border-neutral-200/70 dark:border-neutral-800/70 shadow-xs backdrop-blur-xl bg-white/90 dark:bg-neutral-900/90">
            <div className="space-y-4 mb-5 border-b border-neutral-100 dark:border-neutral-800/80 pb-5">
              {/* Top Row: Title, Filter Status Badge, Clear Button & Record Type Toggle */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h4 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white tracking-tight">
                      รายการคำสั่งซื้อที่ใช้คำนวณ
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60">
                      {filteredOrdersList.length} รายการ
                    </span>
                    {hasActiveFilters && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        กำลังใช้ตัวกรอง
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-normal">
                    คำสั่งซื้อทั้งหมดในช่วงวันที่ที่เลือก ({metrics.total} รายการ)
                  </p>
                </div>

                {/* Right controls: Reset button & Record Type pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/70 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-300 transition-all cursor-pointer shadow-xs"
                      title="ล้างตัวกรองทั้งหมด"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>ล้างตัวกรอง</span>
                    </button>
                  )}

                  {/* Record Type Segmented Pill Toggle */}
                  <div className="inline-flex p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700/80 gap-1">
                    <button
                      type="button"
                      onClick={() => setRecordTypeFilter("all")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                        recordTypeFilter === "all"
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-xs"
                          : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                      }`}
                    >
                      ทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecordTypeFilter("income")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                        recordTypeFilter === "income"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                      }`}
                    >
                      รายรับ (Income)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecordTypeFilter("order");
                        if (channelFilter === "Facebook" || channelFilter === "LINE OA") {
                          setChannelFilter("All");
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                        recordTypeFilter === "order"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                      }`}
                    >
                      คำสั่งซื้อ (Orders)
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Tabs Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === "all"
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border-neutral-900 dark:border-white shadow-xs"
                      : "bg-white/80 dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-700"
                  }`}
                >
                  <span>ทุกสถานะ</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    statusFilter === "all"
                      ? "bg-white/20 text-white dark:text-neutral-950"
                      : "bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                  }`}>
                    {statusCounts.all}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("paid")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === "paid"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/50"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>สำเร็จ</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    statusFilter === "paid"
                      ? "bg-white/20 text-white"
                      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  }`}>
                    {statusCounts.paid}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("pending")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === "pending"
                      ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                      : "bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/50"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span>รอโอน</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    statusFilter === "pending"
                      ? "bg-white/20 text-white"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  }`}>
                    {statusCounts.pending}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("refund")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === "refund"
                      ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                      : "bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/50"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span>หักคืนเงิน/คืนสินค้า</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    statusFilter === "refund"
                      ? "bg-white/20 text-white"
                      : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                  }`}>
                    {statusCounts.refund}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("cancelled")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === "cancelled"
                      ? "bg-neutral-800 text-white border-neutral-800 shadow-xs"
                      : "bg-neutral-100/70 dark:bg-neutral-800/40 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-700/80"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 shrink-0" />
                  <span>ยกเลิกแล้ว</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    statusFilter === "cancelled"
                      ? "bg-white/20 text-white"
                      : "bg-neutral-500/15 text-neutral-700 dark:text-neutral-300"
                  }`}>
                    {statusCounts.cancelled}
                  </span>
                </button>
              </div>

              {/* Comprehensive Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1 w-full">
                {/* Search Input (Expands to fill available space) */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="ค้นหารหัส / ลูกค้า / สินค้า / แบรนด์..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/90 focus:bg-white dark:focus:bg-neutral-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 transition-all duration-200 shadow-xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Filter Dropdowns Group */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {/* Channel Filter */}
                  <div className="relative flex-1 sm:flex-initial sm:w-36 min-w-[120px]">
                    <select
                      value={channelFilter}
                      onChange={(e) => setChannelFilter(e.target.value)}
                      className="w-full py-2 pl-3 pr-7 text-xs rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/90 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 cursor-pointer shadow-xs transition-all font-medium appearance-none"
                    >
                      {availableChannels.map((c) => (
                        <option key={c} value={c}>
                          {c === "All" ? "ทุกช่องทาง" : c}
                        </option>
                      ))}
                    </select>
                    <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
                  </div>

                  {/* Brand Filter */}
                  {availableBrands.length > 2 && (
                    <div className="relative flex-1 sm:flex-initial sm:w-36 min-w-[120px]">
                      <select
                        value={brandFilter}
                        onChange={(e) => setBrandFilter(e.target.value)}
                        className="w-full py-2 pl-3 pr-7 text-xs rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/90 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 cursor-pointer shadow-xs transition-all font-medium appearance-none"
                      >
                        <option value="All">ทุกแบรนด์</option>
                        {availableBrands.filter((b) => b !== "All").map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                      <Tag className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
                    </div>
                  )}

                  {/* Category Filter */}
                  {availableCategories.length > 2 && (
                    <div className="relative flex-1 sm:flex-initial sm:w-36 min-w-[120px]">
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full py-2 pl-3 pr-7 text-xs rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/90 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 cursor-pointer shadow-xs transition-all font-medium appearance-none"
                      >
                        <option value="All">ทุกหมวดหมู่</option>
                        {availableCategories.filter((c) => c !== "All").map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <SlidersHorizontal className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
                    </div>
                  )}

                  {/* Items Per Page */}
                  <div className="relative flex-1 sm:flex-initial sm:w-36 min-w-[120px]">
                    <select
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      className="w-full py-2 pl-3 pr-8 text-xs rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/90 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 cursor-pointer shadow-xs transition-all font-medium appearance-none"
                    >
                      <option value={10}>10 รายการ/หน้า</option>
                      <option value={25}>25 รายการ/หน้า</option>
                      <option value={50}>50 รายการ/หน้า</option>
                      <option value={100}>100 รายการ/หน้า</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto rounded-2xl border border-neutral-200/70 dark:border-neutral-800/70 bg-white/40 dark:bg-neutral-900/40">
              <table className="w-full text-left borderless-table">
                <thead>
                  <tr className={`border-b ${isDarkMode ? "border-neutral-800 bg-neutral-800/40" : "border-neutral-100 bg-neutral-50/80"}`}>
                    <th className={thCls}>รหัส</th>
                    <th
                      className={`${thCls} cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group/th`}
                      onClick={() => setSortBy((prev) => (prev === "date_desc" ? "date_asc" : "date_desc"))}
                      title="คลิกเพื่อเรียงลำดับตามวันที่ (ล่าสุด ↔ เก่าสุด)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="group-hover/th:underline underline-offset-2">วันที่</span>
                        <span
                          className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold transition-all ${
                            sortBy.startsWith("date")
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80"
                          }`}
                        >
                          {sortBy === "date_asc" ? "▲" : "▼"}
                        </span>
                      </div>
                    </th>
                    <th className={thCls}>ลูกค้า</th>
                    <th
                      className={`${thCls} cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group/th`}
                      onClick={() => setSortBy((prev) => (prev === "qty_desc" ? "qty_asc" : "qty_desc"))}
                      title="คลิกเพื่อเรียงลำดับตามจำนวนชิ้น (มาก ↔ น้อย)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="group-hover/th:underline underline-offset-2">สินค้า / แบรนด์ / หมวดหมู่</span>
                        <span
                          className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold transition-all ${
                            sortBy.startsWith("qty")
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80"
                          }`}
                        >
                          {sortBy === "qty_asc" ? "▲" : "▼"}
                        </span>
                      </div>
                    </th>
                    <th className={thCls}>ช่องทาง & ประเภท</th>
                    <th
                      className={`${thCls} cursor-pointer select-none hover:text-blue-600 dark:hover:text-blue-400 transition-colors group/th`}
                      onClick={() => setSortBy((prev) => (prev === "gross_desc" ? "gross_asc" : prev === "gross_asc" ? "net_desc" : "gross_desc"))}
                      title="คลิกเพื่อเรียงลำดับ ยอดขายรวม (มาก ↔ น้อย)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="group-hover/th:underline underline-offset-2">ยอดขายรวม / เงินโอนสุทธิ</span>
                        <span
                          className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-extrabold transition-all ${
                            sortBy.startsWith("gross") || sortBy.startsWith("net")
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800"
                          }`}
                        >
                          {sortBy === "gross_asc" || sortBy === "net_asc" ? "▲" : "▼"}
                        </span>
                      </div>
                    </th>
                    <th className={thCls}>สถานะ</th>
                  </tr>
                </thead>
                <tbody className="no-dividers">
                  {paginatedList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-2.5">
                          <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                            <SearchX className="h-6 w-6" />
                          </div>
                          <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 tracking-tight">
                            ไม่พบรายการตามเงื่อนไขที่เลือก
                          </p>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            ลองปรับเปลี่ยนคำค้นหา ช่องทาง หรือช่วงวันที่เพื่อดูข้อมูล
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedList.map((o) => {
                      const grossAmt = getOrderGrossAmount(o);
                      const netAmt = getOrderNetAmount(o);
                      const totalFees = (o.platformFee || 0) + (o.shippingFee || 0);
                      const isRefund = isRefundedOrder(o);
                      const resolvedBrand = resolveBrandName(o.brand, o.productName, o, products);
                      const initials = getProductInitials(o.productName);

                      return (
                        <tr
                          key={o.id}
                          className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors border-b border-neutral-100 dark:border-neutral-800/60 last:border-none"
                        >
                          <td className={tdCls}>
                            <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400 font-medium tracking-tight">
                              {o.id}
                            </span>
                          </td>
                          <td className={`${tdCls} font-mono text-xs text-neutral-500 dark:text-neutral-400`}>
                            {o.date}
                          </td>
                          <td className={`${tdCls} font-bold text-neutral-800 dark:text-neutral-100 text-xs`}>
                            {maskCustomerName(o.customerName)}
                          </td>
                          <td className={tdCls}>
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-[10px] flex items-center justify-center shrink-0 border border-neutral-200/60 dark:border-neutral-700/60">
                                {initials}
                              </div>
                              <div className="min-w-0 max-w-[280px]">
                                <p className="font-bold text-neutral-800 dark:text-neutral-100 text-xs truncate" title={o.productName}>
                                  {o.productName} <span className="text-neutral-400 dark:text-neutral-500 text-[11px] ml-0.5 font-normal">(x{o.quantity || 1})</span>
                                </p>
                                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                                  <span>{resolvedBrand}</span>
                                  {o.category && (
                                    <>
                                      <span>·</span>
                                      <span>{o.category}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className={tdCls}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${getChannelBadgeClass(o.channel)}`}>
                                {o.channel}
                              </span>
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${
                                o.isIncome
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                  : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                              }`}>
                                {o.isIncome ? "รายรับ" : "ออเดอร์"}
                              </span>
                            </div>
                          </td>
                          <td className={tdCls}>
                            <div className="space-y-0.5">
                              <p className={`font-extrabold font-mono text-xs ${isRefund ? "text-rose-500 dark:text-rose-400" : "text-neutral-900 dark:text-white"}`}>
                                {isRefund ? `- ${formatCurrency(grossAmt)}` : formatCurrency(grossAmt)}
                              </p>
                              {!isRefund && totalFees > 0 && (
                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                                  สุทธิ: <span className="font-bold text-neutral-800 dark:text-neutral-100">{formatCurrency(netAmt)}</span>
                                  <span className="text-neutral-400 ml-1 font-mono">(-{formatCurrency(totalFees)})</span>
                                </p>
                              )}
                            </div>
                          </td>
                          <td className={tdCls}>
                            {renderStatusBadge(o.status, isRefund, isCancelledOrder(o))}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 lg:hidden">
              {paginatedList.length === 0 ? (
                <div className="col-span-full glass-card rounded-2xl p-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <SearchX className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
                    <span>ไม่พบรายการตามเงื่อนไขที่เลือก</span>
                  </div>
                </div>
              ) : (
                paginatedList.map((o) => {
                  const grossAmt = getOrderGrossAmount(o);
                  const netAmt = getOrderNetAmount(o);
                  const totalFees = (o.platformFee || 0) + (o.shippingFee || 0);
                  const isRefund = isRefundedOrder(o);
                  const resolvedBrand = resolveBrandName(o.brand, o.productName, o, products);
                  const initials = getProductInitials(o.productName);

                  return (
                    <div
                      key={o.id}
                      className="glass-card rounded-2xl p-4 space-y-3 border border-neutral-200/70 dark:border-neutral-800/70 shadow-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                          {o.id}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${getChannelBadgeClass(o.channel)}`}>
                            {o.channel}
                          </span>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${
                            o.isIncome
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                          }`}>
                            {o.isIncome ? "รายรับ" : "ออเดอร์"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-xs flex items-center justify-center shrink-0 border border-neutral-200/60 dark:border-neutral-700/60">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-neutral-900 dark:text-white text-xs">
                            {maskCustomerName(o.customerName)}
                          </h4>
                          <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5 truncate">
                            {o.productName} <span className="text-neutral-400 text-xs font-normal">(x{o.quantity || 1})</span>
                          </p>
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                            {resolvedBrand} {o.category ? `· ${o.category}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-neutral-100 dark:border-neutral-800 pt-2.5 flex justify-between items-center text-xs">
                        <div>
                          <span className="text-neutral-400 dark:text-neutral-500 text-[10px]">วันที่</span>
                          <p className="font-mono text-neutral-600 dark:text-neutral-300 mt-0.5 text-xs">
                            {o.date}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-neutral-400 dark:text-neutral-500 text-[10px]">ยอดขายรวม</span>
                          <p className={`font-extrabold mt-0.5 font-mono text-xs ${isRefund ? "text-rose-500 dark:text-rose-400" : "text-neutral-900 dark:text-white"}`}>
                            {isRefund ? `- ${formatCurrency(grossAmt)}` : formatCurrency(grossAmt)}
                          </p>
                          {!isRefund && totalFees > 0 && (
                            <p className="text-[10px] text-neutral-800 dark:text-neutral-100 font-bold font-mono">
                              โอนสุทธิ: {formatCurrency(netAmt)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-neutral-100 dark:border-neutral-800 pt-2.5 flex justify-between items-center">
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-bold">
                          สถานะ
                        </span>
                        {renderStatusBadge(o.status, isRefund, isCancelledOrder(o))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Footer */}
            {filteredOrdersList.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                <p className="text-neutral-500 dark:text-neutral-400">
                  แสดง <span className="font-semibold text-neutral-800 dark:text-neutral-200">{startIndex + 1}</span> ถึง{" "}
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">{endIndex}</span> จากทั้งหมด{" "}
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">{filteredOrdersList.length}</span> รายการ
                  {filteredOrdersList.length !== metrics.total && (
                    <span className="text-neutral-400 ml-1">
                      (กรองจาก {metrics.total} รายการ)
                    </span>
                  )}
                </p>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-700 dark:text-neutral-200 transition-all cursor-pointer shadow-xs"
                      title="หน้าก่อนหน้า"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <span className="px-3 py-1 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      {currentPage} / {totalPages}
                    </span>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-700 dark:text-neutral-200 transition-all cursor-pointer shadow-xs"
                      title="หน้าถัดไป"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const CalculatorTab = React.memo(CalculatorTabComponent);

