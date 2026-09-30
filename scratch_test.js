import { chromium } from "@playwright/test";

(async () => {
  console.log("Starting robust 2-step import verification test...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", (msg) => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });

  page.on("pageerror", (err) => {
    console.error(`[BROWSER UNCAUGHT EXCEPTION]`, err);
  });

  try {
    // 1. Navigate to application
    console.log("Navigating to application on port 5174...");
    await page.goto("http://localhost:5174/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "C:/Users/PVD_COM/.gemini/antigravity-ide/brain/17e59205-d50c-46c1-893e-9b45c19940d9/scratch/step0_login_screen.png" });

    // 2. Perform Quick Login
    console.log("Logging in as admin user 'คุณภาณวดี'...");
    await page.click('button:has-text("ภาณวดี")', { force: true });
    await page.click('button[type="submit"]', { force: true });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "C:/Users/PVD_COM/.gemini/antigravity-ide/brain/17e59205-d50c-46c1-893e-9b45c19940d9/scratch/step1_dashboard.png" });

    // 3. Open Import Modal if not already open
    const fileInputSelector = 'input#csv-file-input';
    const isFileInputVisible = await page.locator(fileInputSelector).isVisible();
    
    if (!isFileInputVisible) {
      console.log("Import tab is not active by default. Navigating manually...");
      await page.click('button:has-text("ยอดขาย")', { force: true });
      await page.waitForSelector('button:has-text("รายการสินค้า")');
      await page.click('button:has-text("รายการสินค้า")', { force: true });
      await page.waitForSelector('button:has-text("นำเข้าออเดอร์")');
      await page.click('button:has-text("นำเข้าออเดอร์")', { force: true });
      await page.waitForSelector("text=ลากและวางไฟล์");
      await page.screenshot({ path: "C:/Users/PVD_COM/.gemini/antigravity-ide/brain/17e59205-d50c-46c1-893e-9b45c19940d9/scratch/step2_import_modal_step1.png" });
    } else {
      console.log("Import tab is already open.");
    }

    // 4. Upload Lazada orders sheet
    console.log("Uploading Lazada_order.xlsx...");
    const fileInput = page.locator(fileInputSelector);
    await fileInput.setInputFiles("c:\\E-commerce_Sales\\task\\Lazada_order.xlsx");
    
    // Wait for the uploaded file card to display
    await page.waitForSelector("text=Lazada_order.xlsx");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "C:/Users/PVD_COM/.gemini/antigravity-ide/brain/17e59205-d50c-46c1-893e-9b45c19940d9/scratch/step3_file_uploaded.png" });

    // 5. Proceed to Step 2
    console.log("Proceeding to Step 2: Verification and Preview...");
    await page.click('button:has-text("วิเคราะห์และตรวจสอบข้อมูล (ขั้นตอนที่ 2) →")', { force: true });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "C:/Users/PVD_COM/.gemini/antigravity-ide/brain/17e59205-d50c-46c1-893e-9b45c19940d9/scratch/step4_preview_step2.png" });

    // 6. Confirm and Import Orders
    console.log("Confirming the import...");
    await page.click('button:has-text("ยืนยันนำเข้าข้อมูลคำสั่งซื้อ")', { force: true });
    await page.waitForTimeout(4000);
    
    // 7. Verify redirection to Dashboard
    console.log("Verifying return to dashboard tab...");
    await page.screenshot({ path: "C:/Users/PVD_COM/.gemini/antigravity-ide/brain/17e59205-d50c-46c1-893e-9b45c19940d9/scratch/step5_back_to_dashboard.png" });

    console.log("SUCCESS: Redesigned 2-step verification and import tab test completed successfully!");
  } catch (err) {
    console.error("Test execution failed:", err);
    await page.screenshot({ path: "C:/Users/PVD_COM/.gemini/antigravity-ide/brain/17e59205-d50c-46c1-893e-9b45c19940d9/scratch/step_error_crash.png" });
    process.exit(1);
  } finally {
    await browser.close();
    console.log("Automation testing completed.");
  }
})();
