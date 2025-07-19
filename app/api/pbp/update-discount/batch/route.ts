import { NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { CouponInput } from '@/app/types/pbpTypes';

const randomDelay = (min = 400, max = 900) =>
  new Promise((res) => setTimeout(res, min + Math.random() * (max - min)));

export async function POST(request: Request) {
  const body = await request.json();
  const coupons: CouponInput[] = body?.coupons;
  const facilityId = coupons[0]?.facilityId;

  if (!facilityId) {
    return NextResponse.json(
      { message: 'facilityId is missing from the coupon data.' },
      { status: 400 }
    );
  }

  if (!Array.isArray(coupons) || coupons.length === 0) {
    return NextResponse.json(
      { message: 'No coupons provided. Expected a valid array of CouponInput.' },
      { status: 400 }
    );
  }

   const browser = await chromium.launch({
    // headless: false,
    channel: 'chromium',
    args: [
      '--disable-blink-features=AutomationControlled', // Disables the `navigator.webdriver` flag
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York'
  });

  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
      ],
    });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });

  try {
    // Login
    await page.goto(process.env.PBS_LOGIN_URL!, { waitUntil: 'domcontentloaded' }); // or 'networkidle'
    await page.locator('#user_email').pressSequentially(process.env.POS_USERNAME!, { delay: 60 + Math.random() * 40 });
    await page.locator('#user_password').pressSequentially(process.env.POS_PASSWORD!, { delay: 75 + Math.random() * 50 });
    
    await Promise.all([
      page.waitForURL(`**/facilities**`, { waitUntil: 'domcontentloaded' }),
      page.locator('input[type="submit"][value="Log in"]').click(),
    ]);

    await randomDelay();

    // Go to page with CSRF
    await page.goto(`https://app.playbypoint.com/admin/facilities/${facilityId}/manage_bookings`, {
      waitUntil: 'networkidle',
    });

    const csrfToken = await page.$eval('meta[name="csrf-token"]', el =>
      el.getAttribute('content')
    );
    if (!csrfToken) {
      throw new Error('CSRF token not found.');
    }

    const results = [];

    for (const coupon of coupons) {
      const {
        codeName,
        quantity,
        description,
        discountAmount,
        percentual,
        enabled,
        expirationDate,
        affiliations,
        paymentMethods,
        kinds,
        periodicityValue,
        ageStart,
        ageEnd,
      } = coupon;

      const payload = {
        facility_id: 1122,
        coupon: {
          id: 14390,
          code: codeName,
          description: description || `${codeName} discount`,
          quantity: String(quantity),
          expiration_date: expirationDate,
          percentual,
          amount: String(discountAmount),
          enabled,
          periodicity_unit: 'p_times',
          periodicity_value: periodicityValue,
          age_start: ageStart ?? null,
          age_end: ageEnd ?? null,
          periodicity_str: `${periodicityValue} time per user`,
          affiliations,
          payment_methods: paymentMethods,
          kinds,
          uses: [],
        },
      };

      const response = await page.evaluate(
        async ({ token, payload }) => {
          const res = await fetch('/api/coupons/14390', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': token,
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify(payload),
          });

          const body = await res.json().catch(() => ({}));
          return { status: res.status, body };
        },
        { token: csrfToken, payload }
      );

      results.push({ codeName, quantity, status: response.status, body: response.body });

      await randomDelay(300, 700);
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Playwright automation error:', err.stack);
    await page.screenshot({ path: `error-screenshot-${Date.now()}.png`, fullPage: true });
    return NextResponse.json(
      { message: 'Coupon creation failed.', details: err.message },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
