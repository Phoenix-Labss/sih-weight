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
        
        # -> Click the 'GATC Centers' navigation button in the top navbar to open the GATC management view.
        # GATC Centers button
        elem = page.get_by_text('e-MetrologyNational Platform', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='GATC Centers', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The browser navigated to the GATC view (URL contains '#gatc').
        # Assert-outcome: passed
        # Assert: URL contains '#gatc', showing the GATC view is open.
        await expect(page).to_have_url(re.compile("\\#gatc"), timeout=15000), "URL contains '#gatc', showing the GATC view is open."
        
        # --> The GATC management page displays the '+ Register GATC Centre' action button.
        await page.locator("xpath=/html/body/div/div/main/div/div[1]/button").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: The '+ Register GATC Centre' button is visible on the GATC management page.
        await expect(page.locator("xpath=/html/body/div/div/main/div/div[1]/button").nth(0)).to_be_visible(timeout=15000), "The '+ Register GATC Centre' button is visible on the GATC management page."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    