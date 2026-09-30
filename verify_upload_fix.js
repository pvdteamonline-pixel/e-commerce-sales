import { chromium } from "@playwright/test";

(async () => {
  console.log("Starting upload fix verification script with screenshots and error logging...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Log console logs
  page.on("console", (msg) => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });

  // Log page errors
  page.on("pageerror", (err) => {
    console.error(`[BROWSER UNCAUGHT EXCEPTION]`, err);
  });

  try {
    // 1. Go to app
    console.log("Navigating to app...");
    await page.goto("http://localhost:5173/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "scratch/step0_initial.png" });

    // 2. Log in using quick fill
    console.log("Logging in using quick fill...");
    await page.click('button:has-text("ภาณวดี")');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: "scratch/step2_after_submit.png" });

    // Wait for header menu to load
    await page.waitForSelector('button:has-text("ยอดขาย")');

    // 3. Go to Sales -> Uploaded Files subtab and open Import modal
    console.log("Navigating to Sales -> Uploaded Files tab...");
    await page.click('button:has-text("ยอดขาย")');
    await page.click('button:has-text("รายการสินค้า")');
    await page.waitForSelector('button:has-text("นำเข้าออเดอร์")');
    await page.click('button:has-text("นำเข้าออเดอร์")');
    await page.waitForSelector("text=ลากและวางไฟล์");

    // 4. Upload valid Lazada_order.xlsx file
    console.log("Uploading valid Lazada_order.xlsx...");
    const fileInput = page.locator('input#csv-file-input');
    await fileInput.setInputFiles("c:\\E-commerce_Sales\\task\\Lazada_order.xlsx");
    
    // Wait for Lazada_order.xlsx to appear in list
    await page.waitForSelector("text=Lazada_order.xlsx");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "scratch/step3_uploaded.png" });
    console.log("Lazada_order.xlsx uploaded successfully. Screenshot step3_uploaded.png captured.");

    // 5. Navigate to Step 2 and click import button
    console.log("Clicking Next to preview...");
    await page.click('button:has-text("ถัดไป: ตรวจสอบและพรีวิวข้อมูล")');
    await page.waitForTimeout(2000);
    console.log("Clicking Confirm Import...");
    await page.click('button:has-text("ยืนยันการนำเข้าข้อมูล")');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "scratch/step4_after_import.png" });

    // 7. Navigate to Dashboard tab and verify
    console.log("Navigating to Dashboard tab...");
    await page.click('button:has-text("แดชบอร์ด")');
    await page.waitForSelector("text=สรุปยอดจำหน่ายในระบบ");
    console.log("Redirected to Dashboard tab successfully.");

    // Check if body has the error class or white screen
    const isErrorVisible = await page.locator("text=เกิดข้อผิดพลาดในการโหลดส่วนนี้").isVisible();
    if (isErrorVisible) {
      throw new Error("FAIL: Error boundary triggered during valid upload!");
    }
    console.log("SUCCESS: Valid upload worked, confetti finished, and page did not crash.");

    // 8. Navigate back to Sales and open Import modal
    console.log("Navigating back to Import tab...");
    await page.click('button:has-text("ยอดขาย")');
    await page.click('button:has-text("รายการสินค้า")');
    await page.waitForSelector('button:has-text("นำเข้าออเดอร์")');
    await page.click('button:has-text("นำเข้าออเดอร์")');
    await page.waitForSelector("text=ลากและวางไฟล์");

    // Click Reset to clear previous files
    const resetBtn = page.locator('button:has-text("ล้างทั้งหมด")');
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      console.log("Cleared queue.");
    }

    // 9. Select Lazada platform to restrict import type
    console.log("Restricting upload platform to Lazada...");
    await page.locator('.mobile-bottom-sheet-content span:has-text("Lazada")').first().click();
    await page.waitForTimeout(1000);

    // 10. Upload Shopee file to cause validation error
    console.log("Uploading Shopee file to trigger platform mismatch error...");
    await fileInput.setInputFiles("c:\\E-commerce_Sales\\task\\Shopee_Order.all.20260501_20260531.xlsx");

    // 11. Verify validation error toast is shown and page does not crash
    console.log("Checking for error toast...");
    await page.waitForSelector("text=ไม่ตรงกับแพลตฟอร์ม");
    const toastText = await page.locator("text=ไม่ตรงกับแพลตฟอร์ม").first().textContent();
    console.log(`Validation toast message shown: "${toastText}"`);

    // Verify it didn't turn white/crash
    const chooseFileBtnVisible = await page.locator('button:has-text("เลือกไฟล์ในเครื่อง")').isVisible();
    if (chooseFileBtnVisible) {
      console.log("SUCCESS: Mismatched file showed platform validation error toast, and import tab did not crash or turn white.");
    } else {
      throw new Error("FAIL: Import tab crashed or unmounted after mismatched file upload!");
    }

  } catch (err) {
    console.error("Test failed:", err);
    await page.screenshot({ path: "scratch/step5_crash.png" });
    console.log("Screenshot step5_crash.png captured.");
    process.exit(1);
  } finally {
    await browser.close();
    console.log("Verification finished.");
  }
})();
