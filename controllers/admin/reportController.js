// controllers/admin/reportController.js
const Order = require("../../models/orderSchema");
const moment = require("moment");
const exceljs = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const STATUS_CODE=require("../../constants/httpStatus");
const salesReportPage = async (req, res, next) => {
  try {
    res.render("admin/sales-report", { title: "Sales Report" });
  } catch (error) {
    next(error);
  }
};

const getSalesData = async (req, res, next) => {
  try {
    const { period, specificDate, startDate, endDate } = req.body;
    
    // Input validation
    if (
      !period ||
      !["daily", "weekly", "monthly", "yearly", "custom"].includes(period)
    ) {
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({ success: false, message: "Invalid or missing period" });
    }
    if (period !== "custom" && !specificDate) {
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({
          success: false,
          message: "Specific date is required for non-custom periods",
        });
    }
    if (period === "custom" && (!startDate || !endDate)) {
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({
          success: false,
          message: "Start and end dates are required for custom period",
        });
    }
    if (period === "custom" && new Date(endDate) < new Date(startDate)) {
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .json({
          success: false,
          message: "End date cannot be before start date",
        });
    }

    // Determine date range
    // Determine date range
    let dateFilter = {};
    let groupByFormat = "%Y-%m-%d"; // Default format for daily, weekly, monthly, custom

    if (period === "custom") {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate + "T23:59:59.999Z"),
        },
      };
    } else {
      const date = new Date(specificDate);
      let start, end;

      switch (period) {
        case "daily":
          start = new Date(date);
          start.setHours(0, 0, 0, 0);
          end = new Date(date);
          end.setHours(23, 59, 59, 999);
          break;

        case "weekly":
          start = new Date(date);
          start.setDate(start.getDate() - start.getDay());
          start.setHours(0, 0, 0, 0);
          end = new Date(start);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;

        case "monthly":
          start = new Date(date.getFullYear(), date.getMonth(), 1);
          end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
          end.setHours(23, 59, 59, 999);
          break;

        case "yearly":
          start = new Date(date.getFullYear(), 0, 1);
          end = new Date(date.getFullYear(), 11, 31);
          end.setHours(23, 59, 59, 999);
          groupByFormat = "%Y-%m"; // Use month format for yearly
          break;

        default:
          throw new Error("Invalid period");
      }

      dateFilter = {
        createdAt: {
          $gte: start,
          $lte: end,
        },
      };
    }

    // Fetch orders
    const orders = await Order.find(dateFilter)
      .populate("userId", "name email")
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
    const dailyAggregation = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: groupByFormat, date: "$createdAt" },
          },
          totalAmount: { $sum: "$finalAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const dailyData = dailyAggregation.map((item) => ({
      date: item._id,
      amount: item.totalAmount,
      count: item.count,
    }));

    // For daily period, ensure at least one data point
    if (period === "daily" && dailyData.length === 0) {
      dailyData.push({
        date: specificDate,
        amount: 0,
        count: 0,
      });
    }

    // Prepare response data
    const responseData = {
      success: true,
      summary: {
        totalSales: summary.totalNetAmount,
        totalOrders: summary.totalOrders,
        totalDiscounts: summary.totalDiscounts,
        avgOrderValue:
          summary.totalOrders > 0
            ? summary.totalNetAmount / summary.totalOrders
            : 0,
      },
      dailyData,
      data: orders.map((order) => ({
        date: order.createdAt,
        orderId: order.orderId,
        customer: order.userId ? order.userId.name : "Guest",
        amount: order.totalPrice || 0,
        discount: order.discount || 0,
        couponUsed: order.couponCode || "None",
        netAmount: order.finalAmount || 0,
        status: order.status,
      })),
    };

    res.json(responseData);
  } catch (error) {
    next(error);
  }
};

// NOTE: this assumes your file already has these requires at the top
// (same as your original file):
//   const PDFDocument = require("pdfkit");
//   const exceljs = require("exceljs");

const BRAND = {
  name: "18-CREW",
  accent: "#c9302c",
  dark: "#1a1a1a",
  muted: "#666666",
  border: "#cccccc",
  headerBg: "#f2f2f2",
};

const formatCurrency = (amount) => `Rs. ${Number(amount || 0).toFixed(2)}`;

const downloadReport = async (req, res, next) => {
  try {
    const {
      format,
      includeDetails,
      includeSummary,
      includeCharts,
      period,
      specificDate,
      startDate,
      endDate,
    } = req.query;

    // Input validation
    if (!format || !["pdf", "excel", "csv"].includes(format)) {
      return res.status(STATUS_CODE.BAD_REQUEST).send("Invalid or missing format");
    }
    if (
      !period ||
      !["daily", "weekly", "monthly", "yearly", "custom"].includes(period)
    ) {
      return res.status(STATUS_CODE.BAD_REQUEST).send("Invalid or missing period");
    }
    if (period !== "custom" && !specificDate) {
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .send("Specific date is required for non-custom periods");
    }
    if (period === "custom" && (!startDate || !endDate)) {
      return res
        .status(STATUS_CODE.BAD_REQUEST)
        .send("Start and end dates are required for custom period");
    }
    if (period === "custom" && new Date(endDate) < new Date(startDate)) {
      return res.status(STATUS_CODE.BAD_REQUEST).send("End date cannot be before start date");
    }

    // Get sales data
    const dataResponse = await getSalesDataInternal({
      period,
      specificDate,
      startDate,
      endDate,
    });
    if (!dataResponse.success) {
      throw new Error(dataResponse.message);
    }

    const { summary, dailyData, data } = dataResponse;
    const reportMeta = { period, specificDate, startDate, endDate };

    // Generate report based on format
    if (format === "pdf") {
      await generatePDFReport(res, {
        summary,
        dailyData,
        data,
        includeDetails,
        includeSummary,
        includeCharts,
        reportMeta,
      });
    } else if (format === "excel") {
      await generateExcelReport(res, {
        summary,
        dailyData,
        data,
        includeDetails,
        includeSummary,
        includeCharts,
        reportMeta,
      });
    } else if (format === "csv") {
      await generateCSVReport(res, {
        summary,
        dailyData,
        data,
        includeDetails,
        includeSummary,
        includeCharts,
        reportMeta,
      });
    }
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(STATUS_CODE.INTERNAL_SERVER_ERROR).send("Error generating report");
  }
};

// Helper method for internal data fetching
const getSalesDataInternal = async (params) => {
  try {
    const { period, specificDate, startDate, endDate } = params;

    // Same logic as getSalesData (extracted for reusability)
    let dateFilter = {};
    let groupBy = null;

    if (period === "custom") {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate + "T23:59:59.999Z"),
        },
      };
      groupBy = "$dayOfMonth";
    } else {
      const date = new Date(specificDate);
      let start, end;

      switch (period) {
        case "daily":
          start = new Date(date.setHours(0, 0, 0, 0));
          end = new Date(date.setHours(23, 59, 59, 999));
          break;
        case "weekly":
          start = new Date(date.setDate(date.getDate() - date.getDay()));
          end = new Date(start);
          end.setDate(start.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        case "monthly":
          start = new Date(date.getFullYear(), date.getMonth(), 1);
          end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
          end.setHours(23, 59, 59, 999);
          break;
        case "yearly":
          start = new Date(date.getFullYear(), 0, 1);
          end = new Date(date.getFullYear(), 11, 31);
          end.setHours(23, 59, 59, 999);
          break;
        default:
          throw new Error("Invalid period");
      }

      dateFilter = {
        createdAt: {
          $gte: start,
          $lte: end,
        },
      };

      if (period === "weekly" || period === "monthly") {
        groupBy = "$dayOfMonth";
      } else if (period === "yearly") {
        groupBy = "$month";
      }
    }

    // Fetch orders
    const orders = await Order.find(dateFilter)
      .populate("userId", "name email")
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
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            totalAmount: { $sum: "$finalAmount" },
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
        avgOrderValue:
          summary.totalOrders > 0
            ? summary.totalNetAmount / summary.totalOrders
            : 0,
      },
      dailyData,
      data: orders.map((order) => ({
        date: order.createdAt,
        orderId: order.orderId,
        customer: order.userId ? order.userId.name : "Guest",
        amount: order.totalPrice || 0,
        discount: order.discount || 0,
        couponUsed: order.couponCode || "None",
        netAmount: order.finalAmount || 0,
        status: order.status,
      })),
    };
  } catch (error) {
    // FIX: this function only receives `params`, not `next` — calling
    // next(error) here would throw a ReferenceError instead of failing
    // gracefully. Return a { success: false } result instead, matching
    // how the caller (downloadReport) already expects to handle failure.
    console.error("Error fetching sales data:", error);
    return { success: false, message: error.message };
  }
};

// Builds a human-readable label for the report period, used in the header
// of every format.
function describePeriod({ period, specificDate, startDate, endDate }) {
  if (period === "custom") {
    return `${new Date(startDate).toLocaleDateString("en-IN")} - ${new Date(
      endDate
    ).toLocaleDateString("en-IN")}`;
  }
  const label = period.charAt(0).toUpperCase() + period.slice(1);
  return `${label} - ${new Date(specificDate).toLocaleDateString("en-IN")}`;
}

// ---------- PDF Report Generator ----------
async function generatePDFReport(
  res,
  { summary, dailyData, data, includeDetails, includeSummary, includeCharts, reportMeta }
) {
  try {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const marginX = doc.page.margins.left;
 
    const filename = `sales-report-${
      new Date().toISOString().split("T")[0]
    }.pdf`;
 
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
 
    doc.on("error", (err) => {
      console.error("PDF generation error:", err);
      if (!res.headersSent) {
        res.status(500).send("Error generating PDF");
      }
    });
 
    doc.pipe(res);
 
    // ---- Header ----
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .fillColor(BRAND.dark)
      .text(BRAND.name, marginX, 50);
 
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .fillColor(BRAND.accent)
      .text("SALES REPORT", marginX, 50, { width: pageWidth, align: "right" });
 
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(BRAND.dark)
      .text(`Period: ${describePeriod(reportMeta)}`, marginX, 76, {
        width: pageWidth,
        align: "right",
      })
      .text(`Generated On: ${new Date().toLocaleString("en-IN")}`, marginX, 89, {
        width: pageWidth,
        align: "right",
      });
 
    doc
      .moveTo(marginX, 112)
      .lineTo(marginX + pageWidth, 112)
      .lineWidth(0.75)
      .strokeColor(BRAND.border)
      .stroke();
 
    let y = 128;
 
    // ---- Summary cards ----
    if (includeSummary) {
      const cards = [
        ["Total Sales", formatCurrency(summary.totalSales)],
        ["Total Orders", String(summary.totalOrders)],
        ["Total Discounts", formatCurrency(summary.totalDiscounts)],
        ["Coupon Discount", formatCurrency(summary.totalCouponDiscount)],
        ["Avg Order Value", formatCurrency(summary.avgOrderValue)],
      ];
      const cardGap = 8;
      const cardWidth = (pageWidth - cardGap * (cards.length - 1)) / cards.length;
      const cardHeight = 50;
 
      cards.forEach(([label, value], i) => {
        const cardX = marginX + i * (cardWidth + cardGap);
        doc.rect(cardX, y, cardWidth, cardHeight).fill(BRAND.headerBg);
        doc
          .fontSize(7.5)
          .font("Helvetica")
          .fillColor(BRAND.muted)
          .text(label, cardX + 8, y + 10, { width: cardWidth - 16, lineBreak: false, ellipsis: true });
        doc
          .fontSize(11.5)
          .font("Helvetica-Bold")
          .fillColor(BRAND.dark)
          .text(value, cardX + 8, y + 26, { width: cardWidth - 16, lineBreak: false, ellipsis: true });
      });
 
      y += cardHeight + 24;
    }
 
    // ---- Chart notice ----
    if (includeCharts) {
      doc.rect(marginX, y, pageWidth, 28).fill(BRAND.headerBg);
      doc
        .fontSize(9)
        .font("Helvetica-Oblique")
        .fillColor(BRAND.muted)
        .text("Charts are available in the web dashboard only.", marginX, y + 9, {
          width: pageWidth,
          align: "center",
        });
      y += 28 + 20;
    }
 
    // ---- Order Details table ----
    if (includeDetails) {
      doc.fontSize(13).font("Helvetica-Bold").fillColor(BRAND.dark).text("Order Details", marginX, y);
      y += 20;
 
      const cols = [
        { key: "date", label: "Date", width: 60, align: "left" },
        { key: "orderId", label: "Order ID", width: 75, align: "left" },
        { key: "customer", label: "Customer", width: 90, align: "left" },
        { key: "amount", label: "Amount", width: 65, align: "right" },
        { key: "discount", label: "Discount", width: 65, align: "right" },
        { key: "netAmount", label: "Net Amount", width: 65, align: "right" },
        { key: "status", label: "Status", width: 75, align: "left" },
      ];
      // Assign x offsets left-to-right within pageWidth
      let cx = marginX;
      cols.forEach((c) => {
        c.x = cx;
        cx += c.width;
      });
 
      const rowHeight = 22;
      // Every cell uses ellipsis + lineBreak:false so long values (full
      // UUID order IDs, long statuses like "Partially Returned") truncate
      // to one line instead of wrapping and overlapping the row below.
      const cellOpts = (width, align) => ({
        width: width - 8,
        align,
        lineBreak: false,
        ellipsis: true,
      });
 
      const drawTableHeader = (yPos) => {
        doc.rect(marginX, yPos, pageWidth, rowHeight).fill(BRAND.headerBg);
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(BRAND.dark);
        cols.forEach((c) => {
          doc.text(c.label, c.x + 4, yPos + 7, cellOpts(c.width, c.align));
        });
        doc
          .rect(marginX, yPos, pageWidth, rowHeight)
          .lineWidth(0.75)
          .strokeColor(BRAND.border)
          .stroke();
        return yPos + rowHeight;
      };
 
      y = drawTableHeader(y);
      const tableStartY = y;
 
      data.forEach((order, idx) => {
        const pageBottom = doc.page.height - doc.page.margins.bottom;
        if (y + rowHeight > pageBottom - 30) {
          doc.addPage();
          y = doc.page.margins.top;
          y = drawTableHeader(y);
        }
 
        if (idx % 2 === 1) {
          doc.rect(marginX, y, pageWidth, rowHeight).fill("#fafafa");
        }
 
        // Shorten the order ID for the table; the full ID is still on
        // the underlying order/invoice, this is just a compact display.
        const shortOrderId = order.orderId ? `#${String(order.orderId).slice(0, 8)}` : "N/A";
 
        doc.font("Helvetica").fontSize(8.5).fillColor(BRAND.dark);
        doc.text(
          new Date(order.date).toLocaleDateString("en-IN"),
          cols[0].x + 4,
          y + 7,
          cellOpts(cols[0].width, cols[0].align)
        );
        doc.text(shortOrderId, cols[1].x + 4, y + 7, cellOpts(cols[1].width, cols[1].align));
        doc.text(order.customer, cols[2].x + 4, y + 7, cellOpts(cols[2].width, cols[2].align));
        doc.text(
          formatCurrency(order.amount),
          cols[3].x + 4,
          y + 7,
          cellOpts(cols[3].width, cols[3].align)
        );
        doc.text(
          formatCurrency(order.discount),
          cols[4].x + 4,
          y + 7,
          cellOpts(cols[4].width, cols[4].align)
        );
        doc.text(
          formatCurrency(order.netAmount),
          cols[5].x + 4,
          y + 7,
          cellOpts(cols[5].width, cols[5].align)
        );
        doc.text(order.status, cols[6].x + 4, y + 7, cellOpts(cols[6].width, cols[6].align));
 
        y += rowHeight;
      });
 
      // Outer border around the whole table body on the last page section
      doc
        .rect(marginX, tableStartY, pageWidth, y - tableStartY)
        .lineWidth(0.75)
        .strokeColor(BRAND.border)
        .stroke();
    }
 
    // ---- Footer on every page ----
    const range = doc.bufferedPageRange
      ? doc.bufferedPageRange()
      : { start: 0, count: 1 };
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const footerY = doc.page.height - doc.page.margins.bottom - 20;
      doc
        .moveTo(marginX, footerY)
        .lineTo(marginX + pageWidth, footerY)
        .lineWidth(0.75)
        .strokeColor(BRAND.border)
        .stroke();
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor(BRAND.muted)
        .text(`${BRAND.name} - Sales Report - Page ${i + 1} of ${range.count}`, marginX, footerY + 6, {
          width: pageWidth,
          align: "center",
        });
    }
 
    doc.end();
  } catch (error) {
    console.error("Error while generating PDF report:", error);
    if (!res.headersSent) {
      res.status(500).send("Error generating PDF");
    }
  }
}

// ---------- Excel Report Generator ----------
async function generateExcelReport(
  res,
  { summary, dailyData, data, includeDetails, includeSummary, includeCharts, reportMeta }
) {
  const workbook = new exceljs.Workbook();
  workbook.creator = BRAND.name;
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Sales Report", {
    views: [{ showGridLines: false }],
  });

  const filename = `sales-report-${
    new Date().toISOString().split("T")[0]
  }.xlsx`;

  const accentFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9302C" } };
  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  const thinBorder = {
    top: { style: "thin", color: { argb: "FFCCCCCC" } },
    left: { style: "thin", color: { argb: "FFCCCCCC" } },
    bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
    right: { style: "thin", color: { argb: "FFCCCCCC" } },
  };
  const currencyFmt = '"Rs. "#,##0.00';

  let row = 1;

  // ---- Title band ----
  worksheet.mergeCells(`A${row}:H${row}`);
  const titleCell = worksheet.getCell(`A${row}`);
  titleCell.value = `${BRAND.name} - Sales Report`;
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = accentFill;
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  worksheet.getRow(row).height = 26;
  row += 1;

  worksheet.mergeCells(`A${row}:H${row}`);
  worksheet.getCell(`A${row}`).value = `Period: ${describePeriod(
    reportMeta
  )}   |   Generated On: ${new Date().toLocaleString("en-IN")}`;
  worksheet.getCell(`A${row}`).font = { italic: true, size: 9, color: { argb: "FF666666" } };
  row += 2;

  // ---- Summary section ----
  if (includeSummary) {
    worksheet.getCell(`A${row}`).value = "Summary";
    worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row += 1;

    const summaryRows = [
      ["Total Sales", summary.totalSales],
      ["Total Orders", summary.totalOrders],
      ["Total Discounts", summary.totalDiscounts],
      ["Average Order Value", summary.avgOrderValue],
    ];

    summaryRows.forEach(([label, value]) => {
      const labelCell = worksheet.getCell(`A${row}`);
      const valueCell = worksheet.getCell(`B${row}`);
      labelCell.value = label;
      labelCell.font = { color: { argb: "FF666666" } };
      valueCell.value = value;
      if (label !== "Total Orders") valueCell.numFmt = currencyFmt;
      valueCell.font = { bold: true };
      row += 1;
    });
    row += 1;
  }

  // ---- Daily data section ----
  if (includeCharts && dailyData.length) {
    worksheet.getCell(`A${row}`).value = "Daily Breakdown";
    worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row += 1;

    const headerRow = worksheet.getRow(row);
    ["Date", "Total Amount", "Order Count"].forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true };
      cell.fill = headerFill;
      cell.border = thinBorder;
    });
    row += 1;

    dailyData.forEach((item) => {
      const r = worksheet.getRow(row);
      r.getCell(1).value = item.date;
      r.getCell(2).value = item.amount;
      r.getCell(2).numFmt = currencyFmt;
      r.getCell(3).value = item.count;
      [1, 2, 3].forEach((c) => (r.getCell(c).border = thinBorder));
      row += 1;
    });
    row += 1;
  }

  // ---- Order details section ----
  if (includeDetails && data.length) {
    worksheet.getCell(`A${row}`).value = "Order Details";
    worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row += 1;

    const headers = [
      "Date",
      "Order ID",
      "Customer",
      "Amount",
      "Discount",
      "Coupon Used",
      "Net Amount",
      "Status",
    ];
    const headerRow = worksheet.getRow(row);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = accentFill;
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle" };
    });
    headerRow.height = 18;
    const headerRowNumber = row;
    row += 1;

    data.forEach((order, idx) => {
      const r = worksheet.getRow(row);
      r.getCell(1).value = new Date(order.date);
      r.getCell(1).numFmt = "dd-mmm-yyyy";
      r.getCell(2).value = order.orderId;
      r.getCell(3).value = order.customer;
      r.getCell(4).value = order.amount;
      r.getCell(4).numFmt = currencyFmt;
      r.getCell(5).value = order.discount;
      r.getCell(5).numFmt = currencyFmt;
      r.getCell(6).value = order.couponUsed;
      r.getCell(7).value = order.netAmount;
      r.getCell(7).numFmt = currencyFmt;
      r.getCell(8).value = order.status;

      for (let c = 1; c <= 8; c++) {
        r.getCell(c).border = thinBorder;
        if (idx % 2 === 1) {
          r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
        }
      }
      row += 1;
    });

    worksheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: row - 1, column: 8 },
    };
    worksheet.views = [{ state: "frozen", ySplit: headerRowNumber }];
  }

  worksheet.columns = [
    { width: 14 }, // Date
    { width: 30 }, // Order ID
    { width: 22 }, // Customer
    { width: 14 }, // Amount
    { width: 14 }, // Discount
    { width: 16 }, // Coupon Used
    { width: 14 }, // Net Amount
    { width: 16 }, // Status
  ];

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
}

// ---------- CSV Report Generator ----------
async function generateCSVReport(
  res,
  { summary, dailyData, data, includeDetails, includeSummary, includeCharts, reportMeta }
) {
  const filename = `sales-report-${new Date().toISOString().split("T")[0]}.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  let csvContent = "";
  csvContent += `${BRAND.name} Sales Report\n`;
  csvContent += `Period,${describePeriod(reportMeta)}\n`;
  csvContent += `Generated On,${new Date().toLocaleString("en-IN")}\n\n`;

  if (includeSummary) {
    csvContent += "Summary\n";
    csvContent += `Total Sales,${formatCurrency(summary.totalSales)}\n`;
    csvContent += `Total Orders,${summary.totalOrders}\n`;
    csvContent += `Total Discounts,${formatCurrency(summary.totalDiscounts)}\n`;
    csvContent += `Average Order Value,${formatCurrency(summary.avgOrderValue)}\n\n`;
  }

  if (includeDetails) {
    csvContent +=
      "Date,Order ID,Customer,Amount,Discount,Coupon Used,Net Amount,Status\n";
    data.forEach((order) => {
      csvContent +=
        [
          `"${new Date(order.date).toLocaleDateString("en-IN")}"`,
          `"${order.orderId}"`,
          `"${order.customer}"`,
          `"${formatCurrency(order.amount)}"`,
          `"${formatCurrency(order.discount)}"`,
          `"${order.couponUsed}"`,
          `"${formatCurrency(order.netAmount)}"`,
          `"${order.status}"`,
        ].join(",") + "\n";
    });
  }

  res.send(csvContent);
}
const getBestSellingProducts = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const result = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $group: {
          _id: "$orderedItems.product",
          totalQuantity: { $sum: "$orderedItems.quantity" },
          totalRevenue: {
            $sum: {
              $multiply: ["$orderedItems.quantity", "$orderedItems.price"],
            },
          },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $project: {
          productId: "$_id",
          productName: "$productDetails.productName",
          productImage: "$productDetails.productImage",
          totalQuantity: 1,
          totalRevenue: 1,
          _id: 0,
        },
      },
    ]);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getBestSellingCategories = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const result = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      // Add this additional lookup to get category names
      {
        $lookup: {
          from: "categories", // Make sure this matches your categories collection name
          localField: "productDetails.category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },
      {
        $group: {
          _id: "$categoryDetails.name", // Now using the category name from the lookup
          totalQuantity: { $sum: "$orderedItems.quantity" },
          totalRevenue: {
            $sum: {
              $multiply: ["$orderedItems.quantity", "$orderedItems.price"],
            },
          },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          category: "$_id",
          totalQuantity: 1,
          totalRevenue: 1,
          _id: 0,
        },
      },
    ]);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getBestSellingBrands = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const result = await Order.aggregate([
      { $unwind: "$orderedItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderedItems.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.brand",
          totalQuantity: { $sum: "$orderedItems.quantity" },
          totalRevenue: {
            $sum: {
              $multiply: ["$orderedItems.quantity", "$orderedItems.price"],
            },
          },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          brand: "$_id",
          totalQuantity: 1,
          totalRevenue: 1,
          _id: 0,
        },
      },
    ]);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  salesReportPage,
  getSalesData,
  downloadReport,
  getBestSellingBrands,
  getBestSellingCategories,
  getBestSellingProducts,
};
