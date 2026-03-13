import { test, expect, chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to http://localhost:4173...');
  await page.goto('http://localhost:4173');

  console.log('Waiting for load...');
  await page.waitForTimeout(2000);

  console.log('Clicking on Profile button...');
  await page.click('#btn-show-profile');

  console.log('Waiting for profile view...');
  await page.waitForSelector('#view-profile.active');

  const title = await page.textContent('#profile-view-title');
  console.log('Title:', title);

  console.log('Taking screenshot...');
  await page.screenshot({ path: 'verify_profile.png' });

  await browser.close();
  console.log('Verification done.');
})();
