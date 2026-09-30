const XLSX = require('xlsx');
const fs = require('fs');

const KEY_MAPS = {
  orderId: [
    "order id", "รหัสคำสั่งซื้อ", "หมายเลขคำสั่งซื้อ", "เลขที่คำสั่งซื้อ", "เลขคำสั่งซื้อ", 
    "order no", "order number", "order_id", "id", "หมายเลขคำสั่งซื้อ/หมายเลขพัสดุ", 
    "หมายเลขคำสั่งซื้อ / หมายเลขพัสดุ", "ordernumber"
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
    "product", "item", "สินค้า"
  ],
  quantity: [
    "quantity", "qty", "amount", "จำนวน", "จำนวนสินค้า", "จำนวนชิ้น", "จำนวนสินค้าที่ซื้อ", 
    "จำนวนสินค้าที่ซื้อในคำสั่งซื้อ", "qty sold", "quantity_sold"
  ],
  total: [
    "total", "price", "amount paid", "revenue", "ยอดคำสั่งซื้อ", "ราคารวม", "ราคาสุทธิ", 
    "ยอดขาย", "ยอดขายรวม", "total payment", "total_price", "grand total", "ยอดเงินโอน", "เงินที่โอน", 
    "จำนวนเงินที่โอน", "รายรับรวม", "ราคาขายสุทธิ", "ราคาขาย", "ราคาลดแล้ว", 
    "ราคาสินค้าทั้งหมดที่ต้องชำระ", "ยอดรวมของคำสั่งซื้อ", "ยอดรวมสุทธิ", 
    "ยอดชำระเงินทั้งหมด", "รายได้สุทธิ", "ยอดเงิน", "จำนวนเงิน", "ยอดชำระ", 
    "ยอดชำระเงิน", "จำนวนเงินรวม", "unitprice", "paidprice", "paid price", "unit price",
    "order amount", "order_amount", "sku subtotal after discount",
    "จำนวนเงินทั้งหมด", "สินค้าราคาปกติ", "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)"
  ],
  date: [
    "date", "time", "created", "วันที่", "เวลา", "order date", "created date", 
    "created_time", "order_time", "วันที่โอนเงินสำเร็จ", "วันที่โอนเงิน", 
    "เวลาการโอนเงินสำเร็จ", "วันที่โอน", "เวลาสั่งซื้อ", "เวลาที่ทำการสั่งซื้อ", 
    "วันที่สั่งซื้อ", "เวลาชำระเงิน", "createtime", "create time", "created time", 
    "created_time", "paid time", "paid_time",
    "วันที่ทำการสั่งซื้อ", "เวลาที่ทำการสั่งซื้อสำเร็จ", "วันที่โอนชำระเงินสำเร็จ"
  ],
  shippingFee: [
    "shipping fee", "shipping", "ค่าจัดส่ง", "ค่าส่ง", "ค่าจัดส่งที่ชำระโดยผู้ซื้อ", 
    "ค่าขนส่งที่ชำระโดยผู้ซื้อ", "shipping_fee", "ค่าขนส่ง", "shipping cost", 
    "shippingfee", "shipping fee after discount", "original shipping fee"
  ],
  platformFee: [
    "platform fee", "fee", "ค่าบริการ", "ค่าธรรมเนียม", "ค่าธรรมเนียมการบริการ", 
    "ค่าธรรมเนียมการทำธุรกรรม", "ค่าคอมมิชชัน", "ค่าคอมมิชชั่น", "commission", "service fee", 
    "platform_fee", "ค่าธรรมเนียมธุรกรรม", "ค่าบริการขาย", 
    "ค่าธรรมเนียมการทำธุรกรรม (ธุรกรรม)", "ค่าธรรมเนียมการทำธุรกรรม(ธุรกรรม)",
    "transaction fee", "transactionfee", "ค่าธรรมเนียมทั้งหมด", "ค่าธรรมเนียมคำสั่งซื้อ"
  ],
  netIncome: [
    "net income", "net", "payout", "รายรับสุทธิ", "ยอดโอน", "จำนวนเงินที่โอน", 
    "เงินโอน", "net_income", "net_amount", "ยอดเงินโอน", "รายได้สุทธิ", "รายรับ", 
    "ยอดชำระสุทธิ", "ยอดโอนเงินสุทธิ", "ยอดโอนสุทธิ", "จำนวนเงินทั้งหมด",
    "จำนวนเงินทั้งหมดที่โอนแล้ว (฿)", "ยอดชำระเงินทั้งหมด", "จำนวนเงินที่ชำระทั้งหมด",
    "การชำระเงินของลูกค้า", "ยอดเงินโอนสุทธิ"
  ]
};

const ID_HINTS = ["sku", "code", "หมายเลข", "เลขอ้างอิง", "อ้างอิง", "tracking", "ติดตาม",
                  "โทร", "phone", "zip", "ไปรษณีย์", "รหัส", "barcode", "package", "taxcode"];

const isIdHeader = (h) => {
  const s = String(h).toLowerCase();
  if (/(^|[^a-z])id([^a-z]|$)/.test(s) || /[a-z]id$/.test(s)) return true;
  return ID_HINTS.some(k => s.includes(k));
};

const MONEY_HINTS = ["เงิน", "ราคา", "ค่า", "ส่วนลด", "ยอด", "ภาษี", "vat", "wht", "คอมมิช", "commission",
                     "fee", "price", "amount", "discount", "total", "refund", "tax", "payout", "โอน",
                     "รายได้", "รายรับ", "คืน"];

const isMoneyHeader = (h) => {
  const s = String(h).toLowerCase();
  return MONEY_HINTS.some(k => s.includes(k));
};

const detectHeaderRow = (aoa) => {
  if (aoa.length > 0 && aoa[0] && aoa[0].length >= 10) {
    const col0 = aoa[0][0];
    const col1 = aoa[0][1];
    const col2 = aoa[0][2];
    const col4 = aoa[0][4];

    const isSeqNum = typeof col0 === "number" || (col0 !== null && col0 !== undefined && /^\d+$/.test(String(col0).trim()));
    const isOrderId = col1 && typeof col1 === "string" && /^(IV|HS|order-)\d+/i.test(col1.trim());
    const isDate = col2 && typeof col2 === "string" && (col2.includes("/") || col2.includes("-"));
    const isOnlineSystem = col4 && typeof col4 === "string" && col4.trim().includes("ระบบขายออนไลน์รวม");

    if (isSeqNum && isOrderId && isDate && isOnlineSystem) {
      return { idx: -1, width: aoa[0].length };
    }
  }

  const limit = Math.min(15, aoa.length);
  let best = -1, bestCount = 1;
  for (let i = 0; i < limit; i++) {
    const c = (aoa[i] || []).filter(x => x !== null && x !== undefined && String(x).trim() !== "").length;
    if (c > bestCount) {
      bestCount = c;
      best = i;
    }
  }
  return { idx: best < 0 ? 0 : best, width: bestCount };
};

const findColIndex = (headers, targetKeywords) => {
  const idx = headers.findIndex((h) => {
    const cleanHeader = h.trim().toLowerCase();
    return targetKeywords.some((keyword) => cleanHeader === keyword.toLowerCase());
  });
  if (idx !== -1) return idx;

  return headers.findIndex((h) => {
    const cleanHeader = h.trim().toLowerCase();
    return targetKeywords.some((keyword) => {
      const cleanKeyword = keyword.toLowerCase();
      if (
        cleanKeyword === "สินค้า" || 
        cleanKeyword === "ส่ง" || 
        cleanKeyword === "fee" || 
        cleanKeyword === "id" ||
        cleanKeyword === "จำนวน" || 
        cleanKeyword === "amount" || 
        cleanKeyword === "เวลา" || 
        cleanKeyword === "date"
      ) {
        return false;
      }
      return cleanHeader.includes(cleanKeyword);
    });
  });
};

const sheetToAoa = (ws) => {
  const aoa = [];
  const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
  if (!range) return aoa;
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellRef];
      row.push(cell ? (cell.v !== null && cell.v !== undefined ? cell.v : cell.w ?? "") : "");
    }
    aoa.push(row);
  }
  return aoa;
};

const buildDataset = (wb, sheetName, fileName, platform, kind) => {
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;
  const rawAoa = sheetToAoa(ws);
  if (!rawAoa.length) return null;
  
  const filteredAoa = rawAoa.filter(r => r && r.some(c => c !== null && c !== undefined && String(c).trim() !== ""));
  if (!filteredAoa.length) return null;
  
  const { idx } = detectHeaderRow(filteredAoa);
  
  const headerRow = idx >= 0 ? (filteredAoa[idx] || []) : [];
  const dataRows = idx >= 0
    ? filteredAoa.slice(idx + 1).filter(r => r.some(c => c !== null && String(c).trim() !== ""))
    : filteredAoa.filter(r => r.some(c => c !== null && String(c).trim() !== ""));
  
  const maxCols = Math.max(headerRow.length, ...dataRows.map(r => r.length), 1);
  let columns = [];
  for (let c = 0; c < maxCols; c++) {
    const raw = idx >= 0 ? headerRow[c] : undefined;
    let auto = false;
    let lbl;
    if (raw === null || raw === undefined || String(raw).trim() === "" || /^Unnamed/i.test(String(raw))) {
      const isFbOrLine = platform === "facebook" || platform === "line";
      if (isFbOrLine && idx === -1 && maxCols >= 17) {
        if (c === 0) lbl = "ลำดับ (Seq)";
        else if (c === 1) lbl = "หมายเลขคำสั่งซื้อ (Order ID)";
        else if (c === 2) lbl = "วันที่ (Date)";
        else if (c === 3) lbl = "รหัสสาขา/ไปรษณีย์ (Code)";
        else if (c === 4) lbl = "ระบบ/ช่องทาง (System)";
        else if (c === 5) lbl = "รหัสสินค้า/SKU (SKU Reference)";
        else if (c === 6) lbl = "ชื่อลูกค้า (Customer Name)";
        else if (c === 8) lbl = "ชื่อสินค้า (Product Name)";
        else if (c === 9) lbl = "จำนวน (Quantity)";
        else if (c === 10) lbl = "หน่วย (Unit)";
        else if (c === 11) lbl = "ราคาต่อหน่วย (Unit Price)";
        else if (c === 12) lbl = "ส่วนลด (Discount)";
        else if (c === 13) lbl = "ยอดรวมก่อนภาษี (Subtotal)";
        else if (c === 14) lbl = "ภาษีมูลค่าเพิ่ม (VAT)";
        else if (c === 16) lbl = "ยอดขายรวม / รายรับสุทธิ (Gross Sales / Net Income)";
        else lbl = "คอลัมน์ " + (c + 1);
        auto = false;
      } else {
        lbl = "คอลัมน์ " + (c + 1);
        auto = true;
      }
    } else {
      lbl = String(raw).trim();
    }
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
    const o = {};
    columns.forEach((col, c) => {
      const v = r[c] === undefined ? null : r[c];
      let parsedVal = v;
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
  
  return {
    platform,
    kind,
    fileName,
    sheetName,
    columns,
    rows: parsedRows,
  };
};

function parseNumber(val) {
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
}

function processDataset(ds) {
  const isIncome = ds.kind === "income";
  const headers = ds.columns.map(c => c.label);

  let idxId = findColIndex(headers, KEY_MAPS.orderId);
  let idxCust = findColIndex(headers, KEY_MAPS.customerName);
  let idxProd = findColIndex(headers, KEY_MAPS.productName);
  let idxQty = findColIndex(headers, KEY_MAPS.quantity);
  let idxTotal = findColIndex(headers, KEY_MAPS.total);
  let idxDate = findColIndex(headers, KEY_MAPS.date);
  let idxShip = findColIndex(headers, KEY_MAPS.shippingFee);
  const idxPlat = findColIndex(headers, KEY_MAPS.platformFee);
  let idxNet = findColIndex(headers, KEY_MAPS.netIncome);

  const findCol = (kwList) => {
    return headers.findIndex((h) => {
      const clean = h.trim().toLowerCase();
      return kwList.some((k) => clean === k.toLowerCase() || clean.includes(k.toLowerCase()));
    });
  };

  // Headerless Express file mapping
  if (idxId === -1 && (ds.platform === "facebook" || ds.platform === "line")) {
    const isHeaderless = headers.some(h => h.startsWith("คอลัมน์")) || headers[0] === "1" || headers[0] === "2" || headers[0] === "16";
    if (isHeaderless && headers.length >= 10) {
      idxId = 1;      // คอลัมน์ 2 (Order ID)
      idxDate = 2;    // คอลัมน์ 3 (Date)
      idxCust = 6;    // คอลัมน์ 7 (Customer Name)
      idxProd = 8;    // คอลัมน์ 9 (Product Name)
      idxQty = 9;     // คอลัมน์ 10 (Quantity)
      idxTotal = 16;  // คอลัมน์ 17 (Total)
      idxNet = 16;
    }
  }

  console.log(`\nPlatform: ${ds.platform} | FileName: ${ds.fileName}`);
  console.log(`Index Mappings:`);
  console.log(`- idxId: ${idxId} (${headers[idxId]})`);
  console.log(`- idxCust: ${idxCust} (${headers[idxCust]})`);
  console.log(`- idxProd: ${idxProd} (${headers[idxProd]})`);
  console.log(`- idxQty: ${idxQty} (${headers[idxQty]})`);
  console.log(`- idxTotal: ${idxTotal} (${headers[idxTotal]})`);
  console.log(`- idxNet: ${idxNet} (${headers[idxNet]})`);

  const colId = ds.columns[idxId];
  const colCust = idxCust !== -1 ? ds.columns[idxCust] : null;
  const colProd = idxProd !== -1 ? ds.columns[idxProd] : null;
  const colQty = idxQty !== -1 ? ds.columns[idxQty] : null;
  const colTotal = idxTotal !== -1 ? ds.columns[idxTotal] : null;
  const colShip = idxShip !== -1 ? ds.columns[idxShip] : null;
  const colPlat = idxPlat !== -1 ? ds.columns[idxPlat] : null;
  const colNet = idxNet !== -1 ? ds.columns[idxNet] : null;
  const colDate = idxDate !== -1 ? ds.columns[idxDate] : null;

  const orders = [];
  ds.rows.forEach((row, rowIdx) => {
    const rawId = colId ? row[colId.key] : null;
    if (rawId === null || rawId === undefined || String(rawId).trim() === "") return;

    const orderId = String(rawId).trim();
    let customerName = colCust && row[colCust.key] ? String(row[colCust.key]).trim() : "ลูกค้าทั่วไป";
    let productName = colProd && row[colProd.key] ? String(row[colProd.key]).trim() : (isIncome ? "รายการรายรับบัญชี" : "ไม่ระบุสินค้า");
    const quantity = colQty && row[colQty.key] !== null ? Math.max(1, Math.round(parseNumber(row[colQty.key]))) : 1;
    const rawAmount = colTotal && row[colTotal.key] !== null ? parseNumber(row[colTotal.key]) : 0;
    const shippingFee = colShip && row[colShip.key] !== null ? Math.abs(parseNumber(row[colShip.key])) : 0;
    
    let total = Math.abs(rawAmount);
    let platformFee = colPlat && row[colPlat.key] !== null ? Math.abs(parseNumber(row[colPlat.key])) : 0;
    let netIncome = colNet && row[colNet.key] !== null 
      ? parseNumber(row[colNet.key]) 
      : (isIncome ? total : total - shippingFee - platformFee);

    orders.push({
      orderId,
      customerName,
      productName,
      quantity,
      total,
      shippingFee,
      platformFee,
      netIncome
    });
  });

  console.log(`Total rows processed: ${orders.length}`);
  console.log(`First 3 processed orders:`);
  console.log(orders.slice(0, 3));
}

function run() {
  const fbPath = 'C:\\E-commerce_Sales\\งาน\\FACEBOOK.xlsx';
  const fbWb = XLSX.readFile(fbPath);
  const fbDs = buildDataset(fbWb, fbWb.SheetNames[0], 'FACEBOOK.xlsx', 'facebook', 'data');
  processDataset(fbDs);

  const linePath = 'C:\\E-commerce_Sales\\งาน\\Line.xlsx';
  const lineWb = XLSX.readFile(linePath);
  const lineDs = buildDataset(lineWb, lineWb.SheetNames[0], 'Line.xlsx', 'line', 'data');
  processDataset(lineDs);
}

run();
