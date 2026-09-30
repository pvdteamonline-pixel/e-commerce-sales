const { chromium, devices } = require("@playwright/test");

(async () => {
  console.log("Starting mobile verification test (CommonJS)...");
  const browser = await chromium.launch({ headless: true });
  // Emulate iPhone 12
  const context = await browser.newContext({
    ...devices["iPhone 12"],
  });
  const page = await context.newPage();

  // Log console messages
  page.on("console", (msg) => console.log(`BROWSER CONSOLE: ${msg.text()}`));

  // Helper: Open mobile menu drawer and click tab
  const navigateToMobileTab = async (tabLabel) => {
    const isMenuOpen = await page.locator('div.animate-menu-slide-down').isVisible();
    if (!isMenuOpen) {
      await page.click('button.lg\\:hidden:has(svg.lucide-menu)');
      await page.waitForSelector('div.animate-menu-slide-down');
    }
    if (tabLabel === "ยอดขาย") {
      const salesButton = page.locator('div.animate-menu-slide-down button:has-text("ยอดขาย"), div.animate-menu-slide-down button:has-text("รายการสินค้า"), div.animate-menu-slide-down button:has-text("สินค้า"), div.animate-menu-slide-down button:has-text("แบรนด์")').first();
      await salesButton.click();
    } else {
      await page.click(`div.animate-menu-slide-down button:has-text("${tabLabel}")`);
    }
  };

  // Helper: Open mobile menu drawer and click logout
  const logoutMobile = async () => {
    const isMenuOpen = await page.locator('div.animate-menu-slide-down').isVisible();
    if (!isMenuOpen) {
      await page.click('button.lg\\:hidden:has(svg.lucide-menu)');
      await page.waitForSelector('div.animate-menu-slide-down');
    }
    await page.click('div.animate-menu-slide-down button:has-text("ออกจากระบบ")');
    await page.waitForSelector('input[placeholder*="ชื่อผู้ใช้"]');
  };

  // Helper: Close mobile menu
  const closeMobileMenu = async () => {
    const isMenuOpen = await page.locator('div.animate-menu-slide-down').isVisible();
    if (isMenuOpen) {
      await page.click('button.lg\\:hidden:has(svg.lucide-x)');
      await page.waitForSelector('div.animate-menu-slide-down', { state: 'detached' });
    }
  };

  try {
    // 1. Go to local dev site
    console.log("Navigating to local site on mobile...");
    await page.goto("http://localhost:5173/");
    await page.waitForLoadState("domcontentloaded");

    // 2. Fill login details
    console.log("Logging in as phanvadee...");
    await page.fill('input[placeholder*="ชื่อผู้ใช้"]', "phanvadee");
    await page.fill('input[placeholder*="รหัสผ่าน"]', "admin1234");
    await page.click('button[type="submit"]');

    // Wait for Dashboard to load
    await page.locator('button.lg\\:hidden:has(svg.lucide-menu)').waitFor({ state: "visible" });
    console.log("Logged in successfully. Dashboard loaded.");

    // 3. Test Navbar Search Redirection
    console.log("Testing search redirection from Dashboard...");
    // Expand search input on mobile first
    await page.click('button[title="ค้นหา"]');
    const searchInput = page.locator('input[placeholder="ค้นหา..."]').last();
    await searchInput.waitFor({ state: "visible" });
    await searchInput.fill("หูฟัง");
    // Verify it redirects to Sales tab with 'transactions' subtab active
    await page.waitForTimeout(1000);
    const currentTab = await page.evaluate(() => {
      return document.body.innerHTML.includes("ข้อมูลยอดขายคลังระบบ") ? "sales-transactions" : "unknown";
    });
    console.log(`Search redirection result: ${currentTab}`);

    // 4. Navigate to Sales -> Uploaded Files subtab on mobile
    console.log("Navigating to Sales -> Uploaded Files subtab...");
    await navigateToMobileTab("ยอดขาย");
    await page.locator('div.animate-menu-slide-down button:has-text("รายการสินค้า")').nth(1).click();
    await page.waitForSelector('button:has-text("นำเข้าออเดอร์")');
    await page.click('button:has-text("นำเข้าออเดอร์")');
    await page.waitForSelector("text=ลากและวางไฟล์");

    // 5. Try uploading Lazada_order.xlsx
    console.log("Uploading Lazada_order.xlsx...");
    const fileInput = page.locator('input#csv-file-input');
    await fileInput.setInputFiles("c:\\E-commerce_Sales\\งาน\\Lazada_order.xlsx");
    await page.waitForTimeout(2000);

    // Verify it is added
    console.log("Verifying file is added to list...");
    await page.waitForSelector("text=Lazada_order.xlsx");
    console.log("File Lazada_order.xlsx added to the queue successfully.");

    // 6. Test duplicate file upload prevention
    console.log("Testing duplicate file upload prevention...");
    await fileInput.setInputFiles("c:\\E-commerce_Sales\\งาน\\Lazada_order.xlsx");
    await page.waitForTimeout(2000);
    // Since browser alerts are handled, let's verify warning toast or message
    const duplicateAlertExists = await page.locator('text=ถูกเลือกอัปโหลดไว้แล้ว').isVisible();
    console.log(`Duplicate upload alert shown: ${duplicateAlertExists}`);

    // 7. Navigate to Step 2 and click Import
    console.log("Clicking Next to preview...");
    await page.locator('button:has-text("ถัดไป: ตรวจสอบและพรีวิวข้อมูล")').evaluate(node => node.click());
    await page.waitForTimeout(2000);
    console.log("Confirming Lazada_order import...");
    await page.locator('button:has-text("ยืนยันการนำเข้าข้อมูล")').evaluate(node => node.click());
    await page.waitForTimeout(2000);

    // Verify it successfully imported and redirected to sales
    await page.waitForSelector("text=นำเข้าออเดอร์");
    console.log("Imported Lazada orders and redirected to Sales tab successfully.");

    // 8. Go to Sales -> Brands tab and check channel filter
    console.log("Navigating to Sales -> Brands tab on mobile to reveal filters...");
    await navigateToMobileTab("ยอดขาย");
    await page.locator('div.animate-menu-slide-down button:has-text("ข้อมูลแบรนด์")').click();
    await page.waitForTimeout(2000);
    console.log("Checking channel filter options on Sales tab...");
    await page.waitForSelector('label:has-text("ช่องทาง")');
    
    const channelOptions = await page.locator('select:near(label:has-text("ช่องทาง")) option').allTextContents();
    console.log("Available channels in filter:", channelOptions);

    if (channelOptions.includes("TikTok Shop") && !channelOptions.includes("TikTok")) {
      console.log("SUCCESS: TikTok and TikTok Shop channels are unified as TikTok Shop.");
    } else {
      console.warn("WARNING: Unified channel check did not match expected structure.", channelOptions);
    }

    // 9. Test real-time permission sync
    console.log("Testing real-time permission synchronization and user task toggle...");
    // Clear search by typing empty string to return to main view
    await page.locator('input[placeholder="ค้นหา..."]').last().fill("");
    await page.waitForTimeout(1000);

    await navigateToMobileTab("ผู้ใช้งาน");
    await page.locator('text=สมชาย นักพัฒนา').filter({ visible: true }).first().waitFor({ state: "visible" });

    // Find the user row/card and click settings button via evaluate
    const userRow = page.locator('tr, .glass-card').filter({ hasText: "สมชาย นักพัฒนา" }).first();
    await userRow.locator('button[title="ตั้งค่าเปิด/ปิดฟีเจอร์การทำงาน"]').evaluate(node => node.click());
    await page.waitForSelector('text=ตั้งค่าสิทธิ์การใช้งาน');
    await page.waitForTimeout(1000);

    // Toggle off "เครื่องคำนวณ"
    console.log("Disabling 'เครื่องคำนวณ' permission for somchai...");
    await page.locator('.mobile-bottom-sheet-content .rounded-2xl').filter({ hasText: 'เครื่องคำนวณ' }).locator('button').evaluate(node => node.click());
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("บันทึกการทำงาน")').evaluate(node => node.click());
    await page.waitForTimeout(1000);

    // Log out Admin
    console.log("Logging out Admin...");
    await logoutMobile();

    // Log in as somchai
    console.log("Logging in as somchai (Manager)...");
    await page.fill('input[placeholder="username หรือ email"]', "somchai");
    await page.fill('input[placeholder="••••••••"]', "manager1234");
    await page.click('button[type="submit"]');
    await page.locator('button.lg\\:hidden:has(svg.lucide-menu)').waitFor({ state: "visible" });

    // Verify "คำนวณ" tab is not visible in mobile menu
    console.log("Checking if 'คำนวณ' tab is visible for somchai...");
    const isMenuOpen = await page.locator('button.lg\\:hidden:has(svg.lucide-x)').isVisible();
    if (!isMenuOpen) {
      await page.click('button.lg\\:hidden:has(svg.lucide-menu)');
      await page.waitForSelector('div.animate-menu-slide-down');
    }
    const calcVisibleBefore = await page.locator('div.animate-menu-slide-down button:has-text("คำนวณ")').isVisible();
    console.log(`Is 'คำนวณ' tab visible for somchai after being disabled?: ${calcVisibleBefore}`);
    if (calcVisibleBefore) {
      throw new Error("Verification failed: 'คำนวณ' tab is still visible in mobile menu after being disabled!");
    }
    await closeMobileMenu();

    // Log out somchai
    console.log("Logging out somchai...");
    await logoutMobile();

    // Log back in as Admin to restore permission
    console.log("Logging back in as Admin to restore permission...");
    await page.fill('input[placeholder="username หรือ email"]', "phanvadee");
    await page.fill('input[placeholder="••••••••"]', "admin1234");
    await page.click('button[type="submit"]');
    await page.locator('button.lg\\:hidden:has(svg.lucide-menu)').waitFor({ state: "visible" });

    // Restore "เครื่องคำนวณ" permission
    await page.waitForTimeout(1000);
    await navigateToMobileTab("ผู้ใช้งาน");
    await page.locator('text=สมชาย นักพัฒนา').filter({ visible: true }).first().waitFor({ state: "visible" });
    const userRow2 = page.locator('tr, .glass-card').filter({ hasText: "สมชาย นักพัฒนา" }).first();
    await userRow2.locator('button[title="ตั้งค่าเปิด/ปิดฟีเจอร์การทำงาน"]').evaluate(node => node.click());
    await page.waitForSelector('text=ตั้งค่าสิทธิ์การใช้งาน');
    await page.waitForTimeout(1000);

    console.log("Enabling 'เครื่องคำนวณ' permission for somchai...");
    await page.locator('.mobile-bottom-sheet-content .rounded-2xl').filter({ hasText: 'เครื่องคำนวณ' }).locator('button').evaluate(node => node.click());
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("บันทึกการทำงาน")').evaluate(node => node.click());
    await page.waitForTimeout(1000);

    // Log out Admin
    console.log("Logging out Admin...");
    await logoutMobile();

    // Log in as somchai again
    console.log("Logging in as somchai (Manager) again...");
    await page.fill('input[placeholder="username หรือ email"]', "somchai");
    await page.fill('input[placeholder="••••••••"]', "manager1234");
    await page.click('button[type="submit"]');
    await page.locator('button.lg\\:hidden:has(svg.lucide-menu)').waitFor({ state: "visible" });

    // Verify "คำนวณ" tab IS visible in mobile menu
    console.log("Opening mobile menu to check permission...");
    const isMenuOpen2 = await page.locator('button.lg\\:hidden:has(svg.lucide-x)').isVisible();
    if (!isMenuOpen2) {
      await page.click('button.lg\\:hidden:has(svg.lucide-menu)');
      await page.waitForSelector('div.animate-menu-slide-down');
    }
    const calcVisibleAfter = await page.locator('div.animate-menu-slide-down button:has-text("คำนวณ")').isVisible();
    console.log(`Is 'คำนวณ' tab visible for somchai after being re-enabled?: ${calcVisibleAfter}`);
    if (!calcVisibleAfter) {
      throw new Error("Verification failed: 'คำนวณ' tab is not visible in mobile menu after being re-enabled!");
    }
    await closeMobileMenu();

    // Log out somchai and log back in as Admin to finish test in clean state
    console.log("Restoring browser state to Admin...");
    await logoutMobile();

    await page.fill('input[placeholder="username หรือ email"]', "phanvadee");
    await page.fill('input[placeholder="••••••••"]', "admin1234");
    await page.click('button[type="submit"]');
    await page.locator('button.lg\\:hidden:has(svg.lucide-menu)').waitFor({ state: "visible" });

    console.log("SUCCESS: Real-time permission sync verified successfully.");

  } catch (error) {
    console.error("Verification test failed with error:", error);
    console.log("Current URL:", page.url());
    // Capture screenshot on error
    await page.screenshot({ path: "c:\\E-commerce_Sales\\scratch\\error_screenshot_mobile.png" });
    console.log("Error screenshot saved to scratch/error_screenshot_mobile.png");
  } finally {
    await browser.close();
    console.log("Verification test completed.");
  }
})();
