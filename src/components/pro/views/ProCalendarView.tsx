/**
 * Pro Calendar View
 * Calendar view for providers to track scheduled jobs
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CalendarDays,
  Clock,
  MapPin,
  User,
  DollarSign,
  ChevronRight,
  Briefcase,
} from "lucide-react";
import { useProJobsEnhanced } from "@/hooks/useProEnhanced";
import { format, isSameDay, parseISO, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import type { JobWithDetails } from "@/types/pro-dashboard";

interface ProCalendarViewProps {
  providerId: string;
}

export const ProCalendarView = ({ providerId }: ProCalendarViewProps) => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const { data: allJobs, isLoading } = useProJobsEnhanced(providerId);

  // Group jobs by date
  const jobsByDate = useMemo(() => {
    if (!allJobs) return new Map<string, JobWithDetails[]>();
    
    const grouped = new Map<string, JobWithDetails[]>();
    allJobs.forEach((job) => {
      if (job.scheduled_date) {
        const dateKey = format(parseISO(job.scheduled_date), "yyyy-MM-dd");
        const existing = grouped.get(dateKey) || [];
        grouped.set(dateKey, [...existing, job]);
      }
    });
    return grouped;
  }, [allJobs]);

  // Get jobs for selected date
  const selectedDateJobs = useMemo(() => {
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return jobsByDate.get(dateKey) || [];
  }, [selectedDate, jobsByDate]);

  // Dates with jobs (for calendar indicators)
  const datesWithJobs = useMemo(() => {
    return Array.from(jobsByDate.keys()).map((dateStr) => parseISO(dateStr));
  }, [jobsByDate]);

  // Check if a date has jobs
  const hasJobsOnDate = (date: Date): boolean => {
    return datesWithJobs.some((d) => isSameDay(d, date));
  };

  // Get job count for a date
  const getJobCountForDate = (date: Date): number => {
    const dateKey = format(date, "yyyy-MM-dd");
    return jobsByDate.get(dateKey)?.length || 0;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      pending: {
        className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
        label: "Pending",
      },
      confirmed: {
        className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        label: "Confirmed",
      },
      in_progress: {
        className: "bg-[#C25A2C]/20 text-[#C25A2C] border-[#C25A2C]/20",
        label: "In Progress",
      },
      completed: {
        className: "bg-green-500/10 text-green-400 border-green-500/20",
        label: "Completed",
      },
      cancelled: {
        className: "bg-red-500/10 text-red-400 border-red-500/20",
        label: "Cancelled",
      },
    };

    const variant = variants[status] || variants.pending;

    return (
      <Badge className={cn("border text-xs", variant.className)}>
        {variant.label}
      </Badge>
    );
  };

  const handleViewJob = (jobId: string) => {
    navigate(`/dashboard/pro?view=jobs`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">Schedule</p>
            <h1 className="text-3xl font-semibold mt-2">Calendar</h1>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Card className="bg-[#050505] border-white/5 rounded-2xl">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-64 bg-white/5 rounded-lg" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#050505] border-white/5 rounded-2xl">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-white/5 rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Schedule</p>
          <h1 className="text-3xl font-semibold mt-2">Calendar</h1>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm text-white/50">
          <CalendarDays className="w-4 h-4" />
          <span>{format(new Date(), "MMMM yyyy")}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Calendar Card */}
        <Card className="bg-[#050505] border-white/5 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#D9743A]" />
              Select Date
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border-0 w-full"
              classNames={{
                months: "flex flex-col w-full",
                month: "space-y-4 w-full",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium text-white",
                nav: "space-x-1 flex items-center",
                nav_button: cn(
                  "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-white/10 rounded-md hover:bg-white/10"
                ),
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse",
                head_row: "flex w-full",
                head_cell:
                  "text-white/50 rounded-md flex-1 font-normal text-[0.8rem] text-center",
                row: "flex w-full mt-2",
                cell: cn(
                  "flex-1 text-center text-sm p-0 relative",
                  "[&:has([aria-selected])]:bg-[#D9743A]/20 rounded-md"
                ),
                day: cn(
                  "h-9 w-full p-0 font-normal text-white/80 hover:bg-white/10 rounded-md transition-colors",
                  "aria-selected:bg-[#D9743A] aria-selected:text-black aria-selected:font-semibold"
                ),
                day_selected: "bg-[#D9743A] text-black font-semibold hover:bg-[#D9743A]",
                day_today: "bg-white/10 text-white font-semibold",
                day_outside: "text-white/30 opacity-50",
                day_disabled: "text-white/20 opacity-50",
              }}
              modifiers={{
                hasJobs: (date) => hasJobsOnDate(date),
              }}
              modifiersClassNames={{
                hasJobs: "relative",
              }}
              components={{
                DayContent: ({ date }) => {
                  const jobCount = getJobCountForDate(date);
                  return (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <span>{date.getDate()}</span>
                      {jobCount > 0 && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#D9743A]" />
                      )}
                    </div>
                  );
                },
              }}
            />
            
            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10 text-xs text-white/50">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#D9743A]" />
                <span>Has jobs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white/20" />
                <span>Today</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Jobs for Selected Date */}
        <Card className="bg-[#050505] border-white/5 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#D9743A]" />
                {format(selectedDate, "EEEE, MMMM d")}
              </span>
              {selectedDateJobs.length > 0 && (
                <Badge className="bg-[#D9743A]/20 text-[#D9743A] border-[#D9743A]/30">
                  {selectedDateJobs.length} {selectedDateJobs.length === 1 ? "job" : "jobs"}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {selectedDateJobs.length === 0 ? (
              <div className="text-center py-12">
                <CalendarDays className="w-12 h-12 mx-auto mb-4 text-white/20" />
                <h3 className="font-semibold text-white/80 mb-2">No jobs scheduled</h3>
                <p className="text-sm text-white/50">
                  No jobs are scheduled for this date
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] lg:h-[450px] pr-4">
                <div className="space-y-3">
                  {selectedDateJobs.map((job) => (
                    <Card
                      key={job.id}
                      className="bg-[#0A0A0A] border-white/5 p-4 rounded-xl hover:border-white/10 transition-all cursor-pointer group"
                      onClick={() => handleViewJob(job.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4 text-white/40 flex-shrink-0" />
                            <span className="font-medium text-white truncate">
                              {job.customer?.profiles?.full_name || "Customer"}
                            </span>
                          </div>
                          <p className="text-sm text-white/50">
                            {job.service_category?.name || "Service"}
                          </p>
                        </div>
                        {getStatusBadge(job.status)}
                      </div>

                      <div className="space-y-2 text-sm">
                        {job.scheduled_time && (
                          <div className="flex items-center gap-2 text-white/60">
                            <Clock className="w-4 h-4 flex-shrink-0" />
                            <span>
                              {format(parseISO(job.scheduled_date), "h:mm a")}
                            </span>
                          </div>
                        )}
                        
                        {job.address && (
                          <div className="flex items-start gap-2 text-white/60">
                            <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{job.address}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/5">
                          <div className="flex items-center gap-2 text-white/80">
                            <DollarSign className="w-4 h-4 text-[#D9743A]" />
                            <span className="font-semibold">
                              {job.quote_total
                                ? `KES ${job.quote_total.toLocaleString()}`
                                : job.total_price
                                ? `KES ${job.total_price.toLocaleString()}`
                                : "Quote pending"}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-white/50 hover:text-white hover:bg-white/10 group-hover:text-[#D9743A]"
                          >
                            <span className="text-xs mr-1">View</span>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-[#050505] border-white/5 p-4 rounded-xl">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#D9743A]">
              {allJobs?.filter((j) => j.status === "pending").length || 0}
            </p>
            <p className="text-xs text-white/50 mt-1">Pending</p>
          </div>
        </Card>
        <Card className="bg-[#050505] border-white/5 p-4 rounded-xl">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-400">
              {allJobs?.filter((j) => j.status === "confirmed").length || 0}
            </p>
            <p className="text-xs text-white/50 mt-1">Confirmed</p>
          </div>
        </Card>
        <Card className="bg-[#050505] border-white/5 p-4 rounded-xl">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#C25A2C]">
              {allJobs?.filter((j) => j.status === "in_progress").length || 0}
            </p>
            <p className="text-xs text-white/50 mt-1">In Progress</p>
          </div>
        </Card>
        <Card className="bg-[#050505] border-white/5 p-4 rounded-xl">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">
              {allJobs?.filter((j) => j.status === "completed").length || 0}
            </p>
            <p className="text-xs text-white/50 mt-1">Completed</p>
          </div>
        </Card>
      </div>
    </div>
  );
};
