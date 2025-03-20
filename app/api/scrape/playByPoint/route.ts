export const dynamic = "force-dynamic";

import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import UserAgent from 'user-agents';
import puppeteer from "puppeteer";
import Court from "@/app/models/Court";
import { PlayByPointProcessedAvailability, PlayByPointScrapedEntry, PlayByPointScrapedHour } from "@/app/types/functionTypes";
import connectToDatabase from "@/lib/mongodb";

const TIMEZONE = "America/Los_Angeles"; 

const facilityMap: Record<number, { name: string; address: string, daysToScrape: number, }> = {
  440: { name: "Santa Monica Pickleball Center", address: "2501 Wilshire Blvd, Santa Monica, CA 90403", daysToScrape: 6 },
  523: { name: "Pickle Pop", address: "1231 3rd St, Santa Monica, CA 90401", daysToScrape: 5 },
};

const getDayOfWeekFromTimestamp = (timestamp: number, timeZone = TIMEZONE): string => {
  if (timestamp > 9999999999) {
    timestamp = Math.floor(timestamp / 1000); // Convert from ms to seconds if necessary
  }
  const date = DateTime.fromSeconds(timestamp).setZone(timeZone);
  const formattedDay = date.toFormat("EEEE");

  console.log(`🕰 Timestamp: ${timestamp} -> ${date.toISO()} | Day: ${formattedDay}`);
  return formattedDay;
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
    const dayOfWeek = getDayOfWeekFromTimestamp(DateTime.fromISO(entry.date, { zone: TIMEZONE }).toSeconds());

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

async function scrapeAndSaveData() {
  await connectToDatabase(); 

  // https://stackoverflow.com/questions/70118400/puppeteer-cant-find-elements-when-headless-true
  const browser = await puppeteer.launch({
    headless: false,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-crash-reporter",
        "--no-zygote",
        "--force-timezone=America/Los_Angeles"
      ],
      env: {
        ...process.env,
      CHROME_CRASHPAD_DISABLE: '1'
      },
      pipe: true
    });

    const page = await browser.newPage();
    await page.emulateTimezone("America/Los_Angeles");
    await page.setCacheEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      req.continue({ headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } });
    });
  
    const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();

    console.log(`🛠 Using User Agent: ${userAgent}`);

    await page.setUserAgent(userAgent);

  // Prevent Puppeteer detection
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

    console.log("✅ Successfully logged in");

    for (const facilityId of Object.keys(facilityMap).map(Number)) {
      const { name, address, daysToScrape = 5 } = facilityMap[facilityId];

      const allAvailabilities = [];
      const baseDate = DateTime.now().setZone(TIMEZONE);

      for (let i = 0; i < daysToScrape; i++) {
        const date = baseDate.plus({ days: i }).toJSDate();
        date.setDate(date.getDate() + i);
        date.setHours(0, 0, 0, 0);
        const timestamp = Math.floor(DateTime.local().setZone("America/Los_Angeles").toSeconds());


        const apiUrl = `https://app.playbypoint.com/api/facilities/${facilityId}/available_hours?timestamp=${timestamp}&surface=pickleball&kind=reservation&r=${Math.random()}`;

        console.log("🔍 Fetching:", apiUrl);
        const response = await page.evaluate(async (apiUrl) => {
        try {
            const res = await fetch(apiUrl, { headers: { "User-Agent": navigator.userAgent } });

          if (!res.ok) {
            console.error(`⚠️ API returned an error for ${apiUrl}: ${res.status} ${res.statusText}`);
            return null; // Returning null so we can skip it later
          }

          const data = await res.json();

          if (!data || Object.keys(data).length === 0) {
            console.warn(`⚠️ Empty response for ${apiUrl}, skipping...`);
            return null; // Returning null so we can skip it later
          }

          return data;
        } catch (error) {
          console.error(`❌ Error fetching ${apiUrl}:`, error);
          return null; // Prevent script from crashing
        }
        
          }, apiUrl);

          if (response) {
            allAvailabilities.push({ date: date.toISOString().split("T")[0], data: response });
          }

        if (response && response.available_hours && Array.isArray(response.available_hours)) {
          // Extract the first 3 entries from the available_hours array
          console.log(`📡 RAW API Response for ${apiUrl} (First 3 Entries):`,
            JSON.stringify(response.available_hours.slice(0, 3), null, 2)
          );
        } else {
          console.log(`📡 RAW API Response for ${apiUrl}:`, JSON.stringify(response, null, 2));
        }
      }
      

      const processedData = processScrapedData(allAvailabilities, name);
      if (processedData.length > 0) {
        console.log(`🏓 Processed data for ${name} (First 3, Date: ${processedData[0].date}):`,
          JSON.stringify(processedData.slice(0, 3), null, 2)
        );
      }

      await saveCourtData(name, address, processedData);
    }

  await browser.close();
}

async function saveCourtData(name: string, address: string, availability: PlayByPointProcessedAvailability[]) {
  try {

    await Court.updateOne(
      { name }, // 🔍 Find document by name
      { $set: { address, availability } }, // 🔄 Update address & availability
      { upsert: true } // 🔥 Insert if not exists, update if exists
    );

    console.log(`✅ Data successfully saved for ${name}`);
  } catch (error) {
    console.error(`❌ Database write error for ${name}:`, error);
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