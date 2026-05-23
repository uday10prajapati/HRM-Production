const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const outPath = path.join(__dirname, '..', 'storage', 'uploads', 'payslips', '2026-05', 'payslip_hr_2026_5.pdf');
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const logoPath = path.resolve(__dirname, '..', '..', 'client', 'src', 'assets', 'aplogo.jpeg');

const doc = new PDFDocument({ size: 'A4', margin: 40 });
const stream = fs.createWriteStream(outPath);
const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const month = 5;
const year = 2026;
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthStr = monthNames[month - 1] || month;

const employeeName = 'Vinay Meshan';
const designation = 'Hr';
const joiningDate = '01/06/2025';
const payDate = '15/05/2026';
const basic = 9000;
const others = 2000;
const gross = basic + others;
const deductions = 0;
const netPay = gross - deductions;

function numberToWords(num) {
	if (num === 0) return 'Zero';
	const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
	const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
	const numStr = String(Math.floor(num));
	const n = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
	if (!n) return '';
	let str = '';
	str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
	str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
	str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
	str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
	str += (n[5] != 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
	return str.trim();
}

doc.pipe(stream);
const startX = 40;
const startY = 40;
const width = 595.28 - 80;

doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000').text('S and J Globaltech', startX, startY);
doc.fontSize(10).font('Helvetica').fillColor('#000000').text('Gujarat India', startX, startY + 20);

if (fs.existsSync(logoPath)) {
	doc.image(logoPath, startX + width - 100, startY - 10, { fit: [100, 45], align: 'right' });
}

doc.lineWidth(0.5).strokeColor('#000000');
doc.moveTo(startX, 80).lineTo(startX + width, 80).stroke();

doc.rect(startX, 80, width, 25).fillAndStroke('#f9fafb', '#000000');
doc.fillColor('#000000').fontSize(11).font('Helvetica-Bold');
doc.text(`Payslip for the month of ${monthStr} ${year}`, startX, 88, { width, align: 'center' });

doc.moveTo(startX, 105).lineTo(startX + width, 105).stroke();

doc.fontSize(9).font('Helvetica-Bold').text('EMPLOYEE PAY SUMMARY', startX + 10, 115);
doc.font('Helvetica').fontSize(9);
doc.text('Employee Name', startX + 10, 135); doc.text(`: ${employeeName}`, startX + 100, 135);
doc.text('Designation', startX + 10, 150); doc.text(`: ${designation}`, startX + 100, 150);
doc.text('Date of Joining', startX + 10, 165); doc.text(`: ${joiningDate}`, startX + 100, 165);
doc.text('Pay Period', startX + 10, 180); doc.text(`: ${monthStr} ${year}`, startX + 100, 180);
doc.text('Pay Date', startX + 10, 195); doc.text(`: ${payDate}`, startX + 100, 195);

doc.moveTo(startX + width / 2 + 30, 105).lineTo(startX + width / 2 + 30, 215).strokeColor('#e5e7eb').stroke();

const netX = startX + width / 2 + 30;
const netW = width / 2 - 30;
doc.font('Helvetica-Bold').fillColor('#4b5563').fontSize(10).text('Employee Net Pay', netX, 130, { width: netW, align: 'center' });
doc.fillColor('#000000').fontSize(24).text(`₹${Number(netPay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, netX, 145, { width: netW, align: 'center' });
doc.font('Helvetica').fillColor('#4b5563').fontSize(9).text(`Paid Days : 31 | LOP Days : 0`, netX, 175, { width: netW, align: 'center' });

doc.fillColor('#000000').strokeColor('#000000');
doc.moveTo(startX, 215).lineTo(startX + width, 215).stroke();

const halfW = width / 2;
const eC1 = startX; const eqW1 = halfW * 0.50;
const eC2 = eC1 + eqW1; const eqW2 = halfW * 0.25;
const eC3 = eC2 + eqW2; const eqW3 = halfW * 0.25;

const dC1 = startX + halfW; const dqW1 = halfW * 0.50;
const dC2 = dC1 + dqW1; const dqW2 = halfW * 0.25;
const dC3 = dC2 + dqW2; const dqW3 = halfW * 0.25;

doc.font('Helvetica-Bold').fontSize(8);
let tableY = 225;
doc.text('EARNINGS', eC1 + 5, tableY);
doc.text('AMOUNT', eC2, tableY, { width: eqW2 - 5, align: 'right' });
doc.text('YTD', eC3, tableY, { width: eqW3 - 5, align: 'right' });
doc.text('DEDUCTIONS', dC1 + 5, tableY);
doc.text('AMOUNT', dC2, tableY, { width: dqW2 - 5, align: 'right' });
doc.text('YTD', dC3, tableY, { width: dqW3 - 5, align: 'right' });

doc.moveTo(startX, 240).lineTo(startX + width, 240).stroke();

const earnings = [
	['Basic', basic],
	['Others', others]
];

const maxRows = Math.max(earnings.length, 1);
let rowY = 240;

doc.font('Helvetica').fontSize(8);
for (let i = 0; i < maxRows; i++) {
	const ey = rowY + 6;
	if (i < earnings.length) {
		doc.text(earnings[i][0], eC1 + 5, ey);
		doc.text(`₹${Number(earnings[i][1]).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, eC2, ey, { width: eqW2 - 5, align: 'right' });
		doc.text(`₹${Number(earnings[i][1]).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, eC3, ey, { width: eqW3 - 5, align: 'right' });
	}
	rowY += 20;
	doc.moveTo(startX, rowY).lineTo(startX + width, rowY).strokeColor('#e5e7eb').stroke();
}

doc.strokeColor('#000000');
doc.font('Helvetica-Bold').fontSize(8);
const gy = rowY + 6;
doc.text('Gross Earnings', eC1 + 5, gy);
doc.text(`₹${Number(gross).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, eC1, gy, { width: halfW - 5, align: 'right' });
doc.text('Total Deductions', dC1 + 5, gy);
doc.text(`₹${Number(deductions).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, dC1, gy, { width: halfW - 5, align: 'right' });

rowY += 20;
doc.moveTo(startX, rowY).lineTo(startX + width, rowY).stroke();

let ny = rowY + 6;
doc.text('NET PAY', startX + 5, ny);
doc.text('AMOUNT', startX, ny, { width: width - 5, align: 'right' });
rowY += 20;
doc.moveTo(startX, rowY).lineTo(startX + width, rowY).strokeColor('#e5e7eb').stroke();

ny = rowY + 6;
doc.font('Helvetica').text('Gross Earnings', startX + 5, ny);
doc.text(`₹${Number(gross).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, startX, ny, { width: width - 5, align: 'right' });
rowY += 20;
doc.moveTo(startX, rowY).lineTo(startX + width, rowY).stroke();

ny = rowY + 6;
doc.text('Total Deductions', startX + 5, ny);
doc.text(`(-) ₹${Number(deductions).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, startX, ny, { width: width - 5, align: 'right' });
rowY += 20;
doc.moveTo(startX, rowY).lineTo(startX + width, rowY).strokeColor('#000000').stroke();

ny = rowY + 6;
doc.font('Helvetica-Bold');
doc.text('Total Net Payable', startX + width / 2, ny, { width: halfW - 100, align: 'right' });
doc.text(`₹${Number(netPay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, startX, ny, { width: width - 5, align: 'right' });
rowY += 20;
doc.moveTo(startX, rowY).lineTo(startX + width, rowY).stroke();

doc.font('Helvetica').fontSize(9);
doc.text(`Total Net Payable ₹${Number(netPay).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Indian Rupee ${numberToWords(netPay)} Only)`, startX, rowY + 10, { width, align: 'center' });
doc.fillColor('#6b7280').fontSize(7).text('**Total Net Payable = Gross Earnings - Total Deductions', startX, rowY + 25, { width, align: 'center' });

rowY += 40;
doc.moveTo(startX, rowY).lineTo(startX + width, rowY).strokeColor('#000000').stroke();

doc.moveTo(startX, 80).lineTo(startX, rowY).stroke();
doc.moveTo(startX + width, 80).lineTo(startX + width, rowY).stroke();
doc.moveTo(eC2, 215).lineTo(eC2, rowY - 100).strokeColor('#e5e7eb').stroke();
doc.moveTo(eC3, 215).lineTo(eC3, rowY - 100).strokeColor('#e5e7eb').stroke();
doc.moveTo(dC1, 215).lineTo(dC1, rowY - 100).strokeColor('#000000').stroke();
doc.moveTo(dC2, 215).lineTo(dC2, rowY - 100).strokeColor('#e5e7eb').stroke();
doc.moveTo(dC3, 215).lineTo(dC3, rowY - 100).strokeColor('#e5e7eb').stroke();

doc.fillColor('#9ca3af').fontSize(8).text('— This document has been automatically generated by S and J Globaltech Payroll; therefore, a signature is not required. —', startX, rowY + 15, { width, align: 'center' });
doc.end();
stream.on('finish', () => console.log(outPath));
stream.on('error', (err) => { console.error(err); process.exit(1); });