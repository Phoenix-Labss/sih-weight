import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://127.0.0.1:5173")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'MOCK PREVIEW' button (Mock/Live toggle) to switch the application from MOCK to Live API mode and then verify the UI shows a LIVE/connected status.
        # MOCK PREVIEW button
        elem = page.get_by_role('button', name='MOCK PREVIEW', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The top-right API mode control indicates the application is connected to the live backend (shows LIVE API).
        # Assert-outcome: passed
        # Assert: API mode control contains 'LIVE API', indicating the live backend is active.
        await expect(page.locator("xpath=/html/body/div[1]/div/header/div[2]/div/div[2]/button").nth(0)).to_contain_text("LIVE API", timeout=15000), "API mode control contains 'LIVE API', indicating the live backend is active."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    