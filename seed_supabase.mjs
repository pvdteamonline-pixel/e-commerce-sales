import { createClient } from "@supabase/supabase-js";
import { initialUsersList, initialProducts, initialOrders } from "./src/mockData.js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://caivuiyvkgqpyrdijuhn.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_B7iIZLAYD0Vt9ht08XE6KQ_ZsgveKKb";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  console.log("🚀 กำลังนำเข้าข้อมูลเริ่มต้น (Seed Data) สู่ Supabase...\n");

  // 1. Seed Users
  console.log("1. กำลังบันทึกข้อมูลผู้ใช้งาน (Users)...");
  const usersToInsert = initialUsersList.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    role: u.role,
    status: u.status,
    password: u.password,
    tasks: u.tasks || []
  }));

  const { error: userErr } = await supabase.from('users').upsert(usersToInsert);
  if (userErr) {
    console.error("❌ เกิดข้อผิดพลาดในการบันทึก Users:", userErr.message);
  } else {
    console.log(`✅ บันทึกผู้ใช้สำเร็จ: ${usersToInsert.length} คน`);
  }

  // 2. Seed Products
  console.log("\n2. กำลังบันทึกข้อมูลสินค้า (Products)...");
  const productsToInsert = initialProducts.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    brand: p.brand,
    price: p.price,
    sales: p.sales || 0,
    revenue: p.revenue || 0,
    stock: p.stock || 0,
    status: p.status
  }));

  const { error: prodErr } = await supabase.from('Orders').upsert(productsToInsert);
  if (prodErr) {
    console.error("❌ เกิดข้อผิดพลาดในการบันทึก Products:", prodErr.message);
  } else {
    console.log(`✅ บันทึกสินค้าสำเร็จ: ${productsToInsert.length} รายการ`);
  }

  // 3. Seed Orders
  console.log("\n3. กำลังบันทึกข้อมูลคำสั่งซื้อ (Orders)...");
  const ordersToInsert = initialOrders.map(o => ({
    id: o.id,
    customer_name: o.customerName,
    email: o.email || null,
    product_name: o.productName,
    brand: o.brand,
    channel: o.channel,
    total: o.total || 0,
    quantity: o.quantity || 1,
    status: o.status,
    date: o.date,
    shipping_fee: o.shippingFee || 0,
    platform_fee: o.platformFee || 0,
    net_income: o.netIncome || 0
  }));

  const { error: orderErr } = await supabase.from('Income').upsert(ordersToInsert);
  if (orderErr) {
    console.error("❌ เกิดข้อผิดพลาดในการบันทึก Orders:", orderErr.message);
  } else {
    console.log(`✅ บันทึกออเดอร์สำเร็จ: ${ordersToInsert.length} รายการ`);
  }

  // 4. Initial Audit Log
  console.log("\n4. บันทึกประวัติเริ่มต้น (Audit Log)...");
  const initialAuditLog = [{
    id: "LOG-" + Date.now(),
    action: "SEED_DATABASE",
    target_type: "System",
    target_id: "ALL",
    timestamp: new Date().toISOString(),
    performed_by: "System Admin",
    details: "นำเข้าข้อมูลเริ่มต้น (Mock Data to Supabase) เรียบร้อยแล้ว",
    new_data: JSON.stringify({ users: usersToInsert.length, products: productsToInsert.length, orders: ordersToInsert.length })
  }];

  const { error: auditErr } = await supabase.from('audit_logs').upsert(initialAuditLog);
  if (auditErr) {
    console.error("❌ เกิดข้อผิดพลาดในการบันทึก Audit Log:", auditErr.message);
  } else {
    console.log("✅ บันทึก Audit Log เริ่มต้นสำเร็จ");
  }

  console.log("\n🎉 นำเข้าข้อมูลทั้งหมดขึ้น Supabase สำเร็จเรียบร้อย!");
}

seed();
