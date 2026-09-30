import React, { useState, useEffect } from "react";
import {
  UserSquare2,
  Lock,
  EyeOff,
  Eye,
  Sun,
  Moon,
  Globe,
  Users,
  Activity,
  X,
  Check,
  ArrowRight,
  Sparkles,
  KeyRound,
  ShieldAlert,
  Clock,
  ShieldCheck,
  Copy,
  CheckCheck
} from "lucide-react";
import type { AppUser } from "../types";
import { getLoginLockoutStatus, type LockoutStatus } from "../utils/security";

interface LoginScreenProps {
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  loginIdentifier: string;
  setLoginIdentifier: (val: string) => void;
  loginPassword: string;
  setLoginPassword: (val: string) => void;
  showPassword: boolean;
  setShowPassword: (val: boolean) => void;
  loginError: string | null;
  setLoginError: (val: string | null) => void;
  handleLoginSubmit: (e: React.FormEvent) => void;
  systemUsers: AppUser[];
  onResetPassword: (userId: string, newPass: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  isDarkMode,
  setIsDarkMode,
  loginIdentifier,
  setLoginIdentifier,
  loginPassword,
  setLoginPassword,
  showPassword,
  setShowPassword,
  loginError,
  setLoginError,
  handleLoginSubmit,
  systemUsers,
  onResetPassword,
}) => {
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [foundUser, setFoundUser] = useState<AppUser | null>(null);
  const [securityCode, setSecurityCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [copiedTicket, setCopiedTicket] = useState(false);

  // Lockout countdown state
  const [lockout, setLockout] = useState<LockoutStatus>(getLoginLockoutStatus());

  useEffect(() => {
    const timer = setInterval(() => {
      const currentStatus = getLoginLockoutStatus();
      setLockout(currentStatus);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleForgotNext = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    if (!forgotIdentifier) return;

    const usr = systemUsers.find(
      (u) =>
        u.email.toLowerCase() === forgotIdentifier.toLowerCase() ||
        u.username.toLowerCase() === forgotIdentifier.toLowerCase(),
    );

    if (!usr) {
      setForgotError("ไม่พบชื่อผู้ใช้งานหรืออีเมลนี้ในระบบ");
      return;
    }

    if (usr.status === "Inactive") {
      setForgotError("บัญชีผู้ใช้งานนี้ถูกระงับการใช้งานชั่วคราว");
      return;
    }

    setFoundUser(usr);
    setForgotStep(2);
  };

  const handleForgotReset = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    if (!foundUser) return;

    // Security Verification: Require Security Code (Default master PIN: SEC-2026 or admin password)
    const validPins = ["SEC-2026", "admin1234", "8888"];
    if (!validPins.includes(securityCode.trim())) {
      setForgotError("รหัสยืนยันความปลอดภัย (Master Security PIN) ไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ");
      return;
    }

    if (newPassword.length < 4) {
      setForgotError("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setForgotError("รหัสผ่านยืนยันไม่ตรงกับรหัสผ่านใหม่");
      return;
    }

    onResetPassword(foundUser.id, newPassword);
    setForgotStep(3);
  };

  const closeForgotModal = () => {
    setIsForgotModalOpen(false);
    setTimeout(() => {
      setForgotIdentifier("");
      setForgotStep(1);
      setFoundUser(null);
      setSecurityCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      setForgotError(null);
      setShowForgotNewPassword(false);
      setCopiedTicket(false);
    }, 300);
  };

  const handleCopyTicket = () => {
    if (!foundUser) return;
    const ticketText = `[คำขอรีเซ็ตรหัสผ่าน]\nบัญชี: ${foundUser.username} (${foundUser.name})\nอีเมล: ${foundUser.email}\nเวลา: ${new Date().toLocaleString("th-TH")}\nกรุณาให้ผู้ดูแลระบบรีเซ็ตให้ในหน้าจัดการผู้ใช้`;
    navigator.clipboard.writeText(ticketText);
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2500);
  };

  const handleSuccessFinish = () => {
    if (foundUser) {
      setLoginIdentifier(foundUser.username);
      setLoginPassword(newPassword);
    }
    closeForgotModal();
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center font-sans transition-colors duration-700 relative overflow-hidden ${
        isDarkMode
          ? "bg-[#09090b] text-[#f4f4f5]"
          : "bg-[#fafafa] text-[#18181b]"
      }`}
    >
      {/* Luxury Ambient Glows */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <div
          className={`absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[140px] transition-opacity duration-1000 ${
            isDarkMode
              ? "bg-gradient-to-br from-indigo-950/40 via-purple-900/20 to-transparent opacity-60"
              : "bg-gradient-to-br from-blue-200/40 via-indigo-100/30 to-amber-100/30 opacity-70"
          }`}
        />
        <div
          className={`absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full blur-[150px] transition-opacity duration-1000 ${
            isDarkMode
              ? "bg-gradient-to-tl from-zinc-800/30 via-slate-900/20 to-transparent opacity-50"
              : "bg-gradient-to-tl from-slate-200/50 via-zinc-100/50 to-transparent opacity-70"
          }`}
        />
      </div>

      {/* Subtle Micro Dot Mesh */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
          isDarkMode
            ? "opacity-[0.15] [background-image:radial-gradient(rgba(255,255,255,0.4)_1px,transparent_1px)] [background-size:24px_24px]"
            : "opacity-[0.35] [background-image:radial-gradient(rgba(0,0,0,0.12)_1px,transparent_1px)] [background-size:24px_24px]"
        }`}
      />

      {/* Top Floating Controls */}
      <header className="absolute top-6 right-6 sm:top-8 sm:right-10 z-30 flex items-center gap-3">
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-medium tracking-wide backdrop-blur-xl border transition-all duration-300 cursor-pointer select-none active:scale-95 shadow-sm ${
            isDarkMode
              ? "bg-zinc-900/80 border-white/[0.08] text-zinc-300 hover:text-white hover:bg-zinc-800/90 hover:border-white/15"
              : "bg-white/80 border-zinc-200/80 text-zinc-700 hover:text-black hover:bg-white hover:border-zinc-300 shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
          }`}
          title={isDarkMode ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
        >
          {isDarkMode ? (
            <>
              <Sun className="h-3.5 w-3.5 text-amber-400" />
              <span>โหมดสว่าง</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5 text-zinc-600" />
              <span>โหมดมืด</span>
            </>
          )}
        </button>
      </header>

      {/* Main Split Layout Container */}
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between min-h-screen relative z-10 px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        
        {/* Left Hero / Brand Showcase (Desktop) */}
        <div className="hidden lg:flex lg:w-[48%] flex-col justify-between py-6 pr-6 xl:pr-12">
          <div className="space-y-8">
            {/* Brand Logo with Ambient Glow */}
            <div className="inline-block relative">
              <img
                src="/logo.png"
                alt="Phanvadee Logo"
                style={{ maxHeight: "115px", width: "auto", objectFit: "contain" }}
                className={`h-24 max-h-[115px] w-auto object-contain transition-all duration-500 select-none drop-shadow-sm ${
                  isDarkMode ? "invert brightness-200 drop-shadow-[0_4px_20px_rgba(255,255,255,0.08)]" : ""
                }`}
              />
            </div>

            {/* Badge & Typography */}
            <div className="space-y-5 max-w-lg">
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase backdrop-blur-md border transition-all ${
                  isDarkMode
                    ? "bg-zinc-900/90 text-zinc-300 border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                    : "bg-white/90 text-zinc-800 border-zinc-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                <span>Smart Commerce Platform</span>
              </div>

              <div className="space-y-3">
                <h1 className="text-4xl xl:text-[46px] font-extrabold tracking-tight leading-[1.18]">
                  ระบบ
                  <span
                    className={`ml-2.5 transition-colors duration-300 ${
                      isDarkMode
                        ? "text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400"
                        : "text-zinc-950"
                    }`}
                  >
                    บันทึกยอดขาย
                  </span>
                </h1>
                <p
                  className={`text-2xl xl:text-3xl font-semibold tracking-tight ${
                    isDarkMode ? "text-zinc-400" : "text-zinc-600"
                  }`}
                >
                  และจัดการธุรกิจอัจฉริยะ
                </p>
              </div>

              <p
                className={`text-sm font-normal leading-relaxed max-w-md ${
                  isDarkMode ? "text-zinc-400/90" : "text-zinc-600"
                }`}
              >
                รวมศูนย์ข้อมูลคำสั่งซื้อ ติดตามสต็อกสินค้า วิเคราะห์รายได้แบบเรียลไทม์ และบริหารทีมงานได้อย่างราบรื่นในแพลตฟอร์มเดียว
              </p>
            </div>
          </div>

          {/* Minimalist Feature Cards & Status */}
          <div className="space-y-6 pt-10">
            <div className="grid grid-cols-3 gap-3.5">
              {[
                {
                  icon: <Globe className="h-4 w-4" />,
                  title: "6+ ช่องทาง",
                  desc: "Shopee, TikTok, Lazada",
                },
                {
                  icon: <Users className="h-4 w-4" />,
                  title: "ผู้ใช้งานไม่จำกัด",
                  desc: "กำหนดสิทธิ์ตามบทบาท",
                },
                {
                  icon: <Activity className="h-4 w-4" />,
                  title: "100% Real-time",
                  desc: "อัปเดตข้อมูลอัตโนมัติ",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 ${
                    isDarkMode
                      ? "bg-zinc-900/40 border-white/[0.06] hover:bg-zinc-900/80 hover:border-white/12 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                      : "bg-white/80 border-zinc-200/80 hover:bg-white hover:border-zinc-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.04)] shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                  }`}
                >
                  <div
                    className={`p-2 w-fit rounded-xl mb-3 ${
                      isDarkMode
                        ? "bg-zinc-800 text-zinc-200 border border-white/[0.06]"
                        : "bg-zinc-100 text-zinc-800 border border-zinc-200/60"
                    }`}
                  >
                    {item.icon}
                  </div>
                  <h4 className="font-bold text-xs tracking-tight mb-1 text-zinc-900 dark:text-zinc-100">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* System Status Pill */}
            <div
              className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-medium border backdrop-blur-md ${
                isDarkMode
                  ? "bg-zinc-900/60 border-white/[0.06] text-zinc-400"
                  : "bg-white/70 border-zinc-200/80 text-zinc-600 shadow-[0_2px_6px_rgba(0,0,0,0.02)]"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>เซิร์ฟเวอร์พร้อมใช้งาน (100% System Operational)</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel (Desktop & Mobile) */}
        <div className="w-full lg:w-[48%] xl:w-[44%] flex items-center justify-center py-4">
          <div
            className={`w-full max-w-md p-8 sm:p-10 rounded-[28px] border transition-all duration-500 relative ${
              isDarkMode
                ? "bg-[#111115]/90 border-white/[0.08] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85),inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-2xl"
                : "bg-white/95 border-zinc-200/80 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.02)] backdrop-blur-2xl"
            }`}
          >
            {/* Mobile Logo */}
            <div className="lg:hidden flex flex-col items-center justify-center mb-7 text-center">
              <img
                src="/logo.png"
                alt="Phanvadee Logo"
                style={{ maxHeight: "80px", width: "auto", objectFit: "contain" }}
                className={`h-16 sm:h-20 max-h-[80px] w-auto object-contain mb-3.5 transition-all ${
                  isDarkMode ? "invert brightness-200 drop-shadow-[0_2px_12px_rgba(255,255,255,0.1)]" : ""
                }`}
              />
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                  isDarkMode
                    ? "bg-zinc-900 text-zinc-300 border-white/10"
                    : "bg-zinc-100 text-zinc-700 border-zinc-200"
                }`}
              >
                ระบบบันทึกยอดขาย
              </span>
            </div>

            {/* Form Title */}
            <div className="mb-7">
              <h2 className="text-2xl sm:text-[26px] font-extrabold tracking-tight mb-1.5 text-zinc-900 dark:text-white">
                เข้าสู่ระบบ
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                กรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งานระบบ
              </p>
            </div>

            {/* Lockout Security Warning */}
            {lockout.isLocked && (
              <div
                className={`p-4 rounded-2xl border mb-6 flex items-start gap-3 animate-fade-in ${
                  isDarkMode
                    ? "bg-rose-950/40 border-rose-800/60 text-rose-200"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 shrink-0 mt-0.5">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold flex items-center gap-1.5">
                    <span>ระบบถูกระงับชั่วคราวเพื่อความปลอดภัย</span>
                    <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400">
                      <Clock className="h-3 w-3" />
                      {lockout.remainingSeconds}s
                    </span>
                  </h4>
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    มีการกรอกรหัสผ่านผิดเกิน 5 ครั้ง ระบบได้ระงับการเข้าสู่ระบบชั่วคราวเพื่อป้องกันการโจมตี กรุณารอเวลานับถอยหลัง
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {loginError && !lockout.isLocked && (
              <div
                className={`text-xs font-semibold px-4 py-3 rounded-xl border mb-6 animate-fade-in flex items-center gap-2.5 ${
                  isDarkMode
                    ? "bg-rose-950/30 border-rose-900/50 text-rose-300"
                    : "bg-rose-50 border-rose-200 text-rose-600"
                }`}
              >
                <div className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Main Login Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4.5">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>ชื่อผู้ใช้ หรือ อีเมล</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                    <UserSquare2 className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    disabled={lockout.isLocked}
                    placeholder="กรอกชื่อผู้ใช้ หรือ อีเมล"
                    value={loginIdentifier}
                    onChange={(e) => {
                      setLoginIdentifier(e.target.value);
                      setLoginError(null);
                    }}
                    className={`w-full h-11 sm:h-12 rounded-xl pl-10 pr-4 text-sm outline-none transition-all duration-200 border ${
                      lockout.isLocked
                        ? "opacity-50 cursor-not-allowed bg-zinc-200 dark:bg-zinc-800 border-transparent"
                        : isDarkMode
                          ? "bg-zinc-900/70 text-white placeholder-zinc-500 border-zinc-800 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 focus:bg-zinc-900"
                          : "bg-zinc-50/80 text-zinc-900 placeholder-zinc-400 border-zinc-200 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:bg-white"
                    }`}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    รหัสผ่าน
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    ลืมรหัสผ่าน?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={lockout.isLocked}
                    placeholder="กรอกรหัสผ่านของคุณ"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      setLoginError(null);
                    }}
                    className={`w-full h-11 sm:h-12 rounded-xl pl-10 pr-10 text-sm outline-none transition-all duration-200 border ${
                      lockout.isLocked
                        ? "opacity-50 cursor-not-allowed bg-zinc-200 dark:bg-zinc-800 border-transparent"
                        : isDarkMode
                          ? "bg-zinc-900/70 text-white placeholder-zinc-500 border-zinc-800 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 focus:bg-zinc-900"
                          : "bg-zinc-50/80 text-zinc-900 placeholder-zinc-400 border-zinc-200 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:bg-white"
                    }`}
                  />
                  <button
                    type="button"
                    disabled={lockout.isLocked}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-1 cursor-pointer disabled:opacity-30"
                    title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Checkbox */}
              <div className="flex items-center pt-0.5 pb-1">
                <label className="flex items-center gap-2.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled={lockout.isLocked}
                    className="rounded-md border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white focus:ring-zinc-900 dark:focus:ring-zinc-100 cursor-pointer h-4 w-4"
                  />
                  <span>จดจำการเข้าสู่ระบบไว้ในอุปกรณ์นี้</span>
                </label>
              </div>

              {/* Luxury High-Contrast Submit Button */}
              <button
                type="submit"
                disabled={lockout.isLocked}
                className={`w-full h-11 sm:h-12 font-bold text-sm rounded-xl transition-all duration-300 active:scale-[0.985] cursor-pointer flex items-center justify-center gap-2 group shadow-md ${
                  lockout.isLocked
                    ? "opacity-50 cursor-not-allowed bg-zinc-400 dark:bg-zinc-700 text-zinc-200"
                    : isDarkMode
                      ? "bg-white hover:bg-zinc-100 text-black shadow-[0_4px_20px_rgba(255,255,255,0.15)] hover:shadow-[0_6px_25px_rgba(255,255,255,0.25)]"
                      : "bg-zinc-950 hover:bg-zinc-900 text-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_25px_rgba(0,0,0,0.25)]"
                }`}
              >
                <span>{lockout.isLocked ? `ถูกระงับชั่วคราว (${lockout.remainingSeconds}s)` : "เข้าสู่ระบบ"}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
            onClick={closeForgotModal}
          />

          {/* Modal Container */}
          <div
            className={`relative w-full max-w-md p-8 sm:p-9 rounded-[28px] border shadow-2xl z-10 transition-all transform duration-300 ${
              isDarkMode
                ? "bg-[#121216]/95 border-white/[0.08] text-white shadow-[0_25px_70px_rgba(0,0,0,0.9)]"
                : "bg-white/95 border-zinc-200 text-zinc-900 shadow-[0_25px_60px_rgba(0,0,0,0.12)]"
            }`}
          >
            {/* Close Button */}
            <button
              onClick={closeForgotModal}
              className={`absolute top-5 right-5 p-1.5 rounded-full transition-colors cursor-pointer ${
                isDarkMode
                  ? "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  : "text-zinc-400 hover:text-black hover:bg-zinc-100"
              }`}
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="mb-6">
              <div
                className={`p-2.5 w-fit rounded-2xl mb-3.5 border ${
                  isDarkMode
                    ? "bg-zinc-800/80 text-zinc-200 border-white/[0.08]"
                    : "bg-zinc-100 text-zinc-800 border-zinc-200"
                }`}
              >
                <KeyRound className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-black tracking-tight">
                รีเซ็ตรหัสผ่านปลอดภัย
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {forgotStep === 1 && "ระบุชื่อผู้ใช้หรืออีเมลเพื่อค้นหาบัญชี"}
                {forgotStep === 2 && `ยืนยันความปลอดภัยเพื่อตั้งรหัสผ่านสำหรับ ${foundUser?.name}`}
                {forgotStep === 3 && "เปลี่ยนรหัสผ่านเสร็จเรียบร้อยแล้ว"}
              </p>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-1.5 mb-6">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    forgotStep >= step
                      ? isDarkMode
                        ? "bg-white"
                        : "bg-zinc-900"
                      : isDarkMode
                        ? "bg-zinc-800"
                        : "bg-zinc-200"
                  }`}
                />
              ))}
            </div>

            {/* Error alerts */}
            {forgotError && (
              <div
                className={`text-xs font-semibold text-center px-4 py-3 mb-4 rounded-xl border ${
                  isDarkMode
                    ? "bg-rose-950/30 border-rose-900/50 text-rose-300"
                    : "bg-rose-50 border-rose-200 text-rose-600"
                }`}
              >
                {forgotError}
              </div>
            )}

            {/* Step 1: Search Account */}
            {forgotStep === 1 && (
              <form onSubmit={handleForgotNext} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    ชื่อผู้ใช้งาน หรือ อีเมล
                  </label>
                  <div className="relative">
                    <UserSquare2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      required
                      placeholder="ใส่ username หรือ email"
                      value={forgotIdentifier}
                      onChange={(e) => {
                        setForgotIdentifier(e.target.value);
                        setForgotError(null);
                      }}
                      className={`w-full h-11 sm:h-12 rounded-xl pl-10 pr-4 text-sm outline-none transition-all duration-200 border ${
                        isDarkMode
                          ? "bg-zinc-900 text-white placeholder-zinc-500 border-zinc-800 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
                          : "bg-zinc-50 text-zinc-900 placeholder-zinc-400 border-zinc-200 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:bg-white"
                      }`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full h-11 sm:h-12 font-bold text-sm rounded-xl transition-all duration-300 active:scale-[0.985] cursor-pointer shadow-md ${
                    isDarkMode
                      ? "bg-white hover:bg-zinc-100 text-black"
                      : "bg-zinc-950 hover:bg-zinc-900 text-white"
                  }`}
                >
                  ค้นหาบัญชี
                </button>
              </form>
            )}

            {/* Step 2: Security Verification & Reset Password */}
            {forgotStep === 2 && (
              <form onSubmit={handleForgotReset} className="space-y-4">
                {/* Security PIN requirement */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <span>รหัสยืนยันความปลอดภัย (Master PIN)</span>
                    </label>
                    <span className="text-[10px] text-zinc-400">PIN: SEC-2026</span>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      placeholder="กรอกรหัสความปลอดภัย หรือ PIN ผู้ดูแลระบบ"
                      value={securityCode}
                      onChange={(e) => {
                        setSecurityCode(e.target.value);
                        setForgotError(null);
                      }}
                      className={`w-full h-11 rounded-xl px-4 text-sm outline-none transition-all duration-200 border ${
                        isDarkMode
                          ? "bg-zinc-900 text-white placeholder-zinc-500 border-zinc-800 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
                          : "bg-zinc-50 text-zinc-900 placeholder-zinc-400 border-zinc-200 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:bg-white"
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    รหัสผ่านใหม่
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    <input
                      type={showForgotNewPassword ? "text" : "password"}
                      required
                      placeholder="ความยาวขั้นต่ำ 4 ตัวอักษร"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setForgotError(null);
                      }}
                      className={`w-full h-11 rounded-xl pl-10 pr-10 text-sm outline-none transition-all duration-200 border ${
                        isDarkMode
                          ? "bg-zinc-900 text-white placeholder-zinc-500 border-zinc-800 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
                          : "bg-zinc-50 text-zinc-900 placeholder-zinc-400 border-zinc-200 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:bg-white"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowForgotNewPassword(!showForgotNewPassword)
                      }
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      {showForgotNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    ยืนยันรหัสผ่านใหม่
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    <input
                      type={showForgotNewPassword ? "text" : "password"}
                      required
                      placeholder="ใส่รหัสผ่านใหม่อีกครั้ง"
                      value={confirmNewPassword}
                      onChange={(e) => {
                        setConfirmNewPassword(e.target.value);
                        setForgotError(null);
                      }}
                      className={`w-full h-11 rounded-xl pl-10 pr-10 text-sm outline-none transition-all duration-200 border ${
                        isDarkMode
                          ? "bg-zinc-900 text-white placeholder-zinc-500 border-zinc-800 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
                          : "bg-zinc-50 text-zinc-900 placeholder-zinc-400 border-zinc-200 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 focus:bg-white"
                      }`}
                    />
                  </div>
                </div>

                <div className="pt-1 flex flex-col gap-2">
                  <button
                    type="submit"
                    className={`w-full h-11 font-bold text-sm rounded-xl transition-all duration-300 active:scale-[0.985] cursor-pointer shadow-md ${
                      isDarkMode
                        ? "bg-white hover:bg-zinc-100 text-black"
                        : "bg-zinc-950 hover:bg-zinc-900 text-white"
                    }`}
                  >
                    ยืนยันเปลี่ยนรหัสผ่าน
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyTicket}
                    className={`w-full h-9 text-xs font-medium rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isDarkMode
                        ? "border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                        : "border-zinc-200 text-zinc-600 hover:text-black hover:bg-zinc-50"
                    }`}
                  >
                    {copiedTicket ? (
                      <>
                        <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-emerald-500">คัดลอกคำขอแล้ว! ส่งต่อให้ Admin ได้ทันที</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>คัดลอกคำขอรีเซ็ตเพื่อส่งให้ผู้ดูแลระบบ</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Success State */}
            {forgotStep === 3 && (
              <div className="text-center py-6 space-y-4">
                <div
                  className={`inline-flex items-center justify-center h-14 w-14 rounded-full mb-1 ${
                    isDarkMode
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  }`}
                >
                  <Check className="h-7 w-7" />
                </div>
                <h4 className="text-lg font-black">
                  เปลี่ยนรหัสผ่านสำเร็จ!
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  ระบบได้บันทึกรหัสผ่านใหม่เรียบร้อยแล้ว สามารถกดปุ่มด้านล่างเพื่อกลับไปเข้าสู่ระบบ
                </p>
                <button
                  onClick={handleSuccessFinish}
                  className={`w-full h-11 sm:h-12 font-bold text-sm rounded-xl transition-all duration-300 active:scale-[0.985] cursor-pointer shadow-md ${
                    isDarkMode
                      ? "bg-white hover:bg-zinc-100 text-black"
                      : "bg-zinc-950 hover:bg-zinc-900 text-white"
                  }`}
                >
                  กลับไปหน้าเข้าสู่ระบบ
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
