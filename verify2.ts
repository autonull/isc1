import { test, expect, chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to local site...');
  await page.goto('http://localhost:4173');

  console.log('Waiting for load...');
  await page.waitForTimeout(2000);

  const chatList = await page.textContent('#chat-list');
  console.log('Chat List content:', chatList);

  await browser.close();
  console.log('Verification done.');
})();
