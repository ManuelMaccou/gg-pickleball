import { Box, Flex, Text } from "@radix-ui/themes";
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Trash } from "lucide-react"
import { AvailabilityState } from "@/app/types/functionTypes";
import { useEffect, useState } from "react";
import { transformAvailabilityToBlocks } from "@/app/register/utils";

interface AvailabilitySelectionProps {
  onAvailabilityChange: (availabilityBlocks: { day: string; time: string }[]) => void;
  showAdditionalText?: boolean;
}

export default function AvailabilitySelection({ onAvailabilityChange, showAdditionalText = false }: AvailabilitySelectionProps) {

  const [availability, setAvailability] = useState<AvailabilityState>({});
  const [enabledDays, setEnabledDays] = useState<Record<string, boolean>>({});

  useEffect(() => {
    console.log("Availability:", availability)
    const availabilityBlocks = transformAvailabilityToBlocks(availability);

    console.log("Formatted availability:", availabilityBlocks)
  }, [availability])

  useEffect(() => {
    console.log("Enabled Days:", enabledDays)
  }, [enabledDays])

  useEffect(() => {
    const availabilityBlocks = transformAvailabilityToBlocks(availability);

    // Send availabilty to parent
    onAvailabilityChange(availabilityBlocks);
  }, [availability, onAvailabilityChange]);


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

  const updateTimeBlock = (day: string, index: number, field: "start" | "end", value: string) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: prev[day].map((block, i) =>
        i === index ? { ...block, [field]: value } : block
      ),
    }));
  };

  return (
    <Flex mt={'9'} direction={'column'} mb={'5'}>
        <Text as="p" size={'5'} weight={'bold'}>Availabilty</Text>
        {showAdditionalText && (
        <Text as="p" size={'3'}>
          Your availability settings are saved from your last selections, even if they appear empty. 
          To adjust your availability, make new selections.
        </Text>
      )}
        <Flex my={'6'} gap={'7'} direction={'column'}>

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

                {/* Separator Icon */}
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