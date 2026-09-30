import React, { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  X,
  Trash2,
  Bell,
  Upload,
  AlertTriangle,
  Check,
  FileSpreadsheet,
  Download,
  TrendingUp,
  ShoppingCart,
  Info,
  Package,
  ChevronDown,
  Search,
  Image,
  Edit,
  Send,
  MessageSquare,
  ShieldAlert,
  Layers,
  UserCheck,
  Megaphone,
  Calendar,
  CalendarDays,
  RotateCcw,
  Filter,
  ArrowRight,
  Link,
  Lock,
  ShieldCheck,
} from "lucide-react";
import type {
  Product,
  Order,
  AppUser,
  AuditLog,
  UploadedDataset,
  SheetData,
  AppNotification,
  TrashItem,
} from "../types";
import { getNotificationVisualInfo } from "../utils";
import { DatePickerField } from "./DatePickerField";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { maskCustomerName, maskEmail, detectBrand } from "../utils";
import { repairWorksheetRange } from "../utils/fileParser";

// ==========================================
// 1. ADD PRODUCT MODAL
// ==========================================
interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    products: {
      name: string;
      category: Product["category"];
      brand: string;
      price: number;
      stock: number;
    }[],
  ) => void;
  isDarkMode: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  initialTab?: "manual" | "import";
  productFiles?: UploadedDataset[];
  onImportProductFiles?: (datasets: UploadedDataset[]) => void;
}

interface ParsedImportProduct {
  name: string;
  category: Product["category"];
  brand: string;
  price: number;
  stock: number;
  warnings: string | null;
  fileId?: string;
}

const NAME_BLACKLIST = [
  "คืน",
  "ผู้ใช้",
  "ผู้ซื้อ",
  "ผู้รับ",
  "ผู้ส่ง",
  "ลูกค้า",
  "buyer",
  "recipient",
  "customer",
  "user",
  "สถานะ",
  "status",
  "เหตุผล",
  "reason",
  "วันที่",
  "เวลา",
  "date",
  "time",
  "จัดส่ง",
  "ขนส่ง",
  "shipping",
  "tracking",
  "พัสดุ",
  "ช่องทาง",
  "channel",
  "คำสั่ง",
  "order",
  "ค่า",
  "fee",
  "ส่วนลด",
  "discount",
  "voucher",
  "คูปอง",
  "โบนัส",
  "coins",
  "เหรียญ",
];

const PRICE_BLACKLIST = [
  "order",
  "คำสั่ง",
  "หมายเลข",
  "เลขที่",
  "tracking",
  "พัสดุ",
  "phone",
  "โทร",
  "tel",
  "mobile",
  "zip",
  "ลำดับ",
  "no.",
  "date",
  "วันที่",
  "เวลา",
  "time",
  "statement",
  "รอบบิล",
  "ใบแจ้งยอด",
  "ระยะเวลา",
  "status",
  "สถานะ",
  "sku",
  "id",
  "code",
  "รหัส",
  "comment",
  "ความคิดเห็น",
  "บันทึก",
  "username",
  "ชื่อผู้ใช้",
  "ผู้ซื้อ",
  "ผู้รับ",
  "recipient",
  "address",
  "ที่อยู่",
  "ส่วนลด",
  "discount",
  "voucher",
  "คูปอง",
  "เหรียญ",
  "coin",
  "coins",
  "ค่าจัดส่ง",
  "shipping",
  "ค่าบริการ",
  "ค่าธรรมเนียม",
  "fee",
  "คอมมิชชั่น",
  "commission",
  "vat",
  "ภาษี",
  "wht",
  "คืน",
  "return",
  "refund",
  "โบนัส",
  "barcode",
  "บาร์โค้ด",
];

const STOCK_BLACKLIST = [
  "คืน",
  "return",
  "refund",
  "ยกเลิก",
  "cancel",
  "ลำดับ",
  "ที่",
  "no",
  "id",
  "รหัส",
  "code",
  "order",
  "item",
  "tracking",
  "พัสดุ",
  "phone",
  "โทร",
  "tel",
  "mobile",
  "sku",
  "barcode",
  "บาร์โค้ด",
  "บิล",
  "invoice",
  "tax",
  "เลข",
  "คำสั่ง",
  "transaction",
  "account",
  "statement",
  "orderitemid",
  "orderitemno",
  "parent",
  "date",
  "วันที่",
  "เวลา",
  "time",
  "status",
  "สถานะ",
  "ราคา",
  "price",
  "amount",
  "paid",
  "fee",
  "ค่า",
];

const KEY_MAPS_PRODUCT = {
  name: [
    "ชื่อสินค้า",
    "product name",
    "item name",
    "product_name",
    "itemname",
    "ชื่อรายการสินค้า",
    "ชื่อตัวเลือกสินค้า",
    "ชื่อตัวเลือก",
    "ชื่อสินค้าและตัวเลือก",
    "ชื่อรายละเอียดสินค้า",
    "ชื่อสินค้า/sku",
    "ชื่อสินค้า/รายละเอียดสินค้า",
    "รายละเอียดสินค้า",
    "ข้อมูลสินค้า",
    "product title",
    "item description",
    "variation name",
    "seller sku",
    "lazada sku",
    "parent sku",
    "reference sku",
    "เลขอ้างอิง sku",
    "เลขอ้างอิง parent sku",
    "sku",
    "รหัสสินค้า",
    "model",
    "รุ่น",
    "title",
    "แบบสินค้า",
    "สินค้า/บริการ",
    "ตัวเลือกสินค้า",
    "description",
    "product",
    "item",
    "สินค้า",
    "ชื่อ",
    "name",
  ],
  category: [
    "หมวดหมู่หลัก",
    "หมวดหมู่",
    "category",
    "กลุ่มสินค้า",
    "ประเภทสินค้า",
    "ประเภท",
    "product_category",
    "category_name",
    "department",
    "dept",
  ],
  brand: [
    "แบรนด์สินค้า",
    "แบรนด์",
    "brand",
    "ยี่ห้อ",
    "product_brand",
    "brand_name",
    "ผู้ผลิต",
  ],
  price: [
    "ราคาขายสุทธิ",
    "ราคาขาย",
    "ราคาตั้งต้น",
    "ราคาสินค้า",
    "ราคาต่อหน่วย",
    "ราคาต่อชิ้น",
    "ราคาขายต่อชิ้น",
    "ราคาหลังหักส่วนลด",
    "ราคาจำหน่าย",
    "ราคาตัวเลือก",
    "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)",
    "ราคาสินค้าที่ชำระโดยผู้ซื้อ",
    "sku subtotal after discount",
    "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย",
    "sku subtotal before discount",
    "sku subtotal",
    "ราคารวมย่อยของ sku",
    "ราคาต่อหน่วยของ sku",
    "ราคารวมย่อย",
    "sku unit original price",
    "sku unit price",
    "ยอดรวมค่าสินค้า",
    "unit price",
    "price_per_unit",
    "unitprice",
    "paid price",
    "paidprice",
    "deal price",
    "original price",
    "discounted price",
    "product_price",
    "ยอดชำระ(บาท)",
    "ยอดขาย",
    "ยอดขายรวม",
    "ราคารวม",
    "ราคารวมทั้งหมด",
    "ราคาสุทธิ",
    "ราคา",
    "price",
  ],
  stock: [
    "stock",
    "จำนวนสินค้าคงเหลือ",
    "คงเหลือ",
    "จำนวน",
    "จำนวนสต็อก",
    "สต็อก",
    "จำนวนสินค้า",
    "จำนวนคลัง",
    "คลัง",
    "จำนวนชิ้น",
    "จำนวนสินค้าที่ซื้อ",
    "stock_qty",
    "qty",
    "quantity",
    "amount",
    "qty sold",
    "quantity_sold",
  ],
};

const detectPlatform = (
  name: string,
  allHeaders: string[] = []
): "lazada" | "shopee" | "tiktok" | "facebook" | "line" | "unknown" => {
  const n = (name || "").toLowerCase();
  if (n.includes("lazada")) return "lazada";
  if (n.includes("shopee")) return "shopee";
  if (
    n.includes("tiktok") ||
    n.includes("tik_tok") ||
    n.includes("tt_") ||
    n.includes("tt-") ||
    n.includes("ติ๊กต๊อก") ||
    n.includes("ติ๊กตอก")
  )
    return "tiktok";
  if (
    n.includes("facebook") ||
    n.includes("page365") ||
    n.includes("fb_") ||
    n.includes("fb-") ||
    n.includes("fb ") ||
    n.includes("เฟส") ||
    n.includes("เฟซ")
  )
    return "facebook";
  if (
    n.includes("line") ||
    n.includes("line_") ||
    n.includes("line-") ||
    n.includes("lineoa") ||
    n.includes("lineshopping") ||
    n.includes("ไลน์")
  )
    return "line";

  if (!allHeaders || allHeaders.length === 0) return "unknown";

  const headers = allHeaders.map(h => String(h).trim().toLowerCase());
  const cleanHeaders = headers.map(h => h.replace(/[\s_\-./]/g, ""));

  // TikTok Shop
  if (headers.some(h => [
    "sku subtotal after discount", "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย", 
    "ค่าคอมมิชชั่น tiktok shop", "หมายเลขคำสั่งซื้อ/การปรับ", 
    "เวลาที่ชำระคำสั่งซื้อ", "order substatus", "cancelation/return type", 
    "normal or pre-order", "sku id", "tiktok shop", "tiktok", "ติ๊กต๊อก", "ติ๊กตอก",
    "sku subtotal before discount", "sku seller discount", "sku unit original price",
    "sku platform discount", "ราคารวมย่อยของ sku", "ราคาต่อหน่วยของ sku", "ยอดรวมค่าสินค้า"
  ].some(k => h === k || h.includes(k)))) {
    return "tiktok";
  }

  // Facebook
  if (headers.some(h => ["facebook id", "fb name", "fb_id", "ชื่อลูกค้า fb", "เพจ", "page name", "facebook_order", "fb_order", "วันที่สั่งซื้อ (yyyy-mm-dd)"].some(k => h === k || h.includes(k)))) {
    return "facebook";
  }
  // LINE OA
  if (headers.some(h => ["line id", "line name", "line_id", "ชื่อลูกค้า line", "ไลน์", "line_order", "lineoa_order", "lineshopping"].some(k => h === k || h.includes(k)))) {
    return "line";
  }
  // Shopee
  if (headers.some(h => [
    "ค่าจัดส่งที่ shopee ชำระโดยชื่อของคุณ", "ค่าจัดส่งที่ shopee ชำระโดยผู้ซื้อ",
    "ค่าธรรมเนียมโครงสร้างพื้นฐานแพลตฟอร์ม", "จำนวนเงินทั้งหมดที่โอนแล้ว (฿)", 
    "จำนวนเงินทั้งหมดที่โอนแล้ว", "เลขอ้างอิง parent sku", 
    "เลขอ้างอิง sku (sku reference no.)", "โค้ด coins cashback ชำระโดยผู้ขาย", 
    "ส่วนลดจาก shopee", "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)"
  ].some(k => h === k || h.includes(k)))) {
    return "shopee";
  }
  // Lazada
  if (
    cleanHeaders.some(h => [
      "orderitemid", "orderitemno", "lazadasku", "statementnumber", 
      "feename", "paidstatus", "shippingprovider", "trackingcode"
    ].some(k => h === k || h.includes(k))) ||
    headers.some(h => [
      "order item id", "order item no", "order item no.", "lazada sku", 
      "statement number", "fee name", "paid status", "shipping provider",
      "tracking code", "หมายเลขรายการสินค้า", "รหัสรอบบิล", "ระยะเวลาใบแจ้งยอด",
      "ชื่อรายการธุรกรรม"
    ].some(k => h === k || h.includes(k)))
  ) {
    return "lazada";
  }
  // Fallbacks
  if (headers.some(h => ["หมายเลขคำสั่งซื้อ", "ราคาขายสุทธิ", "ราคาขาย", "สถานะการสั่งซื้อ"].some(k => h === k || h.includes(k)))) {
    if (cleanHeaders.some(h => ["orderitemid", "orderitemno", "lazadasku", "paidprice", "unitprice"].some(k => h === k || h.includes(k)))) {
      return "lazada";
    }
    return "shopee";
  }
  if (headers.some(h => ["order id", "order status", "seller sku", "product name"].some(k => h === k || h.includes(k)))) {
    if (cleanHeaders.some(h => ["orderitemid", "orderitemno", "lazadasku", "paidprice", "unitprice"].some(k => h === k || h.includes(k)))) {
      return "lazada";
    }
    return "tiktok";
  }
  return "unknown";
};

const generateUniqueId = (prefix: string = "ds") => {
  return `${prefix}_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
};

const cleanHeaderStr = (s: string) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/^[*#\s\-_]+/, "")
    .replace(/[\s\-_]/g, "");

const findColIndex = (
  headers: string[],
  targetKeywords: string[],
  blacklistKeywords: string[] = [],
): number => {
  if (!headers || headers.length === 0) return -1;
  const rawCleanHeaders = headers.map((h) => String(h || "").trim().toLowerCase());
  const normHeaders = rawCleanHeaders.map((h) => cleanHeaderStr(h));
  const cleanKeywords = targetKeywords.map((k) => k.trim().toLowerCase());
  const normKeywords = cleanKeywords.map((k) => cleanHeaderStr(k));
  const cleanBlacklist = blacklistKeywords.map((b) => b.trim().toLowerCase());

  // 1. Exact match (case-insensitive & trimmed)
  for (let kIdx = 0; kIdx < cleanKeywords.length; kIdx++) {
    const kw = cleanKeywords[kIdx];
    const idx = rawCleanHeaders.findIndex((h) => h === kw);
    if (idx !== -1) return idx;
  }

  // 2. Normalized exact match (ignoring spaces, dashes, asterisks, symbols)
  for (let kIdx = 0; kIdx < normKeywords.length; kIdx++) {
    const kw = normKeywords[kIdx];
    if (!kw) continue;
    const idx = normHeaders.findIndex((h) => h === kw);
    if (idx !== -1) return idx;
  }

  // 3. Substring match with score and blacklist filtering
  let bestIdx = -1;
  let bestScore = -1;

  for (let i = 0; i < rawCleanHeaders.length; i++) {
    const h = rawCleanHeaders[i];
    if (!h) continue;

    // If header matches any blacklist keyword, skip it
    if (cleanBlacklist.some((b) => h.includes(b))) continue;

    for (const kw of cleanKeywords) {
      if (h.includes(kw)) {
        let score = kw.length * 10;
        if (h.startsWith(kw)) score += 5;
        if (h.length > kw.length * 3) score -= 5;

        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
    }
  }

  return bestIdx;
};

const readTextFileWithEncoding = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  // Try UTF-8 first
  const utf8Decoder = new TextDecoder("utf-8", { fatal: false });
  const utf8Text = utf8Decoder.decode(buffer);
  
  // If replacement characters found, try Thai encoding (Windows-874 / TIS-620)
  if (utf8Text.includes("\uFFFD")) {
    try {
      const tisDecoder = new TextDecoder("windows-874");
      return tisDecoder.decode(buffer);
    } catch {
      return utf8Text;
    }
  }
  return utf8Text;
};

const parseCSV = (text: string): string[][] => {
  if (!text || !text.trim()) return [];
  const cleanText = text.replace(/^\uFEFF/, "");
  
  // Auto-detect delimiter from first few lines
  const linesSample = cleanText.split(/\r?\n/).slice(0, 8).filter((l) => l.trim().length > 0).join("\n");
  const commaCount = (linesSample.match(/,/g) || []).length;
  const semiCount = (linesSample.match(/;/g) || []).length;
  const tabCount = (linesSample.match(/\t/g) || []).length;
  const pipeCount = (linesSample.match(/\|/g) || []).length;

  let delimiter = ",";
  if (tabCount > commaCount && tabCount >= semiCount) delimiter = "\t";
  else if (semiCount > commaCount && semiCount > tabCount) delimiter = ";";
  else if (pipeCount > commaCount && pipeCount > semiCount) delimiter = "|";

  const lines = cleanText.split(/\r?\n/);
  return lines
    .map((line) => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    })
    .filter((row) => row.length > 0 && row.some((cell) => cell.trim() !== ""));
};

const PLATFORMS: Record<string, { label: string; color: string }> = {
  lazada: { label: "Lazada", color: "#2E2BB8" },
  shopee: { label: "Shopee", color: "#EE4D2D" },
  tiktok: { label: "TikTok Shop", color: "#FE2C55" },
  facebook: { label: "Facebook", color: "#1877F2" },
  line: { label: "LINE OA", color: "#06C755" },
  unknown: { label: "ไฟล์ทั่วไป", color: "#7A8699" },
};

const PRODUCT_UPLOAD_THEMES = {
  all: {
    activeBorder:
      "border-blue-500 ring-4 ring-blue-500/10 shadow-[0_0_25px_rgba(59,130,246,0.25)] scale-[1.02]",
    normalBorder:
      "border-apple-primary/15 hover:border-blue-500/40 bg-apple-secondary hover:shadow-[0_8px_30px_rgba(59,130,246,0.05)]",
    iconBg:
      "bg-gradient-to-br from-blue-500/15 to-indigo-500/15 text-blue-500 shadow-sm shadow-blue-500/10",
    buttonClass:
      "bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/10 hover:shadow-blue-500/20",
    title: "ลากและวางไฟล์แคตตาล็อกสินค้าที่นี่",
    desc: "รองรับรายงานสินค้าจาก Lazada, Shopee และ TikTok Shop ระบบจะตรวจจับหัวตารางและแพลตฟอร์มให้อัตโนมัติ",
  },
  lazada: {
    activeBorder:
      "border-[#2E2BB8] ring-4 ring-[#2E2BB8]/10 shadow-[0_0_25px_rgba(46,43,184,0.25)] scale-[1.02]",
    normalBorder:
      "border-[#2E2BB8]/15 hover:border-[#2E2BB8]/40 bg-apple-secondary hover:shadow-[0_8px_30px_rgba(46,43,184,0.05)]",
    iconBg:
      "bg-gradient-to-br from-[#2E2BB8]/15 to-indigo-500/15 text-[#2E2BB8] shadow-sm shadow-[#2E2BB8]/10",
    buttonClass:
      "bg-[#2E2BB8] hover:bg-[#1E1B98] text-white shadow-md shadow-[#2E2BB8]/10 hover:shadow-[#2E2BB8]/20",
    title: "อัปโหลดไฟล์รายละเอียดสินค้า Lazada",
    desc: "รองรับไฟล์ข้อมูลสินค้า / แคตตาล็อกของ Lazada ระบบจะจับคู่คอลัมน์และกำหนดแบรนด์ให้อัตโนมัติ",
  },
  shopee: {
    activeBorder:
      "border-[#EE4D2D] ring-4 ring-[#EE4D2D]/10 shadow-[0_0_25px_rgba(238,77,45,0.25)] scale-[1.02]",
    normalBorder:
      "border-[#EE4D2D]/15 hover:border-[#EE4D2D]/40 bg-apple-secondary hover:shadow-[0_8px_30px_rgba(238,77,45,0.05)]",
    iconBg:
      "bg-gradient-to-br from-[#EE4D2D]/15 to-[#FE6D4D]/15 text-[#EE4D2D] shadow-sm shadow-[#EE4D2D]/10",
    buttonClass:
      "bg-[#EE4D2D] hover:bg-[#DE3D1D] text-white shadow-md shadow-[#EE4D2D]/10 hover:shadow-[#EE4D2D]/20",
    title: "อัปโหลดไฟล์รายละเอียดสินค้า Shopee",
    desc: "รองรับไฟล์ข้อมูลสินค้า / รายการสินค้าของ Shopee ระบบจะวิเคราะห์ข้อมูลเพื่อนำเข้ารายการสินค้า",
  },
  tiktok: {
    activeBorder:
      "border-[#FE2C55] ring-4 ring-[#FE2C55]/10 shadow-[0_0_25px_rgba(254,44,85,0.25)] scale-[1.02]",
    normalBorder:
      "border-[#FE2C55]/15 hover:border-[#FE2C55]/40 bg-apple-secondary hover:shadow-[0_8px_30px_rgba(254,44,85,0.05)]",
    iconBg:
      "bg-gradient-to-br from-[#FE2C55]/15 to-[#FF4C75]/15 text-[#FE2C55] shadow-sm shadow-[#FE2C55]/10",
    buttonClass:
      "bg-[#FE2C55] hover:bg-[#EE1C45] text-white shadow-md shadow-[#FE2C55]/10 hover:shadow-[#FE2C55]/20",
    title: "อัปโหลดไฟล์รายละเอียดสินค้า TikTok Shop",
    desc: "รองรับไฟล์ข้อมูลสินค้า / Product List ของ TikTok Shop เพื่อนำเข้าข้อมูลแบรนด์ หมวดหมู่ ราคา และสต็อก",
  },
  facebook: {
    activeBorder:
      "border-[#1877F2] ring-4 ring-[#1877F2]/10 shadow-[0_0_25px_rgba(24,119,242,0.25)] scale-[1.02]",
    normalBorder:
      "border-[#1877F2]/15 hover:border-[#1877F2]/40 bg-apple-secondary hover:shadow-[0_8px_30px_rgba(24,119,242,0.05)]",
    iconBg:
      "bg-gradient-to-br from-[#1877F2]/15 to-[#1877F2]/30 text-[#1877F2] shadow-sm shadow-[#1877F2]/10",
    buttonClass:
      "bg-[#1877F2] hover:bg-[#166FE5] text-white shadow-md shadow-[#1877F2]/10 hover:shadow-[#1877F2]/20",
    title: "อัปโหลดไฟล์รายละเอียดสินค้า Facebook",
    desc: "รองรับไฟล์แคตตาล็อกสินค้า / ไฟล์รายการสินค้าสำหรับเพจ Facebook หรือระบบสั่งซื้อภายนอก",
  },
  line: {
    activeBorder:
      "border-[#06C755] ring-4 ring-[#06C755]/10 shadow-[0_0_25px_rgba(6,199,85,0.25)] scale-[1.02]",
    normalBorder:
      "border-[#06C755]/15 hover:border-[#06C755]/40 bg-apple-secondary hover:shadow-[0_8px_30px_rgba(6,199,85,0.05)]",
    iconBg:
      "bg-gradient-to-br from-[#06C755]/15 to-[#06C755]/30 text-[#06C755] shadow-sm shadow-[#06C755]/10",
    buttonClass:
      "bg-[#06C755] hover:bg-[#05B64E] text-white shadow-md shadow-[#06C755]/10 hover:shadow-[#06C755]/20",
    title: "อัปโหลดไฟล์รายละเอียดสินค้า LINE OA",
    desc: "รองรับไฟล์รายการสินค้าของ LINE Shopping หรือ LINE OA เพื่อดึงข้อมูลสินค้าเข้าสู่ระบบ Phanvadee",
  },
};

const isSheetHidden = (workbook: XLSX.WorkBook, sheetName: string, idx?: number): boolean => {
  if (!sheetName || sheetName.startsWith("_") || sheetName.startsWith(".") || sheetName.startsWith("~$")) {
    return true;
  }
  if (!workbook.Workbook || !workbook.Workbook.Sheets) return false;
  const sheets = workbook.Workbook.Sheets;
  const byName = sheets.find(
    (s) => s && s.name && s.name.trim().toLowerCase() === sheetName.trim().toLowerCase()
  );
  if (byName && (byName.Hidden === 1 || byName.Hidden === 2 || (byName as Record<string, unknown>).hidden === true || Boolean(byName.Hidden))) {
    return true;
  }
  if (idx !== undefined && sheets[idx]) {
    const byIdx = sheets[idx];
    if (byIdx && (byIdx.Hidden === 1 || byIdx.Hidden === 2 || (byIdx as Record<string, unknown>).hidden === true || Boolean(byIdx.Hidden))) {
      return true;
    }
  }
  return false;
};

const getVisibleAoa = (ws: XLSX.WorkSheet): unknown[][] => {
  if (!ws) return [];
  repairWorksheetRange(ws);
  if (!ws['!ref']) return [];
  const rawAoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
  if (!rawAoa.length) return [];

  const hasHiddenRows = ws['!rows']?.some(r => r && (r.hidden || r.hpt === 0 || r.hpx === 0));
  const hasHiddenCols = ws['!cols']?.some(c => c && (c.hidden || c.wpx === 0 || c.width === 0 || c.wch === 0));

  if (!hasHiddenRows && !hasHiddenCols) {
    return rawAoa;
  }

  const range = XLSX.utils.decode_range(ws['!ref']);
  const startRow = range ? range.s.r : 0;
  const startCol = range ? range.s.c : 0;

  let visibleRows = rawAoa;
  if (hasHiddenRows) {
    visibleRows = rawAoa.filter((_, rIdx) => {
      const actualRowIdx = startRow + rIdx;
      const rowProps = ws['!rows'] ? ws['!rows'][actualRowIdx] : null;
      return !(rowProps && (rowProps.hidden || rowProps.hpt === 0 || rowProps.hpx === 0));
    });
  }

  if (hasHiddenCols) {
    const cols = ws['!cols'];
    return visibleRows.map(row => {
      if (!Array.isArray(row)) return row;
      return row.filter((_, c) => {
        const actualColIdx = startCol + c;
        const colProps = cols ? cols[actualColIdx] : null;
        return !(colProps && (colProps.hidden || colProps.wpx === 0 || colProps.width === 0 || colProps.wch === 0));
      });
    });
  }

  return visibleRows;
};

interface UploadedProductFile {
  id: string;
  fileName: string;
  platform: "lazada" | "shopee" | "tiktok" | "facebook" | "line" | "unknown";
  products: ParsedImportProduct[];
  rawRows?: unknown[][];
  rawHeaders?: string[];
  activeSheetName?: string;
  sheets?: SheetData[];
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isDarkMode,
  onDirtyChange,
  initialTab: _initialTab,
  productFiles = [],
  onImportProductFiles,
}) => {
  const [activeTab, setActiveTab] = useState<"manual" | "import">(_initialTab || "manual");
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen && _initialTab) {
      setActiveTab(_initialTab);
    }
  }

  // Manual States
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Product["category"]>("Electronics");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);

  // Import States
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedProductFile[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadPlatform, setUploadPlatform] = useState<
    "all" | "lazada" | "shopee" | "tiktok" | "facebook" | "line"
  >("all");
  const [activeCardDrag, setActiveCardDrag] = useState<
    "lazada" | "shopee" | "tiktok" | "facebook" | "line" | null
  >(null);

  // Preview / Table Search & Filters
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewFileFilter, setPreviewFileFilter] = useState<string>("all");
  const [previewCategoryFilter, setPreviewCategoryFilter] = useState<string>("all");
  const [previewViewMode, setPreviewViewMode] = useState<"parsed" | "raw">("parsed");
  const [activeRawFileId, setActiveRawFileId] = useState<string>("");
  const [rawSearch, setRawSearch] = useState("");
  const [previewPage, setPreviewPage] = useState(0);
  const previewPageSize = 10;

  // Flatten all parsed products across uploaded files
  const allParsedProducts = useMemo(() => {
    return uploadedFiles.flatMap((f) => f.products);
  }, [uploadedFiles]);

  const validProducts = useMemo(() => {
    return allParsedProducts.filter((p) => !p.warnings);
  }, [allParsedProducts]);

  const totalStockCount = useMemo(() => {
    return validProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
  }, [validProducts]);

  const warningCount = useMemo(() => {
    return allParsedProducts.filter((p) => p.warnings).length;
  }, [allParsedProducts]);

  const filteredPreviewProducts = useMemo(() => {
    return allParsedProducts.filter((p) => {
      const matchFile =
        previewFileFilter === "all" || p.fileId === previewFileFilter;
      const q = (previewSearch || "").toLowerCase().trim();
      const matchSearch =
        q === "" ||
        (p.name ? String(p.name).toLowerCase().includes(q) : false) ||
        (p.brand ? String(p.brand).toLowerCase().includes(q) : false) ||
        (p.category ? String(p.category).toLowerCase().includes(q) : false);
      const matchCategory =
        previewCategoryFilter === "all" || p.category === previewCategoryFilter;
      return matchFile && matchSearch && matchCategory;
    });
  }, [allParsedProducts, previewFileFilter, previewSearch, previewCategoryFilter]);

  const isDirty =
    isOpen &&
    (name !== "" ||
      brand !== "" ||
      price !== 0 ||
      stock !== 0 ||
      uploadedFiles.length > 0);

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  const handleReset = () => {
    // Reset Manual
    setName("");
    setCategory("Electronics");
    setBrand("");
    setPrice(0);
    setStock(0);

    // Reset Import
    setUploadedFiles([]);
    setErrorMsg(null);
    setDragActive(false);
    setUploadPlatform("all");
    setActiveCardDrag(null);
    setCurrentStep(1);
    setPreviewSearch("");
    setPreviewFileFilter("all");
    setPreviewCategoryFilter("all");
    setPreviewViewMode("parsed");
    setActiveRawFileId("");
    setRawSearch("");
    setPreviewPage(0);
  };

  // Trigger reset when modal opens/closes
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      handleReset();
      setActiveTab(_initialTab || "manual");
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit([{ name, category, brand, price: 0, stock }]);
    handleReset();
    onClose();
  };

  const inferProductCategory = (name: string, rawCat?: string): Product["category"] => {
    const cleanCat = String(rawCat || "").toLowerCase().trim();
    if (
      cleanCat.includes("apparel") ||
      cleanCat.includes("เสื้อ") ||
      cleanCat.includes("ผ้า") ||
      cleanCat.includes("แฟชั่น") ||
      cleanCat.includes("กางเกง") ||
      cleanCat.includes("กระโปรง") ||
      cleanCat.includes("เดรส") ||
      cleanCat.includes("dress") ||
      cleanCat.includes("cloth") ||
      cleanCat.includes("shirt")
    ) {
      return "Apparel";
    }
    if (
      cleanCat.includes("home") ||
      cleanCat.includes("บ้าน") ||
      cleanCat.includes("ของใช้") ||
      cleanCat.includes("living") ||
      cleanCat.includes("furniture") ||
      cleanCat.includes("kitchen") ||
      cleanCat.includes("ครัว")
    ) {
      return "Home";
    }
    if (
      cleanCat.includes("beauty") ||
      cleanCat.includes("งาม") ||
      cleanCat.includes("สำอาง") ||
      cleanCat.includes("บำรุง") ||
      cleanCat.includes("skin") ||
      cleanCat.includes("cosmetic") ||
      cleanCat.includes("makeup") ||
      cleanCat.includes("hair") ||
      cleanCat.includes("ผม")
    ) {
      return "Beauty";
    }
    if (
      cleanCat.includes("elect") ||
      cleanCat.includes("ไฟ") ||
      cleanCat.includes("คอม") ||
      cleanCat.includes("phone") ||
      cleanCat.includes("gadget") ||
      cleanCat.includes("tech")
    ) {
      return "Electronics";
    }

    // Infer from product name
    const n = String(name || "").toLowerCase();
    if (
      /แปรง|หวี|มีดโกน|เคราติน|สบู่|ครีม|เซรั่ม|แชมพู|บำรุง|ลิป|แต่งหน้า|น้ำหอม|ทำผม|ตัดผม|บาร์เบอร์|ไดร์|มาส์ก|โพเมด|พู่ปัด|กระปุกแป้ง|กรรไกร|ห่วงต่อผม|กิ๊ฟต่อผม|หัวหุ่น|วิก|ปัตตาเลี่ยน|pomade|keratin|comb|brush|hair|beauty|cosmetic|masque|salon|barber|shampoo|serum|scissor|clay/i.test(
        n,
      )
    ) {
      return "Beauty";
    }
    if (/เสื้อ|กางเกง|กระโปรง|เดรส|รองเท้า|ถุงเท้า|กระเป๋า|หมวก|แฟชั่น|ผ้าพันคอ|cloth|shirt|pants|dress|shoes|bag|apparel/i.test(n)) {
      return "Apparel";
    }
    if (/เตียง|หมอน|ผ้าปู|ครัว|แก้ว|จาน|โต๊ะ|เก้าอี้|ห้อง|ของใช้|กระจก|pillow|kitchen|home|living|furniture|table|chair/i.test(n)) {
      return "Home";
    }
    if (/หูฟัง|ลำโพง|สายชาร์จ|แบต|กล้อง|คอม|มือถือ|เคส|ปลั๊ก|พัดลม|เมาส์|คีย์บอร์ด|gadget|phone|charger|electronic|cable|usb|mouse|keyboard/i.test(n)) {
      return "Electronics";
    }
    return "Beauty";
  };

  const processProductRows = (
    rows: unknown[][],
  ): ParsedImportProduct[] => {
    if (!rows || rows.length === 0) return [];

    const cleanRows = rows.filter(
      (r) =>
        Array.isArray(r) &&
        r.some((c) => c !== undefined && c !== null && String(c).trim() !== ""),
    );
    if (cleanRows.length === 0) return [];

    let headerRowIndex = 0;
    let maxScore = -1;

    for (let i = 0; i < Math.min(cleanRows.length, 25); i++) {
      const row = cleanRows[i];
      const rowStrings = row.map((cell) => String(cell || "").trim());
      const nonEmptyCount = rowStrings.filter((cell) => cell !== "").length;

      let keywordMatches = 0;
      if (findColIndex(rowStrings, KEY_MAPS_PRODUCT.name, NAME_BLACKLIST) !== -1) keywordMatches += 2;
      if (findColIndex(rowStrings, KEY_MAPS_PRODUCT.price, PRICE_BLACKLIST) !== -1) keywordMatches += 2;
      if (findColIndex(rowStrings, KEY_MAPS_PRODUCT.stock, STOCK_BLACKLIST) !== -1) keywordMatches += 1;
      if (findColIndex(rowStrings, KEY_MAPS_PRODUCT.category) !== -1) keywordMatches += 1;
      if (findColIndex(rowStrings, KEY_MAPS_PRODUCT.brand) !== -1) keywordMatches += 1;

      // Penalize purely numeric rows
      const numericCount = row.filter(
        (c) => typeof c === "number" || (!isNaN(Number(c)) && String(c).trim() !== ""),
      ).length;
      if (nonEmptyCount > 0 && numericCount / nonEmptyCount > 0.6) {
        keywordMatches -= 3;
      }

      const score = keywordMatches * 50 + nonEmptyCount;
      if (score > maxScore) {
        maxScore = score;
        headerRowIndex = i;
      }
    }

    const headers = (cleanRows[headerRowIndex] || []).map((h) => String(h || "").trim());
    let idxName = findColIndex(headers, KEY_MAPS_PRODUCT.name, NAME_BLACKLIST);
    const idxCat = findColIndex(headers, KEY_MAPS_PRODUCT.category);
    const idxBrand = findColIndex(headers, KEY_MAPS_PRODUCT.brand);
    let idxPrice = findColIndex(headers, KEY_MAPS_PRODUCT.price, PRICE_BLACKLIST);
    let idxStock = findColIndex(headers, KEY_MAPS_PRODUCT.stock, STOCK_BLACKLIST);

    // Smart fallback if direct keyword match not found in header
    if (idxName === -1) {
      idxName = headers.findIndex((h) => {
        const cl = h.trim().toLowerCase();
        if (NAME_BLACKLIST.some((b) => cl.includes(b))) return false;
        return (
          cl.includes("สินค้า") ||
          cl.includes("product") ||
          cl.includes("item") ||
          cl.includes("sku") ||
          cl.includes("รายการ") ||
          cl.includes("รายละเอียด") ||
          cl.includes("name") ||
          cl.includes("ชื่อ") ||
          cl.includes("model") ||
          cl.includes("รุ่น") ||
          cl.includes("title") ||
          cl.includes("desc")
        );
      });
    }

    if (idxPrice === -1) {
      idxPrice = headers.findIndex((h) => {
        const cl = h.trim().toLowerCase();
        if (PRICE_BLACKLIST.some((b) => cl.includes(b))) return false;
        return (
          cl.includes("ราคา") ||
          cl.includes("price") ||
          cl.includes("ยอดชำระ") ||
          cl.includes("ยอดขาย") ||
          cl.includes("ราคารวม") ||
          cl.includes("ราคาสุทธิ") ||
          cl.includes("unitprice") ||
          cl.includes("paidprice")
        );
      });
    }

    if (idxStock === -1) {
      idxStock = headers.findIndex((h) => {
        const cl = h.trim().toLowerCase();
        if (STOCK_BLACKLIST.some((b) => cl.includes(b))) return false;
        return (
          cl.includes("จำนวนสต็อก") ||
          cl.includes("สต็อกคงเหลือ") ||
          cl.includes("จำนวนสินค้าคงเหลือ") ||
          cl.includes("สต็อก") ||
          cl.includes("stock") ||
          cl.includes("คงเหลือ") ||
          cl.includes("คลัง") ||
          cl.includes("available")
        );
      });
    }

    let dataRows = cleanRows.slice(headerRowIndex + 1);
    if (dataRows.length === 0 || (idxName === -1 && cleanRows.length > 0)) {
      dataRows = cleanRows;
    }

    // Skip TikTok / Excel description rows if present
    if (dataRows.length > 1) {
      const firstRowStr = dataRows[0].map((c) => String(c || "").toLowerCase()).join(" ");
      if (
        firstRowStr.includes("unique identifier") ||
        firstRowStr.includes("description") ||
        firstRowStr.includes("คำอธิบาย") ||
        firstRowStr.includes("specific identifier") ||
        firstRowStr.includes("this field") ||
        firstRowStr.includes("status description")
      ) {
        dataRows = dataRows.slice(1);
      }
    }

    // Auto-detect columns from data rows if still missing idxName
    if (idxName === -1 && dataRows.length > 0) {
      const maxCols = Math.max(...dataRows.slice(0, 10).map((r) => r.length));
      let bestTextCol = -1;
      let bestTextScore = -1;
      for (let c = 0; c < maxCols; c++) {
        let textCount = 0;
        let numCount = 0;
        for (const row of dataRows.slice(0, 10)) {
          const val = row[c];
          if (val !== undefined && val !== null && String(val).trim().length > 0) {
            const str = String(val).trim();
            if (isNaN(Number(str)) && !/^\d{4}-\d{2}-\d{2}/.test(str)) {
              textCount++;
            } else {
              numCount++;
            }
          }
        }
        if (textCount > bestTextScore && textCount >= numCount) {
          bestTextScore = textCount;
          bestTextCol = c;
        }
      }
      if (bestTextCol !== -1) idxName = bestTextCol;
    }

    // Pre-collect all candidate price column indices in priority order
    const candidatePriceCols: number[] = [];
    if (idxPrice !== -1) {
      candidatePriceCols.push(idxPrice);
    }
    headers.forEach((h, cIdx) => {
      if (cIdx === idxName || candidatePriceCols.includes(cIdx)) return;
      const cl = h.toLowerCase().trim();
      if (PRICE_BLACKLIST.some((b) => cl.includes(b))) return;
      if (
        cl.includes("ราคาขาย") ||
        cl.includes("ราคาตั้งต้น") ||
        cl.includes("ราคาต่อหน่วย") ||
        cl.includes("ราคาต่อชิ้น") ||
        cl.includes("ราคาขายสุทธิ") ||
        cl.includes("ราคาสินค้า") ||
        cl.includes("unit price") ||
        cl.includes("unitprice") ||
        cl.includes("paid price") ||
        cl.includes("paidprice") ||
        cl.includes("item price") ||
        cl.includes("original price") ||
        cl.includes("deal price") ||
        cl.includes("ราคา") ||
        cl.includes("price")
      ) {
        candidatePriceCols.push(cIdx);
      }
    });

    if (idxName === -1) {
      return [];
    }

    const hasRealStockCol = idxStock !== -1;

    const mapped = dataRows
      .map((row) => {
        const nameVal =
          row[idxName] !== undefined && row[idxName] !== null
            ? String(row[idxName]).trim()
            : "";
        if (
          !nameVal ||
          nameVal === "-" ||
          nameVal === "รวม" ||
          nameVal.toLowerCase() === "total" ||
          nameVal.toLowerCase() === "sum"
        )
          return null;

        // Filter out if this row is repeated header
        if (
          nameVal.toLowerCase() === "ชื่อสินค้า" ||
          nameVal.toLowerCase() === "product name" ||
          nameVal.toLowerCase() === "item name"
        )
          return null;

        const catRaw =
          idxCat !== -1 && row[idxCat] !== undefined && row[idxCat] !== null
            ? String(row[idxCat]).trim()
            : "";

        const catMatched = inferProductCategory(nameVal, catRaw);

        let brandVal =
          idxBrand !== -1 && row[idxBrand] !== undefined && row[idxBrand] !== null
            ? String(row[idxBrand]).trim()
            : "ทั่วไป";
        if (brandVal === "ทั่วไป" || !brandVal || brandVal === "-") {
          brandVal = detectBrand(row, nameVal);
        }


        let stockVal = 0;
        if (hasRealStockCol && row[idxStock] !== undefined && row[idxStock] !== null) {
          const str = String(row[idxStock]).trim();
          if (/^\d+$/.test(str)) {
            const parsed = parseInt(str, 10);
            if (!isNaN(parsed) && parsed >= 0 && parsed <= 100000) {
              stockVal = parsed;
            }
          }
        }

        let warnings: string | null = null;
        if (!nameVal) warnings = "ไม่มีชื่อสินค้า";

        return {
          name: nameVal,
          category: catMatched,
          brand: brandVal || "ทั่วไป",
          price: 0,
          stock: stockVal,
          warnings,
        };
      })
      .filter((p): p is ParsedImportProduct => p !== null && p.name.trim().length > 0);

    // Merge duplicate products (e.g. from Order reports or multi-row exports)
    const productMap = new Map<string, ParsedImportProduct>();
    for (const prod of mapped) {
      const key = `${prod.name.toLowerCase().trim()}___${prod.brand.toLowerCase().trim()}`;
      if (!productMap.has(key)) {
        productMap.set(key, { ...prod, price: 0 });
      } else {
        const existing = productMap.get(key)!;
        if (hasRealStockCol) {
          existing.stock = Math.min(existing.stock + prod.stock, 999999);
        }
        existing.price = 0;
        existing.warnings = existing.name ? null : "ไม่มีชื่อสินค้า";
      }
    }

    return Array.from(productMap.values());
  };

  const handleUploadFiles = async (
    files: FileList | File[],
    forcedPlatform?: "lazada" | "shopee" | "tiktok" | "facebook" | "line",
  ) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const newUploadedFiles: UploadedProductFile[] = [];
    let lastError: string | null = null;

    for (const file of fileArray) {
      try {
        if (file.name.startsWith("~$")) {
          throw new Error(`ไม่สามารถนำเข้าไฟล์ชั่วคราว (Temporary File) "${file.name}" ได้`);
        }

        const isExcel =
          file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
        const detectedPlat =
          forcedPlatform ||
          (uploadPlatform === "all" ? detectPlatform(file.name) : uploadPlatform);

        let parsedProductsList: ParsedImportProduct[] = [];
        let savedRawRows: unknown[][] = [];
        let savedRawHeaders: string[] = [];
        let savedSheetName: string = "Products";
        let savedSheets: SheetData[] = [];

        if (isExcel) {
          const buffer = await file.arrayBuffer();
          const data = new Uint8Array(buffer);
          let workbook: XLSX.WorkBook;
          try {
            workbook = XLSX.read(data, { type: "array", cellDates: true, raw: true });
          } catch {
            workbook = XLSX.read(data, { type: "array" });
          }

          const visibleSheets: SheetData[] = [];
          let bestSheetProducts: ParsedImportProduct[] = [];
          let bestRawRows: unknown[][] = [];
          let bestRawHeaders: string[] = [];
          let bestSheet = "";

          for (let sIdx = 0; sIdx < workbook.SheetNames.length; sIdx++) {
            const sName = workbook.SheetNames[sIdx];
            if (isSheetHidden(workbook, sName, sIdx)) continue;

            const worksheet = workbook.Sheets[sName];
            if (!worksheet) continue;

            const aoa = getVisibleAoa(worksheet).filter((r) => r && r.some((c) => c !== null && c !== undefined && String(c).trim() !== ""));
            if (aoa.length === 0) continue;

            // Extract headers and row objects
            const headerRowIdx = aoa.findIndex((r) => r.some((c) => c !== null && c !== undefined && String(c).trim() !== ""));
            const rawHeaders = (headerRowIdx !== -1 ? aoa[headerRowIdx] : []) || [];
            const headers: string[] = [];
            const maxCols = Math.max(...aoa.map((r) => r.length), rawHeaders.length);
            for (let c = 0; c < maxCols; c++) {
              const hVal = rawHeaders[c];
              const label = hVal !== undefined && hVal !== null ? String(hVal).trim() : "";
              headers.push(label === "" ? `คอลัมน์ ${c + 1}` : label);
            }

            const dataRows = headerRowIdx !== -1 ? aoa.slice(headerRowIdx + 1) : aoa;
            const sheetRowObjects: Record<string, unknown>[] = dataRows.map((row) => {
              const obj: Record<string, unknown> = {};
              headers.forEach((h, idx) => {
                obj[h] = row[idx] ?? "";
              });
              return obj;
            });

            visibleSheets.push({
              name: sName,
              headers,
              rows: sheetRowObjects,
            });

            const parsed = processProductRows(aoa);
            if (parsed.length > bestSheetProducts.length || !bestSheet) {
              bestSheetProducts = parsed;
              bestRawRows = aoa;
              bestRawHeaders = headers;
              bestSheet = sName;
            }
          }

          parsedProductsList = bestSheetProducts;
          savedRawRows = bestRawRows;
          savedRawHeaders = bestRawHeaders;
          savedSheetName = bestSheet || (visibleSheets[0]?.name ?? "Sheet1");
          savedSheets = visibleSheets;
          if (parsedProductsList.length === 0 && visibleSheets.length === 0) {
            lastError = `ไฟล์ ${file.name}: ไม่พบแผ่นงานที่แสดงผล (Visible Sheet) หรือไม่พบข้อมูลสินค้า`;
          }
        } else {
          const text = await readTextFileWithEncoding(file);
          const rows = parseCSV(text);
          parsedProductsList = processProductRows(rows);
          savedRawRows = rows;
          savedSheetName = "CSV Data";
          if (rows.length > 0) {
            savedRawHeaders = (rows[0] || []).map((h, i) => String(h ?? "").trim() || `คอลัมน์ ${i + 1}`);
            const dataRows = rows.slice(1);
            savedSheets = [
              {
                name: "CSV Data",
                headers: savedRawHeaders,
                rows: dataRows.map((row) => {
                  const obj: Record<string, unknown> = {};
                  savedRawHeaders.forEach((h, idx) => {
                    obj[h] = row[idx] ?? "";
                  });
                  return obj;
                }),
              },
            ];
          }
          if (parsedProductsList.length === 0) {
            lastError = `ไฟล์ ${file.name}: ไม่พบรายการสินค้าที่สามารถอ่านได้ กรุณาตรวจสอบว่ามีข้อมูลและหัวคอลัมน์`;
          }
        }

        if (parsedProductsList.length > 0 || savedSheets.length > 0) {
          const fileId = generateUniqueId("prod_file");
          newUploadedFiles.push({
            id: fileId,
            fileName: file.name,
            platform: (detectedPlat === "unknown" || !forcedPlatform) && savedRawHeaders.length > 0
              ? (detectPlatform(file.name, savedRawHeaders) !== "unknown" ? detectPlatform(file.name, savedRawHeaders) : (detectedPlat === "unknown" ? "lazada" : detectedPlat))
              : (detectedPlat === "unknown" ? "lazada" : detectedPlat),
            products: parsedProductsList.map((p) => ({
              ...p,
              fileId,
              fileName: file.name,
            })),
            rawRows: savedRawRows,
            rawHeaders: savedRawHeaders,
            activeSheetName: savedSheetName,
            sheets: savedSheets,
          });
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }

    if (newUploadedFiles.length > 0) {
      setUploadedFiles((prev) => {
        const existingIds = new Set(prev.map((f) => f.id));
        const filteredNew = newUploadedFiles.filter(
          (f) => !existingIds.has(f.id),
        );
        const combined = [...prev, ...filteredNew];
        if (combined.length > 0 && !activeRawFileId) {
          setActiveRawFileId(combined[0].id);
        }
        return combined;
      });
      setErrorMsg(null);
      setCurrentStep(1);
    } else if (lastError) {
      setErrorMsg(lastError);
    }
  };

  const handleDeleteFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (uploadedFiles.length <= 1) {
      setCurrentStep(1);
    }
  };

  const handleCardDrag = (
    e: React.DragEvent,
    platform: "lazada" | "shopee" | "tiktok" | "facebook" | "line",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setActiveCardDrag(platform);
    } else if (e.type === "dragleave" || e.type === "drop") {
      setActiveCardDrag(null);
    }
  };

  const handleCardDrop = (
    e: React.DragEvent,
    platform: "lazada" | "shopee" | "tiktok" | "facebook" | "line",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveCardDrag(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setUploadPlatform(platform);
      handleUploadFiles(e.dataTransfer.files, platform);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files);
    }
  };

  const handleImportSubmit = () => {
    if (validProducts.length === 0) {
      setErrorMsg("ไม่พบสินค้าที่ถูกต้องในการนำเข้า");
      return;
    }

    onSubmit(
      validProducts.map((p) => ({
        name: p.name,
        category: p.category,
        brand: p.brand,
        price: p.price,
        stock: p.stock,
      })),
    );

    if (onImportProductFiles && uploadedFiles.length > 0) {
      const datasetsToImport: UploadedDataset[] = uploadedFiles.map((file) => ({
        id: generateUniqueId("ds_prod"),
        fileName: file.fileName,
        platform: file.platform,
        type: "order",
        fileType: "product",
        sheets: file.sheets && file.sheets.length > 0
          ? file.sheets
          : [
              {
                name: file.activeSheetName || "Products",
                headers: file.rawHeaders && file.rawHeaders.length > 0
                  ? file.rawHeaders
                  : ["ชื่อสินค้า", "หมวดหมู่", "แบรนด์", "ราคา", "สต็อก"],
                rows: file.products
                  .filter((p) => !p.warnings)
                  .map((p) => ({
                    ชื่อสินค้า: p.name,
                    หมวดหมู่: p.category,
                    แบรนด์: p.brand || "",
                    ราคา: p.price,
                    สต็อก: p.stock,
                  })),
              },
            ],
        uploadedAt: new Date().toLocaleString("th-TH"),
      }));
      onImportProductFiles(datasetsToImport);
    }

    handleReset();
    onClose();
  };

  const downloadTemplate = () => {
    const headers = ["ชื่อสินค้า", "หมวดหมู่", "แบรนด์", "ราคา", "จำนวนสต็อก"];
    const rows = [
      ["เมาส์บลูทูธไร้สาย", "Electronics", "Logitech", "490", "50"],
      ["เสื้อยืดคอตตอนสีดำ", "Apparel", "Uniqlo", "390", "120"],
      ["หมอนยางพาราแท้", "Home", "SiamLatex", "890", "30"],
      ["ลิปสติกเนื้อแมตต์", "Beauty", "Maybelline", "250", "80"],
    ];
    const csvContent =
      "\uFEFF" +
      [headers, ...rows]
        .map((e) => e.map((val) => `"${val}"`).join(","))
        .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "template_import_products.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-neutral-900/70 backdrop-blur-[4px] z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-10 transition-all duration-300 mobile-bottom-sheet">
      <div className={`w-[95vw] sm:w-[92vw] max-h-[85vh] my-auto flex flex-col overflow-hidden animate-scale-in rounded-[2rem] border bg-apple-secondary border-apple-primary shadow-2xl mobile-bottom-sheet-content transition-all duration-500 ${
        activeTab === "import" ? "md:max-w-4xl lg:max-w-5xl" : "md:max-w-2xl"
      }`}>
        {/* Header */}
        <div className="px-6 py-4 sm:px-8 flex flex-wrap gap-4 justify-between items-center bg-apple-tertiary rounded-t-[2rem] shrink-0 border-b border-apple-primary/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-apple-primary text-base truncate">
                {activeTab === "import" ? "นำเข้าข้อมูลสินค้า" : "เพิ่มรายการสินค้าใหม่"}
              </h3>
              <p className="text-xs text-apple-secondary font-medium truncate">
                {activeTab === "import"
                  ? "อัปโหลดและตรวจสอบไฟล์ข้อมูลสินค้าเพื่อนำเข้าสู่ระบบ"
                  : "กรอกรายละเอียดสินค้าทีละรายการเพื่อบันทึกเข้าสู่ระบบ"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Tab switch buttons */}
            <div className="flex items-center p-1 bg-apple-secondary border border-apple-primary/10 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("import")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "import"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-apple-secondary hover:text-apple-primary"
                }`}
              >
                นำเข้าไฟล์
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("manual")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "manual"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-apple-secondary hover:text-apple-primary"
                }`}
              >
                เพิ่มด้วยตนเอง
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full border border-black/5 dark:border-white/5 bg-transparent hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm animate-scale-in shrink-0"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Form Content */}
        {activeTab === "manual" ? (
          <form
            onSubmit={handleManualSubmit}
            className="p-6 sm:p-8 space-y-5 overflow-y-auto flex-1"
          >
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                ชื่อรายละเอียดสินค้า
              </label>
              <input
                type="text"
                required
                placeholder="ตัวอย่างเช่น แป้นพิมพ์บลูทูธไร้สาย"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                  หมวดหมู่หลัก
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as Product["category"])
                    }
                    className="input-apple w-full rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none cursor-pointer appearance-none bg-apple-secondary/30"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Apparel">Apparel</option>
                    <option value="Home">Home</option>
                    <option value="Beauty">Beauty</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-apple-secondary flex items-center justify-center">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                  แบรนด์สินค้า
                </label>
                <input
                  type="text"
                  placeholder="ตัวอย่างเช่น Logitech (เว้นว่างได้)"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                จำนวนสินค้าในสต็อก
              </label>
              <input
                type="number"
                min="0"
                required
                placeholder="0"
                value={stock || ""}
                onChange={(e) => setStock(parseInt(e.target.value, 10) || 0)}
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3 mt-6 border-t border-apple-primary/10">
              <button
                type="button"
                onClick={onClose}
                className="bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-apple-primary px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all duration-200 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/10 hover:shadow-blue-500/25 hover:shadow-lg active:scale-95"
              >
                บันทึกสินค้า
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 sm:p-6 flex-1 overflow-y-auto min-h-0 custom-scrollbar space-y-4 sm:space-y-5">
            {/* Stepper Indicator */}
            <div className="flex items-center justify-between max-w-xl mx-auto px-4 py-1.5 sm:py-2 bg-neutral-50/50 dark:bg-neutral-900/30 rounded-2xl border border-black/[0.03] dark:border-white/[0.03] shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
                    currentStep === 1
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/10 scale-110"
                      : "bg-emerald-500 text-white shadow-md shadow-emerald-500/10"
                  }`}
                >
                  {currentStep > 1 ? "✓" : "1"}
                </div>
                <div>
                  <span className="text-[11px] font-black text-neutral-800 dark:text-neutral-200 block leading-tight">
                    ขั้นตอนที่ 1
                  </span>
                  <span className="text-[9px] text-neutral-500 dark:text-neutral-450 block">
                    อัปโหลดและตรวจสอบไฟล์ ({uploadedFiles.length} ไฟล์)
                  </span>
                </div>
              </div>

              <div className="flex-1 h-0.5 mx-4 bg-neutral-200 dark:bg-neutral-800 relative overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500 ${
                    currentStep === 2 ? "w-full" : "w-0"
                  }`}
                />
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
                    currentStep === 2
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/10 scale-110"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border border-neutral-200/50 dark:border-neutral-855"
                  }`}
                >
                  2
                </div>
                <div>
                  <span className="text-[11px] font-black text-neutral-800 dark:text-neutral-200 block leading-tight">
                    ขั้นตอนที่ 2
                  </span>
                  <span className="text-[9px] text-neutral-500 dark:text-neutral-450 block">
                    วิเคราะห์ข้อมูลพรีวิวนำเข้า
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-2xl flex items-center gap-2.5 animate-fade-in max-w-2xl mx-auto">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {currentStep === 1 ? (
              /* STEP 1: UPLOAD & VERIFY FILES */
              <div className="space-y-4 sm:space-y-5 animate-fade-in">
                {uploadedFiles.length > 0 ? (
                  <>
                    {/* Queue Header */}
                    <div className="flex justify-between items-center border-b border-apple-primary/10 pb-4">
                      <div>
                        <h3 className="text-sm font-black text-apple-primary">
                          รายการอัปโหลด ({uploadedFiles.length} ไฟล์)
                        </h3>
                        <p className="text-xs text-apple-secondary mt-0.5">
                          กรุณาตรวจสอบรายการไฟล์ที่อัปโหลดและดำเนินการในขั้นตอนถัดไป
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleReset}
                        className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors cursor-pointer bg-transparent border-none p-0 flex items-center gap-1 hover:scale-105 active:scale-95"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> ล้างการอัปโหลด
                      </button>
                    </div>

                    {/* Files List Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {uploadedFiles.map((file) => {
                        const pf =
                          PLATFORMS[file.platform] || PLATFORMS.unknown;
                        const validInFile = file.products.filter(
                          (p) => !p.warnings,
                        ).length;

                        return (
                          <div
                            key={file.id}
                            className="group p-4.5 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1f1f1f] shadow-sm hover:shadow-md hover:border-black/10 dark:hover:border-white/10 transition-all duration-300 relative overflow-hidden flex flex-col justify-between hover:-translate-y-0.5"
                          >
                            {/* Platform Accent Glow */}
                            <div
                              className="absolute top-0 left-0 right-0 h-[3px]"
                              style={{ backgroundColor: pf.color }}
                            />

                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div
                                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                                  style={{ backgroundColor: `${pf.color}12` }}
                                >
                                  <FileSpreadsheet
                                    className="h-5 w-5"
                                    style={{ color: pf.color }}
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className="text-[10px] font-black px-2 py-0.5 rounded-md border whitespace-nowrap"
                                      style={{
                                        backgroundColor: `${pf.color}10`,
                                        color: pf.color,
                                        borderColor: `${pf.color}25`,
                                      }}
                                    >
                                      {pf.label}
                                    </span>
                                    <span className="flex items-center gap-1 whitespace-nowrap">
                                      <span className="flex h-2 w-2 relative shrink-0">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                      </span>
                                      <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-bold whitespace-nowrap">
                                        พร้อมนำเข้า
                                      </span>
                                    </span>
                                  </div>
                                  <p
                                    className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate mt-1.5"
                                    title={file.fileName}
                                  >
                                    {file.fileName}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteFile(file.id)}
                                className="text-neutral-400 hover:text-rose-500 p-1.5 hover:bg-rose-500/10 rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center border-none bg-transparent shrink-0 opacity-80 hover:opacity-100"
                                title="ลบ"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mt-3.5 pt-3 border-t border-neutral-100 dark:border-neutral-800/40 flex justify-between items-center text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                              <span className="flex items-center gap-1.5 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600 shrink-0" />
                                <span>แคตตาล็อกสินค้า (Products)</span>
                              </span>
                              <span className="font-mono font-bold px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-md border border-black/[0.03] dark:border-white/[0.03] whitespace-nowrap">
                                {validInFile.toLocaleString()} รายการ
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Compact Dashed Upload Box to add more files */}
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() =>
                        document.getElementById("product-csv-input-more")?.click()
                      }
                      className={`group rounded-2xl border-2 border-dashed transition-all duration-300 relative overflow-hidden flex flex-col items-center justify-center gap-2.5 max-w-lg mx-auto w-full p-6 text-center cursor-pointer ${
                        dragActive
                          ? "border-blue-500 ring-2 ring-blue-500/10 bg-blue-500/[0.02]"
                          : "border-neutral-200 dark:border-neutral-800 hover:border-blue-500/50 dark:hover:border-blue-400/50 bg-neutral-50/30 hover:bg-blue-500/[0.01]"
                      }`}
                    >
                      <Link className="h-5 w-5 text-neutral-450 dark:text-neutral-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200" />
                      <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-850 dark:group-hover:text-neutral-100 transition-colors">
                        เพิ่มรายการสินค้า (Products)
                      </span>
                      <input
                        id="product-csv-input-more"
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>

                    {/* Step 1 Footer: Next navigation */}
                    <div className="flex justify-end pt-4 border-t border-apple-primary/10">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="px-6 py-3 rounded-xl text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-600/15 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 min-h-[44px] transition-all hover:scale-[1.01] border-none"
                      >
                        ถัดไป: ตรวจสอบและพรีวิวข้อมูล{" "}
                        <ArrowRight className="h-4 w-4 shrink-0" />
                      </button>
                    </div>
                  </>
                ) : (
                  /* Initial Screen Dropzone & Platform Selectors */
                  <div className="flex-1 flex flex-col items-center justify-center py-2 space-y-4 sm:space-y-5 w-full">
                    {/* Platform Selector Tabs */}
                    <div className="flex bg-apple-tertiary/40 p-1.5 rounded-2xl gap-2 border border-apple-primary/5 max-w-2xl w-full shadow-inner overflow-x-auto shrink-0">
                      {(
                        [
                          "all",
                          "lazada",
                          "shopee",
                          "tiktok",
                        ] as const
                      ).map((platform) => {
                        const isActive = uploadPlatform === platform;
                        let label = "";
                        let activeStyle = "";
                        let colorDot = null;

                        if (platform === "all") {
                          label = "ตรวจหาอัตโนมัติ (Auto)";
                          activeStyle = isActive
                            ? isDarkMode
                              ? "bg-gradient-to-r from-blue-500/10 to-indigo-500/15 border-blue-500/30 text-blue-400 shadow-md shadow-blue-500/5"
                              : "bg-gradient-to-r from-blue-50 to-indigo-50/50 border-blue-500/20 text-blue-600 shadow-sm"
                            : "";
                          colorDot = (
                            <span
                              className={`w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 shrink-0 ${isActive ? "scale-110" : ""}`}
                            />
                          );
                        } else if (platform === "lazada") {
                          label = "Lazada";
                          activeStyle = isActive
                            ? "bg-[#2E2BB8]/10 border-[#2E2BB8]/20 text-[#2E2BB8] shadow-sm"
                            : "";
                          colorDot = (
                            <span
                              className={`w-2 h-2 rounded-full bg-[#2E2BB8] shrink-0 ${isActive ? "scale-110" : ""}`}
                            />
                          );
                        } else if (platform === "shopee") {
                          label = "Shopee";
                          activeStyle = isActive
                            ? "bg-[#EE4D2D]/10 border-[#EE4D2D]/20 text-[#EE4D2D] shadow-sm"
                            : "";
                          colorDot = (
                            <span
                              className={`w-2 h-2 rounded-full bg-[#EE4D2D] shrink-0 ${isActive ? "scale-110" : ""}`}
                            />
                          );
                        } else if (platform === "tiktok") {
                          label = "TikTok Shop";
                          activeStyle = isActive
                            ? "bg-[#FE2C55]/10 border-[#FE2C55]/20 text-[#FE2C55] shadow-sm"
                            : "";
                          colorDot = (
                            <span
                              className={`w-2 h-2 rounded-full bg-[#FE2C55] shrink-0 ${isActive ? "scale-110" : ""}`}
                            />
                          );
                        }

                        return (
                          <button
                            key={platform}
                            type="button"
                            onClick={() => setUploadPlatform(platform)}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer border shrink-0 ${
                              isActive
                                ? `${activeStyle} border-solid`
                                : "bg-transparent border-transparent text-apple-secondary hover:text-apple-primary hover:bg-apple-tertiary/50"
                            }`}
                          >
                            {colorDot}
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Big Dropzone */}
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() =>
                        document.getElementById("product-csv-input")?.click()
                      }
                      className={`relative border-2 border-dashed rounded-3xl p-6 sm:p-7 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3.5 max-w-2xl w-full overflow-hidden ${
                        dragActive
                          ? PRODUCT_UPLOAD_THEMES[uploadPlatform].activeBorder
                          : PRODUCT_UPLOAD_THEMES[uploadPlatform].normalBorder
                      }`}
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-b ${
                          uploadPlatform === "all"
                            ? "from-blue-500/[0.04] to-transparent"
                            : uploadPlatform === "lazada"
                              ? "from-[#2E2BB8]/[0.04] to-transparent"
                              : uploadPlatform === "shopee"
                                ? "from-[#EE4D2D]/[0.04] to-transparent"
                                : "from-[#FE2C55]/[0.04] to-transparent"
                        } pointer-events-none transition-colors duration-500`}
                      />

                      <div
                        className={`p-3 rounded-2xl transition-all duration-300 ${
                          dragActive ? "scale-110 rotate-3" : "hover:scale-105"
                        } ${PRODUCT_UPLOAD_THEMES[uploadPlatform].iconBg}`}
                      >
                        <Upload
                          className={`h-6 w-6 transition-all duration-300 ${dragActive ? "animate-bounce" : ""}`}
                        />
                      </div>

                      <div className="space-y-1 flex flex-col items-center">
                        <h3 className="text-sm font-black text-apple-primary uppercase tracking-wider">
                          {PRODUCT_UPLOAD_THEMES[uploadPlatform].title}
                        </h3>
                        <p className="text-[11px] text-apple-secondary leading-relaxed max-w-md mx-auto text-center">
                          {PRODUCT_UPLOAD_THEMES[uploadPlatform].desc}
                        </p>
                      </div>

                      <div className="flex flex-col items-center gap-2 mt-0.5">
                        <button
                          type="button"
                          className={`px-5 py-2 rounded-xl text-xs font-black shadow-md pointer-events-none transition-all duration-300 ${PRODUCT_UPLOAD_THEMES[uploadPlatform].buttonClass}`}
                        >
                          เลือกไฟล์แคตตาล็อกสินค้า
                        </button>

                        <div className="flex gap-1.5 flex-wrap justify-center mt-0.5">
                          {[".CSV", ".XLSX", ".XLS"].map((ext) => (
                            <span
                              key={ext}
                              className="text-[9px] px-2 py-0.5 rounded font-mono font-bold bg-apple-tertiary text-apple-secondary border border-apple-primary/10"
                            >
                              {ext}
                            </span>
                          ))}
                        </div>
                      </div>

                      <input
                        id="product-csv-input"
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>

                    {/* Platforms Status Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl">
                      {(
                        ["lazada", "shopee", "tiktok"] as const
                      ).map((platKey) => {
                        const pf = PLATFORMS[platKey];
                        const hasFile = productFiles.some(
                          (f) => f.platform === platKey,
                        );
                        const matchedFile = productFiles.find(
                          (f) => f.platform === platKey,
                        );

                        return (
                          <div
                            key={platKey}
                            onClick={() => setUploadPlatform(platKey)}
                            onDragEnter={(e) => handleCardDrag(e, platKey)}
                            onDragOver={(e) => handleCardDrag(e, platKey)}
                            onDragLeave={(e) => handleCardDrag(e, platKey)}
                            onDrop={(e) => handleCardDrop(e, platKey)}
                            className={`p-3 rounded-2xl border text-left cursor-pointer transition-all duration-300 select-none relative overflow-hidden flex flex-col justify-between min-h-[96px] ${
                              uploadPlatform === platKey
                                ? `border-solid scale-[1.01]`
                                : activeCardDrag === platKey
                                  ? `scale-[1.03]`
                                  : isDarkMode
                                    ? "bg-white/3 border-white/5 hover:border-white/20 hover:bg-white/5 hover:-translate-y-0.5"
                                    : "bg-apple-tertiary/40 border-black/5 hover:border-black/20 hover:bg-apple-tertiary/60 hover:-translate-y-0.5"
                            }`}
                            style={{
                              borderColor:
                                uploadPlatform === platKey ||
                                activeCardDrag === platKey
                                  ? pf.color
                                  : "",
                              boxShadow:
                                uploadPlatform === platKey
                                  ? `0 4px 12px ${pf.color}15, inset 0 0 0 1px ${pf.color}20`
                                  : "",
                              backgroundColor:
                                uploadPlatform === platKey
                                  ? `${pf.color}05`
                                  : activeCardDrag === platKey
                                    ? `${pf.color}15`
                                    : "",
                            }}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                                    style={{ backgroundColor: pf.color }}
                                  />
                                  <span className="text-xs font-black text-apple-primary">
                                    {pf.label}
                                  </span>
                                </div>
                                {uploadPlatform === platKey && (
                                  <span
                                    className="text-[9px] font-black px-1.5 py-0.5 rounded-md border"
                                    style={{
                                      color: pf.color,
                                      backgroundColor: `${pf.color}10`,
                                      borderColor: `${pf.color}15`,
                                    }}
                                  >
                                    กำลังเลือก
                                  </span>
                                )}
                                {activeCardDrag === platKey && (
                                  <span
                                    className="text-[9px] font-black text-white px-1.5 py-0.5 rounded-md animate-pulse"
                                    style={{ backgroundColor: pf.color }}
                                  >
                                    วางไฟล์ที่นี่
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1 mt-2">
                                {hasFile && matchedFile ? (
                                  <div className="text-[10px] font-semibold text-apple-primary">
                                    <p className="text-emerald-500 font-bold flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />{" "}
                                      นําเข้าแคตตาล็อกแล้ว (✓)
                                    </p>
                                    <p
                                      className="text-[9px] text-apple-secondary mt-0.5 font-medium truncate max-w-full"
                                      title={matchedFile.fileName}
                                    >
                                      {matchedFile.fileName}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-[10px] text-apple-secondary font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                                    <span>รายการสินค้า ({pf.label})</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer template download link */}
                    <div className="flex justify-between items-center text-[10px] font-bold text-apple-secondary w-full max-w-2xl pt-2">
                      <span>*ระบบจะวิเคราะห์หัวตารางและนำเข้าสินค้าโดยอัตโนมัติ</span>
                      <button
                        type="button"
                        onClick={downloadTemplate}
                        className="flex items-center gap-1 text-blue-500 hover:underline cursor-pointer border-none bg-transparent font-black"
                      >
                        <Download className="h-3 w-3" />
                        ดาวน์โหลดไฟล์ตัวอย่างนำเข้าสินค้า (.csv)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* STEP 2: PREVIEW & CONFIRM IMPORT (MATCHING SCREENSHOT 2) */
              <div className="space-y-4 animate-fade-in">
                {/* Uploaded Files Tag Row */}
                <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-apple-secondary">
                  <span>ไฟล์ที่อัปโหลด ({uploadedFiles.length}):</span>
                  {uploadedFiles.map((file) => (
                    <span
                      key={file.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {file.fileName}
                    </span>
                  ))}
                </div>

                {/* Amber Warning Summary Alert */}
                <div className="bg-gradient-to-r from-amber-500/[0.06] to-amber-600/[0.03] dark:from-amber-500/[0.04] dark:to-amber-600/[0.02] border border-amber-500/20 dark:border-amber-500/15 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                  <div className="p-1.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                    <AlertTriangle className="h-4.5 w-4.5 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-amber-700 dark:text-amber-400">
                      พบข้อมูลทั้งหมด {allParsedProducts.length.toLocaleString()} รายการ กรุณาตรวจสอบความถูกต้องก่อนยืนยัน
                    </p>
                    <p className="text-[10px] text-amber-650 dark:text-amber-500/80 mt-1 leading-relaxed">
                      ข้อมูลนี้ถูกแสดงผลในโหมดพรีวิว (Local State) เท่านั้น จะยังไม่มีการบันทึกลงฐานข้อมูลหลัก (localStorage) หรืออัปเดตระบบจนกว่าคุณจะกดยืนยันปุ่มด้านล่าง
                    </p>
                  </div>
                </div>

                {/* Step 2 KPIs Summary (4 Cards) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                  {/* Total Products */}
                  <div className="bg-neutral-50 dark:bg-neutral-900/30 border border-black/[0.04] dark:border-white/[0.04] rounded-2xl p-3.5 flex flex-col justify-between min-w-0">
                    <span className="text-[10px] text-neutral-450 dark:text-neutral-500 font-extrabold uppercase tracking-wider truncate" title="รายการสินค้าทั้งหมดพรีวิว (TOTAL PRODUCTS)">
                      รายการสินค้าทั้งหมดพรีวิว
                    </span>
                    <div className="flex items-baseline gap-1 mt-1.5 min-w-0">
                      <span className="text-base sm:text-lg md:text-xl font-bold font-mono tracking-tight text-neutral-800 dark:text-neutral-100 truncate" title={allParsedProducts.length.toLocaleString()}>
                        {allParsedProducts.length.toLocaleString()}
                      </span>
                      <span className="text-xs text-neutral-500 font-semibold ml-1 shrink-0">รายการ</span>
                    </div>
                  </div>

                  {/* Valid Products Ready to Import */}
                  <div className="bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-500/20 rounded-2xl p-3.5 flex flex-col justify-between min-w-0">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-extrabold uppercase tracking-wider flex items-center gap-1 truncate" title="สินค้าพร้อมนำเข้า (VALID PRODUCTS)">
                      <Check className="h-3 w-3 shrink-0" /> สินค้าพร้อมนำเข้า
                    </span>
                    <div className="flex items-baseline gap-1 mt-1.5 min-w-0">
                      <span className="text-base sm:text-lg md:text-xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 truncate" title={validProducts.length.toLocaleString()}>
                        {validProducts.length.toLocaleString()}
                      </span>
                      <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-semibold ml-1 shrink-0">รายการ</span>
                    </div>
                  </div>

                  {/* Warnings / Needs Review */}
                  <div
                    className={`rounded-2xl p-3.5 flex flex-col justify-between min-w-0 border ${
                      warningCount > 0
                        ? "bg-amber-50/20 dark:bg-amber-950/10 border-amber-500/20"
                        : "bg-neutral-50 dark:bg-neutral-900/30 border-black/[0.04] dark:border-white/[0.04]"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider truncate ${
                        warningCount > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-neutral-450 dark:text-neutral-500"
                      }`}
                      title="มีข้อควรตรวจสอบ (WARNINGS)"
                    >
                      มีข้อควรตรวจสอบ
                    </span>
                    <div className="flex items-baseline gap-1 mt-1.5 min-w-0">
                      <span
                        className={`text-base sm:text-lg md:text-xl font-bold font-mono tracking-tight truncate ${
                          warningCount > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-neutral-800 dark:text-neutral-100"
                        }`}
                        title={warningCount.toLocaleString()}
                      >
                        {warningCount.toLocaleString()}
                      </span>
                      <span className="text-xs text-neutral-500 font-semibold ml-1 shrink-0">รายการ</span>
                    </div>
                  </div>

                  {/* Total Stock */}
                  <div className="bg-neutral-50 dark:bg-neutral-900/30 border border-black/[0.04] dark:border-white/[0.04] rounded-2xl p-3.5 flex flex-col justify-between min-w-0">
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold uppercase tracking-wider truncate" title="สต็อกสินค้ารวมพรีวิว (TOTAL STOCK)">
                      สต็อกสินค้ารวมพรีวิว
                    </span>
                    <div className="flex items-baseline gap-1 mt-1.5 min-w-0">
                      <span className="text-base sm:text-lg md:text-xl font-bold font-mono tracking-tight text-blue-600 dark:text-blue-400 truncate" title={totalStockCount.toLocaleString()}>
                        {totalStockCount.toLocaleString()}
                      </span>
                      <span className="text-xs text-blue-500 font-semibold ml-1 shrink-0">ชิ้น</span>
                    </div>
                  </div>
                </div>

                {/* View Mode Toggle Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-apple-primary/10 pb-3">
                  <div>
                    <h4 className="text-xs font-black text-apple-primary uppercase tracking-wider">
                      ตรวจสอบและยืนยันข้อมูล
                    </h4>
                    <p className="text-[10px] text-apple-secondary mt-0.5">
                      วิเคราะห์โครงสร้างข้อมูลสินค้าของระบบล่วงหน้าก่อนยืนยันนำเข้า
                    </p>
                  </div>

                  <div className="flex bg-apple-tertiary/40 p-1 rounded-xl gap-1 border border-apple-primary/5 shadow-inner">
                    <button
                      key="parsed-tab"
                      type="button"
                      onClick={() => setPreviewViewMode("parsed")}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        previewViewMode === "parsed"
                          ? "bg-apple-primary text-apple-secondary shadow-sm"
                          : "text-apple-secondary hover:text-apple-primary bg-transparent"
                      }`}
                    >
                      สินค้าพร้อมนำเข้า ({validProducts.length.toLocaleString()})
                    </button>
                    <button
                      key="raw-tab"
                      type="button"
                      onClick={() => setPreviewViewMode("raw")}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        previewViewMode === "raw"
                          ? "bg-apple-primary text-apple-secondary shadow-sm"
                          : "text-apple-secondary hover:text-apple-primary bg-transparent"
                      }`}
                    >
                      โครงสร้างไฟล์ดิบ ({uploadedFiles.length} ชีต)
                    </button>
                  </div>
                </div>

                {previewViewMode === "parsed" ? (
                  <div className="border border-apple-primary/10 rounded-2xl overflow-hidden bg-apple-secondary flex flex-col flex-1 shadow-sm">
                    {/* Filter & Search Bar */}
                    <div className="p-4 border-b border-apple-primary/10 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-apple-tertiary/20">
                      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-apple-secondary" />
                          <input
                            type="text"
                            placeholder="ค้นหารายการสินค้า (ชื่อสินค้า, SKU, หมวดหมู่, แบรนด์...)"
                            value={previewSearch}
                            onChange={(e) => {
                              setPreviewSearch(e.target.value);
                              setPreviewPage(0);
                            }}
                            className="w-full bg-apple-secondary border border-apple-primary/10 rounded-xl py-1.5 pl-9 pr-4 text-xs text-apple-primary placeholder-apple-secondary focus:outline-none focus:border-apple-primary/30"
                          />
                        </div>

                        {/* File Filter Dropdown */}
                        <select
                          value={previewFileFilter}
                          onChange={(e) => {
                            setPreviewFileFilter(e.target.value);
                            setPreviewPage(0);
                          }}
                          className="bg-apple-secondary border border-apple-primary/10 rounded-xl py-1.5 px-3 text-xs text-apple-primary font-bold focus:outline-none focus:border-apple-primary/30 cursor-pointer shadow-sm min-h-[34px] max-w-[260px] truncate"
                        >
                          <option value="all">
                            📁 ทุกไฟล์ที่อัปโหลด ({allParsedProducts.length.toLocaleString()} รายการ)
                          </option>
                          {uploadedFiles.map((file) => {
                            const count = file.products.length;
                            const platformEmoji =
                              file.platform === "lazada"
                                ? "🔵"
                                : file.platform === "shopee"
                                  ? "🟠"
                                  : file.platform === "tiktok"
                                    ? "🔴"
                                    : "📄";
                            return (
                              <option key={file.id} value={file.id}>
                                {platformEmoji} {file.fileName} ({count.toLocaleString()} รายการ)
                              </option>
                            );
                          })}
                        </select>

                        {/* Category Filter */}
                        <select
                          value={previewCategoryFilter}
                          onChange={(e) => {
                            setPreviewCategoryFilter(e.target.value);
                            setPreviewPage(0);
                          }}
                          className="bg-apple-secondary border border-apple-primary/10 rounded-xl py-1.5 px-3 text-xs text-apple-primary font-bold focus:outline-none focus:border-apple-primary/30 cursor-pointer shadow-sm min-h-[34px]"
                        >
                          <option value="all">ทุกหมวดหมู่</option>
                          <option value="Electronics">Electronics</option>
                          <option value="Apparel">Apparel</option>
                          <option value="Home">Home</option>
                          <option value="Beauty">Beauty</option>
                        </select>
                      </div>

                      <div className="text-[10px] text-apple-secondary font-bold whitespace-nowrap shrink-0">
                        พบข้อมูลที่ตรงเงื่อนไข {filteredPreviewProducts.length.toLocaleString()} จาก {allParsedProducts.length.toLocaleString()} รายการ
                      </div>
                    </div>

                    {/* Products Preview Table */}
                    <div className="overflow-x-auto overflow-y-auto max-h-[340px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 z-10 bg-apple-tertiary/95 backdrop-blur-md">
                          <tr className="border-b border-apple-primary/10">
                            <th className="px-4 py-2.5 text-neutral-400 font-bold text-[10px] uppercase text-center w-12">
                              #
                            </th>
                            <th className="px-4 py-2.5 font-black text-[10px] uppercase text-apple-secondary">
                              ชื่อสินค้า
                            </th>
                            <th className="px-4 py-2.5 font-black text-[10px] uppercase text-apple-secondary">
                              หมวดหมู่
                            </th>
                            <th className="px-4 py-2.5 font-black text-[10px] uppercase text-apple-secondary">
                              แบรนด์
                            </th>
                            <th className="px-4 py-2.5 font-black text-[10px] uppercase text-apple-secondary text-right">
                              ราคาขาย
                            </th>
                            <th className="px-4 py-2.5 font-black text-[10px] uppercase text-apple-secondary text-center">
                              จำนวนสต็อก
                            </th>
                            <th className="px-4 py-2.5 font-black text-[10px] uppercase text-apple-secondary">
                              สถานะการตรวจสอบ
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPreviewProducts
                            .slice(
                              previewPage * previewPageSize,
                              (previewPage + 1) * previewPageSize,
                            )
                            .map((p, idx) => {
                              const rIdx =
                                previewPage * previewPageSize + idx + 1;
                              return (
                                <tr
                                  key={idx}
                                  className="hover:bg-apple-tertiary/30 border-b border-apple-primary/5 transition-colors"
                                >
                                  <td className="px-4 py-2.5 text-center text-apple-secondary font-mono">
                                    {rIdx}
                                  </td>
                                  <td
                                    className="px-4 py-2.5 font-bold text-apple-primary max-w-[220px] truncate"
                                    title={p.name}
                                  >
                                    {p.name || (
                                      <span className="text-rose-500 italic">
                                        ไม่มีชื่อสินค้า
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className="text-[10px] px-2 py-0.5 rounded-lg border bg-apple-primary/5 border-apple-primary/10 text-apple-secondary font-semibold">
                                      {p.category}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-apple-secondary max-w-[120px] truncate">
                                    {p.brand || "-"}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-mono font-bold text-neutral-600 dark:text-neutral-400">
                                    ฿0.00
                                  </td>
                                  <td className="px-4 py-2.5 text-center font-mono font-bold text-apple-primary">
                                    {p.stock.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    {p.warnings ? (
                                      <span className="text-[10px] text-amber-500 font-bold flex items-center gap-1">
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                        {p.warnings}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                                        <Check className="h-3.5 w-3.5 shrink-0" />
                                        พร้อมนำเข้า
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          {filteredPreviewProducts.length === 0 && (
                            <tr>
                              <td
                                colSpan={7}
                                className="px-4 py-8 text-center text-apple-secondary font-bold"
                              >
                                {allParsedProducts.length === 0 ? (
                                  <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto py-3">
                                    <AlertTriangle className="h-6 w-6 text-amber-500" />
                                    <p className="text-xs text-neutral-800 dark:text-neutral-200 font-black">
                                      ไม่พบรายการสินค้าในไฟล์ที่อัปโหลด
                                    </p>
                                    <p className="text-[11px] text-apple-secondary font-normal">
                                      กรุณาตรวจสอบว่าในไฟล์มีคอลัมน์ชื่อสินค้าและราคา หรือดาวน์โหลดไฟล์แม่แบบตัวอย่าง
                                    </p>
                                    <button
                                      type="button"
                                      onClick={downloadTemplate}
                                      className="mt-1 text-xs text-blue-500 font-black hover:underline cursor-pointer border-none bg-transparent flex items-center gap-1"
                                    >
                                      <Download className="h-3.5 w-3.5" /> ดาวน์โหลดไฟล์ตัวอย่าง (.csv)
                                    </button>
                                  </div>
                                ) : (
                                  "ไม่พบรายการสินค้าที่ตรงกับคำค้นหา"
                                )}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {filteredPreviewProducts.length > previewPageSize && (
                      <div className="p-3 border-t border-apple-primary/10 bg-apple-tertiary/10 flex justify-between items-center text-[10px] font-bold text-apple-secondary shrink-0">
                        <span>
                          แสดง {previewPage * previewPageSize + 1} -{" "}
                          {Math.min(
                            (previewPage + 1) * previewPageSize,
                            filteredPreviewProducts.length,
                          )}{" "}
                          จาก {filteredPreviewProducts.length.toLocaleString()} รายการ
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={previewPage === 0}
                            onClick={() => setPreviewPage((p) => p - 1)}
                            className="px-2.5 py-1 rounded-lg bg-apple-secondary border border-apple-primary/10 hover:bg-apple-tertiary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          >
                            ย้อนกลับ
                          </button>
                          <button
                            type="button"
                            disabled={
                              (previewPage + 1) * previewPageSize >=
                              filteredPreviewProducts.length
                            }
                            onClick={() => setPreviewPage((p) => p + 1)}
                            className="px-2.5 py-1 rounded-lg bg-apple-secondary border border-apple-primary/10 hover:bg-apple-tertiary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          >
                            ถัดไป
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Raw File Structure View */
                  <div className="space-y-4">
                    <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                      {uploadedFiles.map((f) => {
                        const pf = PLATFORMS[f.platform] || PLATFORMS.unknown;
                        const isActive = f.id === (activeRawFileId || uploadedFiles[0]?.id);
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setActiveRawFileId(f.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                              isActive
                                ? "bg-apple-primary text-apple-secondary border-transparent shadow-sm"
                                : "bg-apple-secondary border-apple-primary/10 text-apple-secondary hover:bg-apple-tertiary"
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: pf.color }}
                            />
                            <span>
                              {f.fileName} ({f.activeSheetName || "แผ่นงาน 1"})
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {(() => {
                      const currentRawFile =
                        uploadedFiles.find(
                          (f) => f.id === (activeRawFileId || uploadedFiles[0]?.id),
                        ) || uploadedFiles[0];

                      if (!currentRawFile || !currentRawFile.rawRows || currentRawFile.rawRows.length === 0) {
                        return (
                          <div className="p-8 text-center text-apple-secondary font-bold border border-apple-primary/10 rounded-2xl bg-apple-secondary">
                            ไม่พบข้อมูลดิบในไฟล์นี้
                          </div>
                        );
                      }

                      const headers =
                        currentRawFile.rawHeaders && currentRawFile.rawHeaders.length > 0
                          ? currentRawFile.rawHeaders
                          : (currentRawFile.rawRows[0] || []).map((h) => String(h ?? ""));

                      const rows = currentRawFile.rawRows.slice(1);
                      const filteredRaw = rows.filter((r) => {
                        if (!rawSearch) return true;
                        return r.some((c) =>
                          String(c ?? "").toLowerCase().includes(rawSearch.toLowerCase()),
                        );
                      });

                      return (
                        <div className="border border-apple-primary/10 rounded-2xl overflow-hidden bg-apple-secondary flex flex-col flex-1 shadow-sm">
                          <div className="p-4 border-b border-apple-primary/10 flex flex-col sm:flex-row gap-3 justify-between items-center bg-apple-tertiary/20">
                            <div className="relative w-full sm:w-64">
                              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-apple-secondary" />
                              <input
                                type="text"
                                placeholder="ค้นหาในชีตนี้..."
                                value={rawSearch}
                                onChange={(e) => setRawSearch(e.target.value)}
                                className="w-full bg-apple-secondary border border-apple-primary/10 rounded-xl py-1.5 pl-9 pr-4 text-xs text-apple-primary placeholder-apple-secondary focus:outline-none focus:border-apple-primary/30"
                              />
                            </div>
                            <div className="text-[10px] text-apple-secondary font-bold whitespace-nowrap shrink-0">
                              พบข้อมูล {filteredRaw.length.toLocaleString()} แถว ({headers.length} คอลัมน์)
                            </div>
                          </div>

                          <div className="overflow-x-auto overflow-y-auto max-h-[300px]">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead className="sticky top-0 z-10 bg-apple-tertiary/95 backdrop-blur-md">
                                <tr className="border-b border-apple-primary/10">
                                  <th className="px-4 py-2 text-neutral-400 font-bold text-[10px] uppercase text-center w-12">
                                    #
                                  </th>
                                  {headers.map((h, i) => (
                                    <th
                                      key={i}
                                      className="px-4 py-2 font-bold text-[10px] uppercase text-apple-secondary whitespace-nowrap"
                                    >
                                      {h || `คอลัมน์ ${i + 1}`}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {filteredRaw.slice(0, 50).map((row, rIdx) => (
                                  <tr
                                    key={rIdx}
                                    className="hover:bg-apple-tertiary/30 border-b border-apple-primary/5 transition-colors"
                                  >
                                    <td className="px-4 py-2 text-center text-apple-secondary font-mono">
                                      {rIdx + 1}
                                    </td>
                                    {headers.map((_, cIdx) => (
                                      <td
                                        key={cIdx}
                                        className="px-4 py-2 truncate max-w-[200px] text-apple-primary font-mono text-[11px]"
                                      >
                                        {String(row[cIdx] ?? "")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Step 2 Bottom Navigation Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-apple-primary/10">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black text-neutral-600 dark:text-neutral-300 bg-white dark:bg-[#1a1a1a] hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 cursor-pointer transition-all active:scale-95 text-center"
                    >
                      ย้อนกลับ
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer transition-all border border-rose-500/20 text-center"
                    >
                      ล้างข้อมูล
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={validProducts.length === 0}
                    onClick={handleImportSubmit}
                    className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black cursor-pointer flex items-center justify-center gap-2 min-h-[40px] transition-all duration-200 border-none ${
                      validProducts.length === 0
                        ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border border-neutral-200/50 dark:border-neutral-800/50 cursor-not-allowed opacity-50"
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/15 hover:shadow-lg hover:shadow-blue-600/20 active:scale-95"
                    }`}
                  >
                    <Check className="h-4 w-4 stroke-[3px]" />
                    ยืนยันการนำเข้าสินค้า ({validProducts.length.toLocaleString()} รายการ)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 2. ADD ORDER MODAL
// ==========================================
interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSubmit: (order: {
    customerName: string;
    email: string;
    productName: string;
    brand: string;
    channel: Order["channel"];
    total: number;
    quantity: number;
    status: Order["status"];
    date: string;
    shippingFee?: number;
    platformFee?: number;
    netIncome?: number;
  }) => void;
  isDarkMode: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const AddOrderModal: React.FC<AddOrderModalProps> = ({
  isOpen,
  onClose,
  products,
  onSubmit,
  onDirtyChange,
}) => {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [channel, setChannel] = useState<Order["channel"]>("Facebook");
  const [customChannel, setCustomChannel] = useState("");
  const [total, setTotal] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<Order["status"]>("Paid");
  const [date, setDate] = useState("");
  const [shippingFee, setShippingFee] = useState(0);
  const [platformFee, setPlatformFee] = useState(0);
  const [netIncome, setNetIncome] = useState(0);

  const isDirty =
    isOpen &&
    (customerName !== "" ||
      email !== "" ||
      productName !== "" ||
      brand !== "" ||
      channel !== "Facebook" ||
      customChannel !== "" ||
      total !== 0 ||
      quantity !== 1 ||
      shippingFee !== 0 ||
      platformFee !== 0 ||
      netIncome !== 0);

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  const handleTotalChange = (val: number) => {
    setTotal(val);
    setNetIncome(Math.round(Math.max(0, val - platformFee) * 100) / 100);
  };

  const handlePlatformFeeChange = (val: number) => {
    setPlatformFee(val);
    setNetIncome(Math.round(Math.max(0, total - val) * 100) / 100);
  };

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setCustomerName("");
      setEmail("");
      setProductName("");
      setBrand("");
      setChannel("Facebook");
      setCustomChannel("");
      setTotal(0);
      setQuantity(1);
      setStatus("Paid");
      setDate(new Date().toISOString().split("T")[0]);
      setShippingFee(0);
      setPlatformFee(0);
      setNetIncome(0);
    }
  }

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !productName || total <= 0) return;
    onSubmit({
      customerName,
      email,
      productName,
      brand,
      channel: channel === "อื่นๆ" ? customChannel.trim() || "อื่นๆ" : channel,
      total,
      quantity,
      status,
      date,
      shippingFee,
      platformFee,
      netIncome,
    });
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/70 backdrop-blur-[4px] z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-10 transition-all duration-300 mobile-bottom-sheet">
      <div className="w-[92vw] sm:w-[90vw] md:max-w-md max-h-[85vh] my-auto flex flex-col overflow-hidden animate-scale-in rounded-[2rem] border transition-colors duration-500 bg-apple-secondary border-apple-primary shadow-2xl mobile-bottom-sheet-content">
        <div className="px-6 py-5 sm:px-8 flex justify-between items-center bg-apple-tertiary rounded-t-[2rem] shrink-0 border-b border-apple-primary/20">
          <h3 className="font-extrabold text-apple-primary text-base">
            บันทึกยอดขายใหม่
          </h3>
          <button
            onClick={onClose}
            className="text-apple-secondary hover:text-apple-primary hover:bg-black/5 dark:hover:bg-white/8 p-1.5 rounded-full transition-all cursor-pointer flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="p-6 sm:p-8 space-y-5 overflow-y-auto"
        >
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
              ชื่อลูกค้า
            </label>
            <input
              type="text"
              required
              placeholder="ตัวอย่างเช่น นายสมเกียรติ สุขสบาย"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
              ที่อยู่อีเมลลูกค้า
            </label>
            <input
              type="email"
              placeholder="customer@email.com (เว้นว่างได้)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
              เลือกสินค้าจากคลัง
            </label>
            <div className="relative">
              <select
                required
                value={productName}
                onChange={(e) => {
                  const match = products.find((p) => p.name === e.target.value);
                  setProductName(e.target.value);
                  setBrand(match ? match.brand : "");
                  const newTotal = match ? match.price * quantity : 0;
                  setTotal(Math.round(newTotal * 100) / 100);
                  setNetIncome(
                    Math.round(Math.max(0, newTotal - platformFee) * 100) / 100,
                  );
                }}
                className="input-apple w-full rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none cursor-pointer appearance-none bg-apple-secondary/30"
              >
                <option value="">กรุณาเลือกรายการสินค้า...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.name} disabled={p.stock === 0}>
                    {p.name} {p.stock === 0 ? "- สินค้าหมด" : ""}
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-apple-secondary flex items-center justify-center">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                แบรนด์สินค้า
              </label>
              <input
                type="text"
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                ช่องทางขาย
              </label>
              <div className="relative">
                <select
                  value={channel}
                  onChange={(e) =>
                    setChannel(e.target.value as Order["channel"])
                  }
                  className="input-apple w-full rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none cursor-pointer appearance-none bg-apple-secondary/30"
                >
                  <option value="Facebook">Facebook</option>
                  <option value="LINE OA">LINE OA</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-apple-secondary flex items-center justify-center">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>

          {channel === "อื่นๆ" && (
            <div className="animate-fade-in duration-300">
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                ระบุช่องทางขายอื่นๆ
              </label>
              <input
                type="text"
                required
                placeholder="ตัวอย่างเช่น Instagram, Website, หน้าร้าน"
                value={customChannel}
                onChange={(e) => setCustomChannel(e.target.value)}
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                จำนวนชิ้นสินค้า (Quantity)
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setQuantity(val);
                  const match = products.find((p) => p.name === productName);
                  if (match) {
                    const newTotal = match.price * val;
                    setTotal(Math.round(newTotal * 100) / 100);
                    setNetIncome(
                      Math.round(Math.max(0, newTotal - platformFee) * 100) /
                        100,
                    );
                  }
                }}
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                ยอดเงินราคาสุทธิ (Gross THB)
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0"
                value={total || ""}
                onChange={(e) =>
                  handleTotalChange(parseFloat(e.target.value) || 0)
                }
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                ค่าจัดส่ง (บาท)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0"
                value={shippingFee || ""}
                onChange={(e) =>
                  setShippingFee(parseFloat(e.target.value) || 0)
                }
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                ค่าธรรมเนียม (บาท)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0"
                value={platformFee || ""}
                onChange={(e) =>
                  handlePlatformFeeChange(parseFloat(e.target.value) || 0)
                }
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                รายรับสุทธิ (Net THB)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0"
                value={
                  netIncome !== undefined
                    ? Math.round(netIncome * 100) / 100
                    : ""
                }
                onChange={(e) => setNetIncome(parseFloat(e.target.value) || 0)}
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none font-bold text-emerald-500 placeholder:text-apple-secondary/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                สถานะคำสั่งซื้อ
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Order["status"])}
                  className="input-apple w-full rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none cursor-pointer appearance-none bg-apple-secondary/30"
                >
                  <option value="Paid">ชำระแล้ว (Paid)</option>
                  <option value="Pending">รอตรวจสอบเงินโอน (Pending)</option>
                  <option value="Refunded">
                    คืนเงินค่าสินค้าแล้ว (Refunded)
                  </option>
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-apple-secondary flex items-center justify-center">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                วันที่บันทึกยอดขาย
              </label>
              <DatePickerField
                value={date}
                onChange={setDate}
                className="relative flex items-center justify-between input-apple w-full rounded-xl px-4 py-2.5 transition-all cursor-pointer select-none active:scale-[0.97] focus:outline-none bg-apple-secondary/30 border border-neutral-200 dark:border-neutral-800"
                textClassName="text-sm text-apple-primary mr-3 flex-1 text-left"
              />
            </div>
          </div>

          <div className="pt-4 flex flex-col min-[360px]:flex-row min-[360px]:justify-end gap-3 mt-6 border-t border-apple-primary/10">
            <button
              type="button"
              onClick={onClose}
              className="bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-apple-primary px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 w-full min-[360px]:w-auto text-center"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/10 hover:shadow-blue-500/25 active:scale-95 duration-200 w-full min-[360px]:w-auto text-center"
            >
              บันทึกคำสั่งซื้อ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 3. EDIT ORDER MODAL
// ==========================================
interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingOrder: Order | null;
  products: Product[];
  onSubmit: (order: Order) => void;
  isDarkMode: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen,
  onClose,
  editingOrder,
  products,
  onSubmit,
  onDirtyChange,
}) => {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevEditingOrder, setPrevEditingOrder] = useState<Order | null>(
    editingOrder,
  );
  const [localOrder, setLocalOrder] = useState<Order | null>(null);
  const [channelSelect, setChannelSelect] = useState<string>("Facebook");
  const [customChannel, setCustomChannel] = useState<string>("");

  const isDirty =
    isOpen &&
    editingOrder &&
    localOrder &&
    (localOrder.customerName !== (editingOrder.customerName || "") ||
      localOrder.email !== (editingOrder.email || "") ||
      localOrder.productName !== (editingOrder.productName || "") ||
      localOrder.brand !== (editingOrder.brand || "") ||
      localOrder.channel !== (editingOrder.channel || "") ||
      localOrder.total !== (editingOrder.total || 0) ||
      localOrder.quantity !== (editingOrder.quantity || 0) ||
      localOrder.status !== (editingOrder.status || "") ||
      localOrder.date !== (editingOrder.date || "") ||
      localOrder.shippingFee !== (editingOrder.shippingFee || 0) ||
      localOrder.platformFee !== (editingOrder.platformFee || 0) ||
      localOrder.netIncome !== (editingOrder.netIncome || 0));

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(!!isDirty);
    }
  }, [isDirty, onDirtyChange]);

  if (isOpen !== prevIsOpen || editingOrder !== prevEditingOrder) {
    setPrevIsOpen(isOpen);
    setPrevEditingOrder(editingOrder);
    if (isOpen && editingOrder) {
      const orderCopy = { ...editingOrder };
      if (orderCopy.netIncome !== undefined) {
        orderCopy.netIncome = Math.round(orderCopy.netIncome * 100) / 100;
      }
      if (orderCopy.total !== undefined) {
        orderCopy.total = Math.round(orderCopy.total * 100) / 100;
      }
      if (orderCopy.platformFee !== undefined) {
        orderCopy.platformFee = Math.round(orderCopy.platformFee * 100) / 100;
      }
      if (orderCopy.shippingFee !== undefined) {
        orderCopy.shippingFee = Math.round(orderCopy.shippingFee * 100) / 100;
      }
      setLocalOrder(orderCopy);
      if (
        editingOrder.channel === "Facebook" ||
        editingOrder.channel === "LINE OA"
      ) {
        setChannelSelect(editingOrder.channel);
        setCustomChannel("");
      } else {
        setChannelSelect("อื่นๆ");
        setCustomChannel(editingOrder.channel);
      }
    } else {
      setLocalOrder(null);
    }
  }

  if (!isOpen || !localOrder) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localOrder.isIncome) {
      if (!localOrder.productName) return;
    } else {
      if (
        !localOrder.customerName ||
        !localOrder.productName ||
        (localOrder.total || 0) <= 0
      )
        return;
    }
    onSubmit(localOrder);
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/70 backdrop-blur-[4px] z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-10 transition-all duration-300 mobile-bottom-sheet">
      <div className="w-[92vw] sm:w-[90vw] md:max-w-md max-h-[85vh] my-auto flex flex-col overflow-hidden animate-scale-in rounded-[2rem] border transition-colors duration-500 bg-apple-secondary border-apple-primary shadow-2xl mobile-bottom-sheet-content">
        <div className="px-6 py-5 sm:px-8 flex justify-between items-center bg-apple-tertiary rounded-t-[2rem] shrink-0 border-b border-apple-primary/20">
          <h3 className="font-extrabold text-base text-apple-primary">
            แก้ไขรายการธุรกรรมคำสั่งซื้อ
          </h3>
          <button
            onClick={onClose}
            className="text-apple-secondary hover:text-apple-primary hover:bg-black/5 dark:hover:bg-white/8 p-1.5 rounded-full transition-all cursor-pointer flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="p-6 sm:p-8 space-y-5 overflow-y-auto"
        >
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
              รหัสออเดอร์
            </label>
            <input
              type="text"
              disabled
              value={localOrder.id}
              className="input-apple w-full rounded-xl px-4 py-2.5 text-sm opacity-60 focus:outline-none"
            />
          </div>

          {!localOrder.isIncome && (
            <>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                  ชื่อของลูกค้า
                </label>
                <input
                  type="text"
                  required
                  placeholder="ตัวอย่างเช่น นายสมใจ ปิติประเสริฐ"
                  value={localOrder.customerName}
                  onChange={(e) =>
                    setLocalOrder({
                      ...localOrder,
                      customerName: e.target.value,
                    })
                  }
                  className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                  ที่อยู่อีเมลลูกค้า
                </label>
                <input
                  type="email"
                  value={localOrder.email}
                  onChange={(e) =>
                    setLocalOrder({ ...localOrder, email: e.target.value })
                  }
                  className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                สินค้า
              </label>
              {localOrder.isIncome ? (
                <input
                  type="text"
                  required
                  value={localOrder.productName}
                  onChange={(e) =>
                    setLocalOrder({
                      ...localOrder,
                      productName: e.target.value,
                    })
                  }
                  className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
                />
              ) : (
                <div className="relative">
                  <select
                    required
                    value={localOrder.productName}
                    onChange={(e) => {
                      const match = products.find(
                        (p) => p.name === e.target.value,
                      );
                      const newTotal = match
                        ? match.price * (localOrder.quantity || 1)
                        : localOrder.total || 0;
                      setLocalOrder({
                        ...localOrder,
                        productName: e.target.value,
                        brand: match ? match.brand : localOrder.brand,
                        total: Math.round(newTotal * 100) / 100,
                        netIncome:
                          Math.round(
                            Math.max(
                              0,
                              newTotal - (localOrder.platformFee || 0),
                            ) * 100,
                          ) / 100,
                      });
                    }}
                    className="input-apple w-full rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none cursor-pointer appearance-none bg-apple-secondary/30"
                  >
                    <option value="">กรุณาเลือกรายการสินค้า...</option>
                    {products.map((p) => {
                      const isCurrentProduct =
                        p.name === editingOrder?.productName;
                      const isOutOfStock = p.stock === 0;
                      return (
                        <option
                          key={p.id}
                          value={p.name}
                          disabled={isOutOfStock && !isCurrentProduct}
                        >
                          {p.name}{" "}
                          {isOutOfStock && !isCurrentProduct
                            ? "- สินค้าหมด"
                            : ""}
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-apple-secondary flex items-center justify-center">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                แบรนด์สินค้า
              </label>
              <input
                type="text"
                required={!localOrder.isIncome}
                value={localOrder.brand}
                onChange={(e) =>
                  setLocalOrder({ ...localOrder, brand: e.target.value })
                }
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                จำนวนชิ้นสินค้า (Quantity)
              </label>
              <input
                type="number"
                min="1"
                required
                value={localOrder.quantity || 1}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  const match = products.find(
                    (p) => p.name === localOrder.productName,
                  );
                  const newTotal = match
                    ? match.price * val
                    : localOrder.total || 0;
                  setLocalOrder({
                    ...localOrder,
                    quantity: val,
                    total: Math.round(newTotal * 100) / 100,
                    netIncome:
                      Math.round(
                        Math.max(0, newTotal - (localOrder.platformFee || 0)) *
                          100,
                      ) / 100,
                  });
                }}
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                ยอดเงินราคาสุทธิ (Gross THB)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={localOrder.total}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setLocalOrder({
                    ...localOrder,
                    total: val,
                    netIncome:
                      Math.round(
                        Math.max(0, val - (localOrder.platformFee || 0)) * 100,
                      ) / 100,
                  });
                }}
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                ค่าจัดส่ง (บาท)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0"
                value={localOrder.shippingFee || ""}
                onChange={(e) =>
                  setLocalOrder({
                    ...localOrder,
                    shippingFee: parseFloat(e.target.value) || 0,
                  })
                }
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                ค่าธรรมเนียม (บาท)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0"
                value={localOrder.platformFee || ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setLocalOrder({
                    ...localOrder,
                    platformFee: val,
                    netIncome:
                      Math.round(
                        Math.max(0, (localOrder.total || 0) - val) * 100,
                      ) / 100,
                  });
                }}
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                รายรับสุทธิ (Net THB)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0"
                value={
                  localOrder.netIncome !== undefined
                    ? Math.round(localOrder.netIncome * 100) / 100
                    : ""
                }
                onChange={(e) =>
                  setLocalOrder({
                    ...localOrder,
                    netIncome: parseFloat(e.target.value) || 0,
                  })
                }
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none font-bold text-emerald-500 placeholder:text-apple-secondary/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                สถานะชำระเงิน
              </label>
              <div className="relative">
                <select
                  value={localOrder.status}
                  onChange={(e) =>
                    setLocalOrder({
                      ...localOrder,
                      status: e.target.value as Order["status"],
                    })
                  }
                  className="input-apple w-full rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none cursor-pointer appearance-none bg-apple-secondary/30"
                >
                  <option value="Paid">ชำระเงินเรียบร้อย (Paid)</option>
                  <option value="Pending">รอตรวจสอบเงินโอน (Pending)</option>
                  <option value="Refunded">
                    ยกเลิกรายการคืนเงิน (Refunded)
                  </option>
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-apple-secondary flex items-center justify-center">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                ช่องทางขาย
              </label>
              <div className="relative">
                <select
                  value={channelSelect}
                  onChange={(e) => {
                    setChannelSelect(e.target.value);
                    if (localOrder) {
                      const targetChannel =
                        e.target.value === "อื่นๆ"
                          ? customChannel.trim() || "อื่นๆ"
                          : e.target.value;
                      setLocalOrder({ ...localOrder, channel: targetChannel });
                    }
                  }}
                  className="input-apple w-full rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none cursor-pointer appearance-none bg-apple-secondary/30"
                >
                  <option value="Facebook">Facebook</option>
                  <option value="LINE OA">LINE OA</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-apple-secondary flex items-center justify-center">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>

          {channelSelect === "อื่นๆ" && (
            <div className="animate-fade-in duration-300">
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                ระบุช่องทางขายอื่นๆ
              </label>
              <input
                type="text"
                required
                placeholder="ตัวอย่างเช่น Instagram, Website, หน้าร้าน"
                value={customChannel}
                onChange={(e) => {
                  setCustomChannel(e.target.value);
                  if (localOrder) {
                    setLocalOrder({
                      ...localOrder,
                      channel: e.target.value.trim() || "อื่นๆ",
                    });
                  }
                }}
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                วันที่บันทึก
              </label>
              <DatePickerField
                value={localOrder.date}
                onChange={(val) => setLocalOrder({ ...localOrder, date: val })}
                className="relative flex items-center justify-between input-apple w-full rounded-xl px-4 py-2.5 transition-all cursor-pointer select-none active:scale-[0.97] focus:outline-none bg-apple-secondary/30 border border-neutral-200 dark:border-neutral-800"
                textClassName="text-sm text-apple-primary mr-3 flex-1 text-left"
              />
            </div>
          </div>

          <div className="pt-4 flex flex-col min-[360px]:flex-row min-[360px]:justify-end gap-3 mt-6 border-t border-apple-primary/10">
            <button
              type="button"
              onClick={onClose}
              className="bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-apple-primary px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 w-full min-[360px]:w-auto text-center"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/10 hover:shadow-blue-500/25 active:scale-95 duration-200 w-full min-[360px]:w-auto text-center"
            >
              บันทึกการแก้ไข
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 4. ADD USER ACCOUNT MODAL
// ==========================================
interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  onSubmit: (user: {
    name: string;
    email: string;
    role: AppUser["role"];
    password: string;
    tasks?: string[];
  }) => void;
  isDarkMode: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSubmit,
  isDarkMode,
  onDirtyChange,
}) => {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppUser["role"]>("User");
  const [password, setPassword] = useState("");
  const [tasks, setTasks] = useState<string[]>([
    "ดูแดชบอร์ด",
    "ดูรายงานยอดขาย",
    "เครื่องคำนวณส่วนต่าง",
    "นำเข้าข้อมูล Excel",
  ]);

  const defaultTasksForRole = (r: AppUser["role"]) => {
    if (r === "Manager") {
      return [
        "ดูแดชบอร์ด",
        "ดูรายงานยอดขาย",
        "เครื่องคำนวณส่วนต่าง",
        "นำเข้าข้อมูล Excel",
        "จัดการผู้ใช้งาน",
      ];
    }
    return [
      "ดูแดชบอร์ด",
      "ดูรายงานยอดขาย",
      "เครื่องคำนวณส่วนต่าง",
      "นำเข้าข้อมูล Excel",
    ];
  };

  const isDirty =
    isOpen &&
    (name !== "" || email !== "" || role !== "User" || password !== "");

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setName("");
      setEmail("");
      setRole("User");
      setPassword("");
      setTasks(defaultTasksForRole("User"));
    }
  }

  if (!isOpen) return null;

  const handleRoleChange = (newRole: AppUser["role"]) => {
    setRole(newRole);
    setTasks(defaultTasksForRole(newRole));
  };

  const toggleTask = (taskKey: string) => {
    setTasks((prev) =>
      prev.includes(taskKey)
        ? prev.filter((t) => t !== taskKey)
        : [...prev, taskKey],
    );
  };

  const availableTaskOptions = [
    {
      key: "ดูแดชบอร์ด",
      label: "ดูแดชบอร์ดภาพรวม",
      desc: "กราฟและสถิติยอดขายรวม",
    },
    {
      key: "ดูรายงานยอดขาย",
      label: "ดูรายงานยอดขาย",
      desc: "รายการสั่งซื้อและประวัติการขาย",
    },
    {
      key: "เครื่องคำนวณส่วนต่าง",
      label: "เครื่องคำนวณส่วนต่าง",
      desc: "คำนวณส่วนแบ่งและต้นทุน",
    },
    {
      key: "นำเข้าข้อมูล Excel",
      label: "นำเข้าข้อมูล Excel",
      desc: "อัปโหลดไฟล์ยอดขายและสินค้า",
    },
    ...(role === "Manager" || currentUser?.role === "Admin"
      ? [
          {
            key: "จัดการผู้ใช้งาน",
            label: "จัดการผู้ใช้งาน",
            desc: "เปิด/ปิดสิทธิ์ทีมงาน",
          },
        ]
      : []),
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    const finalTasks = tasks.length > 0 ? tasks : defaultTasksForRole(role);
    onSubmit({ name, email, role, password, tasks: finalTasks });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-10 transition-all duration-300 animate-fade-in">
      <div className="w-full max-w-lg max-h-[90vh] my-auto flex flex-col overflow-hidden animate-scale-in rounded-3xl border border-apple-primary/15 bg-apple-secondary shadow-2xl">
        <div className="px-6 py-5 flex justify-between items-center bg-apple-tertiary shrink-0 border-b border-apple-primary/10">
          <div>
            <h3 className="font-black text-base text-apple-primary">
              เพิ่มบัญชีผู้ใช้งานใหม่
            </h3>
            <p className="text-xs text-apple-secondary mt-0.5">
              สร้างบัญชีและกำหนดสิทธิ์การเข้าถึงข้อมูลระบบสำหรับทีมงาน
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-apple-secondary hover:text-apple-primary hover:bg-apple-primary/5 p-1.5 rounded-full transition-all cursor-pointer flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4.5 overflow-y-auto"
        >
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
              ชื่อ - นามสกุล หรือชื่อเรียก
            </label>
            <input
              type="text"
              required
              placeholder="เช่น สมพร ดีเลิศ"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-apple w-full rounded-2xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
              อีเมลสำหรับเข้าสู่ระบบ (Email)
            </label>
            <input
              type="email"
              required
              placeholder="user@phanvadee.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-apple w-full rounded-2xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
              ระดับบทบาท (Role)
            </label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as AppUser["role"])}
                className="input-apple w-full rounded-2xl pl-4 pr-10 py-2.5 text-sm focus:outline-none cursor-pointer appearance-none"
              >
                <option value="User">
                  พนักงานทั่วไป (Staff - สิทธิ์ตามที่กำหนด)
                </option>
                {currentUser?.role === "Admin" && (
                  <option value="Manager">
                    ผู้จัดการ (Manager - จัดการร้านและพนักงาน)
                  </option>
                )}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-apple-secondary flex items-center justify-center">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
              รหัสผ่านเริ่มต้น (Password)
            </label>
            <input
              type="password"
              required
              placeholder="อย่างน้อย 6 ตัวอักษร"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-apple w-full rounded-2xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
            />
          </div>

          {/* Task Permissions Checklist */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-apple-secondary">
                สิทธิ์การเข้าถึงเมนูและฟีเจอร์ ({tasks.length}/{availableTaskOptions.length})
              </label>
              <button
                type="button"
                onClick={() => setTasks(availableTaskOptions.map((o) => o.key))}
                className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                เลือกทั้งหมด
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-black/5 dark:bg-white/5 p-3 rounded-2xl border border-apple-primary/10">
              {availableTaskOptions.map((opt) => {
                const isSelected = tasks.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleTask(opt.key)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                      isSelected
                        ? isDarkMode
                          ? "bg-blue-950/40 border-blue-500/40 text-white shadow-xs"
                          : "bg-blue-50/80 border-blue-200 text-blue-950 shadow-xs"
                        : isDarkMode
                          ? "bg-transparent border-white/5 text-neutral-400 hover:bg-white/5"
                          : "bg-transparent border-black/5 text-neutral-500 hover:bg-black/5"
                    }`}
                  >
                    <div
                      className={`mt-0.5 h-4 w-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-neutral-400 dark:border-neutral-600 bg-transparent"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-tight">{opt.label}</p>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-tight mt-0.5 truncate">
                        {opt.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-apple-primary/10 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-apple-secondary hover:text-apple-primary hover:bg-apple-primary/5 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 shadow-sm"
            >
              สร้างบัญชีใหม่
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 5. CONFIRMATION MODAL
// ==========================================
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: {
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    icon?: "trash" | "warning" | "info" | "danger";
    allowedRoles?: ("Admin" | "Manager" | "Staff" | "Viewer")[];
  } | null;
  isDarkMode: boolean;
  currentUser?: AppUser | null;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  config,
  isDarkMode,
  currentUser,
}) => {
  if (!isOpen || !config) return null;

  const isDeleteAction = config.icon === "trash" || !config.icon;
  // Only Admin and Manager are allowed to confirm deletion actions
  const isAuthorized =
    !isDeleteAction ||
    !currentUser ||
    currentUser.role === "Admin" ||
    currentUser.role === "Manager";

  return (
    <div className="fixed inset-0 bg-neutral-900/75 backdrop-blur-[6px] z-[100] flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-10 transition-all duration-300 animate-fade-in mobile-bottom-sheet">
      <div className="w-[94vw] sm:w-[90vw] md:max-w-md max-h-[85vh] my-auto overflow-hidden animate-scale-in p-6 sm:p-7 rounded-[2rem] border transition-colors duration-500 bg-apple-secondary border-apple-primary shadow-2xl mobile-bottom-sheet-content">
        <div className="flex items-start gap-4 mb-4">
          <div
            className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              isDeleteAction
                ? isDarkMode
                  ? "bg-red-500/15 border-red-500/30 text-red-400 shadow-lg shadow-red-500/10"
                  : "bg-red-50 border-red-200 text-red-600 shadow-sm"
                : isDarkMode
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                  : "bg-amber-50 border-amber-200 text-amber-600"
            }`}
          >
            {isDeleteAction ? (
              <Trash2 className="h-6 w-6 animate-pulse" />
            ) : (
              <AlertTriangle className="h-6 w-6" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-lg text-apple-primary leading-tight">
                {config.title}
              </h3>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider mt-1 text-apple-secondary flex items-center gap-1.5">
              {isDeleteAction ? (
                <span className="text-red-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-ping"></span>
                  การดำเนินการลบข้อมูลถาวร
                </span>
              ) : (
                "กรุณายืนยันการทำรายการ"
              )}
            </p>
          </div>
        </div>

        {/* Role & Permission Status Banner */}
        <div
          className={`p-3.5 rounded-xl text-xs mb-5 flex items-center gap-2.5 border ${
            isAuthorized
              ? isDarkMode
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
              : isDarkMode
                ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {isAuthorized ? (
            <>
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
              <div>
                <span className="font-bold">สิทธิ์ที่สามารถยืนยันได้: </span>
                <span>เฉพาะ แอดมิน (Admin) และ ผู้จัดการ (Manager)</span>
                {currentUser && (
                  <span className="block text-[10px] opacity-85 mt-0.5">
                    ผู้ดำเนินการปัจจุบัน: <strong className="underline">{currentUser.name}</strong> ({currentUser.role}) ✅ ได้รับอนุญาต
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 shrink-0 text-rose-500" />
              <div>
                <span className="font-bold">ไม่มีสิทธิ์ลบข้อมูล: </span>
                <span>เฉพาะ แอดมิน (Admin) และ ผู้จัดการ (Manager) เท่านั้นที่มีสิทธิ์กดยืนยันการลบ</span>
              </div>
            </>
          )}
        </div>

        <div className={`p-4 rounded-xl text-sm leading-relaxed mb-6 border ${
          isDarkMode ? "bg-white/3 border-white/6 text-neutral-300" : "bg-neutral-50 border-neutral-200 text-neutral-700"
        }`}>
          {config.message}
        </div>

        <div className="pt-2 flex flex-col-reverse min-[360px]:flex-row min-[360px]:justify-end gap-2.5 border-t border-apple-primary/10">
          <button
            type="button"
            onClick={onClose}
            className="bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-apple-primary px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all duration-200 w-full min-[360px]:w-auto text-center"
          >
            {config.cancelText || "ยกเลิก"}
          </button>
          {isAuthorized ? (
            <button
              type="button"
              onClick={() => {
                config.onConfirm();
                onClose();
              }}
              className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-200 cursor-pointer w-full min-[360px]:w-auto text-center flex items-center justify-center gap-2 shadow-lg ${
                isDeleteAction
                  ? "bg-red-600 hover:bg-red-700 active:scale-95 text-white shadow-red-500/30"
                  : isDarkMode
                    ? "bg-white hover:bg-neutral-200 text-black shadow-white/10"
                    : "bg-black hover:bg-neutral-800 text-white shadow-black/10"
              }`}
            >
              {isDeleteAction && <Trash2 className="h-4 w-4" />}
              {config.confirmText || (isDeleteAction ? "ยืนยันการลบข้อมูล" : "ยืนยัน")}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="bg-neutral-500/20 text-neutral-400 px-5 py-2.5 rounded-xl text-sm font-bold cursor-not-allowed opacity-60 flex items-center justify-center gap-1.5 w-full min-[360px]:w-auto"
            >
              <Lock className="h-3.5 w-3.5" />
              ไม่มีสิทธิ์ยืนยัน
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 6. EDIT PRODUCT MODAL
// ==========================================
interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  onSubmit: (product: Product) => void;
  isDarkMode: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  onClose,
  editingProduct,
  onSubmit,
  onDirtyChange,
}) => {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevProduct, setPrevProduct] = useState<Product | null>(
    editingProduct,
  );

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Product["category"]>("Electronics");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [sales, setSales] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [image, setImage] = useState("");

  const isDirty =
    isOpen &&
    editingProduct &&
    (name !== (editingProduct.name || "") ||
      category !== (editingProduct.category || "Electronics") ||
      brand !== (editingProduct.brand || "") ||
      price !== (editingProduct.price || 0) ||
      stock !== (editingProduct.stock || 0) ||
      sales !== (editingProduct.sales || 0) ||
      revenue !== (editingProduct.revenue || 0) ||
      image !== (editingProduct.image || ""));

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(!!isDirty);
    }
  }, [isDirty, onDirtyChange]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (isOpen !== prevIsOpen || editingProduct !== prevProduct) {
    setPrevIsOpen(isOpen);
    setPrevProduct(editingProduct);
    if (isOpen && editingProduct) {
      setName(editingProduct.name);
      setCategory(editingProduct.category);
      setBrand(editingProduct.brand || "");
      setPrice(editingProduct.price);
      setStock(editingProduct.stock);
      setSales(editingProduct.sales || 0);
      setRevenue(editingProduct.revenue || 0);
      setImage(editingProduct.image || "");
    }
  }

  if (!isOpen || !editingProduct) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || price <= 0) return;
    onSubmit({
      ...editingProduct,
      name,
      category,
      brand: brand || "ทั่วไป",
      price,
      stock,
      sales,
      revenue,
      status:
        stock === 0 ? "Out of Stock" : stock <= 10 ? "Low Stock" : "In Stock",
      image,
    });
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/70 backdrop-blur-[4px] z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-10 transition-all duration-300 mobile-bottom-sheet">
      <div className="w-[92vw] sm:w-[90vw] md:max-w-md max-h-[85vh] my-auto flex flex-col overflow-hidden animate-scale-in rounded-[2rem] border transition-colors duration-500 bg-apple-secondary border-apple-primary shadow-2xl mobile-bottom-sheet-content">
        <div className="px-6 py-5 sm:px-8 flex justify-between items-center bg-apple-tertiary rounded-t-[2rem] shrink-0 border-b border-apple-primary/20">
          <h3 className="font-extrabold text-apple-primary text-base">
            แก้ไขรายละเอียดสินค้า
          </h3>
          <button
            onClick={onClose}
            className="text-apple-secondary hover:text-apple-primary hover:bg-black/5 dark:hover:bg-white/8 p-1.5 rounded-full transition-all cursor-pointer flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="p-6 sm:p-8 space-y-5 overflow-y-auto"
        >
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
              ชื่อรายละเอียดสินค้า
            </label>
            <input
              type="text"
              required
              placeholder="ตัวอย่างเช่น แป้นพิมพ์บลูทูธไร้สาย"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
              รูปภาพสินค้า
            </label>
            {image ? (
              <div className="relative group rounded-2xl overflow-hidden border border-apple-primary/10 aspect-video w-full max-h-[160px] bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <img
                  src={image}
                  alt="Product preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <label className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full cursor-pointer backdrop-blur-xs transition-all active:scale-90 flex items-center justify-center">
                    <Edit className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setImage("")}
                    className="p-2 bg-rose-500/80 hover:bg-rose-500 text-white rounded-full cursor-pointer backdrop-blur-xs transition-all active:scale-90 flex items-center justify-center border-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-400 bg-apple-secondary/35 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/30 rounded-2xl p-6 cursor-pointer transition-all min-h-[120px]">
                <Image className="h-6 w-6 text-neutral-400 dark:text-neutral-500 mb-2" />
                <span className="text-xs font-bold text-apple-secondary">
                  คลิกเพื่อเลือกรูปภาพสินค้า
                </span>
                <span className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1">
                  รองรับ JPG, PNG, GIF
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                หมวดหมู่หลัก
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as Product["category"])
                  }
                  className="input-apple w-full rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none cursor-pointer appearance-none bg-apple-secondary/30"
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Apparel">Apparel</option>
                  <option value="Home">Home</option>
                  <option value="Beauty">Beauty</option>
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-apple-secondary flex items-center justify-center">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                แบรนด์สินค้า
              </label>
              <input
                type="text"
                required
                placeholder="แบรนด์สินค้า"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="input-apple w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                ราคา (บาท)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="0"
                  value={price || ""}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="input-apple w-full rounded-xl pl-4 pr-12 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-apple-secondary/60 select-none pointer-events-none">
                  บาท
                </span>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                จำนวนสินค้าคงเหลือ
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="0"
                  value={stock || ""}
                  onChange={(e) => setStock(parseInt(e.target.value) || 0)}
                  className="input-apple w-full rounded-xl pl-4 pr-12 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-apple-secondary/60 select-none pointer-events-none">
                  ชิ้น
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                จำนวนที่ขายได้ (ชิ้น)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="0"
                  value={sales || ""}
                  onChange={(e) => setSales(parseInt(e.target.value) || 0)}
                  className="input-apple w-full rounded-xl pl-4 pr-12 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-apple-secondary/60 select-none pointer-events-none">
                  ชิ้น
                </span>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 text-apple-secondary">
                รายได้สะสม (บาท)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="0"
                  value={revenue || ""}
                  onChange={(e) => setRevenue(parseFloat(e.target.value) || 0)}
                  className="input-apple w-full rounded-xl pl-4 pr-12 py-2.5 text-sm focus:outline-none placeholder:text-apple-secondary/40"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-apple-secondary/60 select-none pointer-events-none">
                  บาท
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col min-[360px]:flex-row min-[360px]:justify-end gap-3 mt-6 border-t border-apple-primary/10">
            <button
              type="button"
              onClick={onClose}
              className="bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-apple-primary px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 w-full min-[360px]:w-auto text-center"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/10 hover:shadow-blue-500/25 active:scale-95 duration-200 w-full min-[360px]:w-auto text-center"
            >
              บันทึกการแก้ไข
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 7. AUDIT LOGS POPUP MODAL
// ==========================================
interface ParsedLogData {
  customerName?: string;
  name?: string;
  email?: string;
  productName?: string;
  brand?: string;
  channel?: string;
  total?: number;
  status?: string;
  date?: string;
  role?: string;
  username?: string;
  category?: string;
  price?: number;
  stock?: number;
  image?: string;
}

const DataComparison: React.FC<{
  targetType:
    | "order"
    | "product"
    | "user"
    | "income"
    | "orderRecord"
    | "incomeRecord";
  prev?: string;
  curr?: string;
  formatCurrency: (val: number) => string;
  isDelete: boolean;
}> = ({ targetType, prev, curr, formatCurrency, isDelete }) => {
  let pObj: ParsedLogData | null = null;
  let cObj: ParsedLogData | null = null;

  try {
    if (prev) pObj = JSON.parse(prev) as ParsedLogData;
    if (curr) cObj = JSON.parse(curr) as ParsedLogData;
  } catch (e) {
    console.error(e);
  }

  const renderField = (
    label: string,
    field: keyof ParsedLogData,
    format?: (v: string | number) => string,
  ) => {
    const pVal = pObj?.[field];
    const cVal = cObj?.[field];
    const changed = pVal !== cVal && pVal !== undefined && cVal !== undefined;

    const display = (v: string | number | undefined): React.ReactNode => {
      if (v === undefined) return "—";
      if (format) return format(v as string | number);
      if (field === "customerName" && typeof v === "string")
        return maskCustomerName(v);
      if (field === "email" && typeof v === "string") return maskEmail(v);
      if (
        field === "image" &&
        typeof v === "string" &&
        v.startsWith("data:image")
      ) {
        return (
          <img
            src={v}
            alt="Preview"
            className="w-8 h-8 rounded-md object-cover border border-apple-primary/10 inline-block align-middle"
          />
        );
      }
      return String(v);
    };

    return (
      <div className="grid grid-cols-3 gap-3 py-2 border-b border-apple-primary/10 text-xs last:border-0 items-center">
        <span className="font-bold text-apple-secondary">{label}</span>
        <span
          className={`text-neutral-500 dark:text-neutral-450 ${changed ? "line-through opacity-60" : ""}`}
        >
          {display(pVal)}
        </span>
        <span
          className={`break-all ${changed ? "text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded" : "text-apple-primary font-medium"}`}
        >
          {display(cVal)}
        </span>
      </div>
    );
  };

  if (isDelete) {
    return (
      <div className="mt-3 p-4 rounded-xl bg-rose-500/5 dark:bg-rose-950/5 border border-rose-500/10 dark:border-rose-900/20 space-y-0 animate-scale-in text-xs">
        <div className="pb-2 mb-1.5 border-b border-rose-500/10 dark:border-rose-900/30 text-[9px] font-black text-rose-500 dark:text-rose-450 uppercase tracking-widest">
          ข้อมูลที่ถูกลบ
        </div>
        {Object.entries(pObj || {}).map(([key, val]) => {
          const fieldLabels: Record<string, string> = {
            image: "รูปภาพสินค้า",
            customerName: "ชื่อลูกค้า",
            email: "อีเมล",
            productName: "สินค้า",
            brand: "แบรนด์",
            channel: "ช่องทาง",
            total: "ยอดรวม",
            status: "สถานะ",
            date: "วันที่",
            name: "ชื่อสินค้า",
            category: "หมวดหมู่",
            price: "ราคา",
            stock: "จำนวนคลัง",
            username: "Username",
            role: "ระดับสิทธิ์",
          };
          if (!fieldLabels[key] || val === undefined || val === null)
            return null;
          const displayVal = (): React.ReactNode => {
            if (
              key === "image" &&
              typeof val === "string" &&
              val.startsWith("data:image")
            ) {
              return (
                <img
                  src={val}
                  alt="Deleted product"
                  className="w-8 h-8 rounded-md object-cover border border-rose-200 dark:border-rose-900/30 inline-block align-middle"
                />
              );
            }
            if ((key === "total" || key === "price") && typeof val === "number")
              return formatCurrency(val);
            if ((key === "total" || key === "price") && typeof val === "string")
              return formatCurrency(Number(val));
            if (key === "customerName" && typeof val === "string")
              return maskCustomerName(val);
            if (key === "email" && typeof val === "string")
              return maskEmail(val);
            return String(val);
          };
          return (
            <div
              key={key}
              className="grid grid-cols-2 gap-3 py-2 border-b border-rose-500/5 dark:border-rose-900/5 last:border-0 items-center"
            >
              <span className="font-bold text-rose-700 dark:text-rose-450">
                {fieldLabels[key]}
              </span>
              <span className="text-neutral-600 dark:text-neutral-450 font-medium break-all">
                {displayVal()}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-3 p-4 rounded-xl bg-apple-primary border border-apple-primary/10 space-y-0 animate-scale-in">
      <div className="grid grid-cols-3 gap-3 pb-2 mb-1 border-b border-apple-primary/10 text-[9px] font-black text-apple-tertiary uppercase tracking-widest">
        <span>ฟิลด์</span>
        <span>ข้อมูลเดิม</span>
        <span>ข้อมูลใหม่</span>
      </div>
      {targetType === "order" ||
      targetType === "income" ||
      targetType === "orderRecord" ||
      targetType === "incomeRecord" ? (
        <>
          {renderField("ชื่อลูกค้า", "customerName")}
          {renderField("อีเมล", "email")}
          {renderField("สินค้า", "productName")}
          {renderField("แบรนด์", "brand")}
          {renderField("ช่องทาง", "channel")}
          {renderField("ยอดรวม", "total", (v) => formatCurrency(Number(v)))}
          {renderField("สถานะ", "status")}
          {renderField("วันที่", "date")}
        </>
      ) : targetType === "product" ? (
        <>
          {renderField("รูปภาพสินค้า", "image")}
          {renderField("ชื่อสินค้า", "name")}
          {renderField("หมวดหมู่", "category")}
          {renderField("แบรนด์", "brand")}
          {renderField("ราคา", "price", (v) => formatCurrency(Number(v)))}
          {renderField("จำนวนคลัง", "stock")}
          {renderField("สถานะคลัง", "status")}
        </>
      ) : (
        <>
          {renderField("ชื่อผู้ใช้งาน", "name")}
          {renderField("อีเมลเข้าใช้งาน", "email")}
          {renderField("Username", "username")}
          {renderField("ระดับสิทธิ์", "role")}
          {renderField("สถานะบัญชี", "status")}
        </>
      )}
    </div>
  );
};

const highlightText = (text: string, query: string) => {
  if (!query) return <span>{text}</span>;
  const parts = text.split(
    new RegExp(`(${query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")})`, "gi"),
  );
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-100 font-bold px-0.5 rounded"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </span>
  );
};

const AuditLogEntry: React.FC<{
  log: AuditLog;
  formatCurrency: (val: number) => string;
  searchQuery: string;
}> = ({ log, formatCurrency, searchQuery }) => {
  const [expanded, setExpanded] = useState(false);
  const isDelete = log.action === "Delete";
  const isImport = log.action === "Import";
  const isSystem = log.action === "System";

  const changes = useMemo(() => {
    if (!log.previousData || !log.newData) return [];
    try {
      const prevObj = JSON.parse(log.previousData);
      const newObj = JSON.parse(log.newData);
      const list: string[] = [];

      const fieldLabels: Record<string, string> = {
        customerName: "ชื่อลูกค้า",
        email: "อีเมล",
        productName: "สินค้า",
        brand: "แบรนด์",
        channel: "ช่องทาง",
        total: "ยอดรวม",
        status: "สถานะ",
        date: "วันที่",
        name: "ชื่อสินค้า",
        category: "หมวดหมู่",
        price: "ราคา",
        stock: "จำนวนคลัง",
        username: "Username",
        role: "ระดับสิทธิ์",
      };

      Object.keys(newObj).forEach((key) => {
        if (prevObj[key] !== newObj[key] && fieldLabels[key]) {
          list.push(fieldLabels[key]);
        }
      });
      return list;
    } catch {
      return [];
    }
  }, [log.previousData, log.newData]);

  return (
    <div
      onClick={() => {
        if (log.previousData || log.newData) {
          setExpanded(!expanded);
        }
      }}
      className={`px-2.5 py-3.5 border-b border-apple-primary/10 transition-all duration-200 animate-fade-up-row ${
        expanded
          ? "bg-neutral-50/50 dark:bg-neutral-900/30 shadow-inner"
          : "hover:bg-neutral-100/30 dark:hover:bg-neutral-800/35"
      } ${log.previousData || log.newData ? "cursor-pointer active:opacity-95" : ""}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className="font-mono text-[10px] font-bold text-apple-secondary bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
              {highlightText(log.id, searchQuery)}
            </span>
            <span
              className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                isDelete
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-450"
                  : isImport
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-450"
                    : isSystem
                      ? "bg-purple-500/10 text-purple-600 dark:text-purple-450"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-450"
              }`}
            >
              {isDelete
                ? "ลบข้อมูล"
                : isImport
                  ? "นำเข้าข้อมูล"
                  : isSystem
                    ? "ระบบ"
                    : "แก้ไขข้อมูล"}
            </span>
            <span className="font-bold text-xs text-apple-primary line-clamp-1">
              {highlightText(log.details, searchQuery)}
              {changes.length > 0 && (
                <span className="text-[10px] text-neutral-400 font-normal ml-2">
                  (แก้ไข: {changes.join(", ")})
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-apple-tertiary font-semibold">
            <span>
              โดย:{" "}
              <strong className="text-apple-secondary">
                {highlightText(log.performedBy, searchQuery)}
              </strong>
            </span>
            <span>·</span>
            <span className="text-neutral-400 dark:text-neutral-500 font-medium">
              {log.timestamp}
            </span>
          </div>
        </div>
        {(log.previousData || log.newData) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-[11px] font-bold text-apple-secondary hover:text-apple-primary flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>{expanded ? "ซ่อน" : "รายละเอียด"}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>
      {expanded && (log.previousData || log.newData) && (
        <DataComparison
          targetType={log.targetType}
          prev={log.previousData}
          curr={log.newData}
          formatCurrency={formatCurrency}
          isDelete={isDelete}
        />
      )}
    </div>
  );
};

const parseThaiTimestamp = (timestampStr: string): Date | null => {
  try {
    const parts = timestampStr.split(" ");
    if (parts.length < 1) return null;
    const dateParts = parts[0].split("/");
    if (dateParts.length < 3) return null;
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const beYear = parseInt(dateParts[2], 10);
    const year = beYear - 543;

    let hours = 0,
      minutes = 0,
      seconds = 0;
    if (parts.length > 1) {
      const timeParts = parts[1].split(":");
      if (timeParts.length >= 3) {
        hours = parseInt(timeParts[0], 10);
        minutes = parseInt(timeParts[1], 10);
        seconds = parseInt(timeParts[2], 10);
      }
    }
    return new Date(year, month, day, hours, minutes, seconds);
  } catch (e) {
    console.error("Failed to parse Thai timestamp:", timestampStr, e);
    return null;
  }
};

interface AuditLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditLogs: AuditLog[];
  setAuditLogs: React.Dispatch<React.SetStateAction<AuditLog[]>>;
  requestConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
  ) => void;
  formatCurrency: (val: number) => string;
  currentUser: AppUser | null;
}
export const AuditLogsModal: React.FC<AuditLogsModalProps> = ({
  isOpen,
  onClose,
  auditLogs,
  setAuditLogs,
  requestConfirm,
  formatCurrency,
  currentUser,
}) => {
  const [filterMode, setFilterMode] = useState<"day" | "month">("day");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<
    "all" | "Edit" | "Delete" | "Import" | "System"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const currentYearBE = currentYear + 543;

  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return auditLogs.filter((log) => {
      const matchSearch =
        log.id.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.performedBy.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.timestamp.toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (actionFilter !== "all" && log.action !== actionFilter) return false;

      if (filterMode === "day") {
        if (filterDate) {
          const logDate = parseThaiTimestamp(log.timestamp);
          if (!logDate) return false;
          const year = logDate.getFullYear();
          const month = String(logDate.getMonth() + 1).padStart(2, "0");
          const day = String(logDate.getDate()).padStart(2, "0");
          const logDateStr = `${year}-${month}-${day}`;
          if (logDateStr !== filterDate) return false;
        }
      } else {
        if (filterMonth !== "all") {
          const logDate = parseThaiTimestamp(log.timestamp);
          if (!logDate) return false;
          const year = logDate.getFullYear();
          const month = logDate.getMonth() + 1; // 1-12
          if (year !== currentYear || String(month) !== filterMonth)
            return false;
        }
      }

      return true;
    });
  }, [
    auditLogs,
    searchQuery,
    actionFilter,
    filterMode,
    filterDate,
    filterMonth,
    currentYear,
  ]);

  const edits = auditLogs.filter((l) => l.action === "Edit").length;
  const deletes = auditLogs.filter((l) => l.action === "Delete").length;
  const imports = auditLogs.filter((l) => l.action === "Import").length;
  const systems = auditLogs.filter((l) => l.action === "System").length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-neutral-900/70 backdrop-blur-[4px] z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-10 transition-all duration-300 mobile-bottom-sheet">
      <div className="w-[92vw] md:w-[90vw] lg:max-w-4xl max-h-[85vh] my-auto flex flex-col overflow-hidden animate-scale-in rounded-[2rem] border transition-colors duration-500 bg-apple-secondary border-apple-primary shadow-2xl mobile-bottom-sheet-content">
        <div className="px-6 py-5 sm:px-8 flex justify-between items-center bg-apple-tertiary rounded-t-[2rem] shrink-0 border-b border-apple-primary/10">
          <div>
            <h3 className="font-extrabold text-apple-primary text-base">
              ประวัติการแก้ไขและลบ (Audit Logs)
            </h3>
            <p className="text-[11px] font-semibold text-apple-secondary mt-1.5 flex items-center gap-2 flex-wrap">
              <span>
                แก้ไข{" "}
                <strong className="text-amber-500 dark:text-amber-400 font-bold">
                  {edits}
                </strong>
              </span>
              <span className="opacity-30">•</span>
              <span>
                ลบ{" "}
                <strong className="text-rose-500 dark:text-rose-400 font-bold">
                  {deletes}
                </strong>
              </span>
              <span className="opacity-30">•</span>
              <span>
                นำเข้า{" "}
                <strong className="text-blue-500 dark:text-blue-400 font-bold">
                  {imports}
                </strong>
              </span>
              <span className="opacity-30">•</span>
              <span>
                ระบบ{" "}
                <strong className="text-purple-500 dark:text-purple-400 font-bold">
                  {systems}
                </strong>
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-apple-secondary hover:text-apple-primary hover:bg-neutral-200/80 dark:hover:bg-neutral-800/80 p-1.5 rounded-full transition-all cursor-pointer flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 pb-4 border-b border-apple-primary/10 shrink-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex justify-between items-center min-h-[30px] mb-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-apple-secondary">
                  ตัวกรองเวลา
                </label>
                <div className="flex bg-neutral-100 dark:bg-neutral-800/60 rounded-lg p-0.5 border border-neutral-200 dark:border-neutral-700/50">
                  <button
                    type="button"
                    onClick={() => setFilterMode("day")}
                    className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all cursor-pointer ${
                      filterMode === "day"
                        ? "bg-white dark:bg-neutral-700 text-apple-primary shadow-sm"
                        : "text-apple-secondary hover:text-apple-primary"
                    }`}
                  >
                    รายวัน
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("month")}
                    className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all cursor-pointer ${
                      filterMode === "month"
                        ? "bg-white dark:bg-neutral-700 text-apple-primary shadow-sm"
                        : "text-apple-secondary hover:text-apple-primary"
                    }`}
                  >
                    ทั้งเดือน
                  </button>
                </div>
              </div>

              {filterMode === "day" ? (
                <div className="flex gap-2 items-center">
                  <DatePickerField
                    value={filterDate}
                    onChange={setFilterDate}
                    className="relative flex items-center justify-between input-apple w-full rounded-xl px-4 py-2.5 min-h-[38px] transition-all cursor-pointer select-none active:scale-[0.99] flex-1 bg-apple-secondary/30 border border-apple-primary/10"
                    textClassName="text-xs font-bold text-apple-primary mr-3 flex-1 text-left whitespace-nowrap"
                    placeholder="เลือกวันที่..."
                  />
                  {filterDate && (
                    <button
                      type="button"
                      onClick={() => setFilterDate("")}
                      className="px-3 py-2 text-xs font-bold rounded-xl btn-apple-secondary cursor-pointer min-h-[38px] flex items-center justify-center border border-apple-primary/10 shrink-0"
                    >
                      ล้าง
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="input-apple w-full rounded-xl pl-4 pr-10 py-2.5 text-xs focus:outline-none cursor-pointer appearance-none bg-apple-secondary/30"
                  >
                    <option value="all">
                      แสดงทั้งหมด (ปี {currentYearBE})
                    </option>
                    <option value="1">มกราคม</option>
                    <option value="2">กุมภาพันธ์</option>
                    <option value="3">มีนาคม</option>
                    <option value="4">เมษายน</option>
                    <option value="5">พฤษภาคม</option>
                    <option value="6">มิถุนายน</option>
                    <option value="7">กรกฎาคม</option>
                    <option value="8">สิงหาคม</option>
                    <option value="9">กันยายน</option>
                    <option value="10">ตุลาคม</option>
                    <option value="11">พฤศจิกายน</option>
                    <option value="12">ธันวาคม</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400 dark:text-neutral-500 flex items-center justify-center">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center min-h-[30px] mb-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-apple-secondary">
                  ประเภทการกระทำ
                </label>
              </div>
              <div className="relative">
                <select
                  value={actionFilter}
                  onChange={(e) =>
                    setActionFilter(
                      e.target.value as
                        | "all"
                        | "Edit"
                        | "Delete"
                        | "Import"
                        | "System",
                    )
                  }
                  className="input-apple w-full rounded-xl pl-4 pr-10 py-2.5 text-xs focus:outline-none cursor-pointer appearance-none bg-apple-secondary/30"
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="Edit">เฉพาะการแก้ไข</option>
                  <option value="Delete">เฉพาะการลบ</option>
                  <option value="Import">เฉพาะการนำเข้า</option>
                  <option value="System">เฉพาะระบบ</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400 dark:text-neutral-500 flex items-center justify-center">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center min-h-[30px] mb-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-apple-secondary">
                  ค้นหาคีย์เวิร์ด
                </label>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="ค้นหาผู้กระทำ รายละเอียด ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-apple w-full rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none placeholder:text-apple-secondary/40"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex-1 flex flex-col overflow-hidden">
          {/* Scroll Fade Indicator Shadows */}
          <div className="absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-apple-secondary to-transparent z-10 pointer-events-none opacity-85 transition-all duration-300" />

          <div className="p-6 overflow-y-auto flex-1 space-y-0 custom-scrollbar">
            {auditLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Bell className="h-10 w-10 text-apple-tertiary opacity-20" />
                <p className="text-sm font-bold text-apple-tertiary">
                  ยังไม่มีบันทึกประวัติในระบบ
                </p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <p className="text-center py-16 text-xs text-apple-tertiary font-bold">
                ไม่พบประวัติการทำรายการที่ตรงกับตัวกรอง
              </p>
            ) : (
              filteredLogs.map((log) => (
                <AuditLogEntry
                  key={log.id}
                  log={log}
                  formatCurrency={formatCurrency}
                  searchQuery={searchQuery}
                />
              ))
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-apple-secondary to-transparent z-10 pointer-events-none opacity-85 transition-all duration-300" />
        </div>

        {currentUser?.role === "Admin" && auditLogs.length > 0 && (
          <div className="p-6 bg-apple-tertiary rounded-b-[2rem] shrink-0 flex flex-col min-[360px]:flex-row min-[360px]:justify-between gap-3 items-center border-t border-apple-primary/10">
            <div>
              <button
                onClick={() =>
                  requestConfirm(
                    "ยืนยันการล้างประวัติ",
                    "ล้างประวัติการทำรายการทั้งหมดหรือไม่? ไม่สามารถย้อนกลับได้",
                    () => {
                      setAuditLogs([]);
                      localStorage.removeItem("auditLogs");
                    },
                  )
                }
                className="flex items-center justify-center gap-1.5 font-semibold text-xs text-rose-500 hover:text-rose-600 dark:text-rose-450 dark:hover:text-rose-400 transition-colors cursor-pointer w-full min-[360px]:w-auto active:opacity-85 py-2 px-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                ล้างประวัติทั้งหมด
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 9. PRODUCT DETAIL MODAL
// ==========================================
interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  orders: Order[];
  formatCurrency: (val: number) => string;
  isDarkMode: boolean;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  onClose,
  product,
  orders,
  formatCurrency,
  isDarkMode,
}) => {
  const productOrders = useMemo(() => {
    if (!product) return [];
    return orders.filter(
      (o) => o.productName.toLowerCase() === product.name.toLowerCase(),
    );
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

  const trendData = useMemo(() => {
    const last15Days = [];
    const curr = new Date();
    curr.setDate(curr.getDate() - 14);

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

    for (let i = 0; i < 15; i++) {
      const dateStr = curr.toISOString().split("T")[0];
      const dayOrders = productOrders.filter(
        (o) => o.date === dateStr && o.status !== "Refunded",
      );
      const revenue = dayOrders.reduce(
        (sum, o) => sum + Number(o.total || 0),
        0,
      );
      const units = dayOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);

      last15Days.push({
        label: `${curr.getDate()} ${monthsShort[curr.getMonth()]}`,
        revenue,
        units,
      });
      curr.setDate(curr.getDate() + 1);
    }
    return last15Days;
  }, [productOrders]);

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-neutral-900/70 backdrop-blur-[4px] z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-10 transition-all duration-300 mobile-bottom-sheet">
      <div className="w-[95vw] lg:max-w-4xl max-h-[85vh] my-auto flex flex-col overflow-hidden animate-scale-in rounded-[2rem] border transition-colors duration-500 bg-apple-secondary border-apple-primary shadow-2xl mobile-bottom-sheet-content">
        {/* Header */}
        <div className="px-6 py-5 sm:px-8 flex justify-between items-center bg-apple-tertiary rounded-t-[2rem] shrink-0 border-b border-apple-primary/20">
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
            </div>
            <h3 className="font-extrabold text-apple-primary text-lg mt-1">
              {product.name}
            </h3>
            <p className="text-[10px] font-bold text-apple-secondary">
              แบรนด์สินค้า: {product.brand || "ทั่วไป"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-apple-secondary hover:text-apple-primary hover:bg-black/5 dark:hover:bg-white/8 p-1.5 rounded-full transition-all cursor-pointer flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-1 min-[481px]:grid-cols-2 min-[769px]:grid-cols-4 gap-4">
            {[
              {
                label: "ราคาจำหน่าย",
                value: formatCurrency(product.price),
                badge: "PRICE",
                icon: <Info className="h-3.5 w-3.5" />,
              },
              {
                label: "คงเหลือในคลัง",
                value: `${product.stock} ชิ้น`,
                badge: "STOCK",
                icon: <Package className="h-3.5 w-3.5" />,
              },
              {
                label: "จำหน่ายแล้ว",
                value: `${totalUnits} ชิ้น`,
                badge: "UNITS SOLD",
                icon: <ShoppingCart className="h-3.5 w-3.5" />,
              },
              {
                label: "รายได้รวมสะสม",
                value: formatCurrency(totalRev),
                badge: "REVENUE",
                icon: <TrendingUp className="h-3.5 w-3.5" />,
              },
            ].map((kpi, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl border transition-colors ${
                  isDarkMode
                    ? "bg-white/3 border-white/6 hover:bg-white/6"
                    : "bg-apple-tertiary border-black/5 hover:bg-black/[0.02]"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-apple-secondary">
                    {kpi.badge}
                  </span>
                  <div className="text-apple-secondary">{kpi.icon}</div>
                </div>
                <h4 className="text-lg font-black tracking-tight text-apple-primary">
                  {kpi.value}
                </h4>
                <p className="text-[10px] font-bold text-apple-secondary mt-0.5">
                  {kpi.label}
                </p>
              </div>
            ))}
          </div>

          {/* Revenue Trend Area Chart */}
          <div className="space-y-2.5">
            <div>
              <h4 className="text-xs font-black uppercase text-apple-primary tracking-wider mb-0.5">
                แนวโน้มรายได้ 15 วันล่าสุด
              </h4>
              <p className="text-[10px] text-apple-secondary">
                แสดงผลยอดจำหน่ายรายวันเพื่อประเมินความต้องการสินค้าในระยะสั้น
              </p>
            </div>

            <div
              className={`p-4 rounded-3xl border transition-colors ${
                isDarkMode
                  ? "bg-white/3 border-white/6"
                  : "bg-white border-black/5 shadow-sm"
              }`}
            >
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart
                    data={trendData}
                    margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="prodDetailGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3b82f6"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={
                        isDarkMode
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(0,0,0,0.04)"
                      }
                    />
                    <XAxis
                      dataKey="label"
                      stroke={isDarkMode ? "#86868b" : "#a3a3a3"}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      interval={trendData.length > 8 ? Math.ceil(trendData.length / 5) - 1 : 0}
                    />
                    <YAxis
                      stroke={isDarkMode ? "#86868b" : "#a3a3a3"}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => {
                        if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                        return v;
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDarkMode ? "#1c1c1e" : "#ffffff",
                        borderColor: isDarkMode
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(0, 0, 0, 0.08)",
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: isDarkMode ? "#f5f5f7" : "#1d1d1f",
                        boxShadow: "none",
                      }}
                      formatter={(value) => [
                        formatCurrency(Number(value)),
                        "รายได้",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#prodDetailGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-2.5">
            <div>
              <h4 className="text-xs font-black uppercase text-apple-primary tracking-wider mb-0.5">
                รายการประวัติยอดขายสินค้าชิ้นนี้ (คำสั่งซื้อล่าสุด)
              </h4>
              <p className="text-[10px] text-apple-secondary">
                แสดงประวัติคำสั่งซื้อทั้งหมดของสินค้าชิ้นนี้ที่มีการบันทึกในระบบ
              </p>
            </div>

            <div className="border border-apple-primary/30 rounded-2xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-apple-tertiary/60 border-b border-apple-primary/10">
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
                <tbody>
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
                      <tr key={o.id} className="hover:bg-apple-tertiary/20">
                        <td className="px-4 py-2 font-mono text-[10px] text-apple-secondary">
                          {o.id}
                        </td>
                        <td className="px-4 py-2 font-mono text-[10px] text-apple-secondary">
                          {o.date}
                        </td>
                        <td className="px-4 py-2 font-bold text-apple-primary">
                          {maskCustomerName(o.customerName)}
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
                          {o.quantity || 1}
                        </td>
                        <td
                          className="px-4 py-2 font-black text-apple-primary"
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

        {/* Footer */}
        <div className="p-6 bg-apple-tertiary rounded-b-[2rem] shrink-0 flex flex-col min-[360px]:flex-row min-[360px]:justify-end gap-3 items-center border-t border-apple-primary/10">
          <button
            onClick={onClose}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 w-full min-[360px]:w-auto text-center ${
              isDarkMode
                ? "bg-white hover:bg-neutral-200 text-black shadow-xs"
                : "bg-black hover:bg-neutral-800 text-white shadow-xs"
            }`}
          >
            ปิดรายละเอียด
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 12. SEND NOTIFICATION MODAL (For Manager & Admin)
// ==========================================
interface SendNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  systemUsers: AppUser[];
  onSend: (notification: Omit<AppNotification, "id" | "timestamp" | "readBy">) => void;
  isDarkMode: boolean;
}

export const SendNotificationModal: React.FC<SendNotificationModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  systemUsers,
  onSend,
  isDarkMode,
}) => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<AppNotification["type"]>("announcement");
  const [targetType, setTargetType] = useState<"all" | "employees" | "managers" | "specific">("all");
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [actionTab, setActionTab] = useState<"dashboard" | "sales" | "calculator" | "users" | "settings">("dashboard");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    let targetRoles: ("Admin" | "Manager" | "User")[] | undefined = undefined;
    let specificUserId: string | undefined = undefined;

    if (targetType === "employees") {
      targetRoles = ["User"];
    } else if (targetType === "managers") {
      targetRoles = ["Manager"];
    } else if (targetType === "specific") {
      specificUserId = targetUserId;
    } else {
      targetRoles = ["Admin", "Manager", "User"];
    }

    onSend({
      title: title.trim(),
      message: message.trim(),
      type,
      targetRoles,
      targetUserId: specificUserId,
      senderId: currentUser.id,
      senderName: `${currentUser.name} (${currentUser.role})`,
      senderRole: currentUser.role,
      actionTab,
      priority,
    });

    setTitle("");
    setMessage("");
    onClose();
  };

  const activeEmployees = systemUsers.filter((u) => u.status === "Active");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:py-12 md:px-6 bg-black/50 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div
        className={`w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border flex flex-col max-h-[82vh] my-auto transition-all ${
          isDarkMode
            ? "bg-[#141416]/95 backdrop-blur-xl border-neutral-800/80 text-white shadow-black/80 ring-1 ring-white/5"
            : "bg-white/95 backdrop-blur-xl border-neutral-200/80 text-neutral-900 shadow-neutral-900/10 ring-1 ring-black/5"
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800/70 flex items-center justify-between bg-white/50 dark:bg-neutral-900/30">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/25 flex items-center justify-center shrink-0 shadow-2xs">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                ส่งการแจ้งเตือน / ประกาศข่าวสาร
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-normal">
                ส่งข้อความ มอบหมายงาน หรือแจ้งข้อมูลสำคัญไปยังสมาชิกในทีม
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4.5 flex-1 custom-scrollbar">
          {/* Target Audience */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              กลุ่มเป้าหมายผู้รับการแจ้งเตือน
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "all", label: "ทุกคนในระบบ", icon: Layers },
                { id: "employees", label: "พนักงานเท่านั้น", icon: UserCheck },
                { id: "managers", label: "ผู้จัดการ", icon: ShieldAlert },
                { id: "specific", label: "ระบุรายบุคคล", icon: MessageSquare },
              ].map((item) => {
                const IconComponent = item.icon;
                const isSelected = targetType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTargetType(item.id as typeof targetType)}
                    className={`p-3 rounded-2xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-blue-500/20 font-semibold"
                        : isDarkMode
                          ? "border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-white"
                          : "border-neutral-200/80 bg-neutral-50/80 text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
                    }`}
                  >
                    <IconComponent className="h-4 w-4" />
                    <span className="text-[10px] text-center">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Specific User Select */}
          {targetType === "specific" && (
            <div className="animate-fade-in">
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                เลือกสมาชิกที่ต้องการส่งถึง
              </label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                required
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-all outline-none cursor-pointer ${
                  isDarkMode
                    ? "bg-neutral-900/90 border-neutral-800 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    : "bg-white border-neutral-200/90 text-neutral-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                }`}
              >
                <option value="">-- กรุณาเลือกผู้ใช้งาน --</option>
                {activeEmployees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role}) - {u.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              หัวข้อการแจ้งเตือน <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น อัปเดตงานประจำสัปดาห์, มอบหมายงานตรวจสอบสต็อก"
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-all outline-none ${
                isDarkMode
                  ? "bg-neutral-900/90 border-neutral-800 text-white placeholder-neutral-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  : "bg-white border-neutral-200/90 text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              }`}
            />
          </div>

          {/* Message Content */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              ข้อความรายละเอียด <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="ระบุข้อความหรือคำชี้แจงที่ต้องการแจ้งเตือนสมาชิกในทีม..."
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border transition-all outline-none resize-none ${
                isDarkMode
                  ? "bg-neutral-900/90 border-neutral-800 text-white placeholder-neutral-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  : "bg-white border-neutral-200/90 text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              }`}
            />
          </div>

          {/* Type & Priority Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                หมวดหมู่
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AppNotification["type"])}
                className={`w-full px-3.5 py-2 rounded-xl text-xs font-medium border outline-none cursor-pointer transition-all ${
                  isDarkMode
                    ? "bg-neutral-900/90 border-neutral-800 text-white focus:border-blue-500"
                    : "bg-white border-neutral-200/90 text-neutral-900 focus:border-blue-500"
                }`}
              >
                <option value="announcement">📢 ประกาศข่าวสาร</option>
                <option value="task">📋 มอบหมายงาน / สิทธิ์</option>
                <option value="import">📊 การนำเข้าข้อมูล</option>
                <option value="inventory">📦 แจ้งเตือนสินค้า/คลัง</option>
                <option value="activity">⚡ กิจกรรมทั่วไป</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                ระดับความสำคัญ
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as "normal" | "important" | "urgent")}
                className={`w-full px-3.5 py-2 rounded-xl text-xs font-medium border outline-none cursor-pointer transition-all ${
                  isDarkMode
                    ? "bg-neutral-900/90 border-neutral-800 text-white focus:border-blue-500"
                    : "bg-white border-neutral-200/90 text-neutral-900 focus:border-blue-500"
                }`}
              >
                <option value="normal">⚪ ปกติ (Normal)</option>
                <option value="important">🟡 สำคัญ (Important)</option>
                <option value="urgent">🔴 ด่วนมาก (Urgent)</option>
              </select>
            </div>
          </div>

          {/* Action Link Tab */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              ลิงก์ไปยังหน้าระบบ (เมื่อคลิกที่การแจ้งเตือน)
            </label>
            <select
              value={actionTab}
              onChange={(e) => setActionTab(e.target.value as typeof actionTab)}
              className={`w-full px-3.5 py-2 rounded-xl text-xs font-medium border outline-none cursor-pointer transition-all ${
                isDarkMode
                  ? "bg-neutral-900/90 border-neutral-800 text-white focus:border-blue-500"
                  : "bg-white border-neutral-200/90 text-neutral-900 focus:border-blue-500"
              }`}
            >
              <option value="dashboard">📊 หน้าแดชบอร์ด (Dashboard)</option>
              <option value="sales">📈 หน้ารายงานยอดขาย (Sales)</option>
              <option value="calculator">🧮 เครื่องคำนวณส่วนต่าง (Calculator)</option>
              <option value="users">👥 หน้าจัดการผู้ใช้งาน (Users)</option>
              <option value="settings">⚙️ หน้าตั้งค่า (Settings)</option>
            </select>
          </div>

          {/* Footer Actions */}
          <div className="pt-3.5 border-t border-neutral-100 dark:border-neutral-800/70 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                isDarkMode
                  ? "hover:bg-neutral-800/80 text-neutral-400 hover:text-white"
                  : "hover:bg-neutral-100/80 text-neutral-600 hover:text-neutral-900"
              }`}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/20 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              <Send className="h-3.5 w-3.5" />
              <span>ส่งการแจ้งเตือน</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 13. ALL NOTIFICATIONS MODAL (Comprehensive View)
// ==========================================
interface AllNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  currentUser: AppUser;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAll: () => void;
  onNavigate: (tab: string) => void;
  isDarkMode: boolean;
  onOpenSendModal?: () => void;
}

const parseNotifDate = (
  timestampStr: string
): { dateStr: string; monthStr: string; displayDate: string; displayMonth: string } | null => {
  if (!timestampStr) return null;
  const str = timestampStr.trim();

  let y = 0,
    m = 0,
    d = 0;

  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    y = parseInt(ymdMatch[1], 10);
    m = parseInt(ymdMatch[2], 10);
    d = parseInt(ymdMatch[3], 10);
  } else {
    const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmyMatch) {
      d = parseInt(dmyMatch[1], 10);
      m = parseInt(dmyMatch[2], 10);
      y = parseInt(dmyMatch[3], 10);
      if (y > 2400) y -= 543;
    } else {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        y = parsed.getFullYear();
        if (y > 2400) y -= 543;
        m = parsed.getMonth() + 1;
        d = parsed.getDate();
      }
    }
  }

  if (y === 0 || m === 0 || d === 0) return null;

  const monthStr = `${y}-${String(m).padStart(2, "0")}`;
  const dateStr = `${monthStr}-${String(d).padStart(2, "0")}`;

  const thaiMonths = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  const thaiMonthsShort = [
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

  const beYear = y > 2400 ? y : y + 543;
  const displayDate = `${d} ${thaiMonthsShort[m - 1]} ${beYear}`;
  const displayMonth = `${thaiMonths[m - 1]} ${beYear}`;

  return { dateStr, monthStr, displayDate, displayMonth };
};

export const AllNotificationsModal: React.FC<AllNotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  currentUser,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAll,
  onNavigate,
  isDarkMode,
  onOpenSendModal,
}) => {
  const [filterType, setFilterType] = useState<"all" | "mine" | "activity" | "system">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState<"all" | "date" | "month">("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target as Node)) {
        setIsDateDropdownOpen(false);
      }
    };
    if (isDateDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDateDropdownOpen]);

  if (!isOpen) return null;

  // Filter notifications based on permissions
  const userNotifications = notifications.filter((notif) => {
    // Check if targeted to current user
    if (notif.targetUserId && notif.targetUserId !== currentUser.id) {
      // If sent by this user or admin, allow viewing
      if (currentUser.role !== "Admin" && notif.senderId !== currentUser.id) return false;
    } else if (notif.targetRoles && notif.targetRoles.length > 0) {
      if (!notif.targetRoles.includes(currentUser.role)) return false;
    }
    return true;
  });

  // Extract available months and dates for quick selection
  const availableMonths = (() => {
    const map = new Map<string, { monthStr: string; label: string; count: number }>();
    userNotifications.forEach((n) => {
      const parsed = parseNotifDate(n.timestamp);
      if (parsed) {
        const existing = map.get(parsed.monthStr);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(parsed.monthStr, {
            monthStr: parsed.monthStr,
            label: parsed.displayMonth,
            count: 1,
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.monthStr.localeCompare(a.monthStr));
  })();

  const availableDates = (() => {
    const map = new Map<string, { dateStr: string; label: string; count: number }>();
    userNotifications.forEach((n) => {
      const parsed = parseNotifDate(n.timestamp);
      if (parsed) {
        const existing = map.get(parsed.dateStr);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(parsed.dateStr, {
            dateStr: parsed.dateStr,
            label: parsed.displayDate,
            count: 1,
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  })();

  const filteredList = userNotifications.filter((notif) => {
    // 1. Type filter
    if (filterType === "mine") {
      const isTargetedToMe = notif.targetUserId === currentUser.id || notif.type === "task";
      if (!isTargetedToMe) return false;
    } else if (filterType === "activity") {
      if (notif.type !== "import" && notif.type !== "activity" && notif.type !== "order") return false;
    } else if (filterType === "system") {
      if (notif.type !== "inventory" && notif.type !== "system") return false;
    }

    // 2. Date / Month filter
    if (dateFilterMode === "date" && selectedDate) {
      const parsed = parseNotifDate(notif.timestamp);
      if (!parsed || parsed.dateStr !== selectedDate) return false;
    } else if (dateFilterMode === "month" && selectedMonth) {
      const parsed = parseNotifDate(notif.timestamp);
      if (!parsed || parsed.monthStr !== selectedMonth) return false;
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = notif.title.toLowerCase().includes(q);
      const matchMsg = notif.message.toLowerCase().includes(q);
      const matchSender = notif.senderName.toLowerCase().includes(q);
      if (!matchTitle && !matchMsg && !matchSender) return false;
    }

    return true;
  });

  const unreadCount = userNotifications.filter((n) => !n.readBy.includes(currentUser.id)).length;
  const isFiltered =
    dateFilterMode !== "all" ||
    filterType !== "all" ||
    searchQuery.trim() !== "";

  const handleResetFilters = () => {
    setDateFilterMode("all");
    setSelectedDate("");
    setSelectedMonth("");
    setFilterType("all");
    setSearchQuery("");
  };

  const getTypeBadge = (notif: AppNotification) => {
    const info = getNotificationVisualInfo(notif);
    let IconComponent = Info;
    if (info.actionKind === "delete") IconComponent = Trash2;
    else if (info.actionKind === "edit") IconComponent = Edit;
    else if (info.actionKind === "import") IconComponent = FileSpreadsheet;
    else if (info.actionKind === "task") IconComponent = UserCheck;
    else if (info.actionKind === "announcement") IconComponent = Megaphone;
    else if (info.actionKind === "inventory") IconComponent = Package;
    else if (info.actionKind === "order") IconComponent = ShoppingCart;
    else if (info.actionKind === "activity") IconComponent = Layers;

    return {
      label: info.label,
      className: info.badgeClass,
      icon: IconComponent,
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:py-12 md:px-6 bg-black/50 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div
        className={`w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border flex flex-col max-h-[82vh] my-auto transition-all ${
          isDarkMode
            ? "bg-[#141416]/95 backdrop-blur-xl border-neutral-800/80 text-white shadow-black/80 ring-1 ring-white/5"
            : "bg-white/95 backdrop-blur-xl border-neutral-200/80 text-neutral-900 shadow-neutral-900/10 ring-1 ring-black/5"
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 dark:bg-neutral-900/30">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/25 flex items-center justify-center shrink-0 shadow-2xs">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                  ศูนย์การแจ้งเตือน (Notifications)
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-500/20">
                    {unreadCount} ใหม่
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-normal">
                ติดตามข่าวสาร มอบหมายงาน และความเคลื่อนไหวในระบบ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(currentUser.role === "Admin" || currentUser.role === "Manager") && onOpenSendModal && (
              <button
                onClick={onOpenSendModal}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Megaphone className="h-3.5 w-3.5" />
                <span>ส่งประกาศ</span>
              </button>
            )}

            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                  isDarkMode
                    ? "border-neutral-800 hover:bg-neutral-800/80 text-neutral-300"
                    : "border-neutral-200/90 hover:bg-neutral-100/80 text-neutral-600 hover:text-neutral-900"
                }`}
              >
                อ่านทั้งหมด
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Minimal Single-Row Filter Toolbar: Categories + Date Dropdown + Search */}
        <div className="px-6 py-2.5 border-b border-neutral-100 dark:border-neutral-800/70 flex flex-wrap items-center justify-between gap-2.5 bg-neutral-50/70 dark:bg-neutral-900/40 relative">
          {/* Left: Category Filter Pills (Segmented Style) */}
          <div className="flex items-center gap-1 p-0.5 rounded-2xl bg-neutral-200/50 dark:bg-neutral-800/60 shrink-0 max-w-full overflow-x-auto no-scrollbar">
            {[
              { id: "all", label: `ทั้งหมด (${userNotifications.length})` },
              { id: "mine", label: "งาน/ฉัน" },
              { id: "activity", label: "กิจกรรมทีม" },
              { id: "system", label: "คลัง/ระบบ" },
            ].map((tab) => {
              const isActive = filterType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id as typeof filterType)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all duration-150 cursor-pointer ${
                    isActive
                      ? isDarkMode
                        ? "bg-neutral-100 text-neutral-950 font-semibold shadow-xs"
                        : "bg-neutral-900 text-white font-semibold shadow-xs"
                      : isDarkMode
                        ? "text-neutral-400 hover:text-white hover:bg-neutral-700/40 font-medium"
                        : "text-neutral-600 hover:text-neutral-950 hover:bg-neutral-300/40 font-medium"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right: Date Filter Dropdown & Search Bar */}
          <div className="flex items-center gap-2 shrink-0 ml-auto max-w-full">
            {/* Date Dropdown Filter */}
            <div className="relative" ref={dateDropdownRef}>
              <button
                type="button"
                onClick={() => setIsDateDropdownOpen((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 border transition-all duration-150 cursor-pointer whitespace-nowrap shadow-2xs ${
                  dateFilterMode !== "all"
                    ? isDarkMode
                      ? "bg-blue-500/15 border-blue-500/30 text-blue-400 font-semibold"
                      : "bg-blue-50 border-blue-200 text-blue-600 font-semibold"
                    : isDarkMode
                      ? "bg-neutral-900/90 border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800/60"
                      : "bg-white border-neutral-200/90 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                }`}
              >
                <Calendar className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="max-w-[120px] sm:max-w-[150px] truncate">
                  {dateFilterMode === "date" && selectedDate
                    ? parseNotifDate(selectedDate)?.displayDate || selectedDate
                    : dateFilterMode === "month" && selectedMonth
                      ? parseNotifDate(`${selectedMonth}-01`)?.displayMonth || selectedMonth
                      : "ทุกช่วงเวลา"}
                </span>
                {dateFilterMode !== "all" ? (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setDateFilterMode("all");
                      setSelectedDate("");
                      setSelectedMonth("");
                    }}
                    className="hover:text-rose-500 p-0.5 rounded transition-colors"
                    title="ล้างตัวกรองช่วงเวลา"
                  >
                    <X className="h-3 w-3" />
                  </span>
                ) : (
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 text-neutral-400 ${
                      isDateDropdownOpen ? "rotate-180 text-blue-500" : ""
                    }`}
                  />
                )}
              </button>

              {/* Popover Dropdown Menu */}
              {isDateDropdownOpen && (
                <div
                  className={`absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl p-3.5 shadow-2xl border z-50 animate-scale-in space-y-3 ${
                    isDarkMode
                      ? "bg-[#18181a] border-neutral-800 text-white shadow-black/80 ring-1 ring-white/5"
                      : "bg-white border-neutral-200/90 text-neutral-900 shadow-neutral-900/15 ring-1 ring-black/5"
                  }`}
                >
                  {/* Option: Show All */}
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilterMode("all");
                      setSelectedDate("");
                      setSelectedMonth("");
                      setIsDateDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      dateFilterMode === "all"
                        ? isDarkMode
                          ? "bg-blue-500/15 text-blue-400 font-semibold"
                          : "bg-blue-50 text-blue-600 font-semibold"
                        : isDarkMode
                          ? "text-neutral-400 hover:bg-neutral-800 hover:text-white"
                          : "text-neutral-600 hover:bg-neutral-100 hover:text-black"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Bell className="h-3.5 w-3.5 text-blue-500" />
                      <span>แสดงทุกช่วงเวลา (ทั้งหมด)</span>
                    </div>
                    {dateFilterMode === "all" && <Check className="h-3.5 w-3.5 text-blue-500" />}
                  </button>

                  {/* Option: Dates with notifications */}
                  {availableDates.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/70">
                      <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5 px-1">
                        <CalendarDays className="h-3 w-3 text-neutral-400" />
                        <span>วันที่มีการแจ้งเตือน</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-0.5">
                        {availableDates.map((d) => (
                          <button
                            key={d.dateStr}
                            type="button"
                            onClick={() => {
                              setDateFilterMode("date");
                              setSelectedDate(d.dateStr);
                              setSelectedMonth("");
                              setIsDateDropdownOpen(false);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                              dateFilterMode === "date" && selectedDate === d.dateStr
                                ? "bg-blue-600 border-blue-600 text-white font-semibold shadow-xs"
                                : isDarkMode
                                  ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700"
                                  : "bg-neutral-50 border-neutral-200/80 text-neutral-700 hover:bg-neutral-100"
                            }`}
                          >
                            {d.label} <span className="opacity-60 text-[10px]">({d.count})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Option: Months with notifications */}
                  {availableMonths.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/70">
                      <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5 px-1">
                        <Calendar className="h-3 w-3 text-neutral-400" />
                        <span>เดือนที่มีการแจ้งเตือน</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-0.5">
                        {availableMonths.map((m) => (
                          <button
                            key={m.monthStr}
                            type="button"
                            onClick={() => {
                              setDateFilterMode("month");
                              setSelectedMonth(m.monthStr);
                              setSelectedDate("");
                              setIsDateDropdownOpen(false);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                              dateFilterMode === "month" && selectedMonth === m.monthStr
                                ? "bg-indigo-600 border-indigo-600 text-white font-semibold shadow-xs"
                                : isDarkMode
                                  ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700"
                                  : "bg-neutral-50 border-neutral-200/80 text-neutral-700 hover:bg-neutral-100"
                            }`}
                          >
                            {m.label} <span className="opacity-60 text-[10px]">({m.count})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Date/Month Pickers */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/70 space-y-2">
                    <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-1">
                      ระบุวันหรือเดือนที่ต้องการ
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] text-neutral-400 mb-1 font-medium">
                          เลือกตามวัน:
                        </label>
                        <input
                          type="date"
                          value={dateFilterMode === "date" ? selectedDate : ""}
                          onChange={(e) => {
                            setDateFilterMode("date");
                            setSelectedDate(e.target.value);
                            setSelectedMonth("");
                          }}
                          className={`w-full px-2 py-1 rounded-lg text-[11px] font-medium outline-none border transition-colors cursor-pointer ${
                            isDarkMode
                              ? "bg-neutral-900 border-neutral-800 text-white focus:border-blue-500"
                              : "bg-neutral-50 border-neutral-200 text-neutral-900 focus:border-blue-500"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-neutral-400 mb-1 font-medium">
                          เลือกตามเดือน:
                        </label>
                        <input
                          type="month"
                          value={dateFilterMode === "month" ? selectedMonth : ""}
                          onChange={(e) => {
                            setDateFilterMode("month");
                            setSelectedMonth(e.target.value);
                            setSelectedDate("");
                          }}
                          className={`w-full px-2 py-1 rounded-lg text-[11px] font-medium outline-none border transition-colors cursor-pointer ${
                            isDarkMode
                              ? "bg-neutral-900 border-neutral-800 text-white focus:border-indigo-500"
                              : "bg-neutral-50 border-neutral-200 text-neutral-900 focus:border-indigo-500"
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-36 sm:w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหา..."
                className={`w-full pl-8 pr-6 py-1.5 rounded-xl text-xs outline-none border transition-all duration-150 ${
                  isDarkMode
                    ? "bg-neutral-900/90 border-neutral-800 text-white placeholder-neutral-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    : "bg-white border-neutral-200/90 text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-rose-500 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Summary Status Feedback (Active only when filtered) */}
        {isFiltered && (
          <div
            className={`px-6 py-2 border-b flex items-center justify-between text-xs transition-colors ${
              isDarkMode
                ? "bg-blue-950/20 border-blue-900/30 text-blue-400"
                : "bg-blue-50/70 border-blue-100 text-blue-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span>
                กำลังกรอง: แสดง <strong>{filteredList.length}</strong> จาก{" "}
                <strong>{userNotifications.length}</strong> รายการ
                {dateFilterMode === "date" && selectedDate && (
                  <span className="ml-1 font-bold">
                    [วันที่: {parseNotifDate(selectedDate)?.displayDate || selectedDate}]
                  </span>
                )}
                {dateFilterMode === "month" && selectedMonth && (
                  <span className="ml-1 font-bold">
                    [เดือน: {parseNotifDate(`${selectedMonth}-01`)?.displayMonth || selectedMonth}]
                  </span>
                )}
                {searchQuery.trim() && (
                  <span className="ml-1 font-bold">[คำค้น: &quot;{searchQuery}&quot;]</span>
                )}
              </span>
            </div>

            <button
              onClick={handleResetFilters}
              className="text-[11px] font-medium text-rose-500 hover:underline flex items-center gap-1 cursor-pointer transition-opacity"
            >
              <RotateCcw className="h-3 w-3" />
              <span>ล้างตัวกรอง</span>
            </button>
          </div>
        )}

        {/* Notification List Body */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {filteredList.length === 0 ? (
            <div className="text-center py-14 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-3xl bg-neutral-100 dark:bg-neutral-800/60 text-neutral-400 flex items-center justify-center mb-3.5 shadow-2xs">
                <Bell className="h-6 w-6 stroke-[1.5]" />
              </div>
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">ไม่มีรายการแจ้งเตือน</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 max-w-sm">
                {isFiltered
                  ? "ไม่พบรายการตามวันที่หรือเงื่อนไขที่ระบุ ลองล้างตัวกรองเพื่อดูรายการทั้งหมด"
                  : "การแจ้งเตือนใหม่ๆ จากผู้จัดการและการนำเข้าข้อมูลจะแสดงที่นี่"}
              </p>
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="mt-3.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 cursor-pointer transition-transform active:scale-95 shadow-sm"
                >
                  ดูการแจ้งเตือนทั้งหมด
                </button>
              )}
            </div>
          ) : (
            filteredList.map((notif) => {
              const isRead = notif.readBy.includes(currentUser.id);
              const badge = getTypeBadge(notif);
              const BadgeIcon = badge.icon;
              const notifDateInfo = parseNotifDate(notif.timestamp);

              return (
                <div
                  key={notif.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 relative group ${
                    isRead
                      ? isDarkMode
                        ? "bg-neutral-900/30 hover:bg-neutral-900/60 border-neutral-800/60 hover:border-neutral-700/80"
                        : "bg-neutral-50/60 hover:bg-white border-neutral-200/60 hover:border-neutral-300/80"
                      : isDarkMode
                        ? "bg-[#18181a] border-blue-500/30 shadow-xs ring-1 ring-blue-500/10 hover:border-blue-500/50"
                        : "bg-white border-blue-500/25 shadow-xs ring-1 ring-blue-500/10 hover:shadow-md hover:border-blue-500/40"
                  }`}
                >
                  {/* Left subtle accent indicator for unread item */}
                  {!isRead && (
                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-r-full" />
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 flex-1">
                      <div
                        className={`w-10 h-10 rounded-xl shrink-0 mt-0.5 border flex items-center justify-center shadow-2xs ${badge.className}`}
                      >
                        <BadgeIcon className="h-4 w-4" />
                      </div>

                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border uppercase tracking-wider ${badge.className}`}
                          >
                            {badge.label}
                          </span>

                          {notif.priority === "urgent" && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              ด่วนมาก
                            </span>
                          )}
                          {notif.priority === "important" && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              สำคัญ
                            </span>
                          )}

                          {/* Clickable date badge to quickly filter by that date */}
                          {notifDateInfo ? (
                            <button
                              onClick={() => {
                                setDateFilterMode("date");
                                setSelectedDate(notifDateInfo.dateStr);
                              }}
                              className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium hover:text-blue-500 dark:hover:text-blue-400 flex items-center gap-1.5 cursor-pointer transition-colors"
                              title={`คลิกเพื่อกรองเฉพาะวันที่ ${notifDateInfo.displayDate}`}
                            >
                              <Calendar className="h-3 w-3 text-neutral-400" />
                              <span>{notif.timestamp}</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">
                              {notif.timestamp}
                            </span>
                          )}
                        </div>

                        <h4
                          className={`text-[13px] sm:text-sm font-semibold tracking-tight leading-snug ${
                            isRead ? "text-neutral-600 dark:text-neutral-400" : "text-neutral-900 dark:text-neutral-100"
                          }`}
                        >
                          {notif.title}
                        </h4>

                        <p className={`text-xs leading-relaxed break-words font-normal ${
                          isRead ? "text-neutral-500 dark:text-neutral-500" : "text-neutral-600 dark:text-neutral-300"
                        }`}>
                          {notif.message}
                        </p>

                        <div className="flex items-center justify-between pt-1.5 border-t border-neutral-100 dark:border-neutral-800/60">
                          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
                            โดย: <strong className="font-semibold text-neutral-700 dark:text-neutral-300">{notif.senderName}</strong>
                          </span>

                          <div className="flex items-center gap-2.5">
                            {notif.actionTab && (
                              <button
                                onClick={() => {
                                  onMarkAsRead(notif.id);
                                  onNavigate(notif.actionTab!);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 group cursor-pointer transition-colors"
                              >
                                <span>ไปยังหน้านี้</span>
                                <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                              </button>
                            )}

                            {!isRead && (
                              <button
                                onClick={() => onMarkAsRead(notif.id)}
                                className="text-[11px] font-medium text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 px-2 py-0.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                              >
                                ทำเครื่องหมายว่าอ่านแล้ว
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteNotification(notif.id)}
                      className="text-neutral-400 hover:text-rose-500 p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors opacity-60 hover:opacity-100 cursor-pointer"
                      title="ลบการแจ้งเตือนนี้"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-100 dark:border-neutral-800/70 flex items-center justify-between bg-neutral-50/70 dark:bg-neutral-900/40 backdrop-blur-sm">
          <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            {isFiltered
              ? `แสดง ${filteredList.length} จากทั้งหมด ${userNotifications.length} รายการ`
              : `ทั้งหมด ${userNotifications.length} รายการ`}
          </div>
          <div className="flex items-center gap-2">
            {userNotifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                ล้างทั้งหมด
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 shadow-xs hover:shadow transition-all duration-150 active:scale-95 cursor-pointer"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 19. TRASH & DATA RECOVERY MODAL
// ==========================================
interface TrashRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  trashItems: TrashItem[];
  onRestore: (item: TrashItem) => void;
  onDeletePermanently: (id: string) => void;
  onEmptyTrash: () => void;
  isDarkMode: boolean;
  currentUser?: AppUser | null;
  formatCurrency?: (val: number) => string;
}

export const TrashRecoveryModal: React.FC<TrashRecoveryModalProps> = ({
  isOpen,
  onClose,
  trashItems,
  onRestore,
  onDeletePermanently,
  onEmptyTrash,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const isAuthorized =
    currentUser?.role === "Admin" || currentUser?.role === "Manager";

  const filteredItems = trashItems.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.deletedBy.toLowerCase().includes(q) ||
      (item.details && item.details.toLowerCase().includes(q))
    );
  });

  const getItemTypeBadge = (type: TrashItem["itemType"]) => {
    switch (type) {
      case "product":
      case "bulk_products":
        return {
          label: "สินค้า",
          icon: Package,
          color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
        };
      case "order":
      case "bulk_orders":
        return {
          label: "คำสั่งซื้อ",
          icon: ShoppingCart,
          color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
        };
      case "income":
      case "bulk_income":
        return {
          label: "รายรับ/การเงิน",
          icon: TrendingUp,
          color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
        };
      case "dataset":
      case "all_data":
        return {
          label: "ชุดข้อมูล",
          icon: FileSpreadsheet,
          color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
        };
      default:
        return {
          label: "ข้อมูล",
          icon: Trash2,
          color: "text-neutral-500 bg-neutral-500/10 border-neutral-500/20",
        };
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[75] flex items-center justify-center p-3 sm:p-6 transition-all duration-300 animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-[#121214] border border-neutral-200/80 dark:border-neutral-800/80 rounded-[1.75rem] shadow-2xl shadow-black/20 overflow-hidden flex flex-col max-h-[88vh] animate-scale-in transition-all">
        {/* Top Accent Line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent shrink-0" />

        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-neutral-100 dark:border-neutral-800/80 flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-xs ring-4 ring-emerald-500/[0.04]">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                  ถังขยะและศูนย์กู้คืนข้อมูล
                </h2>
                <span className="text-[10px] font-mono font-medium text-neutral-400 dark:text-neutral-500 tracking-normal uppercase hidden sm:inline">
                  (Data Recovery)
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {trashItems.length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                  {trashItems.length} รายการ
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                กู้คืนข้อมูลสินค้า รายการสั่งซื้อ หรือชุดข้อมูลที่ถูกลบกลับสู่ระบบได้ทันที
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-all cursor-pointer shrink-0"
            title="ปิดหน้าต่าง"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Role permission status banner */}
        <div className="px-6 py-2.5 bg-neutral-50/70 dark:bg-neutral-900/40 border-b border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
            {isAuthorized ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium text-[11px]">
                <ShieldCheck className="h-3.5 w-3.5" />
                สิทธิ์การกู้คืน: Admin & Manager
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 font-medium text-[11px]">
                <Lock className="h-3.5 w-3.5" />
                เฉพาะ Admin & Manager
              </span>
            )}
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 hidden sm:inline">
              (คุณคือ <strong className="text-neutral-700 dark:text-neutral-300 font-semibold">{currentUser?.name || "ผู้ใช้"}</strong> - {currentUser?.role || "Guest"})
            </span>
          </div>

          {trashItems.length > 0 && isAuthorized && (
            <button
              onClick={onEmptyTrash}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-500/10 px-2.5 py-1 rounded-lg transition-all cursor-pointer shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
              ล้างถังขยะทั้งหมด
            </button>
          )}
        </div>

        {/* Search */}
        <div className="p-3.5 px-6 border-b border-neutral-100 dark:border-neutral-800/60 bg-neutral-50/40 dark:bg-neutral-900/20">
          <div className="relative w-full">
            <Search className="h-4 w-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหารายการที่ถูกลบ..."
              className="w-full bg-white dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800/80 rounded-xl pl-9.5 pr-8 py-2 text-xs text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/60 transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Trash Item List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-14 px-4">
              <div className="h-16 w-16 mx-auto rounded-3xl bg-neutral-100/80 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/50 flex items-center justify-center text-neutral-400 dark:text-neutral-500 mb-3 shadow-xs">
                <Trash2 className="h-7 w-7 opacity-50" />
              </div>
              <h3 className="font-semibold text-sm text-neutral-800 dark:text-neutral-200">
                {searchQuery ? "ไม่พบรายการที่ค้นหา" : "ถังขยะว่างเปล่า"}
              </h3>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 max-w-xs mx-auto leading-relaxed">
                {searchQuery
                  ? `ไม่พบข้อมูลที่ตรงกับ "${searchQuery}" ในถังขยะ`
                  : "ไม่มีรายการข้อมูลที่ถูกลบอยู่ในระบบขณะนี้"}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const badgeInfo = getItemTypeBadge(item.itemType);
              const ItemIcon = badgeInfo.icon;

              return (
                <div
                  key={item.id}
                  className="group p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900/60 border-neutral-200/80 dark:border-neutral-800/80 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 shadow-xs hover:shadow-md"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${badgeInfo.color}`}
                    >
                      <ItemIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 truncate">
                          {item.title}
                        </h4>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${badgeInfo.color}`}
                        >
                          {badgeInfo.label} • {item.itemCount} รายการ
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-2 break-words">
                        {item.details || "ข้อมูลสำรองก่อนการลบ"}
                      </p>
                      <div className="text-[11px] text-neutral-400 dark:text-neutral-500 flex items-center gap-2 flex-wrap pt-0.5">
                        <span className="flex items-center gap-1">
                          ลบโดย: <strong className="text-neutral-600 dark:text-neutral-300 font-medium">{item.deletedBy}</strong>
                        </span>
                        <span>•</span>
                        <span>{item.deletedAt}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0">
                    {isAuthorized ? (
                      <button
                        onClick={() => onRestore(item)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        กู้คืนข้อมูล
                      </button>
                    ) : (
                      <span className="text-[11px] font-medium text-rose-500 dark:text-rose-400 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20">
                        <Lock className="h-3 w-3" />
                        เฉพาะสิทธิ์ Admin
                      </span>
                    )}
                    {isAuthorized && (
                      <button
                        onClick={() => onDeletePermanently(item.id)}
                        title="ลบถาวร"
                        className="p-2 rounded-xl text-neutral-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-4 bg-neutral-50/60 dark:bg-neutral-900/30">
          <div className="text-xs text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 shrink-0" />
            <span>ข้อมูลในถังขยะจะถูกเก็บไว้เพื่อให้ Admin และ Manager กู้คืนได้ตลอดเวลา</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 shadow-xs active:scale-95 shrink-0"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

