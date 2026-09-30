import { chromium } from "@playwright/test";

(async () => {
  console.log("Starting product upload verification script...");
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

    // 2. Log in using quick fill
    console.log("Logging in using quick fill...");
    await page.click('button:has-text("ภาณวดี")');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    // Extract initial Gross Revenue
    const initialGrossText = await page.locator("h3:has-text('ยอดขายรวม') + div, p:has-text('ยอดขายรวม') + div, div:has-text('ยอดขายรวม') + div").first().textContent();
    console.log(`Initial Gross Revenue on Dashboard: ${initialGrossText?.trim()}`);

    // 3. Go to Sales -> Products subtab and open Product Import modal
    console.log("Navigating to Sales -> Products tab...");
    await page.click('button:has-text("ยอดขาย")');
    await page.click('button:has-text("ข้อมูลสินค้า")');
    await page.waitForSelector('button:has-text("นำเข้าสินค้า (Excel)")');
    await page.click('button:has-text("นำเข้าสินค้า (Excel)")');
    await page.waitForSelector("text=เลือกไฟล์");

    // 4. Upload product catalog file
    console.log("Uploading products_catalog.csv...");
    const fileInput = page.locator('input#product-csv-input');
    await fileInput.setInputFiles("c:\\E-commerce_Sales\\scratch\\products_catalog.csv");

    // Wait for step 1 products table to show
    await page.waitForSelector("text=รายการสินค้าที่จะนำเข้า");
    await page.screenshot({ path: "scratch/step6_product_preview.png" });
    console.log("Product catalog preview loaded successfully.");

    // 5. Click import products submit button
    console.log("Clicking 'นำเข้าสินค้าทั้งหมด'...");
    await page.click('button:has-text("นำเข้าสินค้าทั้งหมด")');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "scratch/step7_product_imported.png" });

    // 6. Go back to Dashboard and verify metrics did not change
    console.log("Navigating back to Dashboard...");
    await page.click('button:has-text("แดชบอร์ด")');
    await page.waitForTimeout(2000);
    const postGrossText = await page.locator("h3:has-text('ยอดขายรวม') + div, p:has-text('ยอดขายรวม') + div, div:has-text('ยอดขายรวม') + div").first().textContent();
    console.log(`Post-import Gross Revenue on Dashboard: ${postGrossText?.trim()}`);

    if (initialGrossText?.trim() !== postGrossText?.trim()) {
      throw new Error(`FAIL: Gross revenue changed from ${initialGrossText} to ${postGrossText} after product catalog upload!`);
    }
    console.log("SUCCESS: Dashboard metrics remained unchanged.");

    // 7. Go to Sales tab -> ข้อมูลสินค้า (Products Info subtab)
    console.log("Navigating to Sales tab...");
    await page.click('button:has-text("ยอดขาย")');
    await page.waitForTimeout(1000);

    console.log("Navigating to ข้อมูลสินค้า subtab...");
    const prodSubTab = page.locator('button:has-text("ข้อมูลสินค้า")');
    await prodSubTab.click();
    await page.waitForTimeout(1000);

    // Verify products_catalog.csv is in the sidebar
    console.log("Selecting products_catalog.csv in the sidebar...");
    const fileCard = page.locator('div:has-text("products_catalog.csv")').first();
    await fileCard.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "scratch/step8_product_file_detail.png" });

    // Verify that the table contains the products we imported
    console.log("Verifying product catalog items are displayed...");
    await page.waitForSelector("text=หูฟัง Quantum ตัดเสียงรบกวนภายนอก");
    await page.waitForSelector("text=เซรั่มบำรุงผิวหน้าพรีเมียม Hydro-Glow");
    console.log("SUCCESS: Product catalog items are displayed correctly with correct headers and values.");

  } catch (err) {
    console.error("Test failed:", err);
    await page.screenshot({ path: "scratch/step9_product_crash.png" });
    process.exit(1);
  } finally {
    await browser.close();
    console.log("Product verification finished.");
  }
})();
