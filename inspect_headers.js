import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const dirPath = 'C:\\E-commerce_Sales\\งาน';
const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));

files.forEach(file => {
  const filePath = path.join(dirPath, file);
  try {
    const workbook = XLSX.readFile(filePath);
    console.log(`=========================================`);
    console.log(`FILE: ${file}`);
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (aoa.length === 0) {
        console.log(`  Sheet: ${sheetName} - EMPTY`);
        return;
      }
      
      // Let's find the header row
      // We will look at first 10 rows and find the one with the most columns
      let bestIdx = 0;
      let bestCount = 0;
      for (let i = 0; i < Math.min(15, aoa.length); i++) {
        const count = aoa[i].filter(x => x !== null && x !== undefined && String(x).trim() !== "").length;
        if (count > bestCount) {
          bestCount = count;
          bestIdx = i;
        }
      }
      
      const headers = aoa[bestIdx] || [];
      console.log(`  Sheet: ${sheetName} (Header Row Index: ${bestIdx})`);
      console.log(`  Headers count: ${headers.length}`);
      console.log(`  Headers preview:`, headers.slice(0, 15).map(h => String(h).trim()));
      if (aoa.length > bestIdx + 1) {
        console.log(`  Row 1 preview:`, aoa[bestIdx + 1].slice(0, 15));
      }
    });
  } catch (e) {
    console.error(`Error reading ${file}:`, e);
  }
});
