from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Log console messages
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

        print("Navigating to http://localhost:5173")
        try:
            page.goto("http://localhost:5173", timeout=10000)

            # Click compose button
            print("Clicking compose tab")
            page.wait_for_selector(".nav-btn[data-tab='compose']", state="visible")
            page.click(".nav-btn[data-tab='compose']")

            print("Waiting for form to be visible")
            page.wait_for_selector("#tab-compose", state="visible")

            print("Filling form")
            page.fill("#compose-name", "Test Channel")
            page.fill("#compose-description", "Test Description")

            print("Waiting 15s for model load")
            time.sleep(15)

            print("Clicking publish")
            page.click("#btn-publish-channel")

            print("Waiting 15s for embedding")
            time.sleep(15)

            page.screenshot(path="verify_output.png")
            print("Screenshot saved to verify_output.png")

            print("Clicking Now tab to see if it appeared")
            page.click(".nav-btn[data-tab='now']")
            time.sleep(5)
            page.screenshot(path="verify_now.png")

        except Exception as e:
            print(f"Test failed: {e}")
            page.screenshot(path="verify_error.png")

        finally:
            browser.close()

if __name__ == "__main__":
    run()
