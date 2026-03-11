import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:5173/")

        # Wait a moment for app initialization
        await asyncio.sleep(2)

        # Attempt to create a post to see if the flag UI renders
        # First we need a channel
        await page.click("#btn-show-compose")
        await asyncio.sleep(0.5)
        await page.fill("#compose-name", "Test Channel")
        await page.fill("#compose-description", "Testing flags")
        await page.click("#btn-publish-channel")
        await asyncio.sleep(1)

        # Make a post
        await page.fill("#compose-post-input", "This is an off-topic test post")
        await page.click("#btn-publish-post-inline")
        await asyncio.sleep(1)

        # Screenshot the channel view to see the flag button
        await page.screenshot(path="verify_flag.png")

        # Click the flag button
        # There might be multiple match cards; we click the flag button on the first one
        flag_button = page.locator("button.btn-icon:has-text('🚩 Flag')").first
        if await flag_button.is_visible():
            await flag_button.click()
            await asyncio.sleep(0.5)
            # Take another screenshot to show "Flagged" state
            await page.screenshot(path="verify_flagged.png")

        await browser.close()

asyncio.run(run())
