import XLSX from 'xlsx';

const filePath = 'C:\\E-commerce_Sales\\งาน\\Shopee_Income.โอนเงินสำเร็จ.th.20260501_20260531 (1).xlsx';
try {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['Income'];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const headers = aoa[5] || [];
  console.log("Shopee Income Headers (Total " + headers.length + "):");
  console.dir(headers, { maxArrayLength: null });
  console.log("Shopee Income Row 1:");
  console.dir(aoa[6], { maxArrayLength: null });
} catch (e) {
  console.error(e);
}
