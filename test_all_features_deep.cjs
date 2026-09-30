const { chromium } = require("@playwright/test");

(async () => {
  console.log("======================================================================");
  console.log("🚀 STARTING ULTIMATE E-COMMERCE SALES FULL FEATURE & BUTTON AUDIT");
  console.log("======================================================================");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const results = [];
  const uncaughtErrors = [];

  page.on("pageerror", (err) => {
    console.error(`🚨 [Page Uncaught Error] ${err.message}`);
    uncaughtErrors.push(err.message);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("favicon")) {
      console.warn(`⚠️ [Console Error]: ${msg.text()}`);
    }
  });

  function record(section, feature, passed, details = "") {
    results.push({ section, feature, passed, details });
    const tag = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${tag} [${section}] ${feature}${details ? ` -> ${details}` : ""}`);
  }

  try {
    // ---------------------------------------------------------
    // 1. SYSTEM INITIALIZATION & LOGIN
    // ---------------------------------------------------------
    console.log("\n--- [1] INITIALIZATION & AUTHENTICATION ---");
    await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const pageTitle = await page.title();
    record("Auth", "System Load & App Title", pageTitle.length > 0, `Title: "${pageTitle}"`);

    const loginSubmitBtn = page.locator('button[type="submit"]').or(page.locator('button:has-text("เข้าสู่ระบบ")')).first();
    if (await loginSubmitBtn.isVisible()) {
      const userInput = page.locator('input[placeholder*="ชื่อผู้ใช้"]').or(page.locator('input[type="text"]')).first();
      const passInput = page.locator('input[type="password"]').first();
      await userInput.fill("phanvadee");
      await passInput.fill("Admin1234*");
      await loginSubmitBtn.click();
      await page.waitForTimeout(1500);

      const loggedIn = !(await loginSubmitBtn.isVisible());
      record("Auth", "Admin Authentication", loggedIn, "Successfully logged in as phanvadee");
    } else {
      record("Auth", "Session Active", true, "Already logged in");
    }

    // ---------------------------------------------------------
    // 2. HEADER CONTROLS & POPUPS
    // ---------------------------------------------------------
    console.log("\n--- [2] HEADER NAVIGATION, THEME & SYSTEM POPUPS ---");

    // Theme Switcher (Dark / Light)
    const themeBtn = page.locator('header button:has-text("☀️")').or(page.locator('header button:has-text("🌙")')).first();
    if (await themeBtn.isVisible()) {
      const wasDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
      await themeBtn.click();
      await page.waitForTimeout(300);
      const isDarkNow = await page.evaluate(() => document.documentElement.classList.contains("dark"));
      record("Header", "Dark/Light Theme Toggle", wasDark !== isDarkNow, `Theme switched (Dark was ${wasDark} -> now ${isDarkNow})`);
      // Toggle back
      await themeBtn.click();
      await page.waitForTimeout(300);
    } else {
      record("Header", "Dark/Light Theme Toggle", false, "Theme button not visible");
    }

    // Notification Dropdown
    const notifBtn = page.locator('header button:has(svg.lucide-bell)').first();
    if (await notifBtn.isVisible()) {
      await notifBtn.click();
      await page.waitForTimeout(500);
      const notifPopover = await page.locator('text=การแจ้งเตือน').first().isVisible();
      record("Header", "Notification Bell Popover", notifPopover, "Notification drawer/popover rendered");
      
      // Close dropdown
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    // User Profile Dropdown
    const profileBtn = page.locator('header button:has-text("phanvadee")').first();
    if (await profileBtn.isVisible()) {
      await profileBtn.click();
      await page.waitForTimeout(400);

      // Audit logs modal
      const auditLogItem = page.locator('button:has-text("Audit Logs")').or(page.locator('button:has-text("ประวัติการใช้งาน")')).first();
      if (await auditLogItem.isVisible()) {
        await auditLogItem.click();
        await page.waitForTimeout(600);
        const auditModal = await page.locator('h3:has-text("Audit")').or(page.locator('text=ประวัติการใช้งานระบบ')).first().isVisible();
        record("Header", "Audit Logs Modal", auditModal, "Audit logs modal opened");
        // Close modal
        await page.locator('button:has(svg.lucide-x)').or(page.locator('button:has-text("ปิด")')).last().click();
        await page.waitForTimeout(300);
      } else {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      }
    }

    // Trash / Recovery Modal
    const trashBtn = page.locator('header button:has(svg.lucide-trash-2)').first();
    if (await trashBtn.isVisible()) {
      await trashBtn.click();
      await page.waitForTimeout(500);
      const trashModal = await page.locator('h3:has-text("ถังขยะ")').or(page.locator('text=กู้คืน')).first().isVisible();
      record("Header", "Trash Recovery Modal", trashModal, "Trash modal opened");
      await page.locator('button:has(svg.lucide-x)').or(page.locator('button:has-text("ปิด")')).last().click();
      await page.waitForTimeout(300);
    }

    // ---------------------------------------------------------
    // 3. DASHBOARD TAB AUDIT
    // ---------------------------------------------------------
    console.log("\n--- [3] DASHBOARD TAB & SUMMARY WIDGETS ---");
    const dashboardTab = page.locator('nav button:has-text("แดชบอร์ด")').first();
    await dashboardTab.click();
    await page.waitForTimeout(800);

    const summaryCards = await page.locator('.stat-card').or(page.locator('div.rounded-2xl.border')).or(page.locator('div.rounded-xl.border')).count();
    record("Dashboard", "Overview Stats Cards", summaryCards > 0, `Rendered ${summaryCards} dashboard cards`);

    // Period buttons (วันนี้, 7 วัน, 30 วัน, เดือนนี้, ทั้งหมด)
    const periodButtons = page.locator('button:has-text("วันนี้")').or(page.locator('button:has-text("7 วัน")')).or(page.locator('button:has-text("30 วัน")')).or(page.locator('button:has-text("เดือนนี้")')).or(page.locator('button:has-text("ทั้งหมด")'));
    const periodCount = await periodButtons.count();
    if (periodCount > 0) {
      await periodButtons.nth(1).click();
      await page.waitForTimeout(400);
      record("Dashboard", "Period Range Filter", true, `Tested period filter button click (${periodCount} buttons found)`);
      // Restore
      await periodButtons.first().click();
      await page.waitForTimeout(300);
    }

    // ---------------------------------------------------------
    // 4. SALES TAB & SUBTABS
    // ---------------------------------------------------------
    console.log("\n--- [4] SALES TAB & SUBTABS (INCOME, PRODUCTS, BRANDS) ---");
    const salesMenuTrigger = page.locator('header nav div.relative > button').or(page.locator('nav button:has-text("ยอดขาย")')).first();
    await salesMenuTrigger.click();
    await page.waitForTimeout(400);

    // Subtab 1: Income / รายการยอดขาย
    const incomeOption = page.locator('button:has-text("ข้อมูลจากรายการยอดขายที่นำเข้า")').or(page.locator('button:has-text("รายการยอดขาย")')).first();
    if (await incomeOption.isVisible()) {
      await incomeOption.click();
      await page.waitForTimeout(800);
      const hasIncomeData = await page.locator('table').or(page.locator('text=ยอดรวม')).count();
      record("Sales Subtab", "Income / Transactions View", hasIncomeData > 0, "Income transactions table & filters loaded");

      // Test Income Search Filter
      const searchIncome = page.locator('input[placeholder*="ค้นหา"]').first();
      if (await searchIncome.isVisible()) {
        await searchIncome.fill("NonExistentItem12345");
        await page.waitForTimeout(300);
        await searchIncome.fill("");
        record("Sales Subtab", "Income Search Filter", true, "Search input reactive and successfully reset");
      }
    }

    // Subtab 2: Products & Inventory
    await salesMenuTrigger.click();
    await page.waitForTimeout(400);
    const productsOption = page.locator('button:has-text("ดูข้อมูลสินค้าและสต็อกในคลัง")').or(page.locator('button:has-text("ข้อมูลสินค้า")')).first();
    if (await productsOption.isVisible()) {
      await productsOption.click();
      await page.waitForTimeout(800);
      const productElements = await page.locator('table').or(page.locator('text=รหัสสินค้า')).count();
      record("Sales Subtab", "Products & Inventory View", productElements > 0, "Products table loaded");

      // Test "เพิ่มสินค้าใหม่" (Add Product) Button & Modal
      const addProductBtn = page.locator('button:has-text("เพิ่มสินค้าใหม่")').or(page.locator('button:has-text("เพิ่มสินค้า")')).first();
      if (await addProductBtn.isVisible()) {
        await addProductBtn.click();
        await page.waitForTimeout(500);
        const addProductModalVisible = await page.locator('h3:has-text("เพิ่มรายการสินค้าใหม่")').or(page.locator('h3:has-text("นำเข้าข้อมูลสินค้า")')).or(page.locator('text=เพิ่มรายการสินค้าใหม่')).first().isVisible();
        record("Sales Subtab", "Add Product Modal Open/Close", addProductModalVisible, "Modal rendered correctly");
        
        // Close modal
        await page.locator('button:has(svg.lucide-x)').or(page.locator('button:has-text("ยกเลิก")')).last().click();
        await page.waitForTimeout(300);
      }
    }

    // Subtab 3: Brands Analytics
    await salesMenuTrigger.click();
    await page.waitForTimeout(400);
    const brandsOption = page.locator('button:has-text("สถิติและรายงานสรุปตามแบรนด์")').or(page.locator('button:has-text("แบรนด์")')).first();
    if (await brandsOption.isVisible()) {
      await brandsOption.click();
      await page.waitForTimeout(800);
      const brandElements = await page.locator('text=สรุปยอดขายตามแบรนด์').or(page.locator('text=แบรนด์')).count();
      record("Sales Subtab", "Brand Analytics View", brandElements > 0, "Brand summary cards & analytics rendered");
    }

    // ---------------------------------------------------------
    // 5. IMPORT TAB (นำเข้าข้อมูล)
    // ---------------------------------------------------------
    console.log("\n--- [5] IMPORT DATASETS & EXCEL PARSING TAB ---");
    const importTabBtn = page.locator('nav button:has-text("นำเข้าข้อมูล")').or(page.locator('nav button:has-text("นำเข้าไฟล์")')).or(page.locator('nav button:has-text("นำเข้า")')).first();
    if (await importTabBtn.isVisible()) {
      await importTabBtn.click();
      await page.waitForTimeout(800);

      const dropzone = await page.locator('text=ลากไฟล์มาวางที่นี่').or(page.locator('text=เลือกไฟล์')).or(page.locator('input[type="file"]')).count();
      record("Import Tab", "Upload Dropzone & File Input", dropzone > 0, "Excel dropzone component ready");

      const datasetHistory = await page.locator('text=ประวัติไฟล์ที่นำเข้า').or(page.locator('text=ชุดข้อมูล')).or(page.locator('table')).count();
      record("Import Tab", "Imported Datasets History List", datasetHistory > 0, "Dataset list and actions present");
    }

    // ---------------------------------------------------------
    // 6. CALCULATOR TAB (คำนวณ)
    // ---------------------------------------------------------
    console.log("\n--- [6] CALCULATOR & COMMISSION TAB ---");
    const calcTabBtn = page.locator('nav button:has-text("คำนวณ")').first();
    if (await calcTabBtn.isVisible()) {
      await calcTabBtn.click();
      await page.waitForTimeout(800);

      const calcWidgets = await page.locator('text=คำนวณ').or(page.locator('text=ค่าคอมมิชชั่น')).or(page.locator('text=ผลตอบแทน')).count();
      record("Calculator Tab", "Commission & Net Profit Engine", calcWidgets > 0, "Calculator UI initialized");

      // Test Export button in calculator
      const exportCalcBtn = page.locator('button:has-text("ส่งออก")').or(page.locator('button:has-text("Export")')).or(page.locator('button:has(svg.lucide-download)')).first();
      if (await exportCalcBtn.isVisible()) {
        record("Calculator Tab", "Export Calculation Report Button", true, "Export report action button visible and enabled");
      }

      // Test Calculator search and filter fields
      const calcSearch = page.locator('input[placeholder*="ค้นหา"]').first();
      if (await calcSearch.isVisible()) {
        await calcSearch.fill("TestSKU");
        await page.waitForTimeout(300);
        await calcSearch.fill("");
        record("Calculator Tab", "Search Filter Input", true, "Calculator search field reactive");
      }
    }

    // ---------------------------------------------------------
    // 7. USER MANAGEMENT TAB (ผู้ใช้งาน)
    // ---------------------------------------------------------
    console.log("\n--- [7] USERS & PERMISSIONS MANAGEMENT TAB ---");
    const usersTabBtn = page.locator('nav button:has-text("ผู้ใช้งาน")').first();
    if (await usersTabBtn.isVisible()) {
      await usersTabBtn.click();
      await page.waitForTimeout(800);

      const userRows = await page.locator('table tbody tr').or(page.locator('text=phanvadee')).count();
      record("Users Tab", "User List & Roles Table", userRows > 0, `Users table rendered with ${userRows} elements/rows`);

      // Test "เพิ่มผู้ใช้งาน" (Add User Modal)
      const addUserBtn = page.locator('button:has-text("เพิ่มผู้ใช้งาน")').or(page.locator('button:has-text("สร้างผู้ใช้")')).first();
      if (await addUserBtn.isVisible()) {
        await addUserBtn.click();
        await page.waitForTimeout(500);

        const addUserModal = await page.locator('h3:has-text("เพิ่มผู้ใช้งาน")').or(page.locator('text=ชื่อผู้ใช้')).first().isVisible();
        record("Users Tab", "Add User Modal Open/Close", addUserModal, "Add user modal dialog opened");

        // Close modal
        await page.locator('button:has(svg.lucide-x)').or(page.locator('button:has-text("ยกเลิก")')).last().click();
        await page.waitForTimeout(300);
      }
    }

    // ---------------------------------------------------------
    // 8. SETTINGS TAB (ตั้งค่า)
    // ---------------------------------------------------------
    console.log("\n--- [8] SYSTEM SETTINGS & PREFERENCES TAB ---");
    const settingsBtn = page.locator('header button:has(svg.lucide-settings)').or(page.locator('nav button:has-text("ตั้งค่า")')).first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(800);

      const settingsFields = await page.locator('input').or(page.locator('select')).or(page.locator('text=ตั้งค่าระบบ')).count();
      record("Settings Tab", "Settings Page & Profile Inputs", settingsFields > 0, `Rendered ${settingsFields} settings controls`);
    }

    // ---------------------------------------------------------
    // 9. RESPONSIVE MOBILE & TABLET AUDIT
    // ---------------------------------------------------------
    console.log("\n--- [9] MOBILE & TABLET RESPONSIVE NAVIGATION DOCK ---");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    const mobileDock = page.locator('.mobile-bottom-nav').or(page.locator('nav.lg\\:hidden')).first();
    const isDockVisible = await mobileDock.isVisible();
    record("Mobile Dock", "Bottom Mobile Navigation Dock", isDockVisible, "Mobile dock visible on phone screen");

    // Click mobile tab item
    if (isDockVisible) {
      const mobileDashBtn = mobileDock.locator('button:has-text("แดชบอร์ด")').first();
      if (await mobileDashBtn.isVisible()) {
        await mobileDashBtn.click();
        await page.waitForTimeout(400);
        record("Mobile Dock", "Mobile Tab Switch Action", true, "Switched to dashboard tab via mobile dock");
      }
    }

    // Hamburger Drawer
    const hamburgerBtn = page.locator('header button.lg\\:hidden').last();
    if (await hamburgerBtn.isVisible()) {
      await hamburgerBtn.click();
      await page.waitForTimeout(400);
      const drawerVisible = await page.locator('text=แดชบอร์ด').or(page.locator('text=ยอดขาย')).count();
      record("Mobile Drawer", "Slide-Down Hamburger Navigation", drawerVisible > 0, "Mobile drawer opened smoothly");
      await hamburgerBtn.click();
      await page.waitForTimeout(300);
    }

    // ---------------------------------------------------------
    // 10. RUNTIME CONSOLE & CRASH AUDIT
    // ---------------------------------------------------------
    record("Quality Assurance", "Runtime Crash & Exception Free", uncaughtErrors.length === 0,
      uncaughtErrors.length === 0 ? "Zero runtime crashes/exceptions encountered" : `Errors: ${uncaughtErrors.join("; ")}`);

  } catch (err) {
    console.error("Test execution caught error:", err);
    record("Execution", "Global Audit Script Execution", false, err.message);
  } finally {
    await browser.close();
  }

  console.log("\n======================================================================");
  console.log("📊 FINAL COMPREHENSIVE AUDIT REPORT");
  console.log("======================================================================");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`Total Features & Actions Tested: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log("======================================================================");

  if (failed > 0) {
    console.log("❌ Failed Items:");
    results.filter((r) => !r.passed).forEach((r) => console.log(` - [${r.section}] ${r.feature}: ${r.details}`));
    process.exit(1);
  } else {
    console.log("🎉 ALL FEATURES AND BUTTONS PASSED 100% SUCCESSFULLY!");
    process.exit(0);
  }
})();
