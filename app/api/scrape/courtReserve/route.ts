import { IAvailability } from "@/app/types/databaseTypes";
import { CourtReserveScrapedEntry } from "@/app/types/functionTypes";
import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { format, toZonedTime } from "date-fns-tz";

const processScrapedData = (
  scrapedData: { Data: CourtReserveScrapedEntry[] }
): IAvailability[] => {
  const timeZone = "America/Los_Angeles"; // Convert from UTC to PST/PDT automatically

  return scrapedData.Data.map((entry) => {
    const startPST = toZonedTime(entry.Start, timeZone);
    const endPST = toZonedTime(entry.End, timeZone);

    return {
      date: format(startPST, "yyyy-MM-dd"), // Extract YYYY-MM-DD
      time: `${format(startPST, "h:mm a")} - ${format(endPST, "h:mm a")}`, // "1:30 PM - 2:00 PM"
      name: entry.Title,
      court: entry.CourtLabel,
      available: !entry.IsFull, // Inverse of IsFull
    };
  });
};

async function scrapeData() {
  const browser = await puppeteer.launch({ headless: false }); // Set false for debugging
  const page = await browser.newPage();

  await page.goto("https://app.courtreserve.com/", { waitUntil: "networkidle2" });
  await page.waitForSelector("#loginForm", { visible: true, timeout: 15000 });
  await page.type("#Username", "manuelmaccou@gmail.com");
  await page.type("#Password", "g9ZrhR,Kt5WEAC3");

  await Promise.all([
    page.click('form#loginForm button.btn-success.btn-submit'),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);

  // Set API URL (Test both minimal and aggressive versions)
  const apiUrl = `https://memberschedulers.courtreserve.com/SchedulerApi/ReadExpandedApi?id=12315&uiCulture=en-US&requestData=DbyEeXn%2fR10lBOGvIM%2btXTzerGc%2bpd2YheVNBLi%2fPZU2WKnDNSRNieWeMg%2ftTl9rlOBbm3D1O8B9KWd8kFKuPGauKTopjm2qHHlhrTRwwdpHGRNH%2fxJawOu9YR8LXeic%2bjwZGcC%2bYhc%3d&sort=&group=&filter=&jsonData=%7B%22startDate%22%3A%222025-02-12T23%3A17%3A40.000Z%22%2C%22orgId%22%3A%2212315%22%2C%22TimeZone%22%3A%22America%2FLos_Angeles%22%2C%22Date%22%3A%22Wed%2C%2012%20Feb%202025%2023%3A17%3A40%20GMT%22%2C%22KendoDate%22%3A%7B%22Year%22%3A2025%2C%22Month%22%3A2%2C%22Day%22%3A12%7D%2C%22UiCulture%22%3A%22en-US%22%2C%22CostTypeId%22%3A%22115958%22%2C%22CustomSchedulerId%22%3A%22%22%2C%22ReservationMinInterval%22%3A%2260%22%2C%22SelectedCourtIds%22%3A%22-1%2C47064%2C47065%2C47066%2C47067%2C47068%2C53657%22%2C%22SelectedInstructorIds%22%3A%22%22%2C%22MemberIds%22%3A%227275157%22%2C%22MemberFamilyId%22%3A%22%22%2C%22EmbedCodeId%22%3A%22%22%2C%22HideEmbedCodeReservationDetails%22%3A%22True%22%7D`;

  // Fetch Data
  const response = await page.evaluate(async (apiUrl) => {
    const res = await fetch(apiUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    return res.json();
  }, apiUrl);

  console.log("Raw Data:", response);

  // Process Data
  const processedData = processScrapedData(response);
  console.log("Processed Data:", processedData);

  await browser.close();
}

export async function GET() {
  await scrapeData();
  return NextResponse.json({
    message: "Scraping completed",
  });
}

export async function POST() {
  await scrapeData();
  return NextResponse.json({
    message: "Data refreshed",
  });
}
