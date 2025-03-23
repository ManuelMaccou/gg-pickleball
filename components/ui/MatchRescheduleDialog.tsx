"use client";

import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { IAvailability, ICourt } from "@/app/types/databaseTypes";



interface MatchRescheduleDialogProps {
  team1Availability: IAvailability[];
  team2Availability: IAvailability[];
  courts: ICourt[];
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: (selectedCourt: ICourt, selectedTimeDate: { day: string;  date: string; time: string }) => void;
}

const MatchRescheduleDialog: React.FC<MatchRescheduleDialogProps> = ({ 
  team1Availability, 
  team2Availability, 
  courts, 
  onConfirm,
  open,
  setOpen
}) => {
  const [selectedCourt, setSelectedCourt] = useState<ICourt | undefined>();
  const [selectedTimeDate, setSelectedTimeDate] = useState<{ time: string; day: string; date: string } | undefined>();
  const [availableTimes, setAvailableTimes] = useState<{ day: string; date: string; time: string }[]>([]);

   // Update time slots when a court is selected
   useEffect(() => {
    if (!selectedCourt) {
      setAvailableTimes([]);
      setSelectedTimeDate(undefined);
      return;
    }

    const formatToTwoHourBlock = (timeSlot: string): string => {
      const match = timeSlot.match(/^(\d{1,2}):?(\d{2})?-(\d{1,2}):?(\d{2})?(am|pm)$/);
      if (!match) return "";
  
      const [ , startHourStr, startMin, , , suffix ] = match;
      const startHour = parseInt(startHourStr, 10);

      const startMinutesStr = startMin ? `:${startMin}` : "";
      const endMinutesStr = startMin === "30" ? ":30" : ""; 

      const endHour = startHour + 2 > 12 ? (startHour + 2) - 12 : startHour + 2;
      const endSuffix = startHour >= 10 && suffix === "am" ? "pm" : suffix;
  
      return `${startHour}${startMinutesStr}-${endHour}${endMinutesStr}${endSuffix}`;
    };

    const findTwoHourBlocks = (
      teamSlots: { day: string; time: string }[],
      courtSlots: { day: string; date: string; time: string }[]
    ) => {
      console.log("🔍 Running `findTwoHourBlocks`");
    
      // ✅ Extract valid consecutive 2-hour blocks **first**
      const validTeamBlocks = getConsecutiveBlocks(teamSlots);
      const validCourtBlocks = getConsecutiveBlocks(courtSlots);
    
      console.log("🟠 Valid Team Blocks:", validTeamBlocks);
      console.log("🏟️ Valid Court Blocks:", validCourtBlocks);
    
      // ✅ Find shared availability across all lists
      const finalMatches = validTeamBlocks
        .map(slot => {
          const matchingCourtSlot = validCourtBlocks.find(
            courtSlot => courtSlot.time === slot.time && courtSlot.day === slot.day
          );

          return matchingCourtSlot
            ? { day: slot.day, time: slot.time, date: matchingCourtSlot.date }
            : null;
        })
        .filter(Boolean) as { day: string; time: string; date: string }[];
  
      console.log("✅ Final Matches:", finalMatches);
      return finalMatches;
    }; 
    
  
    const getConsecutiveBlocks = (slots: { day: string; time: string, date?: string; }[]) => {
      const validBlocks: { day: string; time: string; date?: string }[] = [];
      
      // Group slots by day
      const slotsByDay = slots.reduce((acc, slot) => {
        if (!acc[slot.day]) acc[slot.day] = [];
        acc[slot.day].push({ time: slot.time, date: slot.date });
        return acc;
      }, {} as Record<string, { time: string; date?: string }[]>);
    
      for (const day in slotsByDay) {
        const timesWithDates = slotsByDay[day];
    
        for (let i = 0; i <= timesWithDates.length - 4; i++) {
          const block = timesWithDates.slice(i, i + 4);
          if (isConsecutive(block.map(b => b.time))) {
    
            // ✅ Store `date` as well
            validBlocks.push({ 
              day, 
              time: block[0].time, 
              date: block[0].date ?? "" // was previously "Unknown Date"
            });
          }
        }
      }
    
      console.log("Valid blocks:", validBlocks);
      return validBlocks;
    };
    
  
    const isConsecutive = (times: string[]): boolean => {
      if (times.length < 2) return false;
      for (let i = 0; i < times.length - 1; i++) {
        if (!isNextHalfHour(times[i], times[i + 1])) {
          console.log(`🚨 Non-consecutive slots found: ${times[i]} -> ${times[i + 1]}`);
          return false;
        }
      }
      return true;
    };    
  
    const isNextHalfHour = (time1: string, time2: string): boolean => {
      const extractTimeParts = (time: string): { start: string; end: string; period: string } | null => {
        const match = time.match(/^(\d{1,2}):?(\d{2})?-(\d{1,2}):?(\d{2})?(am|pm)$/);
        if (!match) return null;
    
        const [ , startHour, startMin = "00", endHour, endMin = "00", period] = match;
    
        return {
          start: `${startHour}:${startMin}`, // e.g. "10:30"
          end: `${endHour}:${endMin}`, // e.g. "11:00"
          period // "am" or "pm"
        };
      };
    
      const prev = extractTimeParts(time1);
      // console.log('prev:', prev);
  
      const next = extractTimeParts(time2);
      // console.log('next:', next);
    
      if (!prev || !next) {
        console.log(`🚨 Failed to parse: ${time1} -> ${time2}`);
        return false;
      }
    
      // Convert both to 24-hour time for comparison
      const convertTo24Hour = (time: string, period: string): string => {
        const [hourStr, minStr] = time.split(":"); // Keep hour mutable, min immutable
        let hour = Number(hourStr);
        const min = Number(minStr); // Ensure min is constant
      
        if (period === "pm" && hour !== 12 && (hour !== 11 && min !== 30)) hour += 12;
        if (period === "am" && hour === 12) hour = 0;
      
        return `${hour}:${min.toString().padStart(2, "0")}`; // Ensure "HH:MM" format
      };
      
    
      const prevEnd = convertTo24Hour(prev.end, prev.period);
      const nextStart = convertTo24Hour(next.start, next.period);
      // console.log('prev end time:', prevEnd);
      // console.log('next start time:', nextStart);
    
      const isSequential = prevEnd === nextStart;
    
      if (!isSequential) {
        console.log(`🚨 Non-sequential times: ${time1} -> ${time2}`);
      }
    
      return isSequential;
    };

    // Find the selected court's availability
    const court = courts.find(c => c._id === selectedCourt._id);
    if (!court) return;

    // Find common times between both teams and the selected court
    const teamCommon = team1Availability.filter((slot) =>
      team2Availability.some((t2) => t2.day === slot.day && t2.time === slot.time)
    );

    const finalAvailability = teamCommon.filter((slot) =>
      court.availability.some((courtSlot) => courtSlot.day === slot.day && courtSlot.time === slot.time)
    );

    const teamSlots = finalAvailability.map((slot) => ({ 
      day: slot.day, 
      time: slot.time, 
      date: court.availability.find(courtSlot => courtSlot.day === slot.day && courtSlot.time === slot.time)?.date || "" 
    }));

    const courtSlots = court.availability.map((slot) => ({
      day: slot.day,
      time: slot.time,
      date: slot.date,
    }));

    const validTwoHourBlocks = findTwoHourBlocks(teamSlots, courtSlots);
    
    const formattedBlocks = validTwoHourBlocks.map((slot) => ({
      day: slot.day,
      time: formatToTwoHourBlock(slot.time),
      date: slot.date,
    }));

    setAvailableTimes(formattedBlocks);

  }, [selectedCourt, team1Availability, team2Availability, courts]);

  const filterTimes = (availability: { date: string; day: string; time: string }[], selectedCourt: { name: string } | null | undefined) => {
    if (!selectedCourt || selectedCourt.name !== "Pickle Pop") return availability;
  
    return availability.filter((slot) => {
      const startTime = slot.time.split("-")[0]; // Extract start time (e.g., "1:30")
      return !startTime.includes(":30"); // Exclude times that start with ":30"
    });
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild >
        <Button variant="outline" size="4" onClick={() => setOpen(true)}>Edit details</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Reschedule Match</DialogTitle>
        <DialogDescription style={{fontSize: '16px'}}>Select a new time and court.</DialogDescription>

           {/* Select Court */}
            <Text weight="bold">Select a court:</Text>
            <Select value={selectedCourt?._id} onValueChange={(courtId) => {
              const selectedCourtObject = courts.find(court => court._id === courtId);
              setSelectedCourt(selectedCourtObject || undefined);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a court" />
              </SelectTrigger>
              <SelectContent>
                {courts && courts.length > 0 ? (
                  courts.map((court) => (
                    <SelectItem key={court._id} value={court._id ?? ""}>
                      {court.name}
                    </SelectItem>
                  ))
                ) : (
                  <Text color="gray">No courts available</Text>
                )}
              </SelectContent>
            </Select>
     


          {/* Select Time */}
          
            <Text weight="bold">Select a new time:</Text>
            <Select
              value={selectedTimeDate ? JSON.stringify(selectedTimeDate) : undefined}
              onValueChange={(val) => setSelectedTimeDate(JSON.parse(val))}
              disabled={!selectedCourt || availableTimes.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={availableTimes.length > 0 ? 'Choose a time' : 'No available times'}/>
              </SelectTrigger>
              <SelectContent>
                {filterTimes(availableTimes, selectedCourt).map((slot, idx) => (
                  <SelectItem key={idx} value={JSON.stringify({ time: slot.time, date: slot.date, day: slot.day })}>
                    {`${slot.day}, ${new Date(slot.date).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric"
                    })}, ${slot.time}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>


         

          {/* Reschedule Button */}
          <Button style={{ paddingTop: '10px', paddingBottom: '10px', marginBottom: '20px', backgroundColor: !selectedCourt ? "lightgrey" : 'black', color: !selectedCourt ? "grey" : 'white'}}
            onClick={() => {
              if (selectedTimeDate && selectedCourt) {
                onConfirm(selectedCourt, selectedTimeDate);
              }
            }}
            disabled={!selectedTimeDate || !selectedCourt}
          >
            Reschedule
          </Button>
     

        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
};

export default MatchRescheduleDialog;
