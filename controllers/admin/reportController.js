// controllers/admin/reportController.js
const Order = require("../../models/orderSchema");
const moment = require('moment');
const exceljs = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const salesReportPage = async (req, res,next) => {
  try {
    res.render('admin/sales-report', { title: 'Sales Report' });
  } catch (error) {
    next(error)
  }
};

const getSalesData = async (req, res,next) => {
  try {
    const { period, specificDate, startDate, endDate } = req.body;
   console.log(req.body)
    // Input validation
    if (!period || !['daily', 'weekly', 'monthly', 'yearly', 'custom'].includes(period)) {
      return res.status(400).json({ success: false, message: 'Invalid or missing period' });
    }
    if (period !== 'custom' && !specificDate) {
      return res.status(400).json({ success: false, message: 'Specific date is required for non-custom periods' });
    }
    if (period === 'custom' && (!startDate || !endDate)) {
      return res.status(400).json({ success: false, message: 'Start and end dates are required for custom period' });
    }
    if (period === 'custom' && new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ success: false, message: 'End date cannot be before start date' });
    }

    // Determine date range
    let dateFilter = {};
    let groupBy = null;

    if (period === 'custom') {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      };
      groupBy = '$dayOfMonth';
    } else {
      const date = new Date(specificDate);
let start, end;

switch (period) {
  case 'daily':
    start = new Date(date);
    start.setHours(0, 0, 0, 0);

    end = new Date(date);
    end.setHours(23, 59, 59, 999);
    break;

  case 'weekly':
    start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);

    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    break;

  case 'monthly':
    start = new Date(date.getFullYear(), date.getMonth(), 1);
    end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    break;

  case 'yearly':
    start = new Date(date.getFullYear(), 0, 1);
    end = new Date(date.getFullYear(), 11, 31);
    end.setHours(23, 59, 59, 999);
    break;

  default:
    throw new Error('Invalid period');
}


      dateFilter = {
        createdAt: {
          $gte: start,
          $lte: end,
        },
      };

      if (period === 'weekly' || period === 'monthly') {
        groupBy = '$dayOfMonth';
      } else if (period === 'yearly') {
        groupBy = '$month';
      }
    }

    // Fetch orders
    const orders = await Order.find(dateFilter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    // Calculate summary
    const summary = {
      totalSales: 0,
      totalOrders: orders.length,
      totalDiscounts: 0,
      totalNetAmount: 0,
    };

    orders.forEach((order) => {
      summary.totalSales += order.finalAmount || 0;
      summary.totalDiscounts += order.discount || 0;
      summary.totalNetAmount += order.finalAmount || 0;
    });

    // Prepare daily data for charts
    let dailyData = [];
    if (groupBy) {
      const dailyAggregation = await Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            totalAmount: { $sum: '$finalAmount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      dailyData = dailyAggregation.map((item) => ({
        date: item._id,
        amount: item.totalAmount,
        count: item.count,
      }));
    }

    // Prepare response data
    const responseData = {
      success: true,
      summary: {
        totalSales: summary.totalNetAmount,
        totalOrders: summary.totalOrders,
        totalDiscounts: summary.totalDiscounts,
        avgOrderValue: summary.totalOrders > 0 ? summary.totalNetAmount / summary.totalOrders : 0,
      },
      dailyData,
      data: orders.map((order) => ({
        date: order.createdAt,
        orderId: order.orderId,
        customer: order.userId ? order.userId.name : 'Guest',
        amount: order.totalPrice || 0,
        discount: order.discount || 0,
        couponUsed: order.couponCode || 'None',
        netAmount: order.finalAmount || 0,
        status: order.status,
      })),
    };

    res.json(responseData);
  } catch (error) {
    next(error)
  }
};

const downloadReport = async (req, res,next) => {
  try {
    const { format, includeDetails, includeSummary, includeCharts, period, specificDate, startDate, endDate } = req.query;

    // Input validation
    if (!format || !['pdf', 'excel', 'csv'].includes(format)) {
      return res.status(400).send('Invalid or missing format');
    }
    if (!period || !['daily', 'weekly', 'monthly', 'yearly', 'custom'].includes(period)) {
      return res.status(400).send('Invalid or missing period');
    }
    if (period !== 'custom' && !specificDate) {
      return res.status(400).send('Specific date is required for non-custom periods');
    }
    if (period === 'custom' && (!startDate || !endDate)) {
      return res.status(400).send('Start and end dates are required for custom period');
    }
    if (period === 'custom' && new Date(endDate) < new Date(startDate)) {
      return res.status(400).send('End date cannot be before start date');
    }

    // Get sales data
    const dataResponse = await getSalesDataInternal({ period, specificDate, startDate, endDate });
    if (!dataResponse.success) {
      throw new Error(dataResponse.message);
    }

    const { summary, dailyData, data } = dataResponse;

    // Generate report based on format
    if (format === 'pdf') {
      await generatePDFReport(res, { summary, dailyData, data, includeDetails, includeSummary, includeCharts });
    } else if (format === 'excel') {
      await generateExcelReport(res, { summary, dailyData, data, includeDetails, includeSummary, includeCharts });
    } else if (format === 'csv') {
      await generateCSVReport(res, { summary, dailyData, data, includeDetails, includeSummary, includeCharts });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).send('Error generating report');
  }
};

// Helper method for internal data fetching
const getSalesDataInternal = async (params) => {
  try {
    const { period, specificDate, startDate, endDate } = params;

    // Same logic as getSalesData (extracted for reusability)
    let dateFilter = {};
    let groupBy = null;

    if (period === 'custom') {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      };
      groupBy = '$dayOfMonth';
    } else {
      const date = new Date(specificDate);
      let start, end;

      switch (period) {
        case 'daily':
          start = new Date(date.setHours(0, 0, 0, 0));
          end = new Date(date.setHours(23, 59, 59, 999));
          break;
        case 'weekly':
          start = new Date(date.setDate(date.getDate() - date.getDay()));
          end = new Date(start);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        case 'monthly':
          start = new Date(date.getFullYear(), date.getMonth(), 1);
          end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
          end.setHours(23, 59, 59, 999);
          break;
        case 'yearly':
          start = new Date(date.getFullYear(), 0, 1);
          end = new Date(date.getFullYear(), 11, 31);
          end.setHours(23, 59, 59, 999);
          break;
        default:
          throw new Error('Invalid period');
      }

      dateFilter = {
        createdAt: {
          $gte: start,
          $lte: end,
        },
      };

      if (period === 'weekly' || period === 'monthly') {
        groupBy = '$dayOfMonth';
      } else if (period === 'yearly') {
        groupBy = '$month';
      }
    }

    // Fetch orders
    const orders = await Order.find(dateFilter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    // Calculate summary
    const summary = {
      totalSales: 0,
      totalOrders: orders.length,
      totalDiscounts: 0,
      totalNetAmount: 0,
    };

    orders.forEach((order) => {
      summary.totalSales += order.finalAmount || 0;
      summary.totalDiscounts += order.discount || 0;
      summary.totalNetAmount += order.finalAmount || 0;
    });

    // Prepare daily data for charts
    let dailyData = [];
    if (groupBy) {
      const dailyAggregation = await Order.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            totalAmount: { $sum: '$finalAmount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      dailyData = dailyAggregation.map((item) => ({
        date: item._id,
        amount: item.totalAmount,
        count: item.count,
      }));
    }

    return {
      success: true,
      summary: {
        totalSales: summary.totalNetAmount,
        totalOrders: summary.totalOrders,
        totalDiscounts: summary.totalDiscounts,
        avgOrderValue: summary.totalOrders > 0 ? summary.totalNetAmount / summary.totalOrders : 0,
      },
      dailyData,
      data: orders.map((order) => ({
        date: order.createdAt,
        orderId: order.orderId,
        customer: order.userId ? order.userId.name : 'Guest',
        amount: order.totalPrice || 0,
        discount: order.discount || 0,
        couponUsed: order.couponCode || 'None',
        netAmount: order.finalAmount || 0,
        status: order.status,
      })),
    };
  } catch (error) {
    next(error)
  }
};

// PDF Report Generator
async function generatePDFReport(res, { summary, dailyData, data, includeDetails, includeSummary, includeCharts }) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument();
  const filename = `sales-report-${new Date().toISOString().split('T')[0]}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  doc.pipe(res);

  doc.fontSize(20).text('Sales Report', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).text(`Report generated on: ${new Date().toLocaleDateString()}`, { align: 'left' });
  doc.moveDown();

  if (includeSummary) {
    doc.fontSize(16).text('Summary', { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(12).text(`Total Sales: $${summary.totalSales.toFixed(2)}`);
    doc.text(`Total Orders: ${summary.totalOrders}`);
    doc.text(`Total Discounts: $${summary.totalDiscounts.toFixed(2)}`);
    doc.text(`Average Order Value: $${summary.avgOrderValue.toFixed(2)}`);
    doc.moveDown();
  }

  if (includeCharts) {
    doc.fontSize(12).text('Note: Charts are available in the web interface only.', { align: 'center' });
    doc.moveDown();
  }

  if (includeDetails) {
    doc.fontSize(16).text('Order Details', { underline: true });
    doc.moveDown(0.5);

    const headers = ['Date', 'Order ID', 'Customer', 'Amount', 'Discount', 'Net Amount', 'Status'];
    const columnWidths = [80, 100, 100, 60, 60, 80, 80];
    const rowHeight = 20;
    let startX = 50;
    let startY = doc.y;

    // Draw header row
    let x = startX;
    headers.forEach((header, i) => {
      doc.font('Helvetica-Bold').fontSize(10).text(header, x, startY, { width: columnWidths[i], align: 'left' });
      x += columnWidths[i];
    });

    // Draw a line under headers
    doc.moveTo(startX, startY + rowHeight - 8).lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), startY + rowHeight - 8).stroke();

    // Draw data rows
    startY += rowHeight;
    data.forEach((order) => {
      let x = startX;
      const row = [
        new Date(order.date).toLocaleDateString(),
        order.orderId,
        order.customer,
        `$${order.amount.toFixed(2)}`,
        `$${order.discount.toFixed(2)}`,
        `$${order.netAmount.toFixed(2)}`,
        order.status,
      ];

      row.forEach((cell, i) => {
        doc.font('Helvetica').fontSize(10).text(cell, x, startY, { width: columnWidths[i], align: 'left' });
        x += columnWidths[i];
      });

      // Move Y down to next row
      startY += rowHeight;
    });
  }

  doc.end();
}



// Excel Report Generator
async function generateExcelReport(res, { summary, dailyData, data, includeDetails, includeSummary, includeCharts }) {
  const workbook = new exceljs.Workbook();
  const worksheet = workbook.addWorksheet('Sales Report');
  const filename = `sales-report-${new Date().toISOString().split('T')[0]}.xlsx`;

  // Summary Section
  if (includeSummary) {
    worksheet.addRow(['Summary']);
    worksheet.addRow(['Total Sales', summary.totalSales]);
    worksheet.addRow(['Total Orders', summary.totalOrders]);
    worksheet.addRow(['Total Discounts', summary.totalDiscounts]);
    worksheet.addRow(['Average Order Value', summary.avgOrderValue]);
    worksheet.addRow([]); // empty row for spacing
  }

  // Daily Data Section
  if (includeCharts && dailyData.length) {
    worksheet.addRow(['Daily Data']);
    worksheet.addRow(['Date', 'Total Amount', 'Order Count']);

    dailyData.forEach((item) => {
      worksheet.addRow([item.date, item.amount, item.count]);
    });

    worksheet.addRow([]); // empty row for spacing
  }

  // Order Details Section
  if (includeDetails && data.length) {
    worksheet.addRow(['Order Details']);
    worksheet.addRow(['Date', 'Order ID', 'Customer', 'Amount', 'Discount', 'Net Amount', 'Status']);

    data.forEach((order) => {
      worksheet.addRow([
        new Date(order.date).toLocaleDateString(),
        order.orderId,
        order.customer,
        order.amount,
        order.discount,
        order.netAmount,
        order.status,
      ]);
    });
  }

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );

  await workbook.xlsx.write(res);
  res.end();
}


// CSV Report Generator
async function generateCSVReport(res, { summary, dailyData, data, includeDetails, includeSummary, includeCharts }) {
  const filename = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  let csvContent = '';

  if (includeSummary) {
    csvContent += 'Sales Report Summary\n\n';
    csvContent += `Total Sales,$${summary.totalSales.toFixed(2)}\n`;
    csvContent += `Total Orders,${summary.totalOrders}\n`;
    csvContent += `Total Discounts,$${summary.totalDiscounts.toFixed(2)}\n`;
    csvContent += `Average Order Value,$${summary.avgOrderValue.toFixed(2)}\n\n`;
  }

  if (includeDetails) {
    csvContent += 'Date,Order ID,Customer,Amount,Discount,Coupon Used,Net Amount,Status\n';
    data.forEach((order) => {
      csvContent += [
        `"${new Date(order.date).toLocaleDateString()}"`,
        `"${order.orderId}"`,
        `"${order.customer}"`,
        order.amount.toFixed(2),
        order.discount.toFixed(2),
        `"${order.couponUsed}"`,
        order.netAmount.toFixed(2),
        `"${order.status}"`,
      ].join(',') + '\n';
    });
  }

  res.send(csvContent);
}

module.exports = {
  salesReportPage,
  getSalesData,
  downloadReport,
};