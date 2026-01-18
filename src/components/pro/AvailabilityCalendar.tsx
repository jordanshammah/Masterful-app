import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Job } from "@/lib/api/pro";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { format, isSameDay } from "date-fns";

export interface AvailabilityCalendarProps {
  jobsByDate: Record<string, Job[]>;
  onDateSelect?: (date: Date) => void;
  onAvailabilitySet?: (date: Date, available: boolean) => void;
  className?: string;
}

const AvailabilityCalendar = React.forwardRef<HTMLDivElement, AvailabilityCalendarProps>(
  ({ jobsByDate, onDateSelect, onAvailabilitySet, className }, ref) => {
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());

    const handleDateSelect = (date: Date | undefined) => {
      if (date) {
        setSelectedDate(date);
        onDateSelect?.(date);
      }
    };

    const getJobsForDate = (date: Date): Job[] => {
      const dateKey = format(date, "yyyy-MM-dd");
      return jobsByDate[dateKey] || [];
    };

    const dateHasJobs = (date: Date): boolean => {
      return getJobsForDate(date).length > 0;
    };

    const selectedDateJobs = selectedDate ? getJobsForDate(selectedDate) : [];

    return (
      <Card ref={ref} className={cn("bg-card/50 backdrop-blur-sm", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Calendar & Availability
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              className="rounded-md border-0"
              modifiers={{
                hasJobs: (date) => dateHasJobs(date),
              }}
              modifiersClassNames={{
                hasJobs: "bg-primary/10 relative",
              }}
            />
            <style>{`
              .rdp-day.hasJobs::after {
                content: '';
                position: absolute;
                bottom: 2px;
                left: 50%;
                transform: translateX(-50%);
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: hsl(var(--primary));
              }
            `}</style>
          </div>

          {selectedDate && (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">
                  {format(selectedDate, "EEEE, MMMM d, yyyy")}
                </h4>
                {selectedDateJobs.length > 0 && (
                  <Badge variant="secondary" className="bg-primary/20 text-primary">
                    {selectedDateJobs.length} {selectedDateJobs.length === 1 ? "job" : "jobs"}
                  </Badge>
                )}
              </div>

              {selectedDateJobs.length > 0 ? (
                <div className="space-y-2">
                  {selectedDateJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                    >
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {job.customers?.profiles?.full_name || "Customer"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {job.service_categories?.name || "Service"}
                        </p>
                      </div>
                      <Badge
                        variant={
                          job.status === "confirmed"
                            ? "default"
                            : job.status === "in_progress"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {job.status.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No jobs scheduled for this date
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onAvailabilitySet?.(selectedDate, true)}
                >
                  Set Available
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onAvailabilitySet?.(selectedDate, false)}
                >
                  Set Unavailable
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);
AvailabilityCalendar.displayName = "AvailabilityCalendar";

export { AvailabilityCalendar };
