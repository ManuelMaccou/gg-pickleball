import { Box, Flex, Text } from "@radix-ui/themes";
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Trash } from "lucide-react"
import { AvailabilityState, TimeBlock } from "@/app/types/functionTypes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { transformAvailabilityToBlocks } from "@/app/register/utils";

interface AvailabilitySelectionProps {
  onAvailabilityChange: (availabilityBlocks: { day: string; time: string }[]) => void;
  userAvailability?: Record<string, TimeBlock[]>;
}

export default function UpdatedAvailabilitySelection({ onAvailabilityChange, userAvailability }: AvailabilitySelectionProps) {

  const formattedUserAvailability = useMemo(() => {
    if (!userAvailability) return [];

    return Object.entries(userAvailability).flatMap(([day, timeBlocks]) =>
      timeBlocks.map((block) => ({
        day,
        time: `${block.start}-${block.end}`,
      }))
    );
  }, [userAvailability]);

  const convertTo24Hour = useCallback((time: string, period: string): string => {
    const [hourStr, minStr] = time.split(":"); // Keep hour mutable, min immutable
    let hour = Number(hourStr);
    const min = Number(minStr); // Ensure min is constant
  
    if (period === "pm" && hour !== 12 && (hour !== 11 && min !== 30)) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
  
    return `${hour}:${min.toString().padStart(2, "0")}`; // Ensure "HH:MM" format
  },[]);

  const isNextHalfHour = useCallback((time1: string, time2: string): boolean => {
    const parseTimeSlot = (time: string): { start: string; end: string; period: string } | null => {
      const match = time.match(/^(\d{1,2}):?(\d{2})?-(\d{1,2}):?(\d{2})?(am|pm)$/);
  
      if (!match) {
        console.log(`🚨 Failed to parse time: ${time}`);
        return null;
      }
  
      const [, startHour, startMin = "00", endHour, endMin = "00", period] = match;
  
      return {
        start: `${startHour}:${startMin}`, // e.g. "9:00"
        end: `${endHour}:${endMin}`, // e.g. "9:30"
        period, // "am" or "pm"
      };
    };
  
    const prev = parseTimeSlot(time1);
    const next = parseTimeSlot(time2);
  
    if (!prev || !next) return false;
  
    const prevEnd = convertTo24Hour(prev.end, prev.period);
    const nextStart = convertTo24Hour(next.start, next.period);
  
    const isSequential = prevEnd === nextStart;
  
    if (!isSequential) {
      console.log(`🚨 Non-sequential times: ${time1} -> ${time2}`);
    }
  
    return isSequential;
  }, [convertTo24Hour]);

  const sortTimeSlots = useCallback((a: string, b: string): number => {
    const extractTime = (time: string) => {
      const match = time.match(/^(\d{1,2}):?(\d{2})?-(\d{1,2}):?(\d{2})?(am|pm)$/);
      if (!match) return 0;
  
      const [, startHour, startMin = "00", , , period] = match;
      return new Date(`2000-01-01 ${convertTo24Hour(`${startHour}:${startMin}`, period)}`).getTime();
    };
  
    return extractTime(a) - extractTime(b);
  }, [convertTo24Hour]);

  const processAvailability = useCallback((availability: { day: string; time: string }[]): Record<string, TimeBlock[]> => {
    console.log("🔍 Raw Availability Data from DB:", availability);
  
    // ✅ Group availability by day
    const groupedAvailability = availability.reduce((acc, { day, time }) => {
      if (!acc[day]) acc[day] = [];
      acc[day].push(time);
      return acc;
    }, {} as Record<string, string[]>);
  
    console.log("📌 Grouped Availability:", groupedAvailability);
  
    const finalAvailability: Record<string, TimeBlock[]> = {};
  
    Object.entries(groupedAvailability).forEach(([day, times]) => {
      console.log(`🛠 Processing Availability for ${day}:`, times);
  
      // ✅ Sort the time slots before processing
      times.sort(sortTimeSlots);
  
      finalAvailability[day] = [];
      let currentBlock: TimeBlock | null = null;
  
      for (let i = 0; i < times.length; i++) {
        const timeSlot = times[i];
        const [start, end] = timeSlot.split("-");
  
        if (!currentBlock) {
          // ✅ Start a new block
          currentBlock = { start, end };
        } else {
          // ✅ Check if we should merge this slot into `currentBlock`
          if (isNextHalfHour(`${currentBlock.start}-${currentBlock.end}`, timeSlot)) {
            console.log(`✅ Merging ${currentBlock.start}-${currentBlock.end} with ${timeSlot}`);
            currentBlock.end = end; // Extend the existing block
          } else {
            console.log(`➕ New block created: ${currentBlock.start} - ${currentBlock.end}`);
            finalAvailability[day].push(currentBlock); // Save previous block
            currentBlock = { start, end }; // Start a new one
          }
        }
      }
  
      // ✅ Push the last block for the day
      if (currentBlock) {
        console.log(`✅ Final block for ${day}: ${currentBlock.start} - ${currentBlock.end}`);
        finalAvailability[day].push(currentBlock);
      }
    });
  
    console.log("✅ Final Merged Availability:", finalAvailability);
    return finalAvailability;
  }, [isNextHalfHour, sortTimeSlots]);

  const processedAvailability = useMemo(() => {
    return formattedUserAvailability.length ? processAvailability(formattedUserAvailability) : {};
  }, [formattedUserAvailability, processAvailability]);

  const [availability, setAvailability] = useState<AvailabilityState>(processedAvailability);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<{ day: string; time: string }[]>([]);
  const [enabledDays, setEnabledDays] = useState<Record<string, boolean>>(() =>
    Object.keys(processedAvailability).reduce((acc, day) => ({ ...acc, [day]: true }), {})
  );
  const [timeErrors, setTimeErrors] = useState<Record<string, Record<number, string>>>({});




  

  // ✅ Process `userAvailability` when received
  useEffect(() => {
    setAvailability(processedAvailability);
    setEnabledDays(Object.keys(processedAvailability).reduce((acc, day) => ({ ...acc, [day]: true }), {}));
  }, [processedAvailability]);


  useEffect(() => {
    const newAvailabilityBlocks = transformAvailabilityToBlocks(availability);
    if (JSON.stringify(availabilityBlocks) !== JSON.stringify(newAvailabilityBlocks)) {
      console.log("📢 Sending updated availability to parent:", newAvailabilityBlocks);
      setAvailabilityBlocks(newAvailabilityBlocks);
      onAvailabilityChange(newAvailabilityBlocks);
    }
  }, [availability, onAvailabilityChange, availabilityBlocks]);
  
  
  useEffect(() => {
    if (!userAvailability || Object.keys(userAvailability).length === 0) return;
  
    const newAvailability: AvailabilityState = {};
    const newEnabledDays: Record<string, boolean> = {};
  
    Object.entries(userAvailability).forEach(([day, blocks]) => {
      newEnabledDays[day] = true;
      newAvailability[day] = blocks.map((block) => ({
        start: block.start || "9:00 AM",
        end: block.end || "9:30 AM",
      }));
    });
  
    setAvailability(newAvailability);
    setEnabledDays(newEnabledDays);
  }, [userAvailability]);

  const timeOptions = Array.from({ length: 36 }, (_, index) => {
    const totalMinutes = (6 * 60) + index * 30; // Start from 6:00 AM
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60 === 0 ? "00" : "30";
    const period = hours < 12 ? "AM" : "PM";
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    const displayTime = `${displayHours}:${minutes} ${period}`;
  
    return {
      value: displayTime,
      label: displayTime,
    };
  });

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const toggleDay = (day: string, isEnabled: boolean) => {
    setEnabledDays((prev) => ({
      ...prev,
      [day]: isEnabled,
    }));
  
    setAvailability((prev) => {
      const updated = { ...prev };
      if (isEnabled) {
        updated[day] = [{ start: "9:00 AM", end: "9:30 AM" }];
      } else {
        delete updated[day];
      }
      return updated;
    });
  };

  const addTimeBlock = (day: string) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: [...(prev[day] || []), { start: "9:00 AM", end: "9:00 AM" }],
    }));
  };

  const removeTimeBlock = (day: string, index: number) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== index),
    }));
  };

  const updateTimeBlock = (day: string, index: number, field: "start" | "end", value: string) => {
    setAvailability((prev) => {
      const updatedAvailability = { ...prev };
      updatedAvailability[day] = [...updatedAvailability[day]];
      const newBlock = {
        ...updatedAvailability[day][index],
        [field]: value,
      };

      const startDate = new Date(`1970-01-01 ${newBlock.start}`);
      const endDate = new Date(`1970-01-01 ${newBlock.end}`);

      setTimeErrors((prevErrors) => {
        const updatedErrors = { ...prevErrors };

        if (startDate >= endDate) {
          if (!updatedErrors[day]) updatedErrors[day] = {};
          updatedErrors[day][index] = "Start time must be before end time.";
        } else {
          if (updatedErrors[day]) {
            delete updatedErrors[day][index];
            if (Object.keys(updatedErrors[day]).length === 0) {
              delete updatedErrors[day];
            }
          }
        }
        return updatedErrors;
      });

      if (startDate >= endDate) return prev;

      updatedAvailability[day][index] = newBlock;
      return updatedAvailability;
    });
  };

  return (
    <Flex mt={'9'} direction={'column'} mb={'5'}>
        <Text as="p" size={'5'} weight={'bold'}>Set Availabilty</Text>
        <Flex my={'5'} gap={'7'} direction={'column'}>

        {daysOfWeek.map((day) => (
          <Flex key={day} gap="5" direction="column">
            <Flex gap="5">
            <Switch
                id={day.toLowerCase()}
                checked={enabledDays[day] || false}
                onCheckedChange={(checked) => toggleDay(day, checked)}
              />
              <Label htmlFor={day.toLowerCase()} style={{ fontSize: "20px" }}>
                {day}
              </Label>
            </Flex>

            {enabledDays[day] && availability[day]?.map((block, index) => (
              <Flex key={index} justify="between" direction="row" align="center" gap="3">

                {/* Start Time Select */}
                <Select
                  onValueChange={(value) =>
                    updateTimeBlock(day, index, "start", value)
                  }
                  value={block.start || "9:00 AM"}
                >
                  <SelectTrigger className="text-lg w-[140px] sm:w-[180px]">
                    <SelectValue>{block.start || "Select Start Time"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="text-2xl">
                    {timeOptions.map((time) => (
                      <SelectItem key={time.value} value={time.value} className="text-xl">
                        {time.label}
                      </SelectItem>
                    ))}

                    {timeErrors[day]?.[index] && (
                      <Text color="red">{timeErrors[day]?.[index]}</Text>
                    )}

                  </SelectContent>
                </Select>

                {/* Separator Icon */}
                <Box>
                  <Minus color="#ffffff" />
                </Box>

                {/* End Time Select */}
                <Select
                  onValueChange={(value) => updateTimeBlock(day, index, "end", value)}
                  value={block.end || "9:30 AM"}
                >
                  <SelectTrigger className="text-lg w-[140px] sm:w-[180px]">
                    <SelectValue>{block.end || "Select End Time"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="text-2xl">
                    {timeOptions.map((time) => (
                      <SelectItem key={time.value} value={time.value} className="text-xl">
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
               
                {/* Dynamic Icon Based on Index */}
                <div className="cursor-pointer">
                  {index === 0 ? (
                    <Plus
                      color="#ffffff"
                      className="cursor-pointer"
                      onClick={() => addTimeBlock(day)}
                    />
                  ) : (
                    <Trash
                      color="#d80000"
                      className="cursor-pointer"
                      onClick={() => removeTimeBlock(day, index)}
                    />
                  )}
                </div>
              </Flex>
            ))}
          </Flex>
        ))}



        </Flex>
      </Flex>

  )
}