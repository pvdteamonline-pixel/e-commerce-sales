import React, { useState, useMemo } from "react";
import {
  Search,
  Download,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Calendar,
  DollarSign,
  Package,
  RotateCcw,
} from "lucide-react";
import { maskCustomerName } from "../utils";

const isCustomerNameHeader = (header: string): boolean => {
  const h = header.toLowerCase().trim();

  // Exclude common non-name headers that might contain "shipping", "buyer", or "customer"
  if (
    h.includes("fee") ||
    h.includes("cost") ||
    h.includes("charge") ||
    h.includes("amount") ||
    h.includes("price") ||
    h.includes("option") ||
    h.includes("carrier") ||
    h.includes("method") ||
    h.includes("status") ||
    h.includes("address") ||
    h.includes("provider") ||
    h.includes("phone") ||
    h.includes("mobile") ||
    h.includes("tel") ||
    h.includes("postcode") ||
    h.includes("zip") ||
    h.includes("email") ||
    h.includes("id") ||
    h.includes("code") ||
    h.includes("number") ||
    h.includes("no") ||
    h.includes("vouchers") ||
    h.includes("discount") ||
    h.includes("rebate") ||
    h.includes("cashback") ||
    h.includes("tax") ||
    h.includes("vat") ||
    h.includes("commission") ||
    h.includes("ค่าส่ง") ||
    h.includes("ค่าจัดส่ง") ||
    h.includes("ที่อยู่") ||
    h.includes("เบอร์") ||
    h.includes("โทร") ||
    h.includes("อีเมล") ||
    h.includes("รหัส") ||
    h.includes("สถานะ") ||
    h.includes("ส่วนลด")
  ) {
    return false;
  }

  return (
    h.includes("customer") ||
    h.includes("recipient") ||
    h.includes("buyer") ||
    h.includes("consignee") ||
    h.includes("shipping") ||
    h.includes("ชื่อลูกค้า") ||
    h.includes("ชื่อผู้รับ") ||
    h.includes("ชื่อผู้ซื้อ") ||
    h === "ลูกค้า" ||
    h === "ผู้รับ"
  );
};


// Robust Date parser supporting Thai Buddhist Era (BE 25xx) and Western Gregorian formats
const parseFlexibleDate = (val: unknown): number | null => {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.getTime();

  const str = String(val).trim();
  if (!str || str === "—" || str === "-") return null;

  // 1. Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY with optional time
  const dmyMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    // Thai Buddhist era conversion (e.g. 2567, 2568, 2569)
    if (year > 2400) {
      year -= 543;
    }
    const d = new Date(year, month, day, hour, minute, second);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // 2. Match YYYY-MM-DD or YYYY/MM/DD with optional time
  const ymdMatch = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    let year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minute = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const second = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;

    if (year > 2400) {
      year -= 543;
    }
    const d = new Date(year, month, day, hour, minute, second);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // 3. Fallback to standard Date.parse
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return parsed;

  return null;
};

// Robust Numeric parser supporting currency signs, commas, percentages, and accounting negatives
const parseFlexibleNumber = (val: unknown): number | null => {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return isNaN(val) ? null : val;

  let str = String(val).trim();
  if (!str || str === "—" || str === "-") return null;

  // Handle accounting brackets: (120.50) -> -120.50
  if (str.startsWith("(") && str.endsWith(")")) {
    str = "-" + str.slice(1, -1);
  }

  // Remove currency symbols, commas, spaces, unit words
  const cleaned = str.replace(/[฿$€¥\s,]/g, "").replace(/(บาท|ชิ้น|รายการ|อัน|ชิ้น|กล่อง|ขวด|ซอง|แถว|unit|units|pcs|pieces|thb)$/i, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;

  const num = Number(cleaned);
  return isNaN(num) ? null : num;
};

const getColumnType = (header: string, sampleRows: Record<string, unknown>[]): "date" | "money" | "quantity" | "number" | "text" => {
  const h = header.toLowerCase().trim();

  // 1. Date header
  if (
    h.includes("date") ||
    h.includes("วันที่") ||
    h.includes("เวลา") ||
    h.includes("created") ||
    h.includes("time") ||
    h.includes("ช่วงเวลา") ||
    h.includes("วันทำรายการ")
  ) {
    return "date";
  }

  // 2. Quantity header
  if (
    (h.includes("จำนวน") && !h.includes("เงิน")) ||
    h.includes("quantity") ||
    h.includes("qty") ||
    h.includes("ชิ้น") ||
    h.includes("unit") ||
    h.includes("count") ||
    h.includes("item")
  ) {
    return "quantity";
  }

  // 3. Money / Total / Sales header
  if (
    h.includes("price") ||
    h.includes("ราคา") ||
    h.includes("total") ||
    h.includes("amount") ||
    h.includes("ยอด") ||
    h.includes("รายได้") ||
    h.includes("รายรับ") ||
    h.includes("cost") ||
    h.includes("ต้นทุน") ||
    h.includes("fee") ||
    h.includes("ค่าธรรมเนียม") ||
    h.includes("ภาษี") ||
    h.includes("tax") ||
    h.includes("vat") ||
    h.includes("ส่วนลด") ||
    h.includes("discount") ||
    h.includes("กำไร") ||
    h.includes("profit") ||
    h.includes("revenue") ||
    h.includes("sales") ||
    h.includes("เงิน") ||
    h.includes("ชำระ")
  ) {
    return "money";
  }

  // Check sample values if header is generic
  let dateCount = 0;
  let numCount = 0;
  let sampleCount = 0;

  for (let i = 0; i < Math.min(sampleRows.length, 10); i++) {
    const v = sampleRows[i]?.[header];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      sampleCount++;
      if (parseFlexibleDate(v) !== null) dateCount++;
      if (parseFlexibleNumber(v) !== null) numCount++;
    }
  }

  if (sampleCount > 0) {
    if (dateCount / sampleCount >= 0.7) return "date";
    if (numCount / sampleCount >= 0.7) return "number";
  }

  return "text";
};

interface ExcelTableProps {
  headers?: string[];
  rows?: Record<string, unknown>[];
  isDarkMode: boolean;
  themeColor?: "blue" | "emerald";
}

const ExcelTableComponent: React.FC<ExcelTableProps> = ({ headers = [], rows = [], isDarkMode, themeColor = "blue" }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const safeHeaders = useMemo(() => Array.isArray(headers) ? headers : [], [headers]);
  const safeRows = useMemo(() => Array.isArray(rows) ? rows : [], [rows]);

  // Map header -> Column Type
  const headerTypes = useMemo(() => {
    const map: Record<string, "date" | "money" | "quantity" | "number" | "text"> = {};
    safeHeaders.forEach((h) => {
      map[h] = getColumnType(h, safeRows);
    });
    return map;
  }, [safeHeaders, safeRows]);

  // Find Best Matching Column for Date, Sales, Quantity for Quick Sort Bar
  const keyColumns = useMemo(() => {
    // 1. Date Column
    const dateCol = safeHeaders.find((h) => {
      const lh = h.toLowerCase();
      return lh.includes("วันที่") || lh.includes("date") || lh.includes("เวลา") || lh.includes("time");
    }) || safeHeaders.find((h) => headerTypes[h] === "date");

    // 2. Sales / Total Column
    const salesCol = safeHeaders.find((h) => {
      const lh = h.toLowerCase();
      return (
        lh.includes("ยอดขายรวม") ||
        lh.includes("ยอดเงิน") ||
        lh.includes("ยอดรวม") ||
        lh.includes("ยอดขาย") ||
        lh.includes("ยอดชำระ") ||
        lh.includes("ยอดสุทธิ") ||
        lh.includes("total amount") ||
        lh.includes("total") ||
        lh.includes("revenue") ||
        lh.includes("gross") ||
        lh.includes("net income") ||
        lh.includes("รายรับ") ||
        lh.includes("ราคา")
      );
    }) || safeHeaders.find((h) => headerTypes[h] === "money");

    // 3. Quantity Column
    const qtyCol = safeHeaders.find((h) => {
      const lh = h.toLowerCase();
      return (
        (lh.includes("จำนวน") && !lh.includes("เงิน")) ||
        lh.includes("quantity") ||
        lh.includes("qty") ||
        lh.includes("ชิ้น")
      );
    }) || safeHeaders.find((h) => headerTypes[h] === "quantity");

    return { dateCol, salesCol, qtyCol };
  }, [safeHeaders, headerTypes]);

  // 1. Reset pagination when rows or search changes
  const resetPagination = () => setCurrentPage(1);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    resetPagination();
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    resetPagination();
  };

  // 2. Filter rows based on search term
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return safeRows;
    const term = searchTerm.toLowerCase().trim();
    return safeRows.filter((row) => {
      if (!row) return false;
      return safeHeaders.some((h) => {
        const val = row[h];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }, [safeRows, searchTerm, safeHeaders]);

  // 3. 3-State Sort config handler: Descending (มากไปน้อย/ล่าสุด) -> Ascending (น้อยไปมาก/เก่าสุด) -> None (Reset)
  const handleSort = (key: string, forceDirection?: "asc" | "desc") => {
    if (forceDirection) {
      setSortConfig({ key, direction: forceDirection });
      resetPagination();
      return;
    }

    if (!sortConfig || sortConfig.key !== key) {
      // First click on column: Descending for dates/numbers/sales/quantity, Ascending for text
      const type = headerTypes[key] || "text";
      const initialDirection: "asc" | "desc" = type === "text" ? "asc" : "desc";
      setSortConfig({ key, direction: initialDirection });
    } else if (sortConfig.key === key) {
      if (sortConfig.direction === "desc") {
        setSortConfig({ key, direction: "asc" });
      } else {
        // Third click: Reset to unsorted original order
        setSortConfig(null);
      }
    }
    resetPagination();
  };

  // 4. Robust High-Performance Sort rows (Precomputed sort keys with Schwartzian transform)
  const sortedRows = useMemo(() => {
    if (!sortConfig) return filteredRows;
    const { key, direction } = sortConfig;
    const dirMult = direction === "asc" ? 1 : -1;
    const colType = headerTypes[key] || "text";

    // Precompute keys once per row O(N) instead of O(N log N) inside comparator
    const mapped = filteredRows.map((row, idx) => {
      const val = row[key];
      const isEmpty = val === undefined || val === null || String(val).trim() === "" || String(val).trim() === "—";
      let sortKey: number | string | null = null;

      if (!isEmpty) {
        if (colType === "date") {
          sortKey = parseFlexibleDate(val);
        } else if (colType === "money" || colType === "quantity" || colType === "number") {
          sortKey = parseFlexibleNumber(val);
        }
        if (sortKey === null) {
          const autoNum = parseFlexibleNumber(val);
          if (autoNum !== null) {
            sortKey = autoNum;
          } else {
            sortKey = String(val).trim().toLowerCase();
          }
        }
      }

      return { idx, row, isEmpty, sortKey };
    });

    mapped.sort((a, b) => {
      if (a.isEmpty && b.isEmpty) return a.idx - b.idx;
      if (a.isEmpty) return 1;
      if (b.isEmpty) return -1;

      if (typeof a.sortKey === "number" && typeof b.sortKey === "number") {
        const diff = a.sortKey - b.sortKey;
        return diff === 0 ? a.idx - b.idx : diff * dirMult;
      }

      const strA = String(a.sortKey ?? "");
      const strB = String(b.sortKey ?? "");
      const cmp = strA.localeCompare(strB, "th", { numeric: true, sensitivity: "base" });
      return cmp === 0 ? a.idx - b.idx : cmp * dirMult;
    });

    return mapped.map((m) => m.row);
  }, [filteredRows, sortConfig, headerTypes]);

  // 5. Paginated rows
  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return sortedRows.slice(startIdx, startIdx + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  // 6. CSV Export with UTF-8 BOM (Important for Thai characters in Excel)
  const exportToCSV = () => {
    if (rows.length === 0) return;
    const csvRows = [];

    // Header row
    csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(","));

    // Data rows
    rows.forEach(r => {
      csvRows.push(
        headers
          .map((h) => {
            const isNameHeader = isCustomerNameHeader(h);
            const rawVal = r[h] === undefined || r[h] === null ? "" : String(r[h]);
            const val = isNameHeader ? maskCustomerName(rawVal) : rawVal;
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(",")
      );
    });

    const csvContent = csvRows.join("\n");
    // UTF-8 BOM
    const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([BOM, csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `export_data_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 7. Value Formatter for cells (align numeric values right)
  const formatCell = (val: unknown, header: string) => {
    if (val === null || val === undefined) return { text: "—", isNum: false };
    
    // Date check
    if (val instanceof Date) {
      return { text: val.toLocaleDateString("th-TH"), isNum: false };
    }

    const rawStr = String(val).trim();
    if (rawStr === "") return { text: "—", isNum: false };

    // Check if the header indicates this is a code, ID, index, phone number, etc.
    const h = header.toLowerCase().trim();
    const isCodeOrId = 
      h.includes("id") ||
      h.includes("code") ||
      h.includes("sku") ||
      h.includes("รหัส") ||
      h.includes("เลขที่") ||
      h.includes("หมายเลข") ||
      h.includes("เบอร์") ||
      h.includes("โทร") ||
      h.includes("phone") ||
      h.includes("tel") ||
      h.includes("mobile") ||
      h.includes("zip") ||
      h.includes("postcode") ||
      h.includes("tracking") ||
      h.includes("พัสดุ") ||
      h.includes("barcode") ||
      h.includes("บาร์โค้ด") ||
      h.includes("ลำดับ") ||
      h.includes("no.") ||
      h.includes("order") ||
      h.includes("คำสั่งซื้อ") ||
      /^(คอลัมน์|column)\s*(1|2|4|6)$/i.test(h);

    if (isCodeOrId) {
      return { text: rawStr, isNum: false };
    }

    // Preserve strings with leading zeros (e.g., postal codes, phone numbers, prefixed codes)
    if (rawStr.length > 1 && rawStr.startsWith("0") && !rawStr.startsWith("0.")) {
      return { text: rawStr, isNum: false };
    }

    // Number check
    const num = Number(rawStr.replace(/,/g, ""));
    const isNumber = !isNaN(num) && !/^[0-9]+[a-zA-Z]+/.test(rawStr) && rawStr.length < 16;
    
    if (isNumber) {
      const isMoney = 
        h.includes("price") ||
        h.includes("ราคา") ||
        h.includes("total") ||
        h.includes("amount") ||
        h.includes("ยอด") ||
        h.includes("รายได้") ||
        h.includes("รายรับ") ||
        h.includes("cost") ||
        h.includes("ต้นทุน") ||
        h.includes("fee") ||
        h.includes("ค่าธรรมเนียม") ||
        h.includes("ภาษี") ||
        h.includes("tax") ||
        h.includes("vat") ||
        h.includes("ส่วนลด") ||
        h.includes("discount") ||
        h.includes("กำไร") ||
        h.includes("profit") ||
        h.includes("revenue");

      if (isMoney) {
        return { 
          text: num.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 
          isNum: true 
        };
      }

      // Standard integer / decimal formatting
      const formatted = Number.isInteger(num) 
        ? num.toLocaleString("th-TH", { maximumFractionDigits: 0 }) 
        : num.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return { text: formatted, isNum: true };
    }

    return { text: rawStr, isNum: false };
  };

  return (
    <div className={`flex flex-col rounded-2xl border ${
      isDarkMode ? "bg-[#121212]/90 border-white/[0.06] shadow-xl shadow-black/30" : "bg-white border-neutral-200 shadow-md shadow-neutral-100"
    } overflow-hidden`}>
      {/* Table Toolbar */}
      <div className="p-4 border-b border-apple-primary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm group/search">
          <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-455 pointer-events-none transition-colors ${
            themeColor === "emerald" ? "group-focus-within/search:text-emerald-500" : "group-focus-within/search:text-blue-500"
          }`} />
          <input
            type="text"
            placeholder="ค้นหาข้อมูลทุกคอลัมน์..."
            value={searchTerm}
            onChange={handleSearchChange}
            className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-xs focus:outline-none transition-all duration-300 ${
              isDarkMode 
                ? `bg-[#141414]/60 border-white/[0.06] text-white focus:ring-2 focus:ring-opacity-10 placeholder-neutral-600 ${
                    themeColor === "emerald" ? "focus:border-emerald-500/60 focus:ring-emerald-500" : "focus:border-blue-500/60 focus:ring-blue-500"
                  }` 
                : `bg-neutral-50 border-neutral-200 text-black focus:ring-2 focus:ring-opacity-5 placeholder-neutral-400 ${
                    themeColor === "emerald" ? "focus:border-emerald-500/60 focus:ring-emerald-500" : "focus:border-blue-500/60 focus:ring-blue-500"
                  }`
            }`}
          />
        </div>

        {/* Action button */}
        <button
          onClick={exportToCSV}
          disabled={rows.length === 0}
          className={`flex items-center justify-center gap-1.5 px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            isDarkMode 
              ? "bg-white/[0.04] border border-white/[0.06] text-white hover:bg-white/[0.08]" 
              : "bg-neutral-50 border border-neutral-200 text-neutral-800 hover:bg-neutral-100"
          }`}
        >
          <Download className="h-3.5 w-3.5" />
          <span>ดาวน์โหลดตาราง (CSV)</span>
        </button>
      </div>

      {/* Quick Sort Bar for Key Columns (วันที่, ยอดขาย, จำนวนชิ้น) */}
      <div className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2.5 text-xs ${
        isDarkMode ? "border-white/[0.04] bg-neutral-900/40" : "border-neutral-100 bg-neutral-50/70"
      }`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
            <ArrowUpDown className="h-3.5 w-3.5 text-blue-500" />
            <span>เรียงข้อมูลด่วน (3 รายการหลัก):</span>
          </span>

          {/* 1. Date quick sort */}
          {keyColumns.dateCol && (
            <button
              type="button"
              onClick={() => handleSort(keyColumns.dateCol!)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                sortConfig?.key === keyColumns.dateCol
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30 ring-2 ring-blue-500/30"
                  : isDarkMode
                    ? "bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-300 border border-white/5"
                    : "bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200/80 shadow-2xs"
              }`}
              title="เรียงตามวันที่ (คลิกเพื่อสลับ ล่าสุด/เก่าสุด)"
            >
              <Calendar className="h-3 w-3 text-blue-400" />
              <span>วันที่</span>
              {sortConfig?.key === keyColumns.dateCol ? (
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-mono font-black">
                  {sortConfig.direction === "desc" ? "ล่าสุด ⬇" : "เก่าสุด ⬆"}
                </span>
              ) : (
                <span className="opacity-40 text-[9px]">↕</span>
              )}
            </button>
          )}

          {/* 2. Sales quick sort */}
          {keyColumns.salesCol && (
            <button
              type="button"
              onClick={() => handleSort(keyColumns.salesCol!)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                sortConfig?.key === keyColumns.salesCol
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 ring-2 ring-emerald-500/30"
                  : isDarkMode
                    ? "bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-300 border border-white/5"
                    : "bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200/80 shadow-2xs"
              }`}
              title="เรียงตามยอดขาย (คลิกเพื่อสลับ มากสุด/น้อยสุด)"
            >
              <DollarSign className="h-3 w-3 text-emerald-400" />
              <span>ยอดขาย</span>
              {sortConfig?.key === keyColumns.salesCol ? (
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-mono font-black">
                  {sortConfig.direction === "desc" ? "มากสุด ⬇" : "น้อยสุด ⬆"}
                </span>
              ) : (
                <span className="opacity-40 text-[9px]">↕</span>
              )}
            </button>
          )}

          {/* 3. Quantity quick sort */}
          {keyColumns.qtyCol && (
            <button
              type="button"
              onClick={() => handleSort(keyColumns.qtyCol!)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                sortConfig?.key === keyColumns.qtyCol
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30 ring-2 ring-purple-500/30"
                  : isDarkMode
                    ? "bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-300 border border-white/5"
                    : "bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200/80 shadow-2xs"
              }`}
              title="เรียงตามจำนวนชิ้น (คลิกเพื่อสลับ มากสุด/น้อยสุด)"
            >
              <Package className="h-3 w-3 text-purple-400" />
              <span>จำนวนชิ้น</span>
              {sortConfig?.key === keyColumns.qtyCol ? (
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-mono font-black">
                  {sortConfig.direction === "desc" ? "มากสุด ⬇" : "น้อยสุด ⬆"}
                </span>
              ) : (
                <span className="opacity-40 text-[9px]">↕</span>
              )}
            </button>
          )}
        </div>

        {/* Clear / Reset Sort button */}
        {sortConfig && (
          <button
            type="button"
            onClick={() => setSortConfig(null)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-neutral-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>รีเซ็ตการเรียงลำดับ</span>
          </button>
        )}
      </div>

      {/* Main Scrollable Table Wrapper */}
      <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
        <table className="w-full text-left text-[11px] md:text-xs">
          <thead>
            <tr className={`border-b ${isDarkMode ? "border-white/[0.06] bg-neutral-950" : "border-neutral-200 bg-neutral-50"}`}>
              {safeHeaders.map((h) => {
                const isSorted = sortConfig?.key === h;
                const isAsc = sortConfig?.direction === "asc";
                const colType = headerTypes[h] || "text";

                // Check if this is one of the 3 primary key columns (วันที่, ยอดขาย, จำนวนชิ้น)
                const isKeyColumn =
                  h === keyColumns.dateCol ||
                  h === keyColumns.salesCol ||
                  h === keyColumns.qtyCol ||
                  colType === "date" ||
                  colType === "money" ||
                  colType === "quantity";

                // Label for sorting direction
                let dirLabel = "";
                if (isSorted) {
                  if (colType === "date") {
                    dirLabel = isAsc ? "เก่าสุด" : "ล่าสุด";
                  } else if (colType === "money" || colType === "quantity" || colType === "number") {
                    dirLabel = isAsc ? "น้อยสุด" : "มากสุด";
                  } else {
                    dirLabel = isAsc ? "ก-ฮ" : "ฮ-ก";
                  }
                }

                return (
                  <th
                    key={h}
                    onClick={() => handleSort(h)}
                    className={`sticky top-0 z-10 px-4 py-3 font-bold text-[11px] whitespace-nowrap tracking-wider select-none cursor-pointer group/th transition-all duration-200 ${
                      isSorted
                        ? isDarkMode
                          ? "bg-blue-950/40 text-blue-400 border-b-2 border-blue-500 shadow-sm"
                          : "bg-blue-50/80 text-blue-700 border-b-2 border-blue-500 shadow-sm"
                        : isKeyColumn
                          ? isDarkMode
                            ? "bg-[#141414] hover:bg-neutral-900 text-apple-primary"
                            : "bg-neutral-50 hover:bg-neutral-100/90 text-apple-primary"
                          : isDarkMode
                            ? "bg-[#141414] hover:bg-neutral-900 text-apple-secondary hover:text-white"
                            : "bg-neutral-50 hover:bg-neutral-100/90 text-apple-secondary hover:text-black"
                    }`}
                    style={{ minWidth: "150px" }}
                    title={`คลิกเพื่อเรียงลำดับตาม ${h}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{h}</span>
                      {isSorted ? (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-blue-500 text-white font-extrabold shadow-sm scale-105 transition-all shrink-0">
                          <span className="text-[11px] leading-none">{isAsc ? "▲" : "▼"}</span>
                          <span className="text-[9px] font-bold tracking-tight">{dirLabel}</span>
                        </div>
                      ) : isKeyColumn ? (
                        <div className="text-blue-500/40 group-hover/th:text-blue-500 group-hover/th:opacity-100 transition-all shrink-0">
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      ) : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.02] dark:divide-white/[0.02]">
            {paginatedRows.length > 0 ? (
              paginatedRows.map((row, index) => (
                <tr
                  key={index}
                  className={`transition-colors hover:bg-neutral-50/50 dark:hover:bg-neutral-850/40 ${
                    index % 2 === 0 ? "bg-transparent" : "bg-neutral-50/[0.02] dark:bg-white/[0.01]"
                  }`}
                >
                  {safeHeaders.map((h) => {
                    const isNameHeader = isCustomerNameHeader(h);
                    const rawVal = row ? row[h] : "";
                    const maskedVal = isNameHeader && typeof rawVal === "string" ? maskCustomerName(rawVal) : rawVal;
                    const formatted = formatCell(maskedVal, h);
                    return (
                      <td
                        key={h}
                        className={`px-4 py-2.5 max-w-[250px] relative group/cell truncate ${
                          formatted.isNum 
                            ? "text-right font-mono font-bold text-emerald-600 dark:text-emerald-400" 
                            : "text-apple-primary font-medium"
                        }`}
                        title={isNameHeader ? String(maskedVal) : String(row ? (row[h] ?? "") : "")}
                      >
                        {formatted.text}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={safeHeaders.length || 1} className="px-5 py-12 text-center text-apple-secondary italic font-bold">
                  ไม่พบข้อมูลรายการที่ตรงตามเงื่อนไข
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Footer */}
      <div className={`p-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-bold text-apple-secondary ${
        isDarkMode ? "border-white/[0.06] bg-[#141414]/90" : "border-neutral-200 bg-neutral-50"
      }`}>
        <div className="flex items-center gap-4">
          <span>
            แสดง {filteredRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredRows.length)} จาก {filteredRows.length} รายการ
          </span>
          <span className="flex items-center gap-1.5 font-bold">
            แสดงหน้าละ
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className={`border rounded-lg px-2 py-1 outline-none text-xs focus:ring-1 focus:ring-opacity-10 ${
                isDarkMode 
                  ? `bg-neutral-950 border-white/[0.06] text-white ${
                      themeColor === "emerald" ? "focus:border-emerald-500/60 focus:ring-emerald-500" : "focus:border-blue-500/60 focus:ring-blue-500"
                    }` 
                  : `bg-white border-neutral-200 text-black ${
                      themeColor === "emerald" ? "focus:border-emerald-500/60 focus:ring-emerald-500" : "focus:border-blue-500/60 focus:ring-blue-500"
                    }`
              }`}
            >
              {[25, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </span>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className={`h-8 w-8 rounded-xl flex items-center justify-center border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors ${
              isDarkMode 
                ? "border-white/[0.06] hover:bg-neutral-800 text-white" 
                : "border-neutral-200 hover:bg-neutral-100 text-black"
            }`}
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={`h-8 w-8 rounded-xl flex items-center justify-center border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors ${
              isDarkMode 
                ? "border-white/[0.06] hover:bg-neutral-800 text-white" 
                : "border-neutral-200 hover:bg-neutral-100 text-black"
            }`}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          
          <span className="px-3.5 py-1.5 rounded-xl font-mono border border-black/[0.03] dark:border-white/[0.03] bg-neutral-100 dark:bg-neutral-900 text-apple-primary text-[10.5px]">
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className={`h-8 w-8 rounded-xl flex items-center justify-center border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors ${
              isDarkMode 
                ? "border-white/[0.06] hover:bg-neutral-800 text-white" 
                : "border-neutral-200 hover:bg-neutral-100 text-black"
            }`}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className={`h-8 w-8 rounded-xl flex items-center justify-center border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors ${
              isDarkMode 
                ? "border-white/[0.06] hover:bg-neutral-800 text-white" 
                : "border-neutral-200 hover:bg-neutral-100 text-black"
            }`}
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const ExcelTable = React.memo(ExcelTableComponent);

