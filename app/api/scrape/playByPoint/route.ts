import { NextResponse } from "next/server";
import UserAgent from 'user-agents';
import puppeteer, { Browser, Page } from "puppeteer";
import Court from "@/app/models/Court";
import { PlayByPointProcessedAvailability, PlayByPointScrapedEntry, PlayByPointScrapedHour } from "@/app/types/functionTypes";
import connectToDatabase from "@/lib/mongodb";

const facilityMap: Record<number, { name: string; address: string, daysToScrape: number, }> = {
  440: { name: "Santa Monica Pickleball Center", address: "2501 Wilshire Blvd, Santa Monica, CA 90403", daysToScrape: 6 },
  523: { name: "Pickle Pop", address: "1231 3rd St, Santa Monica, CA 90401", daysToScrape: 5 },
};

const getDayOfWeekFromTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);

  // Extract UTC day of the week
  const dayIndex = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return daysOfWeek[dayIndex];
};

// ✅ Helper Function: Format time correctly for DB storage

const splitOneHourBlocks = (date: string, day: string, timeSlot: string, available: boolean) => {

  if (!timeSlot.includes("-")) {
    console.error("❌ Invalid time slot format:", timeSlot);
    return [];
  }

  // Extract start and end times
  const [startRaw, endRaw] = timeSlot.split("-").map(t => t.trim());
  let suffix = endRaw.includes("am") ? "AM" : "PM"; // Use end time to determine initial suffix

  // Extract numeric hours
  const startHour = parseInt(startRaw);
  const endHour = parseInt(endRaw);

  // Generate 30-minute slots
  const slots = [];
  for (let i = 0; i < 2; i++) {

    // reset suffix
    suffix = endRaw.includes("am") ? "AM" : "PM";

    const nextHour = i === 0 ? startHour : startHour + 0.5;
    const formattedStart = nextHour % 1 === 0 ? `${Math.floor(nextHour)}` : `${Math.floor(nextHour)}:30`;

    if (formattedStart === '11' && endHour === 12 && suffix === 'PM') {
      suffix = "AM"
    }

    let formattedEnd = nextHour % 1 === 0 ? `${Math.floor(nextHour)}:30${suffix.toLowerCase()}` : `${Math.floor(nextHour + 0.5)}${suffix.toLowerCase()}`;
    if (formattedEnd === "13pm") {
      formattedEnd = "1pm"
    }

    slots.push({
      date,
      day,
      time: `${formattedStart}-${formattedEnd}`,
      available,
    });
  }

  return slots;
};


const processScrapedData = (scrapedData: PlayByPointScrapedEntry[], courtName: string): PlayByPointProcessedAvailability[] => {

  return scrapedData.flatMap((entry: PlayByPointScrapedEntry) => {
    const dayOfWeek = getDayOfWeekFromTimestamp(Math.floor(new Date(entry.date).getTime() / 1000));

    return entry.data.available_hours
      .filter((hour: PlayByPointScrapedHour) => hour.available)
      .flatMap((hour: PlayByPointScrapedHour) => {        
        
        if (courtName === "Pickle Pop") {
          return splitOneHourBlocks(entry.date, dayOfWeek, hour.schedule, hour.available); // Split into 30-min blocks
        } else {
        
        
          return [{
            date: entry.date,
            day: dayOfWeek,
            time: hour.schedule,
            available: hour.available,
          }];
        }
      });
  });
};

let browser: Browser | null = null;
let scrapeCount = 0;
const SCRAPE_LIMIT_BEFORE_RESTART = 10;

async function getBrowserInstance(): Promise<Browser> {
  if (!browser || !browser.process() || scrapeCount >= SCRAPE_LIMIT_BEFORE_RESTART) {
    if (browser) {
      console.log("♻️ Restarting browser instance...");
      await browser.close();
    }
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (await puppeteer.executablePath()),
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-crash-reporter",
        "--no-zygote",
        "--single-process",
        "--disable-gpu"
      ],
      env: {
        ...process.env,
        CHROME_CRASHPAD_DISABLE: "1"
      },
      pipe: true
    });
    scrapeCount = 0;
  }
  scrapeCount++;
  return browser;
}

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T | null> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.error(`⚠️ Retry ${i + 1} failed:`, error);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  console.error("❌ All retries failed.");
  return null;
}

// https://stackoverflow.com/questions/70118400/puppeteer-cant-find-elements-when-headless-true

async function scrapeAndSaveData() {
  await connectToDatabase(); 
  const browser = await getBrowserInstance();
  const page: Page = await browser.newPage();
  
  try {
    const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
    await page.setUserAgent(userAgent);

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    await page.goto("https://app.playbypoint.com/users/sign_in", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#new_user", { visible: true, timeout: 15000 });
    await page.type("#user_email", "manuelmaccou@gmail.com");
    await page.type("#user_password", "wussyb-tUgby5-kykbar");

    await Promise.all([
      page.click("input[type='submit']"),
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    ]);

    for (const facilityId of Object.keys(facilityMap).map(Number)) {
      const { name, address, daysToScrape = 5 } = facilityMap[facilityId];

      const allAvailabilities = [];
      const baseDate = new Date();

      for (let i = 0; i < daysToScrape; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        date.setHours(0, 0, 0, 0);
        const timestamp = Math.floor(date.getTime() / 1000);

        const apiUrl = `https://app.playbypoint.com/api/facilities/${facilityId}/available_hours?timestamp=${timestamp}&surface=pickleball&kind=reservation`;

        const response = await retry(async () => {
          return await page.evaluate(async (apiUrl) => {
            const res = await fetch(apiUrl, { headers: { "User-Agent": navigator.userAgent } });
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            return await res.json();
          }, apiUrl);
        });

        if (response) {
          allAvailabilities.push({ date: date.toISOString().split("T")[0], data: response });
        }
      }

      const processedData = processScrapedData(allAvailabilities, name);
      await saveCourtData(name, address, processedData);
    }

  } catch (error) {
    console.error("❌ Scraping error:", error);

    // Ensure TypeScript treats error as an instance of Error
    if (error instanceof Error) {
      // If Puppeteer crashes, force Railway to restart the container
      if (error.message.includes("Target closed") || error.message.includes("Protocol error")) {
        console.log("🚨 Critical Puppeteer error detected. Restarting Railway container...");
        process.exit(1); // This will force Railway to restart the entire container
      }
    } else {
      console.error("❌ An unknown error occurred:", error);
    }
  } finally {
    await page.close(); // Close the page after scraping
  }
}

async function saveCourtData(name: string, address: string, availability: PlayByPointProcessedAvailability[]) {
  try {
    const existingCourt = await Court.findOne({ name });

    if (existingCourt) {
      // Overwrite the entire availability array
      existingCourt.availability = availability;
      existingCourt.address = address;
      await existingCourt.save();
    } else {
      const newCourt = new Court({ name, address, availability });
      await newCourt.save();
    }
  } catch (error) {
    console.error(`Error saving data for ${name}:`, error);
  }
}

export async function GET() {
  try {
    await scrapeAndSaveData();
    return NextResponse.json({
      message: "Scraping completed successfully.",
      status: "success",
    });
  } catch (error) {
    console.error("Scraping error:", error);
    return NextResponse.json({
      message: "Scraping failed due to an internal error.",
      status: "error",
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    await scrapeAndSaveData();
    return NextResponse.json({
      message: "Data refreshed successfully.",
      status: "success",
    });
  } catch (error) {
    console.error("Scraping error:", error);
    return NextResponse.json({
      message: "Data refresh failed due to an internal error.",
      status: "error",
    }, { status: 500 });
  }
}