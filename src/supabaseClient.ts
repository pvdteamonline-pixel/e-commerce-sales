import { createClient } from "@supabase/supabase-js";

// ใส่ Supabase URL และ Anon Key ของคุณที่นี่เพื่อเชื่อมต่อระบบฐานข้อมูลจริง
// วิธีที่แนะนำ: สร้างไฟล์ .env ในระดับนอกสุด (root) ของโปรเจกต์:
// VITE_SUPABASE_URL=https://your-project-url.supabase.co
// VITE_SUPABASE_ANON_KEY=your-anon-key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://caivuiyvkgqpyrdijuhn.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_B7iIZLAYD0Vt9ht08XE6KQ_ZsgveKKb";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
