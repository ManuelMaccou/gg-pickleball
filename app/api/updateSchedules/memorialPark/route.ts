import { NextResponse } from "next/server";
import Court from "@/app/models/Court";
import connectToDatabase from "@/lib/mongodb";
import { IAvailability } from "@/app/types/databaseTypes";

const COURT_ID = "67d3436c3a795dc67a9a38d7";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
const TIME_SLOTS: Record<string, string[]> = {
  Monday: [
    "8-8:30am", "8:30-9am", "9-9:30am", "9:30-10am", "10-10:30am", "10:30-11am",
    "11-11:30am", "11:30-12pm", "5-5:30pm", "5:30-6pm", "6-6:30pm", "6:30-7pm",
    "7-7:30pm", "7:30-8pm", "8-8:30pm", "8:30-9pm", "9-9:30pm",
  ],
  Tuesday: ["8-8:30am", "8:30-9am", "9-9:30am", "9:30-10am", "10-10:30am", "10:30-11am", "11-11:30am", "11:30-12pm"],
  Wednesday: [
    "8-8:30am", "8:30-9am", "9-9:30am", "9:30-10am", "10-10:30am", "10:30-11am",
    "11-11:30am", "11:30-12pm", "5-5:30pm", "5:30-6pm", "6-6:30pm", "6:30-7pm",
    "7-7:30pm", "7:30-8pm", "8-8:30pm", "8:30-9pm", "9-9:30pm",
  ],
  Thursday: ["8-8:30am", "8:30-9am", "9-9:30am", "9:30-10am", "10-10:30am", "10:30-11am", "11-11:30am", "11:30-12pm"],
  Friday: ["8-8:30am", "8:30-9am", "9-9:30am", "9:30-10am", "10-10:30am", "10:30-11am", "11-11:30am", "11:30-12pm"],
  Saturday: [
    "8-8:30am", "8:30-9am", "9-9:30am", "9:30-10am", "10-10:30am", "10:30-11am",
    "11-11:30am", "11:30-12pm", "12-12:30pm", "12:30-1pm", "1-1:30pm", "1:30-2pm",
    "2:15-2:30pm", "2:30-2:45pm", "2:45-3pm", "3-3:15pm", "3:15-3:30pm", "3:30-3:45pm",
    "3:45-4pm", "4-4:15pm", "4:15-4:30pm", "4:30-4:45pm", "4:45-5pm", "5-5:15pm",
    "5:15-5:30pm", "5:30-5:45pm", "5:45-6pm"
  ],
  Sunday: [
    "8-8:30am", "8:30-9am", "9-9:30am", "9:30-10am", "10-10:30am", "10:30-11am",
    "11-11:30am", "11:30-12pm", "12-12:30pm", "12:30-1pm", "1-1:30pm", "1:30-2pm",
    "2:15-2:30pm", "2:30-2:45pm", "2:45-3pm", "3-3:15pm", "3:15-3:30pm", "3:30-3:45pm",
    "3:45-4pm", "4-4:15pm", "4:15-4:30pm", "4:30-4:45pm", "4:45-5pm", "5-5:15pm",
    "5:15-5:30pm", "5:30-5:45pm", "5:45-6pm"
  ],
};
 */
const TIME_SLOTS: Record<string, string[]> = {
  Monday: [
    "5-5:30pm", "5:30-6pm", "6-6:30pm", "6:30-7pm",
    "7-7:30pm", "7:30-8pm", "8-8:30pm", "8:30-9pm", "9-9:30pm",
  ],
  Tuesday: [],
  Wednesday: [
    "5-5:30pm", "5:30-6pm", "6-6:30pm", "6:30-7pm",
    "7-7:30pm", "7:30-8pm", "8-8:30pm", "8:30-9pm", "9-9:30pm",
  ],
  Thursday: [],
  Friday: [],
  Saturday: [
    "8-8:30am", "8:30-9am", "9-9:30am", "9:30-10am", "10-10:30am", "10:30-11am",
    "11-11:30am", "11:30-12pm", "12-12:30pm", "12:30-1pm", "1-1:30pm", "1:30-2pm",
    "2:15-2:30pm", "2:30-2:45pm", "2:45-3pm", "3-3:15pm", "3:15-3:30pm", "3:30-3:45pm",
    "3:45-4pm", "4-4:15pm", "4:15-4:30pm", "4:30-4:45pm", "4:45-5pm", "5-5:15pm",
    "5:15-5:30pm", "5:30-5:45pm", "5:45-6pm"
  ],
  Sunday: [
    "8-8:30am", "8:30-9am", "9-9:30am", "9:30-10am", "10-10:30am", "10:30-11am",
    "11-11:30am", "11:30-12pm", "12-12:30pm", "12:30-1pm", "1-1:30pm", "1:30-2pm",
    "2:15-2:30pm", "2:30-2:45pm", "2:45-3pm", "3-3:15pm", "3:15-3:30pm", "3:30-3:45pm",
    "3:45-4pm", "4-4:15pm", "4:15-4:30pm", "4:30-4:45pm", "4:45-5pm", "5-5:15pm",
    "5:15-5:30pm", "5:30-5:45pm", "5:45-6pm"
  ],
};

const generateNext7Days = (): IAvailability[] => {
  // ⬇️ Hardcoded first 7 days (March 16, 2025 - March 22, 2025)
  const firstWeek = [
    { date: "2025-03-16", day: "Sunday" },
    { date: "2025-03-17", day: "Monday" },
    { date: "2025-03-18", day: "Tuesday" },
    { date: "2025-03-19", day: "Wednesday" },
    { date: "2025-03-20", day: "Thursday" },
    { date: "2025-03-21", day: "Friday" },
    { date: "2025-03-22", day: "Saturday" },
  ];

  const newSchedule: IAvailability[] = [];

  for (const { date, day } of firstWeek) {
    // ✅ Use hardcoded date & day instead of dynamically calculating
    const slots = TIME_SLOTS[day];

    if (!slots || slots.length === 0) continue;

    const dailySlots: IAvailability[] = TIME_SLOTS[day].map((time) => ({
      day,
      time,
      date, // ✅ Uses pre-defined date instead of `new Date()`
      available: true,
    }));

    newSchedule.push(...dailySlots);
  }

  return newSchedule;
};


const shiftAvailability = (availability: IAvailability[]): IAvailability[] => {
  if (availability.length === 0) return [];

  const oldestDateStr = availability.reduce(
    (earliest, slot) => (slot.date < earliest ? slot.date : earliest),
    availability[0].date
  );

  if (!oldestDateStr) {
    console.error("Error: No valid oldest date found.");
    return availability;
  }

  const filteredAvailability = availability.filter(slot => slot.date !== oldestDateStr);

  const latestDateStr = filteredAvailability.reduce(
    (latest, slot) => (slot.date > latest ? slot.date : latest),
    filteredAvailability[0].date
  );

  if (!latestDateStr) {
    console.error("Error: No valid latest date found.");
    return availability;
  }

  const [year, month, day] = latestDateStr.split("-").map(Number);
  const nextDate = new Date(year, month - 1, day);
  nextDate.setDate(nextDate.getDate() + 1);

  const nextDateStr = nextDate.toISOString().split("T")[0];

  const nextDayName = DAYS_OF_WEEK[nextDate.getDay()];

  const nextDayAvailability: IAvailability[] = (TIME_SLOTS[nextDayName] || []).map((time) => ({
    day: nextDayName,
    time,
    date: nextDateStr,
    available: true,
  }));

  // ✅ Add a check to prevent adding empty days
if (nextDayAvailability.length === 0) {
  return filteredAvailability; // Just return the filtered array without modifying it
}

  return [...filteredAvailability, ...nextDayAvailability];
};

export async function GET() {
  try {
    await connectToDatabase();

    const court = await Court.findById(COURT_ID);
    if (!court) {
      return NextResponse.json({ message: "Court not found" }, { status: 404 });
    }

    let availability: IAvailability[] = court.availability as IAvailability[] || [];

    if (availability.length === 0) {
      availability = generateNext7Days();
    } else {
      availability = shiftAvailability(availability);
    }

    court.availability = availability.filter(slot => slot.day && slot.date && slot.time);
    await court.save();

    return NextResponse.json({ message: "Availability updated successfully", court }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error updating availability:", error);
    return NextResponse.json(
      { systemMessage: "Internal Server Error", userMessage: "Something went wrong. Please try again. Code 500" },
      { status: 500 }
    );
  }
}


