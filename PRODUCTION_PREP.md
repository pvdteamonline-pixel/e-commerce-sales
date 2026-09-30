# คู่มือเตรียมความพร้อมเชื่อมต่อระบบฐานข้อมูลจริง (Production Setup Guide)

คู่มือฉบับนี้ใช้สำหรับเตรียมความพร้อมในการเปลี่ยนผ่านระบบบันทึกยอดขายอีคอมเมิร์ซจากการจำลองข้อมูล (Mock Data) ไปใช้งานระบบจริงโดยใช้ **Supabase (PostgreSQL)**

---

## 1. การเตรียม Database Schema ใน Supabase

ให้รันคำสั่ง SQL ด้านล่างนี้ในช่อง **SQL Editor** ของ Supabase เพื่อสร้างตารางทั้งหมด:

### ตารางพนักงานและระดับสิทธิ์ (`users`)
```sql
create table public.users (
  id text primary key,
  name text not null,
  email text unique not null,
  username text unique not null,
  role text not null check (role in ('Admin', 'Manager', 'User')),
  status text not null check (status in ('Active', 'Inactive')),
  password text not null,
  tasks text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### ตารางสินค้า (`products`)
```sql
create table public.products (
  id text primary key,
  name text not null,
  category text not null,
  brand text not null,
  price numeric(10, 2) not null,
  sales integer default 0,
  revenue numeric(12, 2) default 0.00,
  stock integer default 0,
  status text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### ตารางออเดอร์ยอดขาย (`orders`)
```sql
create table public.orders (
  id text primary key,
  customer_name text not null,
  email text,
  product_name text not null,
  brand text not null,
  channel text not null,
  total numeric(10, 2) not null,
  quantity integer not null,
  status text not null,
  date date not null,
  shipping_fee numeric(10, 2) default 0.00,
  platform_fee numeric(10, 2) default 0.00,
  net_income numeric(10, 2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### ตารางบันทึกประวัติการแก้ไข (`audit_logs`)
```sql
create table public.audit_logs (
  id text primary key,
  action text not null,
  target_type text not null,
  target_id text not null,
  timestamp text not null,
  performed_by text not null,
  details text not null,
  new_data text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

---

## 2. การกำหนดค่า Environment Variables

1. สร้างไฟล์ `.env` ไว้ที่โฟลเดอร์นอกสุดของโปรเจกต์ (คู่ขนานกับ `package.json`)
2. ใส่ค่าเชื่อมต่อดังนี้:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 3. ขั้นตอนการเปลี่ยนโค้ด (Mock -> Database)

ไฟล์หลักที่ต้องสลับฟังก์ชันเชื่อมต่อคือ `src/App.tsx`:

1. **การดึงข้อมูลเริ่มต้น (Fetch Data):**
   แทนที่ `useState(initialOrders)`, `useState(initialProducts)`, `useState(initialUsersList)` ด้วย `useEffect` ดึงข้อมูลจาก Supabase:
   ```typescript
   useEffect(() => {
     const fetchData = async () => {
       const { data: userData } = await supabase.from('users').select('*');
       if (userData) setSystemUsers(userData);
       
       const { data: productData } = await supabase.from('products').select('*');
       if (productData) setProducts(productData);

       const { data: orderData } = await supabase.from('orders').select('*');
       if (orderData) setOrders(orderData);
     };
     fetchData();
   }, []);
   ```

2. **การบันทึกข้อมูล (Write Data):**
   - เมื่อสร้างผู้ใช้: ใช้ `.insert()` แทนการอัปเดต state ในเครื่อง
     ```typescript
     const { data, error } = await supabase.from('users').insert([newUser]);
     ```
   - เมื่อแก้ไขสิทธิ์พนักงาน:
     ```typescript
     const { error } = await supabase
       .from('users')
       .update({ tasks: newTasks })
       .eq('id', userId);
     ```

3. **รหัสผ่านพนักงาน (Password Hash):**
   เพื่อระบบที่ปลอดภัย ควรทำระบบ Authentication จริงผ่าน `supabase.auth.signUp()` แทนการเก็บรหัสผ่านเป็นตัวอักษรธรรมดา (Plain text) ในฐานข้อมูลตารางพนักงาน
