/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { 
  Upload, 
  AlertTriangle, 
  Check, 
  Search, 
  ChevronDown,
  Download,
  Trash2,
  FileSpreadsheet,
  X,
  ArrowRight,
  ShoppingBag,
  Coins,
  Package,
  Loader2
} from "lucide-react";
import type { Product, Order, UploadedDataset } from "../types";
import { parseAndNormalizeDate, detectBrand } from "../utils";
import { repairWorksheetRange } from "../utils/fileParser";
import { syncOrdersToSupabase } from "../services/supabaseService";
import { validateUploadedFile } from "../utils/security";

interface ParsedImportProduct {
  name: string;
  category: Product["category"];
  brand: string;
  price: number;
  stock: number;
  warnings: string | null;
}

interface ImportOrdersTabProps {
  isDarkMode: boolean;
  products: Product[];
  onSubmit?: (orders: Order[], updateInventory: boolean) => void;
  onImportProducts?: (products: { name: string; category: Product["category"]; brand: string; price: number; stock: number; }[]) => void;
  onImportDatasets?: (datasets: UploadedDataset[]) => void;
  productFiles?: UploadedDataset[];
  onImportProductFiles?: (datasets: UploadedDataset[]) => void;
  triggerAlert: (msg: string, type?: "success" | "warning" | "info" | "error") => void;
  setActiveTab: (tab: "dashboard" | "sales" | "calculator" | "import-orders" | "users") => void;
  pendingImportFile?: UploadedDataset | null;
  onClearPendingImportFile?: () => void;
  isModal?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  uploadedDatasets?: UploadedDataset[];
  onDeleteDataset?: (id: string) => void;
  requestConfirm?: (title: string, message: string, onConfirm: () => void, confirmText?: string, cancelText?: string, icon?: "trash" | "warning") => void;
  onImportOrders?: (orders: Order[], datasets: UploadedDataset[]) => void;
  mode?: "income" | "orders" | "all" | "order" | "orderRecord" | "incomeRecord" | "data" | "report" | "withdraw" | "glossary" | "products";
}

interface UploadedFileData {
  fileName: string;
  rows: unknown[][];
  headers: string[];
  headerRowIndex: number;
  sheetNames?: string[];
  activeSheetName?: string;
  allSheetsData?: Record<string, { rows: unknown[][]; headers: string[]; headerRowIndex: number }>;
  platform: "lazada" | "shopee" | "tiktok" | "facebook" | "line" | "unknown";
  id?: string;
}

interface ColumnDef {
  key: string;
  label: string;
  autogen: boolean;
  isId: boolean;
  isMoney: boolean;
  visible: boolean;
  isNum: boolean;
}

interface Dataset {
  id: string;
  fileId?: string;
  platform: "lazada" | "shopee" | "tiktok" | "facebook" | "line" | "unknown";
  kind: "income" | "order" | "report" | "withdraw" | "glossary" | "data";
  fileName: string;
  sheetName: string;
  columns: ColumnDef[];
  rows: Record<string, any>[];
  kvMode: boolean;
  search: string;
  sort: { key: string | null; dir: 1 | -1 };
  page: number;
  pageSize: number;
}

const generateUniqueId = (prefix: string = "ds") => {
  return `${prefix}_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
};

const getCurrentFormattedDate = () => {
  return new Date().toLocaleString("th-TH");
};

const MONTH_ORDER_MAP: Record<string, number> = {
  // Thai full
  "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4, "พฤษภาคม": 5, "มิถุนายน": 6,
  "กรกฎาคม": 7, "สิงหาคม": 8, "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12,
  // Thai short
  "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
  "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
  "มค": 1, "กพ": 2, "มีค": 3, "เมย": 4, "พค": 5, "มิย": 6,
  "กค": 7, "สค": 8, "กย": 9, "ตค": 10, "พย": 11, "ธค": 12,
  // English full
  "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
  "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
  // English short
  "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6,
  "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
};

const TH_MONTH_SHORT_NAMES = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const extractMonthFromFileName = (fileName: string): { monthNum: number; monthLabel: string } | null => {
  if (!fileName) return null;
  const lower = fileName.toLowerCase();
  
  // 1. Check textual month names
  for (const [key, num] of Object.entries(MONTH_ORDER_MAP)) {
    if (lower.includes(key)) {
      return { monthNum: num, monthLabel: TH_MONTH_SHORT_NAMES[num] || `เดือน ${num}` };
    }
  }

  // 2. Check pattern like -01-, _01_, .01., -1-, _1_, M01, M1, Month01, Month 1, etc.
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

const KEY_MAPS = {
  orderId: [
    "order id", "รหัสคำสั่งซื้อ", "หมายเลขคำสั่งซื้อ", "เลขที่คำสั่งซื้อ", "เลขคำสั่งซื้อ", 
    "order no", "order no.", "order number", "order_id", "id", "หมายเลขคำสั่งซื้อ/หมายเลขพัสดุ", 
    "หมายเลขคำสั่งซื้อ / หมายเลขพัสดุ", "ordernumber", "orderitemid", "order item id",
    "orderitemno", "order item no", "order item no.", "order line id", "orderlineid",
    "statement number", "statement number / order item no", "statement no", "statement no.", "statementnumber",
    "หมายเลขรายการสินค้า", "รหัสรายการสินค้า", "เลขออเดอร์", "รหัสรายการ", "หมายเลขคำสั่งซื้อ/การปรับ"
  ],
  customerName: [
    "customer", "recipient", "buyer", "ชื่อลูกค้า", "ชื่อผู้รับ", "ผู้ซื้อ", 
    "ชื่อผู้ใช้ (ผู้ซื้อ)", "ชื่อผู้ใช้(ผู้ซื้อ)", "customer name", "recipient name", 
    "buyer name", "customer_name", "shippingname", "shipping name", "buyer username"
  ],
  productName: [
    "product name", "item name", "product_name", "itemname",
    "ชื่อสินค้า", "รายละเอียดสินค้า", "ข้อมูลสินค้า", 
    "ชื่อรายละเอียดสินค้า", "ชื่อสินค้า/SKU", "ชื่อสินค้า/รายละเอียดสินค้า", 
    "product", "item", "สินค้า", "fee name", "details", "ชื่อค่าธรรมเนียม", "ประเภทรายการ",
    "seller sku", "lazada sku", "sku"
  ],
  quantity: [
    "quantity", "qty", "จำนวนสินค้า", "จำนวนชิ้น", "จำนวนที่ซื้อ", "จำนวนสินค้าที่ซื้อ", 
    "จำนวนสินค้าที่ซื้อในคำสั่งซื้อ", "จำนวนสั่งซื้อ", "จำนวนขาย", "qty sold", "quantity_sold",
    "item quantity", "sku quantity", "item_quantity"
  ],
  total: [
    "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย", "ยอดรวมค่าสินค้า", "sku subtotal after discount",
    "รายได้ทั้งหมด", "รายได้รวม", "ยอดรวมค่าสินค้าก่อนหักส่วนลด",
    "ราคาขายสุทธิ", "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)", "ราคาสินค้าที่ชำระโดยผู้ซื้อ",
    "สินค้าราคาปกติ", "ราคาขาย", "ราคาต่อหน่วย", "ราคาต่อชิ้น",
    "unitprice", "paidprice", "paid price", "unit price",
    "sku subtotal before discount", "sku subtotal",
    "total", "price", "amount", "ยอดขาย", "ราคารวม", "ราคาสุทธิ", "จำนวนเงิน(รวมภาษี)", "จำนวนเงิน (รวมภาษี)"
  ],
  date: [
    "date", "time", "created", "วันที่", "เวลา", "order date", "created date", 
    "created_time", "order_time", "วันที่โอนเงินสำเร็จ", "วันที่โอนเงิน", 
    "เวลาการโอนเงินสำเร็จ", "วันที่โอน", "เวลาสั่งซื้อ", "เวลาที่ทำการสั่งซื้อ", 
    "วันที่สั่งซื้อ", "เวลาชำระเงิน", "createtime", "create time", "created time", 
    "created_time", "paid time", "paid_time", "เวลาที่ชำระคำสั่งซื้อ", "เวลาที่สร้างคำสั่งซื้อ",
    "วันที่ทำการสั่งซื้อ", "เวลาที่ทำการสั่งซื้อสำเร็จ", "วันที่โอนชำระเงินสำเร็จ",
    "transaction date", "transaction_date", "transactiondate", "วันที่ทำรายการ",
    "order creation date", "statement date"
  ],
  shippingFee: [
    "shipping fee", "shipping", "ค่าจัดส่ง", "ค่าส่ง", "ค่าจัดส่งที่ชำระโดยผู้ซื้อ", 
    "ค่าขนส่งที่ชำระโดยผู้ซื้อ", "shipping_fee", "ค่าขนส่ง", "shipping cost", 
    "shippingfee", "shipping fee after discount", "original shipping fee",
    "ค่าจัดส่งที่ shopee ชำระโดยชื่อของคุณ", "ค่าจัดส่งที่shopeeชำระโดยชื่อของคุณ",
    "ค่าจัดส่งจริง", "ค่าธรรมเนียมการจัดส่งจริง"
  ],
  platformFee: [
    "platform fee", "fee", "ค่าบริการ", "ค่าธรรมเนียม", "ค่าธรรมเนียมการบริการ", 
    "ค่าธรรมเนียมการทำธุรกรรม", "ค่าคอมมิชชัน", "ค่าคอมมิชชั่น", "commission", "service fee", 
    "platform_fee", "ค่าธรรมเนียมธุรกรรม", "ค่าบริการขาย", 
    "ค่าธรรมเนียมการทำธุรกรรม (ธุรกรรม)", "ค่าธรรมเนียมการทำธุรกรรม(ธุรกรรม)",
    "transaction fee", "transactionfee", "ค่าธรรมเนียมทั้งหมด", "ค่าธรรมเนียมคำสั่งซื้อ", "fee name",
    "ค่าคอมมิชชั่น tiktok shop", "ค่าธรรมเนียมโครงสร้างพื้นฐานแพลตฟอร์ม"
  ],
  netIncome: [
    "net income", "net", "payout", "settlement amount", "รายรับสุทธิ", "ยอดโอน", "จำนวนเงินที่โอน", 
    "เงินโอน", "net_income", "net_amount", "ยอดเงินโอน", "รายได้สุทธิ", "รายรับ", 
    "ยอดชำระสุทธิ", "ยอดโอนเงินสุทธิ", "ยอดโอนสุทธิ", "จำนวนเงินทั้งหมดที่โอนแล้ว (฿)", 
    "จำนวนเงินทั้งหมดที่โอนแล้ว", "ยอดการชำระเงินทั้งหมด", "ยอดชำระเงินทั้งหมด", "จำนวนเงินที่ชำระทั้งหมด",
    "การชำระเงินของลูกค้า", "ยอดเงินโอนสุทธิ", "จำนวนเงินโอน", "ยอดรับสุทธิ",
    "จำนวนเงิน(รวมภาษี)", "จำนวนเงิน (รวมภาษี)"
  ],
  status: [
    "status", "order status", "order_status", "สถานะ", "สถานะการสั่งซื้อ", "สถานะคำสั่งซื้อ", 
    "สถานะการชำระเงิน", "สถานะออเดอร์", "สถานะการส่ง", "คำสั่งซื้อสถานะ", "สถานะของคำสั่งซื้อ",
    "สถานะรายการ", "สถานะการโอนเงิน", "สถานะคืนเงิน", "สถานะการคืนเงิน", "ประเภทรายการ",
    "ประเภทธุรกรรม", "เหตุผลการยกเลิก", "เหตุผลในการยกเลิก", "รายละเอียดสถานะ", "คำอธิบาย",
    "รายละเอียด", "การคืนเงิน", "เหตุผล", "cancel reason", "cancellation reason", "cancelation/return type", "return status",
    "สถานะพัสดุ", "สถานะสินค้า", "สถานะคำสั่งซื้อ/คืนเงิน", "สถานะการยกเลิก", "ยกเลิก", "การยกเลิก",
    "สถานะยกเลิก", "cancelled", "canceled", "cancellation", "paid status"
  ]
};

const parseOrderStatus = (val: unknown): "Paid" | "Pending" | "Refunded" => {
  if (val === null || val === undefined) return "Paid";
  const s = String(val).trim().toLowerCase();
  if (!s) return "Paid";
  if (
    s.includes("cancel") ||
    s.includes("ยกเลิก") ||
    s.includes("refund") ||
    s.includes("คืนเงิน") ||
    s.includes("return") ||
    s.includes("คืนสินค้า") ||
    s.includes("สินค้าถูกคืน") ||
    s.includes("ส่งคืน") ||
    s.includes("คืน") ||
    s.includes("ล้มเหลว") ||
    s.includes("failed")
  ) {
    return "Refunded";
  }
  if (
    s.includes("pending") ||
    s.includes("รอชำระ") ||
    s.includes("unpaid") ||
    s.includes("ยังไม่ชำระ") ||
    s.includes("รอการชำระเงิน")
  ) {
    return "Pending";
  }
  return "Paid";
};

const KEY_MAPS_PRODUCT = {
  name: [
    "product name",
    "item name",
    "product_name",
    "itemname",
    "ชื่อสินค้า",
    "รายละเอียดสินค้า",
    "ข้อมูลสินค้า",
    "ชื่อรายละเอียดสินค้า",
    "ชื่อสินค้า/sku",
    "ชื่อสินค้า/รายละเอียดสินค้า",
    "product",
    "item",
    "สินค้า",
    "ชื่อรายการสินค้า",
    "ชื่อตัวเลือกสินค้า",
    "ชื่อตัวเลือก",
    "ชื่อรายการ",
    "ชื่อสินค้าและตัวเลือก",
    "variation name",
    "variation",
    "name",
    "seller sku",
    "lazada sku",
    "parent sku",
    "reference sku",
    "sku",
    "รหัสสินค้า",
    "เลขอ้างอิง sku",
    "เลขอ้างอิง parent sku",
  ],
  category: [
    "category",
    "หมวดหมู่หลัก",
    "หมวดหมู่",
    "กลุ่มสินค้า",
    "ประเภทสินค้า",
    "product_category",
    "category_name",
  ],
  brand: [
    "brand",
    "แบรนด์สินค้า",
    "แบรนด์",
    "ยี่ห้อ",
    "product_brand",
    "brand_name",
  ],
  price: [
    "ราคาขายสุทธิ",
    "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)",
    "ราคาสินค้าที่ชำระโดยผู้ซื้อ",
    "สินค้าราคาปกติ",
    "ราคาต่อหน่วยของ sku",
    "sku unit original price",
    "sku unit price",
    "ราคาต่อหน่วย",
    "ราคาต่อชิ้น",
    "ราคาขายต่อชิ้น",
    "paid price",
    "paidprice",
    "unit price",
    "unitprice",
    "item price",
    "itemprice",
    "sku unit",
    "retail price",
    "ราคาจำหน่าย",
    "ราคาขาย",
    "ราคาตั้งต้น",
    "ราคาสินค้า",
    "price",
    "ราคา",
    "price_per_unit",
    "deal price",
    "original price",
    "discounted price",
    "product_price",
    "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย",
    "ยอดรวมค่าสินค้า"
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

const PLATFORMS = {
  lazada: { label: "Lazada", color: "#2E2BB8" },
  shopee: { label: "Shopee", color: "#EE4D2D" },
  tiktok: { label: "TikTok Shop", color: "#FE2C55" },
  facebook: { label: "Facebook", color: "#1877F2" },
  line: { label: "LINE OA", color: "#06C755" },
  unknown: { label: "ไฟล์ทั่วไป", color: "#7A8699" },
};

const UPLOAD_THEMES = {
  all: {
    activeBorder: "border-blue-500 ring-4 ring-blue-500/10 shadow-[0_0_25px_rgba(59,130,246,0.25)]",
    normalBorder: "border-apple-primary/15 hover:border-blue-500/40 bg-apple-secondary hover:shadow-[0_8px_30px_rgba(59,130,246,0.05)]",
    iconBg: "bg-gradient-to-br from-blue-500/15 to-indigo-500/15 text-blue-500 shadow-sm shadow-blue-500/10",
    buttonClass: "bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/10 hover:shadow-blue-500/20",
    title: "ลากและวางไฟล์รายงานร้านค้าที่นี่",
    desc: "รองรับรายงาน Lazada, Shopee, TikTok Shop, Facebook และ LINE OA ทั้งไฟล์ออเดอร์และรายรับบัญชี ระบบจะตรวจแยกประเภทและแพลตฟอร์มให้คุณอัตโนมัติ"
  },
  lazada: {
    activeBorder: "border-[#2E2BB8] ring-4 ring-[#2E2BB8]/10 shadow-[0_0_25px_rgba(46,43,184,0.25)]",
    normalBorder: "border-[#2E2BB8]/15 hover:border-[#2E2BB8]/40 bg-apple-secondary hover:shadow-[0_8px_30px_rgba(46,43,184,0.05)]",
    iconBg: "bg-gradient-to-br from-[#2E2BB8]/15 to-indigo-500/15 text-[#2E2BB8] shadow-sm shadow-[#2E2BB8]/10",
    buttonClass: "bg-[#2E2BB8] hover:bg-[#1E1B98] text-white shadow-md shadow-[#2E2BB8]/10 hover:shadow-[#2E2BB8]/20",
    title: "อัปโหลดไฟล์รายงาน Lazada",
    desc: "รองรับไฟล์รายรับ (Lazada_income) และคำสั่งซื้อ (Orders) ของ Lazada ระบบจะบังคับใช้เป็นแพลตฟอร์ม Lazada"
  },
  shopee: {
    activeBorder: "border-[#EE4D2D] ring-4 ring-[#EE4D2D]/10 shadow-[0_0_25px_rgba(238,77,45,0.25)]",
    normalBorder: "border-[#EE4D2D]/15 hover:border-[#EE4D2D]/40 bg-apple-secondary hover:shadow-[0_8px_30px_rgba(238,77,45,0.05)]",
    iconBg: "bg-gradient-to-br from-[#EE4D2D]/15 to-[#FE6D4D]/15 text-[#EE4D2D] shadow-sm shadow-[#EE4D2D]/10",
    buttonClass: "bg-[#EE4D2D] hover:bg-[#DE3D1D] text-white shadow-md shadow-[#EE4D2D]/10 hover:shadow-[#EE4D2D]/20",
    title: "อัปโหลดไฟล์รายงาน Shopee",
    desc: "รองรับไฟล์รายรับ (Shopee_Income) และคำสั่งซื้อ (Orders) ของ Shopee ระบบจะบังคับใช้เป็นแพลตฟอร์ม Shopee"
  },
  tiktok: {
    activeBorder: "border-[#FE2C55] ring-4 ring-[#FE2C55]/10 shadow-[0_0_25px_rgba(254,44,85,0.25)]",
    normalBorder: "border-[#FE2C55]/15 hover:border-[#FE2C55]/40 bg-apple-secondary hover:shadow-[0_8px_30px_rgba(254,44,85,0.05)]",
    iconBg: "bg-gradient-to-br from-[#FE2C55]/15 to-[#FF4C75]/15 text-[#FE2C55] shadow-sm shadow-[#FE2C55]/10",
    buttonClass: "bg-[#FE2C55] hover:bg-[#EE1C45] text-white shadow-md shadow-[#FE2C55]/10 hover:shadow-[#FE2C55]/20",
    title: "อัปโหลดไฟล์รายงาน TikTok Shop",
    desc: "รองรับไฟล์รายรับ (Tiktok_income) และคำสั่งซื้อ (Order SKU) ของ TikTok Shop ระบบจะบังคับใช้เป็นแพลตฟอร์ม TikTok Shop"
  },
  facebook: {
    activeBorder: "border-[#1877F2] ring-4 ring-[#1877F2]/10 shadow-[0_0_25px_rgba(24,119,242,0.25)]",
    normalBorder: "border-[#1877F2]/15 hover:border-[#1877F2]/40 bg-apple-secondary hover:shadow-[0_8px_30px_rgba(24,119,242,0.05)]",
    iconBg: "bg-gradient-to-br from-[#1877F2]/15 to-[#1877F2]/30 text-[#1877F2] shadow-sm shadow-[#1877F2]/10",
    buttonClass: "bg-[#1877F2] hover:bg-[#166FE5] text-white shadow-md shadow-[#1877F2]/10 hover:shadow-[#1877F2]/20",
    title: "อัปโหลดไฟล์รายงาน Facebook",
    desc: "รองรับรายงานยอดขายจาก Facebook Chat / Page365 / เทมเพลตมาตรฐาน ระบบจะบันทึกเป็นช่องทาง Facebook"
  },
  line: {
    activeBorder: "border-[#06C755] ring-4 ring-[#06C755]/10 shadow-[0_0_25px_rgba(6,199,85,0.25)]",
    normalBorder: "border-[#06C755]/15 hover:border-[#06C755]/40 bg-apple-secondary hover:shadow-[0_8px_30px_rgba(6,199,85,0.05)]",
    iconBg: "bg-gradient-to-br from-[#06C755]/15 to-[#06C755]/30 text-[#06C755] shadow-sm shadow-[#06C755]/10",
    buttonClass: "bg-[#06C755] hover:bg-[#05B64E] text-white shadow-md shadow-[#06C755]/10 hover:shadow-[#06C755]/20",
    title: "อัปโหลดไฟล์รายงาน LINE OA",
    desc: "รองรับรายงานยอดขายจาก LINE Shopping / LINE OA / เทมเพลตมาตรฐาน ระบบจะบันทึกเป็นช่องทาง LINE OA"
  }
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

const TYPE_LABEL = {
  income: "รายรับ",
  order: "คำสั่งซื้อ",
  report: "รายงาน",
  withdraw: "การถอนเงิน",
  glossary: "คำอธิบาย",
  data: "ข้อมูล"
};

const detectPlatform = (name: string): "lazada" | "shopee" | "tiktok" | "facebook" | "line" | "unknown" => {
  const n = (name || "").toLowerCase();
  if (n.includes("lazada") || n.startsWith("laz") || n.includes("laz_") || n.includes("laz-") || n.includes("laz ") || n.includes("ลาซาด้า")) return "lazada";
  if (n.includes("shopee") || n.startsWith("shopee") || n.startsWith("sp_") || n.startsWith("sp-") || n.startsWith("sp ") || n.startsWith("sp") || n.includes("ช้อปปี้") || n.includes("ช็อปปี้")) return "shopee";
  if (n.includes("tiktok") || n.includes("tik_tok") || n.startsWith("tt") || n.includes("tt_") || n.includes("tt-") || n.includes("tt ") || n.includes("ติ๊กต๊อก") || n.includes("ติ๊กตอก")) return "tiktok";
  if (n.includes("facebook") || n.includes("page365") || n.includes("fb_") || n.includes("fb-") || n.includes("fb ") || n.includes("fb.") || n.startsWith("fb") || n.includes("เฟส") || n.includes("เฟซ") || n.includes("เฟสบุ๊ค") || n.includes("เฟซบุ๊ก")) return "facebook";
  if (n.includes("line") || n.includes("line_") || n.includes("line-") || n.includes("lineoa") || n.includes("lineshopping") || n.includes("line.") || n.startsWith("line") || n.includes("ไลน์") || n.includes("myshop")) return "line";
  return "unknown";
};

const detectPlatformFromHeaders = (headers: string[]): "lazada" | "shopee" | "tiktok" | "facebook" | "line" | "unknown" => {
  const lcHeaders = headers.map(h => String(h).trim().toLowerCase());
  const cleanHeaders = lcHeaders.map(h => h.replace(/[\s_\-./]/g, ""));

  // Facebook
  if (lcHeaders.some(h => ["facebook id", "fb name", "fb_id", "ชื่อลูกค้า fb", "เพจ", "page name", "facebook_order", "fb_order", "วันที่สั่งซื้อ (yyyy-mm-dd)"].includes(h))) {
    return "facebook";
  }
  // LINE OA
  if (lcHeaders.some(h => ["line id", "line name", "line_id", "ชื่อลูกค้า line", "ไลน์", "line_order", "lineoa_order", "lineshopping"].includes(h))) {
    return "line";
  }
  // Shopee
  if (lcHeaders.some(h => [
    "ค่าจัดส่งที่ shopee ชำระโดยชื่อของคุณ", "ค่าจัดส่งที่ shopee ชำระโดยผู้ซื้อ",
    "ค่าธรรมเนียมโครงสร้างพื้นฐานแพลตฟอร์ม", "จำนวนเงินทั้งหมดที่โอนแล้ว (฿)", 
    "จำนวนเงินทั้งหมดที่โอนแล้ว", "เลขอ้างอิง parent sku", 
    "เลขอ้างอิง sku (sku reference no.)", "โค้ด coins cashback ชำระโดยผู้ขาย", 
    "ส่วนลดจาก shopee", "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)"
  ].includes(h))) {
    return "shopee";
  }
  // TikTok Shop
  if (lcHeaders.some(h => [
    "sku subtotal after discount", "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย", 
    "ค่าคอมมิชชั่น tiktok shop", "หมายเลขคำสั่งซื้อ/การปรับ", 
    "เวลาที่ชำระคำสั่งซื้อ", "order substatus", "cancelation/return type", 
    "normal or pre-order", "sku id", "tiktok shop", "tiktok", "ติ๊กต๊อก", "ติ๊กตอก",
    "sku subtotal before discount", "sku seller discount", "sku unit original price",
    "sku platform discount", "ราคารวมย่อยของ sku", "ราคาต่อหน่วยของ sku", "ยอดรวมค่าสินค้า"
  ].some(k => h === k || h.includes(k)))) {
    return "tiktok";
  }
  // Lazada
  if (
    cleanHeaders.some(h => [
      "orderitemid", "orderitemno", "lazadasku", "statementnumber", 
      "feename", "paidstatus", "shippingprovider", "trackingcode"
    ].includes(h)) ||
    lcHeaders.some(h => [
      "order item id", "order item no", "order item no.", "lazada sku", 
      "statement number", "fee name", "paid status", "shipping provider",
      "tracking code", "หมายเลขรายการสินค้า", "รหัสรอบบิล", "ระยะเวลาใบแจ้งยอด",
      "ชื่อรายการธุรกรรม"
    ].includes(h))
  ) {
    return "lazada";
  }
  // Fallbacks
  if (lcHeaders.some(h => ["หมายเลขคำสั่งซื้อ", "ราคาขายสุทธิ", "ราคาขาย", "สถานะการสั่งซื้อ"].includes(h))) {
    if (cleanHeaders.some(h => ["orderitemid", "orderitemno", "lazadasku", "paidprice", "unitprice"].includes(h))) {
      return "lazada";
    }
    return "shopee";
  }
  if (lcHeaders.some(h => ["order id", "order status", "seller sku", "product name"].includes(h))) {
    if (cleanHeaders.some(h => ["orderitemid", "orderitemno", "lazadasku", "paidprice", "unitprice"].includes(h))) {
      return "lazada";
    }
    return "tiktok";
  }
  return "unknown";
};

const determinePlatform = (fileName: string, headers: string[]): "lazada" | "shopee" | "tiktok" | "facebook" | "line" | "unknown" => {
  const namePlatform = detectPlatform(fileName);
  if (namePlatform !== "unknown") return namePlatform;
  return detectPlatformFromHeaders(headers);
};

const detectKind = (name: string, sheetName: string): Dataset["kind"] => {
  const n = (name + " " + sheetName).toLowerCase();
  const hasOrderKeyword = n.includes("order") || n.includes("orders") || n.includes("คำสั่งซื้อ") || n.includes("ordersku") || sheetName.toLowerCase().includes("ordersku");
  const hasIncomeKeyword = n.includes("income") || n.includes("โอนเงิน") || n.includes("โอนเง") || n.includes("รายรับ") || n.includes("รายได้") || n.includes("statement") || n.includes("payout") || n.includes("finance");

  if (hasOrderKeyword && !hasIncomeKeyword) return "order";
  if (hasIncomeKeyword && !hasOrderKeyword) return "income";

  if (sheetName.toLowerCase().includes("ordersku")) return "order";
  if (hasIncomeKeyword) return "income";
  if (hasOrderKeyword) return "order";
  return "order";
};

const isSheetHidden = (workbook: XLSX.WorkBook, sheetName: string, idx?: number): boolean => {
  if (sheetName.startsWith("_") || sheetName.startsWith(".") || sheetName.startsWith("~$")) {
    return true;
  }
  if (!workbook.Workbook || !workbook.Workbook.Sheets) return false;
  const sheets = workbook.Workbook.Sheets;
  const byName = sheets.find(s => s && s.name && s.name.trim().toLowerCase() === sheetName.trim().toLowerCase());
  if (byName && (byName.Hidden === 1 || byName.Hidden === 2 || Boolean(byName.Hidden))) {
    return true;
  }
  if (idx !== undefined && sheets[idx]) {
    const byIdx = sheets[idx];
    if (byIdx && (byIdx.Hidden === 1 || byIdx.Hidden === 2 || Boolean(byIdx.Hidden))) {
      return true;
    }
  }
  return false;
};

const sheetKind = (sheetName: string): Dataset["kind"] | null => {
  const s = sheetName.toLowerCase();
  if (
    s.includes("summary") || s.includes("รายงาน") || s.includes("overview") || 
    s.includes("คู่มือ") || s.includes("instruction") || s.includes("readme") || 
    s.includes("read me") || s.includes("template") || s.includes("help") || 
    s.includes("setting") || s.includes("config") || s.includes("toc")
  ) return "report";
  if (s.includes("ถอน") || s.includes("withdraw")) return "withdraw";
  if (s.includes("คำอธิบาย") || s.includes("glossary")) return "glossary";
  return null;
};

const ID_HINTS = ["sku", "code", "หมายเลข", "เลขอ้างอิง", "อ้างอิง", "tracking", "ติดตาม",
                  "โทร", "phone", "zip", "ไปรษณีย์", "รหัส", "barcode", "package", "taxcode"];

const isIdHeader = (h: string): boolean => {
  const s = String(h).toLowerCase();
  if (/(^|[^a-z])id([^a-z]|$)/.test(s) || /[a-z]id$/.test(s)) return true;
  return ID_HINTS.some(k => s.includes(k));
};

const MONEY_HINTS = ["เงิน", "ราคา", "ค่า", "ส่วนลด", "ยอด", "ภาษี", "vat", "wht", "คอมมิช", "commission",
                     "fee", "price", "amount", "discount", "total", "refund", "tax", "payout", "โอน",
                     "รายได้", "รายรับ", "คืน"];

const isMoneyHeader = (h: string): boolean => {
  const s = String(h).toLowerCase();
  return MONEY_HINTS.some(k => s.includes(k));
};

const isCellDateLikeHelper = (val: unknown): boolean => {
  if (val === null || val === undefined || val === "") return false;
  if (val instanceof Date) return true;
  if (typeof val === "string") {
    const s = val.trim();
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(s) || /^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(s)) return true;
  }
  return false;
};

const isCellDataLikeHelper = (c: unknown): boolean => {
  if (c === null || c === undefined || c === "") return false;
  if (typeof c === "number") return true;
  if (c instanceof Date) return true;
  const s = String(c).trim();
  const withoutCurr = s.replace(/[฿$thbTHB%\s]/g, "");
  if (/^[-+]?[\d,]+(\.\d+)?$/.test(withoutCurr) && withoutCurr.length > 0) return true;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(s) || /^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(s)) return true;
  if (/^(IV|HS|RC|INV|SO|PO|DOC|PVD)\d+/i.test(s)) return true;
  if (/^\d{10,25}[A-Za-z0-9]*$/.test(s) && /\d/.test(s)) return true;
  if (/^\d{4,6}-\d+$/.test(s)) return true;
  return false;
};

const detectHeaderRow = (aoa: any[][]): { idx: number; width: number } => {
  if (!aoa || aoa.length === 0) return { idx: 0, width: 0 };

  const firstRow = aoa[0];
  if (firstRow && Array.isArray(firstRow) && firstRow.length >= 5) {
    const rowStrings = firstRow.map(c => (c !== null && c !== undefined ? String(c).trim() : ""));
    const nonEmptyCells = rowStrings.filter(c => c !== "");
    const lowerCells = nonEmptyCells.map(c => c.toLowerCase());

    const hasExplicitHeaderKeywords = lowerCells.some(c => 
      c.includes("order id") || c.includes("คำสั่งซื้อ") || c.includes("statement") ||
      c.includes("ชื่อสินค้า") || c.includes("product name") || c.includes("item name") ||
      c.includes("ราคาขาย") || c.includes("unit price") || c.includes("paid price") ||
      c.includes("ยอดรวม") || c.includes("total amount") || c.includes("sku id") ||
      c.includes("สถานะ") || c.includes("order status") || c.includes("วันที่") || c.includes("created time")
    );

    const dataCellCount = firstRow.filter(isCellDataLikeHelper).length;
    const isFirstRowData = dataCellCount >= Math.min(3, nonEmptyCells.length) && !hasExplicitHeaderKeywords;

    if (isFirstRowData) {
      return { idx: -1, width: firstRow.length };
    }
  }

  const limit = Math.min(20, aoa.length);
  let bestIdx = -1;
  let bestScore = -1;
  let bestWidth = 0;

  for (let i = 0; i < limit; i++) {
    const row = aoa[i];
    if (!row || !Array.isArray(row)) continue;
    const rowStrings = row.map(c => (c !== null && c !== undefined ? String(c).trim() : ""));
    const nonEmptyCells = rowStrings.filter(c => c !== "");
    if (nonEmptyCells.length === 0) continue;

    const lowerCells = nonEmptyCells.map(c => c.toLowerCase());

    let keywordScore = 0;
    // Check order id / code / reference keywords
    if (lowerCells.some(c => 
      c.includes("order") || c.includes("คำสั่งซื้อ") || c.includes("รายการ") || 
      c.includes("statement") || c.includes("transaction") || c.includes("เลขที่") || 
      c.includes("รหัส") || c.includes("sku") || c.includes("item")
    )) keywordScore += 250;

    // Check financial / amount / date / status keywords
    if (lowerCells.some(c => 
      c.includes("amount") || c.includes("price") || c.includes("fee") || 
      c.includes("date") || c.includes("total") || c.includes("ยอด") || 
      c.includes("ราคา") || c.includes("เงิน") || c.includes("วันที่") || 
      c.includes("สถานะ") || c.includes("status") || c.includes("บาท") || c.includes("thb")
    )) keywordScore += 250;

    // Check customer / product keywords
    if (lowerCells.some(c => 
      c.includes("customer") || c.includes("buyer") || c.includes("recipient") || 
      c.includes("ลูกค้า") || c.includes("ผู้รับ") || c.includes("สินค้า") || c.includes("product")
    )) keywordScore += 150;

    // Penalty for rows that look like purely data (e.g. mostly numbers or formatted numbers)
    let numberCount = 0;
    row.forEach(c => {
      if (typeof c === "number") numberCount++;
      else if (typeof c === "string" && /^-?\d+(\.\d+)?$/.test(c.trim().replace(/,/g, ""))) numberCount++;
    });
    const numberRatio = numberCount / nonEmptyCells.length;
    if (numberRatio > 0.5) {
      keywordScore -= 300; // Likely a data row
    }

    const totalScore = keywordScore + nonEmptyCells.length * 10;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestIdx = i;
      bestWidth = row.length;
    }
  }

  // If no good header candidate was found with positive keyword score, consider it headerless
  if (bestScore <= 50 && aoa[0] && aoa[0].some(isCellDataLikeHelper)) {
    return { idx: -1, width: aoa[0].length };
  }

  return { idx: bestIdx < 0 ? 0 : bestIdx, width: Math.max(bestWidth, aoa[0]?.length || 0) };
};

const nf0 = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtCell = (val: any, col: ColumnDef): { text: string; cls: string } => {
  if (val === null || val === undefined || val === "") return { text: "—", cls: "text-neutral-400 dark:text-neutral-600" };
  
  if (val instanceof Date) {
    const d = val;
    const dateStr = d.toLocaleString("th-TH", { year: "numeric", month: "short", day: "numeric" });
    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
    const timeStr = hasTime ? " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") : "";
    return { text: dateStr + timeStr, cls: "" };
  }
  
  if (typeof val === "number") {
    let cls = "text-right font-mono";
    if (val < 0) cls += " text-red-500 font-bold";
    
    const isBigInt = Math.abs(val) >= 1e9 && Number.isInteger(val);
    if (isBigInt || col.isId) {
      return { text: String(val), cls: "font-mono" };
    }
    
    const formatted = Number.isInteger(val) && !col.isMoney ? nf0.format(val) : nf2.format(val);
    if (val > 0 && col.isMoney) cls += " text-emerald-600 dark:text-emerald-500 font-bold";
    return { text: formatted, cls };
  }
  
  return { text: String(val), cls: "" };
};

const findColIndex = (headers: string[], targetKeywords: string[]): number => {
  if (!headers || headers.length === 0) return -1;
  
  const normalizedHeaders = headers.map(h => String(h || "").trim().toLowerCase());
  const cleanHeaders = normalizedHeaders.map(h => h.replace(/[^a-z0-9\u0E00-\u0E7F]/gi, ""));

  // 1. Exact match (case-insensitive & trimmed)
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const h = normalizedHeaders[i];
    if (targetKeywords.some(k => h === k.toLowerCase().trim())) {
      return i;
    }
  }

  // 2. Cleaned exact match (without spaces, punctuation)
  for (let i = 0; i < cleanHeaders.length; i++) {
    const ch = cleanHeaders[i];
    if (ch && targetKeywords.some(k => ch === k.replace(/[^a-z0-9\u0E00-\u0E7F]/gi, "").toLowerCase())) {
      return i;
    }
  }

  // 3. Partial match (contains keyword)
  const stopWords = new Set(["สินค้า", "ส่ง", "fee", "id", "จำนวน", "amount", "เวลา", "date", "ชำระ", "ยอด"]);
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const h = normalizedHeaders[i];
    const match = targetKeywords.some(keyword => {
      const k = keyword.toLowerCase().trim();
      if (stopWords.has(k) || k.length < 3) return false;
      return h.includes(k);
    });
    if (match) return i;
  }

  // 4. Cleaned partial match
  for (let i = 0; i < cleanHeaders.length; i++) {
    const ch = cleanHeaders[i];
    const match = targetKeywords.some(keyword => {
      const ck = keyword.replace(/[^a-z0-9\u0E00-\u0E7F]/gi, "").toLowerCase();
      if (stopWords.has(keyword.toLowerCase().trim()) || ck.length < 3) return false;
      return ch.includes(ck);
    });
    if (match) return i;
  }

  return -1;
};

const parseCSV = (text: string): string[][] => {
  const lines = text.split(/\r?\n/);
  return lines
    .map((line) => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current);
      return result;
    })
    .filter((row) => row.length > 0 && row.some((cell) => cell.trim() !== ""));
};

const parseFileRows = (rows: unknown[][]) => {
  if (rows.length < 1) return { headers: [], rows: [], headerRowIndex: 0 };

  const { idx: headerRowIndex, width } = detectHeaderRow(rows);
  if (headerRowIndex === -1) {
    const sampleRows = rows.slice(0, Math.min(20, rows.length));
    let isStandard17 = false;
    if (width >= 15) {
      const col1Vals = sampleRows.map(r => Array.isArray(r) ? r[1] : undefined).filter(Boolean).map(String);
      const col2Vals = sampleRows.map(r => Array.isArray(r) ? r[2] : undefined).filter(Boolean);
      const hasDocCol1 = col1Vals.some(s => /^(IV|HS|RC|INV|SO|PO|DOC|PVD)\d+/i.test(s));
      const hasDateCol2 = col2Vals.some(isCellDateLikeHelper);
      if (hasDocCol1 || hasDateCol2) {
        isStandard17 = true;
      }
    }

    const generatedHeaders: string[] = [];
    if (isStandard17) {
      const standard17 = [
        "ลำดับ (Seq)",                                           // 0
        "หมายเลขคำสั่งซื้อ / เลขที่เอกสาร (Order ID / Invoice)",    // 1
        "วันที่ (Date)",                                         // 2
        "รหัสสาขา/ไปรษณีย์ (Code)",                               // 3
        "ระบบ/ช่องทาง (System)",                                 // 4
        "รหัสสินค้า/SKU (SKU Reference)",                         // 5
        "ชื่อลูกค้า (Customer Name)",                              // 6
        "ที่อยู่ / ข้อมูลติดต่อ (Address / Contact)",                 // 7
        "ชื่อสินค้า (Product Name)",                              // 8
        "จำนวน (Quantity)",                                      // 9
        "หน่วย (Unit)",                                          // 10
        "ราคาต่อหน่วย (Unit Price)",                               // 11
        "ส่วนลด (Discount)",                                     // 12
        "ยอดรวมก่อนภาษี (Subtotal)",                               // 13
        "ภาษีมูลค่าเพิ่ม (VAT)",                                    // 14
        "หมายเหตุ / ข้อมูลเพิ่มเติม (Note / Extra)",                // 15
        "ยอดขายรวม / รายรับสุทธิ (Gross Sales / Net Income)"      // 16
      ];
      for (let c = 0; c < width; c++) {
        if (c < standard17.length) generatedHeaders.push(standard17[c]);
        else generatedHeaders.push(`คอลัมน์ ${c + 1}`);
      }
    } else if (width === 9) {
      const col2Vals = sampleRows.map(r => Array.isArray(r) ? r[2] : undefined).filter(Boolean).map(String);
      const col3Vals = sampleRows.map(r => Array.isArray(r) ? r[3] : undefined).filter(Boolean);
      const hasDocCol2 = col2Vals.some(s => /^(IV|HS|RC|INV|SO|PO|DOC|PVD)\d+/i.test(s));
      const hasDateCol3 = col3Vals.some(isCellDateLikeHelper);
      if (hasDocCol2 || hasDateCol3) {
        generatedHeaders.push(
          "ยอดเงิน / ราคาขาย (Amount / Net Sales)",
          "ลำดับ / จำนวน (Quantity / Seq)",
          "เลขที่เอกสาร / Invoice (Order ID / Invoice)",
          "วันที่ (Date)",
          "รหัสลูกค้า / สาขา (Customer / Branch Code)",
          "ระบบ / ช่องทาง / แบรนด์ (System / Brand)",
          "รหัสสินค้า / SKU (SKU Reference)",
          "หมายเลขคำสั่งซื้อ (Order ID / SN)",
          "ชื่อสินค้า (Product Name)"
        );
      } else {
        for (let c = 0; c < width; c++) generatedHeaders.push(`คอลัมน์ ${c + 1}`);
      }
    } else {
      const usedNames = new Set<string>();
      const getUniqueName = (name: string) => {
        let finalName = name;
        let count = 2;
        while (usedNames.has(finalName)) {
          finalName = `${name} (${count})`;
          count++;
        }
        usedNames.add(finalName);
        return finalName;
      };

      for (let c = 0; c < width; c++) {
        const colVals = sampleRows.map(r => (Array.isArray(r) && r[c] !== undefined && r[c] !== null ? r[c] : "")).filter(v => v !== "");
        const colStrings = colVals.map(v => String(v).trim());

        if (colVals.length === 0) {
          generatedHeaders.push(getUniqueName(`คอลัมน์ ${c + 1}`));
          continue;
        }

        const hasDate = colVals.some(isCellDateLikeHelper);
        const hasInvoice = colStrings.some(s => /^(IV|HS|RC|INV|SO|PO|DOC|PVD)\d+/i.test(s));
        const hasOrderSn = colStrings.some(s => /^\d{10,25}[A-Za-z0-9]*$/.test(s) && /\d/.test(s) && !/^\d{1,6}$/.test(s));
        const hasSystemOrChannel = colStrings.some(s => s.includes("ระบบขาย") || s.includes("ช็อปปี้") || s.includes("ช้อปปี้") || s.includes("ติ๊กต๊อก") || s.includes("ลาซาด้า") || s.includes("BARBER BRAIN") || s.includes("COSMIX") || s.includes("VALENTE") || s.includes("L'ANGEL"));
        const hasBranchCode = colStrings.some(s => /^\d{4,6}-\d+$/.test(s));
        const hasSku = colStrings.some(s => /^[A-Za-z0-9]{1,4}-[A-Za-z0-9]{1,5}$/i.test(s) || /^(B|BB|VAL|ANG|GAD|COS)-\d+/i.test(s));
        const isUnitWord = colStrings.every(s => /^(ชิ้น|อัน|กล่อง|ขวด|ชุด|ซอง|แถว|ครั้ง|pcs|pieces|unit|units|box|set|bottle)$/i.test(s));
        const isDecimalMoney = colVals.some(v => (typeof v === "number" && !Number.isInteger(v)) || (typeof v === "string" && /^\d+\.\d{2}$/.test(v)));
        const isSmallInteger = colVals.length > 0 && colVals.every(v => (typeof v === "number" && Number.isInteger(v) && v > 0 && v < 10000) || (typeof v === "string" && /^\d+$/.test(v) && parseInt(v, 10) < 10000));
        const hasThaiProductName = colStrings.some(s => s.length > 2 && /[\u0E00-\u0E7F]/.test(s) && !hasSystemOrChannel && !hasDate && !isUnitWord);

        if (hasInvoice) {
          generatedHeaders.push(getUniqueName("เลขที่เอกสาร / Invoice (Order ID / Invoice)"));
        } else if (hasOrderSn) {
          generatedHeaders.push(getUniqueName("หมายเลขคำสั่งซื้อ (Order ID / SN)"));
        } else if (hasDate) {
          generatedHeaders.push(getUniqueName("วันที่ (Date)"));
        } else if (hasSystemOrChannel) {
          generatedHeaders.push(getUniqueName("ระบบ / ช่องทาง / แบรนด์ (System / Brand)"));
        } else if (hasBranchCode) {
          generatedHeaders.push(getUniqueName("รหัสลูกค้า / สาขา (Customer / Branch Code)"));
        } else if (hasSku) {
          generatedHeaders.push(getUniqueName("รหัสสินค้า / SKU (SKU Reference)"));
        } else if (isUnitWord) {
          generatedHeaders.push(getUniqueName("หน่วย (Unit)"));
        } else if (hasThaiProductName) {
          generatedHeaders.push(getUniqueName("ชื่อสินค้า (Product Name)"));
        } else if (isDecimalMoney || (c === 0 && colVals.some(v => typeof v === "number" && v > 100))) {
          generatedHeaders.push(getUniqueName("ยอดเงิน / ราคาขาย (Amount / Net Sales)"));
        } else if (isSmallInteger && c === 0) {
          generatedHeaders.push(getUniqueName("ลำดับ (Seq)"));
        } else if (isSmallInteger && c === 1) {
          generatedHeaders.push(getUniqueName("ลำดับ / จำนวน (Quantity / Seq)"));
        } else if (isSmallInteger) {
          generatedHeaders.push(getUniqueName("จำนวน (Quantity)"));
        } else {
          generatedHeaders.push(getUniqueName(`คอลัมน์ ${c + 1}`));
        }
      }
    }
    return {
      headers: generatedHeaders,
      rows,
      headerRowIndex: -1
    };
  }

  const headers = (rows[headerRowIndex] || []).map(h => String(h || "").trim());
  const dataRows = rows.slice(headerRowIndex + 1).filter(r => r.some(c => c !== null && String(c).trim() !== ""));

  return {
    headers,
    rows: dataRows,
    headerRowIndex
  };
};

const buildDataset = (
  wb: XLSX.WorkBook,
  sheetName: string,
  fileName: string,
  platform: Dataset["platform"],
  kind: Dataset["kind"],
  currentDatasetsCount: number,
  preParsed?: { filteredAoa: unknown[][]; parsed: { headers: string[]; rows: unknown[][]; headerRowIndex: number } },
  fileId?: string
): Dataset | null => {
  let filteredAoa: unknown[][];
  let parsed: { headers: string[]; rows: unknown[][]; headerRowIndex: number };

  if (preParsed) {
    filteredAoa = preParsed.filteredAoa;
    parsed = preParsed.parsed;
  } else {
    const ws = wb.Sheets[sheetName];
    if (!ws) return null;
    const aoa = getVisibleAoa(ws);
    filteredAoa = aoa.filter(r => r && r.some(c => c !== null && c !== undefined && String(c).trim() !== ""));
    if (!filteredAoa.length) return null;
    parsed = parseFileRows(filteredAoa);
  }
  const idx = parsed.headerRowIndex;
  const headerRow: any[] = idx >= 0 ? (filteredAoa[idx] || []) : [];
  const dataRows: any[][] = parsed.rows as any[][];
  const kvMode = false;
  
  const maxCols = Math.max(headerRow.length, ...dataRows.map(r => r.length), 1);
  let columns: ColumnDef[] = [];
  for (let c = 0; c < maxCols; c++) {
    const raw = idx >= 0 ? headerRow[c] : (parsed.headers && parsed.headers[c] ? parsed.headers[c] : undefined);
    const isUnnamed = raw === null || raw === undefined || String(raw).trim() === "" || /^Unnamed/i.test(String(raw));
    const lbl = isUnnamed ? "คอลัมน์ " + (c + 1) : String(raw).trim();
    const auto = isUnnamed || lbl.startsWith("คอลัมน์ ");
    columns.push({
      key: "c" + c,
      label: lbl,
      autogen: auto,
      isId: isIdHeader(lbl),
      isMoney: isMoneyHeader(lbl),
      visible: true,
      isNum: false
    });
  }
  
  const parsedRows = dataRows.map(r => {
    const o: Record<string, any> = {};
    columns.forEach((col, c) => {
      const v = r[c] === undefined ? null : r[c];
      let parsedVal: any = v;
      if (!col.isId && typeof v === "string") {
        const s = v.trim();
        if (s !== "") {
          const cl = s.replace(/,/g, "");
          if (/^-?\d+(\.\d+)?$/.test(cl)) parsedVal = Number(cl);
        }
      }
      o[col.key] = parsedVal;
    });
    return o;
  });
  
  if (parsedRows.length >= 3) {
    let mismatch = 0;
    const sampleLimit = Math.min(20, parsedRows.length);
    columns.forEach(col => {
      let num = 0, tot = 0;
      for (let i = 1; i < sampleLimit; i++) {
        const v = parsedRows[i][col.key];
        if (v === null || v === "") continue;
        tot++;
        if (typeof v === "number") num++;
      }
      if (tot >= 3 && num / tot >= 0.7) {
        const firstVal = parsedRows[0][col.key];
        if (typeof firstVal === "string" && firstVal.trim() !== "" && !/^-?\d/.test(firstVal.replace(/,/g, ""))) mismatch++;
      }
    });
    if (mismatch >= 3) {
      parsedRows.shift();
    }
  }
  
  if (platform !== "facebook" && platform !== "line" && idx !== -1) {
    const sampleForVisibility = parsedRows.slice(0, 50);
    columns = columns.filter(col => !col.autogen || sampleForVisibility.some(r => {
      const v = r[col.key];
      return v !== null && v !== undefined && String(v).trim() !== "";
    }));
  }
  
  const sampleForNum = parsedRows.slice(0, 50);
  columns.forEach(col => {
    let num = 0, tot = 0;
    for (const row of sampleForNum) {
      const v = row[col.key];
      if (v === null || v === "") continue;
      tot++;
      if (typeof v === "number") num++;
    }
    col.isNum = tot > 0 && num / tot >= 0.6;
  });
  
  return {
    id: "ds" + currentDatasetsCount + "_" + Math.random().toString(36).slice(2, 6),
    fileId,
    platform,
    kind,
    fileName,
    sheetName,
    columns,
    rows: parsedRows,
    kvMode,
    search: "",
    sort: { key: null, dir: 1 },
    page: 0,
    pageSize: 50
  };
};

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as ArrayBuffer);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") {
        resolve(e.target.result);
      } else {
        reject(new Error("Failed to read file as text"));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file as text"));
    reader.readAsText(file, "UTF-8");
  });
};

const parseNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (s === "") return 0;
  let clean = s.replace(/[^0-9.-]/g, "");
  if (clean.endsWith("-")) {
    clean = "-" + clean.slice(0, -1);
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const ImportOrdersTabComponent: React.FC<ImportOrdersTabProps> = ({
  isDarkMode,
  products,
  onSubmit,
  onImportProducts,
  onImportDatasets,
  onImportProductFiles,
  triggerAlert,
  setActiveTab,
  pendingImportFile,
  onClearPendingImportFile,
  isModal = false,
  isOpen = false,
  onClose,
  uploadedDatasets = [],
  onDeleteDataset,
  requestConfirm,
  onImportOrders,
  mode = "all"
}) => {
  const [currentMode, setCurrentMode] = useState<"orders" | "income" | "all">(
    mode === "products" ? "all" : (mode as "orders" | "income" | "all") || "all"
  );

  useEffect(() => {
    if (mode && mode !== "products") {
      setCurrentMode(mode as "orders" | "income" | "all");
    }
  }, [mode]);

  const allowedTypes = useMemo(() => {
    if (mode === "orders" || mode === "income" || mode === "order" || mode === "orderRecord" || mode === "incomeRecord") {
      return ["orders"];
    }
    if (mode === "products") {
      return ["products"];
    }
    return ["orders", "products"];
  }, [mode]);

  // Handle Escape key to close modal smoothly
  useEffect(() => {
    if (!isModal || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModal, onClose]);
  const [dragActiveOrders, setDragActiveOrders] = useState(false);
  const [dragActiveIncome, setDragActiveIncome] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileData[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);

  // Separating import types
  const [importType, setImportType] = useState<"orders" | "products">(
    mode === "products" ? "products" : "orders"
  );

  useEffect(() => {
    if (mode === "products") {
      setImportType("products");
    } else if (mode === "orders" || mode === "income") {
      setImportType("orders");
    }
  }, [mode]);
  const [updateProductInventory, setUpdateProductInventory] = useState(true);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // States for product import
  const [productDragActive, setProductDragActive] = useState(false);
  const [productFileName, setProductFileName] = useState<string | null>(null);
  const [parsedProducts, setParsedProducts] = useState<ParsedImportProduct[]>([]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);
  const [selectedRowIdx, setSelectedRowIdx] = useState<number>(-1);
  const [isColMenuOpen, setIsColMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [uploadPlatform, setUploadPlatform] = useState<"all" | "lazada" | "shopee" | "tiktok" | "facebook" | "line">("all");
  const [activeCardDrag, setActiveCardDrag] = useState<"lazada" | "shopee" | "tiktok" | "facebook" | "line" | null>(null);

  // Local state for Step 1 multi-file queue management (12+ files support)
  const [queueSearch, setQueueSearch] = useState("");
  const [queueSort, setQueueSort] = useState<"month" | "name" | "rows" | "platform">("month");

  // Local state for 2-step verification preview mode
  const [previewData, setPreviewData] = useState<Order[]>([]);
  const [previewViewMode, setPreviewViewMode] = useState<"parsed" | "raw">("parsed");
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewSort, setPreviewSort] = useState<{ key: keyof Order | null; dir: 1 | -1 }>({ key: null, dir: 1 });
  const [previewPage, setPreviewPage] = useState(0);
  const [previewPageSize, setPreviewPageSize] = useState(50);
  const [previewFileFilter, setPreviewFileFilter] = useState<string>("all");

  useEffect(() => {
    if (pendingImportFile) {
      const newDatasets: Dataset[] = [];
      const newUploadedFiles: UploadedFileData[] = [];
      const allSheetsData: Record<string, { rows: unknown[][]; headers: string[]; headerRowIndex: number }> = {};

      pendingImportFile.sheets.forEach((sheet) => {
        const columns: ColumnDef[] = sheet.headers.map((h, c) => {
          const label = h || `คอลัมน์ ${c + 1}`;
          return {
            key: `c${c}`,
            label,
            autogen: !h,
            isId: isIdHeader(label),
            isMoney: isMoneyHeader(label),
            visible: true,
            isNum: false
          };
        });

        columns.forEach(col => {
          let num = 0, tot = 0;
          sheet.rows.forEach(row => {
            const v = row[col.label];
            if (v === null || v === undefined || v === "") return;
            tot++;
            const clean = String(v).replace(/[^0-9.-]/g, "");
            let cleanedStr = clean;
            if (clean.endsWith("-")) {
              cleanedStr = "-" + clean.slice(0, -1);
            }
            if (/^-?\d+(\.\d+)?$/.test(cleanedStr)) num++;
          });
          col.isNum = tot > 0 && num / tot >= 0.6;
        });

        const rows = sheet.rows.map((row) => {
          const o: Record<string, any> = {};
          columns.forEach((col, c) => {
            const v = row[sheet.headers[c]] ?? null;
            let parsedVal: any = v;
            if (!col.isId && typeof v === "string") {
              const s = v.trim();
              if (s !== "") {
                const cl = s.replace(/[^0-9.-]/g, "");
                let cleanedStr = cl;
                if (cl.endsWith("-")) {
                  cleanedStr = "-" + cl.slice(0, -1);
                }
                if (/^-?\d+(\.\d+)?$/.test(cleanedStr)) {
                  parsedVal = Number(cleanedStr);
                }
              }
            }
            o[col.key] = parsedVal;
          });
          return o;
        });

        const ds: Dataset = {
          id: `ds${datasets.length + newDatasets.length}_${Math.random().toString(36).slice(2, 6)}`,
          platform: pendingImportFile.platform,
          kind: pendingImportFile.type === "orderRecord" ? "order" : pendingImportFile.type === "incomeRecord" ? "income" : pendingImportFile.type === "order" ? "order" : pendingImportFile.type === "income" ? "income" : "data",
          fileName: pendingImportFile.fileName,
          sheetName: sheet.name,
          columns,
          rows,
          kvMode: sheet.headers.length <= 2,
          search: "",
          sort: { key: null, dir: 1 },
          page: 0,
          pageSize: 50
        };

        if (rows.length > 0) {
          newDatasets.push(ds);
        }

        const fileRows: unknown[][] = [
          sheet.headers,
          ...sheet.rows.map(row => sheet.headers.map(h => row[h]))
        ];

        allSheetsData[sheet.name] = {
          rows: fileRows,
          headers: sheet.headers,
          headerRowIndex: 0
        };
      });

      const firstSheetName = pendingImportFile.sheets[0]?.name || "";
      if (firstSheetName) {
        newUploadedFiles.push({
          id: pendingImportFile.id,
          fileName: pendingImportFile.fileName,
          headers: allSheetsData[firstSheetName].headers,
          rows: allSheetsData[firstSheetName].rows,
          headerRowIndex: 0,
          sheetNames: pendingImportFile.sheets.map(s => s.name),
          activeSheetName: firstSheetName,
          allSheetsData,
          platform: pendingImportFile.platform
        });
      }

      if (newDatasets.length > 0) {
        setDatasets(newDatasets);
        setUploadedFiles(newUploadedFiles);
        setActiveDatasetId(newDatasets[0].id);
        triggerAlert(`เพิ่มไฟล์ที่ค้างอยู่ "${pendingImportFile.fileName}" เรียบร้อยแล้ว`, "success");
      }

      if (onClearPendingImportFile) {
        onClearPendingImportFile();
      }
    }
  }, [pendingImportFile]);

  const hasShopeeOrder = useMemo(() => datasets.some(d => d.platform === "shopee" && d.kind === "order"), [datasets]);
  const hasShopeeIncome = useMemo(() => datasets.some(d => d.platform === "shopee" && d.kind === "income"), [datasets]);
  const hasLazadaOrder = useMemo(() => datasets.some(d => d.platform === "lazada" && d.kind === "order"), [datasets]);
  const hasLazadaIncome = useMemo(() => datasets.some(d => d.platform === "lazada" && d.kind === "income"), [datasets]);
  const hasTiktokOrder = useMemo(() => datasets.some(d => d.platform === "tiktok" && d.kind === "order"), [datasets]);
  const hasTiktokIncome = useMemo(() => datasets.some(d => d.platform === "tiktok" && d.kind === "income"), [datasets]);
  const hasFacebookOrder = useMemo(() => datasets.some(d => d.platform === "facebook" && d.kind === "order"), [datasets]);
  const hasFacebookIncome = useMemo(() => datasets.some(d => d.platform === "facebook" && d.kind === "income"), [datasets]);
  const hasLineOrder = useMemo(() => datasets.some(d => d.platform === "line" && d.kind === "order"), [datasets]);
  const hasLineIncome = useMemo(() => datasets.some(d => d.platform === "line" && d.kind === "income"), [datasets]);

  useEffect(() => {
    if (datasets.length === 0) {
      setPreviewData([]);
      setErrorMsg(null);
      return;
    }

    try {
      setErrorMsg(null);
      const ordersMap = new Map<string, Order>();
      const productBrandMap = new Map(products.map(p => [p.name.trim().toLowerCase(), p.brand]));
      const fileIdMap = new Map(uploadedFiles.map(f => [f.fileName, f.id]));

      datasets.forEach((ds) => {
        const headers = ds.columns.map(c => c.label);
        const isIncome = (currentMode === "income" || mode === "income")
          ? true
          : (currentMode === "orders" || mode === "orders")
            ? false
            : (ds.kind === "income" || (ds as any).type === "income" || (ds as any).fileType === "income" ||
               (ds.kind !== "order" && headers.some(h => ["fee name", "statement number", "ชื่อรายการธุรกรรม", "จำนวนเงินทั้งหมดที่โอนแล้ว (฿)", "วันที่โอนชำระเงินสำเร็จ"].includes(h.trim().toLowerCase()))));

        let idxId = findColIndex(headers, KEY_MAPS.orderId);
        let idxCust = findColIndex(headers, KEY_MAPS.customerName);
        let idxProd = findColIndex(headers, KEY_MAPS.productName);
        let idxQty = findColIndex(headers, KEY_MAPS.quantity);
        let idxTotal = findColIndex(headers, KEY_MAPS.total);
        let idxDate = findColIndex(headers, KEY_MAPS.date);
        let idxShip = findColIndex(headers, KEY_MAPS.shippingFee);
        const idxPlat = findColIndex(headers, KEY_MAPS.platformFee);
        let idxNet = findColIndex(headers, KEY_MAPS.netIncome);
        const idxStatus = findColIndex(headers, KEY_MAPS.status);

        const findCol = (kwList: string[], blacklist: string[] = []) => {
          return headers.findIndex((h) => {
            const clean = h.trim().toLowerCase();
            if (blacklist.some((b) => clean.includes(b.toLowerCase()))) return false;
            return kwList.some((k) => clean === k.toLowerCase() || clean.includes(k.toLowerCase()));
          });
        };

        if (ds.platform === "lazada") {
          if (!isIncome) {
            if (idxId === -1) idxId = findCol(["ordernumber", "order id", "order item id", "order item no", "order no.", "order no", "statement number", "หมายเลขคำสั่งซื้อ", "หมายเลขรายการสินค้า"]);
            if (idxCust === -1) idxCust = findCol(["customername", "customer name", "shippingname", "shipping name", "buyer name", "ชื่อลูกค้า", "ชื่อผู้รับ"]);
            if (idxProd === -1) idxProd = findCol(["itemname", "item name", "product name", "product_name", "fee name", "details", "ชื่อสินค้า"]);
            if (idxTotal === -1) idxTotal = findCol(["paidprice", "paid price", "unitprice", "unit price", "amount", "total", "ยอดชำระ(บาท)", "จำนวนเงิน(รวมภาษี)", "ยอดชำระเงินทั้งหมด", "ราคาขาย"]);
            if (idxDate === -1) idxDate = findCol(["createtime", "create time", "created time", "order date", "transaction date", "วันที่สั่งซื้อ", "เวลาสั่งซื้อ", "วันที่ทำรายการ"]);
            if (idxShip === -1) idxShip = findCol(["shippingfee", "shipping fee", "ค่าจัดส่ง"]);
          } else {
            if (idxId === -1) idxId = findCol(["หมายเลขคำสั่งซื้อ", "ordernumber", "order id", "order item id", "orderitemid", "order no.", "order no", "order item no", "order item no.", "statement number", "หมายเลขรายการสินค้า"]);
            if (idxProd === -1) idxProd = findCol(["ชื่อสินค้า", "itemname", "item name", "product name", "fee name", "details"]);
            if (idxTotal === -1) idxTotal = findCol(["ยอดชำระ(บาท)", "จำนวนเงิน(รวมภาษี)", "ยอดชำระเงินทั้งหมด", "amount", "total", "paid price", "unit price"]);
            if (idxDate === -1) idxDate = findCol(["วันที่ทำรายการ", "transaction date", "date", "create time", "created time"]);
          }
        } else if (ds.platform === "shopee") {
          if (!isIncome) {
            if (idxId === -1) idxId = findCol(["หมายเลขคำสั่งซื้อ"]);
            if (idxCust === -1) idxCust = findCol(["ชื่อผู้ใช้ (ผู้ซื้อ)"]);
            if (idxProd === -1) idxProd = findCol(["ชื่อสินค้า"]);
            if (idxQty === -1) idxQty = findCol(["จำนวนสินค้าที่ซื้อ", "จำนวนสินค้า", "จำนวนชิ้น", "จำนวนที่ซื้อ", "จำนวน"], ["เงิน", "บาท", "thb", "โอน", "ชำระ", "สุทธิ", "ยอด", "price", "ราคา", "fee", "ค่า"]);
            if (idxTotal === -1) idxTotal = findCol([
              "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย",
              "ยอดรวมค่าสินค้า",
              "ราคาขายสุทธิ",
              "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)",
              "ราคาสินค้าที่ชำระโดยผู้ซื้อ",
              "สินค้าราคาปกติ",
              "ราคาขาย"
            ], ["ยอดรวมของคำสั่งซื้อ", "ยอดรวมคำสั่งซื้อ", "จำนวนเงินทั้งหมดที่โอนแล้ว"]);
            if (idxDate === -1) idxDate = findCol(["เวลาสั่งซื้อ", "เวลาที่ชำระเงิน", "วันที่ทำการสั่งซื้อ"]);
            if (idxShip === -1) idxShip = findCol(["ค่าจัดส่งที่ชำระโดยผู้ซื้อ", "ค่าจัดส่ง"]);
          } else {
            if (idxId === -1) idxId = findCol(["หมายเลขคำสั่งซื้อ"]);
            if (idxCust === -1) idxCust = findCol(["ชื่อผู้ซื้อ", "ชื่อผู้ใช้ (ผู้ซื้อ)"]);
            if (idxTotal === -1) idxTotal = findCol(["ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย", "ยอดรวมค่าสินค้า", "สินค้าราคาปกติ", "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)"], ["ยอดรวมของคำสั่งซื้อ"]);
            if (idxDate === -1) idxDate = findCol(["เวลาสั่งซื้อ", "วันที่โอนชำระเงินสำเร็จ"]);
            if (idxNet === -1) idxNet = findCol(["จำนวนเงินโอนสุทธิ", "จำนวนเงินทั้งหมดที่โอนแล้ว (฿)"]);
          }
        }

        // Headerless Express file mapping
        // Headerless Express / ERP file mapping for all platforms
        const isHeaderless = headers.some(h => h.startsWith("คอลัมน์") || h.includes("หมายเลขคำสั่งซื้อ") || h.includes("Invoice") || h.includes("เลขที่เอกสาร"));
        if (isHeaderless && (idxId === -1 || idxDate === -1 || idxTotal === -1)) {
          if (headers.length >= 16) {
            if (idxId === -1) idxId = 1;      // คอลัมน์ 2 (Order ID / Invoice)
            if (idxDate === -1) idxDate = 2;    // คอลัมน์ 3 (Date)
            if (idxCust === -1) idxCust = 6;    // คอลัมน์ 7 (Customer Name)
            if (idxProd === -1) idxProd = 8;    // คอลัมน์ 9 (Product Name)
            if (idxQty === -1) idxQty = 9;     // คอลัมน์ 10 (Quantity)
            if (idxTotal === -1) idxTotal = 16;  // คอลัมน์ 17 (Total)
            if (idxNet === -1) idxNet = 16;
          } else if (headers.length >= 8) {
            if (idxTotal === -1) idxTotal = 0;  // Col 1 (Amount)
            if (idxQty === -1) idxQty = 1;      // Col 2 (Qty)
            if (idxId === -1) idxId = 2;        // Col 3 (Invoice / Order ID)
            if (idxDate === -1) idxDate = 3;    // Col 4 (Date)
            if (idxCust === -1) idxCust = 4;    // Col 5 (Branch/Customer)
            if (idxProd === -1) idxProd = headers.length >= 9 ? 8 : 6; // Col 9 (Product Name) or SKU
            if (idxNet === -1) idxNet = 0;
          }
        }

        // Fallback: search row values for Order ID / Invoice if still -1
        if (idxId === -1) {
          const sample = ds.rows[0];
          if (sample) {
            for (let c = 0; c < ds.columns.length; c++) {
              const val = String(sample[ds.columns[c].key] || "").trim();
              if (/^(IV|HS|INV|SO|DOC)\d+/i.test(val) || (/^\d{10,25}[A-Za-z0-9]*$/.test(val) && /\d/.test(val) && !/^\d{1,6}$/.test(val))) {
                idxId = c;
                break;
              }
            }
          }
          if (idxId === -1 && ds.columns.length > 1) {
            idxId = 1; // Default to Column 2
          }
        }

        if (idxId === -1) {
          // If this is a summary/report sheet or other sheets exist in datasets from this file, skip gracefully without throwing error
          const fileDatasets = datasets.filter(d => d.fileName === ds.fileName);
          const isDocOrSummary = [
            "summary", "ภาพรวม", "overview", "บันทึกการถอน", "คำอธิบาย", "glossary", 
            "withdraw", "คู่มือ", "instruction", "readme", "template", "help", "setting"
          ].some(kw => ds.sheetName.toLowerCase().includes(kw));

          if (fileDatasets.length > 1 || isDocOrSummary || ds.platform === "lazada") {
            return;
          }
          throw new Error(`ไฟล์ "${ds.fileName}" (${ds.sheetName}) ไม่มีหมายเลขคำสั่งซื้อ (Order ID)`);
        }

        const colId = ds.columns[idxId];
        const colCust = idxCust !== -1 ? ds.columns[idxCust] : null;
        const colProd = idxProd !== -1 ? ds.columns[idxProd] : null;
        const colQty = idxQty !== -1 ? ds.columns[idxQty] : null;
        const colTotal = idxTotal !== -1 ? ds.columns[idxTotal] : null;
        const colShip = idxShip !== -1 ? ds.columns[idxShip] : null;
        const colPlat = idxPlat !== -1 ? ds.columns[idxPlat] : null;
        const colNet = idxNet !== -1 ? ds.columns[idxNet] : null;
        const colDate = idxDate !== -1 ? ds.columns[idxDate] : null;
        const colStatus = idxStatus !== -1 ? ds.columns[idxStatus] : null;

        // Pre-compute fee columns for Shopee to avoid looping columns per row
        const shopeeFeeColKeys: string[] = [];
        if (ds.platform === "shopee") {
          const feeKeywords = ["ค่าคอมมิชชั่น", "transaction fee", "ค่าบริการ", "ค่าธรรมเนียมโครงสร้างพื้นฐานแพลตฟอร์ม", "ค่าธุรกรรมการชำระเงิน", "ค่าคอมมิชชั่น ams", "ค่าธรรมเนียม ของโปรแกรมประหยัดค่าจัดส่ง", "ค่าธรรมเนียม"];
          ds.columns.forEach((col) => {
            const hLower = col.label.toLowerCase();
            if (feeKeywords.some(kw => hLower.includes(kw))) {
              shopeeFeeColKeys.push(col.key);
            }
          });
        }

        // Pre-compute cancel/status check columns to avoid Object.entries(row) per row
        const cancelCheckKeys = ds.columns.filter(c => {
          const kLower = c.label.trim().toLowerCase();
          return (
            kLower.includes("cancel") ||
            kLower.includes("ยกเลิก") ||
            kLower.includes("refund") ||
            kLower.includes("คืนเงิน") ||
            kLower.includes("return") ||
            kLower.includes("คืนสินค้า") ||
            kLower.includes("เหตุผล") ||
            kLower.includes("สถานะ")
          );
        }).map(c => c.key);

        const channelName = ds.platform === "tiktok" ? "TikTok Shop" : ds.platform === "lazada" ? "Lazada" : ds.platform === "shopee" ? "Shopee" : ds.platform === "facebook" ? "Facebook" : ds.platform === "line" ? "LINE OA" : "ทั่วไป";
        const datasetIdForOrder = ds.fileId || fileIdMap.get(ds.fileName) || ds.id;

        const dsRowsLen = ds.rows.length;
        for (let rIdx = 0; rIdx < dsRowsLen; rIdx++) {
          const row = ds.rows[rIdx];
          const rawId = colId ? row[colId.key] : null;
          if (rawId === null || rawId === undefined || String(rawId).trim() === "") continue;

          const orderId = String(rawId).trim();
          let customerName = colCust && row[colCust.key] ? String(row[colCust.key]).trim() : "ลูกค้าทั่วไป";
          if (customerName.includes("/")) {
            const parts = customerName.split("/");
            customerName = parts[parts.length - 1].trim() || customerName;
          }
          let productName = colProd && row[colProd.key] ? String(row[colProd.key]).trim() : (isIncome ? "รายการรายรับบัญชี" : "ไม่ระบุสินค้า");
          
          if (ds.platform === "tiktok" && isIncome && productName.includes("*")) {
            productName = "รายการสินค้า (TikTok)";
          }

          const quantity = colQty && row[colQty.key] !== null ? Math.max(1, Math.round(parseNumber(row[colQty.key]))) : 1;
          let rawAmount = colTotal && row[colTotal.key] !== null ? parseNumber(row[colTotal.key]) : 0;
          if (rawAmount === 0) {
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
              const matchedCol = ds.columns.find(c => c.label.trim().toLowerCase() === fk);
              if (matchedCol && row[matchedCol.key] !== null && row[matchedCol.key] !== undefined) {
                const p = parseNumber(row[matchedCol.key]);
                if (p > 0 && p <= 50000) {
                  rawAmount = p;
                  break;
                }
              }
            }
          }
          const shippingFee = colShip && row[colShip.key] !== null ? Math.abs(parseNumber(row[colShip.key])) : 0;

          let rowStatus: "Paid" | "Pending" | "Refunded" = "Paid";
          if (colStatus && row[colStatus.key] !== undefined && row[colStatus.key] !== null && String(row[colStatus.key]).trim() !== "") {
            rowStatus = parseOrderStatus(row[colStatus.key]);
          }

          if (rowStatus !== "Refunded" && !isIncome) {
            for (let kIdx = 0; kIdx < cancelCheckKeys.length; kIdx++) {
              const k = cancelCheckKeys[kIdx];
              const v = row[k];
              if (v === null || v === undefined || v === "") continue;
              const vStr = String(v).trim().toLowerCase();
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
                rowStatus = "Refunded";
                break;
              }
            }
          }

          if (rawAmount < 0 && !isIncome) {
            rowStatus = "Refunded";
          }
          
          let total: number;
          let platformFee = 0;
          let netIncome: number;

          if (ds.platform === "lazada" && isIncome) {
            if (rawAmount > 0) {
              total = rawAmount;
              platformFee = 0;
            } else {
              total = 0;
              platformFee = Math.abs(rawAmount);
            }
            netIncome = rawAmount;
          } else {
            const isUnitPriceCol = (colName?: string): boolean => {
              if (!colName) return false;
              const l = colName.toLowerCase().trim();
              if (l.includes("หลังหักส่วนลด") || l.includes("subtotal") || l.includes("ยอดรวมค่าสินค้า")) {
                return false;
              }
              return (
                l.includes("ราคาขายสุทธิ") ||
                l.includes("ราคาสินค้าที่ชำระโดยผู้ซื้อ") ||
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
                l === "ราคา" ||
                l === "price"
              );
            };

            if (!isIncome && quantity > 1 && rawAmount > 0 && isUnitPriceCol(colTotal?.label)) {
              total = rawAmount * quantity;
            } else {
              total = Math.abs(rawAmount);
            }

            if (!isIncome && total / quantity > 50000) {
              total = 0;
            }

            if (ds.platform === "shopee") {
              for (let fIdx = 0; fIdx < shopeeFeeColKeys.length; fIdx++) {
                const val = row[shopeeFeeColKeys[fIdx]];
                if (val !== undefined && val !== null && val !== "") {
                  platformFee += Math.abs(parseNumber(val));
                }
              }
            } else {
              platformFee = colPlat && row[colPlat.key] !== null ? Math.abs(parseNumber(row[colPlat.key])) : 0;
            }
            netIncome = colNet && row[colNet.key] !== null 
              ? parseNumber(row[colNet.key]) 
              : (isIncome ? total : (rowStatus === "Refunded" ? 0 : total - shippingFee - platformFee));
            if (!isIncome && rowStatus === "Refunded" && netIncome > 0) {
              netIncome = 0;
            }
          }

          const rawDate = colDate ? row[colDate.key] : null;
          const dateStr = rawDate ? parseAndNormalizeDate(rawDate) : new Date().toISOString().split("T")[0];

          // Resolve brand auto-detection with O(1) map
          let brand = "";
          if (productName && productName !== "ไม่ระบุสินค้า" && productName !== "รายการรายรับบัญชี") {
            brand = productBrandMap.get(productName.toLowerCase()) || "";
          }
          if (!brand || brand === "ทั่วไป" || brand === "ไม่ระบุแบรนด์") {
            const detected = detectBrand(row, productName);
            brand = detected !== "ทั่วไป" ? detected : "สินค้าอื่นๆที่ไม่มีแบรนด์";
          }

          const orderMapKey = isIncome ? orderId : `${ds.id}-${orderId}-${rIdx}`;
          const orderItem: Order = {
            id: isIncome ? orderId : `${orderId}-row-${rIdx}`,
            customerName,
            email: "",
            productName,
            quantity,
            total,
            status: rowStatus,
            date: dateStr,
            shippingFee,
            platformFee,
            netIncome,
            isIncome,
            channel: channelName,
            brand: brand || "สินค้าอื่นๆที่ไม่มีแบรนด์",
            datasetId: datasetIdForOrder
          };

          const existing = ordersMap.get(orderMapKey);
          if (!existing) {
            ordersMap.set(orderMapKey, orderItem);
          } else {
            if (isIncome) {
              if (ds.platform === "lazada") {
                if (total > 0) {
                  existing.total = (existing.total || 0) + total;
                } else {
                  existing.platformFee = (existing.platformFee || 0) + platformFee;
                }
                existing.netIncome = (existing.netIncome || 0) + netIncome;
              } else {
                existing.platformFee = (existing.platformFee || 0) + platformFee;
                existing.netIncome = (existing.netIncome || 0) + netIncome;
              }
              existing.hasNetIncome = true;
              if (existing.productName === "ไม่ระบุสินค้า" && productName !== "รายการรายรับบัญชี") {
                existing.productName = productName;
              }
            } else {
              existing.customerName = customerName || existing.customerName;
              existing.productName = productName !== "รายการรายรับบัญชี" ? productName : existing.productName;
              existing.quantity = quantity || existing.quantity;
              existing.total = total || existing.total;
              existing.netIncome = netIncome || existing.netIncome;
              existing.platformFee = platformFee || existing.platformFee;
              existing.date = dateStr || existing.date;
              existing.shippingFee = shippingFee || existing.shippingFee;
              existing.brand = brand || existing.brand;
            }
          }
        }
      });

      const mergedOrders = Array.from(ordersMap.values());

      // Post-process merged orders to apply standard calculation rules and round decimals
      mergedOrders.forEach((order) => {
        if (!order.isIncome) {
          if (!order.netIncome || order.netIncome === 0) {
            order.netIncome = Math.max(0, (order.total || 0) - (order.platformFee || 0) - (order.shippingFee || 0));
          }
        } else {
          if (order.channel === "Shopee") {
            if (!order.total || order.total === 0) {
              order.total = (order.netIncome || 0) + (order.platformFee || 0) + (order.shippingFee || 0);
            }
          } else if (order.channel === "Lazada") {
            if (!order.total || order.total === 0) {
              order.total = Math.max(0, (order.netIncome || 0) + (order.platformFee || 0) + (order.shippingFee || 0));
            }
          } else if (order.channel === "TikTok Shop") {
            if (!order.netIncome || order.netIncome === 0) {
              order.netIncome = Math.max(0, (order.total || 0) - (order.platformFee || 0) - (order.shippingFee || 0));
            } else if (!order.total || order.total === 0) {
              order.total = (order.netIncome || 0) + (order.platformFee || 0) + (order.shippingFee || 0);
            }
          }
        }

        order.total = Math.round((order.total || 0) * 100) / 100;
        order.platformFee = Math.round((order.platformFee || 0) * 100) / 100;
        order.shippingFee = Math.round((order.shippingFee || 0) * 100) / 100;
        order.netIncome = Math.round((order.netIncome || 0) * 100) / 100;
      });

      setPreviewData(mergedOrders);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPreviewData([]);
    }
  }, [datasets, products, uploadedFiles]);

  const handleDeleteFile = (fileIdOrName: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileIdOrName && f.fileName !== fileIdOrName));
    setDatasets(prev => {
      const remaining = prev.filter(d => (d.fileId ? d.fileId !== fileIdOrName : (d.id !== fileIdOrName && d.fileName !== fileIdOrName)));
      if (activeDatasetId && prev.find(d => d.id === activeDatasetId && (d.fileId === fileIdOrName || d.id === fileIdOrName || d.fileName === fileIdOrName))) {
        setActiveDatasetId(remaining[0]?.id || null);
      }
      return remaining;
    });
  };

  const handleReset = () => {
    setUploadedFiles([]);
    setDatasets([]);
    setActiveDatasetId(null);
    setErrorMsg(null);
    setPreviewData([]);
    setPreviewSearch("");
    setPreviewSort({ key: null, dir: 1 });
    setPreviewPage(0);
    setPreviewViewMode("parsed");
    setPreviewFileFilter("all");
    setCurrentStep(1);
  };

  const handleAutoProcessAndSubmit = () => {
    if (previewData.length === 0) return;
    try {
      // บันทึกชุดข้อมูล Orders ลงใน localStorage ภายใต้ Key 'mock_supabase_orders'
      try {
        const existingSaved = localStorage.getItem("mock_supabase_orders");
        let updatedOrders: Order[] = [];
        if (existingSaved) {
          try {
            const parsedExisting = JSON.parse(existingSaved);
            if (Array.isArray(parsedExisting)) {
              updatedOrders = parsedExisting;
            }
          } catch (e) {
            console.error("Failed to parse existing mock_supabase_orders:", e);
          }
        } else {
          // ดึงจาก 'orders' เป็นตัวสำรองเริ่มต้น
          const backup = localStorage.getItem("orders");
          if (backup) {
            try {
              const parsedBackup = JSON.parse(backup);
              if (Array.isArray(parsedBackup)) {
                updatedOrders = parsedBackup;
              }
            } catch (e) {
              console.error("Failed to parse backup orders:", e);
            }
          }
        }

        const updatedOrdersMap = new Map(updatedOrders.map(o => [o.id, o]));
        previewData.forEach((incoming) => {
          const existing = updatedOrdersMap.get(incoming.id);
          if (existing) {
            existing.total = incoming.total;
            existing.netIncome = incoming.netIncome;
            existing.platformFee = incoming.platformFee;
            existing.shippingFee = incoming.shippingFee;
            existing.quantity = incoming.quantity;
            existing.customerName = incoming.customerName || existing.customerName;
            existing.productName = incoming.productName !== "รายการรายรับบัญชี" ? incoming.productName : existing.productName;
            existing.date = incoming.date || existing.date;
            existing.brand = incoming.brand || existing.brand;
            existing.isIncome = incoming.isIncome;
            existing.channel = incoming.channel;
          } else {
            updatedOrdersMap.set(incoming.id, incoming);
          }
        });
        const finalOrders = Array.from(updatedOrdersMap.values());

        localStorage.setItem("mock_supabase_orders", JSON.stringify(finalOrders));
        localStorage.setItem("orders", JSON.stringify(finalOrders));
        window.dispatchEvent(new Event("mock_supabase_orders_updated"));
        syncOrdersToSupabase(finalOrders);
      } catch (err) {
        console.error("Error saving mock_supabase_orders:", err);
      }

      const newUploadedDatasets: UploadedDataset[] = uploadedFiles.map((file) => {
        const sheetsData = file.sheetNames?.map(name => {
          let headers = file.allSheetsData?.[name]?.headers || [];
          const isHeaderless = headers.some(h => h.startsWith("คอลัมน์"));
          
          if (isHeaderless && headers.length >= 15) {
            headers = headers.map((h, c) => {
              if (c === 0) return "ลำดับ (Seq)";
              if (c === 1) return "หมายเลขคำสั่งซื้อ / เลขที่เอกสาร (Order ID / Invoice)";
              if (c === 2) return "วันที่ (Date)";
              if (c === 3) return "รหัสสาขา/ไปรษณีย์ (Code)";
              if (c === 4) return "ระบบ/ช่องทาง (System)";
              if (c === 5) return "รหัสสินค้า/SKU (SKU Reference)";
              if (c === 6) return "ชื่อลูกค้า (Customer Name)";
              if (c === 7) return "ที่อยู่ / ข้อมูลติดต่อ (Address / Contact)";
              if (c === 8) return "ชื่อสินค้า (Product Name)";
              if (c === 9) return "จำนวน (Quantity)";
              if (c === 10) return "หน่วย (Unit)";
              if (c === 11) return "ราคาต่อหน่วย (Unit Price)";
              if (c === 12) return "ส่วนลด (Discount)";
              if (c === 13) return "ยอดรวมก่อนภาษี (Subtotal)";
              if (c === 14) return "ภาษีมูลค่าเพิ่ม (VAT)";
              if (c === 15) return "หมายเหตุ / ข้อมูลเพิ่มเติม (Note / Extra)";
              if (c === 16) return "ยอดขายรวม / รายรับสุทธิ (Gross Sales / Net Income)";
              return h;
            });
          } else if (isHeaderless && headers.length === 9) {
            headers = [
              "ยอดเงิน / ราคาขาย (Amount / Net Sales)",
              "ลำดับ / จำนวน (Quantity / Seq)",
              "เลขที่เอกสาร / Invoice (Order ID / Invoice)",
              "วันที่ (Date)",
              "รหัสลูกค้า / สาขา (Customer / Branch Code)",
              "ระบบ / ช่องทาง / แบรนด์ (System / Brand)",
              "รหัสสินค้า / SKU (SKU Reference)",
              "หมายเลขคำสั่งซื้อ (Order ID / SN)",
              "ชื่อสินค้า (Product Name)"
            ];
          }

          const dataRows = file.allSheetsData?.[name]?.rows || [];
          const recordRows = dataRows.map(row => {
            const obj: Record<string, unknown> = {};
            headers.forEach((h, c) => {
              obj[h] = row[c] ?? null;
            });
            return obj;
          });
          return {
            name,
            headers,
            rows: recordRows
          };
        }) || [];

        const isFileIncome = (currentMode === "income" || mode === "income")
          ? true
          : (currentMode === "orders" || mode === "orders")
            ? false
            : (detectKind(file.fileName, file.activeSheetName || "") === "income");
        return {
          id: file.id || generateUniqueId("ds"),
          fileName: file.fileName,
          platform: file.platform,
          type: (isFileIncome ? "income" : "order") as any,
          fileType: (isFileIncome ? "income" : "order") as any,
          uploadedAt: getCurrentFormattedDate(),
          sheets: sheetsData
        };
      });

      if (onImportOrders) {
        onImportOrders(previewData, newUploadedDatasets);
      } else if (onSubmit) {
        onSubmit(previewData, updateProductInventory);
      }

      if (onImportDatasets) {
        onImportDatasets(newUploadedDatasets);
      }

      triggerAlert(`นำเข้าข้อมูลคำสั่งซื้อรวม ${previewData.length} รายการเรียบร้อยแล้ว`, "success");
      handleReset();
      if (isModal) {
        if (onClose) onClose();
      } else {
        setActiveTab("dashboard");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      triggerAlert(e instanceof Error ? e.message : "เกิดข้อผิดพลาดในการประมวลผล", "error");
    }
  };

  const processSingleFile = async (
    file: File,
    forcedPlatform?: Dataset["platform"],
    forcedKind?: "order" | "income",
    currentDatasetsCount: number = 0
  ): Promise<{ uploadedFile: UploadedFileData; datasets: Dataset[] }> => {
    if (file.name.startsWith("~$")) {
      throw new Error(`ไม่สามารถนำเข้าไฟล์ชั่วคราว (Temporary File) "${file.name}" ได้`);
    }

    const validation = validateUploadedFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || "ไฟล์ไม่ผ่านการตรวจสอบความปลอดภัย");
    }

    const fileId = generateUniqueId("f");
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    const defaultKind = forcedKind || ((currentMode === "income" || mode === "income") ? "income" : (currentMode === "orders" || mode === "orders") ? "order" : detectKind(file.name, "Default"));

    if (isExcel) {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetNames = workbook.SheetNames;

      const visibleSheetNames = sheetNames.filter((sheetName, sIdx) => {
        return !isSheetHidden(workbook, sheetName, sIdx);
      });

      let firstValidSheet: string | null = null;
      const newDatasets: Dataset[] = [];
      const allSheetsData: Record<string, { rows: unknown[][]; headers: string[]; headerRowIndex: number }> = {};
      let platformType = forcedPlatform || detectPlatform(file.name);
      const processedSheetNames: string[] = [];

      for (const sheetName of visibleSheetNames) {
        const ws = workbook.Sheets[sheetName];
        if (!ws) continue;
        
        const aoa = getVisibleAoa(ws);
        const filteredAoa = aoa.filter(r => r && r.some(c => c !== null && c !== undefined && String(c).trim() !== ""));
        if (!filteredAoa.length) continue;

        const parsed = parseFileRows(filteredAoa);
        const sk = sheetKind(sheetName);

        const cleanHeaders = parsed.headers.map(h => h.trim().toLowerCase());
        const hasOrderId = cleanHeaders.some(h => 
          KEY_MAPS.orderId.some(k => h === k.toLowerCase() || h.includes(k.toLowerCase()))
        );
        const hasIncomeHeader = cleanHeaders.some(h => 
          KEY_MAPS.netIncome.some(k => h === k.toLowerCase() || h.includes(k.toLowerCase())) ||
          KEY_MAPS.platformFee.some(k => h === k.toLowerCase() || h.includes(k.toLowerCase())) ||
          KEY_MAPS.total.some(k => h === k.toLowerCase() || h.includes(k.toLowerCase())) ||
          ["statement number", "fee name", "paid status", "transaction", "amount", "ยอดเงิน", "รายรับ", "ค่าธรรมเนียม", "ยอดโอน", "รายได้"].some(k => h === k.toLowerCase() || h.includes(k.toLowerCase()))
        );

        // If multiple sheets exist, skip pure documentation/glossary/instruction/summary sheets if they don't have order or income headers
        const isDocOrSummarySheet = (sk === "withdraw" || sk === "glossary" || sk === "report" || ["summary", "ภาพรวม", "overview", "คู่มือ", "คำแนะนำ", "คำอธิบาย", "template", "setting", "toc"].some(k => sheetName.toLowerCase().includes(k))) && !hasOrderId && !hasIncomeHeader && platformType !== "lazada";
        if (visibleSheetNames.length > 1 && isDocOrSummarySheet) {
          allSheetsData[sheetName] = {
            rows: parsed.rows,
            headers: parsed.headers,
            headerRowIndex: parsed.headerRowIndex
          };
          processedSheetNames.push(sheetName);
          continue; // Skip creating dataset from non-order summary/doc sheet
        }

        const detected = determinePlatform(file.name, parsed.headers);

        if (forcedPlatform && detected !== "unknown" && detected !== forcedPlatform) {
          const displayDetected = PLATFORMS[detected]?.label || detected;
          const displayTarget = PLATFORMS[forcedPlatform]?.label || forcedPlatform;
          throw new Error(`ไฟล์ "${file.name}" เป็นไฟล์ของแพลตฟอร์ม ${displayDetected} ซึ่งไม่ตรงกับแพลตฟอร์ม ${displayTarget} ที่คุณเลือกอัปโหลด`);
        }

        if (platformType === "unknown" && detected !== "unknown") {
          platformType = detected;
        }

        allSheetsData[sheetName] = {
          rows: parsed.rows,
          headers: parsed.headers,
          headerRowIndex: parsed.headerRowIndex
        };

        processedSheetNames.push(sheetName);

        if (!firstValidSheet) {
          firstValidSheet = sheetName;
        }

        const thisKind = defaultKind;

        const ds = buildDataset(workbook, sheetName, file.name, platformType, thisKind, currentDatasetsCount + newDatasets.length, { filteredAoa, parsed }, fileId);
        if (ds && ds.rows.length > 0) {
          newDatasets.push(ds);
        }
      }

      if (!firstValidSheet && processedSheetNames.length > 0) {
        firstValidSheet = processedSheetNames[0];
      }

      if (!firstValidSheet) {
        throw new Error(`ไฟล์ "${file.name}" ไม่มีเวิร์กชีทที่มีข้อมูล`);
      }

      const activeSheet = allSheetsData[firstValidSheet];
      const newUploadedFile: UploadedFileData = {
        id: fileId,
        fileName: file.name,
        rows: activeSheet.rows,
        headers: activeSheet.headers,
        headerRowIndex: activeSheet.headerRowIndex,
        sheetNames: processedSheetNames,
        activeSheetName: firstValidSheet,
        allSheetsData,
        platform: platformType
      };

      return { uploadedFile: newUploadedFile, datasets: newDatasets };
    } else {
      const text = await readFileAsText(file);
      const rows = parseCSV(text);
      if (rows.length === 0) {
        throw new Error(`ไฟล์ "${file.name}" ไม่มีข้อมูล`);
      }

      let platformType = forcedPlatform || detectPlatform(file.name);
      const kind = forcedKind || (currentMode === "income" || mode === "income" ? "income" : (currentMode === "orders" || mode === "orders" ? "order" : detectKind(file.name, "Default")));
      const parsed = parseFileRows(rows);
      const detected = determinePlatform(file.name, parsed.headers);

      if (forcedPlatform && detected !== "unknown" && detected !== forcedPlatform) {
        const displayDetected = PLATFORMS[detected]?.label || detected;
        const displayTarget = PLATFORMS[forcedPlatform]?.label || forcedPlatform;
        throw new Error(`ไฟล์ "${file.name}" เป็นไฟล์ของแพลตฟอร์ม ${displayDetected} ซึ่งไม่ตรงกับแพลตฟอร์ม ${displayTarget} ที่คุณเลือกอัปโหลด`);
      }

      if (platformType === "unknown" && detected !== "unknown") {
        platformType = detected;
      }

      const allSheetsData = {
        Default: {
          rows: parsed.rows,
          headers: parsed.headers,
          headerRowIndex: parsed.headerRowIndex
        }
      };

      const newUploadedFile: UploadedFileData = {
        id: fileId,
        fileName: file.name,
        rows: parsed.rows,
        headers: parsed.headers,
        headerRowIndex: parsed.headerRowIndex,
        sheetNames: ["Default"],
        activeSheetName: "Default",
        allSheetsData,
        platform: platformType
      };

      const { idx } = detectHeaderRow(rows);
      const headerRow = rows[idx] || [];
      const dataRows = rows.slice(idx + 1).filter(r => r.some(c => c !== null && String(c).trim() !== ""));
      const maxCols = Math.max(headerRow.length, ...dataRows.map(r => r.length), 1);

      const columns: ColumnDef[] = [];
      for (let c = 0; c < maxCols; c++) {
        const raw = headerRow[c];
        const auto = false;
        const lbl = raw === null || raw === undefined || String(raw).trim() === "" ? `คอลัมน์ ${c + 1}` : String(raw).trim();
        columns.push({
          key: `c${c}`,
          label: lbl,
          autogen: auto,
          isId: isIdHeader(lbl),
          isMoney: isMoneyHeader(lbl),
          visible: true,
          isNum: false
        });
      }

      const parsedRows = dataRows.map(r => {
        const o: Record<string, any> = {};
        columns.forEach((col, c) => {
          const v = r[c] === undefined ? null : r[c];
          let parsedVal: any = v;
          if (!col.isId && typeof v === "string") {
            const s = v.trim();
            if (s !== "") {
              const cl = s.replace(/,/g, "");
              if (/^-?\d+(\.\d+)?$/.test(cl)) parsedVal = Number(cl);
            }
          }
          o[col.key] = parsedVal;
        });
        return o;
      });

      const ds: Dataset = {
        id: `ds${currentDatasetsCount}_${Math.random().toString(36).slice(2, 6)}`,
        fileId,
        platform: platformType,
        kind,
        fileName: file.name,
        sheetName: "Default",
        columns,
        rows: parsedRows,
        kvMode: false,
        search: "",
        sort: { key: null, dir: 1 },
        page: 0,
        pageSize: 50
      };

      return { uploadedFile: newUploadedFile, datasets: [ds] };
    }
  };

  const determineFileTypeFromHeadersAndName = (name: string, headers: string[]): "product" | "sales" | "income" => {
    const n = (name || "").toLowerCase();
    const h = headers.map(x => String(x).toLowerCase().trim());
    const hasProductKeywordInName = n.includes("product") || n.includes("inventory") || n.includes("stock") || n.includes("catalog");

    const orderHeaders = [
      "order id", "รหัสคำสั่งซื้อ", "หมายเลขคำสั่งซื้อ", "order_id", "order no", "order item id",
      "orderitemid", "order item no", "orderitemno", "seller sku", "lazada sku", "paid price", "unit price"
    ];
    const incomeHeaders = [
      "statement number", "fee name", "ชื่อรายการธุรกรรม", "จำนวนเงินทั้งหมดที่โอนแล้ว (฿)", 
      "วันที่โอนชำระเงินสำเร็จ", "ค่าธรรมเนียมโครงสร้างพื้นฐานแพลตฟอร์ม", "ประเภทธุรกรรม", "รายได้รวม", "รหัสรอบบิล"
    ];
    const productHeaders = ["แบรนด์", "หมวดหมู่", "ราคา", "สต็อก", "สินค้า"];

    const hasOrderHeaders = h.some(x => orderHeaders.some(oh => x === oh || x.includes(oh)));
    const hasIncomeHeaders = h.some(x => incomeHeaders.some(ih => x === ih || x.includes(ih)));
    const hasProductHeaders = h.some(x => productHeaders.some(ph => x === ph || x.includes(ph)));

    if (hasProductKeywordInName && !hasOrderHeaders && !hasIncomeHeaders) return "product";
    if (hasProductHeaders && !hasOrderHeaders && !hasIncomeHeaders) return "product";

    const hasOrderName = n.includes("order") || n.includes("orders") || n.includes("คำสั่งซื้อ") || n.includes("ordersku");
    const hasIncomeName = n.includes("income") || n.includes("โอนเงิน") || n.includes("โอนเง") || n.includes("รายรับ") || n.includes("รายได้") || n.includes("statement") || n.includes("payout");

    if (hasOrderName && !hasIncomeName) return "sales";
    if (hasIncomeName && !hasOrderName) return "income";

    if (hasIncomeHeaders && !hasOrderHeaders) return "income";
    if (hasOrderHeaders) return "sales";
    if (hasIncomeHeaders) return "income";
    return "sales";
  };

  const detectUploadedFileType = (file: File): Promise<"product" | "sales" | "income"> => {
    return new Promise((resolve) => {
      const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          let headers: string[] = [];
          if (isExcel) {
            // Only read top 25 rows for instant header detection without parsing whole file
            const workbook = XLSX.read(data, { type: "array", sheetRows: 25 });
            for (let idx = 0; idx < workbook.SheetNames.length; idx++) {
              const sheetName = workbook.SheetNames[idx];
              if (isSheetHidden(workbook, sheetName, idx)) continue;
              const worksheet = workbook.Sheets[sheetName];
              if (worksheet) {
                repairWorksheetRange(worksheet);
                const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
                const { idx: headerIdx } = detectHeaderRow(rawRows);
                if (headerIdx >= 0 && rawRows[headerIdx]) {
                  headers.push(...(rawRows[headerIdx] || []).map(x => String(x || "").trim()));
                }
              }
            }
          } else {
            const text = new TextDecoder().decode(data);
            const lines = text.split("\n");
            if (lines.length > 0) {
              headers = lines[0].split(",").map(x => x.replace(/"/g, "").trim());
            }
          }
          const fileType = determineFileTypeFromHeadersAndName(file.name, headers);
          resolve(fileType);
        } catch (err) {
          console.error("Error reading file headers for type detection:", err);
          resolve(determineFileTypeFromHeadersAndName(file.name, []));
        }
      };
      reader.onerror = () => {
        resolve(determineFileTypeFromHeadersAndName(file.name, []));
      };
      if (isExcel) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsArrayBuffer(file.slice(0, 1024 * 50));
      }
    });
  };

  const routeAndUploadFiles = async (
    inputFiles: FileList | File[] | File,
    forcedPlatform?: Dataset["platform"],
    forcedKind?: "order" | "income"
  ) => {
    const files: File[] = [];
    if (inputFiles instanceof File) {
      files.push(inputFiles);
    } else if (inputFiles) {
      for (let i = 0; i < inputFiles.length; i++) {
        files.push(inputFiles[i]);
      }
    }

    if (files.length === 0) return;

    const validFiles = files.filter(f => !f.name.startsWith("~$"));
    if (validFiles.length < files.length) {
      triggerAlert("ข้ามไฟล์ชั่วคราว (Temporary Files)", "warning");
    }

    if (validFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: validFiles.length, fileName: "กำลังเตรียมอ่านไฟล์..." });
    await new Promise(r => setTimeout(r, 10));

    try {
      const fileTypes: ("product" | "sales" | "income")[] = [];
      for (let i = 0; i < validFiles.length; i++) {
        setUploadProgress({ current: i + 1, total: validFiles.length, fileName: validFiles[i].name });
        await new Promise(r => setTimeout(r, 10));
        const type = await detectUploadedFileType(validFiles[i]);
        fileTypes.push(type);
      }

      const productFilesIndices: number[] = [];
      const nonProductFilesIndices: number[] = [];
      
      fileTypes.forEach((type, idx) => {
        if (type === "product") {
          productFilesIndices.push(idx);
        } else {
          nonProductFilesIndices.push(idx);
        }
      });

      const activeMode = currentMode;

      if (productFilesIndices.length > 0) {
        triggerAlert("พบไฟล์ข้อมูลสินค้า ระบบรองรับการนำเข้าไฟล์คำสั่งซื้อ (Orders) เท่านั้น", "error");
        return;
      }

      let hasMismatch = false;
      for (let i = 0; i < nonProductFilesIndices.length; i++) {
        const idx = nonProductFilesIndices[i];
        const file = validFiles[idx];
        const fType = fileTypes[idx];
        const detectedPlat = determinePlatform(file.name, []);
        const pForm = forcedPlatform || (detectedPlat !== "unknown" ? detectedPlat : detectPlatform(file.name));
        const isFbOrLine = pForm === "facebook" || pForm === "line" || uploadPlatform === "facebook" || uploadPlatform === "line";

        const fileNameLower = file.name.toLowerCase();
        const hasExplicitOrderName = fileNameLower.includes("order") || fileNameLower.includes("orders") || fileNameLower.includes("คำสั่งซื้อ");
        const hasExplicitIncomeName = fileNameLower.includes("income") || fileNameLower.includes("โอนเงิน") || fileNameLower.includes("รายรับ") || fileNameLower.includes("statement");
        const isGenericOrSummaryFile = !hasExplicitOrderName && !hasExplicitIncomeName;

        if (!isFbOrLine && !isGenericOrSummaryFile) {
          if (activeMode === "orders" && fType === "income" && hasExplicitIncomeName) {
            triggerAlert(`ไฟล์ "${file.name}" เป็นข้อมูลรายรับ (Income) ไม่สามารถนำเข้าในหน้าอัพโหลดคำสั่งซื้อได้`, "error");
            hasMismatch = true;
          }
          if (activeMode === "income" && fType === "sales" && hasExplicitOrderName) {
            triggerAlert(`ไฟล์ "${file.name}" เป็นรายการคำสั่งซื้อ (Orders) หน้านี้รอรับการอัปโหลดไฟล์ของ Income เท่านั้น`, "error");
            hasMismatch = true;
          }
        }
      }
      if (hasMismatch) return;

      if (nonProductFilesIndices.length > 0) {
        setImportType("orders");
        handleProductReset();

        // Sort files chronologically (Month 1 -> Month 12)
        const filesToProcess = nonProductFilesIndices
          .map(idx => validFiles[idx])
          .sort((a, b) => compareFileNamesChronologically(a.name, b.name));

        const resolvedKind = forcedKind || (
          activeMode === "income"
            ? "income"
            : (activeMode === "orders" ? "order" : undefined)
        );

        const processedResults: { uploadedFile: UploadedFileData; datasets: Dataset[] }[] = [];
        const errors: string[] = [];

        for (let i = 0; i < filesToProcess.length; i++) {
          const file = filesToProcess[i];
          const monthInfo = extractMonthFromFileName(file.name);
          const prefix = monthInfo ? `[${monthInfo.monthLabel}] ` : "";
          setUploadProgress({
            current: i + 1,
            total: filesToProcess.length,
            fileName: `${prefix}${file.name}`
          });
          await new Promise(r => setTimeout(r, 15)); // Yield to let browser render UI smoothly
          try {
            const res = await processSingleFile(file, forcedPlatform, resolvedKind, datasets.length + processedResults.length);
            processedResults.push(res);
          } catch (e) {
            console.error(e);
            errors.push(e instanceof Error ? e.message : `อ่านไฟล์ "${file.name}" ล้มเหลว`);
          }
        }

        if (errors.length > 0) {
          errors.forEach(err => triggerAlert(err, "error"));
        }

        if (processedResults.length > 0) {
          const newUploadedFiles = processedResults.map(r => r.uploadedFile);
          const newDatasets = processedResults.flatMap(r => r.datasets);

          setUploadedFiles(prev => {
            const existingIds = new Set(newUploadedFiles.map(f => f.id));
            const remaining = prev.filter(f => !existingIds.has(f.id));
            const merged = [...remaining, ...newUploadedFiles];
            return merged.sort((a, b) => compareFileNamesChronologically(a.fileName, b.fileName));
          });

          setDatasets(prev => {
            const newDatasetIds = new Set(newDatasets.map(d => d.id));
            const remaining = prev.filter(d => !newDatasetIds.has(d.id));
            const merged = [...remaining, ...newDatasets];
            return merged.sort((a, b) => compareFileNamesChronologically(a.fileName, b.fileName));
          });

          if (newDatasets.length > 0) {
            setActiveDatasetId(newDatasets[0].id);
          }

          if (processedResults.length >= 12) {
            triggerAlert(`นำเข้าไฟล์รายงานสำเร็จ ${processedResults.length} ไฟล์ (ครบถ้วนทุกช่วงเวลา/12 เดือน)`, "success");
          } else {
            triggerAlert(`เพิ่มไฟล์สำเร็จ ${processedResults.length} ไฟล์`, "success");
          }
        }
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const uploadRef = useRef<any>(null);
  const platformRef = useRef<any>(null);
  uploadRef.current = routeAndUploadFiles;
  platformRef.current = uploadPlatform;

  useEffect(() => {
    if (isModal && !isOpen) return;

    const handleGlobalDragOver = (e: DragEvent) => e.preventDefault();
    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.files?.length) {
        const forced = platformRef.current === "all" ? undefined : platformRef.current;
        uploadRef.current(e.dataTransfer.files, forced);
      }
    };
    window.addEventListener("dragover", handleGlobalDragOver);
    window.addEventListener("drop", handleGlobalDrop);
    return () => {
      window.removeEventListener("dragover", handleGlobalDragOver);
      window.removeEventListener("drop", handleGlobalDrop);
    };
  }, [isModal, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const forced = uploadPlatform === "all" ? undefined : uploadPlatform;
      routeAndUploadFiles(e.target.files, forced);
      e.target.value = "";
    }
  };

  const handleFileChangeWithKind = (e: React.ChangeEvent<HTMLInputElement>, forcedKind: "order" | "income") => {
    if (e.target.files && e.target.files.length > 0) {
      const forced = uploadPlatform === "all" ? undefined : uploadPlatform;
      routeAndUploadFiles(e.target.files, forced, forcedKind);
      e.target.value = "";
    }
  };


  const handleDragOrders = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActiveOrders(true);
    else if (e.type === "dragleave") setDragActiveOrders(false);
  };

  const handleDropOrders = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveOrders(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const forced = uploadPlatform === "all" ? undefined : uploadPlatform;
      routeAndUploadFiles(e.dataTransfer.files, forced, "order");
    }
  };

  const handleDragIncome = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActiveIncome(true);
    else if (e.type === "dragleave") setDragActiveIncome(false);
  };

  const handleDropIncome = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveIncome(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const forced = uploadPlatform === "all" ? undefined : uploadPlatform;
      routeAndUploadFiles(e.dataTransfer.files, forced, "income");
    }
  };

  const handleCardDrag = (e: React.DragEvent, platform: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setActiveCardDrag(platform);
    else if (e.type === "dragleave" || e.type === "drop") setActiveCardDrag(null);
  };

  const handleCardDrop = (e: React.DragEvent, platform: any) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveCardDrag(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      routeAndUploadFiles(e.dataTransfer.files, platform);
    }
  };

  const downloadProductTemplate = () => {
    const csvContent = "\uFEFF" + "ชื่อสินค้า,หมวดหมู่,แบรนด์,ราคา,สต็อก\nตัวอย่างสินค้า A,Electronics,ทั่วไป,299,50\nตัวอย่างสินค้า B,Apparel,L'angel,590,20\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "product_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    const n = String(name || "").toLowerCase();
    if (
      /แปรง|หวี|มีดโกน|เคราติน|สบู่|ครีม|เซรั่ม|แชมพู|บำรุง|ลิป|แต่งหน้า|น้ำหอม|ทำผม|ตัดผม|บาร์เบอร์|ไดร์|มาส์ก|โพเมด|พู่ปัด|กระปุกแป้ง|กรรไกร|ห่วงต่อผม|กิ๊ฟต่อผม|หัวหุ่น|วิก|ปัตตาเลี่ยน|pomade|keratin|comb|brush|hair|beauty|cosmetic|masque|salon|barber|shampoo|serum|scissor|clay/i.test(
        n,
      )
    ) {
      return "Beauty";
    }
    if (/เสื้อ|กางเกง|กระโปรง|เดรส|รองเท้า|ถุงเท้า|กระเป๋า|หมวก|แฟชั่น|cloth|shirt|pants|dress|shoes|bag|apparel/i.test(n)) {
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

  const processProductRows = (rows: unknown[][]) => {
    try {
      if (rows.length < 2) throw new Error("ไฟล์ไม่มีข้อมูลสินค้า");

      let headerRowIndex = 0;
      let maxScore = -1;
      
      for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row)) continue;
        const rowStrings = row.map(cell => String(cell || "").trim());
        const nonEmptyCount = rowStrings.filter(cell => cell !== "").length;
        
        let keywordMatches = 0;
        if (findColIndex(rowStrings, KEY_MAPS_PRODUCT.name) !== -1) keywordMatches++;
        if (findColIndex(rowStrings, KEY_MAPS_PRODUCT.price) !== -1) keywordMatches++;
        
        const score = (keywordMatches * 100) + nonEmptyCount;
        
        if (score > maxScore) {
          maxScore = score;
          headerRowIndex = i;
        }
      }

      const headers = rows[headerRowIndex].map(h => String(h || ""));
      let idxName = findColIndex(headers, KEY_MAPS_PRODUCT.name);
      const idxCat = findColIndex(headers, KEY_MAPS_PRODUCT.category);
      const idxBrand = findColIndex(headers, KEY_MAPS_PRODUCT.brand);
      let idxPrice = findColIndex(headers, KEY_MAPS_PRODUCT.price);
      let idxStock = findColIndex(headers, KEY_MAPS_PRODUCT.stock);

      const priceBlacklist = [
        "order", "คำสั่ง", "หมายเลข", "เลขที่", "tracking", "พัสดุ", "phone", "โทร",
        "date", "วันที่", "เวลา", "time", "statement", "รอบบิล", "ใบแจ้งยอด", "ระยะเวลา",
        "status", "สถานะ", "sku", "id", "code", "รหัส", "comment", "ความคิดเห็น", "บันทึก",
        "ส่วนลด", "discount", "voucher", "คูปอง", "เหรียญ", "coins", "ค่าจัดส่ง", "shipping",
        "ค่าบริการ", "ค่าธรรมเนียม", "fee", "vat", "ภาษี", "wht", "คืน", "return", "refund"
      ];

      if (idxName === -1) {
        idxName = headers.findIndex((h) => {
          const cl = h.trim().toLowerCase();
          return (
            cl.includes("สินค้า") ||
            cl.includes("product") ||
            cl.includes("item") ||
            cl.includes("sku") ||
            cl.includes("รายการ") ||
            cl.includes("รายละเอียด") ||
            cl.includes("name")
          );
        });
      }

      if (idxPrice === -1) {
        idxPrice = headers.findIndex((h) => {
          const cl = h.trim().toLowerCase();
          if (priceBlacklist.some(b => cl.includes(b))) return false;
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
          if (["id", "code", "รหัส", "เลข", "order", "item", "tracking", "พัสดุ", "phone", "โทร", "ราคา", "price"].some((b) => cl.includes(b))) return false;
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

      if (idxName === -1) {
        throw new Error("รูปแบบคอลัมน์ไม่ถูกต้อง กรุณาตรวจสอบว่ามีหัวคอลัมน์ ชื่อสินค้า และราคา");
      }

      const hasRealStockCol = idxStock !== -1;

      const rawProductsList: ParsedImportProduct[] = rows
        .slice(headerRowIndex + 1)
        .filter((row) => row.length >= 2 && row.some((c) => c !== undefined && c !== null && String(c).trim()))
        .map((row) => {
          const nameVal = row[idxName] ? String(row[idxName]).trim() : "";
          if (!nameVal || nameVal === "-" || nameVal === "รวม" || nameVal.toLowerCase() === "total") return null;

          const catRaw = idxCat !== -1 ? (row[idxCat] ? String(row[idxCat]).trim() : "") : "";
          const catMatched = inferProductCategory(nameVal, catRaw);

          let brandVal = idxBrand !== -1 ? (row[idxBrand] ? String(row[idxBrand]).trim() : "ทั่วไป") : "ทั่วไป";
          if (!brandVal || brandVal === "ทั่วไป" || brandVal === "ไม่ระบุแบรนด์") {
            const detected = detectBrand(row, nameVal);
            brandVal = detected !== "ทั่วไป" ? detected : "สินค้าอื่นๆที่ไม่มีแบรนด์";
          }

          let stockVal = 0;
          if (hasRealStockCol && row[idxStock] !== undefined && row[idxStock] !== null) {
            const str = String(row[idxStock] || "").trim();
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
            brand: brandVal,
            price: 0,
            stock: stockVal,
            warnings
          };
        })
        .filter((p): p is ParsedImportProduct => p !== null && p.name.trim().length > 0);

      // Deduplicate/merge items
      const productMap = new Map<string, ParsedImportProduct>();
      for (const prod of rawProductsList) {
        const key = `${prod.name.toLowerCase().trim()}___${prod.brand.toLowerCase().trim()}`;
        if (!productMap.has(key)) {
          productMap.set(key, { ...prod, price: 0 });
        } else {
          const existing = productMap.get(key)!;
          if (hasRealStockCol) {
            existing.stock = Math.min(existing.stock + prod.stock, 999999);
          }
          existing.price = 0;
          if (existing.warnings && !prod.warnings) {
            existing.warnings = null;
          }
        }
      }

      const productsList = Array.from(productMap.values());

      setParsedProducts(productsList);
      setErrorMsg(null);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setParsedProducts([]);
    }
  };

  const handleProductUploadFile = (file: File) => {
    const validation = validateUploadedFile(file);
    if (!validation.valid) {
      setErrorMsg(validation.error || "ไฟล์ไม่ผ่านการตรวจสอบความปลอดภัย");
      return;
    }

    setProductFileName(file.name);
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    const reader = new FileReader();

    if (isExcel) {
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          
          // Get the first visible sheet name
          let sheetName: string | null = null;
          for (let idx = 0; idx < workbook.SheetNames.length; idx++) {
            const sName = workbook.SheetNames[idx];
            if (!isSheetHidden(workbook, sName, idx)) {
              sheetName = sName;
              break;
            }
          }

          if (!sheetName) {
            setErrorMsg("ไม่มีชีตที่มีข้อมูลแบบเปิดเผย (Visible Sheet) ในไฟล์");
            setParsedProducts([]);
            return;
          }

          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) {
            setErrorMsg("ไม่สามารถอ่านข้อมูลจากชีตได้");
            setParsedProducts([]);
            return;
          }

          repairWorksheetRange(worksheet);
          const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: true, defval: null, blankrows: true });
          if (!rawRows.length) {
            processProductRows([]);
            return;
          }

          const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
          const startRow = range ? range.s.r : 0;
          const startCol = range ? range.s.c : 0;

          // Filter out hidden rows
          const visibleRows = rawRows.filter((_, rIdx) => {
            const actualRowIdx = startRow + rIdx;
            const rowProps = worksheet['!rows'] ? worksheet['!rows'][actualRowIdx] : null;
            return !(rowProps && (rowProps.hidden || rowProps.hpt === 0 || rowProps.hpx === 0));
          });

          // Filter out hidden columns
          const cols = worksheet['!cols'];
          const filteredRows = visibleRows.map(row => {
            if (!Array.isArray(row)) return row;
            return row.filter((_, c) => {
              const actualColIdx = startCol + c;
              const colProps = cols ? cols[actualColIdx] : null;
              return !(colProps && (colProps.hidden || colProps.wpx === 0 || colProps.width === 0));
            });
          });

          processProductRows(filteredRows);
        } catch (e) {
          setErrorMsg(e instanceof Error ? e.message : String(e));
          setParsedProducts([]);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const rows = parseCSV(text);
          processProductRows(rows);
        } catch (e) {
          setErrorMsg(e instanceof Error ? e.message : String(e));
          setParsedProducts([]);
        }
      };
      reader.readAsText(file, "UTF-8");
    }
  };

  const handleProductDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setProductDragActive(true);
    else if (e.type === "dragleave") setProductDragActive(false);
  };

  const handleProductDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setProductDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProductUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleProductFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProductUploadFile(e.target.files[0]);
    }
  };

  const productValidCount = useMemo(() => {
    return parsedProducts.filter((p) => !p.warnings).length;
  }, [parsedProducts]);

  const handleProductImportSubmit = () => {
    const validProducts = parsedProducts.filter((p) => !p.warnings);
    if (validProducts.length === 0) {
      triggerAlert("ไม่มีข้อมูลสินค้าที่ถูกต้องที่จะนำเข้า", "error");
      return;
    }
    if (onImportProducts) {
      onImportProducts(
        validProducts.map((p) => ({
          name: p.name,
          category: p.category,
          brand: p.brand,
          price: p.price,
          stock: p.stock,
        }))
      );
    }
    if (onImportProductFiles) {
      const productDataset: UploadedDataset = {
        id: generateUniqueId("ds_prod"),
        fileName: productFileName || "product_data.xlsx",
        platform: "unknown",
        type: "order",
        fileType: "product",
        sheets: [
          {
            name: "Products",
            headers: ["ชื่อสินค้า", "หมวดหมู่", "แบรนด์", "ราคา", "สต็อก"],
            rows: validProducts.map(p => ({
              "ชื่อสินค้า": p.name,
              "หมวดหมู่": p.category,
              "แบรนด์": p.brand || "",
              "ราคา": p.price,
              "สต็อก": p.stock
            }))
          }
        ],
        uploadedAt: getCurrentFormattedDate()
      };
      onImportProductFiles([productDataset]);
    }
    triggerAlert(`นำเข้าข้อมูลสินค้าคงคลังจำนวน ${validProducts.length} รายการเรียบร้อยแล้ว`, "success");
    handleProductReset();
    if (isModal && onClose) {
      onClose();
    }
  };

  const handleProductReset = () => {
    setProductFileName(null);
    setParsedProducts([]);
    setProductDragActive(false);
    setErrorMsg(null);
    setImportType("orders");
  };

  const activeDataset = useMemo(() => {
    return datasets.find((d) => d.id === activeDatasetId) || null;
  }, [datasets, activeDatasetId]);

  const filteredRows = useMemo(() => {
    if (!activeDataset) return [];
    let items = activeDataset.rows;
    if (activeDataset.search) {
      const q = activeDataset.search.toLowerCase();
      items = items.filter((row) => 
        Object.values(row).some((val) => String(val || "").toLowerCase().includes(q))
      );
    }
    return items;
  }, [activeDataset, activeDataset?.search]);

  const filteredAndSortedPreview = useMemo(() => {
    let list = [...previewData];

    // File Filter
    if (previewFileFilter !== "all") {
      list = list.filter(o => o.datasetId === previewFileFilter);
    }

    // Search
    if (previewSearch.trim()) {
      const q = previewSearch.toLowerCase();
      list = list.filter(o => 
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q) ||
        o.channel.toLowerCase().includes(q) ||
        (o.brand && o.brand.toLowerCase().includes(q))
      );
    }

    // Sort
    if (previewSort.key) {
      const { key, dir } = previewSort;
      list.sort((a, b) => {
        const valA = a[key];
        const valB = b[key];

        if (valA === undefined || valA === null) return 1 * dir;
        if (valB === undefined || valB === null) return -1 * dir;

        if (typeof valA === "number" && typeof valB === "number") {
          return (valA - valB) * dir;
        }

        return String(valA).localeCompare(String(valB)) * dir;
      });
    }

    return list;
  }, [previewData, previewSearch, previewSort, previewFileFilter]);

  const previewTotals = useMemo(() => {
    let grossSales = 0;
    let platformFee = 0;
    let shippingFee = 0;
    let netIncome = 0;
    let totalQty = 0;

    const targetList = previewFileFilter === "all" 
      ? previewData 
      : previewData.filter(o => o.datasetId === previewFileFilter);

    targetList.forEach((order) => {
      grossSales += order.total || 0;
      platformFee += order.platformFee || 0;
      shippingFee += order.shippingFee || 0;
      netIncome += order.netIncome || 0;
      totalQty += order.quantity || 0;
    });

    return {
      grossSales,
      platformFee,
      shippingFee,
      netIncome,
      totalQty,
    };
  }, [previewData, previewFileFilter]);

  const handleSort = (key: string) => {
    if (!activeDatasetId) return;
    setDatasets(prev => prev.map(d => {
      if (d.id !== activeDatasetId) return d;
      const dir = d.sort.key === key ? (d.sort.dir === 1 ? -1 : 1) : 1;
      return {
        ...d,
        sort: { key, dir },
        rows: [...d.rows].sort((a, b) => {
          const valA = a[key];
          const valB = b[key];

          if (valA === undefined || valA === null) return 1 * dir;
          if (valB === undefined || valB === null) return -1 * dir;

          if (typeof valA === "number" && typeof valB === "number") {
            return (valA - valB) * dir;
          }

          return String(valA).localeCompare(String(valB)) * dir;
        })
      };
    }));
  };

  const handlePageChange = (page: number) => {
    if (!activeDatasetId) return;
    setDatasets(prev => prev.map(d => {
      if (d.id !== activeDatasetId) return d;
      return { ...d, page };
    }));
  };

  const handleSearch = (q: string) => {
    if (!activeDatasetId) return;
    setDatasets(prev => prev.map(d => {
      if (d.id !== activeDatasetId) return d;
      return { ...d, search: q, page: 0 };
    }));
  };

  const toggleColumnVisibility = (key: string) => {
    if (!activeDatasetId) return;
    setDatasets(prev => prev.map(d => {
      if (d.id !== activeDatasetId) return d;
      return {
        ...d,
        columns: d.columns.map(c => c.key === key ? { ...c, visible: !c.visible } : c)
      };
    }));
  };

  const handleConfirmImport = handleAutoProcessAndSubmit;

  const _unusedRefs = [
    hasShopeeIncome,
    hasLazadaIncome,
    hasTiktokIncome,
    hasFacebookIncome,
    hasLineIncome,
    setPreviewPageSize,
    uploadedDatasets,
    onDeleteDataset,
    requestConfirm,
    onImportOrders
  ];
  void _unusedRefs;

  if (isModal && !isOpen) return null;

  const content = (
    <div className={`bg-white dark:bg-[#161616] ${isModal ? 'w-[92vw] sm:w-[90vw] md:max-w-5xl max-h-[85vh] rounded-[2rem] mobile-bottom-sheet-content my-auto' : 'rounded-2xl min-h-[80vh]'} border border-black/5 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col transition-colors duration-200`}>
      {isModal && (
        <div className="px-6 py-4 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-t-[2rem] shrink-0 border-b border-black/[0.03] dark:border-white/[0.03]">
          <h3 className="font-black text-neutral-800 dark:text-neutral-100 text-base">
            {currentMode === "orders"
              ? "นำเข้าข้อมูลคำสั่งซื้อ"
              : currentMode === "income"
                ? "นำเข้าข้อมูลรายการยอดขาย"
                : "นำเข้าข้อมูลคำสั่งซื้อและรายการยอดขาย"}
          </h3>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full border border-black/5 dark:border-white/5 bg-transparent hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm animate-scale-in"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      )}
        
        {/* Tab Selector */}
        {allowedTypes.length > 1 && (
          <div className="flex bg-neutral-100/80 dark:bg-neutral-900/80 p-1 rounded-2xl gap-1 border border-black/[0.03] dark:border-white/[0.03] max-w-lg mx-6 mt-4 shadow-inner backdrop-blur-sm">
            {allowedTypes.includes("orders") && (
              <button
                type="button"
                onClick={() => {
                  setImportType("orders");
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all duration-300 hover:scale-[1.01] cursor-pointer border-0 flex items-center justify-center gap-1.5 ${
                  importType === "orders"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 text-white shadow-lg shadow-blue-500/15"
                    : "bg-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-white/50 dark:hover:bg-neutral-850/50"
                }`}
              >
                <Coins className="h-3.5 w-3.5" />
                <span>รายการยอดขาย (Income & Orders)</span>
              </button>
            )}
            {allowedTypes.includes("products") && (
              <button
                type="button"
                onClick={() => {
                  setImportType("products");
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all duration-300 hover:scale-[1.01] cursor-pointer border-0 flex items-center justify-center gap-1.5 ${
                  importType === "products"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 text-white shadow-lg shadow-blue-500/15"
                    : "bg-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-white/50 dark:hover:bg-neutral-850/50"
                }`}
              >
                <Package className="h-3.5 w-3.5" />
                <span>ข้อมูลสินค้า (Product Catalog)</span>
              </button>
            )}
          </div>
        )}

        <div className="p-4 sm:p-6 flex-1 overflow-y-auto min-h-0 custom-scrollbar">
          {importType === "orders" ? (
            <div className="space-y-4 sm:space-y-5 animate-fade-in">
              {/* Stepper Indicator */}
              <div className="flex items-center justify-between max-w-xl mx-auto px-4 py-2 bg-neutral-50/50 dark:bg-neutral-900/30 rounded-2xl border border-black/[0.03] dark:border-white/[0.03] shadow-sm backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
                    currentStep === 1 
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/10 scale-110" 
                      : "bg-emerald-500 text-white shadow-md shadow-emerald-500/10"
                  }`}>
                    {currentStep > 1 ? "✓" : "1"}
                  </div>
                  <div>
                    <span className="text-[11px] font-black text-neutral-800 dark:text-neutral-200 block leading-tight">ขั้นตอนที่ 1</span>
                    <span className="text-[9px] text-neutral-500 dark:text-neutral-450 block">อัปโหลดและตรวจสอบไฟล์ ({uploadedFiles.length} ไฟล์)</span>
                  </div>
                </div>

                <div className="flex-1 h-0.5 mx-4 bg-neutral-200 dark:bg-neutral-800 relative overflow-hidden">
                  <div className={`absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500 ${
                    currentStep === 2 ? "w-full" : "w-0"
                  }`} />
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
                    currentStep === 2 
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/10 scale-110" 
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border border-neutral-200/50 dark:border-neutral-855"
                  }`}>
                    2
                  </div>
                  <div>
                    <span className="text-[11px] font-black text-neutral-800 dark:text-neutral-200 block leading-tight">ขั้นตอนที่ 2</span>
                    <span className="text-[9px] text-neutral-500 dark:text-neutral-450 block">วิเคราะห์ข้อมูลพรีวิวนำเข้า</span>
                  </div>
                </div>
              </div>

              {currentStep === 1 ? (
                // --- STEP 1: UPLOAD & VERIFY FILES ---
                <div className="space-y-6 animate-fade-in">
                  {uploadedFiles.length > 0 ? (
                    <>
                      {/* Multi-file Summary Banner & Controls */}
                      {(() => {
                        const totalRowsCount = uploadedFiles.reduce((acc, f) => acc + (f.rows?.length || 0), 0);
                        const uniqueMonths = new Set<string>();
                        uploadedFiles.forEach(f => {
                          const m = extractMonthFromFileName(f.fileName);
                          if (m) uniqueMonths.add(m.monthLabel);
                        });
                        const isFullYear = uniqueMonths.size >= 12 || uploadedFiles.length >= 12;

                        const filteredQueue = uploadedFiles.filter(f => {
                          if (!queueSearch.trim()) return true;
                          const q = queueSearch.toLowerCase();
                          const m = extractMonthFromFileName(f.fileName);
                          return f.fileName.toLowerCase().includes(q) || 
                            f.platform.toLowerCase().includes(q) || 
                            (m && m.monthLabel.toLowerCase().includes(q));
                        }).sort((a, b) => {
                          if (queueSort === "month") {
                            return compareFileNamesChronologically(a.fileName, b.fileName);
                          } else if (queueSort === "name") {
                            return a.fileName.localeCompare(b.fileName, undefined, { numeric: true });
                          } else if (queueSort === "rows") {
                            return (b.rows?.length || 0) - (a.rows?.length || 0);
                          } else if (queueSort === "platform") {
                            return a.platform.localeCompare(b.platform);
                          }
                          return 0;
                        });

                        return (
                          <div className="space-y-4">
                            {/* Queue Summary Header */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-500/[0.06] via-indigo-500/[0.04] to-purple-500/[0.03] dark:from-blue-500/10 dark:via-indigo-500/10 dark:to-purple-500/5 border border-blue-500/20 dark:border-blue-500/15 shadow-sm">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-sm font-black text-apple-primary flex items-center gap-1.5">
                                    <span>📁 รายการไฟล์ที่พร้อมนำเข้า ({uploadedFiles.length} ไฟล์)</span>
                                  </h3>
                                  {isFullYear && (
                                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1 animate-pulse">
                                      <span>✓</span> ครบ 12 เดือน/ทั้งปี ({uniqueMonths.size > 0 ? `${uniqueMonths.size} เดือน` : `${uploadedFiles.length} ไฟล์`})
                                    </span>
                                  )}
                                  {uniqueMonths.size > 0 && !isFullYear && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                      📅 {uniqueMonths.size} เดือน
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-apple-secondary">
                                  รวมทั้งหมด <span className="font-bold text-apple-primary font-mono">{totalRowsCount.toLocaleString()}</span> รายการข้อมูล พร้อมสำหรับการประมวลผลและนำเข้า
                                </p>
                              </div>

                              <div className="flex items-center gap-2 self-end md:self-center">
                                <button 
                                  type="button"
                                  onClick={handleReset}
                                  className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors cursor-pointer bg-transparent border-none p-1.5 flex items-center gap-1 hover:bg-rose-500/10 rounded-xl"
                                  title="ล้างไฟล์ทั้งหมดในคิว"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> ล้างทั้งหมด
                                </button>
                              </div>
                            </div>

                            {/* Queue Search & Sort Controls (shown when > 2 files) */}
                            {uploadedFiles.length >= 3 && (
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-1">
                                <div className="relative flex-1 sm:max-w-xs">
                                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-apple-secondary" />
                                  <input
                                    type="text"
                                    placeholder="ค้นหาชื่อไฟล์ หรือ เดือน..."
                                    value={queueSearch}
                                    onChange={(e) => setQueueSearch(e.target.value)}
                                    className="w-full bg-apple-secondary border border-apple-primary/10 rounded-xl py-1.5 pl-9 pr-3 text-xs text-apple-primary placeholder-apple-secondary focus:outline-none focus:border-blue-500 shadow-xs"
                                  />
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                  <span className="text-[10px] font-bold text-apple-secondary shrink-0">เรียงตาม:</span>
                                  <div className="relative">
                                    <select
                                      value={queueSort}
                                      onChange={(e) => setQueueSort(e.target.value as any)}
                                      className="bg-apple-secondary border border-apple-primary/10 rounded-xl py-1.5 pl-3 pr-7 text-xs text-apple-primary font-bold focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs appearance-none"
                                    >
                                      <option value="month">📅 ลำดับเดือน (ม.ค. - ธ.ค.)</option>
                                      <option value="name">🔤 ชื่อไฟล์ (A-Z)</option>
                                      <option value="rows">📊 จำนวนรายการ (มาก → น้อย)</option>
                                      <option value="platform">🏷️ แพลตฟอร์ม</option>
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-apple-secondary pointer-events-none" />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Files Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                              {filteredQueue.map((file) => {
                                const pf = PLATFORMS[file.platform] || PLATFORMS.unknown;
                                const monthInfo = extractMonthFromFileName(file.fileName);
                                return (
                                  <div 
                                    key={file.id || file.fileName} 
                                    className="group p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1f1f1f] shadow-xs hover:shadow-md hover:border-blue-500/30 dark:hover:border-blue-500/30 transition-all duration-300 relative overflow-hidden flex flex-col justify-between hover:-translate-y-0.5"
                                  >
                                    {/* Platform Accent Glow */}
                                    <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: pf.color }} />
                                    
                                    <div>
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {/* File Spreadsheet Icon Container */}
                                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs" style={{ backgroundColor: `${pf.color}15` }}>
                                            <FileSpreadsheet className="h-4 w-4" style={{ color: pf.color }} />
                                          </div>
                                          
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              {monthInfo && (
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                  📅 {monthInfo.monthLabel}
                                                </span>
                                              )}
                                              <span 
                                                className="text-[9px] font-black px-1.5 py-0.5 rounded-md border" 
                                                style={{ 
                                                  backgroundColor: `${pf.color}10`, 
                                                  color: pf.color,
                                                  borderColor: `${pf.color}25`
                                                }}
                                              >
                                                {pf.label}
                                              </span>
                                            </div>
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => handleDeleteFile(file.id || file.fileName)}
                                          className="text-neutral-400 hover:text-rose-500 p-1 hover:bg-rose-500/10 rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center border-none bg-transparent shrink-0 opacity-60 group-hover:opacity-100"
                                          title="ลบไฟล์นี้"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>

                                      <p className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200 truncate mt-2 font-mono" title={file.fileName}>
                                        {file.fileName}
                                      </p>
                                    </div>
                                    
                                    <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800/40 flex justify-between items-center text-[10px] text-neutral-500 dark:text-neutral-450 font-medium">
                                      <span className="flex items-center gap-1 truncate">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                        {detectKind(file.fileName, file.activeSheetName || "") === "income" ? "รายรับ" : "คำสั่งซื้อ"}
                                      </span>
                                      <span className="font-mono font-bold px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-md border border-black/[0.03] dark:border-white/[0.03] shrink-0">
                                        {file.rows.length.toLocaleString()} แถว
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {filteredQueue.length === 0 && (
                              <div className="p-8 text-center text-apple-secondary text-xs font-bold border border-dashed rounded-2xl">
                                ไม่พบไฟล์ที่ตรงกับคำค้นหา "{queueSearch}"
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Compact Dropzones to add more files */}
                      <div className={`grid ${mode === "all" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 max-w-md mx-auto"} gap-4 pt-2 w-full`}>
                        {(mode === "all" || mode === "orders") && (
                          <div
                            onDragEnter={handleDragOrders}
                            onDragOver={handleDragOrders}
                            onDragLeave={handleDragOrders}
                            onDrop={handleDropOrders}
                            onClick={() => document.getElementById("orders-file-input")?.click()}
                            className={`group rounded-2xl border-2 border-dashed transition-all duration-300 relative overflow-hidden flex flex-col items-center justify-center gap-2.5 w-full p-5 text-center cursor-pointer ${
                              dragActiveOrders
                                ? "border-blue-500 ring-2 ring-blue-500/10 bg-blue-500/[0.02]"
                                : "border-neutral-200 dark:border-neutral-855 hover:border-blue-500/50 dark:hover:border-blue-400/50 bg-neutral-50/30 hover:bg-blue-500/[0.01]"
                            }`}
                          >
                            <ShoppingBag className="h-4.5 w-4.5 text-neutral-450 dark:text-neutral-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200" />
                            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-855 dark:group-hover:text-neutral-100 transition-colors">
                              + เพิ่มไฟล์คำสั่งซื้อ (Orders) เพิ่มเติม
                            </span>
                          </div>
                        )}

                        {(currentMode === "all" || currentMode === "income") && (
                          <div
                            onDragEnter={handleDragIncome}
                            onDragOver={handleDragIncome}
                            onDragLeave={handleDragIncome}
                            onDrop={handleDropIncome}
                            onClick={() => document.getElementById("income-file-input")?.click()}
                            className={`group rounded-2xl border-2 border-dashed transition-all duration-300 relative overflow-hidden flex flex-col items-center justify-center gap-2.5 w-full p-5 text-center cursor-pointer ${
                              dragActiveIncome
                                ? "border-emerald-500 ring-2 ring-emerald-500/10 bg-emerald-500/[0.02]"
                                : "border-neutral-200 dark:border-neutral-855 hover:border-emerald-500/50 dark:hover:border-emerald-400/50 bg-neutral-50/30 hover:bg-emerald-500/[0.01]"
                            }`}
                          >
                            <Coins className="h-4.5 w-4.5 text-neutral-450 dark:text-neutral-500 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-all duration-200" />
                            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-855 dark:group-hover:text-neutral-100 transition-colors">
                              + เพิ่มไฟล์รายรับ (Income) เพิ่มเติม
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Initial Screen Dropzone */
                    <div className="flex-1 flex flex-col items-center justify-center py-2 space-y-4 sm:space-y-5">
                      {/* Platform Selector Tabs */}
                      <div className="flex bg-apple-tertiary/40 p-1.5 rounded-2xl gap-2 border border-apple-primary/5 max-w-2xl w-full shadow-inner overflow-x-auto">
                        {(["all", "lazada", "shopee", "tiktok", "facebook", "line"] as const).map((platform) => {
                          const isActive = uploadPlatform === platform;
                          let label = "";
                          let activeStyle = "";
                          let colorDot = null;
                          
                          if (platform === "all") {
                            label = "ตรวจหาอัตโนมัติ (Auto)";
                            activeStyle = isActive 
                              ? (isDarkMode 
                                  ? "bg-gradient-to-r from-blue-500/10 to-indigo-500/15 border-blue-500/30 text-blue-400 shadow-md shadow-blue-500/5" 
                                  : "bg-gradient-to-r from-blue-50 to-indigo-50/50 border-blue-500/20 text-blue-600 shadow-sm") 
                              : "";
                            colorDot = <span className={`w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 shrink-0 ${isActive ? "scale-110" : ""}`} />;
                          } else if (platform === "lazada") {
                            label = "Lazada";
                            activeStyle = isActive ? "bg-[#2E2BB8]/10 border-[#2E2BB8]/20 text-[#2E2BB8] shadow-sm" : "";
                            colorDot = <span className={`w-2 h-2 rounded-full bg-[#2E2BB8] shrink-0 ${isActive ? "scale-110" : ""}`} />;
                          } else if (platform === "shopee") {
                            label = "Shopee";
                            activeStyle = isActive ? "bg-[#EE4D2D]/10 border-[#EE4D2D]/20 text-[#EE4D2D] shadow-sm" : "";
                            colorDot = <span className={`w-2 h-2 rounded-full bg-[#EE4D2D] shrink-0 ${isActive ? "scale-110" : ""}`} />;
                          } else if (platform === "tiktok") {
                            label = "TikTok Shop";
                            activeStyle = isActive ? "bg-[#FE2C55]/10 border-[#FE2C55]/20 text-[#FE2C55] shadow-sm" : "";
                            colorDot = <span className={`w-2 h-2 rounded-full bg-[#FE2C55] shrink-0 ${isActive ? "scale-110" : ""}`} />;
                          } else if (platform === "facebook") {
                            label = "Facebook";
                            activeStyle = isActive ? "bg-[#1877F2]/10 border-[#1877F2]/20 text-[#1877F2] shadow-sm" : "";
                            colorDot = <span className={`w-2 h-2 rounded-full bg-[#1877F2] shrink-0 ${isActive ? "scale-110" : ""}`} />;
                          } else if (platform === "line") {
                            label = "LINE OA";
                            activeStyle = isActive ? "bg-[#06C755]/10 border-[#06C755]/20 text-[#06C755] shadow-sm" : "";
                            colorDot = <span className={`w-2 h-2 rounded-full bg-[#06C755] shrink-0 ${isActive ? "scale-110" : ""}`} />;
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

                      {/* Real-time Multi-file Upload Progress Indicator */}
                      {isUploading && uploadProgress && (
                        <div className="w-full max-w-4xl mx-auto p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex flex-col gap-2 shadow-sm animate-in fade-in duration-200">
                          <div className="flex items-center justify-between text-xs font-bold text-apple-primary">
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                              กำลังประมวลผลไฟล์ ({uploadProgress.current}/{uploadProgress.total}):{" "}
                              <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{uploadProgress.fileName}</span>
                            </span>
                            <span className="font-mono text-blue-600 dark:text-blue-400">
                              {uploadProgress.total > 0 ? Math.round((uploadProgress.current / uploadProgress.total) * 100) : 0}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 rounded-full"
                              style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className={`grid ${currentMode === "all" ? "grid-cols-1 md:grid-cols-2 max-w-4xl" : "grid-cols-1 max-w-xl"} gap-4 sm:gap-5 w-full mx-auto`}>
                        {/* Dropzone 1: Order Files (รายการคำสั่งซื้อ) */}
                        {(currentMode === "all" || currentMode === "orders") && (
                          <div
                            onDragEnter={handleDragOrders}
                            onDragOver={handleDragOrders}
                            onDragLeave={handleDragOrders}
                            onDrop={handleDropOrders}
                            onClick={() => document.getElementById("orders-file-input")?.click()}
                            className={`relative border-2 border-dashed rounded-3xl p-6 sm:p-7 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3.5 overflow-hidden ${
                              dragActiveOrders
                                ? UPLOAD_THEMES[uploadPlatform].activeBorder + " scale-[1.02]"
                                : UPLOAD_THEMES[uploadPlatform].normalBorder
                            }`}
                          >
                            <div className={`absolute inset-0 bg-gradient-to-b ${
                              uploadPlatform === "all" ? "from-blue-500/[0.03]" :
                              uploadPlatform === "lazada" ? "from-[#2E2BB8]/[0.03]" :
                              uploadPlatform === "shopee" ? "from-[#EE4D2D]/[0.03]" :
                              uploadPlatform === "tiktok" ? "from-[#FE2C55]/[0.03]" :
                              uploadPlatform === "facebook" ? "from-[#1877F2]/[0.03]" :
                              "from-[#06C755]/[0.03]"
                            } to-transparent pointer-events-none transition-colors duration-500`} />

                            <div className={`p-3 rounded-2xl transition-all duration-300 ${
                              dragActiveOrders ? "scale-110 rotate-3" : "hover:scale-105"
                            } ${UPLOAD_THEMES[uploadPlatform].iconBg}`}>
                              <ShoppingBag className={`h-6 w-6 transition-all duration-300 ${dragActiveOrders ? "animate-bounce" : ""}`} />
                            </div>

                            <div className="space-y-1 flex flex-col items-center">
                              <h3 className="text-sm font-black text-apple-primary uppercase tracking-wider">
                                รายการคำสั่งซื้อ (ORDERS)
                              </h3>
                              <p className="text-[10px] text-apple-secondary leading-relaxed max-w-xs mx-auto text-center">
                                ลากวางหรือเลือกไฟล์คำสั่งซื้อพร้อมกันหลายไฟล์ 12+ ไฟล์ (เช่น รายงานสรุป 12 เดือน ม.ค. - ธ.ค.) ของ {uploadPlatform === "all" ? "ทุกแพลตฟอร์ม" : PLATFORMS[uploadPlatform].label} (.csv, .xlsx)
                              </p>
                            </div>

                            <div className="flex flex-col items-center gap-2 mt-0.5">
                              <button
                                type="button"
                                className={`px-5 py-2 rounded-xl text-xs font-black shadow-md pointer-events-none transition-all duration-300 ${UPLOAD_THEMES[uploadPlatform].buttonClass}`}
                              >
                                เลือกไฟล์คำสั่งซื้อ (รองรับหลายไฟล์พร้อมกัน)
                              </button>
                              
                              <div className="flex gap-1 justify-center">
                                {['.CSV', '.XLSX', '.XLS'].map(ext => (
                                  <span key={ext} className="text-[8px] px-1.5 py-0.5 rounded font-mono font-bold bg-apple-tertiary text-apple-secondary border border-apple-primary/10">
                                    {ext}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Dropzone 2: Income Files (รายการยอดขาย) */}
                        {(currentMode === "all" || currentMode === "income") && (
                          <div
                            onDragEnter={handleDragIncome}
                            onDragOver={handleDragIncome}
                            onDragLeave={handleDragIncome}
                            onDrop={handleDropIncome}
                            onClick={() => document.getElementById("income-file-input")?.click()}
                            className={`relative border-2 border-dashed rounded-3xl p-6 sm:p-7 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3.5 overflow-hidden ${
                              dragActiveIncome
                                ? "border-emerald-500 ring-4 ring-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.25)] scale-[1.02]"
                                : "border-emerald-500/15 hover:border-emerald-500/40 bg-apple-secondary hover:shadow-[0_8px_30px_rgba(16,185,129,0.05)]"
                            }`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.03] to-transparent pointer-events-none transition-colors duration-500" />

                            <div className={`p-3 rounded-2xl transition-all duration-300 ${
                              dragActiveIncome ? "scale-110 rotate-3" : "hover:scale-105"
                            } bg-gradient-to-br from-emerald-500/15 to-teal-500/15 text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/10`}>
                              <Coins className={`h-6 w-6 transition-all duration-300 ${dragActiveIncome ? "animate-bounce" : ""}`} />
                            </div>

                            <div className="space-y-1 flex flex-col items-center">
                              <h3 className="text-sm font-black text-apple-primary uppercase tracking-wider">
                                {currentMode === "income" ? "รอรับการอัปโหลดไฟล์ของ INCOME เท่านั้น" : "รายการยอดขาย (INCOME)"}
                              </h3>
                              <p className="text-[10px] text-apple-secondary leading-relaxed max-w-xs mx-auto text-center">
                                {currentMode === "income" 
                                  ? `ลากวางหรือเลือกไฟล์รายรับพร้อมกันหลายไฟล์ 12+ ไฟล์ (เช่น รายงานสรุป 12 เดือน) ของ ${uploadPlatform === "all" ? "ทุกแพลตฟอร์ม" : PLATFORMS[uploadPlatform].label} (.csv, .xlsx)` 
                                  : `ลากวางหรือเลือกไฟล์รายงานยอดขาย/รายรับพร้อมกันหลายไฟล์ 12+ ไฟล์ (เช่น รายงานสรุป 12 เดือน) ของ ${uploadPlatform === "all" ? "ทุกแพลตฟอร์ม" : PLATFORMS[uploadPlatform].label} (.csv, .xlsx)`}
                              </p>
                            </div>

                            <div className="flex flex-col items-center gap-2 mt-0.5">
                              <button
                                type="button"
                                className="px-5 py-2 rounded-xl text-xs font-black shadow-md pointer-events-none transition-all duration-300 bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10 hover:shadow-emerald-500/20"
                              >
                                {currentMode === "income" ? "เลือกไฟล์รายรับ (รองรับหลายไฟล์พร้อมกัน)" : "เลือกรายการยอดขาย (รองรับหลายไฟล์พร้อมกัน)"}
                              </button>
                              
                              <div className="flex gap-1 justify-center">
                                {['.CSV', '.XLSX', '.XLS'].map(ext => (
                                  <span key={ext} className="text-[8px] px-1.5 py-0.5 rounded font-mono font-bold bg-apple-tertiary text-apple-secondary border border-apple-primary/10">
                                    {ext}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Platforms status grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 w-full max-w-5xl pt-2">
                        {/* Lazada Card */}
                        <div 
                          onClick={() => setUploadPlatform("lazada")}
                          onDragEnter={(e) => handleCardDrag(e, "lazada")}
                          onDragOver={(e) => handleCardDrag(e, "lazada")}
                          onDragLeave={(e) => handleCardDrag(e, "lazada")}
                          onDrop={(e) => handleCardDrop(e, "lazada")}
                          className={`p-3 rounded-2xl border text-left cursor-pointer transition-all duration-300 select-none relative overflow-hidden flex flex-col justify-between min-h-[96px] ${
                            uploadPlatform === "lazada"
                              ? "border-[#2E2BB8] ring-2 ring-[#2E2BB8]/20 bg-[#2E2BB8]/[0.02] shadow-md shadow-[#2E2BB8]/5 scale-[1.01]"
                              : activeCardDrag === "lazada"
                                ? "border-[#2E2BB8] bg-[#2E2BB8]/10 scale-[1.03]"
                                : isDarkMode 
                                  ? "bg-white/3 border-white/5 hover:border-white/20 hover:bg-white/5 hover:-translate-y-0.5" 
                                  : "bg-apple-tertiary/40 border-black/5 hover:border-black/20 hover:bg-apple-tertiary/60 hover:-translate-y-0.5"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#2E2BB8] shadow-sm shadow-[#2E2BB8]/30" />
                                <span className="text-xs font-black text-apple-primary">Lazada</span>
                              </div>
                              {uploadPlatform === "lazada" && (
                                <span className="text-[9px] font-black text-[#2E2BB8] bg-[#2E2BB8]/10 px-1.5 py-0.5 rounded-md border border-[#2E2BB8]/10">
                                  กำลังเลือก
                                </span>
                              )}
                              {activeCardDrag === "lazada" && (
                                <span className="text-[9px] font-black text-white bg-[#2E2BB8] px-1.5 py-0.5 rounded-md animate-pulse">
                                  วางไฟล์ที่นี่
                                </span>
                              )}
                            </div>
                            
                            <div className="space-y-1 mt-1.5">
                              {(currentMode === "all" || currentMode === "income") && (
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-apple-secondary">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasLazadaIncome ? "bg-emerald-500 animate-pulse" : "bg-neutral-300 dark:bg-neutral-600"}`} />
                                  <span className={hasLazadaIncome ? "text-emerald-600 dark:text-emerald-455 font-bold" : ""}>
                                    รายการยอดขาย (Lazada_income) {hasLazadaIncome && "✓"}
                                  </span>
                                </div>
                              )}
                              {(currentMode === "all" || currentMode === "orders") && (
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-apple-secondary">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasLazadaOrder ? "bg-emerald-500 animate-pulse" : "bg-neutral-300 dark:bg-neutral-600"}`} />
                                  <span className={hasLazadaOrder ? "text-emerald-600 dark:text-emerald-455 font-bold" : ""}>
                                    รายการคำสั่งซื้อ (Lazada_order) {hasLazadaOrder && "✓"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Shopee Card */}
                        <div 
                          onClick={() => setUploadPlatform("shopee")}
                          onDragEnter={(e) => handleCardDrag(e, "shopee")}
                          onDragOver={(e) => handleCardDrag(e, "shopee")}
                          onDragLeave={(e) => handleCardDrag(e, "shopee")}
                          onDrop={(e) => handleCardDrop(e, "shopee")}
                          className={`p-3 rounded-2xl border text-left cursor-pointer transition-all duration-300 select-none relative overflow-hidden flex flex-col justify-between min-h-[96px] ${
                            uploadPlatform === "shopee"
                              ? "border-[#EE4D2D] ring-2 ring-[#EE4D2D]/20 bg-[#EE4D2D]/[0.02] shadow-md shadow-[#EE4D2D]/5 scale-[1.01]"
                              : activeCardDrag === "shopee"
                                ? "border-[#EE4D2D] bg-[#EE4D2D]/10 scale-[1.03]"
                                : isDarkMode 
                                  ? "bg-white/3 border-white/5 hover:border-white/20 hover:bg-white/5 hover:-translate-y-0.5" 
                                  : "bg-apple-tertiary/40 border-black/5 hover:border-black/20 hover:bg-apple-tertiary/60 hover:-translate-y-0.5"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#EE4D2D] shadow-sm shadow-[#EE4D2D]/30" />
                                <span className="text-xs font-black text-apple-primary">Shopee</span>
                              </div>
                              {uploadPlatform === "shopee" && (
                                <span className="text-[9px] font-black text-[#EE4D2D] bg-[#EE4D2D]/10 px-1.5 py-0.5 rounded-md border border-[#EE4D2D]/10">
                                  กำลังเลือก
                                </span>
                              )}
                              {activeCardDrag === "shopee" && (
                                <span className="text-[9px] font-black text-white bg-[#EE4D2D] px-1.5 py-0.5 rounded-md animate-pulse">
                                  วางไฟล์ที่นี่
                                </span>
                              )}
                            </div>

                            <div className="space-y-1 mt-1.5">
                              {(currentMode === "all" || currentMode === "income") && (
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-apple-secondary">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasShopeeIncome ? "bg-emerald-500 animate-pulse" : "bg-neutral-300 dark:bg-neutral-600"}`} />
                                  <span className={hasShopeeIncome ? "text-emerald-600 dark:text-emerald-455 font-bold" : ""}>
                                    รายการยอดขาย (Shopee_Income) {hasShopeeIncome && "✓"}
                                  </span>
                                </div>
                              )}
                              {(currentMode === "all" || currentMode === "orders") && (
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-apple-secondary">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasShopeeOrder ? "bg-emerald-500 animate-pulse" : "bg-neutral-300 dark:bg-neutral-600"}`} />
                                  <span className={hasShopeeOrder ? "text-emerald-600 dark:text-emerald-455 font-bold" : ""}>
                                    รายการคำสั่งซื้อ (Shopee_Order) {hasShopeeOrder && "✓"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* TikTok Shop Card */}
                        <div 
                          onClick={() => setUploadPlatform("tiktok")}
                          onDragEnter={(e) => handleCardDrag(e, "tiktok")}
                          onDragOver={(e) => handleCardDrag(e, "tiktok")}
                          onDragLeave={(e) => handleCardDrag(e, "tiktok")}
                          onDrop={(e) => handleCardDrop(e, "tiktok")}
                          className={`p-3 rounded-2xl border text-left cursor-pointer transition-all duration-300 select-none relative overflow-hidden flex flex-col justify-between min-h-[96px] ${
                            uploadPlatform === "tiktok"
                              ? "border-[#FE2C55] ring-2 ring-[#FE2C55]/20 bg-[#FE2C55]/[0.02] shadow-md shadow-[#FE2C55]/5 scale-[1.01]"
                              : activeCardDrag === "tiktok"
                                ? "border-[#FE2C55] bg-[#FE2C55]/10 scale-[1.03]"
                                : isDarkMode 
                                  ? "bg-white/3 border-white/5 hover:border-white/20 hover:bg-white/5 hover:-translate-y-0.5" 
                                  : "bg-apple-tertiary/40 border-black/5 hover:border-black/20 hover:bg-apple-tertiary/60 hover:-translate-y-0.5"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#FE2C55] shadow-sm shadow-[#FE2C55]/30" />
                                <span className="text-xs font-black text-apple-primary">TikTok Shop</span>
                              </div>
                              {uploadPlatform === "tiktok" && (
                                <span className="text-[9px] font-black text-[#FE2C55] bg-[#FE2C55]/10 px-1.5 py-0.5 rounded-md border border-[#FE2C55]/10">
                                  กำลังเลือก
                                </span>
                              )}
                              {activeCardDrag === "tiktok" && (
                                <span className="text-[9px] font-black text-white bg-[#FE2C55] px-1.5 py-0.5 rounded-md animate-pulse">
                                  วางไฟล์ที่นี่
                                </span>
                              )}
                            </div>

                            <div className="space-y-1 mt-1.5">
                              {(currentMode === "all" || currentMode === "income") && (
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-apple-secondary">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasTiktokIncome ? "bg-emerald-500 animate-pulse" : "bg-neutral-300 dark:bg-neutral-600"}`} />
                                  <span className={hasTiktokIncome ? "text-emerald-600 dark:text-emerald-455 font-bold" : ""}>
                                    รายการยอดขาย (Tiktok_income) {hasTiktokIncome && "✓"}
                                  </span>
                                </div>
                              )}
                              {(currentMode === "all" || currentMode === "orders") && (
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-apple-secondary">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasTiktokOrder ? "bg-emerald-500 animate-pulse" : "bg-neutral-300 dark:bg-neutral-600"}`} />
                                  <span className={hasTiktokOrder ? "text-emerald-600 dark:text-emerald-455 font-bold" : ""}>
                                    รายการคำสั่งซื้อ (Tiktok_Order) {hasTiktokOrder && "✓"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Facebook Card */}
                        <div 
                          onClick={() => setUploadPlatform("facebook")}
                          onDragEnter={(e) => handleCardDrag(e, "facebook")}
                          onDragOver={(e) => handleCardDrag(e, "facebook")}
                          onDragLeave={(e) => handleCardDrag(e, "facebook")}
                          onDrop={(e) => handleCardDrop(e, "facebook")}
                          className={`p-3 rounded-2xl border text-left cursor-pointer transition-all duration-300 select-none relative overflow-hidden flex flex-col justify-between min-h-[96px] ${
                            uploadPlatform === "facebook"
                              ? "border-[#1877F2] ring-2 ring-[#1877F2]/20 bg-[#1877F2]/[0.02] shadow-md shadow-[#1877F2]/5 scale-[1.01]"
                              : activeCardDrag === "facebook"
                                ? "border-[#1877F2] bg-[#1877F2]/10 scale-[1.03]"
                                : isDarkMode 
                                  ? "bg-white/3 border-white/5 hover:border-white/20 hover:bg-white/5 hover:-translate-y-0.5" 
                                  : "bg-apple-tertiary/40 border-black/5 hover:border-black/20 hover:bg-apple-tertiary/60 hover:-translate-y-0.5"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#1877F2] shadow-sm shadow-[#1877F2]/30" />
                                <span className="text-xs font-black text-apple-primary">Facebook</span>
                              </div>
                              {uploadPlatform === "facebook" && (
                                <span className="text-[9px] font-black text-[#1877F2] bg-[#1877F2]/10 px-1.5 py-0.5 rounded-md border border-[#1877F2]/10">
                                  กำลังเลือก
                                </span>
                              )}
                              {activeCardDrag === "facebook" && (
                                <span className="text-[9px] font-black text-white bg-[#1877F2] px-1.5 py-0.5 rounded-md animate-pulse">
                                  วางไฟล์ที่นี่
                                </span>
                              )}
                            </div>

                            <div className="space-y-1 mt-1.5">
                              {(currentMode === "all" || currentMode === "income") && (
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-apple-secondary">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasFacebookIncome ? "bg-emerald-500 animate-pulse" : "bg-neutral-300 dark:bg-neutral-600"}`} />
                                  <span className={hasFacebookIncome ? "text-emerald-600 dark:text-emerald-455 font-bold" : ""}>
                                    รายการยอดขาย (Facebook) {hasFacebookIncome && "✓"}
                                  </span>
                                </div>
                              )}
                              {(currentMode === "all" || currentMode === "orders") && (
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-apple-secondary">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasFacebookOrder ? "bg-emerald-500 animate-pulse" : "bg-neutral-300 dark:bg-neutral-600"}`} />
                                  <span className={hasFacebookOrder ? "text-emerald-600 dark:text-emerald-455 font-bold" : ""}>
                                    รายการคำสั่งซื้อ (Facebook) {hasFacebookOrder && "✓"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* LINE OA Card */}
                        <div 
                          onClick={() => setUploadPlatform("line")}
                          onDragEnter={(e) => handleCardDrag(e, "line")}
                          onDragOver={(e) => handleCardDrag(e, "line")}
                          onDragLeave={(e) => handleCardDrag(e, "line")}
                          onDrop={(e) => handleCardDrop(e, "line")}
                          className={`p-3 rounded-2xl border text-left cursor-pointer transition-all duration-300 select-none relative overflow-hidden flex flex-col justify-between min-h-[96px] ${
                            uploadPlatform === "line"
                              ? "border-[#06C755] ring-2 ring-[#06C755]/20 bg-[#06C755]/[0.02] shadow-md shadow-[#06C755]/5 scale-[1.01]"
                              : activeCardDrag === "line"
                                ? "border-[#06C755] bg-[#06C755]/10 scale-[1.03]"
                                : isDarkMode 
                                  ? "bg-white/3 border-white/5 hover:border-white/20 hover:bg-white/5 hover:-translate-y-0.5" 
                                  : "bg-apple-tertiary/40 border-black/5 hover:border-black/20 hover:bg-apple-tertiary/60 hover:-translate-y-0.5"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#06C755] shadow-sm shadow-[#06C755]/30" />
                                <span className="text-xs font-black text-apple-primary">LINE OA</span>
                              </div>
                              {uploadPlatform === "line" && (
                                <span className="text-[9px] font-black text-[#06C755] bg-[#06C755]/10 px-1.5 py-0.5 rounded-md border border-[#06C755]/10">
                                  กำลังเลือก
                                </span>
                              )}
                              {activeCardDrag === "line" && (
                                <span className="text-[9px] font-black text-white bg-[#06C755] px-1.5 py-0.5 rounded-md animate-pulse">
                                  วางไฟล์ที่นี่
                                </span>
                              )}
                            </div>

                            <div className="space-y-1.5 mt-2">
                              {(currentMode === "all" || currentMode === "income") && (
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-apple-secondary">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasLineIncome ? "bg-emerald-500 animate-pulse" : "bg-neutral-300 dark:bg-neutral-600"}`} />
                                  <span className={hasLineIncome ? "text-emerald-600 dark:text-emerald-455 font-bold" : ""}>
                                    รายการยอดขาย (LINE OA) {hasLineIncome && "✓"}
                                  </span>
                                </div>
                              )}
                              {(currentMode === "all" || currentMode === "orders") && (
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-apple-secondary">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasLineOrder ? "bg-emerald-500 animate-pulse" : "bg-neutral-300 dark:bg-neutral-600"}`} />
                                  <span className={hasLineOrder ? "text-emerald-600 dark:text-emerald-455 font-bold" : ""}>
                                    รายการคำสั่งซื้อ (LINE OA) {hasLineOrder && "✓"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hidden Input elements for uploading files */}
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                    multiple
                  />
                  <input
                    id="orders-file-input"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => handleFileChangeWithKind(e, "order")}
                    multiple
                  />
                  <input
                    id="income-file-input"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => handleFileChangeWithKind(e, "income")}
                    multiple
                  />

                  {/* Step 1 Footer: Next navigation */}
                  {uploadedFiles.length > 0 && (
                    <div className="flex justify-end pt-4 border-t border-apple-primary/10">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="px-6 py-3 rounded-xl text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-600/15 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 min-h-[44px] transition-all hover:scale-[1.01] border-none"
                      >
                        ถัดไป: ตรวจสอบและพรีวิวข้อมูล <ArrowRight className="h-4 w-4 shrink-0" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                // --- STEP 2: PREVIEW & CONFIRM IMPORT ---
                <div className="space-y-6 animate-fade-in">
                  {/* File Badges Summary */}
                  <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-neutral-50/40 dark:bg-neutral-900/20 rounded-2xl border border-black/[0.02] dark:border-white/[0.02]">
                    <span className="text-[10px] font-black text-neutral-450 dark:text-neutral-500 uppercase tracking-wider">
                      ไฟล์ที่อัปโหลด ({uploadedFiles.length} ไฟล์):
                    </span>
                    {[...uploadedFiles].sort((a, b) => compareFileNamesChronologically(a.fileName, b.fileName)).map((file) => {
                      const pf = PLATFORMS[file.platform] || PLATFORMS.unknown;
                      const monthInfo = extractMonthFromFileName(file.fileName);
                      return (
                        <span 
                          key={file.id || file.fileName}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1.5"
                          style={{ 
                            backgroundColor: `${pf.color}08`, 
                            color: pf.color,
                            borderColor: `${pf.color}18`
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pf.color }} />
                          {monthInfo && <span className="font-extrabold text-[9px] underline">[{monthInfo.monthLabel}]</span>}
                          <span>{file.fileName}</span>
                        </span>
                      );
                    })}
                  </div>

                  {datasets.length > 0 ? (
                    <div className="space-y-4">
                      
                      {/* Amber Warning Summary Alert */}
                      <div className="bg-gradient-to-r from-amber-500/[0.06] to-amber-600/[0.03] dark:from-amber-500/[0.04] dark:to-amber-600/[0.02] border border-amber-500/20 dark:border-amber-500/15 rounded-2xl p-4 flex items-start gap-3 mt-2 shadow-sm">
                        <div className="p-1.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                          <AlertTriangle className="h-4.5 w-4.5 animate-pulse" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-amber-700 dark:text-amber-400">
                            พบข้อมูลทั้งหมด {previewData.length} รายการ กรุณาตรวจสอบความถูกต้องก่อนยืนยัน
                          </p>
                          <p className="text-[10px] text-amber-650 dark:text-amber-500/80 mt-1 leading-relaxed">
                            ข้อมูลนี้ถูกแสดงผลในโหมดพรีวิว (Local State) เท่านั้น จะยังไม่มีการบันทึกลงฐานข้อมูลหลัก (localStorage) หรืออัปเดตระบบจนกว่าคุณจะกดยืนยันปุ่มด้านล่าง
                          </p>
                        </div>
                      </div>

                      {/* Step 2 KPIs Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        {/* Gross Sales */}
                        <div className="bg-neutral-50 dark:bg-neutral-900/30 border border-black/[0.04] dark:border-white/[0.04] rounded-2xl p-4 flex flex-col justify-between">
                          <span className="text-[10px] text-neutral-450 dark:text-neutral-500 font-extrabold uppercase tracking-wider">ยอดขายรวมพรีวิว (Gross Sales)</span>
                          <div className="flex items-baseline gap-1 mt-1.5">
                            <span className="text-sm text-blue-500 font-extrabold">฿</span>
                            <span className="text-xl font-black font-condensed tracking-tight text-neutral-800 dark:text-neutral-100">
                              {previewTotals.grossSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Platform Fees */}
                        <div className="bg-neutral-50 dark:bg-neutral-900/30 border border-black/[0.04] dark:border-white/[0.04] rounded-2xl p-4 flex flex-col justify-between">
                          <span className="text-[10px] text-neutral-455 dark:text-neutral-500 font-extrabold uppercase tracking-wider">ค่าธรรมเนียมรวมพรีวิว</span>
                          <div className="flex items-baseline gap-1 mt-1.5">
                            <span className="text-sm text-rose-500 font-extrabold">฿</span>
                            <span className="text-xl font-black font-condensed tracking-tight text-rose-600 dark:text-rose-455">
                              {previewTotals.platformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Shipping Fees */}
                        <div className="bg-neutral-50 dark:bg-neutral-900/30 border border-black/[0.04] dark:border-white/[0.04] rounded-2xl p-4 flex flex-col justify-between">
                          <span className="text-[10px] text-neutral-455 dark:text-neutral-500 font-extrabold uppercase tracking-wider">ค่าจัดส่งรวมพรีวิว</span>
                          <div className="flex items-baseline gap-1 mt-1.5">
                            <span className="text-sm text-amber-500 font-extrabold">฿</span>
                            <span className="text-xl font-black font-condensed tracking-tight text-amber-650 dark:text-amber-500">
                              {previewTotals.shippingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Net Income */}
                        <div className="bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-between">
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-555 font-extrabold uppercase tracking-wider">รายรับสุทธิรวมพรีวิว (Net Income)</span>
                          <div className="flex items-baseline gap-1 mt-1.5">
                            <span className="text-sm text-emerald-500 font-extrabold">฿</span>
                            <span className="text-xl font-black font-condensed tracking-tight text-emerald-600 dark:text-emerald-455">
                              {previewTotals.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* View Mode Toggle Header */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-apple-primary/10 pb-3">
                        <div>
                          <h4 className="text-xs font-black text-apple-primary uppercase tracking-wider">ตรวจสอบและยืนยันข้อมูล</h4>
                          <p className="text-[10px] text-apple-secondary mt-0.5">วิเคราะห์โครงสร้างออเดอร์ของระบบล่วงหน้าก่อนยืนยันนำเข้า</p>
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
                            คำสั่งซื้อพร้อมนำเข้า ({previewData.length})
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
                            โครงสร้างไฟล์ดิบ ({datasets.length} ชีต)
                          </button>
                        </div>
                      </div>

                      {previewViewMode === "parsed" ? (
                        <div className="border border-apple-primary/10 rounded-2xl overflow-hidden bg-apple-secondary flex flex-col flex-1">
                          <div className="p-4 border-b border-apple-primary/10 flex flex-col sm:flex-row gap-3 justify-between items-center bg-apple-tertiary/20">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                              <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-apple-secondary" />
                                <input
                                  type="text"
                                  placeholder="ค้นหาคำสั่งซื้อ (ID, ชื่อลูกค้า, สินค้า...)"
                                  value={previewSearch}
                                  onChange={(e) => {
                                    setPreviewSearch(e.target.value);
                                    setPreviewPage(0);
                                  }}
                                  className="w-full bg-apple-secondary border border-apple-primary/10 rounded-xl py-1.5 pl-9 pr-4 text-xs text-apple-primary placeholder-apple-secondary focus:outline-none focus:border-apple-primary/30"
                                />
                              </div>

                              {/* File Filter Dropdown */}
                              <div className="relative shrink-0">
                                <select
                                  value={previewFileFilter}
                                  onChange={(e) => {
                                    setPreviewFileFilter(e.target.value);
                                    setPreviewPage(0);
                                  }}
                                  className="bg-apple-secondary border border-apple-primary/10 rounded-xl py-1.5 pl-3 pr-8 text-xs text-apple-primary font-bold focus:outline-none focus:border-apple-primary/30 cursor-pointer shadow-sm min-h-[34px] appearance-none"
                                >
                                  <option value="all">📁 ทุกไฟล์ที่อัปโหลด ({previewData.length.toLocaleString()} รายการ)</option>
                                  {[...uploadedFiles].sort((a, b) => compareFileNamesChronologically(a.fileName, b.fileName)).map((file) => {
                                    const count = previewData.filter(o => o.datasetId === file.id).length;
                                    const platformEmoji = file.platform === "lazada" ? "🔵" : file.platform === "shopee" ? "🟠" : file.platform === "tiktok" ? "🔴" : file.platform === "facebook" ? "🔷" : file.platform === "line" ? "🟢" : "📄";
                                    const monthInfo = extractMonthFromFileName(file.fileName);
                                    const monthPrefix = monthInfo ? `[${monthInfo.monthLabel}] ` : "";
                                    return (
                                      <option key={file.id || file.fileName} value={file.id}>
                                        {platformEmoji} {monthPrefix}{file.fileName} ({count.toLocaleString()} รายการ)
                                      </option>
                                    );
                                  })}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-apple-secondary pointer-events-none" />
                              </div>
                            </div>
                            
                            <div className="text-[10px] text-apple-secondary font-bold">
                              พบข้อมูลที่ตรงเงื่อนไข {filteredAndSortedPreview.length} จาก {previewData.length} รายการ
                            </div>
                          </div>

                          <div className="overflow-x-auto overflow-y-auto max-h-[350px]">
                            <table className="w-full text-left border-collapse text-[11px]">
                              <thead>
                                <tr className="border-b border-apple-primary/10 bg-apple-tertiary/10">
                                  <th className="px-3 py-2.5 text-neutral-400 font-bold text-[10px] uppercase text-center w-10">#</th>
                                  {[
                                    { key: "id", label: "รหัสคำสั่งซื้อ" },
                                    { key: "date", label: "วันที่" },
                                    { key: "channel", label: "ช่องทาง" },
                                    { key: "brand", label: "แบรนด์" },
                                    { key: "customerName", label: "ชื่อลูกค้า" },
                                    { key: "productName", label: "ชื่อสินค้า" },
                                    { key: "quantity", label: "จำนวน", isNum: true },
                                    { key: "total", label: "ยอดขายรวม", isNum: true },
                                    { key: "platformFee", label: "ค่าธรรมเนียม", isNum: true },
                                    { key: "shippingFee", label: "ค่าส่ง", isNum: true },
                                    { key: "netIncome", label: "รายรับสุทธิ", isNum: true }
                                  ].map((col) => {
                                    const isSorted = previewSort.key === col.key;
                                    return (
                                      <th
                                        key={col.key}
                                        onClick={() => {
                                          setPreviewSort(prev => ({
                                            key: col.key as keyof Order,
                                            dir: prev.key === col.key ? (prev.dir === 1 ? -1 : 1) : 1
                                          }));
                                        }}
                                        className={`px-3 py-2.5 font-bold text-[10px] uppercase cursor-pointer select-none transition-all group/th ${
                                          isSorted
                                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold"
                                            : "text-apple-secondary hover:text-apple-primary hover:bg-apple-primary/5"
                                        } ${col.isNum ? "text-right" : ""}`}
                                        title={`คลิกเพื่อเรียงลำดับตาม ${col.label}`}
                                      >
                                        <div className={`flex items-center gap-1.5 ${col.isNum ? "justify-end" : ""}`}>
                                          <span>{col.label}</span>
                                          <div className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] transition-all ${
                                            isSorted
                                              ? "bg-blue-500 text-white font-extrabold shadow-xs"
                                              : "text-neutral-400 opacity-20 group-hover/th:opacity-100 group-hover/th:text-blue-500"
                                          }`}>
                                            {isSorted ? (
                                              <>
                                                <span className="text-[10px] leading-none">{previewSort.dir === 1 ? "▲" : "▼"}</span>
                                                <span className="text-[8px] font-bold">
                                                  {col.key === "date"
                                                    ? (previewSort.dir === 1 ? "เก่าสุด" : "ล่าสุด")
                                                    : col.isNum
                                                      ? (previewSort.dir === 1 ? "น้อยสุด" : "มากสุด")
                                                      : (previewSort.dir === 1 ? "ก-ฮ" : "ฮ-ก")}
                                                </span>
                                              </>
                                            ) : (
                                              <span className="text-[9px]">↕</span>
                                            )}
                                          </div>
                                        </div>
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                {filteredAndSortedPreview.slice(previewPage * previewPageSize, (previewPage + 1) * previewPageSize).map((order, index) => {
                                  const rIdx = previewPage * previewPageSize + index + 1;
                                  return (
                                    <tr
                                      key={order.id}
                                      className="hover:bg-apple-tertiary/30 border-b border-apple-primary/5 transition-colors"
                                    >
                                      <td className="px-3 py-2 text-center text-apple-secondary font-mono">{rIdx}</td>
                                      <td className="px-3 py-2 font-mono font-bold text-apple-primary truncate max-w-[120px]">{order.id}</td>
                                      <td className="px-3 py-2 text-apple-secondary whitespace-nowrap">{order.date}</td>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        <span 
                                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-md border"
                                          style={{
                                            backgroundColor: `${PLATFORMS[order.channel === "TikTok Shop" ? "tiktok" : order.channel === "Lazada" ? "lazada" : order.channel === "Shopee" ? "shopee" : order.channel === "Facebook" ? "facebook" : order.channel === "LINE OA" ? "line" : "unknown"]?.color || "#7A8699"}15`,
                                            color: PLATFORMS[order.channel === "TikTok Shop" ? "tiktok" : order.channel === "Lazada" ? "lazada" : order.channel === "Shopee" ? "shopee" : order.channel === "Facebook" ? "facebook" : order.channel === "LINE OA" ? "line" : "unknown"]?.color || "#7A8699",
                                            borderColor: `${PLATFORMS[order.channel === "TikTok Shop" ? "tiktok" : order.channel === "Lazada" ? "lazada" : order.channel === "Shopee" ? "shopee" : order.channel === "Facebook" ? "facebook" : order.channel === "LINE OA" ? "line" : "unknown"]?.color || "#7A8699"}30`
                                          }}
                                        >
                                          {order.channel}
                                        </span>
                                      </td>
                                      <td className="px-3.5 py-2 text-neutral-500 max-w-[100px] truncate">{order.brand}</td>
                                      <td className="px-3.5 py-2 text-neutral-850 dark:text-neutral-100 font-bold truncate max-w-[120px]">{order.customerName}</td>
                                      <td className="px-3.5 py-2 text-neutral-500 truncate max-w-[180px]" title={order.productName}>{order.productName}</td>
                                      <td className="px-3.5 py-2 text-right font-mono text-neutral-800 dark:text-neutral-200 font-bold">{order.quantity}</td>
                                      <td className="px-3.5 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-500">฿{(order.total ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                                      <td className="px-3.5 py-2 text-right font-mono text-rose-500">฿-{(order.platformFee ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                                      <td className="px-3.5 py-2 text-right font-mono text-amber-500">฿-{(order.shippingFee ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                                      <td className={`px-3.5 py-2 text-right font-mono font-black ${(order.netIncome ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-455" : "text-rose-500"}`}>
                                        ฿{(order.netIncome ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {filteredAndSortedPreview.length > previewPageSize && (
                            <div className="p-4 border-t border-apple-primary/10 bg-apple-tertiary/10 flex justify-between items-center text-[10px] font-bold text-apple-secondary shrink-0">
                              <span>แสดง {previewPage * previewPageSize + 1} - {Math.min((previewPage + 1) * previewPageSize, filteredAndSortedPreview.length)} จาก {filteredAndSortedPreview.length} รายการ</span>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  disabled={previewPage === 0}
                                  onClick={() => setPreviewPage(p => p - 1)}
                                  className="px-2.5 py-1 rounded bg-apple-secondary border border-apple-primary/10 hover:bg-apple-tertiary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                >
                                  ย้อนกลับ
                                </button>
                                <button
                                  type="button"
                                  disabled={(previewPage + 1) * previewPageSize >= filteredAndSortedPreview.length}
                                  onClick={() => setPreviewPage(p => p + 1)}
                                  className="px-2.5 py-1 rounded bg-apple-secondary border border-apple-primary/10 hover:bg-apple-tertiary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                >
                                  ถัดไป
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Raw Sheets Preview */
                        <div className="space-y-4">
                          <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                            {datasets.map((d) => {
                              const pf = PLATFORMS[d.platform] || PLATFORMS.unknown;
                              const isActive = d.id === activeDatasetId;
                              return (
                                <button
                                  type="button"
                                  onClick={() => setActiveDatasetId(d.id)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                                    isActive
                                      ? "bg-apple-primary text-apple-secondary border-transparent"
                                      : "bg-apple-secondary border-apple-primary/10 text-apple-secondary hover:bg-apple-tertiary"
                                  }`}
                                >
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pf.color }} />
                                  <span>{d.fileName} ({d.sheetName})</span>
                                </button>
                              );
                            })}
                          </div>

                          {activeDataset && (
                            <div className="border border-apple-primary/10 rounded-2xl overflow-hidden bg-apple-secondary flex flex-col flex-1">
                              <div className="p-4 border-b border-apple-primary/10 flex flex-col sm:flex-row gap-3 justify-between items-center bg-apple-tertiary/20">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-apple-secondary" />
                                    <input
                                      ref={searchInputRef}
                                      type="text"
                                      placeholder="ค้นหาในชีตนี้..."
                                      value={activeDataset.search || ""}
                                      onChange={(e) => handleSearch(e.target.value)}
                                      className="w-full bg-apple-secondary border border-apple-primary/10 rounded-xl py-1.5 pl-9 pr-4 text-xs text-apple-primary placeholder-apple-secondary focus:outline-none focus:border-apple-primary/30"
                                    />
                                  </div>

                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => setIsColMenuOpen(!isColMenuOpen)}
                                      className="px-3 py-1.5 rounded-xl text-xs font-bold border border-apple-primary/10 text-apple-secondary hover:bg-apple-tertiary flex items-center gap-1.5 cursor-pointer bg-apple-secondary"
                                    >
                                      <span>คอลัมน์ ({activeDataset.columns.filter(c => c.visible).length})</span>
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </button>

                                    {isColMenuOpen && (
                                      <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsColMenuOpen(false)} />
                                        <div className="absolute left-0 mt-1.5 w-56 bg-white dark:bg-[#1f1f1f] border border-black/5 dark:border-white/10 rounded-2xl shadow-xl p-2 z-20 max-h-72 overflow-y-auto animate-scale-in">
                                          {activeDataset.columns.map((col) => (
                                            <label 
                                              key={col.key}
                                              className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg cursor-pointer text-xs font-bold text-neutral-700 dark:text-neutral-300"
                                            >
                                              <input
                                                type="checkbox"
                                                checked={col.visible}
                                                onChange={() => toggleColumnVisibility(col.key)}
                                                className="rounded accent-blue-500 cursor-pointer h-3.5 w-3.5"
                                              />
                                              <span>{col.label}</span>
                                            </label>
                                          ))}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="text-[10px] text-apple-secondary font-bold">
                                  พบข้อมูล {filteredRows.length} รายการ
                                </div>
                              </div>

                              <div className="overflow-x-auto overflow-y-auto max-h-[300px]">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-apple-primary/10 bg-apple-tertiary/10">
                                      <th className="px-4 py-2 text-neutral-400 font-bold text-[10px] uppercase text-center w-12">#</th>
                                      {activeDataset.columns.filter(c => c.visible).map((col) => {
                                        const isSorted = activeDataset.sort.key === col.key;
                                        return (
                                          <th
                                            key={col.key}
                                            onClick={() => handleSort(col.key)}
                                            className={`px-4 py-2 font-bold text-[10px] uppercase text-apple-secondary cursor-pointer hover:bg-apple-primary/5 select-none ${col.isNum ? "text-right" : ""}`}
                                          >
                                            <div className={`flex items-center gap-1 ${col.isNum ? "justify-end" : ""}`}>
                                              <span>{col.label}</span>
                                              {isSorted && (
                                                <span className="text-[8px]">{activeDataset.sort.dir === 1 ? "▲" : "▼"}</span>
                                              )}
                                            </div>
                                          </th>
                                        );
                                      })}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredRows.slice(activeDataset.page * activeDataset.pageSize, (activeDataset.page + 1) * activeDataset.pageSize).map((row, rIdx) => (
                                      <tr
                                        key={rIdx}
                                        onClick={() => {
                                          setSelectedRow(row);
                                          setSelectedRowIdx(activeDataset.page * activeDataset.pageSize + rIdx + 1);
                                        }}
                                        className="hover:bg-apple-tertiary/30 border-b border-apple-primary/5 transition-colors cursor-pointer"
                                      >
                                        <td className="px-4 py-2 text-center text-apple-secondary font-mono">
                                          {activeDataset.page * activeDataset.pageSize + rIdx + 1}
                                        </td>
                                        {activeDataset.columns.filter(c => c.visible).map((col) => {
                                          const val = row[col.key];
                                          const f = fmtCell(val, col);
                                          return (
                                            <td key={col.key} className={`px-4 py-2 truncate max-w-[200px] text-apple-primary ${f.cls}`}>
                                              {f.text}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    ))}
                                    {filteredRows.length === 0 && (
                                      <tr>
                                        <td colSpan={activeDataset.columns.filter(c => c.visible).length + 1} className="px-4 py-8 text-center text-apple-secondary font-bold italic">
                                          ไม่พบข้อมูลที่ตรงกับตัวค้นหา
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              {filteredRows.length > activeDataset.pageSize && (
                                <div className="p-4 border-t border-apple-primary/10 bg-apple-tertiary/10 flex justify-between items-center text-[10px] font-bold text-apple-secondary">
                                  <span>แสดง {activeDataset.page * activeDataset.pageSize + 1} - {Math.min((activeDataset.page + 1) * activeDataset.pageSize, filteredRows.length)} จาก {filteredRows.length} รายการ</span>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      disabled={activeDataset.page === 0}
                                      onClick={() => handlePageChange(activeDataset.page - 1)}
                                      className="px-2 py-1 rounded bg-apple-secondary border border-apple-primary/10 hover:bg-apple-tertiary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                      ย้อนกลับ
                                    </button>
                                    <button
                                      type="button"
                                      disabled={(activeDataset.page + 1) * activeDataset.pageSize >= filteredRows.length}
                                      onClick={() => handlePageChange(activeDataset.page + 1)}
                                      className="px-2 py-1 rounded bg-apple-secondary border border-apple-primary/10 hover:bg-apple-tertiary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                      ถัดไป
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions & Inventory Toggle */}
                      <div className="bg-neutral-50/50 dark:bg-neutral-900/30 rounded-2xl p-5 border border-black/[0.04] dark:border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-5 shadow-sm backdrop-blur-md">
                        <label className="flex items-start gap-3.5 cursor-pointer select-none">
                          {/* Custom Premium Toggle Switch */}
                          <div className="relative shrink-0 mt-0.5">
                            <input 
                              type="checkbox" 
                              checked={updateProductInventory}
                              onChange={(e) => setUpdateProductInventory(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-10 h-6 bg-neutral-200 dark:bg-neutral-800 rounded-full peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-indigo-600 dark:peer-checked:from-blue-500 dark:peer-checked:to-indigo-500 transition-all duration-300 after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 shadow-inner" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-neutral-800 dark:text-neutral-200 block leading-tight">อัปเดตจำนวนสินค้าคงคลังโดยอัตโนมัติ</span>
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-450 block mt-1.5 leading-relaxed">ตัดสต็อกสินค้าในคลังสินค้าทันทีเมื่อนำเข้าข้อมูลออเดอร์สำเร็จ</span>
                          </div>
                        </label>
                        
                        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => setCurrentStep(1)}
                            className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-black text-neutral-600 dark:text-neutral-300 bg-white dark:bg-[#1a1a1a] hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-855 cursor-pointer transition-all active:scale-95"
                          >
                            ย้อนกลับ
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmImport}
                            className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-600/15 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 min-h-[44px] transition-all hover:scale-[1.01] border-none"
                          >
                            <Check className="h-4 w-4 stroke-[3px]" /> ยืนยันการนำเข้าข้อมูล
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-apple-secondary font-bold">
                      ไม่พบข้อมูลวิเคราะห์ชุดการนำเข้า
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (

            /* Product Import View */
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-sm font-black text-apple-primary">นำเข้าข้อมูลสินค้าคงคลัง (Import Product Catalog)</h3>
                <p className="text-[10px] text-apple-secondary mt-1">อัปโหลดไฟล์ Excel หรือ CSV เพื่อเพิ่มสินค้าในคลังสินค้าและกำหนดสต็อกพร้อมกัน</p>
              </div>

              {!productFileName ? (
                <div
                  onDragEnter={handleProductDrag}
                  onDragOver={handleProductDrag}
                  onDragLeave={handleProductDrag}
                  onDrop={handleProductDrop}
                  onClick={() => document.getElementById("product-file-input")?.click()}
                  className={`group border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-5 max-w-2xl mx-auto w-full overflow-hidden ${
                    productDragActive
                      ? "border-blue-500 bg-blue-500/[0.04] ring-4 ring-blue-500/10 shadow-[0_0_25px_rgba(59,130,246,0.25)] scale-[1.02]"
                      : "border-black/10 dark:border-white/10 hover:border-blue-500/40 dark:hover:border-blue-400/40 bg-white dark:bg-[#1f1f1f] hover:shadow-[0_8px_30px_rgba(59,130,246,0.04)]"
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-blue-500/[0.03] to-transparent pointer-events-none" />
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 text-blue-500 shadow-sm shadow-blue-500/5 group-hover:scale-105 transition-transform duration-300">
                    <Upload className={`h-7 w-7 ${productDragActive ? "animate-bounce" : ""}`} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-neutral-800 dark:text-neutral-100 uppercase tracking-wider">ลากไฟล์ CSV หรือ Excel มาวางที่นี่ หรือคลิกเพื่ออัปโหลด</h3>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-450 leading-relaxed">คอลัมน์บังคับ: ชื่อสินค้า, ราคา (หมวดหมู่เสริม: Electronics, Apparel, Home, Beauty)</p>
                  </div>
                  <input
                    id="product-file-input"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleProductFileChange}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* File Tag Header */}
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1f1f1f] shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-500 shadow-sm">
                        <FileSpreadsheet className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{productFileName}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            พร้อมนำเข้า
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-500 dark:text-neutral-450 mt-0.5">
                          พบสินค้าพร้อมนำเข้า {productValidCount.toLocaleString()} จาก {parsedProducts.length.toLocaleString()} รายการ
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleProductReset}
                      className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer border-none bg-transparent hover:scale-105 active:scale-95"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      ลบไฟล์
                    </button>
                  </div>

                  {/* Amber Warning Summary Alert */}
                  <div className="bg-gradient-to-r from-amber-500/[0.06] to-amber-600/[0.03] dark:from-amber-500/[0.04] dark:to-amber-600/[0.02] border border-amber-500/20 dark:border-amber-500/15 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <div className="p-1.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                      <AlertTriangle className="h-4.5 w-4.5 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-amber-700 dark:text-amber-400">
                        พบข้อมูลทั้งหมด {parsedProducts.length.toLocaleString()} รายการ กรุณาตรวจสอบความถูกต้องก่อนยืนยัน
                      </p>
                      <p className="text-[10px] text-amber-650 dark:text-amber-500/80 mt-1 leading-relaxed">
                        ข้อมูลนี้ถูกแสดงผลในโหมดพรีวิว (Local State) เท่านั้น จะยังไม่มีการบันทึกลงฐานข้อมูลหลัก (localStorage) หรืออัปเดตระบบจนกว่าคุณจะกดยืนยันปุ่มด้านล่าง
                      </p>
                    </div>
                  </div>

                  {/* 4 KPI Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                    <div className="bg-neutral-50 dark:bg-neutral-900/30 border border-black/[0.04] dark:border-white/[0.04] rounded-2xl p-3.5 flex flex-col justify-between min-w-0">
                      <span className="text-[10px] text-neutral-450 dark:text-neutral-500 font-extrabold uppercase tracking-wider truncate" title="รายการสินค้าทั้งหมดพรีวิว">
                        รายการสินค้าทั้งหมดพรีวิว
                      </span>
                      <div className="flex items-baseline gap-1 mt-1.5 min-w-0">
                        <span className="text-base sm:text-lg md:text-xl font-bold font-mono tracking-tight text-neutral-800 dark:text-neutral-100 truncate" title={parsedProducts.length.toLocaleString()}>
                          {parsedProducts.length.toLocaleString()}
                        </span>
                        <span className="text-xs text-neutral-500 font-semibold ml-1 shrink-0">รายการ</span>
                      </div>
                    </div>

                    <div className="bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-500/20 rounded-2xl p-3.5 flex flex-col justify-between min-w-0">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-extrabold uppercase tracking-wider flex items-center gap-1 truncate" title="สินค้าพร้อมนำเข้า">
                        <Check className="h-3 w-3 shrink-0" /> สินค้าพร้อมนำเข้า
                      </span>
                      <div className="flex items-baseline gap-1 mt-1.5 min-w-0">
                        <span className="text-base sm:text-lg md:text-xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 truncate" title={productValidCount.toLocaleString()}>
                          {productValidCount.toLocaleString()}
                        </span>
                        <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-semibold ml-1 shrink-0">รายการ</span>
                      </div>
                    </div>

                    <div className="bg-neutral-50 dark:bg-neutral-900/30 border border-black/[0.04] dark:border-white/[0.04] rounded-2xl p-3.5 flex flex-col justify-between min-w-0">
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold uppercase tracking-wider truncate" title="มีข้อควรตรวจสอบ">
                        มีข้อควรตรวจสอบ
                      </span>
                      <div className="flex items-baseline gap-1 mt-1.5 min-w-0">
                        <span className="text-base sm:text-lg md:text-xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400 truncate" title={parsedProducts.filter(p => p.warnings).length.toLocaleString()}>
                          {parsedProducts.filter(p => p.warnings).length.toLocaleString()}
                        </span>
                        <span className="text-xs text-neutral-500 font-semibold ml-1 shrink-0">รายการ</span>
                      </div>
                    </div>

                    <div className="bg-neutral-50 dark:bg-neutral-900/30 border border-black/[0.04] dark:border-white/[0.04] rounded-2xl p-3.5 flex flex-col justify-between min-w-0">
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold uppercase tracking-wider truncate" title="สต็อกสินค้ารวมพรีวิว">
                        สต็อกสินค้ารวมพรีวิว
                      </span>
                      <div className="flex items-baseline gap-1 mt-1.5 min-w-0">
                        <span className="text-base sm:text-lg md:text-xl font-bold font-mono tracking-tight text-blue-600 dark:text-blue-400 truncate" title={parsedProducts.filter(p => !p.warnings).reduce((sum, p) => sum + (p.stock || 0), 0).toLocaleString()}>
                          {parsedProducts.filter(p => !p.warnings).reduce((sum, p) => sum + (p.stock || 0), 0).toLocaleString()}
                        </span>
                        <span className="text-xs text-blue-500 font-semibold ml-1 shrink-0">ชิ้น</span>
                      </div>
                    </div>
                  </div>

                  {/* Parsed Products Table */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-apple-secondary">
                        ตรวจสอบและยืนยันข้อมูลรายการสินค้า
                      </label>
                      <span className="text-[10px] font-bold text-apple-secondary">
                        ทั้งหมด {parsedProducts.length.toLocaleString()} รายการ
                      </span>
                    </div>
                    <div className="border border-apple-primary/10 rounded-2xl overflow-hidden max-h-80 overflow-y-auto bg-apple-secondary shadow-sm">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 z-10 bg-apple-tertiary/95 backdrop-blur-md">
                          <tr className="border-b border-apple-primary/10">
                            <th className="px-4 py-2.5 text-neutral-400 font-bold text-[10px] uppercase text-center w-12">#</th>
                            <th className="px-4 py-2.5 font-black text-[10px] uppercase text-apple-secondary">ชื่อสินค้า</th>
                            <th className="px-4 py-2.5 font-black text-[10px] uppercase text-apple-secondary">หมวดหมู่</th>
                            <th className="px-4 py-2.5 font-black text-[10px] uppercase text-apple-secondary">แบรนด์</th>
                            <th className="px-4 py-2.5 font-black text-[10px] uppercase text-apple-secondary text-right">ราคาขาย</th>
                            <th className="px-4 py-2.5 font-black text-[10px] uppercase text-apple-secondary text-center">คงเหลือ</th>
                            <th className="px-4 py-2.5 font-black text-[10px] uppercase text-apple-secondary">สถานะตรวจสอบ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedProducts.map((p, idx) => (
                            <tr key={idx} className="hover:bg-apple-tertiary/30 border-b border-apple-primary/5 transition-colors">
                              <td className="px-4 py-2.5 text-center text-apple-secondary font-mono">{idx + 1}</td>
                              <td className="px-4 py-2.5 font-bold text-apple-primary max-w-[220px] truncate" title={p.name}>
                                {p.name || <span className="text-rose-500 italic">ไม่มีชื่อสินค้า</span>}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-[10px] px-2 py-0.5 rounded-lg border bg-apple-primary/5 border-apple-primary/10 text-apple-secondary font-semibold">
                                  {p.category}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-apple-secondary max-w-[120px] truncate">{p.brand || "-"}</td>
                              <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                ฿{p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-2.5 text-center font-mono font-bold text-apple-primary">{p.stock.toLocaleString()}</td>
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Template Download Option */}
              <div className="flex justify-between items-center text-[10px] font-bold text-apple-secondary pt-2">
                <span>*ระบบจะคัดกรองข้ามรายการสินค้าที่มีความบกพร่องหรือแจ้งเตือนโดยอัตโนมัติ</span>
                <button
                  type="button"
                  onClick={downloadProductTemplate}
                  className="flex items-center gap-1 text-blue-500 hover:underline cursor-pointer border-none bg-transparent font-black"
                >
                  <Download className="h-3 w-3" />
                  ดาวน์โหลดไฟล์ตัวอย่างนำเข้าสินค้า (.csv)
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-2xl flex items-center gap-2.5 animate-fade-in mt-4">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {importType !== "orders" && (
          <div className="p-6 bg-neutral-50 dark:bg-neutral-900/50 shrink-0 flex justify-between items-center border-t border-black/[0.03] dark:border-white/[0.03]">
            <button
              type="button"
              onClick={handleProductReset}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-[#1a1a1a] hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-850 text-neutral-600 dark:text-neutral-400 cursor-pointer transition-all"
            >
              ล้างข้อมูล
            </button>
            <button
              type="button"
              disabled={productValidCount === 0}
              onClick={handleProductImportSubmit}
              className={`px-5 py-2.5 rounded-xl text-xs font-black cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] border-none ${
                productValidCount === 0
                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border border-neutral-200/50 dark:border-neutral-800/50 cursor-not-allowed opacity-50 font-bold"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/15 hover:shadow-lg hover:shadow-blue-600/20"
              }`}
            >
              ยืนยันการนำเข้าสินค้า {productValidCount} รายการ
            </button>
          </div>
        )}

      {/* Detail Drawer overlay */}
      {selectedRow && activeDataset && (
        <>
          <div 
            className="fixed inset-0 bg-neutral-950/40 dark:bg-black/60 backdrop-blur-[2px] z-50 animate-fade-in"
            onClick={() => { setSelectedRow(null); setSelectedRowIdx(-1); }}
          />
          <aside className="fixed top-0 right-0 h-full w-[460px] max-w-[90vw] bg-white/95 dark:bg-[#161616]/95 backdrop-blur-xl shadow-2xl z-50 border-l border-neutral-200/40 dark:border-neutral-800/40 flex flex-col animate-slide-in transition-all duration-300">
            <div className="p-5 border-b border-neutral-100 dark:border-neutral-900/50 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-neutral-850 dark:text-neutral-200 uppercase tracking-wider">รายการแถวที่ {nf0.format(selectedRowIdx)}</h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span 
                    className="capsule-badge" 
                    style={{ 
                      backgroundColor: `${PLATFORMS[activeDataset.platform].color}12`, 
                      color: PLATFORMS[activeDataset.platform].color,
                      borderColor: `${PLATFORMS[activeDataset.platform].color}25`
                    }}
                  >
                    {PLATFORMS[activeDataset.platform].label}
                  </span>
                  <span className="text-[10px] font-bold text-neutral-450 dark:text-neutral-500">{TYPE_LABEL[activeDataset.kind] || activeDataset.kind} · {activeDataset.sheetName}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedRow(null); setSelectedRowIdx(-1); }}
                className="w-8 h-8 rounded-lg border border-neutral-200/60 dark:border-neutral-800/40 bg-neutral-50/50 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-base text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 font-bold transition-all cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-900/30 custom-scrollbar">
              {activeDataset.columns.filter(col => col.visible).map((col) => {
                const f = fmtCell(selectedRow[col.key], col);
                return (
                  <div key={col.key} className="p-4.5 hover:bg-neutral-50/30 dark:hover:bg-neutral-900/10 transition-colors">
                    <span className="text-[9px] font-bold text-neutral-450 dark:text-neutral-500 uppercase tracking-wider block mb-1.5">{col.label}</span>
                    <p className={`text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed break-words whitespace-pre-wrap ${f.cls === "text-right font-mono" ? "font-mono" : ""}`}>
                      {f.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </aside>
        </>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className={`fixed inset-0 bg-neutral-950/40 dark:bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-10 transition-all duration-300 mobile-bottom-sheet ${isDarkMode ? "dark" : ""}`}>
        {content}
      </div>
    );
  }

  return (
    <div className={`w-full ${isDarkMode ? "dark" : ""}`}>
      {content}
    </div>
  );
};

export const ImportOrdersTab = React.memo(ImportOrdersTabComponent);

