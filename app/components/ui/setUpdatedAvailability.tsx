import { Box, Flex, Text } from "@radix-ui/themes";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Trash } from "lucide-react";
import { AvailabilityState } from "@/app/types/functionTypes";
import { useEffect, useState } from "react";
import { transformAvailabilityToBlocks } from "@/app/register/utils";

// --- Helper Functions ---

// Converts a time string (e.g., "5:30pm" or "9:00 AM") to minutes from midnight.
function timeToMinutes(timeStr: string): number {
  timeStr = timeStr.toLowerCase().trim();
  const match = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (!match) {
    console.error("Invalid time format", timeStr);
    return 0;
  }
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3];
  if (period === "pm" && hours < 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

// Converts minutes from midnight into a formatted string like "5:30 AM".
function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours < 12 || hours === 24 ? "AM" : "PM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes === 0 ? "00" : minutes.toString().padStart(2, "0");
  return `${displayHours}:${displayMinutes} ${period}`;
}

// Modified merging function that handles missing AM/PM on the start time.
function mergeDatabaseAvailability(data: { day: string; time: string }[]) {
  const periodRegex = /am|pm/i;
  // Parse each record into a structured interval.
  const parsed = data.map((entry) => {
    const [rawStart, rawEnd] = entry.time.split("-");
    const startTrim = rawStart.trim();
    const endTrim = rawEnd.trim();
    const startHasPeriod = periodRegex.test(startTrim);
    const endHasPeriod = periodRegex.test(endTrim);
    let startTimeStr = "";
    let startMinutes = 0;
    // If start is missing period but end has one, try appending end's indicator.
    if (!startHasPeriod && endHasPeriod) {
      let fallback = rawEnd.match(periodRegex)![0].toUpperCase();
      let tentativeStr = `${startTrim} ${fallback}`;
      let tentativeMinutes = timeToMinutes(tentativeStr);
      const endMinutes = timeToMinutes(endTrim);
      // If the tentative start is later than the end, flip the fallback.
      if (tentativeMinutes > endMinutes) {
        fallback = fallback === "AM" ? "PM" : "AM";
        tentativeStr = `${startTrim} ${fallback}`;
        tentativeMinutes = timeToMinutes(tentativeStr);
      }
      startTimeStr = tentativeStr;
      startMinutes = tentativeMinutes;
    } else {
      // Otherwise, use the start time as is.
      startTimeStr = startTrim;
      startMinutes = timeToMinutes(startTimeStr);
    }
    // For end time, assume it has a period.
    const endTimeStr = endTrim;
    const endMinutes = timeToMinutes(endTimeStr);
    return {
      day: entry.day,
      start: startMinutes,
      end: endMinutes,
    };
  });

  // Group intervals by day.
  const grouped: { [day: string]: typeof parsed } = {};
  parsed.forEach((entry) => {
    if (!grouped[entry.day]) {
      grouped[entry.day] = [];
    }
    grouped[entry.day].push(entry);
  });

  // For each day, sort intervals and merge sequential ones.
  const merged: { [day: string]: { start: string; end: string }[] } = {};
  for (const day in grouped) {
    const intervals = grouped[day].sort((a, b) => a.start - b.start);
    const mergedIntervals: { start: string; end: string }[] = [];
    let current = intervals[0];
    for (let i = 1; i < intervals.length; i++) {
      // If the current interval's end equals the next interval's start, merge them.
      if (current.end === intervals[i].start) {
        current.end = intervals[i].end;
      } else {
        mergedIntervals.push({
          start: formatMinutes(current.start),
          end: formatMinutes(current.end),
        });
        current = intervals[i];
      }
    }
    mergedIntervals.push({
      start: formatMinutes(current.start),
      end: formatMinutes(current.end),
    });
    merged[day] = mergedIntervals;
  }
  return merged;
}

// --- Component Interface ---

interface AvailabilitySelectionProps {
  onAvailabilityChange: (availabilityBlocks: { day: string; time: string }[]) => void;
  userId: string;
  showAdditionalText?: boolean;
}

export default function AvailabilitySelection({
  onAvailabilityChange,
  userId,
  showAdditionalText = false,
}: AvailabilitySelectionProps) {
  const [availability, setAvailability] = useState<AvailabilityState>({});
  const [enabledDays, setEnabledDays] = useState<Record<string, boolean>>({});

  // Fetch availability data from the database via the API.
  useEffect(() => {
    async function fetchAvailability() {
      try {
        const res = await fetch(`/api/users/userId/${userId}`);
        if (!res.ok) {
          console.error("Failed to fetch user availability");
          return;
        }
        const data = await res.json();
        // Assume the API returns a user object with an "availability" field.
        const userAvailability = data.user.availability;
        if (userAvailability && userAvailability.length > 0) {
          const merged = mergeDatabaseAvailability(userAvailability);
          setAvailability(merged);
          // Enable days that have availability.
          const enabled: Record<string, boolean> = {};
          Object.keys(merged).forEach((day) => {
            enabled[day] = true;
          });
          setEnabledDays(enabled);
        }
      } catch (error) {
        console.error("Error fetching availability:", error);
      }
    }
    if (userId) {
      fetchAvailability();
    }
  }, [userId]);

  useEffect(() => {
    console.log("Availability:", availability);
    const availabilityBlocks = transformAvailabilityToBlocks(availability);
    console.log("Formatted availability:", availabilityBlocks);
  }, [availability]);

  useEffect(() => {
    console.log("Enabled Days:", enabledDays);
  }, [enabledDays]);

  useEffect(() => {
    const availabilityBlocks = transformAvailabilityToBlocks(availability);
    // Send availability to parent.
    onAvailabilityChange(availabilityBlocks);
  }, [availability, onAvailabilityChange]);

  // Create time options for the dropdown (from 6:00 AM onward).
  const timeOptions = Array.from({ length: 36 }, (_, index) => {
    const totalMinutes = 6 * 60 + index * 30; // Start from 6:00 AM.
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

  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const toggleDay = (day: string, isEnabled: boolean) => {
    setEnabledDays((prev) => ({
      ...prev,
      [day]: isEnabled,
    }));
    if (isEnabled) {
      setAvailability((prev) => ({
        ...prev,
        [day]: [{ start: "9:00 AM", end: "9:00 AM" }],
      }));
    } else {
      setAvailability((prev) => {
        const updated = { ...prev };
        delete updated[day];
        return updated;
      });
    }
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

  const updateTimeBlock = (
    day: string,
    index: number,
    field: "start" | "end",
    value: string
  ) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: prev[day].map((block, i) =>
        i === index ? { ...block, [field]: value } : block
      ),
    }));
  };

  return (
    <Flex mt={"9"} direction={"column"} mb={"5"}>
      <Text as="p" size={"5"} weight={"bold"}>
        Availabilty
      </Text>
      {showAdditionalText && (
        <Text as="p" size={"3"}>
          Your availability settings are saved from your last selections, even if they appear empty.
          To adjust your availability, make new selections.
        </Text>
      )}
      <Flex my={"6"} gap={"7"} direction={"column"}>
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
            {enabledDays[day] &&
              availability[day]?.map((block, index) => (
                <Flex key={index} justify="between" direction="row" align="center" gap="3">
                  {/* Start Time Select */}
                  <Select
                    onValueChange={(value) => updateTimeBlock(day, index, "start", value)}
                    value={block.start}
                  >
                    <SelectTrigger className="text-lg w-[140px] sm:w-[180px]">
                      <SelectValue placeholder="9:00 AM" />
                    </SelectTrigger>
                    <SelectContent className="text-2xl">
                      {timeOptions.map((time) => (
                        <SelectItem key={time.value} value={time.value} className="text-xl">
                          {time.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Box>
                    <Minus color="#ffffff" />
                  </Box>
                  {/* End Time Select */}
                  <Select
                    onValueChange={(value) => updateTimeBlock(day, index, "end", value)}
                    value={block.end}
                  >
                    <SelectTrigger className="text-lg w-[140px] sm:w-[180px]">
                      <SelectValue placeholder="9:00 AM" />
                    </SelectTrigger>
                    <SelectContent className="text-2xl">
                      {timeOptions.map((time) => (
                        <SelectItem key={time.value} value={time.value} className="text-xl">
                          {time.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
  );
}
