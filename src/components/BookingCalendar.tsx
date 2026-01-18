import { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

interface BookingCalendarProps {
  onDateTimeSelect: (date: string) => void;
}

const BookingCalendar = ({ onDateTimeSelect }: BookingCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');

  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
  ];

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    if (selectedTime) {
      const dateTimeString = `${date.toISOString().split('T')[0]}T${selectedTime}`;
      onDateTimeSelect(dateTimeString);
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    if (selectedDate) {
      const dateTimeString = `${selectedDate.toISOString().split('T')[0]}T${time}`;
      onDateTimeSelect(dateTimeString);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Select Date</h3>
          <div className="flex justify-center">
            <Calendar
              onChange={handleDateChange as any}
              value={selectedDate}
              minDate={new Date()}
              className="border-0 rounded-lg"
            />
          </div>
        </div>

        {selectedDate && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Select Time
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {timeSlots.map((time) => (
                <Button
                  key={time}
                  variant={selectedTime === time ? 'default' : 'outline'}
                  onClick={() => handleTimeSelect(time)}
                  className="w-full"
                >
                  {time}
                </Button>
              ))}
            </div>
          </div>
        )}

        {selectedDate && selectedTime && (
          <div className="bg-accent/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">Selected appointment:</p>
            <p className="font-semibold">
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} at {selectedTime}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default BookingCalendar;
