import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// Replicate parsing logic from src/utils/fileParser.ts and src/components/ImportOrdersTab.tsx

const detectHeaderRow = (aoa) => {
  const limit = Math.min(15, aoa.length);
  let best = -1;
  let bestCount = 1;
  for (let i = 0; i < limit; i++) {
    const c = (aoa[i] || []).filter(x => x !== null && x !== undefined && String(x).trim() !== "").length;
    if (c > bestCount) {
      bestCount = c;
      best = i;
    }
  }
  return { idx: best < 0 ? 0 : best, width: bestCount };
};

const detectPlatform = (fileName, allHeaders) => {
  const name = fileName.toLowerCase();
  const headers = allHeaders.map(h => String(h).trim().toLowerCase());

  if (name.includes("lazada")) return "lazada";
  if (headers.some(h => ["orderitemid", "orderitemno", "sellerisku", "paidprice", "unitprice", "shippingaddress"].includes(h))) {
    return "lazada";
  }

  if (name.includes("shopee")) return "shopee";
  if (headers.some(h => ["หมายเลขคำสั่งซื้อ", "ราคาขาย", "จำนวนเงินทั้งหมด", "ค่าคอมมิชชั่น", "สถานะการสั่งซื้อ"].includes(h))) {
    return "shopee";
  }

  if (name.includes("tiktok") || name.includes("tik_tok") || name.includes("tt_")) return "tiktok";
  if (headers.some(h => ["order id", "order status", "seller sku", "product name", "sku subtotal after discount", "ประเภทธุรกรรม", "รายได้รวม"].includes(h))) {
    return "tiktok";
  }

  return "unknown";
};

const detectFileType = (fileName, headers) => {
  const name = fileName.toLowerCase();
  const cleanHeaders = headers.map(h => String(h).trim().toLowerCase());

  if (name.includes("income") || name.includes("รายรับ") || name.includes("โอนเงิน")) {
    return "income";
  }
  if (name.includes("order") || name.includes("คำสั่งซื้อ")) {
    return "order";
  }

  const incomeKeywords = ["ชื่อรายการธุรกรรม", "จำนวนเงิน(รวมภาษี)", "สถานะการโอนเงิน", "ประเภทธุรกรรม", "รายได้รวม", "ค่าธรรมเนียมทั้งหมด"];
  if (cleanHeaders.some(h => incomeKeywords.some(kw => h.includes(kw.toLowerCase())))) {
    return "income";
  }

  const orderKeywords = ["สถานะการสั่งซื้อ", "order status", "orderitemid", "ชื่อผู้รับ", "recipient", "วิธีการจัดส่ง", "ราคาขาย"];
  if (cleanHeaders.some(h => orderKeywords.some(kw => h.includes(kw.toLowerCase())))) {
    return "order";
  }

  return "order";
};

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
    "order amount", "order_amount", "sku subtotal after discount"
  ],
  date: [
    "date", "time", "created", "วันที่", "เวลา", "order date", "created date", 
    "created_time", "order_time", "วันที่โอนเงินสำเร็จ", "วันที่โอนเงิน", 
    "เวลาการโอนเงินสำเร็จ", "วันที่โอน", "เวลาสั่งซื้อ", "เวลาที่ทำการสั่งซื้อ", 
    "วันที่สั่งซื้อ", "เวลาชำระเงิน", "createtime", "create time", "created time", 
    "created_time", "paid time", "paid_time"
  ],
  shippingFee: [
    "shipping fee", "shipping", "ค่าจัดส่ง", "ค่าส่ง", "ค่าจัดส่งที่ชำระโดยผู้ซื้อ", 
    "ค่าขนส่งที่ชำระโดยผู้ซื้อ", "shipping_fee", "ค่าขนส่ง", "shipping cost", 
    "shippingfee", "shipping fee after discount", "original shipping fee"
  ],
  platformFee: [
    "platform fee", "fee", "ค่าบริการ", "ค่าธรรมเนียม", "ค่าธรรมเนียมการบริการ", 
    "ค่าธรรมเนียมการทำธุรกรรม", "ค่าคอมมิชชัน", "commission", "service fee", 
    "platform_fee", "ค่าธรรมเนียมธุรกรรม", "ค่าบริการขาย", 
    "ค่าธรรมเนียมการทำธุรกรรม (ธุรกรรม)", "ค่าธรรมเนียมการทำธุรกรรม(ธุรกรรม)",
    "transaction fee", "transactionfee", "ค่าธรรมเนียมทั้งหมด", "ค่าธรรมเนียมคำสั่งซื้อ"
  ],
  netIncome: [
    "net income", "payout", "net_income", "payout_amount", "จำนวนเงินทั้งหมดที่โอนแล้ว (฿)", 
    "ยอดชำระเงินทั้งหมด", "จำนวนเงินที่ชำระทั้งหมด", "การชำระเงินของลูกค้า", "net_amount", "ยอดเงินโอนสุทธิ"
  ]
};

const findColIndex = (headers, keywords) => {
  return headers.findIndex(h => {
    const clean = h.trim().toLowerCase();
    return keywords.some(k => clean === k.toLowerCase());
  });
};

const parseAndNormalizeDate = (raw) => {
  if (!raw) return "";
  const rawStr = String(raw).trim();
  if (rawStr === "") return "";

  // Check format dd/mm/yyyy or d/m/yyyy
  const dmy = rawStr.match(/^(\d{1,2})[\/\- ](\d{1,2})[\/\- ](\d{4})/);
  if (dmy) {
    let year = parseInt(dmy[3], 10);
    if (year > 2400) year -= 543;
    const month = dmy[2].padStart(2, '0');
    const day = dmy[1].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Check format yyyy-mm-dd
  const ymd = rawStr.match(/^(\d{4})[\/\- ](\d{1,2})[\/\- ](\d{1,2})/);
  if (ymd) {
    let year = parseInt(ymd[1], 10);
    if (year > 2400) year -= 543;
    const month = ymd[2].padStart(2, '0');
    const day = ymd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Handle Lazada style like "31 May 2026 21:05" or "07 Jun 2026"
  const parts = rawStr.split(/\s+/);
  if (parts.length >= 3) {
    const months = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const day = parts[0].padStart(2, '0');
    const mStr = parts[1].slice(0, 3).toLowerCase();
    const month = months[mStr];
    let year = parseInt(parts[2], 10);
    if (year > 2400) year -= 543;
    if (month && year) {
      return `${year}-${month}-${day}`;
    }
  }

  try {
    const parsed = Date.parse(rawStr);
    if (!isNaN(parsed)) {
      const dateObj = new Date(parsed);
      let year = dateObj.getFullYear();
      if (year > 2400) year -= 543;
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Ignore
  }

  return rawStr;
};

const dirPath = 'C:\\E-commerce_Sales\\งาน';
const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));

const ordersMap = new Map();

files.forEach(file => {
  const filePath = path.join(dirPath, file);
  try {
    const workbook = XLSX.readFile(filePath, { cellDates: true, raw: true });
    
    workbook.SheetNames.forEach(sheetName => {
      // Check hidden
      const sheetProps = workbook.Workbook?.Sheets?.find(s => s.name === sheetName);
      if (sheetProps && (sheetProps.Hidden === 1 || sheetProps.Hidden === 2)) {
        return;
      }
      
      const worksheet = workbook.Sheets[sheetName];
      const rawAoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
      if (rawAoa.length === 0) return;

      const { idx: headerRowIdx } = detectHeaderRow(rawAoa);
      const rawHeaders = rawAoa[headerRowIdx] || [];
      const headers = rawHeaders.map((h, i) => String(h).trim() || `Column ${i+1}`);
      const platform = detectPlatform(file, headers);
      const type = detectFileType(file, headers);
      const isIncome = type === "income";

      // Platform fields mapping
      let idxId = -1;
      let idxCust = -1;
      let idxProd = -1;
      let idxQty = -1;
      let idxTotal = -1;
      let idxDate = -1;
      let idxShip = -1;
      let idxPlat = -1;
      let idxNet = -1;

      const findCol = (kwList) => {
        return headers.findIndex(h => {
          const clean = h.trim().toLowerCase();
          return kwList.some(k => clean === k.toLowerCase());
        });
      };

      if (platform === "lazada") {
        if (!isIncome) {
          idxId = findCol(["ordernumber", "order id", "หมายเลขคำสั่งซื้อ"]);
          idxCust = findCol(["customername", "shippingname", "ชื่อลูกค้า"]);
          idxProd = findCol(["itemname", "product name", "ชื่อสินค้า"]);
          idxTotal = findCol(["paidprice"]);
          idxDate = findCol(["createtime", "create time"]);
          idxShip = findCol(["shippingfee", "ค่าจัดส่ง"]);
        } else {
          idxId = findCol(["หมายเลขคำสั่งซื้อ", "ordernumber"]);
          idxProd = findCol(["ชื่อสินค้า", "itemname"]);
          idxTotal = findCol(["จำนวนเงิน(รวมภาษี)"]);
          idxDate = findCol(["วันที่ทำรายการ"]);
        }
      } else if (platform === "shopee") {
        if (!isIncome) {
          idxId = findCol(["หมายเลขคำสั่งซื้อ"]);
          idxCust = findCol(["ชื่อผู้ใช้ (ผู้ซื้อ)"]);
          idxProd = findCol(["ชื่อสินค้า"]);
          idxQty = findCol(["จำนวน"]);
          idxTotal = findCol(["ราคาขายสุทธิ", "จำนวนเงินทั้งหมด", "ราคาขาย"]);
          idxDate = findCol(["วันที่ทำการสั่งซื้อ", "เวลาที่ทำการสั่งซื้อสำเร็จ"]);
          idxShip = findCol(["ค่าจัดส่งที่ชำระโดยผู้ซื้อ", "ค่าจัดส่งโดยประมาณ"]);
        } else {
          idxId = findCol(["หมายเลขคำสั่งซื้อ"]);
          idxCust = findCol(["ชื่อผู้ใช้ (ผู้ซื้อ)", "ชื่อผู้ใช้ (ผู้ขาย)"]);
          idxTotal = findCol(["สินค้าราคาปกติ"]);
          idxDate = findCol(["วันที่โอนชำระเงินสำเร็จ", "วันที่ทำการสั่งซื้อ"]);
          idxShip = findCol(["ค่าจัดส่งที่ชำระโดยผู้ซื้อ"]);
          idxNet = findCol(["จำนวนเงินทั้งหมดที่โอนแล้ว (฿)", "ยอดชำระเงินทั้งหมด"]);
        }
      } else if (platform === "tiktok") {
        if (!isIncome) {
          idxId = findCol(["order id"]);
          idxCust = findCol(["buyer username", "recipient"]);
          idxProd = findCol(["product name"]);
          idxQty = findCol(["quantity"]);
          idxTotal = findCol(["sku subtotal after discount", "order amount"]);
          idxDate = findCol(["created time"]);
          idxShip = findCol(["shipping fee after discount"]);
        } else {
          idxId = findCol(["หมายเลขคำสั่งซื้อ/การปรับ"]);
          idxProd = findCol(["รายละเอียดสินค้าที่ขายได้", "รายละเอียดสินค้า"]);
          idxTotal = findCol(["รายได้รวม", "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย"]);
          idxDate = findCol(["เวลาที่สร้างคำสั่งซื้อ", "เวลาที่ชำระคำสั่งซื้อ"]);
          idxShip = findCol(["ยอดรวมค่าจัดส่งที่ร้านค้าจ่ายจริง", "ค่าธรรมเนียมการจัดส่งจริง"]);
          idxPlat = findCol(["ค่าธรรมเนียมทั้งหมด", "ค่าธรรมเนียมคำสั่งซื้อ"]);
          idxNet = findCol(["จำนวนเงินที่ชำระทั้งหมด", "การชำระเงินของลูกค้า"]);
        }
      }

      // Fallback
      if (idxId === -1) idxId = findColIndex(headers, KEY_MAPS.orderId);
      if (idxCust === -1) idxCust = findColIndex(headers, KEY_MAPS.customerName);
      if (idxProd === -1) idxProd = findColIndex(headers, KEY_MAPS.productName);
      if (idxQty === -1) idxQty = findColIndex(headers, KEY_MAPS.quantity);
      if (idxTotal === -1) idxTotal = findColIndex(headers, KEY_MAPS.total);
      if (idxDate === -1) idxDate = findColIndex(headers, KEY_MAPS.date);
      if (idxShip === -1) idxShip = findColIndex(headers, KEY_MAPS.shippingFee);
      if (idxPlat === -1) idxPlat = findColIndex(headers, KEY_MAPS.platformFee);
      if (idxNet === -1) idxNet = findColIndex(headers, KEY_MAPS.netIncome);

      let dataRows = rawAoa.slice(headerRowIdx + 1);
      if (platform === "tiktok" && !isIncome && dataRows.length > 0) {
        dataRows = dataRows.slice(1); // skip description row
      }

      console.log(`Parsing File: ${file} | Platform: ${platform} | Type: ${type} | Rows count: ${dataRows.length}`);
      console.log(`  MAPPED INDICES: Id=${idxId}, Prod=${idxProd}, Total=${idxTotal}, Net=${idxNet}, Plat=${idxPlat}, Ship=${idxShip}, Date=${idxDate}`);

      let parseCount = 0;
      dataRows.forEach((row, rIdx) => {
        if (!row || row.length < 2 || !row.some(c => c !== undefined && c !== null && String(c).trim())) {
          return;
        }

        let rawId = "";
        if (idxId !== -1 && row[idxId] !== undefined && row[idxId] !== null) {
          rawId = String(row[idxId]).trim();
        }
        if (!rawId) return;

        parseCount++;

        let productName = idxProd !== -1 && row[idxProd] ? String(row[idxProd]).trim() : (isIncome ? "รายการรายรับบัญชี" : "ไม่ระบุสินค้า");
        if (platform === "tiktok" && isIncome && productName.includes("*")) {
          productName = "รายการรายรับบัญชี (TikTok)";
        }

        let total = 0;
        if (idxTotal !== -1 && row[idxTotal] !== undefined && row[idxTotal] !== null) {
          total = parseFloat(String(row[idxTotal]).replace(/[^0-9.-]/g, "")) || 0;
        }

        let shippingFee = 0;
        if (idxShip !== -1 && row[idxShip] !== undefined && row[idxShip] !== null) {
          shippingFee = Math.abs(parseFloat(String(row[idxShip]).replace(/[^0-9.-]/g, "")) || 0);
        }

        let platformFee = 0;
        if (platform === "shopee") {
          const feeKeywords = ["ค่าคอมมิชชั่น", "transaction fee", "ค่าบริการ", "ค่าธรรมเนียมโครงสร้างพื้นฐานแพลตฟอร์ม", "ค่าธุรกรรมการชำระเงิน", "ค่าคอมมิชชั่น ams", "ค่าธรรมเนียม ของโปรแกรมประหยัดค่าจัดส่ง"];
          headers.forEach((h, cIdx) => {
            const hLower = h.toLowerCase();
            if (feeKeywords.some(kw => hLower.includes(kw))) {
              const val = row[cIdx];
              if (val !== undefined && val !== null && val !== "") {
                const feeNum = Math.abs(parseFloat(String(val).replace(/[^0-9.-]/g, "")) || 0);
                platformFee += feeNum;
              }
            }
          });
        } else {
          if (idxPlat !== -1 && row[idxPlat] !== undefined && row[idxPlat] !== null) {
            platformFee = Math.abs(parseFloat(String(row[idxPlat]).replace(/[^0-9.-]/g, "")) || 0);
          }
        }

        let netIncome = 0;
        if (idxNet !== -1 && row[idxNet] !== undefined && row[idxNet] !== null) {
          netIncome = parseFloat(String(row[idxNet]).replace(/[^0-9.-]/g, "")) || 0;
        }

        const rawDate = idxDate !== -1 ? row[idxDate] : undefined;
        const dateStr = parseAndNormalizeDate(rawDate);

        const qty = (idxQty !== -1 && row[idxQty] !== undefined && row[idxQty] !== null)
          ? Math.max(1, parseInt(String(row[idxQty]), 10) || 1)
          : 1;

        const customerName = idxCust !== -1 && row[idxCust] ? String(row[idxCust]).trim() : "";

        const mapKey = isIncome 
          ? `${rawId}-INC` 
          : `${rawId}-ORD`;

        if (ordersMap.has(mapKey)) {
          const existing = ordersMap.get(mapKey);
          existing.quantity += qty;
          if (platform === "lazada" && isIncome) {
            if (total > 0) existing.total += total;
            else if (total < 0) existing.platformFee += Math.abs(total);
            existing.netIncome += total;
          } else {
            if (total > 0) existing.total += total;
            existing.shippingFee += shippingFee;
            existing.platformFee += platformFee;
            existing.netIncome += netIncome;
          }
        } else {
          let initialTotal = total;
          let initialPlatFee = platformFee;
          let initialNet = netIncome;

          if (platform === "lazada" && isIncome) {
            if (total > 0) {
              initialTotal = total;
              initialPlatFee = 0;
            } else {
              initialTotal = 0;
              initialPlatFee = Math.abs(total);
            }
            initialNet = total;
          }

          ordersMap.set(mapKey, {
            id: rawId,
            customerName: customerName || "ไม่ระบุชื่อ",
            productName,
            quantity: qty,
            total: initialTotal >= 0 ? initialTotal : 0,
            date: dateStr,
            isIncomeRow: isIncome,
            shippingFee,
            platformFee: initialPlatFee,
            netIncome: initialNet,
            platform
          });
        }
      });
      console.log(`  Parsed valid records count: ${parseCount}`);
    });
  } catch (e) {
    console.error(`Error processing file ${file}:`, e);
  }
});

// Post process
const finalOrders = [];
let totalRev = 0;
let totalNet = 0;
let totalFee = 0;
let totalShip = 0;

ordersMap.forEach((order, mapKey) => {
  if (!order.isIncomeRow) {
    if (!order.netIncome || order.netIncome === 0) {
      order.netIncome = Math.max(0, order.total - (order.platformFee || 0));
    }
  } else {
    if (order.platform === "shopee") {
      order.total = (order.netIncome || 0) + (order.platformFee || 0);
    } else if (order.platform === "lazada") {
      if (!order.total || order.total === 0) {
        order.total = Math.max(0, (order.netIncome || 0) + (order.platformFee || 0));
      }
    } else if (order.platform === "tiktok") {
      if (!order.netIncome || order.netIncome === 0) {
        order.netIncome = Math.max(0, order.total - (order.platformFee || 0));
      }
    }
  }

  order.total = Math.round(order.total * 100) / 100;
  order.platformFee = Math.round(order.platformFee * 100) / 100;
  order.shippingFee = Math.round(order.shippingFee * 100) / 100;
  order.netIncome = Math.round(order.netIncome * 100) / 100;

  finalOrders.push(order);

  // Accumulate stats for May 2026
  if (order.date && order.date.startsWith("2026-05")) {
    totalRev += order.total;
    totalNet += order.netIncome;
    totalFee += order.platformFee;
    totalShip += order.shippingFee;
  }
});

console.log(`=========================================`);
console.log(`SUMMARY: Total mapped unique keys in map: ${ordersMap.size}`);
console.log(`Unique final orders: ${finalOrders.length}`);
console.log(`\nFOR DATE RANGE MAY 2026 (2026-05):`);
console.log(`  Gross Revenue (total): ${totalRev}`);
console.log(`  Net Income: ${totalNet}`);
console.log(`  Platform Fees: ${totalFee}`);
console.log(`  Shipping Fees: ${totalShip}`);

// Let's print some Lazada income rows to inspect what they look like
console.log(`\nPREVIEW SOME LAZADA INCOME MAPPED ORDERS:`);
let lazadaIncs = Array.from(ordersMap.values()).filter(o => o.platform === 'lazada' && o.isIncomeRow).slice(0, 5);
console.dir(lazadaIncs);
