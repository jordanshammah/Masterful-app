/**
 * Invoice Modal Component
 * Modal wrapper for viewing and downloading invoices
 */

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileText, Loader2 } from "lucide-react";
import { InvoicePreview } from "./InvoicePreview";
import { downloadInvoicePDF } from "@/lib/utils/invoice-pdf";
import { useToast } from "@/hooks/use-toast";
import type { JobWithDetails } from "@/types/pro-dashboard";

interface InvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobWithDetails;
}

export const InvoiceModal = ({ open, onOpenChange, job }: InvoiceModalProps) => {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  // Generate consistent invoice number
  const invoiceNumber = useMemo(() => {
    return `INV-${job.id.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
  }, [job.id]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      downloadInvoicePDF(job, invoiceNumber);
      toast({
        title: "Invoice Downloaded",
        description: `Invoice ${invoiceNumber} has been downloaded successfully.`,
      });
    } catch (error) {
      console.error("Failed to download invoice:", error);
      toast({
        title: "Download Failed",
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#050505] border-white/10 text-white w-[95vw] max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#D9743A]/20 rounded-lg">
              <FileText className="w-5 h-5 text-[#D9743A]" />
            </div>
            <div>
              <DialogTitle className="text-xl">Invoice Preview</DialogTitle>
              <DialogDescription className="text-white/60">
                {invoiceNumber}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Invoice Content */}
        <ScrollArea className="flex-1 px-4 sm:px-6">
          <div className="py-4">
            <InvoicePreview job={job} invoiceNumber={invoiceNumber} />
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 sm:p-6 pt-4 border-t border-white/10">
          <Button
            variant="outline"
            className="flex-1 border-white/10 text-white hover:bg-white/10"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            className="flex-1 bg-[#D9743A] hover:bg-[#C25A2C] text-black font-semibold"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceModal;
