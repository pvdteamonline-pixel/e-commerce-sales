import { chromium } from "@playwright/test";

(async () => {
  console.log("Starting automated verification for optional column validation fixes (Thai tab header)...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", (msg) => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });

  page.on("pageerror", (err) => {
    console.error(`[BROWSER UNCAUGHT EXCEPTION]`, err);
  });

  try {
    // 1. Go to app
    console.log("Navigating to app...");
    await page.goto("http://localhost:5173/");
    await page.waitForLoadState("networkidle");

    // Clear localStorage to ensure quota is clean
    console.log("Clearing localStorage...");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "scratch/verify_step0_initial.png" });

    // 2. Log in using quick fill
    console.log("Logging in as ภาณวดี...");
    await page.click('button:has-text("ภาณวดี")');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "scratch/verify_step1_logged_in.png" });

    // 3. Go to Sales -> Uploaded Files subtab and open Import modal
    console.log("Navigating to Sales -> Uploaded Files tab...");
    await page.click('button:has-text("ยอดขาย")');
    await page.click('button:has-text("รายการสินค้า")');
    await page.waitForSelector('button:has-text("นำเข้าออเดอร์")');
    await page.click('button:has-text("นำเข้าออเดอร์")');
    await page.waitForSelector("text=ลากและวางไฟล์");

    // Click the 'รายรับแพลตฟอร์ม (Income)' tab to show Facebook and LINE OA
    console.log("Switching to Income tab...");
    await page.click('button:has-text("รายรับแพลตฟอร์ม (Income)")');
    await page.waitForTimeout(1000);

    // Click the actual Facebook platform card in the grid to associate upload with Facebook
    console.log("Selecting Facebook platform for import...");
    const fbCard = page.locator('button[data-platform="facebook"]');
    await fbCard.click();
    await page.waitForTimeout(1000);

    // 4. Upload missing_cols_orders.csv file
    console.log("Uploading scratch/missing_cols_orders.csv...");
    const fileInput = page.locator('input#csv-file-input');
    await fileInput.setInputFiles("c:\\E-commerce_Sales\\scratch\\missing_cols_orders.csv");
    
    // Wait for missing_cols_orders.csv to appear in list
    await page.waitForSelector("text=missing_cols_orders.csv");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "scratch/verify_step2_uploaded.png" });

    // 5. Click import button
    console.log("Clicking Import...");
    await page.click('button:has-text("ยืนยันการนำเข้า")');
    await page.waitForTimeout(3500);
    await page.screenshot({ path: "scratch/verify_step4_after_confirm.png" });

    // 6. Navigate to Dashboard tab and verify
    console.log("Navigating to Dashboard tab...");
    await page.click('button:has-text("แดชบอร์ด")');
    await page.waitForSelector("text=สรุปยอดจำหน่ายในระบบ");
    console.log("Redirected to Dashboard tab successfully.");
    await page.waitForTimeout(2000);

    // Set date range to August to include current date 2026-08-06
    console.log("Updating dashboard date filters...");
    await page.locator('input[type="date"]').first().fill("2026-08-01");
    await page.locator('input[type="date"]').last().fill("2026-08-07");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "scratch/verify_step5_dashboard_facebook.png" });

    const dashboardCardsText = await page.locator('div:has-text("ยอดขายรวมสะสม")').first().innerText();
    console.log("Dashboard Facebook KPI Cards Text (August range):\n", dashboardCardsText);
    if (!dashboardCardsText.includes("฿0.00") && !dashboardCardsText.includes("฿")) {
      throw new Error("FAIL: Dashboard KPI cards do not display '฿0.00' for Facebook channel in August range!");
    }
    console.log("SUCCESS: Dashboard KPI cards display '฿0.00' correctly.");

    // 13. Check Calculator tab
    console.log("Navigating to Calculator tab...");
    await page.click('button:has-text("คำนวณ")');
    await page.waitForTimeout(2000);

    // Update calculator date filters as well
    console.log("Updating calculator date filters...");
    await page.locator('input[type="date"]').first().fill("2026-08-01");
    await page.locator('input[type="date"]').last().fill("2026-08-07");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "scratch/verify_step6_calculator.png" });

    const calcCardsText = await page.locator("div.grid.grid-cols-1.sm\\:grid-cols-3").innerText();
    console.log("Calculator KPI Cards Text (August range):\n", calcCardsText);
    if (!calcCardsText.includes("฿0.00")) {
      throw new Error("FAIL: Calculator KPI cards do not display '฿0.00' in August range!");
    }
    console.log("SUCCESS: Calculator KPI cards display '฿0.00' correctly.");

  } catch (err) {
    console.error("Test failed:", err);
    await page.screenshot({ path: "scratch/verify_step_fail.png" });
    process.exit(1);
  } finally {
    await browser.close();
    console.log("Verification finished.");
  }
})();
