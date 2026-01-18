/**
 * Invoice Preview Component
 * Displays a professional invoice with Masterful branding
 */

import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { JobWithDetails } from "@/types/pro-dashboard";

interface InvoicePreviewProps {
  job: JobWithDetails;
  invoiceNumber?: string;
}

export const InvoicePreview = ({ job, invoiceNumber }: InvoicePreviewProps) => {
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

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      pending: {
        className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
        label: "Pending",
      },
      processing: {
        className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        label: "Processing",
      },
      completed: {
        className: "bg-green-500/10 text-green-600 border-green-500/20",
        label: "Paid",
      },
      failed: {
        className: "bg-red-500/10 text-red-600 border-red-500/20",
        label: "Failed",
      },
    };

    const variant = variants[status] || variants.pending;

    return (
      <Badge className={`border ${variant.className}`}>
        {variant.label}
      </Badge>
    );
  };

  return (
    <div className="bg-white text-gray-900 p-6 sm:p-8 rounded-lg max-w-2xl mx-auto" id="invoice-content">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            MASTERFUL
          </h1>
          <p className="text-sm text-gray-500 mt-1">Professional Services Platform</p>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-2xl font-bold text-[#D9743A]">INVOICE</div>
          <p className="text-sm text-gray-500 mt-1">{invNumber}</p>
        </div>
      </div>

      <Separator className="mb-6" />

      {/* Invoice Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Bill To
          </h3>
          <p className="font-semibold text-gray-900">
            {job.customer?.profiles?.full_name || "Customer"}
          </p>
          {job.customer?.profiles?.phone && (
            <p className="text-sm text-gray-600">{job.customer.profiles.phone}</p>
          )}
          {job.address && (
            <p className="text-sm text-gray-600 mt-1">{job.address}</p>
          )}
        </div>
        <div className="sm:text-right">
          <div className="mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Invoice Date
            </h3>
            <p className="text-gray-900">{format(new Date(), "MMMM d, yyyy")}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Service Date
            </h3>
            <p className="text-gray-900">
              {job.scheduled_date
                ? format(new Date(job.scheduled_date), "MMMM d, yyyy")
                : "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Service Details */}
      <div className="mb-8">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Service Details
        </h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-gray-900">
                {job.service_category?.name || "Service"}
              </p>
              {job.notes && (
                <p className="text-sm text-gray-600 mt-1">{job.notes}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Breakdown */}
      <div className="mb-8">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Pricing Breakdown
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between text-gray-700">
            <span>Labor</span>
            <span>KES {laborCost.toLocaleString()}</span>
          </div>
          {materialsCost > 0 && (
            <div className="flex justify-between text-gray-700">
              <span>Materials</span>
              <span>KES {materialsCost.toLocaleString()}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-gray-700">
            <span>Subtotal</span>
            <span>KES {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-gray-500 text-sm">
            <span>Platform Fee ({platformFeePercent}%)</span>
            <span>KES {platformFee.toLocaleString()}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold text-lg text-gray-900">
            <span>Total</span>
            <span className="text-[#D9743A]">KES {totalAmount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Payment Information */}
      <div className="mb-8">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Payment Information
        </h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              {getPaymentStatusBadge(paymentStatus)}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Method</p>
              <p className="font-medium text-gray-900 capitalize">{paymentMethod}</p>
            </div>
            {job.payment_reference && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Reference</p>
                <p className="font-medium text-gray-900 text-sm">{job.payment_reference}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t pt-6 text-center">
        <p className="text-sm text-gray-500">
          Thank you for using Masterful!
        </p>
        <p className="text-xs text-gray-400 mt-2">
          This invoice was generated on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Job ID: {job.id}
        </p>
      </div>
    </div>
  );
};

export default InvoicePreview;
