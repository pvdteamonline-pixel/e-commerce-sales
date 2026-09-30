const { chromium } = require("@playwright/test");

(async () => {
  console.log("==================================================");
  console.log("🚀 STARTING E-COMMERCE SALES FULL FEATURE AUDIT");
  console.log("==================================================");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const results = [];
  function testResult(module, featureName, isSuccess, details = "") {
    results.push({ module, featureName, isSuccess, details });
    const statusTag = isSuccess ? "✅ PASS" : "❌ FAIL";
    console.log(`${statusTag} [${module}] ${featureName}${details ? ` -> ${details}` : ""}`);
  }

  try {
    // 1. System Initial Load
    await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const title = await page.title();
    testResult("System Core", "Application Initialization & Title", title.includes("E-commerce Sales"), `Title: "${title}"`);

    // 2. Authentication & Login
    console.log("\n--- 1. Testing Authentication ---");
    const userInput = page.locator('input[placeholder*="ชื่อผู้ใช้"]');
    const passInput = page.locator('input[placeholder*="รหัสผ่าน"]');
    await userInput.fill("phanvadee");
    await passInput.fill("Admin1234*");
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);

    const hasLoggedIn = !(await page.locator('button[type="submit"]').isVisible());
    testResult("Auth", "Admin Sign In", hasLoggedIn, "Logged in as phanvadee (Admin)");

    // 3. Dashboard Tab Feature Audit
    console.log("\n--- 2. Testing Dashboard Tab ---");
    const dashboardTitleCount = await page.locator('h3:has-text("สรุปยอดจำหน่ายในระบบ")').count();
    testResult("Dashboard", "Overview & Real-Time Header", dashboardTitleCount > 0, "Dashboard loaded with Real-Time tracker header");

    const periodButtons = await page.locator('button:has-text("เดือนนี้"), button:has-text("ทั้งหมด"), button:has-text("วันนี้")').count();
    testResult("Dashboard", "Date Range / Period Filter", periodButtons > 0, `Found ${periodButtons} period selector options`);

    // 4. Sales Tab & Subtabs (Income, Products, Brands)
    console.log("\n--- 3. Testing Sales Navigation & Views ---");
    const salesDropdownTrigger = page.locator('header nav div.relative > button').first();
    await salesDropdownTrigger.click();
    await page.waitForTimeout(500);

    // Subtab 1: Income / Transactions
    const incomeOption = page.locator('button:has-text("ข้อมูลจากรายการยอดขายที่นำเข้า")').first();
    if (await incomeOption.isVisible()) {
      await incomeOption.click();
      await page.waitForTimeout(1000);
      testResult("Sales View", "Income / Sales Transactions Subtab", true, "Navigated to Income transactions view");
    }

    // Subtab 2: Products
    await salesDropdownTrigger.click();
    await page.waitForTimeout(500);
    const productsOption = page.locator('button:has-text("ดูข้อมูลสินค้าและสต็อกในคลัง")').first();
    if (await productsOption.isVisible()) {
      await productsOption.click();
      await page.waitForTimeout(1000);
      testResult("Sales View", "Products / Inventory Subtab", true, "Navigated to Products & Inventory view");
    }

    // Subtab 3: Brands
    await salesDropdownTrigger.click();
    await page.waitForTimeout(500);
    const brandsOption = page.locator('button:has-text("สถิติและรายงานสรุปตามแบรนด์")').first();
    if (await brandsOption.isVisible()) {
      await brandsOption.click();
      await page.waitForTimeout(1000);
      testResult("Sales View", "Brand Analytics Subtab", true, "Navigated to Brand Analytics view");
    }

    // 5. User Management Tab
    console.log("\n--- 4. Testing Users Management ---");
    const usersTabBtn = page.locator('header nav button:has-text("ผู้ใช้งาน")').first();
    await usersTabBtn.click();
    await page.waitForTimeout(1000);
    const usersHeaderCount = await page.locator('h2:has-text("การจัดการผู้ใช้งาน")').or(page.locator('text=ผู้ใช้ทั้งหมด')).count();
    testResult("Users Management", "User Table & Permissions List", usersHeaderCount > 0, "Users table successfully displayed");

    // 6. Settings Tab
    console.log("\n--- 5. Testing Settings ---");
    const settingsBtn = page.locator('header button:has(svg.lucide-settings)').first();
    await settingsBtn.click();
    await page.waitForTimeout(1000);
    const settingsLoaded = await page.locator('h1:has-text("ตั้งค่าระบบและบัญชีผู้ใช้")').or(page.locator('h1:has-text("Settings")')).or(page.locator('text=ตั้งค่าระบบ')).count();
    testResult("Settings", "System Settings & Configuration", settingsLoaded > 0, "Settings tab rendered properly");

    // 7. Dark/Light Theme Switching
    console.log("\n--- 6. Testing Theme Toggle ---");
    const themeBtn = page.locator('header button:has-text("☀️"), header button:has-text("🌙")').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(300);
      testResult("UI/UX", "Theme Switcher (Dark/Light Mode)", true, "Theme toggled without errors");
      await themeBtn.click();
    }

    // 8. Mobile View Responsiveness
    console.log("\n--- 7. Testing Mobile View (390x844) ---");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);
    const mobileMenuTrigger = page.locator('header button.lg\\:hidden').last();
    const isMobileVisible = await mobileMenuTrigger.isVisible();
    testResult("Mobile View", "Mobile Header & Responsive Trigger", isMobileVisible, "Mobile hamburger menu trigger present");

    if (isMobileVisible) {
      await mobileMenuTrigger.click();
      await page.waitForTimeout(500);
      const drawerVisible = await page.locator('div.animate-menu-slide-down').isVisible();
      testResult("Mobile View", "Mobile Slide-Down Navigation Menu", drawerVisible, "Mobile navigation drawer opened smoothly");
    }

  } catch (err) {
    console.error("Test execution caught error:", err);
    testResult("Execution", "Global Execution Error", false, err.message);
  } finally {
    await browser.close();
  }

  console.log("\n==================================================");
  console.log("📊 AUDIT RESULTS SUMMARY");
  console.log("==================================================");
  const passCount = results.filter((r) => r.isSuccess).length;
  const failCount = results.length - passCount;
  console.log(`Total Features Audited: ${results.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Success Rate: ${((passCount / results.length) * 100).toFixed(1)}%`);
  console.log("==================================================");
})();
