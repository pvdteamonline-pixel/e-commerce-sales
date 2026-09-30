import XLSX from 'xlsx';

const filePath = 'C:\\E-commerce_Sales\\งาน\\Lazada_income.xlsx';
try {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  const txNames = new Set();
  data.forEach(row => {
    if (row['ชื่อรายการธุรกรรม']) {
      txNames.add(row['ชื่อรายการธุรกรรม']);
    }
  });
  console.log("Unique transaction names in Lazada Income:");
  console.dir(Array.from(txNames));
} catch (e) {
  console.error(e);
}
