import { test, expect, chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to local site...');
  await page.goto('http://localhost:4173');

  console.log('Waiting for load...');
  await page.waitForTimeout(2000);

  // Take a screenshot of the initial loaded page
  await page.screenshot({ path: 'verify_communities_1.png' });

  console.log('Clicking on New Channel button...');
  await page.click('#btn-show-compose');
  await page.waitForTimeout(500);

  console.log('Taking screenshot of compose view...');
  await page.screenshot({ path: 'verify_communities_2.png' });

  console.log('Clicking on Community radio button...');
  await page.click('#compose-type-community');
  await page.waitForTimeout(500);

  console.log('Taking screenshot of compose view (Community mode)...');
  await page.screenshot({ path: 'verify_communities_3.png' });

  // Fill and submit
  await page.fill('#compose-name', 'Test Community');
  await page.fill('#compose-description', 'My new shiny community!');
  await page.click('#btn-publish-channel');

  console.log('Waiting for creation...');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'verify_communities_4.png' });

  console.log('Clicking Join Community button...');
  await page.click('#btn-show-join-community');
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'verify_communities_5.png' });

  await browser.close();
  console.log('Verification done.');
})();
