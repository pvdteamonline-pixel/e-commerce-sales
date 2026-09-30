import React, { useState, useMemo, useRef } from "react";
import type { UploadedDataset, Order } from "../types";
import { ExcelTable } from "./ExcelTable";
import {
  FileSpreadsheet,
  AlertCircle,
  Trash2,
  Database,
  Clock,
  Layers,
  Coins,
  Package,
  Upload,
  Loader2,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  parseExcelFile,
  convertDatasetToOrders,
  detectPlatform,
} from "../utils/fileParser";
import { validateUploadedFile } from "../utils/security";

interface DatasetViewerProps {
  datasets: UploadedDataset[];
  type: "income" | "order" | "product";
  isDarkMode: boolean;
  onDeleteDataset: (id: string) => void;
  onImportDataset?: (dataset: UploadedDataset) => void;
  requestConfirm?: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText?: string,
    cancelText?: string,
    icon?: "trash" | "warning",
  ) => void;
  hideKpis?: boolean;
  onImportOrders?: (orders: Order[], datasets: UploadedDataset[]) => void;
  triggerAlert?: (
    msg: string,
    type?: "success" | "warning" | "info" | "error",
  ) => void;
  canUpload?: boolean;
  channelFilter?: string;
  setChannelFilter?: (channel: string) => void;
}

export interface FileDetailedStats {
  netIncome: number;
  grossSales: number;
  platformFees: number;
  shippingFees: number;
  discounts: number;
  totalRows: number;
  uniqueOrders: number;
  totalQuantity: number;
  minDate: string | null;
  maxDate: string | null;
  feeBreakdown: {
    name: string;
    amount: number;
    percentage: number;
    color: string;
  }[];
  sheetBreakdown: {
    name: string;
    rows: number;
    netIncome: number;
    grossSales: number;
    platformFees: number;
  }[];
  topProducts: { name: string; quantity: number; amount: number }[];
  topBrands: { name: string; quantity: number; amount: number }[];
}

// Platform helper for branded theme settings
const getPlatformMeta = (platform: string) => {
  const p = platform ? platform.toLowerCase() : "";
  if (p === "lazada") {
    return {
      bg: "bg-blue-500/10 dark:bg-blue-500/5",
      text: "text-blue-600 dark:text-blue-400",
      border: "border-blue-500/20 dark:border-blue-500/10",
      badgeBg: "bg-blue-600 dark:bg-blue-500",
      dot: "bg-blue-500",
      brandColor: "#2E2BB8",
      glowClass: "shadow-blue-500/10 dark:shadow-blue-500/5",
      hoverBg: "hover:bg-blue-50/40 dark:hover:bg-blue-950/10",
      label: "LAZADA",
    };
  } else if (p === "shopee") {
    return {
      bg: "bg-orange-500/10 dark:bg-orange-500/5",
      text: "text-orange-600 dark:text-orange-400",
      border: "border-orange-500/20 dark:border-orange-500/10",
      badgeBg: "bg-orange-500",
      dot: "bg-orange-500",
      brandColor: "#EE4D2D",
      glowClass: "shadow-orange-500/10 dark:shadow-orange-500/5",
      hoverBg: "hover:bg-orange-50/40 dark:hover:bg-orange-950/10",
      label: "SHOPEE",
    };
  } else if (p === "tiktok" || p === "tiktok shop") {
    return {
      bg: "bg-rose-500/10 dark:bg-rose-500/5",
      text: "text-rose-600 dark:text-rose-400",
      border: "border-rose-500/20 dark:border-rose-500/10",
      badgeBg: "bg-rose-500",
      dot: "bg-rose-500",
      brandColor: "#FE2C55",
      glowClass: "shadow-rose-500/10 dark:shadow-rose-500/5",
      hoverBg: "hover:bg-rose-50/40 dark:hover:bg-rose-950/10",
      label: "TIKTOK SHOP",
    };
  } else if (p === "facebook") {
    return {
      bg: "bg-sky-500/10 dark:bg-sky-500/5",
      text: "text-sky-600 dark:text-sky-400",
      border: "border-sky-500/20 dark:border-sky-500/10",
      badgeBg: "bg-sky-600 dark:bg-sky-500",
      dot: "bg-sky-500",
      brandColor: "#1877F2",
      glowClass: "shadow-sky-500/10 dark:shadow-sky-500/5",
      hoverBg: "hover:bg-sky-50/40 dark:hover:bg-sky-950/10",
      label: "FACEBOOK",
    };
  } else if (p === "line" || p === "line oa") {
    return {
      bg: "bg-emerald-500/10 dark:bg-emerald-500/5",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/20 dark:border-emerald-500/10",
      badgeBg: "bg-emerald-500",
      dot: "bg-emerald-500",
      brandColor: "#06C755",
      glowClass: "shadow-emerald-500/10 dark:shadow-emerald-500/5",
      hoverBg: "hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10",
      label: "LINE OA",
    };
  } else {
    return {
      bg: "bg-neutral-500/10 dark:bg-neutral-500/5",
      text: "text-neutral-600 dark:text-neutral-400",
      border: "border-neutral-500/20 dark:border-neutral-500/10",
      badgeBg: "bg-neutral-500",
      dot: "bg-neutral-500",
      brandColor: "#6b7280",
      glowClass: "shadow-neutral-500/10",
      hoverBg: "hover:bg-neutral-50/40 dark:hover:bg-neutral-900/10",
      label: "UNKNOWN",
    };
  }
};

const MONTH_ORDER_MAP: Record<string, number> = {
  "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
  "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
  "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
  "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4, "พฤษภาคม": 5, "มิถุนายน": 6,
  "กรกฎาคม": 7, "สิงหาคม": 8, "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12,
  "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
  "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
  "มค": 1, "กพ": 2, "มีค": 3, "เมย": 4, "พค": 5, "มิย": 6,
  "กค": 7, "สค": 8, "กย": 9, "ตค": 10, "พย": 11, "ธค": 12,
};

const TH_MONTH_SHORT_NAMES = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const extractMonthFromFileName = (fileName: string): { monthNum: number; monthLabel: string } | null => {
  if (!fileName) return null;
  const lower = fileName.toLowerCase();
  for (const [key, num] of Object.entries(MONTH_ORDER_MAP)) {
    if (lower.includes(key)) {
      return { monthNum: num, monthLabel: TH_MONTH_SHORT_NAMES[num] || `เดือน ${num}` };
    }
  }
  const regexPatterns = [
    /(?:month|เดือน|m)[\s_-]?(\d{1,2})/i,
    /(?:20\d\d)[-_.](\d{1,2})/i,
    /(?:^|[_\-\s.])(\d{1,2})[-_.](?:20\d\d)/i,
    /(?:^|[_\-\s.])(\d{1,2})(?:\.xlsx|\.xls|\.csv)/i,
  ];
  for (const regex of regexPatterns) {
    const match = lower.match(regex);
    if (match && match[1]) {
      const val = parseInt(match[1], 10);
      if (val >= 1 && val <= 12) {
        return { monthNum: val, monthLabel: TH_MONTH_SHORT_NAMES[val] || `เดือน ${val}` };
      }
    }
  }
  return null;
};

const compareFileNamesChronologically = (a: string, b: string): number => {
  const mA = extractMonthFromFileName(a);
  const mB = extractMonthFromFileName(b);
  if (mA && mB && mA.monthNum !== mB.monthNum) {
    return mA.monthNum - mB.monthNum;
  }
  if (mA && !mB) return -1;
  if (!mA && mB) return 1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
};

const resolveDatasetPlatform = (
  dataset: UploadedDataset,
): "lazada" | "shopee" | "tiktok" | "facebook" | "line" | "unknown" => {
  if (dataset.platform && dataset.platform !== "unknown") {
    const p = dataset.platform.toLowerCase().trim();
    if (p === "tiktok shop") return "tiktok";
    if (p === "line oa") return "line";
    if (["lazada", "shopee", "tiktok", "facebook", "line"].includes(p))
      return p as "lazada" | "shopee" | "tiktok" | "facebook" | "line";
  }
  const headers = dataset.sheets?.[0]?.headers || [];
  return detectPlatform(dataset.fileName, headers);
};

// Compute detailed stats for an individual dataset file
const computeDatasetStats = (
  dataset: UploadedDataset,
  type: "income" | "order" | "product",
): FileDetailedStats => {
  let netIncome = 0;
  let grossSales = 0;
  let platformFees = 0;
  let shippingFees = 0;
  let discounts = 0;
  let totalRows = 0;
  let totalQuantity = 0;
  const orderIdSet = new Set<string>();
  const dates: string[] = [];
  const feeMap: Record<string, number> = {};
  const productMap: Record<string, { quantity: number; amount: number }> = {};
  const brandMap: Record<string, { quantity: number; amount: number }> = {};
  const sheetBreakdown: FileDetailedStats["sheetBreakdown"] = [];

  const resolvedPlat = resolveDatasetPlatform(dataset);
  const platformLower = resolvedPlat.toLowerCase();
  const isLazada = platformLower.includes("lazada");

  (dataset.sheets || []).forEach((sheet) => {
    const sName = sheet.name.toLowerCase();
    const isDocSheet = [
      "summary",
      "รายงาน",
      "บันทึกการถอน",
      "คำอธิบายค่าธรรมเนียม",
      "คำอธิบาย",
      "glossary",
      "withdraw",
      "withdrawal",
      "instruction",
      "คู่มือ",
      "overview",
      "readme",
      "template",
      "settings",
    ].some((kw) => sName.includes(kw));

    if (dataset.sheets.length > 1 && isDocSheet && !isLazada) {
      return;
    }

    let sheetNetIncome = 0;
    let sheetGrossSales = 0;
    let sheetFees = 0;
    const sheetRowsCount = sheet.rows?.length || 0;
    totalRows += sheetRowsCount;

    const headers = sheet.headers || [];

    // Find header matches
    const netIncomeHeader =
      headers.find((h) => {
        const hl = h.toLowerCase().trim();
        return (
          hl === "ยอดการชำระเงินทั้งหมด" ||
          hl === "ยอดชำระเงินทั้งหมด" ||
          hl === "จำนวนเงินที่ชำระทั้งหมด" ||
          hl === "จำนวนเงิน(รวมภาษี)" ||
          hl === "จำนวนเงิน (รวมภาษี)" ||
          hl === "จำนวนเงินทั้งหมดที่โอนแล้ว (฿)" ||
          hl === "จำนวนเงินทั้งหมดที่โอนแล้ว" ||
          hl === "ยอดโอนสุทธิ" ||
          hl === "ยอดโอนเงินสุทธิ" ||
          hl === "ยอดเงินโอนสุทธิ" ||
          hl === "ยอดรับสุทธิ" ||
          hl === "รายรับสุทธิ" ||
          hl === "รายได้สุทธิ" ||
          hl === "net income" ||
          hl === "net income (thb)" ||
          hl === "net amount" ||
          hl === "net_amount" ||
          hl === "settlement amount" ||
          hl === "total settlement amount" ||
          hl === "payout" ||
          hl === "seller payout" ||
          hl === "ยอดโอน" ||
          hl === "ยอดเงินโอน" ||
          hl === "จำนวนเงินที่โอน" ||
          hl === "เงินโอน"
        );
      }) ||
      (isLazada
        ? headers.find(
            (h) =>
              h.toLowerCase().trim() === "amount" ||
              h.toLowerCase().trim() === "ยอดเงิน",
          )
        : undefined);

    const grossSalesHeader =
      headers.find((h) => {
        const hl = h.toLowerCase().trim();
        return (
          hl === "รายได้ทั้งหมด" ||
          hl === "รายได้รวม" ||
          hl === "ยอดรวมค่าสินค้าก่อนหักส่วนลด" ||
          hl === "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย" ||
          hl === "ยอดรวมค่าสินค้า" ||
          hl === "sku subtotal after discount" ||
          hl === "ราคาขายสุทธิ" ||
          hl === "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)" ||
          hl === "ราคาสินค้าที่ชำระโดยผู้ซื้อ" ||
          hl === "ราคาขาย" ||
          hl === "จำนวนเงินทั้งหมด" ||
          hl === "order amount" ||
          hl === "ยอดขาย" ||
          hl === "ยอดขายรวม / รายรับสุทธิ (gross sales / net income)" ||
          hl === "ยอดรวมของคำสั่งซื้อ" ||
          hl === "ยอดรวมคำสั่งซื้อ" ||
          hl === "ยอดขายรวม"
        );
      }) ||
      headers.find((h) => {
        const hl = h.toLowerCase().trim();
        return (
          hl === "total" ||
          hl === "ราคารวม" ||
          hl === "amount" ||
          hl === "price"
        );
      });

    const unitPriceHeader = headers.find((h) => {
      const hl = h.toLowerCase().trim();
      return (
        hl === "ราคาต่อหน่วย" ||
        hl === "unit price" ||
        hl === "unitprice" ||
        hl === "paid price" ||
        hl === "paidprice" ||
        hl === "ราคาต่อหน่วย (unit price)"
      );
    });

    // Check if there is an overarching grand total fee summary column
    const totalFeeSummaryHeader = headers.find((h) => {
      const hl = h.toLowerCase().trim();
      return (
        hl === "ค่าธรรมเนียมทั้งหมด" ||
        hl === "ค่าบริการและค่าธรรมเนียมทั้งหมด" ||
        hl === "ค่าธรรมเนียมรวม" ||
        hl === "รวมค่าธรรมเนียม" ||
        hl === "total fee" ||
        hl === "total fees" ||
        hl === "total platform fee"
      );
    });

    const feeHeaders = totalFeeSummaryHeader
      ? [totalFeeSummaryHeader]
      : headers.filter((h) => {
          const hl = h.toLowerCase().trim();
          if (
            hl.includes("จัดส่ง") ||
            hl.includes("shipping") ||
            hl.includes("ส่วนลด") ||
            hl.includes("discount") ||
            hl.includes("voucher")
          ) {
            return false;
          }
          return (
            hl.includes("ค่าบริการ") ||
            hl.includes("ค่าธรรมเนียม") ||
            hl.includes("ค่าคอมมิชชั่น") ||
            hl.includes("platform fee") ||
            hl.includes("commission") ||
            hl.includes("transaction fee") ||
            hl.includes("payment fee") ||
            hl.includes("service fee")
          );
        });

    const shippingHeader = headers.find((h) => {
      const hl = h.toLowerCase().trim();
      return (
        hl.includes("ค่าจัดส่ง") ||
        hl.includes("shipping fee") ||
        hl.includes("ค่าส่ง") ||
        hl.includes("shipping")
      );
    });

    const discountHeader = headers.find((h) => {
      const hl = h.toLowerCase().trim();
      return (
        hl.includes("ส่วนลด") ||
        hl.includes("discount") ||
        hl.includes("voucher") ||
        hl.includes("โค้ด")
      );
    });

    const qtyHeader = headers.find((h) => {
      const hl = h.toLowerCase().trim();
      if (
        hl.includes("เงิน") ||
        hl.includes("บาท") ||
        hl.includes("ราคา") ||
        hl.includes("amount") ||
        hl.includes("price") ||
        hl.includes("total") ||
        hl.includes("fee")
      ) {
        return false;
      }
      return (
        hl === "จำนวน" ||
        hl === "quantity" ||
        hl === "qty" ||
        hl === "จำนวนสินค้า" ||
        hl === "จำนวนชิ้น" ||
        hl === "จำนวน (quantity)" ||
        hl === "ลำดับ / จำนวน (quantity / seq)" ||
        hl.includes("quantity") ||
        hl.includes("qty") ||
        hl.includes("จำนวน")
      );
    });

    const orderIdHeader = headers.find((h) => {
      const hl = h.toLowerCase().trim();
      return (
        hl.includes("หมายเลขคำสั่งซื้อ") ||
        hl.includes("order id") ||
        hl.includes("order no") ||
        hl.includes("เลขที่คำสั่งซื้อ") ||
        hl.includes("statement number") ||
        hl.includes("order item no") ||
        hl.includes("หมายเลขคำสั่งซื้อ (order id)")
      );
    });

    const dateHeader = headers.find((h) => {
      const hl = h.toLowerCase().trim();
      return (
        hl.includes("วันที่") ||
        hl.includes("date") ||
        hl.includes("time") ||
        hl.includes("เวลา")
      );
    });

    const productHeader = headers.find((h) => {
      const hl = h.toLowerCase().trim();
      return (
        hl.includes("ชื่อสินค้า") ||
        hl.includes("product name") ||
        hl.includes("item name") ||
        hl.includes("รายละเอียดสินค้า") ||
        hl.includes("fee name") ||
        hl.includes("ชื่อรายการธุรกรรม") ||
        hl.includes("ชื่อสินค้า (product name)")
      );
    });

    const brandHeader = headers.find((h) => {
      const hl = h.toLowerCase().trim();
      return (
        hl.includes("brand") || hl.includes("แบรนด์") || hl.includes("ยี่ห้อ")
      );
    });

    const feeNameHeader = headers.find((h) => {
      const hl = h.toLowerCase().trim();
      return (
        hl.includes("fee name") ||
        hl.includes("ชื่อรายการธุรกรรม") ||
        hl.includes("ประเภทธุรกรรม") ||
        hl.includes("fee type")
      );
    });

    // Row-by-row aggregation
    (sheet.rows || []).forEach((row) => {
      if (orderIdHeader && row[orderIdHeader]) {
        orderIdSet.add(String(row[orderIdHeader]).trim());
      }

      if (dateHeader && row[dateHeader]) {
        const rawDate = String(row[dateHeader]).trim();
        if (rawDate && rawDate !== "-" && rawDate.toLowerCase() !== "null") {
          dates.push(rawDate);
        }
      }

      let rowQty = 1;
      if (
        qtyHeader &&
        row[qtyHeader] !== undefined &&
        row[qtyHeader] !== null &&
        row[qtyHeader] !== ""
      ) {
        const qNum = Number(String(row[qtyHeader]).replace(/,/g, ""));
        if (!isNaN(qNum) && qNum > 0) {
          rowQty = qNum;
          totalQuantity += qNum;
        } else {
          totalQuantity += 1;
        }
      } else {
        totalQuantity += 1;
      }

      // Lazada statement parsing (credits vs fee debits)
      if (isLazada && (netIncomeHeader || grossSalesHeader)) {
        const amtCol = netIncomeHeader || grossSalesHeader;
        const rawVal = row[amtCol!];
        if (rawVal !== undefined && rawVal !== null && rawVal !== "") {
          const num = Number(String(rawVal).replace(/[฿$thbTHB,\s]/g, ""));
          if (!isNaN(num)) {
            netIncome += num;
            sheetNetIncome += num;

            const feeName =
              feeNameHeader && row[feeNameHeader]
                ? String(row[feeNameHeader]).trim()
                : "";
            const feeNameLower = feeName.toLowerCase();
            const isRefund =
              feeNameLower.includes("คืนสินค้า") ||
              feeNameLower.includes("หักเงินค่าสินค้า") ||
              feeNameLower.includes("refund");
            const isShipping =
              feeNameLower.includes("shipping") ||
              feeNameLower.includes("ขนส่ง") ||
              feeNameLower.includes("จัดส่ง");
            const isFeeRebate =
              feeName.startsWith("คืน") ||
              feeName.startsWith("Reverse") ||
              feeName.includes("คืนส่วนลด") ||
              feeName.includes("คืนค่าธรรมเนียม");

            const normalizeLazadaCat = (name: string): string => {
              let n = name.trim();
              if (n.startsWith("คืนส่วนลด"))
                n = n.replace(/^คืนส่วนลด/, "").trim();
              if (n.startsWith("คืน")) n = n.replace(/^คืน/, "").trim();
              if (n.startsWith("Reverse -") || n.startsWith("Reverse"))
                n = n.replace(/^Reverse\s*-\s*|^Reverse\s*/i, "").trim();
              if (n.startsWith("หัก")) n = n.replace(/^หัก/, "").trim();
              return n || name;
            };

            if (feeName.includes("ยอดรวมค่าสินค้า")) {
              grossSales += num;
              sheetGrossSales += num;
            } else if (isRefund) {
              // Product refund: reduces gross sales
              const absVal = Math.abs(num);
              grossSales -= absVal;
              sheetGrossSales -= absVal;
            } else if (isShipping) {
              const absVal = Math.abs(num);
              shippingFees += absVal;
            } else if (isFeeRebate) {
              // Positive fee adjustment / refund from platform: reduces platform fee
              platformFees -= num;
              sheetFees -= num;
              const catName = normalizeLazadaCat(feeName);
              feeMap[catName] = (feeMap[catName] || 0) - num;
            } else if (num < 0) {
              const absVal = Math.abs(num);
              platformFees += absVal;
              sheetFees += absVal;
              const catName =
                normalizeLazadaCat(feeName) || "ค่าธรรมเนียมอื่นๆ";
              feeMap[catName] = (feeMap[catName] || 0) + absVal;
            } else if (num > 0) {
              grossSales += num;
              sheetGrossSales += num;
            }
          }
        }
      } else {
        // Standard Platforms (Shopee, TikTok, FB, Line, Orders, Products)
        if (
          netIncomeHeader &&
          row[netIncomeHeader] !== undefined &&
          row[netIncomeHeader] !== null
        ) {
          const num = Number(
            String(row[netIncomeHeader]).replace(/[฿$thbTHB,\s]/g, ""),
          );
          if (!isNaN(num)) {
            netIncome += num;
            sheetNetIncome += num;
          }
        }

        if (
          grossSalesHeader &&
          row[grossSalesHeader] !== undefined &&
          row[grossSalesHeader] !== null
        ) {
          const num = Number(
            String(row[grossSalesHeader]).replace(/[฿$thbTHB,\s]/g, ""),
          );
          if (!isNaN(num)) {
            grossSales += num;
            sheetGrossSales += num;
          }
        } else if (
          unitPriceHeader &&
          row[unitPriceHeader] !== undefined &&
          row[unitPriceHeader] !== null
        ) {
          const num = Number(
            String(row[unitPriceHeader]).replace(/[฿$thbTHB,\s]/g, ""),
          );
          if (!isNaN(num)) {
            const lineTotal = num * rowQty;
            grossSales += lineTotal;
            sheetGrossSales += lineTotal;
          }
        }

        feeHeaders.forEach((fh) => {
          const rawVal = row[fh];
          if (rawVal !== undefined && rawVal !== null && rawVal !== "") {
            const num = Number(String(rawVal).replace(/[฿$thbTHB,\s]/g, ""));
            if (!isNaN(num) && num !== 0) {
              const absVal = Math.abs(num);
              platformFees += absVal;
              sheetFees += absVal;
              feeMap[fh] = (feeMap[fh] || 0) + absVal;
            }
          }
        });

        if (
          shippingHeader &&
          row[shippingHeader] !== undefined &&
          row[shippingHeader] !== null
        ) {
          const num = Number(
            String(row[shippingHeader]).replace(/[฿$thbTHB,\s]/g, ""),
          );
          if (!isNaN(num) && num !== 0) {
            shippingFees += Math.abs(num);
          }
        }

        if (
          discountHeader &&
          row[discountHeader] !== undefined &&
          row[discountHeader] !== null
        ) {
          const num = Number(
            String(row[discountHeader]).replace(/[฿$thbTHB,\s]/g, ""),
          );
          if (!isNaN(num) && num !== 0) {
            discounts += Math.abs(num);
          }
        }
      }

      // Top Products in file
      if (productHeader && row[productHeader]) {
        const pName = String(row[productHeader]).trim();
        if (pName && pName !== "-" && pName.toLowerCase() !== "null") {
          let lineAmt = 0;
          if (unitPriceHeader && row[unitPriceHeader]) {
            lineAmt =
              (Number(
                String(row[unitPriceHeader]).replace(/[฿$thbTHB,\s]/g, ""),
              ) || 0) * rowQty;
          } else if (grossSalesHeader && row[grossSalesHeader]) {
            lineAmt =
              Number(
                String(row[grossSalesHeader]).replace(/[฿$thbTHB,\s]/g, ""),
              ) || 0;
          } else if (netIncomeHeader && row[netIncomeHeader]) {
            lineAmt =
              Number(
                String(row[netIncomeHeader]).replace(/[฿$thbTHB,\s]/g, ""),
              ) || 0;
          }
          if (!productMap[pName])
            productMap[pName] = { quantity: 0, amount: 0 };
          productMap[pName].quantity += rowQty;
          productMap[pName].amount += lineAmt;
        }
      }

      // Top Brands in file
      if (brandHeader && row[brandHeader]) {
        const bName = String(row[brandHeader]).trim();
        if (bName && bName !== "-" && bName.toLowerCase() !== "null") {
          let lineAmt = 0;
          if (grossSalesHeader && row[grossSalesHeader]) {
            lineAmt =
              Number(
                String(row[grossSalesHeader]).replace(/[฿$thbTHB,\s]/g, ""),
              ) || 0;
          } else if (netIncomeHeader && row[netIncomeHeader]) {
            lineAmt =
              Number(
                String(row[netIncomeHeader]).replace(/[฿$thbTHB,\s]/g, ""),
              ) || 0;
          }
          if (!brandMap[bName]) brandMap[bName] = { quantity: 0, amount: 0 };
          brandMap[bName].quantity += rowQty;
          brandMap[bName].amount += lineAmt;
        }
      }
    });

    sheetBreakdown.push({
      name: sheet.name,
      rows: sheetRowsCount,
      netIncome: sheetNetIncome,
      grossSales: sheetGrossSales,
      platformFees: sheetFees,
    });
  });

  // Reconcile
  if (type === "income" || type === "order") {
    if (netIncome === 0 && grossSales > 0) {
      netIncome = Math.max(0, grossSales - platformFees - shippingFees);
    }
    if (grossSales === 0 && netIncome > 0) {
      grossSales = netIncome + platformFees;
    }
  }

  // Parse min and max dates
  let minDate: string | null = null;
  let maxDate: string | null = null;
  if (dates.length > 0) {
    const cleanDates = dates
      .map((d) => d.split(" ")[0].split("T")[0])
      .filter((d) => d.length >= 8)
      .sort();
    if (cleanDates.length > 0) {
      minDate = cleanDates[0];
      maxDate = cleanDates[cleanDates.length - 1];
    }
  }

  const feeColors = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
  ];
  const feeBreakdown = Object.entries(feeMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount], idx) => ({
      name,
      amount,
      percentage:
        platformFees > 0 ? Math.round((amount / platformFees) * 100) : 0,
      color: feeColors[idx % feeColors.length],
    }));

  const topProducts = Object.entries(productMap)
    .sort((a, b) => b[1].amount - a[1].amount || b[1].quantity - a[1].quantity)
    .slice(0, 5)
    .map(([name, val]) => ({
      name,
      quantity: val.quantity,
      amount: val.amount,
    }));

  const topBrands = Object.entries(brandMap)
    .sort((a, b) => b[1].amount - a[1].amount || b[1].quantity - a[1].quantity)
    .slice(0, 5)
    .map(([name, val]) => ({
      name,
      quantity: val.quantity,
      amount: val.amount,
    }));

  return {
    netIncome,
    grossSales,
    platformFees,
    shippingFees,
    discounts,
    totalRows,
    uniqueOrders: orderIdSet.size > 0 ? orderIdSet.size : totalRows,
    totalQuantity,
    minDate,
    maxDate,
    feeBreakdown,
    sheetBreakdown,
    topProducts,
    topBrands,
  };
};

const DatasetViewerComponent: React.FC<DatasetViewerProps> = ({
  datasets,
  type,
  isDarkMode,
  onDeleteDataset,
  onImportDataset,
  requestConfirm,
  hideKpis = false,
  onImportOrders,
  triggerAlert,
  canUpload = false,
  channelFilter,
  setChannelFilter,
}) => {
  const [activePlatform, setActivePlatform] = useState<
    "all" | "lazada" | "shopee" | "tiktok" | "facebook" | "line"
  >("all");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  React.useEffect(() => {
    if (channelFilter) {
      let clean = channelFilter.toLowerCase().trim();
      if (clean.includes("tiktok")) clean = "tiktok";
      else if (clean.includes("lazada")) clean = "lazada";
      else if (clean.includes("shopee")) clean = "shopee";
      else if (clean.includes("facebook") || clean.includes("fb"))
        clean = "facebook";
      else if (clean.includes("line")) clean = "line";

      if (["lazada", "shopee", "tiktok", "facebook", "line"].includes(clean)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActivePlatform(
          clean as "lazada" | "shopee" | "tiktok" | "facebook" | "line",
        );
        setSelectedFileId(null);
      } else {
        setActivePlatform("all");
        setSelectedFileId(null);
      }
    }
  }, [channelFilter]);

  const [activeSheetName, setActiveSheetName] = useState<
    Record<string, string>
  >({}); // fileId -> sheetName

  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processUploadedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      await processUploadedFiles(Array.from(e.target.files));
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 15));

  const processUploadedFiles = async (inputFiles: File[]) => {
    if (!inputFiles.length) return;
    
    // Sort batch files chronologically (Month 1 -> 12)
    const files = [...inputFiles].sort((a, b) => compareFileNamesChronologically(a.name, b.name));

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress({ current: 0, total: files.length, fileName: files[0].name });

    const collectedOrders: Order[] = [];
    const collectedDatasets: UploadedDataset[] = [];
    const errors: string[] = [];
    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const monthInfo = extractMonthFromFileName(file.name);
        const prefix = monthInfo ? `[${monthInfo.monthLabel}] ` : "";
        setUploadProgress({ current: i + 1, total: files.length, fileName: `${prefix}${file.name}` });
        // Yield to let browser render UI smoothly and avoid freezing
        await yieldToMain();

        try {
          const validation = validateUploadedFile(file);
          if (!validation.valid) {
            throw new Error(validation.error || "ไฟล์ไม่ผ่านการตรวจสอบความปลอดภัย");
          }

          const dataset = await parseExcelFile(file);
          const expectedType = type === "income" ? "income" : "order";
          const parsedType = dataset.type || dataset.fileType || "order";

          if (parsedType !== expectedType && triggerAlert && files.length === 1) {
            const parsedLabel =
              parsedType === "income" ? "รายรับ (Income)" : "คำสั่งซื้อ (Orders)";
            const expectedLabel =
              expectedType === "income" ? "รายรับ (Income)" : "คำสั่งซื้อ (Orders)";

            triggerAlert(
              `ไฟล์ที่อัปโหลดคือประเภท ${parsedLabel} ซึ่งกำลังเปิดอยู่ในหน้า ${expectedLabel} ระบบจะบันทึกประเภทไฟล์ให้ถูกต้อง`,
              "info",
            );
          }

          const orders = convertDatasetToOrders(dataset);
          if (orders.length === 0) {
            throw new Error(`ไฟล์ "${file.name}" ไม่พบรายการข้อมูลคำสั่งซื้อหรือรายรับ`);
          }

          collectedOrders.push(...orders);
          collectedDatasets.push(dataset);
          successCount++;
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : `ประมวลผลไฟล์ "${file.name}" ล้มเหลว`;
          errors.push(errMsg);
        }
      }

      if (collectedOrders.length > 0 && onImportOrders) {
        onImportOrders(collectedOrders, collectedDatasets);
        if (triggerAlert) {
          if (files.length === 1) {
            triggerAlert(
              `นำเข้าไฟล์ "${files[0].name}" จำนวน ${collectedOrders.length} แถว สำเร็จ!`,
              "success",
            );
          } else if (files.length >= 12) {
            triggerAlert(
              `นำเข้าสำเร็จครบถ้วน ${successCount} จาก ${files.length} ไฟล์ (ครอบคลุมทั้ง 12 เดือน / ${collectedOrders.length} แถว)`,
              "success",
            );
          } else {
            triggerAlert(
              `นำเข้าสำเร็จ ${successCount} จาก ${files.length} ไฟล์ (รวม ${collectedOrders.length} แถว)`,
              "success",
            );
          }
        }
      } else if (errors.length > 0 && !collectedOrders.length) {
        throw new Error(errors[0]);
      }

      if (errors.length > 0 && triggerAlert && files.length > 1) {
        triggerAlert(`มีข้อผิดพลาดบางไฟล์: ${errors.join(", ")}`, "warning");
      }
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการประมวลผลไฟล์";
      setUploadError(errMsg);
      if (triggerAlert) {
        triggerAlert(errMsg, "error");
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 1. Filter datasets by type and platform (WITHOUT search query)
  const platformDatasets = useMemo(() => {
    const typeFiltered = datasets.filter((d) => {
      if (type === "product") {
        return d.fileType === "product" || (d.type as string) === "product" || d.kind === "products";
      }
      if (type === "income") {
        return d.fileType === "income" || (d.type as string) === "income" || d.kind === "income";
      }
      return d.fileType !== "product" && (d.type as string) !== "product" && d.fileType !== "income" && (d.type as string) !== "income";
    });
    if (activePlatform === "all") return typeFiltered;
    return typeFiltered.filter((d) => {
      const p = resolveDatasetPlatform(d);
      return p === activePlatform.toLowerCase();
    });
  }, [datasets, type, activePlatform]);

  // 2. Platform datasets list
  const filteredDatasets = platformDatasets;

  // Map of detailed stats for each dataset
  const datasetStatsMap = useMemo(() => {
    const map = new Map<string, FileDetailedStats>();
    datasets.forEach((d) => {
      map.set(d.id, computeDatasetStats(d, type));
    });
    return map;
  }, [datasets, type]);

  // Set default selected file if none selected
  const activeFileId = useMemo(() => {
    if (filteredDatasets.length === 0) return null;
    if (
      selectedFileId &&
      filteredDatasets.some((d) => d.id === selectedFileId)
    ) {
      return selectedFileId;
    }
    return filteredDatasets[0].id;
  }, [filteredDatasets, selectedFileId]);

  const activeFile = useMemo(() => {
    return filteredDatasets.find((d) => d.id === activeFileId) || null;
  }, [filteredDatasets, activeFileId]);

  // Stats specifically for the selected active file
  const activeFileStats = useMemo(() => {
    if (!activeFile) return null;
    return (
      datasetStatsMap.get(activeFile.id) ||
      computeDatasetStats(activeFile, type)
    );
  }, [activeFile, datasetStatsMap, type]);

  // Helper to extract visible/valid sheet data
  const validSheets = useMemo(() => {
    if (!activeFile || !activeFile.sheets) return [];
    const nonSystemSheets = activeFile.sheets.filter((s) => {
      return (
        !s.name.startsWith("_") &&
        !s.name.startsWith(".") &&
        s.rows &&
        s.rows.length > 0
      );
    });
    if (nonSystemSheets.length === 0) return activeFile.sheets;

    // Prioritize main order/income sheets first, while keeping all sheets accessible
    return [...nonSystemSheets].sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const isDocA = [
        "summary",
        "รายงาน",
        "บันทึกการถอน",
        "คำอธิบายค่าธรรมเนียม",
        "คำอธิบาย",
        "glossary",
        "withdraw",
        "withdrawal",
        "instruction",
        "คู่มือ",
        "overview",
        "readme",
        "template",
        "settings",
        "config",
      ].some((kw) => aName.includes(kw));
      const isDocB = [
        "summary",
        "รายงาน",
        "บันทึกการถอน",
        "คำอธิบายค่าธรรมเนียม",
        "คำอธิบาย",
        "glossary",
        "withdraw",
        "withdrawal",
        "instruction",
        "คู่มือ",
        "overview",
        "readme",
        "template",
        "settings",
        "config",
      ].some((kw) => bName.includes(kw));
      if (isDocA && !isDocB) return 1;
      if (!isDocA && isDocB) return -1;
      return 0;
    });
  }, [activeFile]);

  const activeSheet = useMemo(() => {
    if (!activeFile) return null;
    const sheetName =
      activeSheetName[activeFile.id] ||
      validSheets[0]?.name ||
      activeFile.sheets[0]?.name;
    return (
      validSheets.find((s) => s.name === sheetName) ||
      validSheets[0] ||
      activeFile.sheets[0]
    );
  }, [activeFile, validSheets, activeSheetName]);

  // Handle deleting active dataset safely
  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const performDelete = () => {
      onDeleteDataset(id);
      if (selectedFileId === id) {
        setSelectedFileId(null);
      }
    };

    if (requestConfirm) {
      requestConfirm(
        "ยืนยันการลบไฟล์ข้อมูล",
        "คุณต้องการลบไฟล์นี้ออกจากระบบใช่หรือไม่? ข้อมูลคำสั่งซื้อและสต็อกสินค้าที่เกี่ยวข้องจะถูกปรับปรุงกลับคืน",
        performDelete,
        "ลบไฟล์ข้อมูล",
        "ยกเลิก",
        "trash",
      );
    } else {
      if (confirm("คุณต้องการลบไฟล์นี้ออกจากระบบใช่หรือไม่?")) {
        performDelete();
      }
    }
  };

  // Export current active file to Excel
  const handleExportActiveFile = () => {
    if (!activeFile || !activeSheet) return;
    try {
      const ws = XLSX.utils.json_to_sheet(activeSheet.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeSheet.name || "Sheet1");
      XLSX.writeFile(
        wb,
        `${activeFile.fileName.replace(/\.[^/.]+$/, "")}_export.xlsx`,
      );
      if (triggerAlert) {
        triggerAlert(`ส่งออกไฟล์ "${activeFile.fileName}" สำเร็จ`, "success");
      }
    } catch {
      if (triggerAlert) {
        triggerAlert("เกิดข้อผิดพลาดในการส่งออกไฟล์", "error");
      }
    }
  };

  // Aggregated dynamic KPIs across all datasets in this view (filtered by selected platform)
  const kpis = useMemo(() => {
    const relevantDatasets = platformDatasets;

    const totalFiles = relevantDatasets.length;
    let totalRows = 0;
    let totalIncomeVal = 0;
    let totalSalesVal = 0;
    let totalFeesVal = 0;

    relevantDatasets.forEach((d) => {
      const stats = datasetStatsMap.get(d.id) || computeDatasetStats(d, type);
      totalRows += stats.totalRows;
      totalIncomeVal += stats.netIncome;
      totalSalesVal += stats.grossSales;
      totalFeesVal += stats.platformFees;
    });

    return {
      totalFiles,
      totalRows,
      totalIncome: totalIncomeVal,
      totalSales: totalSalesVal,
      totalFees: totalFeesVal,
    };
  }, [platformDatasets, datasetStatsMap, type]);

  // Calculate file counts for each platform dynamically based on type
  const fileCounts = useMemo(() => {
    const typeFiltered = datasets.filter((d) => {
      if (type === "product") {
        return d.fileType === "product" || (d.type as string) === "product" || d.kind === "products";
      }
      if (type === "income") {
        return d.fileType === "income" || (d.type as string) === "income" || d.kind === "income";
      }
      return d.fileType !== "product" && (d.type as string) !== "product" && d.fileType !== "income" && (d.type as string) !== "income";
    });
    const counts: Record<string, number> = {
      all: typeFiltered.length,
      lazada: 0,
      shopee: 0,
      tiktok: 0,
      facebook: 0,
      line: 0,
    };
    typeFiltered.forEach((d) => {
      const plat = resolveDatasetPlatform(d);
      if (counts[plat] !== undefined) {
        counts[plat]++;
      }
    });
    return counts;
  }, [datasets, type]);

  const platformTabs = useMemo(() => {
    const base = [
      {
        id: "all" as const,
        label: "ทุกแพลตฟอร์ม",
        color: type === "income" ? "bg-emerald-500" : "bg-blue-500",
      },
      { id: "lazada" as const, label: "Lazada", color: "bg-[#2E2BB8]" },
      { id: "shopee" as const, label: "Shopee", color: "bg-[#EE4D2D]" },
      { id: "tiktok" as const, label: "TikTok Shop", color: "bg-[#FE2C55]" },
    ];

    if (type !== "product") {
      return [
        ...base,
        { id: "facebook" as const, label: "Facebook", color: "bg-[#1877F2]" },
        { id: "line" as const, label: "LINE OA", color: "bg-[#06C755]" },
      ];
    }

    return base;
  }, [type]);

  const activeColor = activeFile
    ? getPlatformMeta(activeFile.platform).brandColor
    : type === "income"
      ? "#10b981"
      : "#3b82f6";

  // Dynamic displayed KPIs: If a specific file is selected, show that file's stats; otherwise show grand totals
  const displayedKpis = useMemo(() => {
    if (activeFile && activeFileStats) {
      return {
        isSingleFile: true,
        fileName: activeFile.fileName,
        platform: activeFile.platform,
        totalFiles: 1,
        totalRows: activeFileStats.totalRows,
        uniqueOrders: activeFileStats.uniqueOrders,
        totalIncome: activeFileStats.netIncome,
        totalSales: activeFileStats.grossSales,
        totalFees: activeFileStats.platformFees,
      };
    }
    return {
      isSingleFile: false,
      fileName: null,
      platform: null,
      totalFiles: kpis.totalFiles,
      totalRows: kpis.totalRows,
      uniqueOrders: kpis.totalRows,
      totalIncome: kpis.totalIncome,
      totalSales: kpis.totalSales,
      totalFees: kpis.totalFees,
    };
  }, [activeFile, activeFileStats, kpis]);

  return (
    <div className="space-y-6 animate-fade-in relative z-10">
      {/* 1. Page Header Summary KPIs (Dynamic per Selected File or Overall) */}
      {!hideKpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 md:gap-5">
          {/* KPI 1: Total Files / Selected File Name */}
          <div
            className={`group relative overflow-hidden rounded-2xl border-2 p-4.5 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
              isDarkMode
                ? "bg-gradient-to-br from-blue-950/30 via-neutral-900/90 to-sky-950/20 border-blue-500/50 hover:border-blue-400"
                : "bg-gradient-to-br from-blue-50/60 via-blue-50/20 to-sky-50/40 border-blue-300 hover:border-blue-400 hover:shadow-[0_8px_25px_rgba(59,130,246,0.08)]"
            }`}
          >
            {/* Ambient hover glow */}
            <div className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-blue-500/10 blur-2xl group-hover:bg-blue-500/20 transition-all duration-500" />
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1.5 min-w-0 flex-1 pr-2">
                <span className="text-xs font-bold tracking-tight text-neutral-600 dark:text-neutral-300 block truncate">
                  {displayedKpis.isSingleFile
                    ? "ไฟล์ที่กำลังแสดงยอด"
                    : "จำนวนไฟล์นำเข้าทั้งหมด"}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-2xl sm:text-3xl font-black tracking-tight text-blue-600 dark:text-blue-400 truncate block max-w-[170px] font-mono"
                    title={
                      displayedKpis.isSingleFile
                        ? activeFile?.fileName || ""
                        : undefined
                    }
                  >
                    {displayedKpis.isSingleFile
                      ? activeFile?.fileName
                      : displayedKpis.totalFiles}
                  </span>
                  {!displayedKpis.isSingleFile && (
                    <span className="text-xs sm:text-sm font-bold text-neutral-400 dark:text-neutral-500">
                      ไฟล์
                    </span>
                  )}
                </div>
                {displayedKpis.isSingleFile && (
                  <button
                    onClick={() => setSelectedFileId(null)}
                    className="text-[11px] text-blue-500 hover:text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer flex items-center gap-1 mt-0.5 group-hover:translate-x-0.5 transition-transform"
                  >
                    ← ดูยอดรวมทุกไฟล์ ({kpis.totalFiles} ไฟล์)
                  </button>
                )}
              </div>
              <div className="p-3 rounded-2xl border shrink-0 transition-all duration-300 group-hover:scale-105 bg-blue-100/80 text-blue-600 border-blue-300/80 dark:bg-blue-900/50 dark:text-blue-400 dark:border-blue-700/60 shadow-xs">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* KPI 2: Total Rows */}
          <div
            className={`group relative overflow-hidden rounded-2xl border-2 p-4.5 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
              isDarkMode
                ? "bg-gradient-to-br from-teal-950/30 via-neutral-900/90 to-emerald-950/20 border-teal-500/50 hover:border-teal-400"
                : "bg-gradient-to-br from-teal-50/60 via-teal-50/20 to-emerald-50/40 border-teal-300 hover:border-teal-400 hover:shadow-[0_8px_25px_rgba(20,184,166,0.08)]"
            }`}
          >
            {/* Ambient hover glow */}
            <div className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-teal-500/10 blur-2xl group-hover:bg-teal-500/20 transition-all duration-500" />
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-teal-400 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1.5">
                <span className="text-xs font-bold tracking-tight text-neutral-600 dark:text-neutral-300 block">
                  {displayedKpis.isSingleFile
                    ? "จำนวนรายการในไฟล์นี้"
                    : "จำนวนรายการข้อมูลรวม"}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black tracking-tight text-teal-600 dark:text-teal-400 font-mono">
                    {displayedKpis.totalRows.toLocaleString()}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-neutral-400 dark:text-neutral-500">
                    แถว{" "}
                    {displayedKpis.isSingleFile &&
                      `(${displayedKpis.uniqueOrders} รายการ)`}
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-2xl border shrink-0 transition-all duration-300 group-hover:scale-105 bg-teal-100/80 text-teal-600 border-teal-300/80 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-700/60 shadow-xs">
                <Database className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* KPI 3: Sales/Income/Stock (Highlighted Card with Mint Glow & Border) */}
          <div
            className={`group relative overflow-hidden rounded-2xl border-2 p-4.5 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
              isDarkMode
                ? "bg-gradient-to-br from-emerald-950/30 via-neutral-900/90 to-teal-950/20 border-emerald-500/50 hover:border-emerald-400"
                : "bg-gradient-to-br from-emerald-50/60 via-emerald-50/20 to-teal-50/40 border-emerald-300 hover:border-emerald-400 hover:shadow-[0_8px_25px_rgba(16,185,129,0.08)]"
            }`}
          >
            {/* Ambient hover glow */}
            <div className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-emerald-500/10 blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500" />
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1.5">
                <span className="text-xs font-bold tracking-tight text-neutral-600 dark:text-neutral-300 block">
                  {type === "income"
                    ? displayedKpis.isSingleFile
                      ? "ยอดโอนสุทธิในไฟล์นี้ (NET INCOME)"
                      : "ยอดโอนเข้าบัญชีรวม (NET INCOME)"
                    : type === "product"
                      ? "ยอดรวมราคาขายสินค้า"
                      : displayedKpis.isSingleFile
                        ? "ยอดขายในไฟล์นี้ (GROSS SALES)"
                        : "ยอดขายสะสมรวม (GROSS SALES)"}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg text-emerald-600 dark:text-emerald-400 font-extrabold font-mono">
                    ฿
                  </span>
                  <span className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
                    {(type === "income"
                      ? displayedKpis.totalIncome
                      : displayedKpis.totalSales
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-2xl border shrink-0 transition-all duration-300 group-hover:scale-105 bg-emerald-100/80 text-emerald-600 border-emerald-300/80 dark:bg-emerald-900/50 dark:text-emerald-400 dark:border-emerald-700/60 shadow-xs">
                <Coins className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* KPI 4: Platform Fees / Product Stocks */}
          <div
            className={`group relative overflow-hidden rounded-2xl border-2 p-4.5 sm:p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
              isDarkMode
                ? "bg-gradient-to-br from-rose-950/30 via-neutral-900/90 to-orange-950/20 border-rose-500/50 hover:border-rose-400"
                : "bg-gradient-to-br from-rose-50/60 via-rose-50/20 to-orange-50/40 border-rose-300 hover:border-rose-400 hover:shadow-[0_8px_25px_rgba(244,63,94,0.08)]"
            }`}
          >
            {/* Ambient hover glow */}
            <div className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-rose-500/10 blur-2xl group-hover:bg-rose-500/20 transition-all duration-500" />
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-rose-400 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1.5">
                <span className="text-xs font-bold tracking-tight text-neutral-600 dark:text-neutral-300 block">
                  {type === "product"
                    ? "จำนวนสินค้าคงเหลือรวม"
                    : displayedKpis.isSingleFile
                      ? "ค่าธรรมเนียมในไฟล์นี้"
                      : "ยอดค่าธรรมเนียม / ค่าบริการสะสม"}
                </span>
                <div className="flex items-baseline gap-1">
                  {type !== "product" && (
                    <span className="text-base sm:text-lg text-rose-600 dark:text-rose-400 font-extrabold font-mono">
                      ฿
                    </span>
                  )}
                  <span className="text-2xl sm:text-3xl font-black tracking-tight text-rose-600 dark:text-rose-400 font-mono">
                    {type === "product"
                      ? displayedKpis.totalFees.toLocaleString()
                      : displayedKpis.totalFees.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                  </span>
                  {type === "product" && (
                    <span className="text-xs sm:text-sm font-bold text-neutral-400 dark:text-neutral-500 ml-1">
                      ชิ้น
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-2xl border shrink-0 transition-all duration-300 group-hover:scale-105 bg-rose-100/80 text-rose-600 border-rose-300/80 dark:bg-rose-900/50 dark:text-rose-400 dark:border-rose-700/60 shadow-xs">
                <Package className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Platform Filter Tabs */}
      <div
        className={`flex overflow-x-auto no-scrollbar touch-scroll p-1 rounded-2xl gap-1.5 border min-w-0 w-full ${
          isDarkMode
            ? "bg-[#141414]/40 border-white/[0.06]"
            : "bg-neutral-50 border-neutral-200/80 shadow-inner"
        }`}
      >
        {platformTabs.map((p) => {
          const isActive = activePlatform === p.id;
          const count = fileCounts[p.id] || 0;

          let activeStyles = "";
          if (isActive) {
            if (p.id === "lazada")
              activeStyles =
                "bg-[#2E2BB8] text-white shadow-lg shadow-blue-900/20 scale-[1.02]";
            else if (p.id === "shopee")
              activeStyles =
                "bg-[#EE4D2D] text-white shadow-lg shadow-orange-950/20 scale-[1.02]";
            else if (p.id === "tiktok")
              activeStyles =
                "bg-[#FE2C55] text-white shadow-lg shadow-pink-900/20 scale-[1.02]";
            else if (p.id === "facebook")
              activeStyles =
                "bg-[#1877F2] text-white shadow-lg shadow-sky-900/20 scale-[1.02]";
            else if (p.id === "line")
              activeStyles =
                "bg-[#06C755] text-white shadow-lg shadow-emerald-900/20 scale-[1.02]";
            else
              activeStyles =
                type === "income"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 border border-emerald-500/20 scale-[1.02]"
                  : isDarkMode
                    ? "bg-neutral-800 text-white shadow-lg border border-white/10 scale-[1.02]"
                    : "bg-white text-black shadow-md border border-black/5 scale-[1.02]";
          }

          return (
            <button
              key={p.id}
              onClick={() => {
                setActivePlatform(p.id);
                setSelectedFileId(null);
                if (setChannelFilter) {
                  let mapped = "All";
                  if (p.id === "lazada") mapped = "Lazada";
                  else if (p.id === "shopee") mapped = "Shopee";
                  else if (p.id === "tiktok") mapped = "TikTok Shop";
                  else if (p.id === "facebook") mapped = "Facebook";
                  else if (p.id === "line") mapped = "LINE OA";
                  setChannelFilter(mapped);
                }
              }}
              className={`shrink-0 whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-black transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                isActive
                  ? activeStyles
                  : "bg-transparent text-neutral-450 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/40"
              }`}
            >
              {p.id !== "all" && !isActive && (
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.color} border border-white/10`}
                />
              )}
              <span>{p.label}</span>
              <span
                className={`ml-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Inline Upload Dropzone Card */}
      {canUpload && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
          className={`relative p-7 text-center border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300 group select-none ${
            dragActive
              ? isDarkMode
                ? "border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[0.995]"
                : "border-blue-500 bg-blue-50/50 shadow-[0_0_20px_rgba(59,130,246,0.08)] scale-[0.995]"
              : isDarkMode
                ? "border-white/10 bg-[#161616]/40 hover:border-white/20 hover:bg-[#1c1c1c]/50 hover:shadow-lg"
                : "border-black/10 bg-neutral-50/50 hover:border-black/20 hover:bg-neutral-100/50 hover:shadow-md"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".xlsx,.xls,.csv"
            onChange={handleChange}
            multiple
          />

          <div className="flex flex-col items-center justify-center space-y-2.5">
            <div
              className={`p-3.5 rounded-2xl transition-all duration-300 ${
                dragActive
                  ? "bg-blue-500 text-white scale-110 shadow-lg shadow-blue-500/25"
                  : isDarkMode
                    ? "bg-white/5 text-neutral-400 group-hover:bg-white/10 group-hover:text-white"
                    : "bg-black/5 text-neutral-500 group-hover:bg-black/10 group-hover:text-black"
              }`}
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
            </div>

            <div className="space-y-0.5 max-w-md mx-auto">
              <h3 className="text-xs font-black text-apple-primary">
                {uploadProgress ? (
                  <span>
                    กำลังประมวลผลไฟล์ ({uploadProgress.current}/{uploadProgress.total}):{" "}
                    <span className="text-blue-500 font-semibold truncate max-w-[200px] inline-block align-bottom">{uploadProgress.fileName}</span>
                  </span>
                ) : isUploading ? (
                  "กำลังประมวลผลข้อมูล..."
                ) : (
                  "ลากและวางไฟล์รายงานร้านค้าที่นี่ หรือ คลิกเพื่อเลือกหลายไฟล์พร้อมกัน (รองรับ 12+ ไฟล์ เช่น สรุปรายเดือน 12 เดือน)"
                )}
              </h3>
              {uploadProgress ? (
                <div className="w-full mt-2">
                  <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-200 rounded-full"
                      style={{
                        width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-apple-secondary mt-1">
                    {Math.round((uploadProgress.current / uploadProgress.total) * 100)}% เสร็จสิ้น
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-apple-secondary">
                  รองรับรายงาน Lazada, Shopee, TikTok Shop, Facebook, LINE OA
                  (.xlsx, .xls, .csv) ทั้งออเดอร์และรายรับ อัปโหลดได้ไม่จำกัดจำนวนไฟล์พร้อมกัน
                </p>
              )}
            </div>
          </div>

          {uploadError && (
            <div className="mt-2 text-center">
              <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-lg">
                {uploadError}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 3. Empty State or Datasets List */}
      {platformDatasets.length === 0 ? (
        <div
          className={`p-12 text-center border-2 border-dashed rounded-3xl ${
            isDarkMode
              ? "border-white/5 bg-white/[0.01]"
              : "border-black/5 bg-apple-tertiary/10"
          }`}
        >
          <AlertCircle className="h-10 w-10 text-apple-secondary mx-auto mb-3" />
          <h3 className="text-sm font-black text-apple-primary">
            ไม่มีไฟล์ข้อมูลนำเข้า
          </h3>
          <p className="text-xs text-apple-secondary mt-1 max-w-sm mx-auto leading-relaxed">
            ยังไม่พบข้อมูล{" "}
            {type === "income"
              ? "รายรับ (Income)"
              : type === "product"
                ? "สินค้า (Product)"
                : "คำสั่งซื้อ (Order)"}{" "}
            สำหรับช่องทางนี้ กรุณาไปที่หน้าอัปโหลดไฟล์เพื่อนำเข้าข้อมูล
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* File selector top grid */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                เลือกไฟล์
                {type === "income"
                  ? "รายรับ"
                  : type === "product"
                    ? "สินค้า"
                    : "คำสั่งซื้อ"}
                เพื่อดูรายละเอียดยอด ({filteredDatasets.length})
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
                คลิกเพื่อดูสรุปยอดรายไฟล์
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {filteredDatasets.map((d) => {
                const isActive = activeFileId === d.id;
                const platformMeta = getPlatformMeta(resolveDatasetPlatform(d));
                const fileStats =
                  datasetStatsMap.get(d.id) || computeDatasetStats(d, type);

                const rowCount = fileStats.totalRows;
                const densityPct = Math.min(
                  100,
                  Math.max(10, (rowCount / 1000) * 100),
                );

                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedFileId(d.id)}
                    className={`group relative overflow-hidden p-4 rounded-2xl border text-left cursor-pointer transition-all duration-300 flex flex-col justify-between gap-3 select-none ${
                      isActive
                        ? isDarkMode
                          ? "border-blue-500/50 bg-blue-500/[0.07] shadow-lg shadow-blue-950/30 scale-[1.01]"
                          : "border-blue-500/50 bg-blue-50/50 shadow-md shadow-blue-500/10 scale-[1.01]"
                        : isDarkMode
                          ? "bg-neutral-900/40 border-white/[0.05] hover:bg-neutral-850/60 hover:border-white/10 hover:-translate-y-0.5"
                          : "bg-white border-neutral-200/80 hover:bg-neutral-50/80 hover:border-neutral-300 hover:-translate-y-0.5"
                    }`}
                    style={
                      isActive
                        ? {
                            borderColor: `${platformMeta.brandColor}60`,
                            boxShadow: `0 8px 24px -8px ${platformMeta.brandColor}25`,
                          }
                        : {}
                    }
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-3 bottom-3 w-1.5 rounded-r-md transition-all duration-300"
                        style={{
                          backgroundColor: platformMeta.brandColor,
                          boxShadow: `0 0 10px ${platformMeta.brandColor}`,
                        }}
                      />
                    )}

                    <div className="space-y-2.5">
                      {/* Card Top: Platform label & Actions */}
                      <div className="flex items-center justify-between w-full">
                        <span
                          className="text-[9px] font-extrabold px-2 py-0.5 rounded-md text-white tracking-wider uppercase select-none shadow-xs"
                          style={{ backgroundColor: platformMeta.brandColor }}
                        >
                          {platformMeta.label}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {isActive ? (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              เลือกอยู่
                            </span>
                          ) : (
                            <span
                              className="w-2 h-2 rounded-full opacity-40"
                              style={{
                                backgroundColor: platformMeta.brandColor,
                              }}
                            />
                          )}

                          <button
                            onClick={(e) => handleDelete(d.id, e)}
                            className="text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                            title="ลบไฟล์ข้อมูล"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* File Name & Icon */}
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`p-2 rounded-xl shrink-0 ${platformMeta.bg} ${platformMeta.text} transition-all duration-300 border border-black/[0.03] dark:border-white/[0.03]`}
                        >
                          <FileSpreadsheet className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(() => {
                              const mInfo = extractMonthFromFileName(d.fileName);
                              if (mInfo) {
                                return (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                    📅 {mInfo.monthLabel}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            <h4
                              className={`text-xs font-bold truncate leading-tight flex-1 ${
                                isActive
                                  ? "text-neutral-900 dark:text-neutral-100 font-extrabold"
                                  : "text-neutral-700 dark:text-neutral-300"
                              }`}
                              title={d.fileName}
                            >
                              {d.fileName}
                            </h4>
                          </div>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium block mt-0.5">
                            อัปโหลด: {d.uploadedAt.split(" ")[0]}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Bottom Financial Metric Pill */}
                    <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-white/[0.04]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500">
                          {type === "income"
                            ? "ยอดโอนสุทธิ"
                            : type === "product"
                              ? "สต็อกสินค้า"
                              : "ยอดขายรวม"}
                        </span>
                        <span
                          className={`text-xs font-black font-mono ${
                            type === "income"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : type === "product"
                                ? "text-purple-600 dark:text-purple-400"
                                : "text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {type === "product"
                            ? `${fileStats.totalQuantity.toLocaleString()} ชิ้น`
                            : `฿${(type === "income"
                                ? fileStats.netIncome
                                : fileStats.grossSales
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">
                        <span>
                          {rowCount.toLocaleString()} แถว (
                          {fileStats.uniqueOrders.toLocaleString()} รายการ)
                        </span>
                        {fileStats.platformFees > 0 && (
                          <span className="text-rose-500 dark:text-rose-400 text-[9px] font-bold">
                            หักค่าธรรมเนียม ฿
                            {fileStats.platformFees.toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        )}
                      </div>

                      <div className="h-1 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${densityPct}%`,
                            backgroundColor: platformMeta.brandColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Selected File Detailed Breakdown Area */}
          <div className="space-y-5">
            {activeFile && activeSheet && activeFileStats && (
              <>
                {/* File summary details header - Clean Glassmorphic layout */}
                <div
                  className={`relative p-5 rounded-2xl border transition-all duration-300 overflow-hidden ${
                    isDarkMode
                      ? "bg-[#141414]/90 border-white/[0.06] shadow-xl shadow-black/40"
                      : "bg-white border-neutral-200/80 shadow-md shadow-neutral-100"
                  }`}
                  style={{
                    borderColor: `${activeColor}20`,
                  }}
                >
                  {/* Ambient backdrop glow */}
                  <div
                    className="absolute -right-24 -top-24 w-64 h-64 rounded-full blur-3xl opacity-15 transition-all duration-500 pointer-events-none"
                    style={{ backgroundColor: activeColor }}
                  />

                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className="text-[9px] font-extrabold tracking-wider px-2.5 py-1 rounded-md text-white uppercase select-none shadow-xs"
                          style={{
                            backgroundColor: getPlatformMeta(
                              activeFile.platform,
                            ).brandColor,
                          }}
                        >
                          {getPlatformMeta(activeFile.platform).label}
                        </span>
                        <h3 className="text-sm sm:text-base font-black text-neutral-850 dark:text-neutral-100 truncate max-w-xl">
                          {activeFile.fileName}
                        </h3>
                      </div>

                      {/* Meta chips */}
                      <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-bold text-neutral-450 dark:text-neutral-500">
                        <span className="flex items-center gap-1.5 bg-neutral-50 dark:bg-neutral-900/50 px-3 py-1.5 rounded-xl border border-black/[0.03] dark:border-white/[0.03]">
                          <Clock className="h-3.5 w-3.5 text-neutral-450" />
                          <span>
                            นำเข้าเมื่อ:{" "}
                            <span className="text-neutral-700 dark:text-neutral-300 font-extrabold">
                              {activeFile.uploadedAt}
                            </span>
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 bg-neutral-50 dark:bg-neutral-900/50 px-3 py-1.5 rounded-xl border border-black/[0.03] dark:border-white/[0.03]">
                          <Layers className="h-3.5 w-3.5 text-neutral-450" />
                          <span>
                            จำนวนเวิร์กชีท:{" "}
                            <span className="text-neutral-700 dark:text-neutral-300 font-extrabold">
                              {validSheets.length} เวิร์กชีท
                            </span>
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 bg-neutral-50 dark:bg-neutral-900/50 px-3 py-1.5 rounded-xl border border-black/[0.03] dark:border-white/[0.03]">
                          <Database className="h-3.5 w-3.5 text-neutral-450" />
                          <span>
                            ปริมาณข้อมูล:{" "}
                            <span className="text-emerald-600 dark:text-emerald-450 font-mono font-extrabold">
                              {activeSheet.rows.length.toLocaleString()} แถว
                            </span>
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0 border-t border-neutral-100 dark:border-white/[0.04] pt-4 lg:pt-0 lg:border-t-0">
                      <button
                        onClick={handleExportActiveFile}
                        className="btn-apple-secondary flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
                        title="ส่งออกชีตนี้เป็น Excel"
                      >
                        <Download className="h-3.5 w-3.5 text-neutral-500" />
                        <span>ส่งออกชีตนี้</span>
                      </button>

                      {onImportDataset && (
                        <button
                          onClick={() => onImportDataset(activeFile)}
                          className="px-4.5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-bold rounded-xl shadow-lg shadow-blue-500/10 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] border border-blue-500/20"
                        >
                          <Database className="h-3.5 w-3.5" />
                          <span>นำเข้าข้อมูลเข้าระบบหลัก</span>
                        </button>
                      )}

                      {/* Sheets tabs selection layout */}
                      {validSheets.length > 1 && (
                        <div className="flex bg-neutral-150 dark:bg-neutral-900/80 p-1 rounded-xl border border-neutral-250/20 dark:border-white/[0.04] gap-1 overflow-x-auto">
                          {validSheets.map((s) => {
                            const isSheetActive = activeSheet.name === s.name;
                            return (
                              <button
                                key={s.name}
                                onClick={() => {
                                  setActiveSheetName((prev) => ({
                                    ...prev,
                                    [activeFile.id]: s.name,
                                  }));
                                }}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold whitespace-nowrap cursor-pointer transition-all ${
                                  isSheetActive
                                    ? isDarkMode
                                      ? "bg-neutral-700 text-white shadow"
                                      : "bg-white text-black shadow-xs border border-neutral-200/20"
                                    : "bg-transparent text-neutral-450 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                                }`}
                              >
                                {s.name} ({s.rows.length})
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* The excel grid table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                      ตารางข้อมูลดิบจากชีท "{activeSheet.name}" (
                      {activeSheet.rows.length.toLocaleString()} แถว)
                    </span>
                  </div>
                  <ExcelTable
                    key={`${activeFile.id}_${activeSheet.name}`}
                    headers={activeSheet.headers}
                    rows={activeSheet.rows}
                    isDarkMode={isDarkMode}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const DatasetViewer = React.memo(DatasetViewerComponent);

