import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface AccountBookingsProps {
  userId: string;
}

const AccountBookings = ({ userId }: AccountBookingsProps) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, [userId]);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          *,
          providers!inner(
            profiles!inner(full_name)
          ),
          service_categories(name)
        `)
        .or(`customer_id.eq.${userId},provider_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching bookings:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-success";
      case "completed": return "bg-primary";
      case "cancelled": return "bg-destructive";
      default: return "bg-muted";
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center">Loading bookings...</div>
      </Card>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          No bookings yet
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking) => (
        <Card key={booking.id} className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold">
                {booking.service_categories?.name || "Unknown Service"}
              </h3>
              <p className="text-muted-foreground">
                Professional: {booking.providers?.display_name?.trim() 
                  || booking.providers?.business_name?.trim() 
                  || "Unknown"}
              </p>
            </div>
            <Badge className={getStatusColor(booking.status)}>
              {booking.status}
            </Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div>
              <span className="font-semibold">Date:</span>{" "}
              {format(new Date(booking.scheduled_date), "PPP p")}
            </div>
            <div>
              <span className="font-semibold">Address:</span>{" "}
              {booking.address}
            </div>
            {booking.notes && (
              <div>
                <span className="font-semibold">Notes:</span>{" "}
                {booking.notes}
              </div>
            )}
            <div className="pt-2 border-t">
              <span className="font-semibold">Total:</span>{" "}
              <span className="text-lg text-primary font-bold">
                ${booking.total_price}
              </span>
              {booking.is_rush && (
                <Badge variant="outline" className="ml-2">
                  Rush Job (+45%)
                </Badge>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default AccountBookings;
