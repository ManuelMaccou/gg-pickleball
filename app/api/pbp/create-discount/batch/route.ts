import { NextResponse } from 'next/server';
import { chromium } from 'playwright';
import {
  CouponInput,
} from '@/app/types/pbpTypes';

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function POST(request: Request) {
  const body = await request.json();
  const coupons: CouponInput[] = body?.coupons;

  if (!Array.isArray(coupons) || coupons.length === 0) {
    return NextResponse.json(
      { message: 'No coupons provided. Expected a valid array of CouponUpdateInput.' },
      { status: 400 }
    );
  }

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    // Login
    await page.goto(process.env.PBS_LOGIN_URL!, { waitUntil: 'networkidle' });
    await page.fill('#user_email', process.env.POS_USERNAME!);
    await page.fill('#user_password', process.env.POS_PASSWORD!);
    await Promise.all([
      page.click('input[type="submit"][value="Log in"]'),
      page.waitForLoadState('networkidle'),
    ]);

    await delay(500);

    // Go to page with CSRF
    await page.goto('https://app.playbypoint.com/admin/facilities/1122/manage_bookings', {
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
          const res = await fetch('/api/coupons', {
            method: 'POST',
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

      await page.waitForTimeout(500 + Math.random() * 300);
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Batch update error:', err.message);
    return NextResponse.json(
      { message: 'Batch update failed.', details: err.message },
      { status: 500 }
    );
  } finally {
    // await browser.close();
  }
}
