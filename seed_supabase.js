import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://caivuiyvkgqpyrdijuhn.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_B7iIZLAYD0Vt9ht08XE6KQ_ZsgveKKb";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("🚀 กำลังเตรียมข้อมูลเพื่อ Seed สู่ Supabase...");

  // โหลดข้อมูลจาก db.json
  let db = { products: [], orders: [], systemUsers: [], auditLogs: [] };
  if (fs.existsSync("./db.json")) {
    try {
      db = JSON.parse(fs.readFileSync("./db.json", "utf-8"));
    } catch (e) {
      console.log("Could not parse db.json, using defaults");
    }
  }

  // 1. Users
  const defaultUsers = [
    {
      id: "USR-001",
      name: "คุณภาณวดี",
      email: "phanvadee@phanvadee.io",
      username: "phanvadee",
      role: "Admin",
      status: "Active",
      password: "admin1234",
      tasks: ["ดูแดชบอร์ด", "ดูรายงานยอดขาย", "เครื่องคำนวณส่วนต่าง", "นำเข้าข้อมูล Excel", "จัดการผู้ใช้งาน"]
    },
    {
      id: "USR-002",
      name: "สมชาย นักพัฒนา",
      email: "somchai@phanvadee.io",
      username: "somchai",
      role: "Manager",
      status: "Active",
      password: "manager1234",
      tasks: ["ดูแดชบอร์ด", "ดูรายงานยอดขาย", "เครื่องคำนวณส่วนต่าง", "นำเข้าข้อมูล Excel", "จัดการผู้ใช้งาน"]
    },
    {
      id: "USR-003",
      name: "สมศรี เสมียนขาย",
      email: "somsri@phanvadee.io",
      username: "somsri",
      role: "User",
      status: "Active",
      password: "user1234",
      tasks: ["ดูรายงานยอดขาย", "เครื่องคำนวณส่วนต่าง"]
    }
  ];

  const rawUsers = (db.systemUsers && db.systemUsers.length > 0) ? db.systemUsers : defaultUsers;
  const usersToInsert = rawUsers.map(u => ({
    id: u.id,
    name: u.name || "User",
    email: u.email || `${u.username || u.id}@example.com`,
    username: u.username || u.id,
    role: (['Admin', 'Manager', 'User'].includes(u.role)) ? u.role : 'User',
    status: (['Active', 'Inactive'].includes(u.status)) ? u.status : 'Active',
    password: u.password || "123456",
    tasks: Array.isArray(u.tasks) ? u.tasks : []
  }));

  console.log(`\n1. กำลังบันทึก Users (${usersToInsert.length} คน)...`);
  const { error: userErr } = await supabase.from('users').upsert(usersToInsert);
  if (userErr) console.error("❌ User error:", userErr);
  else console.log(`✅ Users บันทึกสำเร็จ!`);

  // 2. Products
  const defaultProducts = [
    { id: "PROD-001", name: "หูฟัง Quantum ตัดเสียงรบกวนภายนอก", category: "Electronics", brand: "Quantum", price: 299.99, sales: 345, revenue: 103496.55, stock: 45, status: "In Stock" },
    { id: "PROD-002", name: "กระเป๋าเป้สะพายหลังกันน้ำ Urban Tech", category: "Apparel", brand: "Urban Tech", price: 89.0, sales: 812, revenue: 72268.0, stock: 120, status: "In Stock" },
    { id: "PROD-003", name: "โคมไฟอ่านหนังสืออัจฉริยะ Nordic Minimalist", category: "Home", brand: "Nordic", price: 124.5, sales: 520, revenue: 64740.0, stock: 8, status: "Low Stock" },
    { id: "PROD-004", name: "เซรั่มบำรุงผิวหน้าพรีเมียม Hydro-Glow", category: "Beauty", brand: "Hydro-Glow", price: 58.0, sales: 1105, revenue: 64090.0, stock: 0, status: "Out of Stock" },
    { id: "PROD-005", name: "หมอนรองคอเมมโมรี่โฟม Ergonomic", category: "Home", brand: "Ergonomic", price: 79.99, sales: 410, revenue: 32795.9, stock: 67, status: "In Stock" }
  ];

  const rawProducts = (db.products && db.products.length > 0) ? db.products : defaultProducts;
  const productsToInsert = rawProducts.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category || "General",
    brand: p.brand || "General",
    price: Number(p.price) || 0,
    sales: Number(p.sales) || 0,
    revenue: Number(p.revenue) || 0,
    stock: Number(p.stock) || 0,
    status: p.status || "In Stock"
  }));

  console.log(`\n2. กำลังบันทึก Products (${productsToInsert.length} รายการ)...`);
  const { error: prodErr } = await supabase.from('Orders').upsert(productsToInsert);
  if (prodErr) console.error("❌ Product error:", prodErr);
  else console.log(`✅ Products บันทึกสำเร็จ!`);

  // 3. Orders (chunk by 100)
  const rawOrders = (db.orders && db.orders.length > 0) ? db.orders : [];
  if (rawOrders.length > 0) {
    console.log(`\n3. กำลังบันทึก Orders (${rawOrders.length} รายการ)...`);
    const ordersToInsert = rawOrders.map(o => ({
      id: String(o.id),
      customer_name: String(o.customerName || "Customer"),
      email: o.email || null,
      product_name: String(o.productName || "Product"),
      brand: String(o.brand || "Brand"),
      channel: String(o.channel || "Shopee"),
      total: Number(o.total) || 0,
      quantity: Number(o.quantity) || 1,
      status: o.status || "Paid",
      date: (o.date && o.date.length === 10) ? o.date : new Date().toISOString().split("T")[0],
      shipping_fee: Number(o.shippingFee) || 0,
      platform_fee: Number(o.platformFee) || 0,
      net_income: Number(o.netIncome) || 0
    }));

    // Chunk insert
    const chunkSize = 100;
    for (let i = 0; i < ordersToInsert.length; i += chunkSize) {
      const chunk = ordersToInsert.slice(i, i + chunkSize);
      const { error: ordErr } = await supabase.from('Income').upsert(chunk);
      if (ordErr) {
        console.error(`❌ Order chunk ${i}-${i + chunk.length} error:`, ordErr.message);
      }
    }
    console.log(`✅ Orders บันทึกสำเร็จ!`);
  }

  // 4. Audit Log
  const initialAudit = [{
    id: "LOG-" + Date.now(),
    action: "Initial Setup",
    target_type: "system",
    target_id: "ALL",
    timestamp: new Date().toLocaleString('th-TH'),
    performed_by: "คุณภาณวดี",
    details: "เริ่มต้นระบบฐานข้อมูล Supabase เรียบร้อยแล้ว",
    new_data: JSON.stringify({ seededAt: new Date().toISOString() })
  }];
  await supabase.from('audit_logs').upsert(initialAudit);

  console.log("\n🎉 เสร็จสิ้นการ Seed Data ขึ้น Supabase 100%!");
}

main().catch(console.error);
