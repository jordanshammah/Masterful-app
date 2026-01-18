/**
 * Invoice PDF Generator
 * Generates professional PDF invoices using jsPDF
 */

import { jsPDF } from "jspdf";
import { format } from "date-fns";
import type { JobWithDetails } from "@/types/pro-dashboard";

interface GenerateInvoicePDFOptions {
  job: JobWithDetails;
  invoiceNumber?: string;
}

export const generateInvoicePDF = ({ job, invoiceNumber }: GenerateInvoicePDFOptions): Blob => {
  // Create PDF document (A4 size)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Generate invoice number if not provided
  const invNumber = invoiceNumber || `INV-${job.id.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;

  // Calculate pricing
  const laborCost = job.quote_labor || job.base_price || 0;
  const materialsCost = job.quote_materials || job.materials_cost || 0;
  const subtotal = laborCost + materialsCost;
  const platformFeePercent = job.platform_commission_percent || 15;
  const platformFee = job.platform_commission_amount || Math.round(subtotal * (platformFeePercent / 100));
  const totalAmount = job.quote_total || job.total_price || subtotal;

  // Payment info
  const paymentStatus = job.payment_status || (job.status === "completed" ? "completed" : "pending");
  const paymentMethod = job.payment_method || "N/A";

  // Colors
  const primaryColor: [number, number, number] = [217, 116, 58]; // #D9743A
  const textDark: [number, number, number] = [31, 41, 55]; // gray-800
  const textMedium: [number, number, number] = [107, 114, 128]; // gray-500
  const textLight: [number, number, number] = [156, 163, 175]; // gray-400

  let yPosition = 20;
  const leftMargin = 20;
  const rightMargin = 190;
  const pageWidth = 210;

  // Helper functions
  const addText = (text: string, x: number, y: number, options?: {
    fontSize?: number;
    fontStyle?: "normal" | "bold";
    color?: [number, number, number];
    align?: "left" | "center" | "right";
  }) => {
    const { fontSize = 10, fontStyle = "normal", color = textDark, align = "left" } = options || {};
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", fontStyle);
    doc.setTextColor(...color);
    
    let xPos = x;
    if (align === "right") {
      xPos = x - doc.getTextWidth(text);
    } else if (align === "center") {
      xPos = x - doc.getTextWidth(text) / 2;
    }
    
    doc.text(text, xPos, y);
  };

  const addLine = (y: number, color: [number, number, number] = [229, 231, 235]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(leftMargin, y, rightMargin, y);
  };

  // ===== HEADER =====
  // Company name
  addText("MASTERFUL", leftMargin, yPosition, {
    fontSize: 24,
    fontStyle: "bold",
    color: textDark,
  });
  yPosition += 6;
  
  addText("Professional Services Platform", leftMargin, yPosition, {
    fontSize: 10,
    color: textMedium,
  });

  // Invoice title (right side)
  addText("INVOICE", rightMargin, 20, {
    fontSize: 20,
    fontStyle: "bold",
    color: primaryColor,
    align: "right",
  });
  addText(invNumber, rightMargin, 27, {
    fontSize: 10,
    color: textMedium,
    align: "right",
  });

  yPosition += 15;
  addLine(yPosition);
  yPosition += 15;

  // ===== BILL TO & DATES =====
  // Bill To section
  addText("BILL TO", leftMargin, yPosition, {
    fontSize: 8,
    fontStyle: "bold",
    color: textMedium,
  });
  yPosition += 6;
  
  addText(job.customer?.profiles?.full_name || "Customer", leftMargin, yPosition, {
    fontSize: 11,
    fontStyle: "bold",
    color: textDark,
  });
  yPosition += 5;
  
  if (job.customer?.profiles?.phone) {
    addText(job.customer.profiles.phone, leftMargin, yPosition, {
      fontSize: 10,
      color: textMedium,
    });
    yPosition += 5;
  }
  
  if (job.address) {
    // Wrap long addresses
    const addressLines = doc.splitTextToSize(job.address, 80);
    addressLines.forEach((line: string) => {
      addText(line, leftMargin, yPosition, {
        fontSize: 10,
        color: textMedium,
      });
      yPosition += 5;
    });
  }

  // Dates (right side)
  let dateY = yPosition - (job.address ? 15 : 10);
  
  addText("INVOICE DATE", rightMargin, dateY, {
    fontSize: 8,
    fontStyle: "bold",
    color: textMedium,
    align: "right",
  });
  dateY += 5;
  addText(format(new Date(), "MMMM d, yyyy"), rightMargin, dateY, {
    fontSize: 10,
    color: textDark,
    align: "right",
  });
  dateY += 10;
  
  addText("SERVICE DATE", rightMargin, dateY, {
    fontSize: 8,
    fontStyle: "bold",
    color: textMedium,
    align: "right",
  });
  dateY += 5;
  addText(
    job.scheduled_date ? format(new Date(job.scheduled_date), "MMMM d, yyyy") : "N/A",
    rightMargin,
    dateY,
    { fontSize: 10, color: textDark, align: "right" }
  );

  yPosition += 10;

  // ===== SERVICE DETAILS =====
  addText("SERVICE DETAILS", leftMargin, yPosition, {
    fontSize: 8,
    fontStyle: "bold",
    color: textMedium,
  });
  yPosition += 6;

  // Service box
  doc.setFillColor(249, 250, 251); // gray-50
  doc.roundedRect(leftMargin, yPosition - 3, pageWidth - 40, 20, 2, 2, "F");
  
  addText(job.service_category?.name || "Service", leftMargin + 5, yPosition + 5, {
    fontSize: 11,
    fontStyle: "bold",
    color: textDark,
  });
  
  if (job.notes) {
    const notesText = job.notes.length > 80 ? job.notes.substring(0, 80) + "..." : job.notes;
    addText(notesText, leftMargin + 5, yPosition + 12, {
      fontSize: 9,
      color: textMedium,
    });
  }

  yPosition += 30;

  // ===== PRICING BREAKDOWN =====
  addText("PRICING BREAKDOWN", leftMargin, yPosition, {
    fontSize: 8,
    fontStyle: "bold",
    color: textMedium,
  });
  yPosition += 10;

  // Labor
  addText("Labor", leftMargin, yPosition, { fontSize: 10, color: textMedium });
  addText(`KES ${laborCost.toLocaleString()}`, rightMargin, yPosition, {
    fontSize: 10,
    color: textDark,
    align: "right",
  });
  yPosition += 7;

  // Materials (if any)
  if (materialsCost > 0) {
    addText("Materials", leftMargin, yPosition, { fontSize: 10, color: textMedium });
    addText(`KES ${materialsCost.toLocaleString()}`, rightMargin, yPosition, {
      fontSize: 10,
      color: textDark,
      align: "right",
    });
    yPosition += 7;
  }

  // Divider
  yPosition += 2;
  addLine(yPosition);
  yPosition += 8;

  // Subtotal
  addText("Subtotal", leftMargin, yPosition, { fontSize: 10, color: textMedium });
  addText(`KES ${subtotal.toLocaleString()}`, rightMargin, yPosition, {
    fontSize: 10,
    color: textDark,
    align: "right",
  });
  yPosition += 7;

  // Platform fee
  addText(`Platform Fee (${platformFeePercent}%)`, leftMargin, yPosition, {
    fontSize: 9,
    color: textLight,
  });
  addText(`KES ${platformFee.toLocaleString()}`, rightMargin, yPosition, {
    fontSize: 9,
    color: textLight,
    align: "right",
  });
  yPosition += 5;

  // Divider
  addLine(yPosition);
  yPosition += 10;

  // Total
  addText("Total", leftMargin, yPosition, {
    fontSize: 14,
    fontStyle: "bold",
    color: textDark,
  });
  addText(`KES ${totalAmount.toLocaleString()}`, rightMargin, yPosition, {
    fontSize: 14,
    fontStyle: "bold",
    color: primaryColor,
    align: "right",
  });
  yPosition += 20;

  // ===== PAYMENT INFORMATION =====
  addText("PAYMENT INFORMATION", leftMargin, yPosition, {
    fontSize: 8,
    fontStyle: "bold",
    color: textMedium,
  });
  yPosition += 6;

  // Payment box
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(leftMargin, yPosition - 3, pageWidth - 40, 25, 2, 2, "F");

  // Status
  addText("Status", leftMargin + 5, yPosition + 5, {
    fontSize: 8,
    color: textLight,
  });
  const statusLabel = paymentStatus === "completed" ? "Paid" : 
                      paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1);
  const statusColor: [number, number, number] = paymentStatus === "completed" ? [34, 197, 94] : // green
                                                paymentStatus === "pending" ? [234, 179, 8] : // yellow
                                                [107, 114, 128]; // gray
  addText(statusLabel, leftMargin + 5, yPosition + 12, {
    fontSize: 10,
    fontStyle: "bold",
    color: statusColor,
  });

  // Method
  addText("Method", leftMargin + 50, yPosition + 5, {
    fontSize: 8,
    color: textLight,
  });
  addText(paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1), leftMargin + 50, yPosition + 12, {
    fontSize: 10,
    color: textDark,
  });

  // Reference (if any)
  if (job.payment_reference) {
    addText("Reference", leftMargin + 100, yPosition + 5, {
      fontSize: 8,
      color: textLight,
    });
    addText(job.payment_reference, leftMargin + 100, yPosition + 12, {
      fontSize: 9,
      color: textDark,
    });
  }

  yPosition += 40;

  // ===== FOOTER =====
  addLine(yPosition);
  yPosition += 10;

  addText("Thank you for using Masterful!", pageWidth / 2, yPosition, {
    fontSize: 10,
    color: textMedium,
    align: "center",
  });
  yPosition += 8;

  addText(
    `This invoice was generated on ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`,
    pageWidth / 2,
    yPosition,
    { fontSize: 8, color: textLight, align: "center" }
  );
  yPosition += 5;

  addText(`Job ID: ${job.id}`, pageWidth / 2, yPosition, {
    fontSize: 8,
    color: textLight,
    align: "center",
  });

  // Return as blob
  return doc.output("blob");
};

export const downloadInvoicePDF = (job: JobWithDetails, invoiceNumber?: string): void => {
  const blob = generateInvoicePDF({ job, invoiceNumber });
  const invNumber = invoiceNumber || `INV-${job.id.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
  
  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${invNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
