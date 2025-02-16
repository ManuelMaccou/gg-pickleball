import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import Court from "@/app/models/Court";
import { PlayByPointProcessedAvailability, PlayByPointScrapedEntry, PlayByPointScrapedHour } from "@/app/types/functionTypes";
import connectToDatabase from "@/lib/mongodb";

const facilityMap: Record<number, { name: string; address: string }> = {
  440: { name: "Santa Monica Pickleball Center", address: "2501 Wilshire Blvd, Santa Monica, CA 90403" },
  523: { name: "Picklepop", address: "1231 3rd St, Santa Monica, CA 90401" },
};

const getDayOfWeekFromTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);

  // Extract UTC day of the week
  const dayIndex = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return daysOfWeek[dayIndex];
};

const processScrapedData = (scrapedData: PlayByPointScrapedEntry[]): PlayByPointProcessedAvailability[] => {
  return scrapedData.flatMap((entry: PlayByPointScrapedEntry) => {
    const dayOfWeek = getDayOfWeekFromTimestamp(Math.floor(new Date(entry.date).getTime() / 1000));

    return entry.data.available_hours.map((hour: PlayByPointScrapedHour) => ({
      date: entry.date,
      day: dayOfWeek,
      time: hour.schedule,
      available: hour.available,
    }));
  });
};

async function scrapeAndSaveData() {
  await connectToDatabase(); 

  // https://stackoverflow.com/questions/70118400/puppeteer-cant-find-elements-when-headless-true
  const browser = await puppeteer.launch({ headless: false }); // Set false for debugging
  const page = await browser.newPage();

  await page.goto("https://app.playbypoint.com/users/sign_in", { waitUntil: "networkidle2" });
  await page.waitForSelector("#new_user", { visible: true, timeout: 15000 });
  await page.type("#user_email", "manuelmaccou@gmail.com");
  await page.type("#user_password", "wussyb-tUgby5-kykbar");

  await Promise.all([
    page.click("input[type='submit']"),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);

  for (const facilityId of Object.keys(facilityMap).map(Number)) {
    const { name, address } = facilityMap[facilityId];

    const allAvailabilities = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);
      const timestamp = Math.floor(date.getTime() / 1000);

      const apiUrl = `https://app.playbypoint.com/api/facilities/${facilityId}/available_hours?timestamp=${timestamp}&surface=pickleball&kind=reservation`;

      const response = await page.evaluate(async (apiUrl) => {
        const res = await fetch(apiUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        return res.json();
      }, apiUrl);

      allAvailabilities.push({ date: date.toISOString().split("T")[0], data: response });
    }

    const processedData = processScrapedData(allAvailabilities);
    console.log(`Processed Data for ${name}:`, processedData);

    await saveCourtData(name, address, processedData);
  }

  await browser.close();
}

async function saveCourtData(name: string, address: string, availability: PlayByPointProcessedAvailability[]) {
  try {
    const existingCourt = await Court.findOne({ name });

    if (existingCourt) {
      existingCourt.availability = availability;
      existingCourt.address = address;
      await existingCourt.save();
      console.log(`Updated availability for ${name}`);
    } else {
      const newCourt = new Court({ name, address, availability });
      await newCourt.save();
      console.log(`Added new court: ${name}`);
    }
  } catch (error) {
    console.error(`Error saving data for ${name}:`, error);
  }
}

export async function GET() {
  await scrapeAndSaveData();
  return NextResponse.json({
    message: "Scraping completed and data saved to MongoDB",
  });
}

export async function POST() {
  await scrapeAndSaveData();
  return NextResponse.json({
    message: "Data refreshed and saved to MongoDB",
  });
}
