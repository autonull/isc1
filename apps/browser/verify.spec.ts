import { test, chromium } from '@playwright/test';

test('Verify Frontend Changes', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the local Vite preview server
    await page.goto('http://localhost:4173');

    // Wait for the app to initialize
    await page.waitForTimeout(2000);

    // Compose a post
    const postInput = page.locator('#compose-post-input');
    await postInput.waitFor({ state: 'visible' });
    await postInput.fill('This is a test post to verify the IPFS link feature!');

    const ipfsInput = page.locator('#compose-post-ipfs');
    await ipfsInput.waitFor({ state: 'visible' });
    await ipfsInput.fill('ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi');

    const postBtn = page.locator('#btn-publish-post-inline');
    await postBtn.click();

    // Wait for the post to appear in the feed
    await page.waitForTimeout(2000);

    // Verify the IPFS link is rendered in the post
    const linkEl = page.locator('a:has-text("📎 IPFS Link")').first();
    await linkEl.waitFor({ state: 'visible', timeout: 5000 });

    // Take a screenshot of the recent posts area
    const recentPostsArea = page.locator('#discover-recent-posts');
    await recentPostsArea.screenshot({ path: '/home/jules/verification/post_with_ipfs.png' });

    console.log('Verification screenshot saved successfully.');

  } catch (error) {
    console.error('Verification failed:', error);
    await page.screenshot({ path: '/home/jules/verification/error.png' });
    throw error;
  } finally {
    await browser.close();
  }
});
