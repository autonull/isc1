import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:5173/")

        # Wait a moment for app initialization
        await asyncio.sleep(2)

        # Click new channel button
        await page.click("#btn-show-compose")
        await asyncio.sleep(0.5)

        # We also want to verify the recent posts UI. But first the dropdown.
        # Click add context button
        await page.click("#btn-add-context")
        await asyncio.sleep(0.5)

        # Select boosted_by to verify it's there
        await page.select_option("#context-tag-select", "boosted_by")

        # Screenshot the compose view
        await page.screenshot(path="verify_tags2.png")

        await browser.close()

asyncio.run(run())
