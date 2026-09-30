import fs from 'fs';

try {
  const db = JSON.parse(fs.readFileSync('c:\\E-commerce_Sales\\db.json', 'utf8'));
  console.log(`Total orders in db: ${db.orders.length}`);
  const datasets = {};
  db.orders.forEach(o => {
    datasets[o.datasetId] = datasets[o.datasetId] || { count: 0, isIncome: {}, platformFeeCount: 0, platformFeeSum: 0 };
    datasets[o.datasetId].count++;
    datasets[o.datasetId].isIncome[o.isIncome] = (datasets[o.datasetId].isIncome[o.isIncome] || 0) + 1;
    if (o.platformFee > 0) {
      datasets[o.datasetId].platformFeeCount++;
      datasets[o.datasetId].platformFeeSum += o.platformFee;
    }
  });
  console.dir(datasets, { depth: null });
} catch (e) {
  console.error(e);
}
