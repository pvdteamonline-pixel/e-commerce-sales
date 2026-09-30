export type Language = "th" | "en";

export interface TranslationDict {
  // Common / General
  save: string;
  saving: string;
  cancel: string;
  savedSuccess: string;
  cancelSuccess: string;
  confirm: string;
  delete: string;
  edit: string;
  close: string;
  search: string;
  searchPlaceholder: string;
  all: string;
  none: string;
  status: string;
  actions: string;
  date: string;
  total: string;
  quantity: string;
  price: string;
  category: string;
  channel: string;
  brand: string;
  product: string;
  customer: string;
  active: string;
  inactive: string;
  admin: string;
  manager: string;
  employee: string;
  user: string;

  // Navigation
  navDashboard: string;
  navSales: string;
  navSalesIncome: string;
  navSalesProducts: string;
  navSalesBrands: string;
  navCalculator: string;
  navUsers: string;
  navSettings: string;
  navImportOrders: string;
  navTrash: string;

  // Header & Profile Dropdown
  profileTitle: string;
  systemStatus: string;
  systemNormal: string;
  systemVersion: string;
  userRole: string;
  backupData: string;
  restoreData: string;
  trashRecovery: string;
  logout: string;
  notifications: string;
  broadcast: string;
  markAllRead: string;
  markAsRead: string;
  allNotifications: string;
  viewAllNotifications: string;
  noNotificationsInCat: string;
  fromSender: string;
  openThisPage: string;
  newBadge: string;
  urgentBadge: string;
  filterAll: string;
  filterMine: string;
  filterActivity: string;
  filterSystem: string;

  // Settings Tab - Navigation & Header
  settingsBannerTitle: string;
  settingsBannerSubtitle: string;
  settingsBannerTag: string;
  settingsNavCategory: string;
  tabAccount: string;
  tabAccountSub: string;
  tabDisplay: string;
  tabDisplaySub: string;
  tabGeneral: string;
  tabGeneralSub: string;

  // Settings - Account Subtab
  changePhoto: string;
  uploadPhoto: string;
  removePhoto: string;
  noNameSet: string;
  noEmailSet: string;
  personalInfoTitle: string;
  personalInfoDesc: string;
  fullNameLabel: string;
  fullNamePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  rolePermissionLabel: string;
  adminRoleDesc: string;
  managerRoleDesc: string;
  employeeRoleDesc: string;
  securityTitle: string;
  securityDesc: string;
  currentPasswordLabel: string;
  currentPasswordPlaceholder: string;
  newPasswordLabel: string;
  newPasswordPlaceholder: string;
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  passwordMismatch: string;
  passwordStrengthLabel: string;
  strengthVeryStrong: string;
  strengthGood: string;
  strengthFair: string;
  strengthWeak: string;
  ruleMin8Chars: string;
  ruleUpperLower: string;
  ruleNumber: string;
  ruleSpecialChar: string;
  ruleNotSameOld: string;
  cancelChanges: string;
  saveAccountInfo: string;

  // Settings - Display Subtab
  themeSectionTitle: string;
  themeSectionDesc: string;
  lightModeTitle: string;
  lightModeDesc: string;
  darkModeTitle: string;
  darkModeDesc: string;
  langFontSectionTitle: string;
  langFontSectionDesc: string;
  systemLanguageLabel: string;
  langThai: string;
  langThaiSub: string;
  langEnglish: string;
  langEnglishSub: string;
  fontFamilyLabel: string;
  fontIbmPlex: string;
  fontIbmPlexNote: string;
  fontNotoSans: string;
  fontNotoSansNote: string;
  fontSarabun: string;
  fontSarabunNote: string;
  currencyCalendarSectionTitle: string;
  currencyCalendarSectionDesc: string;
  currencyLabel: string;
  currThb: string;
  currUsd: string;
  currJpy: string;
  calendarLabel: string;
  calBuddhist: string;
  calChristian: string;
  previewTitle: string;
  revenuePreviewLabel: string;
  datePreviewLabel: string;
  saveDisplaySettings: string;
  displaySavedTitle: string;
  displaySavedDesc: string;

  // Settings - General Subtab
  generalSectionTitle: string;
  generalSectionDesc: string;
  dailyNotificationTitle: string;
  dailyNotificationDesc: string;
  autoSaveTitle: string;
  autoSaveDesc: string;
  saveGeneralSettings: string;
  generalSavedSuccess: string;

  // Validation / Alerts
  errNameRequired: string;
  errEmailInvalid: string;
  errPhoneInvalid: string;
  errCurrentPasswordIncorrect: string;
  errNewPasswordInsecure: string;
  errPasswordMismatch: string;
  errOnlyJpgPng: string;
  errFileSizeExceeded: string;
}

export const translations: Record<Language, TranslationDict> = {
  th: {
    save: "บันทึก",
    saving: "กำลังบันทึก...",
    cancel: "ยกเลิก",
    savedSuccess: "บันทึกเรียบร้อยแล้ว",
    cancelSuccess: "ยกเลิกการเปลี่ยนแปลงเรียบร้อยแล้ว",
    confirm: "ยืนยัน",
    delete: "ลบ",
    edit: "แก้ไข",
    close: "ปิด",
    search: "ค้นหา",
    searchPlaceholder: "ค้นหา...",
    all: "ทั้งหมด",
    none: "ไม่มี",
    status: "สถานะ",
    actions: "การกระทำ",
    date: "วันที่",
    total: "ยอดรวม",
    quantity: "จำนวน",
    price: "ราคา",
    category: "หมวดหมู่",
    channel: "ช่องทาง",
    brand: "แบรนด์",
    product: "สินค้า",
    customer: "ลูกค้า",
    active: "เปิดใช้งาน",
    inactive: "ระงับการใช้งาน",
    admin: "ผู้ดูแลระบบ",
    manager: "ผู้จัดการ",
    employee: "พนักงาน",
    user: "ผู้ใช้งาน",

    navDashboard: "แดชบอร์ด",
    navSales: "ยอดขาย",
    navSalesIncome: "รายการยอดขาย",
    navSalesProducts: "ข้อมูลสินค้า",
    navSalesBrands: "ข้อมูลแบรนด์",
    navCalculator: "เครื่องคำนวณ",
    navUsers: "ผู้ใช้งาน",
    navSettings: "ตั้งค่า",
    navImportOrders: "นำเข้าไฟล์ Excel",
    navTrash: "ถังขยะกู้คืนข้อมูล",

    profileTitle: "โปรไฟล์และบัญชีผู้ใช้",
    systemStatus: "สถานะระบบและความปลอดภัย",
    systemNormal: "เสถียร ปกติ",
    systemVersion: "v2.4 Enterprise",
    userRole: "สิทธิ์ผู้ใช้",
    backupData: "สำรองข้อมูล (.json)",
    restoreData: "กู้คืนข้อมูล (.json)",
    trashRecovery: "ถังขยะกู้คืนข้อมูล",
    logout: "ออกจากระบบ",
    notifications: "การแจ้งเตือน",
    broadcast: "ส่งประกาศ",
    markAllRead: "อ่านทั้งหมด",
    markAsRead: "อ่านแล้ว",
    allNotifications: "การแจ้งเตือนทั้งหมด",
    viewAllNotifications: "ดูการแจ้งเตือนทั้งหมด",
    noNotificationsInCat: "ไม่มีรายการแจ้งเตือนในหมวดนี้",
    fromSender: "จาก",
    openThisPage: "เปิดหน้านี้ →",
    newBadge: "ใหม่",
    urgentBadge: "ด่วน",
    filterAll: "ทั้งหมด",
    filterMine: "เฉพาะฉัน/งาน",
    filterActivity: "กิจกรรมทีม",
    filterSystem: "ระบบ/คลัง",

    settingsBannerTitle: "ตั้งค่าระบบและบัญชีผู้ใช้",
    settingsBannerSubtitle: "จัดการข้อมูลโปรไฟล์ ความปลอดภัย รูปแบบการแสดงผล และการแจ้งเตือนส่วนบุคคลของคุณ",
    settingsBannerTag: "System Preferences & Profile",
    settingsNavCategory: "หมวดหมู่การตั้งค่า",
    tabAccount: "บัญชีผู้ใช้",
    tabAccountSub: "Account & Security",
    tabDisplay: "การแสดงผล",
    tabDisplaySub: "Theme & Formatting",
    tabGeneral: "ข้อมูลทั่วไป",
    tabGeneralSub: "Notifications & System",

    changePhoto: "เปลี่ยนรูป",
    uploadPhoto: "อัปโหลดรูปภาพ",
    removePhoto: "ลบรูป",
    noNameSet: "ยังไม่ได้ตั้งชื่อ",
    noEmailSet: "ไม่มีอีเมล",
    personalInfoTitle: "ข้อมูลส่วนตัว (Personal Information)",
    personalInfoDesc: "ข้อมูลพื้นฐานสำหรับระบุตัวตนในการทำงานและการติดต่อ",
    fullNameLabel: "ชื่อ-นามสกุล (Full Name)",
    fullNamePlaceholder: "กรุณากรอกชื่อ-นามสกุล",
    emailLabel: "อีเมลสำหรับเข้าสู่ระบบ (Email Address)",
    emailPlaceholder: "example@company.com",
    phoneLabel: "เบอร์โทรศัพท์ติดต่อ (Phone Number)",
    phonePlaceholder: "08X-XXX-XXXX (10 หลัก)",
    rolePermissionLabel: "ระดับบทบาทและสิทธิ์ (Role & Permission)",
    adminRoleDesc: "สิทธิ์ผู้ดูแลระบบสูงสุด (Administrator) — เข้าถึงได้ทุกฟังก์ชัน",
    managerRoleDesc: "สิทธิ์ผู้จัดการ (Manager) — จัดการข้อมูลและทีมงานตามที่ได้รับมอบหมาย",
    employeeRoleDesc: "สิทธิ์พนักงาน (Employee) — ใช้งานตามงานที่ได้รับมอบหมาย",
    securityTitle: "ความปลอดภัยและรหัสผ่าน (Security & Password)",
    securityDesc: "อัปเดตรหัสผ่านใหม่เพื่อความปลอดภัยในการเข้าถึงระบบ",
    currentPasswordLabel: "รหัสผ่านปัจจุบัน (Current Password)",
    currentPasswordPlaceholder: "กรอกรหัสผ่านเดิมเพื่อยืนยันตัวตน",
    newPasswordLabel: "รหัสผ่านใหม่ (New Password)",
    newPasswordPlaceholder: "กำหนดรหัสผ่านใหม่ที่ปลอดภัย",
    confirmPasswordLabel: "ยืนยันรหัสผ่านใหม่ (Confirm Password)",
    confirmPasswordPlaceholder: "พิมพ์รหัสผ่านใหม่อีกครั้ง",
    passwordMismatch: "การยืนยันรหัสผ่านไม่ตรงกัน",
    passwordStrengthLabel: "ระดับความปลอดภัยของรหัสผ่าน:",
    strengthVeryStrong: "แข็งแกร่งมาก (Strong)",
    strengthGood: "ปานกลาง (Good)",
    strengthFair: "พอใช้ (Fair)",
    strengthWeak: "อ่อนแอ (Weak)",
    ruleMin8Chars: "อย่างน้อย 8 ตัวอักษร",
    ruleUpperLower: "พิมพ์ใหญ่และพิมพ์เล็ก",
    ruleNumber: "ตัวเลข (0-9)",
    ruleSpecialChar: "อักขระพิเศษ (!@#$%^&*)",
    ruleNotSameOld: "ไม่ซ้ำกับรหัสผ่านเดิม",
    cancelChanges: "ยกเลิกการเปลี่ยนแปลง",
    saveAccountInfo: "บันทึกข้อมูลบัญชีผู้ใช้",

    themeSectionTitle: "ธีมและการแสดงผล (Theme & Mode)",
    themeSectionDesc: "เลือกโหมดการแสดงผลที่สบายตาและเหมาะกับการใช้งานของคุณ",
    lightModeTitle: "โหมดสว่าง (Light Mode)",
    lightModeDesc: "สะอาดตา อ่านง่าย เหมาะกับสภาพแสงธรรมชาติ",
    darkModeTitle: "โหมดมืด (Dark Mode)",
    darkModeDesc: "โทนสีดำพรีเมียม สบายตาในการทำงานเวลากลางคืน",
    langFontSectionTitle: "ภาษาและแบบอักษร (Language & Typography)",
    langFontSectionDesc: "ปรับแต่งภาษาหลักของระบบและฟอนต์สำหรับการอ่านที่คมชัด",
    systemLanguageLabel: "ภาษาของระบบ (System Language)",
    langThai: "ภาษาไทย",
    langThaiSub: "ค่าเริ่มต้นระบบ (Default)",
    langEnglish: "English",
    langEnglishSub: "International English",
    fontFamilyLabel: "รูปแบบฟอนต์ (Font Family)",
    fontIbmPlex: "IBM Plex Sans Thai",
    fontIbmPlexNote: "คมชัด แนะนำ",
    fontNotoSans: "Noto Sans Thai",
    fontNotoSansNote: "เรียบหรู ทันสมัย",
    fontSarabun: "Sarabun",
    fontSarabunNote: "ทางการ มาตรฐาน",
    currencyCalendarSectionTitle: "สกุลเงินและรูปแบบปฏิทิน (Currency & Calendar Format)",
    currencyCalendarSectionDesc: "กำหนดหน่วยเงินตราและศักราชที่ใช้แสดงในตารางและรายงานยอดขาย",
    currencyLabel: "หน่วยเงินตรา (Currency)",
    currThb: "บาท (฿)",
    currUsd: "ดอลลาร์ ($)",
    currJpy: "เยน (¥)",
    calendarLabel: "รูปแบบศักราช (Date Era)",
    calBuddhist: "พุทธศักราช (พ.ศ.)",
    calChristian: "คริสต์ศักราช (ค.ศ.)",
    previewTitle: "ตัวอย่างการแสดงผลจริงแบบเรียลไทม์",
    revenuePreviewLabel: "ยอดขายสุทธิ",
    datePreviewLabel: "วันที่",
    saveDisplaySettings: "บันทึกการแสดงผล",
    displaySavedTitle: "บันทึกการตั้งค่าสำเร็จ",
    displaySavedDesc: "ระบบได้อัปเดตการแสดงผลและปรับปรุงเรียบร้อย",

    generalSectionTitle: "การแจ้งเตือนและการทำงานทั่วไป (Notifications & Preferences)",
    generalSectionDesc: "ปรับแต่งการแจ้งเตือนยอดขายและประสบการณ์การใช้งานระบบ",
    dailyNotificationTitle: "รับการแจ้งเตือนสรุปยอดขายรายวัน (Daily Sales Summary)",
    dailyNotificationDesc: "ส่งสรุปยอดขายสุทธิและจำนวนคำสั่งซื้อประจำวันผ่านแถบการแจ้งเตือน",
    autoSaveTitle: "บันทึกการตั้งค่าลงเบราว์เซอร์อัตโนมัติ (LocalStorage Cache)",
    autoSaveDesc: "จดจำการตั้งค่าหน้าจอและภาษาแม้ปิดเบราว์เซอร์",
    saveGeneralSettings: "บันทึกข้อมูลทั่วไป",
    generalSavedSuccess: "บันทึกการตั้งค่าข้อมูลทั่วไปเรียบร้อยแล้ว",

    errNameRequired: "กรุณากรอกชื่อผู้ใช้งาน",
    errEmailInvalid: "กรุณากรอกอีเมลที่ถูกต้อง",
    errPhoneInvalid: "กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง (10 หลัก)",
    errCurrentPasswordIncorrect: "รหัสผ่านเดิมไม่ถูกต้อง",
    errNewPasswordInsecure: "รหัสผ่านใหม่ไม่ตรงตามเงื่อนไขความปลอดภัย",
    errPasswordMismatch: "ยืนยันรหัสผ่านใหม่ไม่ตรงกัน",
    errOnlyJpgPng: "รองรับเฉพาะไฟล์รูปภาพ JPG หรือ PNG เท่านั้น",
    errFileSizeExceeded: "ขนาดรูปภาพต้องไม่เกิน 2MB",
  },
  en: {
    save: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    savedSuccess: "Saved successfully",
    cancelSuccess: "Changes cancelled successfully",
    confirm: "Confirm",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
    search: "Search",
    searchPlaceholder: "Search...",
    all: "All",
    none: "None",
    status: "Status",
    actions: "Actions",
    date: "Date",
    total: "Total",
    quantity: "Quantity",
    price: "Price",
    category: "Category",
    channel: "Channel",
    brand: "Brand",
    product: "Product",
    customer: "Customer",
    active: "Active",
    inactive: "Inactive",
    admin: "Administrator",
    manager: "Manager",
    employee: "Employee",
    user: "User",

    navDashboard: "Dashboard",
    navSales: "Sales",
    navSalesIncome: "Sales Revenue",
    navSalesProducts: "Product Catalog",
    navSalesBrands: "Brand Analytics",
    navCalculator: "Calculator",
    navUsers: "Users",
    navSettings: "Settings",
    navImportOrders: "Import Excel",
    navTrash: "Trash & Recovery",

    profileTitle: "Profile & Account",
    systemStatus: "System & Security Status",
    systemNormal: "Stable / Operational",
    systemVersion: "v2.4 Enterprise",
    userRole: "User Role",
    backupData: "Backup Data (.json)",
    restoreData: "Restore Data (.json)",
    trashRecovery: "Trash & Recovery Bin",
    logout: "Log Out",
    notifications: "Notifications",
    broadcast: "Broadcast",
    markAllRead: "Mark all read",
    markAsRead: "Mark read",
    allNotifications: "All Notifications",
    viewAllNotifications: "View all notifications",
    noNotificationsInCat: "No notifications in this category",
    fromSender: "From",
    openThisPage: "Open page →",
    newBadge: "NEW",
    urgentBadge: "URGENT",
    filterAll: "All",
    filterMine: "My Tasks",
    filterActivity: "Team Activity",
    filterSystem: "System & Stock",

    settingsBannerTitle: "System & Account Settings",
    settingsBannerSubtitle: "Manage your profile, security, display preferences, and notifications",
    settingsBannerTag: "System Preferences & Profile",
    settingsNavCategory: "Setting Categories",
    tabAccount: "Account",
    tabAccountSub: "Profile & Security",
    tabDisplay: "Display",
    tabDisplaySub: "Theme & Formatting",
    tabGeneral: "General",
    tabGeneralSub: "Notifications & System",

    changePhoto: "Change",
    uploadPhoto: "Upload Photo",
    removePhoto: "Remove Photo",
    noNameSet: "No name specified",
    noEmailSet: "No email specified",
    personalInfoTitle: "Personal Information",
    personalInfoDesc: "Basic contact information and system profile identity",
    fullNameLabel: "Full Name",
    fullNamePlaceholder: "Enter full name",
    emailLabel: "Email Address",
    emailPlaceholder: "example@company.com",
    phoneLabel: "Phone Number",
    phonePlaceholder: "08X-XXX-XXXX (10 digits)",
    rolePermissionLabel: "Role & Permission Level",
    adminRoleDesc: "Administrator — Full unrestricted access to all modules and features",
    managerRoleDesc: "Manager — Access to reports, analytics, and managed staff tools",
    employeeRoleDesc: "Employee — Access assigned workflow and operational tasks",
    securityTitle: "Security & Password",
    securityDesc: "Update your authentication password to maintain system security",
    currentPasswordLabel: "Current Password",
    currentPasswordPlaceholder: "Enter existing password to verify",
    newPasswordLabel: "New Password",
    newPasswordPlaceholder: "Create a secure new password",
    confirmPasswordLabel: "Confirm Password",
    confirmPasswordPlaceholder: "Type new password again",
    passwordMismatch: "Password confirmation does not match",
    passwordStrengthLabel: "Password Security Strength:",
    strengthVeryStrong: "Very Strong",
    strengthGood: "Good",
    strengthFair: "Fair",
    strengthWeak: "Weak",
    ruleMin8Chars: "At least 8 characters",
    ruleUpperLower: "Upper & lower case",
    ruleNumber: "Numbers (0-9)",
    ruleSpecialChar: "Special symbols (!@#$%^&*)",
    ruleNotSameOld: "Different from old password",
    cancelChanges: "Discard Changes",
    saveAccountInfo: "Save Account Details",

    themeSectionTitle: "Theme & Appearance",
    themeSectionDesc: "Choose a visual theme that best suits your work environment",
    lightModeTitle: "Light Mode",
    lightModeDesc: "Clean, crisp, high-contrast interface for daytime lighting",
    darkModeTitle: "Dark Mode",
    darkModeDesc: "Sleek premium dark tone, easy on eyes during night work",
    langFontSectionTitle: "Language & Typography",
    langFontSectionDesc: "Configure system display language and typography fonts",
    systemLanguageLabel: "System Language",
    langThai: "ภาษาไทย (Thai)",
    langThaiSub: "ค่าเริ่มต้นระบบ (Default)",
    langEnglish: "English",
    langEnglishSub: "International English",
    fontFamilyLabel: "Font Family",
    fontIbmPlex: "IBM Plex Sans Thai",
    fontIbmPlexNote: "Sharp & Crisp (Recommended)",
    fontNotoSans: "Noto Sans Thai",
    fontNotoSansNote: "Modern & Clean",
    fontSarabun: "Sarabun",
    fontSarabunNote: "Formal & Standard",
    currencyCalendarSectionTitle: "Currency & Calendar Format",
    currencyCalendarSectionDesc: "Select currency symbols and calendar era for sales reports and tables",
    currencyLabel: "Currency Unit",
    currThb: "Thai Baht (฿)",
    currUsd: "US Dollar ($)",
    currJpy: "Japanese Yen (¥)",
    calendarLabel: "Calendar Era",
    calBuddhist: "Buddhist Era (B.E.)",
    calChristian: "Christian Era (A.D.)",
    previewTitle: "Real-time Live Formatting Preview",
    revenuePreviewLabel: "Net Revenue",
    datePreviewLabel: "Date",
    saveDisplaySettings: "Save Display Settings",
    displaySavedTitle: "Settings Saved Successfully",
    displaySavedDesc: "The system appearance and language preferences have been updated",

    generalSectionTitle: "Notifications & Preferences",
    generalSectionDesc: "Configure automated sales alerts and application storage preferences",
    dailyNotificationTitle: "Daily Sales Summary Alert",
    dailyNotificationDesc: "Send daily total revenue and order count updates to notification bar",
    autoSaveTitle: "Automatic Browser Storage (LocalStorage Cache)",
    autoSaveDesc: "Remember display configurations and language preference across sessions",
    saveGeneralSettings: "Save General Settings",
    generalSavedSuccess: "General preferences updated successfully",

    errNameRequired: "Please enter your name",
    errEmailInvalid: "Please enter a valid email address",
    errPhoneInvalid: "Please enter a valid 10-digit phone number",
    errCurrentPasswordIncorrect: "Current password is incorrect",
    errNewPasswordInsecure: "New password does not meet security criteria",
    errPasswordMismatch: "New passwords do not match",
    errOnlyJpgPng: "Only JPG or PNG images are supported",
    errFileSizeExceeded: "Image size must not exceed 2MB",
  },
};

export const getTranslation = (lang: string = "th"): TranslationDict => {
  if (lang === "en") {
    return translations.en;
  }
  return translations.th;
};
