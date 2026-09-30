import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Bell,
  Check,
  Sliders,
  Eye,
  EyeOff,
  Loader2,
  Camera,
  ShieldCheck,
  Lock,
  Mail,
  Phone,
  Sun,
  Moon,
  Globe,
  DollarSign,
  Sparkles,
  KeyRound,
  Palette,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Activity,
  ChevronRight,
  Shield,
  Clock,
} from "lucide-react";
import type { AppUser } from "../types";
import { getInitials } from "../utils";
import { getTranslation } from "../utils/i18n";

interface SettingsTabProps {
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  currentUser: AppUser;
  onSaveAccount: (updatedUser: AppUser) => void;
  fontSetting: string;
  setFontSetting: (val: string) => void;
  currencySetting: string;
  setCurrencySetting: (val: string) => void;
  calendarSetting: string;
  setCalendarSetting: (val: string) => void;
  notificationsSetting: boolean;
  setNotificationsSetting: (val: boolean) => void;
  triggerAlert: (msg: string, type?: "success" | "warning" | "info" | "error") => void;
  languageSetting: string;
  setLanguageSetting: (val: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const SettingsTabComponent: React.FC<SettingsTabProps> = ({
  isDarkMode,
  setIsDarkMode,
  currentUser,
  onSaveAccount,
  fontSetting,
  setFontSetting,
  currencySetting,
  setCurrencySetting,
  calendarSetting,
  setCalendarSetting,
  notificationsSetting,
  setNotificationsSetting,
  triggerAlert,
  languageSetting,
  setLanguageSetting,
  onDirtyChange,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"account" | "display" | "general">("account");

  // Account Local States
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [avatar, setAvatar] = useState(currentUser.avatar || "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sync account form state when currentUser changes
  const [prevUser, setPrevUser] = useState(currentUser);
  if (currentUser !== prevUser) {
    setPrevUser(currentUser);
    setName(currentUser.name);
    setEmail(currentUser.email);
    setPhone(currentUser.phone || "");
    setAvatar(currentUser.avatar || "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  // Display Local States
  const [localLanguage, setLocalLanguage] = useState(languageSetting);
  const [localFont, setLocalFont] = useState(fontSetting);
  const [localCurrency, setLocalCurrency] = useState(currencySetting);
  const [localCalendar, setLocalCalendar] = useState(calendarSetting);
  const [isSavingDisplay, setIsSavingDisplay] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Sync display settings state if parent props change
  const [prevDisplayProps, setPrevDisplayProps] = useState({
    language: languageSetting,
    font: fontSetting,
    currency: currencySetting,
    calendar: calendarSetting,
  });
  if (
    prevDisplayProps.language !== languageSetting ||
    prevDisplayProps.font !== fontSetting ||
    prevDisplayProps.currency !== currencySetting ||
    prevDisplayProps.calendar !== calendarSetting
  ) {
    setPrevDisplayProps({
      language: languageSetting,
      font: fontSetting,
      currency: currencySetting,
      calendar: calendarSetting,
    });
    setLocalLanguage(languageSetting);
    setLocalFont(fontSetting);
    setLocalCurrency(currencySetting);
    setLocalCalendar(calendarSetting);
  }

  // Active translation dictionary based on currently selected language in settings tab
  const t = getTranslation(localLanguage);

  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => {
        setShowSuccessToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  // General Local States
  const [localNotifications, setLocalNotifications] = useState(notificationsSetting);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  const isAccountDirty =
    name !== currentUser.name ||
    email !== currentUser.email ||
    phone !== (currentUser.phone || "") ||
    avatar !== (currentUser.avatar || "") ||
    currentPassword !== "" ||
    newPassword !== "" ||
    confirmPassword !== "";

  const isDisplayDirty =
    localLanguage !== languageSetting ||
    localFont !== fontSetting ||
    localCurrency !== currencySetting ||
    localCalendar !== calendarSetting;

  const isNotificationsDirty = localNotifications !== notificationsSetting;

  const isDirty = isAccountDirty || isDisplayDirty || isNotificationsDirty;

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  // Validation Logic
  const isLengthValid = newPassword.length >= 8;
  const isCasingValid = /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword);
  const isNumberValid = /[0-9]/.test(newPassword);
  const isSpecialValid = /[!@#$%^&*]/.test(newPassword);
  const isNotSameValid = newPassword !== currentPassword && newPassword !== currentUser.password;

  const passwordCriteriaCount = [
    isLengthValid,
    isCasingValid,
    isNumberValid,
    isSpecialValid,
    isNotSameValid,
  ].filter(Boolean).length;

  const isNewPasswordValid =
    isLengthValid &&
    isCasingValid &&
    isNumberValid &&
    isSpecialValid &&
    isNotSameValid;

  const isCurrentPasswordCorrect = currentPassword === currentUser.password;
  const isConfirmPasswordMatch = confirmPassword === newPassword && newPassword.length > 0;

  const isPasswordSectionEmpty = currentPassword === "" && newPassword === "" && confirmPassword === "";
  const isPhoneValid = phone.trim() === "" || /^0[689]\d{8}$/.test(phone.trim());

  const isFormValid =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    email.includes("@") &&
    isPhoneValid &&
    (isPasswordSectionEmpty
      ? isAccountDirty
      : isCurrentPasswordCorrect && isNewPasswordValid && isConfirmPasswordMatch);

  // Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      triggerAlert(t.errOnlyJpgPng, "error");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      triggerAlert(t.errFileSizeExceeded, "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAvatar(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatar("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCancel = () => {
    setName(currentUser.name);
    setEmail(currentUser.email);
    setPhone(currentUser.phone || "");
    setAvatar(currentUser.avatar || "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    triggerAlert(t.cancelSuccess, "info");
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      triggerAlert(t.errNameRequired, "error");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      triggerAlert(t.errEmailInvalid, "error");
      return;
    }
    if (!isPhoneValid) {
      triggerAlert(t.errPhoneInvalid, "error");
      return;
    }

    const isChangingPassword = currentPassword !== "" || newPassword !== "" || confirmPassword !== "";

    if (isChangingPassword) {
      if (!isCurrentPasswordCorrect) {
        triggerAlert(t.errCurrentPasswordIncorrect, "error");
        return;
      }
      if (!isNewPasswordValid) {
        triggerAlert(t.errNewPasswordInsecure, "error");
        return;
      }
      if (!isConfirmPasswordMatch) {
        triggerAlert(t.errPasswordMismatch, "error");
        return;
      }
    }

    onSaveAccount({
      ...currentUser,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      avatar: avatar,
      password: isChangingPassword ? newPassword.trim() : currentUser.password,
    });

    if (isChangingPassword) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const getFontFamilyValue = (fontName: string) => {
    if (fontName === "Noto Sans Thai") {
      return '"Noto Sans Thai", "Inter", sans-serif';
    }
    if (fontName === "Sarabun") {
      return '"Sarabun", "Inter", sans-serif';
    }
    return '"IBM Plex Sans Thai", "Inter", sans-serif';
  };

  const getPreviewFormattedCurrency = () => {
    if (localCurrency === "USD") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(12450.75);
    } else if (localCurrency === "JPY") {
      return new Intl.NumberFormat("ja-JP", {
        style: "currency",
        currency: "JPY",
        minimumFractionDigits: 0,
      }).format(124500);
    } else {
      return new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        minimumFractionDigits: 2,
      }).format(12450.75);
    }
  };

  const handleSaveDisplay = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDisplay(true);
    setTimeout(() => {
      setFontSetting(localFont);
      setLanguageSetting(localLanguage);
      setCurrencySetting(localCurrency);
      setCalendarSetting(localCalendar);
      try {
        localStorage.setItem("fontSetting", localFont);
        localStorage.setItem("languageSetting", localLanguage);
        localStorage.setItem("currencySetting", localCurrency);
        localStorage.setItem("calendarSetting", localCalendar);
        document.documentElement.lang = localLanguage;
      } catch (err) {
        console.warn("Failed to save display settings to localStorage:", err);
      }

      setIsSavingDisplay(false);
      setShowSuccessToast(true);
    }, 400);
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    setNotificationsSetting(localNotifications);
    try {
      localStorage.setItem("notificationsSetting", localNotifications ? "true" : "false");
    } catch (err) {
      console.warn("Failed to save notification settings to localStorage:", err);
    }
    triggerAlert(t.generalSavedSuccess, "success");
  };

  // Input style with colorful focus ring and modern styling
  const inputStyle = `w-full rounded-xl py-2.5 pl-10 pr-3.5 text-xs font-medium transition-all duration-200 outline-none
    bg-neutral-100/80 dark:bg-neutral-800/60 text-neutral-900 dark:text-neutral-100
    border border-neutral-200/90 dark:border-neutral-700/80
    focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-neutral-900
    focus:ring-4 focus:ring-indigo-500/15 dark:focus:ring-indigo-400/20 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-2xs`;

  const getRoleDisplay = (role: string) => {
    if (role === "Admin") return t.admin;
    if (role === "Manager") return t.manager;
    return t.employee;
  };

  const getRoleBadgeClasses = (role: string) => {
    if (role === "Admin") {
      return "bg-gradient-to-r from-purple-500/15 to-indigo-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25";
    }
    if (role === "Manager") {
      return "bg-gradient-to-r from-blue-500/15 to-cyan-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25";
    }
    return "bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25";
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Toast Notification */}
      {showSuccessToast && (
        <div className="fixed top-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/30 bg-white/95 dark:bg-neutral-900/95 text-neutral-900 dark:text-neutral-100 backdrop-blur-xl animate-fade-in transition-all ring-4 ring-emerald-500/10">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/25">
            <Check className="h-4 w-4 stroke-[3]" />
          </div>
          <div>
            <div className="text-xs font-bold text-neutral-900 dark:text-white">{t.displaySavedTitle}</div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">{t.displaySavedDesc}</div>
          </div>
        </div>
      )}

      {/* Top Banner Header - Vibrant Modern Glassmorphic */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-100/80 dark:border-indigo-900/40 bg-gradient-to-r from-white via-indigo-50/40 to-purple-50/30 dark:from-neutral-900/90 dark:via-indigo-950/25 dark:to-purple-950/20 p-6 sm:p-7 shadow-xs backdrop-blur-xl">
        {/* Ambient background glow blobs */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-gradient-to-br from-indigo-500/15 via-purple-500/15 to-pink-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-200/80 dark:border-indigo-800/60 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
              <span>{t.settingsBannerTag}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-neutral-900 via-indigo-950 to-neutral-800 dark:from-white dark:via-indigo-200 dark:to-neutral-200 bg-clip-text text-transparent">
              {t.settingsBannerTitle}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-xl leading-relaxed font-normal">
              {t.settingsBannerSubtitle}
            </p>
          </div>

          {/* User Quick Status Badge */}
          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/80 dark:bg-neutral-800/80 border border-indigo-100/80 dark:border-indigo-900/50 shadow-sm backdrop-blur-md shrink-0">
            <div className="relative">
              {avatar ? (
                <img
                  src={avatar}
                  alt={currentUser.name}
                  className="w-12 h-12 rounded-xl object-cover ring-2 ring-indigo-500/30 shadow-sm"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white font-bold flex items-center justify-center text-base shadow-md shadow-indigo-500/20 ring-2 ring-white dark:ring-neutral-800">
                  {getInitials(name || currentUser.name)}
                </div>
              )}
              {/* Animated Online Status Indicator */}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-neutral-900" />
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <span>{name || currentUser.name}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${getRoleBadgeClasses(currentUser.role)}`}>
                  {getRoleDisplay(currentUser.role)}
                </span>
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate max-w-[180px] font-medium">{email || currentUser.email}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Navigation Sidebar */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-neutral-900/90 p-3 shadow-xs backdrop-blur-xl">
            <div className="px-3 pt-1.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-600/80 dark:text-indigo-400/80 flex items-center gap-1.5">
              <Sliders className="h-3 w-3" />
              <span>{t.settingsNavCategory}</span>
            </div>
            <nav className="space-y-1.5">
              {/* Account & Security Nav */}
              <button
                type="button"
                onClick={() => setActiveSubTab("account")}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                  activeSubTab === "account"
                    ? "bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 text-white shadow-md shadow-indigo-500/25 font-semibold"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      activeSubTab === "account"
                        ? "bg-white/20 text-white shadow-xs"
                        : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40"
                    }`}
                  >
                    <User className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <div className="leading-tight">{t.tabAccount}</div>
                    <div className={`text-[10px] ${activeSubTab === "account" ? "text-indigo-100 font-normal" : "text-neutral-400"}`}>
                      {t.tabAccountSub}
                    </div>
                  </div>
                </div>
                <ChevronRight className={`h-4 w-4 transition-transform ${activeSubTab === "account" ? "text-white translate-x-0.5" : "text-neutral-400"}`} />
              </button>

              {/* Display & Formatting Nav */}
              <button
                type="button"
                onClick={() => setActiveSubTab("display")}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                  activeSubTab === "display"
                    ? "bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white shadow-md shadow-purple-500/25 font-semibold"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-purple-50/70 dark:hover:bg-purple-950/30 hover:text-purple-600 dark:hover:text-purple-400"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      activeSubTab === "display"
                        ? "bg-white/20 text-white shadow-xs"
                        : "bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-100 dark:border-purple-900/40"
                    }`}
                  >
                    <Palette className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <div className="leading-tight">{t.tabDisplay}</div>
                    <div className={`text-[10px] ${activeSubTab === "display" ? "text-purple-100 font-normal" : "text-neutral-400"}`}>
                      {t.tabDisplaySub}
                    </div>
                  </div>
                </div>
                <ChevronRight className={`h-4 w-4 transition-transform ${activeSubTab === "display" ? "text-white translate-x-0.5" : "text-neutral-400"}`} />
              </button>

              {/* General & Notifications Nav */}
              <button
                type="button"
                onClick={() => setActiveSubTab("general")}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                  activeSubTab === "general"
                    ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white shadow-md shadow-blue-500/25 font-semibold"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-blue-50/70 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      activeSubTab === "general"
                        ? "bg-white/20 text-white shadow-xs"
                        : "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40"
                    }`}
                  >
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <div className="leading-tight">{t.tabGeneral}</div>
                    <div className={`text-[10px] ${activeSubTab === "general" ? "text-blue-100 font-normal" : "text-neutral-400"}`}>
                      {t.tabGeneralSub}
                    </div>
                  </div>
                </div>
                <ChevronRight className={`h-4 w-4 transition-transform ${activeSubTab === "general" ? "text-white translate-x-0.5" : "text-neutral-400"}`} />
              </button>
            </nav>
          </div>

          {/* Quick System Info Card with colorful accent */}
          <div className="rounded-2xl border border-indigo-100/90 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/50 via-white/80 to-purple-50/30 dark:from-indigo-950/20 dark:via-neutral-900/80 dark:to-purple-950/15 p-4 space-y-3 backdrop-blur-sm shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
              <div className="w-6 h-6 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              <span>{t.systemStatus}</span>
            </div>
            <div className="space-y-2 text-[11px] text-neutral-600 dark:text-neutral-400">
              <div className="flex justify-between items-center py-1 border-b border-indigo-100/60 dark:border-neutral-800/70">
                <span className="font-medium">{t.systemVersion}</span>
                <span className="font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[10px]">
                  v2.4 Enterprise
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-indigo-100/60 dark:border-neutral-800/70">
                <span className="font-medium">{t.status}</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t.systemNormal}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="font-medium">{t.userRole}</span>
                <span className={`font-semibold px-2 py-0.5 rounded-md text-[10px] ${getRoleBadgeClasses(currentUser.role)}`}>
                  {getRoleDisplay(currentUser.role)}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="lg:col-span-9">
          {/* ===================== ACCOUNT SUBTAB ===================== */}
          {activeSubTab === "account" && (
            <form onSubmit={handleSaveAccount} className="space-y-5 animate-scale-in">
              {/* Profile Header Avatar Card */}
              <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/80 p-5 sm:p-6 shadow-xs backdrop-blur-xl space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 pb-5 border-b border-neutral-200/60 dark:border-neutral-800/60">
                  <div className="flex items-center gap-4">
                    {/* Avatar with Camera Trigger & colorful gradient ring */}
                    <div className="relative group shrink-0">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt="Avatar Preview"
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-4 ring-indigo-500/20 shadow-md"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl font-bold flex items-center justify-center text-xl sm:text-2xl ring-4 ring-indigo-500/20 shadow-lg shadow-indigo-500/20 bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white">
                          {getInitials(name || currentUser.name)}
                        </div>
                      )}

                      {/* Hover Overlay Button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 rounded-2xl bg-indigo-950/70 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-medium cursor-pointer"
                      >
                        <Camera className="h-4 w-4 mb-0.5 text-indigo-200" />
                        <span>{t.changePhoto}</span>
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
                          {name || t.noNameSet}
                        </h2>
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold ${getRoleBadgeClasses(currentUser.role)}`}>
                          {getRoleDisplay(currentUser.role)}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-normal">
                        {email || t.noEmailSet}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 border border-indigo-200/70 dark:border-indigo-800/50 shadow-2xs hover:shadow-xs active:scale-95"
                        >
                          <Camera className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>{t.uploadPhoto}</span>
                        </button>
                        {avatar && (
                          <button
                            type="button"
                            onClick={handleRemoveAvatar}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 border border-rose-200 dark:border-rose-900/50 shadow-2xs active:scale-95"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{t.removePhoto}</span>
                          </button>
                        )}
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/png, image/jpeg"
                          className="hidden"
                        />
                      </div>
                      <div className="text-[10px] text-neutral-400 dark:text-neutral-500">
                        {t.errFileSizeExceeded} (JPG / PNG)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Personal Information Fields */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-200">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <span>{t.personalInfoTitle}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Full Name */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                        {t.fullNameLabel} <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500/70 dark:text-indigo-400/70 pointer-events-none" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={inputStyle}
                          placeholder={t.fullNamePlaceholder}
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                        {t.emailLabel} <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-500/70 dark:text-sky-400/70 pointer-events-none" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={inputStyle}
                          placeholder={t.emailPlaceholder}
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                        {t.phoneLabel}
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500/70 dark:text-emerald-400/70 pointer-events-none" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className={inputStyle}
                          placeholder={t.phonePlaceholder}
                        />
                      </div>
                      {phone.trim() !== "" && !/^0[689]\d{8}$/.test(phone.trim()) && (
                        <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>{t.errPhoneInvalid}</span>
                        </p>
                      )}
                    </div>

                    {/* Role (Read Only) */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                        {t.rolePermissionLabel}
                      </label>
                      <div className="relative">
                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-500/70 dark:text-purple-400/70 pointer-events-none" />
                        <input
                          type="text"
                          value={`${getRoleDisplay(currentUser.role)} (${currentUser.role})`}
                          disabled
                          className={`${inputStyle} opacity-80 cursor-not-allowed bg-indigo-50/30 dark:bg-neutral-800/40 text-neutral-800 dark:text-neutral-200 font-semibold`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Password & Security Card */}
              <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/80 p-5 sm:p-6 shadow-xs backdrop-blur-xl space-y-5">
                <div className="flex items-center justify-between pb-3.5 border-b border-neutral-200/60 dark:border-neutral-800/60">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-200">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                      <KeyRound className="h-3.5 w-3.5" />
                    </div>
                    <span>{t.securityTitle}</span>
                  </div>
                  <span className="text-[11px] text-neutral-400">{t.securityDesc}</span>
                </div>

                <div className="space-y-3.5">
                  {/* Current Password */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                      {t.currentPasswordLabel}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500/70 dark:text-amber-400/70 pointer-events-none" />
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={inputStyle}
                        placeholder={t.currentPasswordPlaceholder}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1 cursor-pointer"
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {currentPassword.length > 0 && !isCurrentPasswordCorrect && (
                      <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>{t.errCurrentPasswordIncorrect}</span>
                      </p>
                    )}
                  </div>

                  {/* New & Confirm Passwords in 2 Columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* New Password */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                        {t.newPasswordLabel}
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500/70 dark:text-indigo-400/70 pointer-events-none" />
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className={inputStyle}
                          placeholder={t.newPasswordPlaceholder}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1 cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm New Password */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                        {t.confirmPasswordLabel}
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500/70 dark:text-indigo-400/70 pointer-events-none" />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={inputStyle}
                          placeholder={t.confirmPasswordPlaceholder}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1 cursor-pointer"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {confirmPassword.length > 0 && !isConfirmPasswordMatch && (
                        <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>{t.passwordMismatch}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Password Strength Meter & Visual Criteria Checklist */}
                  {newPassword.length > 0 && (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/40 via-purple-50/20 to-neutral-50 dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-neutral-900/60 border border-indigo-100/80 dark:border-indigo-900/40 space-y-3 animate-fade-in">
                      {/* Progressive Strength Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                            {t.passwordStrengthLabel}
                          </span>
                          <span
                            className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                              passwordCriteriaCount === 5
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
                                : passwordCriteriaCount >= 3
                                ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25"
                                : passwordCriteriaCount >= 2
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25"
                                : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25"
                            }`}
                          >
                            {passwordCriteriaCount === 5
                              ? t.strengthVeryStrong
                              : passwordCriteriaCount >= 3
                              ? t.strengthGood
                              : passwordCriteriaCount >= 2
                              ? t.strengthFair
                              : t.strengthWeak}
                          </span>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5 h-2">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div
                              key={level}
                              className={`rounded-full transition-all duration-300 ${
                                level <= passwordCriteriaCount
                                  ? passwordCriteriaCount === 5
                                    ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-xs shadow-emerald-500/30"
                                    : passwordCriteriaCount >= 3
                                    ? "bg-gradient-to-r from-indigo-500 to-violet-500 shadow-xs shadow-indigo-500/30"
                                    : passwordCriteriaCount >= 2
                                    ? "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-xs shadow-amber-500/30"
                                    : "bg-gradient-to-r from-rose-500 to-pink-500 shadow-xs shadow-rose-500/30"
                                  : "bg-neutral-200/80 dark:bg-neutral-700/60"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Criteria Pill List */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 text-[11px]">
                        <div
                          className={`flex items-center gap-1.5 p-2 rounded-xl transition-all ${
                            isLengthValid
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/25 shadow-2xs"
                              : "bg-neutral-100/80 dark:bg-neutral-800/60 text-neutral-400 dark:text-neutral-500 border border-neutral-200/50 dark:border-neutral-700/50"
                          }`}
                        >
                          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${isLengthValid ? "text-emerald-500" : "opacity-30"}`} />
                          <span>{t.ruleMin8Chars}</span>
                        </div>

                        <div
                          className={`flex items-center gap-1.5 p-2 rounded-xl transition-all ${
                            isCasingValid
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/25 shadow-2xs"
                              : "bg-neutral-100/80 dark:bg-neutral-800/60 text-neutral-400 dark:text-neutral-500 border border-neutral-200/50 dark:border-neutral-700/50"
                          }`}
                        >
                          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${isCasingValid ? "text-emerald-500" : "opacity-30"}`} />
                          <span>{t.ruleUpperLower}</span>
                        </div>

                        <div
                          className={`flex items-center gap-1.5 p-2 rounded-xl transition-all ${
                            isNumberValid
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/25 shadow-2xs"
                              : "bg-neutral-100/80 dark:bg-neutral-800/60 text-neutral-400 dark:text-neutral-500 border border-neutral-200/50 dark:border-neutral-700/50"
                          }`}
                        >
                          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${isNumberValid ? "text-emerald-500" : "opacity-30"}`} />
                          <span>{t.ruleNumber}</span>
                        </div>

                        <div
                          className={`flex items-center gap-1.5 p-2 rounded-xl transition-all ${
                            isSpecialValid
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/25 shadow-2xs"
                              : "bg-neutral-100/80 dark:bg-neutral-800/60 text-neutral-400 dark:text-neutral-500 border border-neutral-200/50 dark:border-neutral-700/50"
                          }`}
                        >
                          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${isSpecialValid ? "text-emerald-500" : "opacity-30"}`} />
                          <span>{t.ruleSpecialChar}</span>
                        </div>

                        <div
                          className={`flex items-center gap-1.5 p-2 rounded-xl transition-all sm:col-span-2 lg:col-span-2 ${
                            isNotSameValid
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/25 shadow-2xs"
                              : "bg-neutral-100/80 dark:bg-neutral-800/60 text-neutral-400 dark:text-neutral-500 border border-neutral-200/50 dark:border-neutral-700/50"
                          }`}
                        >
                          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${isNotSameValid ? "text-emerald-500" : "opacity-30"}`} />
                          <span>{t.ruleNotSameOld}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="flex items-center justify-end gap-3 p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl shadow-xs">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={!isDirty}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    isDirty
                      ? "bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 cursor-pointer active:scale-95 shadow-2xs"
                      : "opacity-40 cursor-not-allowed text-neutral-400"
                  }`}
                >
                  {t.cancelChanges}
                </button>

                <button
                  type="submit"
                  disabled={!isFormValid}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-200 ${
                    isFormValid
                      ? "bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 cursor-pointer active:scale-95 hover:shadow-indigo-500/40"
                      : "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed opacity-60"
                  }`}
                >
                  <Check className="h-4 w-4 stroke-[2.5]" />
                  <span>{t.saveAccountInfo}</span>
                </button>
              </div>
            </form>
          )}

          {/* ===================== DISPLAY SUBTAB ===================== */}
          {activeSubTab === "display" && (
            <form onSubmit={handleSaveDisplay} className="space-y-5 animate-scale-in">
              {/* Theme & Visual Appearance Card */}
              <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/80 p-5 sm:p-6 shadow-xs backdrop-blur-xl space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-200">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                      <Sun className="h-3.5 w-3.5" />
                    </div>
                    <span>{t.themeSectionTitle}</span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {t.themeSectionDesc}
                  </p>
                </div>

                {/* Theme Selector Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Light Mode Card */}
                  <div
                    onClick={() => setIsDarkMode(false)}
                    className={`relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center gap-4 ${
                      !isDarkMode
                        ? "border-amber-500/80 bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-yellow-50/20 dark:bg-amber-950/20 ring-2 ring-amber-500/20 shadow-md shadow-amber-500/10"
                        : "border-neutral-200/80 dark:border-neutral-800 hover:border-amber-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30"
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                        !isDarkMode
                          ? "bg-gradient-to-tr from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/30"
                          : "bg-neutral-200/80 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                      }`}
                    >
                      <Sun className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="text-xs font-bold text-neutral-900 dark:text-white flex items-center justify-between">
                        <span>{t.lightModeTitle}</span>
                        {!isDarkMode && (
                          <div className="h-5 w-5 rounded-full bg-amber-500 text-white flex items-center justify-center">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {t.lightModeDesc}
                      </p>
                    </div>
                  </div>

                  {/* Dark Mode Card */}
                  <div
                    onClick={() => setIsDarkMode(true)}
                    className={`relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center gap-4 ${
                      isDarkMode
                        ? "border-indigo-500/80 bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-neutral-900/80 ring-2 ring-indigo-500/20 shadow-md shadow-indigo-500/15"
                        : "border-neutral-200/80 dark:border-neutral-800 hover:border-indigo-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30"
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                        isDarkMode
                          ? "bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/30"
                          : "bg-neutral-200/80 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                      }`}
                    >
                      <Moon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="text-xs font-bold text-neutral-900 dark:text-white flex items-center justify-between">
                        <span>{t.darkModeTitle}</span>
                        {isDarkMode && (
                          <div className="h-5 w-5 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {t.darkModeDesc}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Language & Font Selection Card */}
              <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/80 p-5 sm:p-6 shadow-xs backdrop-blur-xl space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-200">
                    <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/20">
                      <Globe className="h-3.5 w-3.5" />
                    </div>
                    <span>{t.langFontSectionTitle}</span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {t.langFontSectionDesc}
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Language Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                      {t.systemLanguageLabel}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setLocalLanguage("th")}
                        className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex items-center justify-between ${
                          localLanguage === "th"
                            ? "border-indigo-500 bg-gradient-to-br from-indigo-50/90 to-purple-50/50 dark:from-indigo-950/40 dark:to-purple-950/20 ring-2 ring-indigo-500/20 shadow-sm"
                            : "border-neutral-200/80 dark:border-neutral-800 hover:border-indigo-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl drop-shadow-xs">🇹🇭</span>
                          <div>
                            <div className="text-xs font-bold text-neutral-900 dark:text-white">{t.langThai}</div>
                            <div className="text-[10px] text-neutral-500">{t.langThaiSub}</div>
                          </div>
                        </div>
                        {localLanguage === "th" && (
                          <div className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setLocalLanguage("en")}
                        className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex items-center justify-between ${
                          localLanguage === "en"
                            ? "border-indigo-500 bg-gradient-to-br from-indigo-50/90 to-purple-50/50 dark:from-indigo-950/40 dark:to-purple-950/20 ring-2 ring-indigo-500/20 shadow-sm"
                            : "border-neutral-200/80 dark:border-neutral-800 hover:border-indigo-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl drop-shadow-xs">🇬🇧</span>
                          <div>
                            <div className="text-xs font-bold text-neutral-900 dark:text-white">{t.langEnglish}</div>
                            <div className="text-[10px] text-neutral-500">{t.langEnglishSub}</div>
                          </div>
                        </div>
                        {localLanguage === "en" && (
                          <div className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Font Family Selector */}
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                      {t.fontFamilyLabel}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { id: "IBM Plex Sans Thai", name: "IBM Plex Sans Thai", note: t.fontIbmPlexNote },
                        { id: "Noto Sans Thai", name: "Noto Sans Thai", note: t.fontNotoSansNote },
                        { id: "Sarabun", name: "Sarabun", note: t.fontSarabunNote },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setLocalFont(f.id)}
                          style={{ fontFamily: getFontFamilyValue(f.id) }}
                          className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between h-22 ${
                            localFont === f.id
                              ? "border-purple-500 bg-gradient-to-br from-purple-50/90 to-indigo-50/50 dark:from-purple-950/40 dark:to-indigo-950/20 ring-2 ring-purple-500/20 shadow-sm"
                              : "border-neutral-200/80 dark:border-neutral-800 hover:border-purple-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/20"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-900 dark:text-white">{f.name}</span>
                            {localFont === f.id && (
                              <div className="h-4 w-4 rounded-full bg-purple-600 text-white flex items-center justify-center">
                                <Check className="h-2.5 w-2.5 stroke-[3]" />
                              </div>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            กขค ABC 123 ({f.note})
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Currency & Calendar Formatting Card */}
              <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/80 p-5 sm:p-6 shadow-xs backdrop-blur-xl space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-200">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                      <DollarSign className="h-3.5 w-3.5" />
                    </div>
                    <span>{t.currencyCalendarSectionTitle}</span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {t.currencyCalendarSectionDesc}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Currency Units */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                      {t.currencyLabel}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "THB", label: t.currThb, sub: "THB", color: "emerald" },
                        { id: "USD", label: t.currUsd, sub: "USD", color: "sky" },
                        { id: "JPY", label: t.currJpy, sub: "JPY", color: "rose" },
                      ].map((curr) => {
                        const isSelected = localCurrency === curr.id;
                        return (
                          <button
                            key={curr.id}
                            type="button"
                            onClick={() => setLocalCurrency(curr.id)}
                            className={`p-3 rounded-2xl border text-center transition-all duration-200 cursor-pointer ${
                              isSelected
                                ? curr.color === "emerald"
                                  ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-xs"
                                  : curr.color === "sky"
                                  ? "border-sky-500 bg-sky-50/80 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 ring-2 ring-sky-500/20 shadow-xs"
                                  : "border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 ring-2 ring-rose-500/20 shadow-xs"
                                : "border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/20 text-neutral-800 dark:text-neutral-200"
                            }`}
                          >
                            <div className="text-xs font-bold">{curr.label}</div>
                            <div className={`text-[10px] mt-0.5 font-medium ${isSelected ? "opacity-90" : "text-neutral-400"}`}>{curr.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Calendar Era */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                      {t.calendarLabel}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "buddhist", label: t.calBuddhist, example: localLanguage === "en" ? "B.E. 2569" : "พ.ศ. 2569" },
                        { id: "christian", label: t.calChristian, example: localLanguage === "en" ? "A.D. 2026" : "ค.ศ. 2026" },
                      ].map((cal) => (
                        <button
                          key={cal.id}
                          type="button"
                          onClick={() => setLocalCalendar(cal.id)}
                          className={`p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                            localCalendar === cal.id
                              ? "border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-500/20 shadow-xs"
                              : "border-neutral-200/80 dark:border-neutral-800 hover:border-indigo-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/20"
                          }`}
                        >
                          <div className="text-xs font-bold text-neutral-900 dark:text-white">{cal.label}</div>
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">{cal.example}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Real-Time Showcase Card */}
                <div className="pt-2">
                  <div className="p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-pink-50/40 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-neutral-900/60 backdrop-blur-sm shadow-xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
                          <Sliders className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            {t.previewTitle}
                          </div>
                          <div
                            style={{ fontFamily: getFontFamilyValue(localFont) }}
                            className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white mt-0.5"
                          >
                            {localLanguage === "en"
                              ? `${t.revenuePreviewLabel}: ${getPreviewFormattedCurrency()} • ${t.datePreviewLabel}: 25 Jul ${localCalendar === "buddhist" ? 2569 : 2026}`
                              : `${t.revenuePreviewLabel}: ${getPreviewFormattedCurrency()} • ${t.datePreviewLabel}: 25 ก.ค. ${localCalendar === "buddhist" ? 2569 : 2026}`}
                          </div>
                        </div>
                      </div>

                      <div className="px-3 py-1 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold border border-indigo-500/25">
                        {localFont}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-end p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl shadow-xs">
                <button
                  type="submit"
                  disabled={isSavingDisplay}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-200 ${
                    isSavingDisplay
                      ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-purple-500/30 cursor-pointer active:scale-95 hover:shadow-purple-500/40"
                  }`}
                >
                  {isSavingDisplay ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t.saving}</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 stroke-[2.5]" />
                      <span>{t.saveDisplaySettings}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ===================== GENERAL SUBTAB ===================== */}
          {activeSubTab === "general" && (
            <form onSubmit={handleSaveGeneral} className="space-y-5 animate-scale-in">
              <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/80 p-5 sm:p-6 shadow-xs backdrop-blur-xl space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-200">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                      <Bell className="h-3.5 w-3.5" />
                    </div>
                    <span>{t.generalSectionTitle}</span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {t.generalSectionDesc}
                  </p>
                </div>

                <div className="space-y-3.5">
                  {/* Daily Sales Notification Card */}
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/60 dark:bg-neutral-800/30 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 hover:border-indigo-200 dark:hover:border-indigo-900/40 transition-all duration-200">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                        <Activity className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <label
                          htmlFor="notifToggle"
                          className="block text-xs font-bold text-neutral-900 dark:text-white cursor-pointer"
                        >
                          {t.dailyNotificationTitle}
                        </label>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {t.dailyNotificationDesc}
                        </p>
                      </div>
                    </div>

                    {/* Modern Colorful iOS Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={localNotifications}
                      onClick={() => setLocalNotifications(!localNotifications)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        localNotifications
                          ? "bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md shadow-blue-500/30"
                          : "bg-neutral-300 dark:bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          localNotifications ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Auto-save Drafts */}
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/60 dark:bg-neutral-800/30 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 hover:border-emerald-200 dark:hover:border-emerald-900/40 transition-all duration-200">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-neutral-900 dark:text-white">
                          {t.autoSaveTitle}
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {t.autoSaveDesc}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoSaveEnabled}
                      onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        autoSaveEnabled
                          ? "bg-gradient-to-r from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/30"
                          : "bg-neutral-300 dark:bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          autoSaveEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-end p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl shadow-xs">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/30 cursor-pointer active:scale-95 transition-all duration-200"
                >
                  <Check className="h-4 w-4 stroke-[2.5]" />
                  <span>{t.saveGeneralSettings}</span>
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
};

export const SettingsTab = React.memo(SettingsTabComponent);

