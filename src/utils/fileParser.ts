import * as XLSX from "xlsx";
import type { UploadedDataset, SheetData, Order } from "../types";
import { parseAndNormalizeDate, detectBrand, resolveBrandName } from "../utils";

export const repairWorksheetRange = (ws: XLSX.WorkSheet): void => {
  if (!ws) return;
  const cellKeys = Object.keys(ws).filter((k) => !k.startsWith("!"));
  if (cellKeys.length === 0) return;
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (let i = 0; i < cellKeys.length; i++) {
    const coord = XLSX.utils.decode_cell(cellKeys[i]);
    if (coord.r < minR) minR = coord.r;
    if (coord.r > maxR) maxR = coord.r;
    if (coord.c < minC) minC = coord.c;
    if (coord.c > maxC) maxC = coord.c;
  }
  if (minR !== Infinity) {
    if (ws["!ref"]) {
      try {
        const orig = XLSX.utils.decode_range(ws["!ref"]);
        minR = Math.min(minR, orig.s.r);
        minC = Math.min(minC, orig.s.c);
        maxR = Math.max(maxR, orig.e.r);
        maxC = Math.max(maxC, orig.e.c);
      } catch {
        // ignore decode errors
      }
    }
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: minR, c: minC }, e: { r: maxR, c: maxC } });
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

const isCellDateLike = (val: unknown): boolean => {
  if (val === null || val === undefined || val === "") return false;
  if (val instanceof Date) return true;
  if (typeof val === "string") {
    const s = val.trim();
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(s) || /^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(s)) return true;
  }
  return false;
};

const isCellDataLike = (c: unknown): boolean => {
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

const detectHeaderRow = (aoa: unknown[][]): { idx: number; width: number } => {
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

    const dataCellCount = firstRow.filter(isCellDataLike).length;
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
      keywordScore -= 300;
    }

    const totalScore = keywordScore + nonEmptyCells.length * 10;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestIdx = i;
      bestWidth = row.length;
    }
  }

  // If no good header candidate was found with positive keyword score, consider it headerless
  if (bestScore <= 50 && aoa[0] && aoa[0].some(isCellDataLike)) {
    return { idx: -1, width: aoa[0].length };
  }

  return { idx: bestIdx < 0 ? 0 : bestIdx, width: Math.max(bestWidth, aoa[0]?.length || 0) };
};

export const detectPlatform = (fileName: string, allHeaders: string[] = []): "lazada" | "shopee" | "tiktok" | "facebook" | "line" | "unknown" => {
  const name = (fileName || "").toLowerCase();
  
  // 1. Explicit filename matches (handles prefixes like TT..., LAZ..., SP..., FB..., LINE...)
  if (name.includes("lazada") || name.startsWith("laz") || name.includes("laz_") || name.includes("laz-") || name.includes("laz ") || name.includes("ลาซาด้า")) return "lazada";
  if (name.includes("shopee") || name.startsWith("shopee") || name.startsWith("sp_") || name.startsWith("sp-") || name.startsWith("sp ") || name.startsWith("sp") || name.includes("ช้อปปี้") || name.includes("ช็อปปี้")) return "shopee";
  if (name.includes("tiktok") || name.includes("tik_tok") || name.startsWith("tt") || name.includes("tt_") || name.includes("tt-") || name.includes("tt ") || name.includes("ติ๊กต๊อก") || name.includes("ติ๊กตอก")) return "tiktok";
  if (name.includes("facebook") || name.startsWith("fb") || name.includes("page365") || name.includes("fb_") || name.includes("fb-") || name.includes("fb ") || name.includes("เฟส") || name.includes("เฟซ") || name.includes("เฟสบุ๊ค") || name.includes("เฟซบุ๊ก")) return "facebook";
  if (name.includes("line") || name.startsWith("line") || name.includes("line_") || name.includes("line-") || name.includes("lineoa") || name.includes("lineshopping") || name.includes("ไลน์") || name.includes("myshop")) return "line";

  if (!allHeaders || allHeaders.length === 0) return "unknown";

  const headers = allHeaders.map(h => String(h).trim().toLowerCase());
  const cleanHeaders = headers.map(h => h.replace(/[\s_./-]/g, ""));

  // Check header text or system strings
  if (headers.some(h => h.includes("shopee") || h.includes("ช็อปปี้") || h.includes("ช้อปปี้"))) return "shopee";
  if (headers.some(h => h.includes("tiktok") || h.includes("ติ๊กต๊อก") || h.includes("ติ๊กตอก"))) return "tiktok";
  if (headers.some(h => h.includes("lazada") || h.includes("ลาซาด้า"))) return "lazada";
  if (headers.some(h => h.includes("facebook") || h.includes("เฟส") || h.includes("เฟซ"))) return "facebook";
  if (headers.some(h => h.includes("line") || h.includes("ไลน์"))) return "line";

  // 2. Facebook specific headers
  if (headers.some(h => ["facebook id", "fb name", "fb_id", "ชื่อลูกค้า fb", "เพจ", "page name", "facebook_order", "fb_order", "วันที่สั่งซื้อ (yyyy-mm-dd)", "facebook", "fb", "เฟสบุ๊ค", "เฟซบุ๊ก", "เพจ facebook"].some(k => h === k || h.includes(k)))) {
    return "facebook";
  }

  // 3. LINE OA specific headers
  if (headers.some(h => ["line id", "line name", "line_id", "ชื่อลูกค้า line", "ไลน์", "line_order", "lineoa_order", "lineshopping", "line oa", "line shopping", "myshop"].some(k => h === k || h.includes(k)))) {
    return "line";
  }

  // 4. Shopee specific headers
  if (
    headers.some(h => [
      "ค่าจัดส่งที่ shopee ชำระโดยชื่อของคุณ", "ค่าจัดส่งที่ shopee ชำระโดยผู้ซื้อ",
      "ค่าธรรมเนียมโครงสร้างพื้นฐานแพลตฟอร์ม", "จำนวนเงินทั้งหมดที่โอนแล้ว (฿)", 
      "จำนวนเงินทั้งหมดที่โอนแล้ว", "เลขอ้างอิง parent sku", 
      "เลขอ้างอิง sku (sku reference no.)", "โค้ด coins cashback ชำระโดยผู้ขาย", 
      "ส่วนลดจาก shopee", "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)"
    ].includes(h))
  ) {
    return "shopee";
  }

  // 5. TikTok Shop specific headers
  if (
    headers.some(h => [
      "sku subtotal after discount", "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย", 
      "ค่าคอมมิชชั่น tiktok shop", "หมายเลขคำสั่งซื้อ/การปรับ", 
      "เวลาที่ชำระคำสั่งซื้อ", "order substatus", "cancelation/return type", 
      "normal or pre-order", "sku id", "tiktok shop", "tiktok", "ติ๊กต๊อก", "ติ๊กตอก",
      "sku subtotal before discount", "sku seller discount", "sku unit original price",
      "sku platform discount", "ราคารวมย่อยของ sku", "ราคาต่อหน่วยของ sku", "ยอดรวมค่าสินค้า"
    ].some(k => h === k || h.includes(k)))
  ) {
    return "tiktok";
  }

  // 6. Lazada specific headers
  if (
    cleanHeaders.some(h => [
      "orderitemid", "orderitemno", "lazadasku", "statementnumber", 
      "feename", "paidstatus", "shippingprovider", "trackingcode"
    ].includes(h)) ||
    headers.some(h => [
      "order item id", "order item no", "order item no.", "lazada sku", 
      "statement number", "fee name", "paid status", "shipping provider",
      "tracking code", "หมายเลขรายการสินค้า", "รหัสรอบบิล", "ระยะเวลาใบแจ้งยอด",
      "ชื่อรายการธุรกรรม"
    ].includes(h))
  ) {
    return "lazada";
  }

  // 7. General/Thai Ecommerce fallback
  if (headers.some(h => ["หมายเลขคำสั่งซื้อ", "ราคาขายสุทธิ", "ราคาขาย", "สถานะการสั่งซื้อ"].includes(h))) {
    if (cleanHeaders.some(h => ["orderitemid", "orderitemno", "lazadasku", "paidprice", "unitprice"].includes(h))) {
      return "lazada";
    }
    return "shopee";
  }

  // 8. General English Order fallback
  if (headers.some(h => ["order id", "order status", "seller sku", "product name"].includes(h))) {
    if (cleanHeaders.some(h => ["orderitemid", "orderitemno", "lazadasku", "paidprice", "unitprice"].includes(h))) {
      return "lazada";
    }
    return "tiktok";
  }

  return "unknown";
};

const detectFileType = (fileName: string, allHeaders: string[]): "income" | "order" => {
  const name = (fileName || "").toLowerCase();
  const headers = allHeaders.map(h => String(h).trim().toLowerCase());

  // Check by filename keywords
  const hasOrderKeyword = name.includes("order") || name.includes("orders") || name.includes("คำสั่งซื้อ") || name.includes("ordersku");
  const hasIncomeKeyword = name.includes("income") || name.includes("รายรับ") || name.includes("โอนเงิน") || name.includes("statement") || name.includes("payout") || name.includes("settlement");

  if (hasOrderKeyword && !hasIncomeKeyword) return "order";
  if (hasIncomeKeyword && !hasOrderKeyword) return "income";

  // Check for distinct order/product keywords first (e.g. TikTok orders, Shopee orders, Lazada orders)
  const orderKeywords = [
    "order item id", "orderitemid", "order item no", "orderitemno", "lazada sku", 
    "lazadasku", "order status", "สถานะการสั่งซื้อ", "สถานะคำสั่งซื้อ", "หมายเลขคำสั่งซื้อ",
    "order id", "sku subtotal after discount", "sku subtotal before discount",
    "เลขอ้างอิง parent sku", "paid price", "paidprice", "unit price", "unitprice", 
    "ชื่อผู้รับ", "recipient", "ราคาขายสุทธิ", "shipping address", "shippingaddress",
    "sku id", "seller sku", "ราคาต่อหน่วยของ sku", "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย",
    "ชื่อสินค้า", "product name", "หมายเลขพัสดุ", "tracking code"
  ];
  if (headers.some(h => orderKeywords.some(kw => h === kw || h.includes(kw)))) {
    return "order";
  }

  // Check by column headers for true statement/income files
  const incomeKeywords = [
    "statement number", "fee name", "ชื่อรายการธุรกรรม", "จำนวนเงินทั้งหมดที่โอนแล้ว (฿)", 
    "จำนวนเงินทั้งหมดที่โอนแล้ว", "วันที่โอนชำระเงินสำเร็จ", 
    "ประเภทธุรกรรม", "รายได้รวม", "รหัสรอบบิล", 
    "ระยะเวลาใบแจ้งยอด", "สถานะการโอนเงิน", "settlement"
  ];
  if (headers.some(h => incomeKeywords.some(kw => h === kw || h.includes(kw)))) {
    return "income";
  }

  return hasIncomeKeyword ? "income" : "order";
};

export const parseExcelFile = (file: File): Promise<UploadedDataset> => {
  return new Promise((resolve, reject) => {
    if (file.name.startsWith("~$")) {
      reject(new Error("ไม่สามารถนำเข้าไฟล์ชั่วคราว (Temporary File) ของ Excel ได้"));
      return;
    }
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        let workbook: XLSX.WorkBook;
        try {
          workbook = XLSX.read(data, { type: "array", cellDates: true, raw: true });
        } catch {
          workbook = XLSX.read(data, { type: "array" });
        }

        const sheets: SheetData[] = [];
        let detectedPlatformVal: "lazada" | "shopee" | "tiktok" | "facebook" | "line" | "unknown" = "unknown";
        let detectedTypeVal: "income" | "order" = "order";
        let firstDetected = false;

        workbook.SheetNames.forEach((sheetName, sIdx) => {
          // Check system / hidden sheet name prefixes
          if (sheetName.startsWith("_") || sheetName.startsWith(".") || sheetName.startsWith("~$")) {
            return;
          }

          // Check if sheet is hidden or veryHidden in Excel workbook metadata
          const sheetProps = workbook.Workbook?.Sheets?.find(s => s && s.name && s.name.trim().toLowerCase() === sheetName.trim().toLowerCase())
            || (workbook.Workbook?.Sheets ? workbook.Workbook.Sheets[sIdx] : null);
          if (sheetProps && (sheetProps.Hidden === 1 || sheetProps.Hidden === 2 || Boolean(sheetProps.Hidden))) {
            return;
          }

          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) return;

          const aoa = getVisibleAoa(worksheet);
          if (aoa.length === 0) return;

          const initialPlatform = detectPlatform(file.name, []);
          const { idx: headerRowIdx, width } = detectHeaderRow(aoa);
          const headers: string[] = [];
          let rawDataRows: unknown[][];

          if (headerRowIdx === -1) {
            // Check if it matches standard 15-18 column Thai ERP/POS/Online Sales export (e.g. Facebook, Line, FlowAccount, Express)
            const sampleRows = aoa.slice(0, Math.min(20, aoa.length));
            let isStandard17 = false;
            if (width >= 15) {
              const col1Vals = sampleRows.map(r => Array.isArray(r) ? r[1] : undefined).filter(Boolean).map(String);
              const col2Vals = sampleRows.map(r => Array.isArray(r) ? r[2] : undefined).filter(Boolean);
              const hasDocCol1 = col1Vals.some(s => /^(IV|HS|RC|INV|SO|PO|DOC|PVD)\d+/i.test(s));
              const hasDateCol2 = col2Vals.some(isCellDateLike);
              const isFbOrLine = initialPlatform === "facebook" || initialPlatform === "line";
              if (hasDocCol1 || hasDateCol2 || isFbOrLine) {
                isStandard17 = true;
              }
            }

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
                if (c < standard17.length) headers.push(standard17[c]);
                else headers.push(`คอลัมน์ ${c + 1}`);
              }
            } else if (width === 9) {
              const col2Vals = sampleRows.map(r => Array.isArray(r) ? r[2] : undefined).filter(Boolean).map(String);
              const col3Vals = sampleRows.map(r => Array.isArray(r) ? r[3] : undefined).filter(Boolean);
              const hasDocCol2 = col2Vals.some(s => /^(IV|HS|RC|INV|SO|PO|DOC|PVD)\d+/i.test(s));
              const hasDateCol3 = col3Vals.some(isCellDateLike);
              if (hasDocCol2 || hasDateCol3) {
                headers.push(
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
                for (let c = 0; c < width; c++) headers.push(`คอลัมน์ ${c + 1}`);
              }
            } else {
              // Dynamic Smart Column Detection with uniqueness check
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
                  headers.push(getUniqueName(`คอลัมน์ ${c + 1}`));
                  continue;
                }

                const hasDate = colVals.some(isCellDateLike);
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
                  headers.push(getUniqueName("เลขที่เอกสาร / Invoice (Order ID / Invoice)"));
                } else if (hasOrderSn) {
                  headers.push(getUniqueName("หมายเลขคำสั่งซื้อ (Order ID / SN)"));
                } else if (hasDate) {
                  headers.push(getUniqueName("วันที่ (Date)"));
                } else if (hasSystemOrChannel) {
                  headers.push(getUniqueName("ระบบ / ช่องทาง / แบรนด์ (System / Brand)"));
                } else if (hasBranchCode) {
                  headers.push(getUniqueName("รหัสลูกค้า / สาขา (Customer / Branch Code)"));
                } else if (hasSku) {
                  headers.push(getUniqueName("รหัสสินค้า / SKU (SKU Reference)"));
                } else if (isUnitWord) {
                  headers.push(getUniqueName("หน่วย (Unit)"));
                } else if (hasThaiProductName) {
                  headers.push(getUniqueName("ชื่อสินค้า (Product Name)"));
                } else if (isDecimalMoney || (c === 0 && colVals.some(v => typeof v === "number" && v > 100))) {
                  headers.push(getUniqueName("ยอดเงิน / ราคาขาย (Amount / Net Sales)"));
                } else if (isSmallInteger && c === 0) {
                  headers.push(getUniqueName("ลำดับ (Seq)"));
                } else if (isSmallInteger && c === 1) {
                  headers.push(getUniqueName("ลำดับ / จำนวน (Quantity / Seq)"));
                } else if (isSmallInteger) {
                  headers.push(getUniqueName("จำนวน (Quantity)"));
                } else {
                  headers.push(getUniqueName(`คอลัมน์ ${c + 1}`));
                }
              }
            }
            rawDataRows = aoa;
          } else {
            const rawHeaders = aoa[headerRowIdx] || [];
            rawHeaders.forEach((h, index) => {
              const label = String(h).trim();
              if (label === "") {
                headers.push(`คอลัมน์ ${index + 1}`);
              } else {
                headers.push(label);
              }
            });
            rawDataRows = aoa.slice(headerRowIdx + 1);
          }

          if (headers.length === 0) return;

          // Check if sheet has order/transaction or income headers
          const cleanHeaders = headers.map(h => h.trim().toLowerCase());
          const hasOrderId = cleanHeaders.some(h => 
            ["order id", "รหัสคำสั่งซื้อ", "หมายเลขคำสั่งซื้อ", "เลขที่คำสั่งซื้อ", "เลขคำสั่งซื้อ", 
             "order no", "order number", "order_id", "id", "หมายเลขคำสั่งซื้อ/หมายเลขพัสดุ", 
             "หมายเลขคำสั่งซื้อ / หมายเลขพัสดุ", "ordernumber", "orderitemid", "order item id", 
             "orderitemno", "order item no", "order item no.", "statement number", "หมายเลขรายการสินค้า"].some(k => h === k.toLowerCase() || h.includes(k.toLowerCase()))
          );
          const hasIncomeOrFinancial = cleanHeaders.some(h =>
            ["statement number", "fee name", "paid status", "transaction", "amount", "ยอดเงิน", "รายรับ", "ค่าธรรมเนียม", "ยอดโอน", "รายได้", "net income", "payout", "settlement", "platform fee", "total", "price", "ราคา", "ยอดขาย"].some(k => h === k.toLowerCase() || h.includes(k.toLowerCase()))
          );
          
          const isDocOnlySheet = [
            "summary", "ภาพรวม", "overview", "บันทึกการถอน", "คำอธิบายค่าธรรมเนียม", "คำอธิบาย", "glossary", 
            "withdraw", "withdrawal", "คู่มือ", "คำแนะนำ", "instruction", "instructions", 
            "readme", "read me", "help", "template", "setting", "settings", 
            "config", "logs", "metadata", "filterdatabase", "toc", "table of contents"
          ].some(keyword => 
            sheetName.toLowerCase().includes(keyword)
          );

          const tempPlatform = detectPlatform(file.name, headers);
          const isFbOrLineHeaderless = headerRowIdx === -1 && (tempPlatform === "facebook" || tempPlatform === "line");

          // If workbook has multiple visible sheets and this sheet is pure documentation/summary without any order/income headers, skip it
          if (workbook.SheetNames.length > 1 && isDocOnlySheet && !hasOrderId && !hasIncomeOrFinancial && !isFbOrLineHeaderless && tempPlatform !== "lazada") {
            return;
          }

          // Detect platform and type using the first valid sheet
          if (!firstDetected) {
            detectedPlatformVal = detectPlatform(file.name, headers);
            detectedTypeVal = detectFileType(file.name, headers);
            firstDetected = true;
          }

          // For TikTok orders, skip the 2nd row (index 0 of data rows) if it is a description row
          if (detectedPlatformVal === "tiktok" && detectedTypeVal === "order" && rawDataRows.length > 0) {
            // Check if it's the description row (usually contains description text like "This row is description" or long sentences)
            // By specification: "ไฟล์ TikTok order แถวที่ 2 เป็นคำอธิบายคอลัมน์ (description row) ไม่ใช่ข้อมูลจริง ให้ข้ามแถวนี้เวลาแสดงตาราง"
            rawDataRows = rawDataRows.slice(1);
          }

          const rows: Record<string, unknown>[] = [];
          rawDataRows.forEach((r) => {
            // Skip empty rows
            if (!r || r.every(cell => cell === "")) return;

            const rowObj: Record<string, unknown> = {};
            headers.forEach((h, cIdx) => {
              let val = r[cIdx];
              if (val === undefined || val === null) {
                rowObj[h] = "";
              } else {
                // Formatting values slightly if needed, e.g. trimming strings
                if (typeof val === "string") {
                  val = val.trim();
                }
                rowObj[h] = val;
              }
            });
            rows.push(rowObj);
          });

          if (rows.length === 0) return;

          sheets.push({
            name: sheetName,
            headers,
            rows,
          });
        });

        if (sheets.length === 0) {
          reject(new Error("ไม่สามารถอ่านข้อมูลจากชีตใดๆ ในไฟล์ได้"));
          return;
        }

        resolve({
          id: `ds_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          fileName: file.name,
          platform: detectedPlatformVal,
          type: detectedTypeVal,
          sheets,
          uploadedAt: new Date().toLocaleString("th-TH"),
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => {
      reject(new Error("การอ่านไฟล์ล้มเหลว"));
    };

    reader.readAsArrayBuffer(file);
  });
};

const KEY_MAPS = {
  orderId: [
    "order id", "รหัสคำสั่งซื้อ", "หมายเลขคำสั่งซื้อ", "เลขที่คำสั่งซื้อ", "เลขคำสั่งซื้อ", 
    "order no", "order no.", "order number", "order_id", "id", "หมายเลขคำสั่งซื้อ/หมายเลขพัสดุ", 
    "หมายเลขคำสั่งซื้อ / หมายเลขพัสดุ", "ordernumber", "orderitemid", "order item id",
    "orderitemno", "order item no", "order item no.", "order line id", "orderlineid",
    "statement number", "statement number / order item no", "statement no", "statement no.", "statementnumber",
    "หมายเลขรายการสินค้า", "รหัสรายการสินค้า", "เลขออเดอร์", "รหัสรายการ", "หมายเลขคำสั่งซื้อ/การปรับ", "order adjustment id", "หมายเลขการปรับ", "adjustment id",
    "เลขที่เอกสาร / invoice (order id / invoice)", "หมายเลขคำสั่งซื้อ (order id / sn)", "หมายเลขคำสั่งซื้อ (order id)", "เลขที่เอกสาร", "invoice", "doc no"
  ],
  customerName: [
    "customer", "recipient", "buyer", "ชื่อลูกค้า", "ชื่อผู้รับ", "ผู้ซื้อ", 
    "ชื่อผู้ใช้ (ผู้ซื้อ)", "ชื่อผู้ใช้(ผู้ซื้อ)", "customer name", "recipient name", 
    "buyer name", "customer_name", "shippingname", "shipping name", "buyer username",
    "รหัสลูกค้า / สาขา (customer / branch code)", "ชื่อลูกค้า (customer name)"
  ],
  productName: [
    "product name", "item name", "product_name", "itemname",
    "ชื่อสินค้า", "รายละเอียดสินค้า", "ข้อมูลสินค้า", 
    "ชื่อรายละเอียดสินค้า", "ชื่อสินค้า/SKU", "ชื่อสินค้า/รายละเอียดสินค้า", 
    "product", "item", "สินค้า", "fee name", "details", "ชื่อค่าธรรมเนียม", "ประเภทรายการ",
    "seller sku", "lazada sku", "sku",
    "ชื่อสินค้า (product name)", "รหัสสินค้า / sku (sku reference)", "ชื่อสินค้า/sku"
  ],
  quantity: [
    "จำนวน", "quantity", "qty", "จำนวนสินค้า", "จำนวนชิ้น", "จำนวนที่ซื้อ", "จำนวนสินค้าที่ซื้อ", 
    "จำนวนสินค้าที่ซื้อในคำสั่งซื้อ", "จำนวนสั่งซื้อ", "จำนวนขาย", "qty sold", "quantity_sold",
    "item quantity", "sku quantity", "item_quantity", "ชิ้น", "จำนวน (ชิ้น)", "จำนวนชิ้นที่ซื้อ",
    "ลำดับ / จำนวน (quantity / seq)", "จำนวน (quantity)", "ลำดับ / จำนวน", "qty (pcs)", "จำนวน(ชิ้น)"
  ],
  total: [
    "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย", "ยอดรวมค่าสินค้า", "sku subtotal after discount",
    "รายได้ทั้งหมด", "รายได้รวม", "ยอดรวมค่าสินค้าก่อนหักส่วนลด",
    "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)", "ราคาสินค้าที่ชำระโดยผู้ซื้อ", "ราคาขายสุทธิ",
    "สินค้าราคาปกติ", "ราคาต่อหน่วยของ sku", "sku unit original price", "sku unit price",
    "ราคาต่อหน่วย", "ราคาต่อชิ้น", "ราคาขายต่อชิ้น", "ราคาขาย", "ราคาตั้งต้น", "ราคาสินค้า", "ราคาข้อตกลง",
    "paid price", "paidprice", "unit price", "unitprice", "item price", "itemprice", "deal price", "dealprice",
    "sku subtotal before discount", "sku subtotal", "ยอดรวมของคำสั่งซื้อ", "ยอดรวมคำสั่งซื้อ", "ยอดสั่งซื้อรวม",
    "total", "price", "amount paid", "revenue", "ยอดคำสั่งซื้อ", "ราคารวม", "ราคาสุทธิ", 
    "ยอดขาย", "ยอดขายรวม", "total payment", "total_price", "grand total", "รายรับรวม", 
    "ราคาลดแล้ว", "ราคาสินค้าทั้งหมดที่ต้องชำระ", "ยอดรวมสุทธิ", "order amount", "order_amount",
    "ราคารวมย่อยของ sku", "ราคารวมย่อย", "ยอดเงินรวม", "ยอดชำระ(บาท)", "จำนวนเงิน(รวมภาษี)",
    "จำนวนเงิน (รวมภาษี)", "amount", "amount(include tax)", "amount (include tax)", "amount (thb)",
    "amount(thb)", "ยอดเงินตามคำสั่งซื้อ",
    "ยอดเงิน / ราคาขาย (amount / net sales)", "ยอดขายรวม / รายรับสุทธิ (gross sales / net income)"
  ],
  brand: [
    "brand", "แบรนด์สินค้า", "แบรนด์", "ยี่ห้อ", "product_brand", "Brand", "Brand Name",
    "ระบบ / ช่องทาง / แบรนด์ (system / brand)", "ระบบ/ช่องทาง (system)"
  ],
  date: [
    "date", "time", "created", "วันที่", "เวลา", "order date", "created date", 
    "created_time", "order_time", "วันที่โอนเงินสำเร็จ", "วันที่โอนเงิน", 
    "เวลาการโอนเงินสำเร็จ", "วันที่โอน", "เวลาสั่งซื้อ", "เวลาที่ทำการสั่งซื้อ", 
    "วันที่สั่งซื้อ", "เวลาชำระเงิน", "createtime", "create time", "created time", 
    "created_time", "paid time", "paid_time", "เวลาที่ชำระคำสั่งซื้อ", "เวลาที่สร้างคำสั่งซื้อ",
    "วันที่ทำการสั่งซื้อ", "เวลาที่ทำการสั่งซื้อสำเร็จ", "วันที่โอนชำระเงินสำเร็จ",
    "transaction date", "transaction_date", "transactiondate", "วันที่ทำรายการ",
    "order creation date", "statement date", "วันที่ (date)"
  ],
  shippingFee: [
    "shipping fee", "shipping", "ค่าจัดส่ง", "ค่าส่ง", "ค่าจัดส่งที่ชำระโดยผู้ซื้อ", 
    "ค่าขนส่งที่ชำระโดยผู้ซื้อ", "shipping_fee", "ค่าขนส่ง", "shipping cost", 
    "shippingfee", "shipping fee after discount", "original shipping fee",
    "ค่าจัดส่งที่ shopee ชำระโดยชื่อของคุณ", "ค่าจัดส่งที่shopeeชำระโดยชื่อของคุณ", "tiktok shop shipping fee", "ค่าจัดส่ง tiktok shop", "ค่าจัดส่งจริง", "ค่าธรรมเนียมการจัดส่งจริง"
  ],
  platformFee: [
    "ค่าธรรมเนียมทั้งหมด", "ค่าบริการและค่าธรรมเนียมทั้งหมด", "ค่าธรรมเนียมรวม", "รวมค่าธรรมเนียม", "total fee", "total fees",
    "platform fee", "fee", "ค่าบริการ", "ค่าธรรมเนียม", "ค่าธรรมเนียมการบริการ", 
    "ค่าธรรมเนียมการทำธุรกรรม", "ค่าคอมมิชชัน", "ค่าคอมมิชชั่น", "commission", "service fee", 
    "platform_fee", "ค่าธรรมเนียมธุรกรรม", "ค่าบริการขาย", 
    "ค่าธรรมเนียมการทำธุรกรรม (ธุรกรรม)", "ค่าธรรมเนียมการทำธุรกรรม(ธุรกรรม)",
    "transaction fee", "transactionfee", "ค่าธรรมเนียมคำสั่งซื้อ", "fee name",
    "ค่าคอมมิชชั่น tiktok shop", "ค่าธรรมเนียมโครงสร้างพื้นฐานแพลตฟอร์ม", "ค่าธรรมเนียมการทำธุรกรรม tiktok shop", "ค่าคอมมิชชั่นของ tiktok", "ค่าธรรมเนียมธุรกรรมของ tiktok", "tiktok shop commission fee", "tiktok shop transaction fee",
    "ค่าธรรมเนียมสนับสนุนการเติบโตของร้านค้า", "ค่าธรรมเนียมโครงสร้างพื้นฐาน", "ค่าคอมมิชชั่นไม่ใช่แอฟฟิลิเอตก่อนหักภาษีเงินได้บุคคลธรรมดา", "ค่าคอมมิชชั่นแอฟฟิลิเอต"
  ],
  netIncome: [
    "จำนวนเงินที่ชำระทั้งหมด", "ยอดการชำระเงินทั้งหมด", "ยอดชำระเงินทั้งหมด", "ยอดโอนสุทธิ", "ยอดโอนเงินสุทธิ", "ยอดเงินโอนสุทธิ", "ยอดรับสุทธิ",
    "net income", "net", "payout", "settlement amount", "total settlement amount", "รายรับสุทธิ", "ยอดเงินโอน", "รายได้สุทธิ", "รายรับ", 
    "ยอดชำระสุทธิ", "จำนวนเงินทั้งหมดที่โอนแล้ว (฿)", "จำนวนเงินทั้งหมดที่โอนแล้ว",
    "จำนวนเงิน(รวมภาษี)", "จำนวนเงิน (รวมภาษี)", "amount (inc. vat)", "amount (incl. vat)", "amount(inc.vat)",
    "ยอดโอน", "จำนวนเงินที่โอน", "เงินโอน", "net_income", "net_amount", "ยอดเงินสุทธิ", "ยอดเงินที่ชำระให้ผู้ขาย", "seller payout"
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

const parseNumber = (val: unknown): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const s = String(val).trim();
  if (s === "") return 0;
  // If string contains alphanumeric IDs (like Order ID '2605018H6WWYGE' or SKU), it is NOT a valid number
  const withoutCurrency = s.replace(/[฿$%\s]|บาท|THB|thb/gi, "");
  if (!/^[-+]?[\d,]*\.?\d+$/.test(withoutCurrency)) {
    return 0;
  }
  const clean = withoutCurrency.replace(/,/g, "");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

// Global WeakMap cache for converted orders from datasets to avoid heavy re-parsing
const datasetOrdersCache = new WeakMap<UploadedDataset, Order[]>();

export const convertDatasetToOrders = (dataset: UploadedDataset): Order[] => {
  if (!dataset) return [];
  if (datasetOrdersCache.has(dataset)) {
    return datasetOrdersCache.get(dataset)!;
  }

  const orders: Order[] = [];
  const isIncome = dataset.type === "income" || dataset.fileType === "income";
  const resolvedPlatform = (dataset.platform && dataset.platform !== "unknown")
    ? dataset.platform
    : detectPlatform(dataset.fileName, dataset.sheets?.[0]?.headers || []);

  dataset.sheets.forEach((sheet) => {
    const headers = sheet.headers;

    const findHeaderKey = (keywords: string[], blacklist: string[] = []): string | undefined => {
      const normalizedHeaders = headers.map(h => String(h || "").trim().toLowerCase());
      const cleanHeaders = normalizedHeaders.map(h => h.replace(/[^a-z0-9\u0E00-\u0E7F]/gi, ""));

      // 1. Exact match
      for (let i = 0; i < normalizedHeaders.length; i++) {
        const nh = normalizedHeaders[i];
        if (blacklist.some(b => nh.includes(b.toLowerCase()))) continue;
        if (keywords.some(k => nh === k.toLowerCase().trim())) {
          return headers[i];
        }
      }

      // 2. Cleaned exact match
      for (let i = 0; i < cleanHeaders.length; i++) {
        const ch = cleanHeaders[i];
        if (blacklist.some(b => normalizedHeaders[i].includes(b.toLowerCase()))) continue;
        if (ch && keywords.some(k => ch === k.replace(/[^a-z0-9\u0E00-\u0E7F]/gi, "").toLowerCase())) {
          return headers[i];
        }
      }

      // 3. Partial match
      const stopWords = new Set(["สินค้า", "ส่ง", "fee", "id", "จำนวน", "amount", "เวลา", "date", "ชำระ", "ยอด", "ราคา"]);
      for (let i = 0; i < normalizedHeaders.length; i++) {
        const h = normalizedHeaders[i];
        if (blacklist.some(b => h.includes(b.toLowerCase()))) continue;
        const match = keywords.some(k => {
          const cleanK = k.toLowerCase().trim();
          if (stopWords.has(cleanK) || cleanK.length < 3) return false;
          return h.includes(cleanK);
        });
        if (match) return headers[i];
      }

      return undefined;
    };

    const priceBlacklist = [
      "seller sku", "parent sku", "sku id", "lazada sku", "รหัส sku", "เลขอ้างอิง sku", "เลขอ้างอิง parent sku", "sku reference",
      "order id", "order no", "order no.", "order number", "tracking", "พัสดุ", "phone", "เบอร์โทร", "โทร", "zip", "postcode", "รหัสไปรษณีย์", "ไปรษณีย์",
      "coins", "cashback", "shipping fee", "ค่าจัดส่ง", "จำนวน", "qty", "quantity", "วันที่", "เวลา", "date", "time", "สถานะ", "status",
      "customer name", "buyer name", "recipient name", "ชื่อลูกค้า", "ชื่อผู้ซื้อ", "ชื่อผู้รับ", "ชื่อผู้ใช้", "รหัสลูกค้า", "ที่อยู่", "address", "shipping address",
      "หมายเลขคำสั่งซื้อ", "รหัสคำสั่งซื้อ"
    ];

    let keyId = findHeaderKey(KEY_MAPS.orderId);
    let keyCust = findHeaderKey(KEY_MAPS.customerName, ["id", "price", "sku", "fee", "order"]);
    let keyProd = findHeaderKey(KEY_MAPS.productName, ["customer", "buyer", "recipient", "ผู้ซื้อ", "ลูกค้า", "ผู้รับ", "order", "status", "phone", "email", "address", "ที่อยู่", "fee", "ค่าธรรมเนียม"]);
    let keyQty = findHeaderKey(KEY_MAPS.quantity, ["price", "ราคา", "ยอด", "amount", "total", "fee", "ค่า", "เงิน", "parent", "sku", "order", "รหัส", "หมายเลข"]);
    let keyTotal = findHeaderKey(KEY_MAPS.total, priceBlacklist);
    let keyDate = findHeaderKey(KEY_MAPS.date, ["id", "no", "code", "sku", "item", "product", "price", "amount", "fee", "total", "ยอด", "เลข", "รหัส", "สินค้า", "ราคา"]);
    const keyShip = findHeaderKey(KEY_MAPS.shippingFee);
    const keyPlat = findHeaderKey(KEY_MAPS.platformFee);
    let keyNet = findHeaderKey(KEY_MAPS.netIncome, priceBlacklist);
    const keyStatus = findHeaderKey(KEY_MAPS.status);
    const keyBrand = findHeaderKey(KEY_MAPS.brand, ["status", "สถานะ", "เหตุผล"]);

    // Platform-specific and universal robust column overrides
    const directPriceCol = headers.find(h => {
      const hl = h.toLowerCase().trim();
      // 1. TikTok item subtotal after discount
      if (hl.includes("sku subtotal after discount") || hl === "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย") return true;
      // 2. Shopee deal price / buyer paid price / subtotal
      if (hl.includes("ราคาสินค้าที่ชำระโดยผู้ซื้อ") || hl === "ราคาขายสุทธิ" || hl === "ยอดรวมค่าสินค้า") return true;
      // 3. Lazada paid price / unit price
      const norm = hl.replace(/[\s_]/g, "");
      if (norm === "paidprice" || norm === "unitprice" || norm === "itemprice" || norm.includes("paidprice")) return true;
      // 4. TikTok subtotal before discount / original unit price
      if (hl.includes("sku subtotal before discount") || hl.includes("sku subtotal") || hl.includes("sku unit original price") || hl.includes("sku unit price")) return true;
      // 5. General item unit price / original price
      if (hl.includes("สินค้าราคาปกติ") || hl.includes("ราคาต่อหน่วยของ sku") || hl.includes("ราคาต่อหน่วย") || hl.includes("ราคาต่อชิ้น") || hl === "ราคาขาย" || hl === "ราคาตั้งต้น" || hl === "ราคาสินค้า") return true;
      // 6. Order level total fallback
      if (hl.includes("ยอดรวมของคำสั่งซื้อ") || hl.includes("ยอดรวมคำสั่งซื้อ") || hl.includes("ยอดคำสั่งซื้อ") || hl === "order amount" || hl === "order_amount" || hl === "total amount" || hl === "total payment" || hl === "ยอดขายรวม") return true;
      return false;
    });

    if (directPriceCol) {
      keyTotal = directPriceCol;
    }

    // Headerless check for Facebook/LINE OA files
    if (resolvedPlatform === "facebook" || resolvedPlatform === "line") {
      const isHeaderlessOrBilingual = headers.some(h => h.startsWith("คอลัมน์") || h === "หมายเลขคำสั่งซื้อ (Order ID)");
      if (isHeaderlessOrBilingual && headers.length >= 10) {
        keyId = headers[1];    // คอลัมน์ 2 (Order ID)
        keyDate = headers[2];  // คอลัมน์ 3 (Date)
        keyCust = headers[6];  // คอลัมน์ 7 (Customer Name)
        keyProd = headers[8];  // คอลัมน์ 9 (Product Name)
        keyQty = headers[9];   // คอลัมน์ 10 (Quantity)
        keyTotal = headers[16]; // คอลัมน์ 17 (Total)
        keyNet = headers[16];  // คอลัมน์ 17 (Net)
      }
    }

    if (!keyId && resolvedPlatform !== "lazada") {
      keyId = headers.find(h => {
        const hl = h.toLowerCase();
        return hl.includes("order") || hl.includes("เลข") || hl.includes("id") || hl.includes("invoice") || hl.includes("รหัส");
      }) || headers[0];
    }
    if (!keyId && resolvedPlatform !== "lazada") return;

    // Specific processing for Lazada Income Statement datasets
    if (resolvedPlatform === "lazada" && isIncome) {
      const lazadaOrdersMap = new Map<string, {
        orderId: string;
        customerName: string;
        productName: string;
        brand: string;
        date: string;
        quantity: number;
        total: number;
        platformFee: number;
        shippingFee: number;
        netIncome: number;
        status: "Paid" | "Pending" | "Refunded";
        sheetRowIndices: number[];
      }>();

      const nonOrderFees: Order[] = [];

      sheet.rows.forEach((row, rowIdx) => {
        const rawId = (keyId && row[keyId]) || row["หมายเลขคำสั่งซื้อ"] || row["Order No"] || row["Order ID"] || row["รหัสสินค้าในคำสั่งซื้อ"];
        const orderId = rawId !== null && rawId !== undefined ? String(rawId).trim() : "";
        const txName = String((keyProd && row[keyProd]) || row["ชื่อรายการธุรกรรม"] || row["Fee Name"] || "").trim();
        const prodNameVal = String(row["ชื่อสินค้า"] || row["Product Name"] || row["Item Name"] || (txName && !txName.includes("ค่าธรรมเนียม") && !txName.includes("ยอดรวมค่าสินค้า") ? txName : "")).trim() || "สินค้า Lazada";
        
        const rawAmount = keyTotal && row[keyTotal] !== undefined ? parseNumber(row[keyTotal]) : (keyNet && row[keyNet] !== undefined ? parseNumber(row[keyNet]) : 0);

        const rawDate = (keyDate && row[keyDate]) || row["วันที่ทำรายการ"] || row["วันที่สร้างคำสั่งซื้อ"] || row["Transaction Date"] || row["Statement Date"];
        const dateStr = rawDate ? parseAndNormalizeDate(rawDate) : parseAndNormalizeDate(new Date());

        const isRefundTx = txName.includes("คืนสินค้า") || txName.includes("หักเงินค่าสินค้า") || txName.includes("Reversal") || txName.includes("Refund");

        if (orderId) {
          if (!lazadaOrdersMap.has(orderId)) {
            lazadaOrdersMap.set(orderId, {
              orderId,
              customerName: keyCust && row[keyCust] ? String(row[keyCust]).trim() : "ลูกค้า Lazada",
              productName: prodNameVal,
              brand: detectBrand(row, prodNameVal),
              date: dateStr,
              quantity: keyQty && row[keyQty] !== undefined ? Math.max(1, Math.round(parseNumber(row[keyQty]))) : 1,
              total: 0,
              platformFee: 0,
              shippingFee: 0,
              netIncome: 0,
              status: isRefundTx ? "Refunded" : "Paid",
              sheetRowIndices: [rowIdx],
            });
          }

          const existing = lazadaOrdersMap.get(orderId)!;
          existing.sheetRowIndices.push(rowIdx);
          if (dateStr && !existing.date) existing.date = dateStr;
          if (prodNameVal && (existing.productName === "สินค้า Lazada" || !existing.productName)) {
            existing.productName = prodNameVal;
            existing.brand = detectBrand(row, prodNameVal);
          }
          if (isRefundTx) {
            existing.status = "Refunded";
          }

          const isFeeRebate = txName.startsWith("คืน") || txName.startsWith("Reverse") || txName.includes("คืนส่วนลด") || txName.includes("คืนค่าธรรมเนียม");
          const isShipping = txName.includes("จัดส่ง") || txName.includes("shipping") || txName.includes("ค่าส่ง");

          if (rawAmount > 0) {
            if (isFeeRebate) {
              existing.platformFee -= rawAmount;
              existing.netIncome += rawAmount;
            } else {
              // Gross sales / Item credit
              existing.total += rawAmount;
              existing.netIncome += rawAmount;
            }
          } else {
            const absVal = Math.abs(rawAmount);
            if (isShipping) {
              existing.shippingFee += absVal;
            } else if (isRefundTx) {
              existing.total = Math.max(0, existing.total - absVal);
            } else {
              existing.platformFee += absVal;
            }
            existing.netIncome += rawAmount; // subtracts negative fee
          }
        } else {
          // General account level fee without specific orderId
          const absVal = Math.abs(rawAmount);
          nonOrderFees.push({
            id: `lazada-fee-${rowIdx}`,
            customerName: "Lazada Platform",
            email: "lazada@example.com",
            productName: txName || "ค่าธรรมเนียมบริการ Lazada",
            brand: "Lazada",
            channel: "Lazada",
            total: rawAmount > 0 ? rawAmount : 0,
            quantity: 1,
            status: "Paid",
            date: dateStr,
            shippingFee: 0,
            platformFee: absVal,
            netIncome: rawAmount,
            isIncome: true,
            datasetId: dataset.id,
            sheetName: sheet.name,
            sheetRowIndices: [rowIdx],
          });
        }
      });

      lazadaOrdersMap.forEach((agg, oId) => {
        if (agg.total === 0 && agg.netIncome > 0) {
          agg.total = agg.netIncome + agg.platformFee + agg.shippingFee;
        }
        if (agg.total === 0 && agg.status === "Refunded") {
          agg.total = Math.abs(agg.netIncome);
        }

        orders.push({
          id: `${oId}-lazada`,
          customerName: agg.customerName,
          email: `${agg.customerName.toLowerCase().replace(/[^a-zA-Z0-9]/g, "")}@example.com`,
          productName: agg.productName,
          brand: agg.brand || "ทั่วไป",
          channel: "Lazada",
          total: Math.round(agg.total * 100) / 100,
          quantity: agg.quantity,
          status: agg.status,
          date: agg.date,
          shippingFee: Math.round(agg.shippingFee * 100) / 100,
          platformFee: Math.round(agg.platformFee * 100) / 100,
          netIncome: Math.round(agg.netIncome * 100) / 100,
          isIncome: true,
          datasetId: dataset.id,
          sheetName: sheet.name,
          sheetRowIndices: agg.sheetRowIndices,
        });
      });

      orders.push(...nonOrderFees);
      return;
    }

    if (!keyId) return;

    // Temporary storage for shipping fees by orderId (for Facebook/Line)
    const shippingFeesMap = new Map<string, number>();
    // Temporary storage for created product orders (for Facebook/Line)
    const createdOrdersMap = new Map<string, Order[]>();

    sheet.rows.forEach((row, rowIdx) => {
      const rawId = row[keyId];
      if (rawId === null || rawId === undefined || String(rawId).trim() === "") return;

      const orderId = String(rawId).trim();
      const isFbOrLine = dataset.platform === "facebook" || dataset.platform === "line";
      
      // Determine if this is a shipping row
      const prodNameVal = keyProd && row[keyProd] ? String(row[keyProd]).trim() : "";
      const skuVal = headers[5] ? String(row[headers[5]] ?? "").trim() : "";
      const isShippingRow = isFbOrLine && (prodNameVal === "ค่าขนส่ง" || skuVal === "PVD-004");

      let customerName = keyCust && row[keyCust] ? String(row[keyCust]).trim() : "ลูกค้าทั่วไป";
      if (customerName.includes("/")) {
        const parts = customerName.split("/");
        customerName = parts[parts.length - 1].trim() || customerName;
      }

      let productName = prodNameVal || (isIncome ? "รายการรายรับบัญชี" : "ไม่ระบุสินค้า");
      if (dataset.platform === "tiktok" && isIncome && (productName === "/" || productName.includes("*") || productName === "-" || productName === "รายการรายรับบัญชี")) {
        productName = "รายการสินค้า TikTok Shop";
      }

      let quantity = keyQty && row[keyQty] !== undefined ? Math.max(1, Math.round(parseNumber(row[keyQty]))) : 1;
      if (quantity === 1 && !keyQty) {
        const qtyKey = Object.keys(row).find(k => {
          const lk = k.trim().toLowerCase();
          return lk === "จำนวน" || lk === "quantity" || lk === "qty";
        });
        if (qtyKey && row[qtyKey] !== undefined) {
          const q = parseNumber(row[qtyKey]);
          if (q > 0) quantity = Math.max(1, Math.round(q));
        }
      }
      
      const isUnitPriceHeader = (colName?: string): boolean => {
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

      let totalVal = keyTotal && row[keyTotal] !== undefined ? parseNumber(row[keyTotal]) : 0;
      if (totalVal === 0) {
        const fallbackKeys = [
          "sku subtotal after discount",
          "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย",
          "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)",
          "ราคาสินค้าที่ชำระโดยผู้ซื้อ",
          "ราคาขายสุทธิ",
          "paidprice",
          "paid price",
          "unitprice",
          "unit price",
          "itemprice",
          "item price",
          "sku subtotal before discount",
          "sku subtotal",
          "sku unit original price",
          "sku unit price",
          "สินค้าราคาปกติ",
          "ราคาต่อหน่วยของ sku",
          "ราคาต่อหน่วย",
          "ราคาต่อชิ้น",
          "ราคาขายต่อชิ้น",
          "ราคาขาย",
          "ราคาตั้งต้น",
          "ราคาสินค้า",
          "ราคาข้อตกลง",
          "deal price",
          "dealprice",
          "ยอดรวมค่าสินค้า",
          "order amount",
          "order_amount",
          "ยอดรวมของคำสั่งซื้อ",
          "ยอดรวมคำสั่งซื้อ",
          "ยอดคำสั่งซื้อ",
          "ยอดขายรวม",
          "ยอดขาย",
          "ราคารวม",
          "ราคาสุทธิ",
          "total",
          "amount"
        ];
        for (const fk of fallbackKeys) {
          const matchedKey = Object.keys(row).find(k => {
            const lk = k.trim().toLowerCase();
            return lk === fk || lk.includes(fk);
          });
          if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && row[matchedKey] !== "") {
            const p = parseNumber(row[matchedKey]);
            if (p > 0 && p <= 50000) {
              totalVal = p;
              if (isUnitPriceHeader(matchedKey) && quantity > 1) {
                totalVal = p * quantity;
              }
              break;
            }
          }
        }
      }

      if (isShippingRow) {
        const currentFee = shippingFeesMap.get(orderId) || 0;
        shippingFeesMap.set(orderId, currentFee + Math.abs(totalVal));

        // If we already created orders for this orderId, update their shipping fee
        const existingOrders = createdOrdersMap.get(orderId);
        if (existingOrders && existingOrders.length > 0) {
          existingOrders[0].shippingFee = (existingOrders[0].shippingFee || 0) + Math.abs(totalVal);
          if (!keyNet) {
            existingOrders[0].netIncome = Math.max(
              0,
              (existingOrders[0].total ?? 0) -
                (existingOrders[0].platformFee ?? 0) -
                (existingOrders[0].shippingFee ?? 0)
            );
          }
        }
        return; // Skip creating a separate order item for the shipping row itself
      }

      let total = totalVal;
      if (!isIncome && quantity > 1 && totalVal > 0 && (isUnitPriceHeader(keyTotal) || keyTotal === keyProd)) {
        total = totalVal * quantity;
      }
      if (!isIncome && total / quantity > 50000) {
        total = 0;
      }
      
      // For FB/Line, get initial shipping fee if already registered in shippingFeesMap
      const registeredShippingFee = isFbOrLine ? (shippingFeesMap.get(orderId) || 0) : 0;
      if (isFbOrLine && registeredShippingFee > 0) {
        shippingFeesMap.set(orderId, 0); // Reset so other items in same order don't duplicate it
      }

      const shippingFee = isFbOrLine ? registeredShippingFee : (keyShip && row[keyShip] !== undefined ? Math.abs(parseNumber(row[keyShip])) : 0);
      const platformFee = keyPlat && row[keyPlat] !== undefined ? Math.abs(parseNumber(row[keyPlat])) : 0;
      let netIncome = keyNet && row[keyNet] !== undefined ? parseNumber(row[keyNet]) : 0;

      // Fallback calculations
      if (isIncome) {
        if (!keyNet && keyTotal) {
          netIncome = total - shippingFee - platformFee;
        } else if (keyNet && (!keyTotal || total === 0)) {
          total = netIncome + platformFee + shippingFee;
        }
      } else {
        if (!keyNet) {
          netIncome = Math.max(0, total - platformFee - shippingFee);
        }
      }

      const dateStr = keyDate ? parseAndNormalizeDate(row[keyDate]) : parseAndNormalizeDate(new Date());

      let rowStatus: "Paid" | "Pending" | "Refunded" = "Paid";
      let isCancelled = false;
      let isReturnRefund = false;
      let detectedCancelReason = "";

      const isIgnoredOrEmptyValue = (valStr: string): boolean => {
        if (!valStr) return true;
        const s = valStr.trim().toLowerCase();
        return (
          s === "" ||
          s === "-" ||
          s === "--" ||
          s === "0" ||
          s === "0.00" ||
          s === "thb 0" ||
          s === "thb 0.00" ||
          s === "฿0" ||
          s === "฿0.00" ||
          s === "n/a" ||
          s === "na" ||
          s === "none" ||
          s === "null" ||
          s === "ไม่มี" ||
          s === "ไม่ใช่" ||
          s === "ปกติ" ||
          s === "no" ||
          s === "false" ||
          s === "0%"
        );
      };

      // 1. Comprehensive Check for Cancellation in row fields and headers
      const rowEntries = Object.entries(row);
      for (const [k, v] of rowEntries) {
        if (v === null || v === undefined || v === "") continue;
        const kLower = k.trim().toLowerCase();
        const vStr = String(v).trim().toLowerCase();
        if (isIgnoredOrEmptyValue(vStr)) continue;

        const isCancelKey =
          kLower.includes("cancel") ||
          kLower.includes("ยกเลิก") ||
          kLower.includes("cancellation");

        const hasCancelValue =
          vStr.includes("cancel") ||
          vStr.includes("ยกเลิก") ||
          vStr.includes("ถูกยกเลิก") ||
          vStr.includes("ผู้ซื้อยกเลิก") ||
          vStr.includes("ผู้ขายยกเลิก") ||
          vStr.includes("ระบบยกเลิก");

        if (
          hasCancelValue ||
          (isCancelKey && !vStr.includes("success") && !vStr.includes("สำเร็จ") && !vStr.includes("paid") && !vStr.includes("completed") && !vStr.includes("delivered") && !vStr.includes("shipped"))
        ) {
          isCancelled = true;
          isReturnRefund = false;
          rowStatus = "Refunded";
          if (!detectedCancelReason) {
            detectedCancelReason = String(v).trim();
          }
          break;
        }
      }

      // 2. Check for Returns / Refunds if not cancelled
      if (!isCancelled) {
        for (const [k, v] of rowEntries) {
          if (v === null || v === undefined || v === "") continue;
          const kLower = k.trim().toLowerCase();
          const vStr = String(v).trim().toLowerCase();
          if (isIgnoredOrEmptyValue(vStr)) continue;

          const isRefundKey =
            kLower.includes("refund") ||
            kLower.includes("คืนเงิน") ||
            kLower.includes("return") ||
            kLower.includes("คืนสินค้า");

          const hasRefundValue =
            vStr.includes("refund") ||
            vStr.includes("คืนเงิน") ||
            vStr.includes("return") ||
            vStr.includes("คืนสินค้า") ||
            vStr.includes("สินค้าถูกคืน") ||
            vStr.includes("ส่งคืน") ||
            vStr.includes("ตีกลับ") ||
            vStr.includes("ล้มเหลว") ||
            vStr.includes("failed");

          if (
            hasRefundValue ||
            (isRefundKey && (kLower.includes("reason") || kLower.includes("เหตุผล") || kLower.includes("type") || kLower.includes("ประเภท")) && !vStr.includes("success") && !vStr.includes("สำเร็จ") && !vStr.includes("paid"))
          ) {
            isReturnRefund = true;
            rowStatus = "Refunded";
            break;
          }
        }
      }

      // Check standard status column if rowStatus is still undetermined
      if (keyStatus && row[keyStatus] !== undefined && row[keyStatus] !== null && String(row[keyStatus]).trim() !== "") {
        const rawStatusStr = String(row[keyStatus]).toLowerCase();
        if (
          rawStatusStr.includes("cancel") ||
          rawStatusStr.includes("ยกเลิก") ||
          rawStatusStr.includes("ถูกยกเลิก")
        ) {
          isCancelled = true;
          isReturnRefund = false;
          rowStatus = "Refunded";
        } else if (
          rawStatusStr.includes("refund") ||
          rawStatusStr.includes("คืนเงิน") ||
          rawStatusStr.includes("return") ||
          rawStatusStr.includes("คืนสินค้า") ||
          rawStatusStr.includes("ส่งคืน")
        ) {
          if (!isCancelled) {
            isReturnRefund = true;
            rowStatus = "Refunded";
          }
        } else {
          if (!isCancelled && !isReturnRefund) {
            rowStatus = parseOrderStatus(row[keyStatus]);
          }
        }
      }

      // 3. For Cancelled Orders or Orders where total is 0: recover original order / SKU price
      if (isCancelled || total === 0 || totalVal === 0) {
        const originalPriceKeys = [
          "order amount", "order_amount", "ยอดรวมคำสั่งซื้อ", "ยอดคำสั่งซื้อ", "ยอดรวมของคำสั่งซื้อ",
          "sku subtotal before discount", "ราคารวมย่อยของ sku ก่อนหักส่วนลด",
          "sku unit original price", "ราคาต่อหน่วยของ sku เดิม", "สินค้าราคาปกติ",
          "sku unit price", "ราคาต่อหน่วยของ sku", "ราคาต่อหน่วย", "ราคาต่อชิ้น",
          "ราคาขายต่อชิ้น", "ราคาขาย", "ราคาตั้งต้น", "ราคาสินค้า", "deal price",
          "dealprice", "unit price", "unitprice", "item price", "itemprice",
          "paid price", "paidprice", "total", "amount", "ราคาข้อตกลง"
        ];
        for (const opk of originalPriceKeys) {
          const matched = Object.keys(row).find(
            (k) => k.trim().toLowerCase() === opk || k.trim().toLowerCase().includes(opk)
          );
          if (matched && row[matched] !== undefined && row[matched] !== null && row[matched] !== "") {
            const p = parseNumber(row[matched]);
            if (p > 0 && p <= 50000) {
              total = isUnitPriceHeader(matched) && quantity > 1 ? p * quantity : p;
              break;
            }
          }
        }
      }

      if (total < 0 || netIncome < 0 || (orderId && orderId.startsWith("SR"))) {
        rowStatus = "Refunded";
        if (!isCancelled) isReturnRefund = true;
      }

      if (rowStatus === "Refunded" && !isCancelled && !isReturnRefund) {
        isReturnRefund = true;
      }

      const rawBrandVal = keyBrand && row[keyBrand] ? String(row[keyBrand]).trim() : "";
      const order: Order = {
        id: `${orderId}-row-${rowIdx}`, // Use unique ID
        customerName,
        email: `${customerName.toLowerCase().replace(/[^a-zA-Z0-9]/g, "")}@example.com`,
        productName,
        brand: resolveBrandName(rawBrandVal, productName, row),
        channel: dataset.platform === "lazada" ? "Lazada"
                 : dataset.platform === "shopee" ? "Shopee"
                 : dataset.platform === "tiktok" ? "TikTok Shop"
                 : dataset.platform === "facebook" ? "Facebook"
                 : dataset.platform === "line" ? "LINE OA"
                 : (() => {
                     const rStr = JSON.stringify(row).toLowerCase();
                     if (rStr.includes("shopee") || rStr.includes("ช็อปปี้") || rStr.includes("ช้อปปี้")) return "Shopee";
                     if (rStr.includes("tiktok") || rStr.includes("ติ๊กต๊อก") || rStr.includes("ติ๊กตอก")) return "TikTok Shop";
                     if (rStr.includes("lazada") || rStr.includes("ลาซาด้า")) return "Lazada";
                     if (rStr.includes("facebook") || rStr.includes("เฟส") || rStr.includes("เฟซ")) return "Facebook";
                     if (rStr.includes("line") || rStr.includes("ไลน์")) return "LINE OA";
                     return "อื่นๆ";
                   })(),
        total: Math.round(total * 100) / 100,
        quantity,
        status: rowStatus,
        isCancelled,
        isReturnRefund,
        cancelReason: detectedCancelReason || undefined,
        date: dateStr,
        shippingFee: Math.round(shippingFee * 100) / 100,
        platformFee: Math.round(platformFee * 100) / 100,
        netIncome: Math.round((!isIncome && rowStatus === "Refunded" && netIncome > 0 ? 0 : netIncome) * 100) / 100,
        isIncome,
        datasetId: dataset.id,
        sheetName: sheet.name,
        sheetRowIndices: [rowIdx],
      };

      orders.push(order);

      // Register created order
      if (isFbOrLine) {
        if (!createdOrdersMap.has(orderId)) {
          createdOrdersMap.set(orderId, []);
        }
        createdOrdersMap.get(orderId)!.push(order);
      }
    });
  });

  datasetOrdersCache.set(dataset, orders);
  return orders;
};

export const reevaluateOrdersStatus = (orders: Order[], uploadedDatasets: UploadedDataset[]): Order[] => {
  if (!uploadedDatasets || uploadedDatasets.length === 0 || !orders || orders.length === 0) return orders;
  
  const datasetOrders = uploadedDatasets.flatMap((ds) => convertDatasetToOrders(ds));
  if (datasetOrders.length === 0) return orders;

  const datasetOrderMap = new Map<string, Order>();
  const datasetOrderNumMap = new Map<string, Order>();
  datasetOrders.forEach((o) => {
    datasetOrderMap.set(o.id, o);
    const cleanNum = (o.orderNumber || o.id.split("-row-")[0]).toLowerCase().trim();
    if (cleanNum) {
      datasetOrderNumMap.set(cleanNum, o);
    }
  });

  let modified = false;
  const updatedOrders = orders.map((o) => {
    const cleanNum = (o.orderNumber || o.id.split("-row-")[0]).toLowerCase().trim();
    const match = datasetOrderMap.get(o.id) || datasetOrderNumMap.get(cleanNum);
    if (match) {
      if (
        match.status !== o.status ||
        match.isCancelled !== o.isCancelled ||
        match.isReturnRefund !== o.isReturnRefund ||
        (o.channel === "Lazada" && (o.total !== match.total || o.platformFee !== match.platformFee || o.netIncome !== match.netIncome))
      ) {
        modified = true;
        return {
          ...o,
          status: match.status,
          isCancelled: match.isCancelled,
          isReturnRefund: match.isReturnRefund,
          cancelReason: match.cancelReason,
          total: match.total,
          platformFee: match.platformFee,
          shippingFee: match.shippingFee,
          netIncome: match.netIncome,
        };
      }
    }
    return o;
  });

  return modified ? updatedOrders : orders;
};
