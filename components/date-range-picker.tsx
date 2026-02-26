'use client';

import * as React from 'react';
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarIcon, Clock } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DateRangePickerProps {
  value: { range: string; startAt?: number; endAt?: number };
  onChange: (value: { range: string; startAt?: number; endAt?: number }) => void;
}

const presetOptions = [
  { value: '24h', label: '过去 24 小时' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: '7', label: '过去 7 天' },
  { value: '30', label: '过去 30 天' },
  { value: '90', label: '过去 90 天' },
  { value: 'custom', label: '自定义范围' },
];

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>(
    value.startAt && value.endAt
      ? { from: new Date(value.startAt), to: new Date(value.endAt) }
      : undefined
  );
  const [isCustom, setIsCustom] = React.useState(value.range === 'custom');

  const handlePresetChange = (preset: string) => {
    setIsCustom(preset === 'custom');
    
    if (preset === 'custom') {
      // Keep current date range if switching to custom
      if (date?.from && date?.to) {
        onChange({
          range: 'custom',
          startAt: date.from.getTime(),
          endAt: date.to.getTime(),
        });
      }
      return;
    }
    
    onChange({ range: preset });
  };

  const handleDateSelect = (newDate: DateRange | undefined) => {
    setDate(newDate);
    if (newDate?.from && newDate?.to) {
      onChange({
        range: 'custom',
        startAt: startOfDay(newDate.from).getTime(),
        endAt: endOfDay(newDate.to).getTime(),
      });
    }
  };

  const getDisplayText = () => {
    if (value.range === 'custom' && value.startAt && value.endAt) {
      return `${format(value.startAt, 'MM/dd')} - ${format(value.endAt, 'MM/dd')}`;
    }
    const option = presetOptions.find(o => o.value === value.range);
    return option?.label || '选择时间范围';
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={value.range} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[160px] bg-white">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <SelectValue>{getDisplayText()}</SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent>
          {presetOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isCustom && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'justify-start text-left font-normal bg-white',
                !date && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, 'yyyy-MM-dd')} -{' '}
                    {format(date.to, 'yyyy-MM-dd')}
                  </>
                ) : (
                  format(date.from, 'yyyy-MM-dd')
                )
              ) : (
                <span>选择日期范围</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={handleDateSelect}
              numberOfMonths={2}
              locale={zhCN}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
