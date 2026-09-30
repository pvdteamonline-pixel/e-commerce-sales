import type { AppNotification, Order, Product, UploadedDataset } from "./types";

export const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date();
  date.setFullYear(year, month, day);
  const calendar = localStorage.getItem("calendarSetting") || "buddhist";
  const language = localStorage.getItem("languageSetting") || "th";
  const locale = language === "en"
    ? (calendar === "buddhist" ? "en-US-u-ca-buddhist" : "en-US")
    : (calendar === "christian" ? "th-TH-u-ca-gregory" : "th-TH");
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const getInitials = (name: string) => {
  if (!name) return "";
  const cleanName = name.replace(/^(คุณ|นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.)\s*/, "");
  return cleanName.slice(0, 2);
};

export const maskCustomerName = (name: string) => {
  if (!name) return "";
  const trimmed = name.trim();
  if (trimmed === "ลูกค้าทั่วไป") return trimmed;
  const cleanName = trimmed.replace(/^(คุณ|นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.)\s*/, "");
  if (!cleanName) return "**";
  return cleanName.charAt(0) + "**";
};

export const maskEmail = (email: string) => {
  if (!email) return "";
  const trimmed = email.trim();
  const parts = trimmed.split("@");
  if (parts.length !== 2) return "**";
  const [local, domain] = parts;
  if (local.length <= 1) return "*@" + domain;
  return local.charAt(0) + "**@" + domain;
};

interface ConfettiParticle {
  x: number;
  y: number;
  r: number;
  d: number;
  color: string;
  tilt: number;
  tiltAngleIncremental: number;
  tiltAngle: number;
}

export const triggerConfetti = () => {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  const handleResize = () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  };
  window.addEventListener("resize", handleResize);

  const colors = ["#26ccff", "#a25afd", "#ff5e7e", "#88ff5a", "#fcff42", "#ffa62d", "#ff36ff"];
  const count = 120;
  const particles: ConfettiParticle[] = [];

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height - height,
      r: Math.random() * 6 + 4,
      d: Math.random() * count,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 5,
      tiltAngleIncremental: Math.random() * 0.07 + 0.02,
      tiltAngle: 0,
    });
  }

  let animationFrameId: number;
  let active = true;

  // Stop spawning/updating after 2.5 seconds
  const timeoutId = setTimeout(() => {
    active = false;
  }, 2500);

  const draw = () => {
    ctx.clearRect(0, 0, width, height);

    let remaining = 0;
    particles.forEach((p) => {
      p.tiltAngle += p.tiltAngleIncremental;
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
      p.x += Math.sin(p.d) * 0.5;
      p.tilt = Math.sin(p.tiltAngle - p.d / 3) * 15;

      if (p.y <= height) {
        remaining++;
      }

      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      ctx.stroke();
    });

    if (active && remaining > 0) {
      animationFrameId = requestAnimationFrame(draw);
    } else {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
      canvas.remove();
    }
  };

  draw();
};

export const parseAndNormalizeDate = (rawDate: unknown): string => {
  if (rawDate === undefined || rawDate === null) return "";
  
  if (rawDate instanceof Date) {
    let year = rawDate.getFullYear();
    if (year > 2400) year -= 543;
    const month = String(rawDate.getMonth() + 1).padStart(2, '0');
    const day = String(rawDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  if (typeof rawDate === "number" && rawDate > 30000) {
    const dateObj = new Date((rawDate - 25569) * 86400 * 1000);
    let year = dateObj.getFullYear();
    if (year > 2400) year -= 543;
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  const rawStr = String(rawDate).trim();
  if (!rawStr) return "";

  // 1. Direct match YYYY-MM-DD (e.g., 2026-06-07 or 2026-06-07 14:00:00)
  const isoMatch = rawStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    let year = parseInt(isoMatch[1], 10);
    if (year > 2400) year -= 543;
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 2. Month names map (English & Thai)
  const monthMap: Record<string, string> = {
    jan: "01", january: "01", "ม.ค.": "01", "มกราคม": "01",
    feb: "02", february: "02", "ก.พ.": "02", "กุมภาพันธ์": "02",
    mar: "03", march: "03", "มี.ค.": "03", "มีนาคม": "03",
    apr: "04", april: "04", "เม.ย.": "04", "เมษายน": "04",
    may: "05", "พ.ค.": "05", "พฤษภาคม": "05",
    jun: "06", june: "06", "มิ.ย.": "06", "มิถุนายน": "06",
    jul: "07", july: "07", "ก.ค.": "07", "กรกฎาคม": "07",
    aug: "08", august: "08", "ส.ค.": "08", "สิงหาคม": "08",
    sep: "09", sept: "09", september: "09", "ก.ย.": "09", "กันยายน": "09",
    oct: "10", october: "10", "ต.ค.": "10", "ตุลาคม": "10",
    nov: "11", november: "11", "พ.ย.": "11", "พฤศจิกายน": "11",
    dec: "12", december: "12", "ธ.ค.": "12", "ธันวาคม": "12",
  };

  // 3. Match format: "07 Jun 2026" or "07-Jun-2026" or "7 Jun 2026 14:00"
  const textMonthMatch = rawStr.match(/^(\d{1,2})[\s\-/.,]+([a-zA-Z\u0E00-\u0E7F.]+?)[\s\-/.,]+(\d{2,4})/);
  if (textMonthMatch) {
    const day = textMonthMatch[1].padStart(2, '0');
    const monthKey = textMonthMatch[2].toLowerCase().trim();
    let year = parseInt(textMonthMatch[3], 10);
    if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
    if (year > 2400) year -= 543;

    const monthNum = monthMap[monthKey] || monthMap[monthKey.slice(0, 3)];
    if (monthNum) {
      return `${year}-${monthNum}-${day}`;
    }
  }

  // 4. Match format: "Jun 07, 2026" or "June 7 2026"
  const monthFirstMatch = rawStr.match(/^([a-zA-Z\u0E00-\u0E7F.]+?)[\s\-/.,]+(\d{1,2})[\s\-/.,]+(\d{2,4})/);
  if (monthFirstMatch) {
    const monthKey = monthFirstMatch[1].toLowerCase().trim();
    const day = monthFirstMatch[2].padStart(2, '0');
    let year = parseInt(monthFirstMatch[3], 10);
    if (year < 100) year = year < 50 ? 2000 + year : 1900 + year;
    if (year > 2400) year -= 543;

    const monthNum = monthMap[monthKey] || monthMap[monthKey.slice(0, 3)];
    if (monthNum) {
      return `${year}-${monthNum}-${day}`;
    }
  }

  // 5. Match format DD/MM/YYYY or DD-MM-YYYY
  const datePart = rawStr.split(/[ T]/)[0].trim();
  const parts = datePart.includes("/") ? datePart.split("/") : datePart.split("-");
  if (parts.length === 3) {
    if (parts[0].length === 4 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) {
      let year = parseInt(parts[0], 10);
      if (year > 2400) year -= 543;
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    if (parts[2].length === 4 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) {
      let year = parseInt(parts[2], 10);
      if (year > 2400) year -= 543;
      const month = parts[1].padStart(2, '0');
      const day = parts[0].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    if (parts[2].length === 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) {
      let year = parseInt(parts[2], 10);
      year = year < 50 ? 2000 + year : 1900 + year;
      const month = parts[1].padStart(2, '0');
      const day = parts[0].padStart(2, '0');
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
  
  return "";
};

/**
 * Detects brand from product name, SKU, or other row values.
 * Mappings:
 * - VAL / วาเลนเต้ / วาเลนเต้ม -> Valente
 * - BB / บาร์เบอร์ เบรน -> Barber Brain
 * - ANG / แอลแอนเจิน / แอลแองเจล -> L'angel
 * - GAD / กู๊ด ออล เดย์ -> Good All Day
 * - COS / COSMIX / คอสมิก / คอสมิกซ์ -> Cosmix
 */
const BRAND_CODE_REGEX = /(?:^|[^a-zA-Z0-9])(VAL|BB|ANG|GAD|COS|COSMIX)(?:[-_/\s\d]|$|[^a-zA-Z0-9])/i;

export const detectBrand = (row: unknown, productName: string = ""): string => {
  const checkCandidate = (str: string): string | null => {
    if (!str) return null;
    const trimmed = str.trim();
    if (!trimmed) return null;

    const nameLower = trimmed.toLowerCase();

    // 1. Valente (VAL / วาเลนเต้ / วาเลนเต้ม)
    if (
      nameLower.includes("valente") ||
      nameLower.includes("วาเลนเต้ม") ||
      nameLower.includes("วาเลนเต้") ||
      nameLower.includes("วาเลนเต") ||
      nameLower.includes("วาเล็นเต้")
    ) return "Valente";

    // 2. Barber Brain (BB / บาร์เบอร์ เบรน)
    if (
      nameLower.includes("barber brain") ||
      nameLower.includes("barberbrain") ||
      nameLower.includes("baeber brain") ||
      nameLower.includes("บาร์เบอร์ เบรน") ||
      nameLower.includes("บาร์เบอร์เบรน") ||
      nameLower.includes("บาร์เบอร์ เบรนด์") ||
      nameLower.includes("บาร์เบอร์เบรนด์") ||
      nameLower.includes("บาเบอร์ เบรน") ||
      nameLower.includes("บาเบอร์เบรน") ||
      nameLower.includes("บาร์เบอร์") ||
      nameLower.includes("บาเบอร์")
    ) return "Barber Brain";

    // 3. L'angel (ANG / แอลแอนเจิน / แอลแองเจล / แอลแอนเจิล)
    if (
      nameLower.includes("l'angel") ||
      nameLower.includes("langel") ||
      nameLower.includes("l angel") ||
      nameLower.includes("แอลแอนเจิน") ||
      nameLower.includes("แอล แอนเจิน") ||
      nameLower.includes("แอลแอนเจิล") ||
      nameLower.includes("แอล แอนเจิล") ||
      nameLower.includes("แอลแองเจล") ||
      nameLower.includes("แอล แองเจล") ||
      nameLower.includes("แอลแองเจิล") ||
      nameLower.includes("แอล แองเจิล") ||
      nameLower.includes("แอลแอนเจล") ||
      nameLower.includes("แอล แอนเจล")
    ) return "L'angel";

    // 4. Good All Day (GAD / กู๊ด ออล เดย์)
    if (
      nameLower.includes("good all day") ||
      nameLower.includes("goodallday") ||
      nameLower.includes("กู๊ด ออล เดย์") ||
      nameLower.includes("กู๊ดออลเดย์") ||
      nameLower.includes("กู๊ด ออลเดย์") ||
      nameLower.includes("กู๊ดออล เดย์") ||
      nameLower.includes("กู๊ดเดย์")
    ) return "Good All Day";

    // 5. Cosmix (COS / COSMIX / คอสมิก)
    if (
      nameLower.includes("cosmix") ||
      nameLower.includes("คอสมิก") ||
      nameLower.includes("คอสมิกซ์")
    ) return "Cosmix";

    // 6. Match abbreviation codes (VAL, BB, ANG, GAD, COS)
    const match = trimmed.match(BRAND_CODE_REGEX);
    if (match) {
      const code = match[1].toUpperCase();
      if (code === "VAL") return "Valente";
      if (code === "BB") return "Barber Brain";
      if (code === "ANG") return "L'angel";
      if (code === "GAD") return "Good All Day";
      if (code === "COS" || code === "COSMIX") return "Cosmix";
    }

    return null;
  };

  // 1. Fast path: check productName first
  if (productName) {
    const res = checkCandidate(productName);
    if (res) return res;
  }

  // 2. Targeted search in row object for brand/sku related keys only
  if (row && typeof row === "object" && !Array.isArray(row)) {
    const r = row as Record<string, unknown>;
    const targetKeys = ["brand", "แบรนด์", "แบรนด์สินค้า", "sku", "sellersku", "seller sku", "variation", "itemname", "item name", "product_name"];
    for (const key of targetKeys) {
      if (r[key] !== undefined && r[key] !== null) {
        const res = checkCandidate(String(r[key]));
        if (res) return res;
      }
    }
  } else if (Array.isArray(row)) {
    for (let i = 0; i < Math.min(row.length, 10); i++) {
      const val = row[i];
      if (typeof val === "string" && val.length > 1 && val.length < 100) {
        const res = checkCandidate(val);
        if (res) return res;
      }
    }
  }

  return "ทั่วไป";
};

/**
 * Resolves the standardized brand name for an order or product.
 * Returns the exact brand name if specified in the file/row, detected known brands, or fallback "สินค้าอื่นๆไม่มีแบรนด์".
 */
export const resolveBrandName = (
  brand?: string,
  productName: string = "",
  row?: unknown,
  productsList: { name: string; brand?: string }[] = []
): string => {
  const isInvalidBrand = (b?: string): boolean => {
    if (!b) return true;
    const clean = b.trim().toLowerCase();
    const invalidList = [
      "-",
      "--",
      "/",
      "n/a",
      "none",
      "null",
      "undefined",
      "ทั่วไป",
      "ไม่ระบุแบรนด์",
      "ไม่ระบุ",
      "สินค้าทั่วไป",
      "สินค้าอื่นๆที่ไม่มีแบรนด์",
      "สินค้าอื่นๆไม่มีแบรนด์",
      "lazada",
      "shopee",
      "tiktok",
      "tiktok shop",
      "tiktokshop",
      "facebook",
      "line",
      "line oa",
      "lineshopping",
      "pos",
      "other",
      "others",
      "statement",
      "payout",
      "settlement",
      "income",
      "finance",
      "รายรับ",
      "รายการรายรับ",
      "รายการการรายรับ",
    ];
    return !clean || invalidList.includes(clean);
  };

  // 1. Check explicit brand passed as parameter
  if (brand && !isInvalidBrand(brand)) {
    const trimmedBrand = brand.trim();
    const detectedFromBrand = detectBrand(null, trimmedBrand);
    if (detectedFromBrand && detectedFromBrand !== "ทั่วไป") return detectedFromBrand;
    return trimmedBrand;
  }

  // 2. Check explicit brand property in row object (e.g. column "แบรนด์", "Brand", "ยี่ห้อ")
  if (row && typeof row === "object" && !Array.isArray(row)) {
    const r = row as Record<string, unknown>;
    const brandKeys = ["brand", "แบรนด์", "แบรนด์สินค้า", "ยี่ห้อ", "product_brand", "Brand", "Brand Name"];
    for (const key of brandKeys) {
      if (r[key] !== undefined && r[key] !== null) {
        const val = String(r[key]).trim();
        if (!isInvalidBrand(val)) {
          const detectedFromVal = detectBrand(null, val);
          if (detectedFromVal && detectedFromVal !== "ทั่วไป") return detectedFromVal;
          return val;
        }
      }
    }
  }

  // 3. Check catalog products
  if (productName && productsList && productsList.length > 0) {
    const prod = productsList.find((p) => p.name.toLowerCase() === productName.toLowerCase());
    if (prod?.brand && !isInvalidBrand(prod.brand)) {
      const detectedFromProd = detectBrand(null, prod.brand);
      return detectedFromProd !== "ทั่วไป" ? detectedFromProd : prod.brand.trim();
    }
  }

  // 4. Try detecting from product name or candidate fields (SKU codes / keywords)
  const detected = detectBrand(row, productName);
  if (detected && detected !== "ทั่วไป") {
    return detected;
  }

  return "สินค้าอื่นๆไม่มีแบรนด์";
};

/**
 * Returns visual styling and label information for a notification based on its action type and content.
 * - Delete action: Red / Rose badge
 * - Edit action: Orange / Amber badge
 * - Import / Create / Normal action: Green / Emerald (or category) badge
 */
export const getNotificationVisualInfo = (notif: AppNotification): {
  label: string;
  badgeClass: string;
  actionKind: "create" | "import" | "edit" | "delete" | "task" | "announcement" | "inventory" | "order" | "activity" | "system";
} => {
  const title = (notif.title || "").toLowerCase();
  const msg = (notif.message || "").toLowerCase();
  const text = `${title} ${msg}`;

  const isDelete =
    notif.actionType === "delete" ||
    text.includes("ลบ") ||
    text.includes("ล้างข้อมูล") ||
    text.includes("ยกเลิก") ||
    text.includes("ปฏิเสธ");

  const isEdit =
    !isDelete && (
      notif.actionType === "edit" ||
      text.includes("แก้ไข") ||
      text.includes("อัปเดต") ||
      text.includes("ปรับปรุง") ||
      text.includes("เปลี่ยนสถานะ") ||
      text.includes("รีเซ็ต")
    );

  // 1. DELETE ACTION -> RED (Rose)
  if (isDelete) {
    let label = "ลบข้อมูล";
    if (notif.type === "import" || text.includes("ไฟล์")) {
      label = "ลบไฟล์";
    } else if (notif.type === "inventory" || text.includes("สินค้า")) {
      label = "ลบสินค้า";
    } else if (notif.type === "order" || text.includes("คำสั่งซื้อ") || text.includes("รายรับ")) {
      label = "ลบคำสั่งซื้อ";
    } else if (text.includes("บัญชี") || text.includes("ผู้ใช้")) {
      label = "ลบบัญชี";
    }
    return {
      label,
      badgeClass: "bg-rose-500/10 text-rose-500 border-rose-500/20",
      actionKind: "delete",
    };
  }

  // 2. EDIT ACTION -> ORANGE (Amber / Orange)
  if (isEdit) {
    let label = "แก้ไขข้อมูล";
    if (notif.type === "task" || text.includes("มอบหมาย") || text.includes("งาน")) {
      label = "อัปเดตงาน";
    } else if (notif.type === "inventory" || text.includes("สินค้า")) {
      label = "แก้ไขสินค้า";
    } else if (notif.type === "order" || text.includes("คำสั่งซื้อ")) {
      label = "แก้ไขคำสั่งซื้อ";
    } else if (text.includes("รหัสผ่าน")) {
      label = "รีเซ็ตรหัสผ่าน";
    } else if (text.includes("สถานะ")) {
      label = "เปลี่ยนสถานะ";
    } else if (text.includes("บัญชี") || text.includes("ผู้ใช้")) {
      label = "แก้ไขบัญชี";
    }
    return {
      label,
      badgeClass: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      actionKind: "edit",
    };
  }

  // 3. IMPORT / CREATE / NORMAL ACTIONS -> GREEN / EMERALD OR STANDARD CATEGORY
  switch (notif.type) {
    case "import":
      return {
        label: "นำเข้าไฟล์",
        badgeClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        actionKind: "import",
      };
    case "task":
      return {
        label: "มอบหมายงาน",
        badgeClass: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        actionKind: "task",
      };
    case "announcement":
      return {
        label: "ประกาศ",
        badgeClass: "bg-purple-500/10 text-purple-500 border-purple-500/20",
        actionKind: "announcement",
      };
    case "inventory":
      if (notif.actionType === "create" || text.includes("เพิ่ม") || text.includes("ใหม่")) {
        return {
          label: "เพิ่มสินค้า",
          badgeClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
          actionKind: "create",
        };
      }
      return {
        label: "คลังสินค้า",
        badgeClass: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        actionKind: "inventory",
      };
    case "order":
      if (notif.actionType === "create" || text.includes("บันทึก") || text.includes("ใหม่")) {
        return {
          label: "บันทึกคำสั่งซื้อ",
          badgeClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
          actionKind: "create",
        };
      }
      return {
        label: "คำสั่งซื้อ",
        badgeClass: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
        actionKind: "order",
      };
    case "activity":
      if (notif.actionType === "create" || text.includes("สร้าง")) {
        return {
          label: "สร้างบัญชีใหม่",
          badgeClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
          actionKind: "create",
        };
      }
      return {
        label: "กิจกรรม/ผู้ใช้",
        badgeClass: "bg-teal-500/10 text-teal-500 border-teal-500/20",
        actionKind: "activity",
      };
    default:
      return {
        label: "ระบบ",
        badgeClass: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
        actionKind: "system",
      };
  }
};

export const VALID_CHANNELS = ["TikTok Shop", "Shopee", "Lazada", "Facebook", "LINE OA", "หน้าร้าน", "อื่นๆ"];

export const sanitizeChannel = (val: unknown, fallback = "Shopee"): string => {
  if (!val || typeof val !== "string") return fallback;
  const s = val.trim();
  if (!s || !isNaN(Number(s))) return fallback;
  const low = s.toLowerCase();
  if (
    low.includes("fee") ||
    low.includes("ค่าธรรมเนียม") ||
    low.includes("ส่วนลด") ||
    low.includes("discount") ||
    low.includes("voucher") ||
    low.includes("payment") ||
    low.includes("ชำระ") ||
    low.includes("โอน") ||
    low.includes("payout") ||
    low.includes("wallet") ||
    low.includes("บริการ") ||
    low.includes("transaction") ||
    /^[0-9.,\-+]+$/.test(s)
  ) {
    return fallback;
  }
  if (low.includes("tiktok") || low === "tt") return "TikTok Shop";
  if (low.includes("shopee") || low === "sp") return "Shopee";
  if (low.includes("lazada") || low === "lz") return "Lazada";
  if (low.includes("facebook") || low === "fb") return "Facebook";
  if (low.includes("line") || low === "ln") return "LINE OA";
  if (low.includes("หน้าร้าน") || low.includes("pos")) return "หน้าร้าน";
  const match = VALID_CHANNELS.find((c) => c.toLowerCase() === low);
  if (match) return match;
  if (s.length <= 20 && !/[0-9]/.test(s)) return s;
  return fallback;
};

export const normalizeKey = (s: string) => s.toLowerCase().replace(/[\s_\-–—()/\\.[\]]/g, "");

export const ID_KEYWORDS = [
  "order id", "order no", "order no.", "order number", "order_id", "id",
  "หมายเลขคำสั่งซื้อ", "เลขที่คำสั่งซื้อ", "เลขคำสั่งซื้อ", "หมายเลขคำสั่งซื้อ/หมายเลขพัสดุ",
  "หมายเลขคำสั่งซื้อ / หมายเลขพัสดุ", "ordernumber", "orderitemid", "order item id",
  "orderitemno", "order item no", "order item no.", "order line id", "orderlineid",
  "statement number", "statement number / order item no", "statement no", "statement no.", "statementnumber",
  "หมายเลขรายการสินค้า", "รหัสรายการสินค้า", "เลขออเดอร์", "รหัสรายการ",
  "seller sku", "lazada sku", "parent sku", "sku", "sellersku", "lazadasku"
];

export const NAME_KEYWORDS = [
  "ชื่อสินค้า", "product name", "item name", "product_name", "itemname", "item_name",
  "ชื่อรายละเอียดสินค้า", "รายละเอียดสินค้า", "ชื่อรายการสินค้า",
  "ชื่อสินค้า/sku", "ชื่อตัวเลือกสินค้า", "ชื่อตัวเลือก", "variation name", "variation",
  "seller sku", "lazada sku", "parent sku", "sku", "รหัสสินค้า", "sellersku",
  "lazadasku", "parentsku", "product", "item"
];
export const NAME_BLACKLIST = [
  "customer", "buyer", "recipient", "ผู้ซื้อ", "ลูกค้า", "ผู้รับ", "order id", "order no", 
  "status", "phone", "email", "address", "ที่อยู่", "เบอร์", "fee", "ค่าธรรมเนียม", 
  "รายรับ", "income", "payout", "statement", "ยอดโอน", "บัญชี"
];

export const CAT_KEYWORDS = ["category", "หมวดหมู่หลัก", "หมวดหมู่", "กลุ่มสินค้า", "ประเภทสินค้า", "product_category"];
export const BRAND_KEYWORDS = ["brand", "แบรนด์สินค้า", "แบรนด์", "ยี่ห้อ", "product_brand"];

export const PRICE_KEYWORDS = [
  "unit price", "unitprice", "paid price", "paidprice", "deal price", "dealprice",
  "original price", "originalprice", "ราคาต่อหน่วย", "ราคาต่อชิ้น", "ราคาขายต่อชิ้น",
  "ราคาขาย", "ราคาตั้งต้น", "ราคาจำหน่าย", "ราคาสินค้า", "ราคาข้อตกลง", "item price", "price", "ราคา"
];

export const PRICE_BLACKLIST = [
  "fee", "ค่าธรรมเนียม", "ค่าจัดส่ง", "shipping fee", "shipping",
  "qty", "quantity", "จำนวน", "stock", "สต็อก", "seller sku", "parent sku", "sku id", "lazada sku", "เลขอ้างอิง sku", "เลขอ้างอิง parent sku",
  "รหัสสินค้า", "order id", "orderid", "หมายเลขคำสั่งซื้อ", "tracking", "พัสดุ",
  "phone", "โทร", "zip", "postcode", "ไปรษณีย์", "coins", "cashback", "คะแนน",
  "ยอดรวมของคำสั่งซื้อ", "ยอดรวมคำสั่งซื้อ", "ยอดรวมทั้งสิ้น", "จำนวนเงินทั้งหมดที่โอนแล้ว", "จำนวนเงินที่โอน", "ยอดโอน", "ยอดเงินโอน"
];

export const QTY_KEYWORDS = [
  "จำนวนสินค้าที่ซื้อ", "จำนวนสินค้า", "จำนวนชิ้น", "จำนวนที่ซื้อ", "จำนวนสั่งซื้อ", 
  "จำนวนขาย", "จำนวนรายการ", "quantity", "qty", "qty sold", "item quantity", "itemquantity", "sku quantity", "จำนวน"
];
export const QTY_BLACKLIST = [
  "stock", "สต็อก", "คงเหลือ", "inventory", "price", "ราคา", "ยอด", "amount", "total", 
  "fee", "ค่า", "เงิน", "บาท", "thb", "income", "โอน", "ชำระ", "สุทธิ", "net", "payout", 
  "ภาษี", "tax", "discount", "ส่วนลด", "จัดส่ง", "ขนส่ง", "shipping", "seller sku", "parent sku", "sku id", "lazada sku", "เลขอ้างอิง sku",
  "รหัส", "หมายเลข", "order id", "order no", "code", "tracking", "พัสดุ", "phone", "โทร", "zip", "postcode", "ไปรษณีย์"
];

export const REV_KEYWORDS = [
  "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย", "ยอดรวมค่าสินค้าหลังหักส่วนลด", "ยอดรวมค่าสินค้า",
  "sku subtotal after discount", "sku subtotal", "sku subtotal before discount",
  "ราคาขายสุทธิ", "ราคาสินค้าที่ชำระโดยผู้ซื้อ", "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)", "สินค้าราคาปกติ",
  "paid price", "paidprice", "unit price", "unitprice", "item price", "itemprice",
  "revenue", "total revenue", "ยอดขายรวม", "ยอดขาย", "ราคารวม", "ราคาสุทธิ", "ยอดรวมสุทธิ",
  "total payment", "amount paid"
];

export const REV_BLACKLIST = [
  "fee", "ค่าธรรมเนียม", "shipping fee", "shipping", "ค่าจัดส่ง",
  "qty", "quantity", "จำนวน", "stock", "สต็อก", "seller sku", "parent sku", "sku id", "lazada sku", "เลขอ้างอิง sku", "เลขอ้างอิง parent sku",
  "order id", "orderid", "tracking", "พัสดุ", "หมายเลขคำสั่งซื้อ",
  "phone", "โทร", "zip", "postcode", "ไปรษณีย์", "coins", "cashback", "คะแนน",
  "ยอดรวมของคำสั่งซื้อ", "ยอดรวมคำสั่งซื้อ", "ยอดรวมทั้งสิ้น", "จำนวนเงินทั้งหมดที่โอนแล้ว", "จำนวนเงินที่โอน", "ยอดโอน", "ยอดเงินโอน", "order total", "grand total", "total amount", "order amount", "total settlement amount"
];

export const FEE_KEYWORDS = [
  "ค่าธรรมเนียมทั้งหมด", "ค่าบริการและค่าธรรมเนียมทั้งหมด", "ค่าธรรมเนียมรวม", "รวมค่าธรรมเนียม", "total fee", "total fees",
  "platform fee", "fee", "ค่าธรรมเนียม", "ค่าบริการ", "commission", "sellerdiscounttotal", "platformdiscounttotal", "ส่วนลดจากผู้ขาย", "ส่วนลดจาก shopee", "ส่วนลดจาก lazada", "transaction fee"
];
export const SHIPPING_KEYWORDS = ["shipping fee", "shipping", "ค่าจัดส่ง", "ค่าส่ง", "shipping amount", "ค่าส่งสินค้า", "ค่าจัดส่งที่ชำระโดยผู้ซื้อ", "ค่าขนส่ง"];
export const NET_KEYWORDS = [
  "จำนวนเงินที่ชำระทั้งหมด", "ยอดโอนสุทธิ", "ยอดโอนเงินสุทธิ", "ยอดเงินโอนสุทธิ", "ยอดรับสุทธิ",
  "net income", "รายรับสุทธิ", "ยอดโอน", "payout", "จำนวนเงินทั้งหมดที่โอนแล้ว", "จำนวนเงินที่โอน", "settlement amount",
  "จำนวนเงิน(รวมภาษี)", "จำนวนเงิน (รวมภาษี)", "จำนวนเงิน", "amount (inc. vat)", "amount (incl. vat)", "amount(inc.vat)", "amount", "net amount", "ยอดเงิน", "ยอดเงินโอน"
];

export const CHAN_KEYWORDS = ["sales channel", "saleschannel", "channel", "ช่องทางการขาย", "ช่องทางจำหน่าย", "platform", "แพลตฟอร์ม"];
export const CHAN_BLACKLIST = ["fee", "ค่าธรรมเนียม", "payment", "ชำระ", "method", "paid", "โอน", "ส่วนลด", "discount", "voucher", "transaction", "บริการ", "order", "price", "amount", "ยอด"];

export const CUST_KEYWORDS = [
  "customer name", "recipient name", "buyer name", "customer_name", "shipping name",
  "shippingname", "customer", "recipient", "buyer", "ชื่อลูกค้า", "ชื่อผู้รับ",
  "ผู้ซื้อ", "ชื่อผู้ใช้ (ผู้ซื้อ)", "ชื่อผู้ใช้(ผู้ซื้อ)", "buyer username"
];
export const CUST_BLACKLIST = ["fee", "order", "price", "sku", "product", "id"];

export const DATE_KEYWORDS = [
  "create time", "createtime", "created time", "created_time", "order date", "date",
  "time", "วันที่", "เวลา", "วันที่ทำการสั่งซื้อ", "เวลาสั่งซื้อ", "วันที่สร้างคำสั่งซื้อ",
  "created date", "order_time", "paid time", "paid_time", "transaction date",
  "transactiondate", "วันที่โอนเงินสำเร็จ", "วันที่โอนเงิน", "statement date"
];
export const DATE_BLACKLIST = ["id", "no", "code", "sku", "item", "product", "price", "amount", "fee", "total", "ยอด", "เลข", "รหัส", "สินค้า", "ราคา", "ค่าธรรมเนียม", "ชื่อ", "รายการ"];

export const STATUS_KEYWORDS = [
  "status", "order status", "order_status", "สถานะ", "สถานะการสั่งซื้อ", "สถานะคำสั่งซื้อ",
  "orderstatus", "paymethod", "สถานะการชำระเงิน", "สถานะออเดอร์", "cancel reason", "cancellation reason"
];

export const findColumnKey = (keys: string[], targetKeywords: string[], blacklist: string[] = []): string | undefined => {
  if (!keys || keys.length === 0) return undefined;
  // 1. Exact lowercase match
  for (const kw of targetKeywords) {
    const lkw = kw.toLowerCase().trim();
    const match = keys.find((k) => {
      const lk = k.toLowerCase().trim();
      if (blacklist.some((b) => lk.includes(b.toLowerCase()))) return false;
      return lk === lkw;
    });
    if (match) return match;
  }
  // 2. Includes match
  for (const kw of targetKeywords) {
    const lkw = kw.toLowerCase().trim();
    const match = keys.find((k) => {
      const lk = k.toLowerCase().trim();
      if (blacklist.some((b) => lk.includes(b.toLowerCase()))) return false;
      return lk.includes(lkw);
    });
    if (match) return match;
  }
  // 3. Normalized match
  for (const kw of targetKeywords) {
    const normKw = normalizeKey(kw);
    if (!normKw) continue;
    const match = keys.find((k) => {
      const normK = normalizeKey(k);
      if (blacklist.some((b) => normK.includes(normalizeKey(b)))) return false;
      return normK === normKw || normK.includes(normKw);
    });
    if (match) return match;
  }
  return undefined;
};

export const parseOrderStatus = (val: unknown): "Paid" | "Pending" | "Refunded" => {
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
    s.includes("failed") ||
    s.includes("ล้มเหลว")
  ) {
    return "Refunded";
  }
  if (
    s.includes("pending") ||
    s.includes("รอชำระ") ||
    s.includes("unpaid") ||
    s.includes("ยังไม่ชำระ") ||
    s.includes("รอการชำระเงิน") ||
    s.includes("รอการจัดส่ง") ||
    s.includes("to ship")
  ) {
    return "Pending";
  }
  return "Paid";
};

export const extractOrdersFromDatasets = (
  datasets: UploadedDataset[],
  directOrders: Order[] = [],
  products: Product[] = []
): Order[] => {
  const combined: Order[] = [];
  const seenOrderKeys = new Set<string>();
  const datasetIds = new Set((datasets || []).map((d) => d.id));

  (datasets || []).forEach((ds) => {
    if (!ds || !ds.sheets) return;
    const fn = (ds.fileName || "").toLowerCase();
    const isShopee = ds.platform === "shopee" || fn.includes("shopee") || fn.startsWith("sp_") || fn.startsWith("sp-") || fn.startsWith("sp ") || fn.startsWith("sp") || fn.includes("ช้อปปี้") || fn.includes("ช็อปปี้");
    const isTiktok = ds.platform === "tiktok" || fn.includes("tiktok") || fn.includes("tik_tok") || fn.startsWith("tt") || fn.startsWith("tt_") || fn.startsWith("tt-") || fn.startsWith("tt ") || fn.includes("ติ๊กต๊อก") || fn.includes("ติ๊กตอก");
    const isLazada = ds.platform === "lazada" || fn.includes("lazada") || fn.startsWith("laz") || fn.startsWith("laz_") || fn.startsWith("laz-") || fn.startsWith("laz ") || fn.includes("ลาซาด้า");
    const isFacebook = ds.platform === "facebook" || fn.includes("facebook") || fn.startsWith("fb") || fn.includes("page365");
    const isLine = ds.platform === "line" || fn.includes("line") || fn.startsWith("line") || fn.includes("myshop");

    const defaultChannel = isTiktok
      ? "TikTok Shop"
      : isLazada
      ? "Lazada"
      : isShopee
      ? "Shopee"
      : isFacebook
      ? "Facebook"
      : isLine
      ? "LINE OA"
      : sanitizeChannel(ds.platform || "Shopee", "Shopee");

    ds.sheets.forEach((sheet) => {
      if (!sheet.rows || sheet.rows.length === 0) return;

      const sampleRow = sheet.rows[0];
      const sheetKeys = sheet.headers && sheet.headers.length > 0
        ? sheet.headers
        : (sampleRow && typeof sampleRow === "object" ? Object.keys(sampleRow) : []);

      const hasShopeeHeader = sheetKeys.some((h) => {
        const hl = h.toLowerCase();
        return hl.includes("shopee") || hl.includes("ราคาขายสุทธิ") || hl.includes("ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย") || hl.includes("ราคาสินค้าที่ชำระโดยผู้ซื้อ") || hl.includes("เลขอ้างอิง parent sku");
      });
      const hasTiktokHeader = sheetKeys.some((h) => {
        const hl = h.toLowerCase();
        return hl.includes("tiktok") || hl.includes("sku subtotal") || hl.includes("sku unit original price") || hl.includes("ราคาต่อหน่วยของ sku");
      });
      const hasLazadaHeader = sheetKeys.some((h) => {
        const hl = h.toLowerCase();
        return hl.includes("lazada") || hl.includes("lazadasku") || hl.includes("lazada sku") || hl.includes("order item id") || hl.includes("paidprice");
      });

      const effectiveShopee = isShopee || hasShopeeHeader;
      const effectiveTiktok = isTiktok || hasTiktokHeader;
      const effectiveLazada = isLazada || hasLazadaHeader;

      const colIdKey = findColumnKey(sheetKeys, ID_KEYWORDS);
      const colNameKey = findColumnKey(sheetKeys, NAME_KEYWORDS, NAME_BLACKLIST);
      const colCatKey = findColumnKey(sheetKeys, CAT_KEYWORDS);
      const colBrandKey = findColumnKey(sheetKeys, BRAND_KEYWORDS);
      let colPriceKey = findColumnKey(sheetKeys, PRICE_KEYWORDS, PRICE_BLACKLIST);
      const colQtyKey = findColumnKey(sheetKeys, QTY_KEYWORDS, QTY_BLACKLIST);
      let colRevKey = findColumnKey(sheetKeys, REV_KEYWORDS, REV_BLACKLIST);

      if (effectiveShopee) {
        const shopeePrice = findColumnKey(sheetKeys, ["ราคาขาย", "ราคาตั้งต้น", "ราคาต่อหน่วย", "สินค้าราคาปกติ"], PRICE_BLACKLIST);
        if (shopeePrice) colPriceKey = shopeePrice;
        const shopeeRev = findColumnKey(sheetKeys, [
          "ราคาขายสุทธิ",
          "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)",
          "ราคาสินค้าที่ชำระโดยผู้ซื้อ",
          "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย",
          "ยอดรวมค่าสินค้า",
          "ราคาขาย"
        ], [...REV_BLACKLIST, "ยอดรวมของคำสั่งซื้อ", "ยอดรวมคำสั่งซื้อ", "จำนวนเงินทั้งหมดที่โอนแล้ว", "จำนวนเงินทั้งหมด"]);
        if (shopeeRev) colRevKey = shopeeRev;
      } else if (effectiveTiktok) {
        const ttPrice = findColumnKey(sheetKeys, [
          "sku unit original price", "sku unit original price (thb)", "sku unit price", "sku unit price (thb)",
          "sku original price", "unit price", "item price", "retail price", "ราคาต่อหน่วยของ sku", "ราคาต่อหน่วยของ sku (thb)", "ราคาต่อหน่วย", "ราคาสินค้า"
        ], PRICE_BLACKLIST);
        if (ttPrice) colPriceKey = ttPrice;
        const ttRev = findColumnKey(sheetKeys, [
          "sku subtotal after discount", "sku subtotal after discount (thb)", "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย", "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย (thb)",
          "sku subtotal before discount", "sku subtotal", "sku subtotal (thb)",
          "ยอดรวมค่าสินค้า", "ยอดรวมค่าสินค้า (thb)"
        ], [...REV_BLACKLIST, "order subtotal amount", "order subtotal", "order amount", "buyer paid amount", "total amount", "ยอดรวมคำสั่งซื้อ", "ยอดชำระของผู้ซื้อ", "ยอดเงินตามคำสั่งซื้อ"]);
        if (ttRev) colRevKey = ttRev;
      } else if (effectiveLazada) {
        const lzPrice = findColumnKey(sheetKeys, ["paid price", "paidprice", "unit price", "unitprice", "item price", "ราคาขายสุทธิ"], PRICE_BLACKLIST);
        if (lzPrice) colPriceKey = lzPrice;
        const lzRev = findColumnKey(sheetKeys, [
          "paid price", "paidprice", "จำนวนเงิน(รวมภาษี)", "จำนวนเงิน (รวมภาษี)", "จำนวนเงิน", "amount", "amount (inc. vat)", "amount (incl. vat)", "net amount", "ยอดขายรวม", "ยอดรวม", "ยอดเงิน"
        ], [...REV_BLACKLIST.filter(b => b !== "amount" && b !== "จำนวนเงิน"), "order total", "grand total"]);
        if (lzRev) colRevKey = lzRev;
      }

      const colFeeKey = findColumnKey(sheetKeys, FEE_KEYWORDS);
      const colShippingKey = findColumnKey(sheetKeys, SHIPPING_KEYWORDS);
      const colNetKey = findColumnKey(sheetKeys, NET_KEYWORDS);
      const colChanKey = findColumnKey(sheetKeys, CHAN_KEYWORDS, CHAN_BLACKLIST);
      const colCustKey = findColumnKey(sheetKeys, CUST_KEYWORDS, CUST_BLACKLIST);
      const colDateKey = findColumnKey(sheetKeys, DATE_KEYWORDS, DATE_BLACKLIST);
      const colStatusKey = findColumnKey(sheetKeys, STATUS_KEYWORDS);

      const safeParseFloat = (val: unknown): number => {
        if (val === null || val === undefined) return 0;
        if (typeof val === "number") return val;
        const s = String(val).trim();
        if (!s) return 0;
        const withoutCurrency = s.replace(/[฿$thbTHB%\s]/g, "");
        if (!/^[-+]?[\d,]*\.?\d+$/.test(withoutCurrency)) return 0;
        const clean = withoutCurrency.replace(/,/g, "");
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
      };

      sheet.rows.forEach((row, rowIdx) => {
        if (!row || typeof row !== "object") return;
        const r = row as Record<string, unknown>;

        const isIncomeDataset = ds.fileType === "income" || ds.kind === "income" || ds.type === "income" || ds.fileName.toLowerCase().includes("income") || ds.fileName.toLowerCase().includes("รายรับ") || ds.fileName.toLowerCase().includes("โอนเงิน");
        const rawName = colNameKey ? String(r[colNameKey] ?? "").trim() : "";
        const lowerName = rawName.toLowerCase();
        if (!isIncomeDataset) {
          if (
            !rawName ||
            rawName.length < 2 ||
            rawName === "-" ||
            rawName === "--" ||
            rawName === "/" ||
            rawName === "\\" ||
            rawName === "..." ||
            rawName === "null" ||
            rawName === "undefined" ||
            rawName === "n/a" ||
            rawName === "none" ||
            lowerName === "total" ||
            lowerName === "sum" ||
            lowerName === "grand total" ||
            lowerName === "subtotal" ||
            lowerName === "ยอดรวม" ||
            lowerName === "ยอดขายรวม" ||
            lowerName === "ชื่อสินค้า" ||
            lowerName === "product name" ||
            lowerName === "item name" ||
            lowerName === "รายการรายรับบัญชี" ||
            lowerName.startsWith("รายการสินค้า") ||
            lowerName.includes("ยอดโอน") ||
            lowerName.includes("ค่าธรรมเนียม") ||
            lowerName.includes("รายรับ")
          ) {
            return;
          }
        }

        const rawId = colIdKey ? r[colIdKey] : undefined;

        const rawCat = colCatKey ? String(r[colCatKey] ?? "") : "";
        let category: Product["category"];
        const lCat = rawCat.toLowerCase();
        if (lCat.includes("apparel") || lCat.includes("เสื้อ") || lCat.includes("ผ้า") || lCat.includes("แฟชั่น") || lCat.includes("กางเกง") || lCat.includes("เดรส") || lCat.includes("dress") || lCat.includes("shirt")) category = "Apparel";
        else if (lCat.includes("home") || lCat.includes("บ้าน") || lCat.includes("ของใช้") || lCat.includes("living") || lCat.includes("kitchen") || lCat.includes("furniture") || lCat.includes("ครัว")) category = "Home";
        else if (lCat.includes("beauty") || lCat.includes("งาม") || lCat.includes("สำอาง") || lCat.includes("skin") || lCat.includes("makeup") || lCat.includes("บำรุง") || lCat.includes("ผม") || lCat.includes("hair")) category = "Beauty";
        else if (lCat.includes("elect") || lCat.includes("ไฟ") || lCat.includes("คอม") || lCat.includes("phone") || lCat.includes("gadget") || lCat.includes("tech")) category = "Electronics";
        else {
          const n = (rawName || "").toLowerCase();
          if (/แปรง|หวี|มีดโกน|เคราติน|สบู่|ครีม|เซรั่ม|แชมพู|บำรุง|ลิป|แต่งหน้า|น้ำหอม|ทำผม|ตัดผม|บาร์เบอร์|ไดร์|มาส์ก|โพเมด|พู่ปัด|กระปุกแป้ง|กรรไกร|ห่วงต่อผม|กิ๊ฟต่อผม|หัวหุ่น|วิก|ปัตตาเลี่ยน|pomade|keratin|comb|brush|hair|beauty|cosmetic|masque|salon|barber/i.test(n)) category = "Beauty";
          else if (/เสื้อ|กางเกง|กระโปรง|เดรส|รองเท้า|ถุงเท้า|กระเป๋า|หมวก|แฟชั่น|cloth|shirt|pants|dress/i.test(n)) category = "Apparel";
          else if (/เตียง|หมอน|ผ้าปู|ครัว|แก้ว|จาน|โต๊ะ|เก้าอี้|ห้อง|ของใช้|กระจก|home|living|kitchen/i.test(n)) category = "Home";
          else if (/หูฟัง|ลำโพง|สายชาร์จ|แบต|กล้อง|คอม|มือถือ|เคส|ปลั๊ก|พัดลม|เมาส์|คีย์บอร์ด|gadget|phone/i.test(n)) category = "Electronics";
          else category = "Beauty";
        }

        const rawBrand = colBrandKey ? String(r[colBrandKey] ?? "") : "";
        const resolvedBrand = resolveBrandName(rawBrand, rawName, row, products);

        const matchedP = products && products.length > 0 && rawName
          ? products.find(p => p.name.toLowerCase() === rawName.toLowerCase())
          : undefined;

        const rawPrice = colPriceKey ? r[colPriceKey] : undefined;
        const parsedPrice = safeParseFloat(rawPrice);
        let unitPrice = parsedPrice > 0 && parsedPrice <= 50000 ? parsedPrice : 0;

        const rawQty = colQtyKey ? r[colQtyKey] : undefined;
        let salesQty = 1;
        if (!isIncomeDataset && rawQty !== undefined && rawQty !== null && rawQty !== "") {
          if (typeof rawQty === "number") {
            salesQty = Math.round(rawQty);
          } else {
            const num = safeParseFloat(rawQty);
            if (num > 0) {
              salesQty = Math.round(num);
            }
          }
        }
        if (salesQty <= 0 || salesQty > 100000) {
          salesQty = 1;
        }

        const rawRev = colRevKey ? r[colRevKey] : undefined;
        let parsedRev = safeParseFloat(rawRev);
        if (parsedRev > 50000 * salesQty) {
          parsedRev = 0;
        }

        // Fallback search in row if rev and price are both 0
        if (parsedRev === 0 && unitPrice === 0) {
          const fallbackPriceKeys = [
            "จำนวนเงิน(รวมภาษี)",
            "จำนวนเงิน (รวมภาษี)",
            "จำนวนเงิน",
            "amount (inc. vat)",
            "amount (incl. vat)",
            "amount",
            "net amount",
            "ยอดเงิน",
            "ยอดเงินโอน",
            "ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย",
            "ราคาสินค้าที่ชำระโดยผู้ซื้อ (thb)",
            "ราคาสินค้าที่ชำระโดยผู้ซื้อ",
            "ยอดรวมของคำสั่งซื้อ",
            "ยอดรวมคำสั่งซื้อ",
            "ยอดชำระเงิน",
            "ยอดเงินรวม",
            "ยอดรวม",
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
            const matchedKey = Object.keys(r).find(k => k.trim().toLowerCase() === fk);
            if (matchedKey && r[matchedKey] !== undefined) {
              const p = safeParseFloat(r[matchedKey]);
              if (p > 0 && p <= 50000) {
                unitPrice = p;
                break;
              }
            }
          }
        }

        // Catalog price fallback & sanity check for inflated Order IDs
        if ((unitPrice > 50000 || unitPrice === 0) && matchedP && matchedP.price > 0) {
          unitPrice = matchedP.price;
        }
        
        const isUnitPriceName = (colName?: string): boolean => {
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

        let grossAmt = 0;
        if (parsedRev > 0) {
          if (salesQty > 1 && isUnitPriceName(colRevKey)) {
            grossAmt = parsedRev * salesQty;
          } else {
            grossAmt = parsedRev;
          }
        } else if (unitPrice > 0) {
          grossAmt = unitPrice * salesQty;
        }

        if (unitPrice === 0 && grossAmt > 0 && salesQty > 0) {
          unitPrice = Math.round((grossAmt / salesQty) * 100) / 100;
        }

        // Sanity check for inflated revenue (Order ID matched to revenue)
        if (grossAmt / salesQty > 50000) {
          if (matchedP && matchedP.price > 0) {
            grossAmt = matchedP.price * salesQty;
            unitPrice = matchedP.price;
          } else if (unitPrice > 0 && unitPrice <= 50000) {
            grossAmt = unitPrice * salesQty;
          } else {
            grossAmt = 0;
            unitPrice = 0;
          }
        }

        if (grossAmt === 0 && unitPrice > 0) {
          grossAmt = unitPrice * salesQty;
        }

        const rawFee = colFeeKey ? r[colFeeKey] : undefined;
        let platformFee = safeParseFloat(rawFee);

        const rawShipping = colShippingKey ? r[colShippingKey] : undefined;
        let shippingFee = safeParseFloat(rawShipping);

        const rawNet = colNetKey ? r[colNetKey] : undefined;
        const parsedNet = safeParseFloat(rawNet);
        const netIncome = rawNet !== undefined && rawNet !== null && String(rawNet).trim() !== ""
          ? parsedNet
          : Math.max(0, grossAmt - platformFee - shippingFee);

        if (isIncomeDataset) {
          const txDesc = String(rawName || (colFeeKey ? r[colFeeKey] : "") || "").toLowerCase();
          const isTxShipping = txDesc.includes("จัดส่ง") || txDesc.includes("shipping") || txDesc.includes("ค่าส่ง") || txDesc.includes("ขนส่ง");
          const isTxRefund = txDesc.includes("คืนสินค้า") || txDesc.includes("หักเงินค่าสินค้า") || txDesc.includes("reversal") || txDesc.includes("refund");

          if (netIncome < 0) {
            const absAmt = Math.abs(netIncome);
            if (isTxShipping) {
              shippingFee = Math.max(shippingFee, absAmt);
            } else if (!isTxRefund) {
              platformFee = Math.max(platformFee, absAmt);
            }
            grossAmt = 0;
          } else if (grossAmt === 0 && netIncome > 0) {
            grossAmt = netIncome + platformFee + shippingFee;
          }
        }

        const rawChan = colChanKey ? r[colChanKey] : undefined;
        const channelName = sanitizeChannel(rawChan ? String(rawChan) : defaultChannel, defaultChannel);

        const rawCustomer = colCustKey ? String(r[colCustKey] ?? "").trim() : "";
        const rawDate = colDateKey ? r[colDateKey] : undefined;
        const normalizedDate = rawDate ? parseAndNormalizeDate(rawDate) : "";
        const fallbackDate = ds.dateRange?.max && /^\d{4}-\d{2}-\d{2}$/.test(ds.dateRange.max)
          ? ds.dateRange.max
          : parseAndNormalizeDate(ds.uploadedAt || new Date());
        const dateStr = normalizedDate || fallbackDate;

        const rawStatus = colStatusKey ? r[colStatusKey] : undefined;
        const isNegativeTx = netIncome < 0 || grossAmt < 0 || (rawId && String(rawId).startsWith("SR"));
        const status = isNegativeTx ? "Refunded" : parseOrderStatus(rawStatus);

        const orderCode = rawId ? String(rawId).trim() : `ORD-${ds.id}-${rowIdx + 1}`;
        const uniqueKey = `${ds.id}-${orderCode}-${rowIdx}`.toLowerCase();

        if (seenOrderKeys.has(uniqueKey)) {
          return;
        }
        seenOrderKeys.add(uniqueKey);

        combined.push({
          id: `${orderCode}-row-${rowIdx}`,
          customerName: rawCustomer || (isIncomeDataset ? "ลูกค้า Lazada" : "ลูกค้าทั่วไป"),
          email: `${(rawCustomer || "customer").toLowerCase().replace(/[^a-zA-Z0-9]/g, "")}@example.com`,
          productName: rawName || (isIncomeDataset ? "รายการรายรับ Lazada" : "สินค้าทั่วไป"),
          brand: resolvedBrand,
          category: category,
          channel: channelName as Order["channel"],
          total: isIncomeDataset && netIncome < 0 ? 0 : (grossAmt > 0 ? grossAmt : (netIncome > 0 ? netIncome : 0)),
          quantity: salesQty,
          status: status,
          date: dateStr,
          platformFee: platformFee,
          shippingFee: shippingFee,
          netIncome: status === "Refunded" && netIncome > 0 && !isIncomeDataset ? 0 : netIncome,
          isIncome: ds.fileType === "income" || ds.kind === "income" || ds.type === "income" || false,
          datasetId: ds.id,
        });
      });
    });
  });

  // 2. Add direct orders that do not belong to any processed dataset and sanitize their total
  if (directOrders && directOrders.length > 0) {
    directOrders.forEach((o) => {
      if (!o) return;
      if (o.datasetId && datasetIds.has(o.datasetId)) {
        return; // Already cleanly extracted from dataset above
      }
      const key = (o.id || `${o.productName}-${o.date}`).trim().toLowerCase();
      if (seenOrderKeys.has(key)) return;
      seenOrderKeys.add(key);

      const qty = Number(o.quantity) || 1;
      let tot = Number(o.total) || 0;
      const matchedP = products && products.length > 0 && o.productName
        ? products.find((p) => p.name.toLowerCase() === o.productName.toLowerCase())
        : undefined;

      // Fix inflated direct order total if > 50000 per unit
      if (tot / qty > 50000) {
        if (matchedP && matchedP.price > 0) {
          tot = matchedP.price * qty;
        } else {
          tot = 0;
        }
      }

      combined.push({
        ...o,
        total: tot,
      });
    });
  }

  if (combined.length === 0 && products && products.length > 0) {
    products.forEach((p, pIdx) => {
      if (!p || !p.name) return;
      if ((p.sales || 0) <= 0 && (p.revenue || 0) <= 0) return;
      const key = `prod-cat-${p.id || p.name}`.toLowerCase();
      if (!seenOrderKeys.has(key)) {
        seenOrderKeys.add(key);
        const salesCount = p.sales || 1;
        const revAmt = p.revenue || (p.price || 0) * salesCount;
        combined.push({
          id: p.id || `PROD-${pIdx + 1}`,
          customerName: "ลูกค้าทั่วไป",
          email: "customer@example.com",
          productName: p.name,
          brand: p.brand || "ทั่วไป",
          category: p.category || "Electronics",
          channel: "Shopee",
          total: revAmt,
          quantity: salesCount,
          status: "Paid",
          date: new Date().toISOString().split("T")[0],
          platformFee: 0,
          shippingFee: 0,
          netIncome: revAmt,
          isIncome: false,
        });
      }
    });
  }

  return combined;
};


