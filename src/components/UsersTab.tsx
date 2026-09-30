import React, { useState, useMemo, useEffect } from "react";
import {
  UserPlus,
  Shield,
  ShieldCheck,
  Crown,
  Trash2,
  Lock,
  X,
  Sliders,
  LayoutDashboard,
  ShoppingBag,
  Calculator,
  Upload,
  Users,
  Search,
  Copy,
  Check,
  Briefcase,
  Mail,
  LayoutGrid,
  List,
  Sparkles,
} from "lucide-react";
import type { AppUser } from "../types";
import { getInitials } from "../utils";

interface UsersTabProps {
  isDarkMode: boolean;
  currentUser: AppUser;
  systemUsers: AppUser[];
  searchQuery: string;
  setIsAddUserOpen: (val: boolean) => void;
  handleDeleteUser: (id: string) => void;
  toggleUserStatus: (id: string) => void;
  requestConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
  ) => void;
  handleUpdateUserTasks: (userId: string, tasks: string[]) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const UsersTabComponent: React.FC<UsersTabProps> = ({
  isDarkMode,
  currentUser,
  systemUsers,
  searchQuery: externalSearchQuery,
  setIsAddUserOpen,
  handleDeleteUser,
  toggleUserStatus,
  requestConfirm,
  handleUpdateUserTasks,
  onDirtyChange,
}) => {
  const [selectedUserForTasks, setSelectedUserForTasks] = useState<AppUser | null>(null);
  const [isTasksModalDirty, setIsTasksModalDirty] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"All" | "Admin" | "Manager" | "User">("All");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSelectUserForTasks = (user: AppUser | null) => {
    setSelectedUserForTasks(user);
    if (!user) {
      setIsTasksModalDirty(false);
    }
  };

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isTasksModalDirty);
    }
  }, [isTasksModalDirty, onDirtyChange]);

  const effectiveSearch = (localSearch || externalSearchQuery || "").trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    return systemUsers.filter((usr) => {
      // Search filter
      const matchesSearch =
        !effectiveSearch ||
        usr.name.toLowerCase().includes(effectiveSearch) ||
        usr.email.toLowerCase().includes(effectiveSearch) ||
        usr.username.toLowerCase().includes(effectiveSearch) ||
        usr.id.toLowerCase().includes(effectiveSearch) ||
        usr.role.toLowerCase().includes(effectiveSearch);

      // Role filter
      let matchesRole = true;
      if (roleFilter === "Admin") matchesRole = usr.role === "Admin";
      else if (roleFilter === "Manager") matchesRole = usr.role === "Manager";
      else if (roleFilter === "User") matchesRole = usr.role === "User";

      return matchesSearch && matchesRole;
    });
  }, [systemUsers, effectiveSearch, roleFilter]);

  const stats = useMemo(() => {
    const total = systemUsers.length;
    const adminCount = systemUsers.filter((u) => u.role === "Admin").length;
    const managerCount = systemUsers.filter((u) => u.role === "Manager").length;
    const userCount = systemUsers.filter((u) => u.role === "User").length;
    const activeCount = systemUsers.filter((u) => u.status === "Active").length;
    return { total, adminCount, managerCount, userCount, activeCount };
  }, [systemUsers]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const roleMeta = (role: AppUser["role"]) => {
    switch (role) {
      case "Admin":
        return {
          label: "แอดมิน (Admin)",
          badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 shadow-xs",
          icon: Crown,
          avatarRing: "ring-2 ring-purple-500/30",
          gradient: "from-purple-500/20 to-indigo-500/20",
        };
      case "Manager":
        return {
          label: "ผู้จัดการ (Manager)",
          badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 shadow-xs",
          icon: ShieldCheck,
          avatarRing: "ring-2 ring-blue-500/30",
          gradient: "from-blue-500/20 to-cyan-500/20",
        };
      default:
        return {
          label: "พนักงาน (Staff)",
          badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-xs",
          icon: Shield,
          avatarRing: "ring-2 ring-emerald-500/30",
          gradient: "from-emerald-500/20 to-teal-500/20",
        };
    }
  };

  const canManage = (target: AppUser) => {
    if (currentUser.role === "Admin") return target.id !== currentUser.id;
    if (currentUser.role === "Manager")
      return target.role === "User" && target.id !== currentUser.id;
    return false;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. HERO / HEADER SECTION */}
      <div
        className={`relative overflow-hidden p-6 sm:p-7 rounded-3xl border transition-all duration-300 ${
          isDarkMode
            ? "bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent border-white/10 shadow-2xl"
            : "bg-gradient-to-br from-white via-white/90 to-slate-50 border-black/8 shadow-lg shadow-black/3"
        }`}
      >
        {/* Subtle Decorative Ambient Glow */}
        <div
          className={`absolute -right-20 -top-20 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-40 ${
            isDarkMode ? "bg-purple-600/15" : "bg-purple-400/15"
          }`}
        />
        <div
          className={`absolute -left-20 -bottom-20 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-40 ${
            isDarkMode ? "bg-blue-600/15" : "bg-blue-400/15"
          }`}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide border backdrop-blur-md bg-apple-secondary/60 border-apple-primary/10 text-apple-primary">
              <Sparkles className="h-3.5 w-3.5 text-purple-500 animate-pulse" />
              <span>ระบบบริหารจัดการทีมงานและสิทธิ์ผู้ใช้</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-apple-primary flex items-center gap-2.5">
              <span>การจัดการผู้ใช้งาน</span>
              <span className="text-xs font-black px-2.5 py-1 rounded-full bg-apple-primary/10 text-apple-secondary">
                {systemUsers.length} บัญชี
              </span>
            </h2>
            <p className="text-xs sm:text-sm font-medium text-apple-secondary max-w-xl leading-relaxed">
              เพิ่ม แก้ไข และกำหนดสิทธิ์การเข้าถึงหน้าจอและฟังก์ชันการทำงานสำหรับทีมงานทุกคนอย่างปลอดภัย
            </p>
          </div>

          {currentUser.role === "Admin" && (
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setIsAddUserOpen(true)}
                className="group relative inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm cursor-pointer shadow-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 hover:shadow-xl"
              >
                <UserPlus className="h-4 w-4 transition-transform group-hover:scale-110" />
                <span>เพิ่มผู้ใช้งานใหม่</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. STATS KPI CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-apple-primary/8">
          {/* Card: Total */}
          <div
            onClick={() => setRoleFilter("All")}
            className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
              roleFilter === "All"
                ? isDarkMode
                  ? "bg-white/10 border-white/20 shadow-md"
                  : "bg-white border-black/15 shadow-md ring-2 ring-black/5"
                : isDarkMode
                  ? "bg-white/[0.02] border-white/6 hover:bg-white/[0.05]"
                  : "bg-black/[0.015] border-black/5 hover:bg-black/[0.03]"
            }`}
          >
            <div className="flex items-center justify-between text-apple-secondary">
              <span className="text-[11px] font-bold">ผู้ใช้ทั้งหมด</span>
              <Users className="h-4 w-4 text-neutral-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-apple-primary">{stats.total}</span>
              <span className="text-[10px] font-bold text-emerald-500">
                {stats.activeCount} ใช้งานอยู่
              </span>
            </div>
          </div>

          {/* Card: Admin */}
          <div
            onClick={() => setRoleFilter("Admin")}
            className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
              roleFilter === "Admin"
                ? isDarkMode
                  ? "bg-purple-500/15 border-purple-500/30 shadow-md"
                  : "bg-purple-50 border-purple-200 shadow-md ring-2 ring-purple-500/10"
                : isDarkMode
                  ? "bg-white/[0.02] border-white/6 hover:bg-purple-500/5"
                  : "bg-black/[0.015] border-black/5 hover:bg-purple-50/50"
            }`}
          >
            <div className="flex items-center justify-between text-purple-500">
              <span className="text-[11px] font-bold">แอดมิน (Admin)</span>
              <Crown className="h-4 w-4" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-apple-primary">{stats.adminCount}</span>
              <span className="text-[10px] font-medium text-apple-secondary">สิทธิ์เต็มระบบ</span>
            </div>
          </div>

          {/* Card: Manager */}
          <div
            onClick={() => setRoleFilter("Manager")}
            className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
              roleFilter === "Manager"
                ? isDarkMode
                  ? "bg-blue-500/15 border-blue-500/30 shadow-md"
                  : "bg-blue-50 border-blue-200 shadow-md ring-2 ring-blue-500/10"
                : isDarkMode
                  ? "bg-white/[0.02] border-white/6 hover:bg-blue-500/5"
                  : "bg-black/[0.015] border-black/5 hover:bg-blue-50/50"
            }`}
          >
            <div className="flex items-center justify-between text-blue-500">
              <span className="text-[11px] font-bold">ผู้จัดการ (Manager)</span>
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-apple-primary">{stats.managerCount}</span>
              <span className="text-[10px] font-medium text-apple-secondary">คุมทีมพนักงาน</span>
            </div>
          </div>

          {/* Card: Staff */}
          <div
            onClick={() => setRoleFilter("User")}
            className={`p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
              roleFilter === "User"
                ? isDarkMode
                  ? "bg-emerald-500/15 border-emerald-500/30 shadow-md"
                  : "bg-emerald-50 border-emerald-200 shadow-md ring-2 ring-emerald-500/10"
                : isDarkMode
                  ? "bg-white/[0.02] border-white/6 hover:bg-emerald-500/5"
                  : "bg-black/[0.015] border-black/5 hover:bg-emerald-50/50"
            }`}
          >
            <div className="flex items-center justify-between text-emerald-500">
              <span className="text-[11px] font-bold">พนักงาน (Staff)</span>
              <Shield className="h-4 w-4" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-apple-primary">{stats.userCount}</span>
              <span className="text-[10px] font-medium text-apple-secondary">ตามสิทธิ์ที่ตั้ง</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CONTROLS TOOLBAR (Search, Role Filters, View Switcher) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Search Box */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-apple-secondary/60 pointer-events-none" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="ค้นหาชื่อ, อีเมล, @username หรือ รหัส ID..."
            className={`w-full rounded-2xl py-2.5 pl-10 pr-9 text-xs sm:text-sm font-medium outline-none border transition-all ${
              isDarkMode
                ? "bg-white/[0.04] border-white/10 text-white placeholder-neutral-500 focus:bg-white/[0.08] focus:border-white/20 focus:ring-2 focus:ring-white/10"
                : "bg-white border-black/10 text-black placeholder-neutral-400 focus:border-black/20 focus:ring-2 focus:ring-black/5 shadow-xs"
            }`}
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-apple-secondary hover:text-apple-primary rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Right: Filter Pills & View Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Pills */}
          <div
            className={`flex items-center p-1 rounded-2xl border text-xs font-bold overflow-x-auto ${
              isDarkMode ? "bg-white/[0.03] border-white/8" : "bg-black/[0.03] border-black/8"
            }`}
          >
            {[
              { id: "All", label: "ทั้งหมด" },
              { id: "Admin", label: "แอดมิน" },
              { id: "Manager", label: "ผู้จัดการ" },
              { id: "User", label: "พนักงาน" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setRoleFilter(f.id as typeof roleFilter)}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  roleFilter === f.id
                    ? isDarkMode
                      ? "bg-white text-black shadow-xs font-black"
                      : "bg-black text-white shadow-xs font-black"
                    : "text-apple-secondary hover:text-apple-primary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div
            className={`hidden sm:flex items-center p-1 rounded-2xl border ${
              isDarkMode ? "bg-white/[0.03] border-white/8" : "bg-black/[0.03] border-black/8"
            }`}
          >
            <button
              onClick={() => setViewMode("table")}
              title="ตารางข้อมูล"
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === "table"
                  ? isDarkMode
                    ? "bg-white text-black shadow-xs"
                    : "bg-black text-white shadow-xs"
                  : "text-apple-secondary hover:text-apple-primary"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              title="การ์ดผู้ใช้งาน"
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === "grid"
                  ? isDarkMode
                    ? "bg-white text-black shadow-xs"
                    : "bg-black text-white shadow-xs"
                  : "text-apple-secondary hover:text-apple-primary"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. MAIN CONTENT AREA */}
      {filteredUsers.length === 0 ? (
        /* Empty State */
        <div
          className={`p-12 text-center rounded-3xl border transition-all ${
            isDarkMode ? "bg-white/[0.02] border-white/8" : "bg-white border-black/8 shadow-sm"
          }`}
        >
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center bg-apple-primary/5 text-apple-tertiary">
            <Users className="h-7 w-7 opacity-50" />
          </div>
          <h3 className="font-bold text-sm text-apple-primary">ไม่พบข้อมูลผู้ใช้งาน</h3>
          <p className="text-xs text-apple-secondary mt-1 max-w-sm mx-auto">
            ไม่พบบัญชีที่ตรงกับคำค้นหาหรือตัวกรองที่เลือก ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง
          </p>
          {(localSearch || roleFilter !== "All") && (
            <button
              onClick={() => {
                setLocalSearch("");
                setRoleFilter("All");
              }}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-bold border border-apple-primary/10 text-apple-primary hover:bg-apple-primary/5 cursor-pointer transition-all"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* Table View */
        <div
          className={`rounded-3xl border overflow-hidden transition-all duration-300 ${
            isDarkMode ? "bg-white/[0.02] border-white/10 shadow-xl" : "bg-white border-black/8 shadow-md"
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr
                  className={`border-b text-[11px] font-black uppercase tracking-wider text-apple-secondary ${
                    isDarkMode ? "border-white/8 bg-white/[0.03]" : "border-black/6 bg-black/[0.02]"
                  }`}
                >
                  <th className="px-6 py-4">ผู้ใช้งาน</th>
                  <th className="px-6 py-4">บทบาท</th>
                  <th className="px-6 py-4">การติดต่อ & ชื่อผู้ใช้</th>
                  <th className="px-6 py-4">สิทธิ์การใช้งาน</th>
                  <th className="px-6 py-4">สถานะ</th>
                  <th className="px-6 py-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-apple-primary/6 text-xs font-medium">
                {filteredUsers.map((usr) => {
                  const meta = roleMeta(usr.role);
                  const RoleIcon = meta.icon;
                  const isCurrent = usr.id === currentUser.id;
                  const taskCount = usr.role === "Admin" ? "เต็มระบบ" : `${usr.tasks?.length || 0} ฟังก์ชัน`;

                  return (
                    <tr
                      key={usr.id}
                      className={`group transition-colors duration-150 ${
                        isDarkMode ? "hover:bg-white/[0.03]" : "hover:bg-black/[0.02]"
                      }`}
                    >
                      {/* 1. User Info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3.5">
                          <div className="relative shrink-0">
                            {usr.avatar ? (
                              <img
                                src={usr.avatar}
                                className={`h-10 w-10 rounded-2xl object-cover border border-apple-primary/10 shadow-xs ${meta.avatarRing}`}
                                alt={usr.name}
                              />
                            ) : (
                              <div
                                className={`h-10 w-10 rounded-2xl flex items-center justify-center text-xs font-black shadow-xs bg-gradient-to-br ${meta.gradient} ${meta.avatarRing} text-apple-primary`}
                              >
                                {getInitials(usr.name)}
                              </div>
                            )}
                            {/* Online / Status indicator */}
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 ${
                                isDarkMode ? "border-[#141414]" : "border-white"
                              } ${usr.status === "Active" ? "bg-emerald-500 ring-2 ring-emerald-500/20" : "bg-neutral-400"}`}
                              title={usr.status === "Active" ? "เปิดใช้งาน" : "ระงับ"}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-extrabold text-sm text-apple-primary leading-tight truncate">
                                {usr.name}
                              </p>
                              {isCurrent && (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                  คุณ
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="font-mono text-[10px] font-bold text-apple-secondary/70 bg-apple-primary/5 px-1.5 py-0.5 rounded-md">
                                {usr.id}
                              </span>
                              <button
                                onClick={() => copyToClipboard(usr.id, usr.id)}
                                className="text-apple-secondary/50 hover:text-apple-primary transition-colors cursor-pointer"
                                title="คัดลอก User ID"
                              >
                                {copiedId === usr.id ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Role */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${meta.badge}`}
                        >
                          <RoleIcon className="h-3.5 w-3.5" />
                          <span>{meta.label}</span>
                        </span>
                      </td>

                      {/* 3. Contact / Username */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-apple-primary font-semibold text-xs">
                            <Mail className="h-3 w-3 text-apple-secondary/60 shrink-0" />
                            <span className="truncate max-w-[200px]">{usr.email}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-mono text-apple-secondary">
                            <span>@{usr.username}</span>
                          </div>
                        </div>
                      </td>

                      {/* 4. Permissions */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {usr.role === "Admin" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-500 bg-purple-500/5 px-2.5 py-1 rounded-lg border border-purple-500/10">
                            <Sparkles className="h-3 w-3" /> เข้าถึงได้ทุกฟังก์ชัน
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-apple-primary bg-apple-primary/5 px-2.5 py-1 rounded-lg border border-apple-primary/10">
                              {taskCount}
                            </span>
                            {currentUser.role === "Admin" && (
                              <button
                                onClick={() => handleSelectUserForTasks(usr)}
                                className="text-[11px] font-bold text-blue-500 hover:text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                              >
                                <Sliders className="h-3 w-3" />
                                <span>ตั้งค่า</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 5. Status Toggle */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleUserStatus(usr.id)}
                          disabled={usr.id === currentUser.id || (currentUser.role === "Manager" && usr.role === "Admin")}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 cursor-pointer ${
                            usr.status === "Active"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 active:scale-95"
                              : "bg-neutral-500/10 text-neutral-500 border-neutral-500/20 hover:bg-neutral-500/20 active:scale-95"
                          } ${
                            usr.id === currentUser.id || (currentUser.role === "Manager" && usr.role === "Admin")
                              ? "opacity-60 cursor-not-allowed"
                              : ""
                          }`}
                          title={
                            usr.id === currentUser.id
                              ? "ไม่สามารถระงับบัญชีของตนเองได้"
                              : currentUser.role === "Manager" && usr.role === "Admin"
                                ? "ผู้จัดการไม่สามารถระงับบัญชีแอดมินได้"
                                : "คลิกเพื่อสลับสถานะ"
                          }
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              usr.status === "Active" ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"
                            }`}
                          />
                          <span>{usr.status === "Active" ? "เปิดใช้งาน" : "ระงับบัญชี"}</span>
                        </button>
                      </td>

                      {/* 6. Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {currentUser.role === "Admin" && usr.role !== "Admin" && (
                            <button
                              onClick={() => handleSelectUserForTasks(usr)}
                              className="p-2 text-apple-secondary hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all cursor-pointer"
                              title="ตั้งค่าเปิด/ปิดสิทธิ์การทำงาน"
                            >
                              <Sliders className="h-4 w-4" />
                            </button>
                          )}
                          {canManage(usr) ? (
                            <button
                              onClick={() =>
                                requestConfirm(
                                  "ยืนยันการลบบัญชีผู้ใช้งาน",
                                  `คุณต้องการลบบัญชี "${usr.name}" (@${usr.username}) ออกจากระบบหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`,
                                  () => handleDeleteUser(usr.id),
                                )
                              }
                              className="p-2 text-apple-secondary hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                              title="ลบบัญชีผู้ใช้นี้"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <span
                              className="p-2 inline-flex items-center justify-center text-apple-secondary/30"
                              title="บัญชีนี้ได้รับการป้องกัน ไม่สามารถลบได้"
                            >
                              <Lock className="h-4 w-4" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((usr) => {
            const meta = roleMeta(usr.role);
            const RoleIcon = meta.icon;
            const isCurrent = usr.id === currentUser.id;

            return (
              <div
                key={usr.id}
                className={`relative p-5 rounded-3xl border transition-all duration-300 hover:scale-[1.01] flex flex-col justify-between space-y-4 ${
                  isDarkMode
                    ? "bg-white/[0.02] hover:bg-white/[0.04] border-white/10 shadow-lg"
                    : "bg-white hover:bg-slate-50/50 border-black/8 shadow-md"
                }`}
              >
                {/* Card Top: Avatar, Names, Role */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        {usr.avatar ? (
                          <img
                            src={usr.avatar}
                            className={`h-12 w-12 rounded-2xl object-cover border border-apple-primary/10 shadow-xs ${meta.avatarRing}`}
                            alt={usr.name}
                          />
                        ) : (
                          <div
                            className={`h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-black shadow-xs bg-gradient-to-br ${meta.gradient} ${meta.avatarRing} text-apple-primary`}
                          >
                            {getInitials(usr.name)}
                          </div>
                        )}
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 ${
                            isDarkMode ? "border-[#141414]" : "border-white"
                          } ${usr.status === "Active" ? "bg-emerald-500 ring-2 ring-emerald-500/20" : "bg-neutral-400"}`}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm text-apple-primary truncate">
                            {usr.name}
                          </h4>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-blue-500/10 text-blue-500">
                              คุณ
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-apple-secondary truncate mt-0.5">{usr.email}</p>
                        <p className="font-mono text-[10px] text-apple-secondary/70">@{usr.username}</p>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border shrink-0 ${meta.badge}`}>
                      <RoleIcon className="h-3 w-3" />
                      <span>{meta.label.split(" ")[0]}</span>
                    </span>
                  </div>

                  {/* Permissions Tags */}
                  <div className="mt-4 pt-3 border-t border-apple-primary/6">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-apple-secondary mb-1.5">
                      สิทธิ์การใช้งาน
                    </p>
                    {usr.role === "Admin" ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-500 bg-purple-500/5 px-2.5 py-1 rounded-xl border border-purple-500/10">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>เข้าถึงทุกฟังก์ชันในระบบ</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {usr.tasks && usr.tasks.length > 0 ? (
                          usr.tasks.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-apple-primary/5 text-apple-secondary border border-apple-primary/10"
                            >
                              {t}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-apple-tertiary italic">
                            ยังไม่ได้เปิดสิทธิ์ฟังก์ชันใด ๆ
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Bottom: Status & Actions */}
                <div className="pt-3 border-t border-apple-primary/6 flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleUserStatus(usr.id)}
                    disabled={usr.id === currentUser.id || (currentUser.role === "Manager" && usr.role === "Admin")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                      usr.status === "Active"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-neutral-500/10 text-neutral-500 border-neutral-500/20"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        usr.status === "Active" ? "bg-emerald-500" : "bg-neutral-400"
                      }`}
                    />
                    <span>{usr.status === "Active" ? "เปิดใช้งาน" : "ระงับบัญชี"}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {currentUser.role === "Admin" && usr.role !== "Admin" && (
                      <button
                        onClick={() => handleSelectUserForTasks(usr)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Sliders className="h-3 w-3" />
                        <span>ตั้งสิทธิ์</span>
                      </button>
                    )}
                    {canManage(usr) ? (
                      <button
                        onClick={() =>
                          requestConfirm(
                            "ยืนยันการลบบัญชีผู้ใช้งาน",
                            `คุณต้องการลบบัญชี "${usr.name}" ออกจากระบบหรือไม่?`,
                            () => handleDeleteUser(usr.id),
                          )
                        }
                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 rounded-xl transition-all cursor-pointer"
                        title="ลบบัญชีนี้"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className="p-1.5 text-apple-secondary/30">
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. PERMISSIONS MODAL */}
      {selectedUserForTasks && (
        <UserTasksModal
          user={selectedUserForTasks}
          isOpen={!!selectedUserForTasks}
          onClose={() => handleSelectUserForTasks(null)}
          isDarkMode={isDarkMode}
          onSave={(tasks) => {
            handleUpdateUserTasks(selectedUserForTasks.id, tasks);
            handleSelectUserForTasks(null);
          }}
          onDirtyChange={setIsTasksModalDirty}
        />
      )}
    </div>
  );
};

// ==========================================
// USER TASKS / PERMISSIONS MODAL
// ==========================================
interface UserTasksModalProps {
  user: AppUser;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onSave: (tasks: string[]) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const UserTasksModal: React.FC<UserTasksModalProps> = ({
  user,
  isOpen,
  onClose,
  isDarkMode,
  onSave,
  onDirtyChange,
}) => {
  const [selectedTasks, setSelectedTasks] = useState<string[]>(user.tasks || []);

  const isDirty = useMemo(() => {
    if (!isOpen) return false;
    const originalTasks = user.tasks || [];
    if (originalTasks.length !== selectedTasks.length) return true;
    return !selectedTasks.every((t) => originalTasks.includes(t));
  }, [selectedTasks, user.tasks, isOpen]);

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  const toggleTask = (taskKey: string) => {
    setSelectedTasks((prev) =>
      prev.includes(taskKey) ? prev.filter((t) => t !== taskKey) : [...prev, taskKey],
    );
  };

  const tasksConfig = [
    {
      key: "ดูแดชบอร์ด",
      name: "หน้าแดชบอร์ดภาพรวม",
      desc: "เข้าถึงกราฟวิเคราะห์ยอดขาย รายได้รวม สถิติช่องทาง และสินค้าขายดี",
      icon: <LayoutDashboard className="h-5 w-5 text-purple-500" />,
      activeBgDark: "bg-purple-500/10 border-purple-500/30",
      activeBgLight: "bg-purple-50 border-purple-200",
      iconBg: "bg-purple-500/10 text-purple-500",
      switchColor: "bg-purple-500",
    },
    {
      key: "ดูรายงานยอดขาย",
      name: "รายงานและรายการยอดขาย",
      desc: "ดูรายการคำสั่งซื้อ ประวัติการขาย ค้นหา และกรองข้อมูลตามช่องทาง",
      icon: <ShoppingBag className="h-5 w-5 text-emerald-500" />,
      activeBgDark: "bg-emerald-500/10 border-emerald-500/30",
      activeBgLight: "bg-emerald-50 border-emerald-200",
      iconBg: "bg-emerald-500/10 text-emerald-500",
      switchColor: "bg-emerald-500",
    },
    {
      key: "เครื่องคำนวณส่วนต่าง",
      name: "เครื่องคำนวณส่วนแบ่งรายได้",
      desc: "จำลองคำนวณส่วนแบ่ง ค่าใช้จ่าย และส่วนต่างกำไรของทีมงาน",
      icon: <Calculator className="h-5 w-5 text-blue-500" />,
      activeBgDark: "bg-blue-500/10 border-blue-500/30",
      activeBgLight: "bg-blue-50 border-blue-200",
      iconBg: "bg-blue-500/10 text-blue-500",
      switchColor: "bg-blue-500",
    },
    {
      key: "นำเข้าข้อมูล Excel",
      name: "นำเข้าข้อมูลไฟล์ Excel",
      desc: "อัปโหลดและประมวลผลไฟล์ยอดขาย ข้อมูลสินค้า และจัดการชุดข้อมูล",
      icon: <Upload className="h-5 w-5 text-amber-500" />,
      activeBgDark: "bg-amber-500/10 border-amber-500/30",
      activeBgLight: "bg-amber-50 border-amber-200",
      iconBg: "bg-amber-500/10 text-amber-500",
      switchColor: "bg-amber-500",
    },
    ...(user.role === "Manager"
      ? [
          {
            key: "จัดการผู้ใช้งาน",
            name: "จัดการบัญชีพนักงาน",
            desc: "อนุญาตให้ผู้จัดการเปิด/ปิดสิทธิ์ และจัดการสถานะพนักงานทั่วไปได้",
            icon: <Users className="h-5 w-5 text-rose-500" />,
            activeBgDark: "bg-rose-500/10 border-rose-500/30",
            activeBgLight: "bg-rose-50 border-rose-200",
            iconBg: "bg-rose-500/10 text-rose-500",
            switchColor: "bg-rose-500",
          },
        ]
      : []),
  ];

  const selectAll = () => {
    setSelectedTasks(tasksConfig.map((t) => t.key));
  };

  const deselectAll = () => {
    setSelectedTasks([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-10 transition-all duration-300 animate-fade-in">
      <div className="w-full max-w-lg max-h-[85vh] my-auto flex flex-col overflow-hidden animate-scale-in rounded-3xl border border-apple-primary/15 bg-apple-secondary shadow-2xl">
        {/* Modal Header */}
        <div className="p-6 flex justify-between items-center bg-apple-tertiary shrink-0 border-b border-apple-primary/10">
          <div className="flex items-center gap-3.5">
            {user.avatar ? (
              <img
                src={user.avatar}
                className="h-11 w-11 rounded-2xl object-cover border border-apple-primary/10 shrink-0 shadow-xs"
                alt={user.name}
              />
            ) : (
              <div
                className={`h-11 w-11 rounded-2xl flex items-center justify-center text-xs font-black shrink-0 shadow-xs ${
                  isDarkMode ? "bg-white/10 text-white" : "bg-black/10 text-black"
                }`}
              >
                {getInitials(user.name)}
              </div>
            )}
            <div>
              <h3 className="font-black text-base text-apple-primary leading-tight flex items-center gap-2">
                <span>กำหนดสิทธิ์การใช้งาน</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  {selectedTasks.length}/{tasksConfig.length} ฟังก์ชัน
                </span>
              </h3>
              <p className="text-xs font-medium text-apple-secondary mt-0.5">
                {user.name} ({user.role === "Manager" ? "ผู้จัดการ" : "พนักงาน"})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-apple-secondary hover:text-apple-primary transition-colors cursor-pointer p-2 hover:bg-apple-primary/5 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Quick presets */}
          <div className="flex items-center justify-between pb-1 text-xs">
            <span className="font-bold text-apple-secondary">เลือกฟังก์ชันที่อนุญาตให้เข้าถึง:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-blue-500 hover:text-blue-600 font-bold hover:underline cursor-pointer"
              >
                เลือกทั้งหมด
              </button>
              <span className="text-apple-tertiary/40">•</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-apple-secondary hover:text-apple-primary font-medium hover:underline cursor-pointer"
              >
                ล้างทั้งหมด
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {tasksConfig.map((task) => {
              const isSelected = selectedTasks.includes(task.key);
              return (
                <div
                  key={task.key}
                  onClick={() => toggleTask(task.key)}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none ${
                    isSelected
                      ? isDarkMode
                        ? task.activeBgDark
                        : task.activeBgLight
                      : isDarkMode
                        ? "bg-white/[0.02] border-white/6 hover:bg-white/[0.04]"
                        : "bg-black/[0.015] border-black/6 hover:bg-black/[0.03]"
                  }`}
                >
                  <div className="flex items-start gap-3.5 flex-1 pr-4">
                    <div className={`p-2.5 rounded-xl shrink-0 ${task.iconBg}`}>
                      {task.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-apple-primary">{task.name}</h4>
                      <p className="text-xs text-apple-secondary font-medium mt-0.5 leading-relaxed">
                        {task.desc}
                      </p>
                    </div>
                  </div>

                  {/* iOS Toggle Switch */}
                  <div
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out ${
                      isSelected ? task.switchColor : isDarkMode ? "bg-white/20" : "bg-black/20"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-300 ease-in-out ${
                        isSelected ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 flex items-center justify-between border-t border-apple-primary/10 bg-apple-tertiary shrink-0">
          <span className="text-xs text-apple-secondary">
            {isDirty ? "⚠️ มีการเปลี่ยนแปลงที่ยังไม่บันทึก" : "สิทธิ์ได้รับการอัปเดตล่าสุด"}
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-apple-secondary hover:text-apple-primary hover:bg-apple-primary/5 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => onSave(selectedTasks)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 shadow-sm"
            >
              บันทึกสิทธิ์การใช้งาน
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const UsersTab = React.memo(UsersTabComponent);

