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
        
        # -> Click the 'हिन्दी' language button in the navbar to switch the interface to Hindi.
        # हिन्दी button
        elem = page.get_by_role('button', name='हिन्दी', exact=True)
        await elem.click(timeout=10000)
        
        # -> Verify the heading 'व्यापारी पोर्टल' appears on the page (confirming Hindi), then click the 'EN' button to switch the UI back to English.
        # EN button
        elem = page.get_by_role('button', name='EN', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Selecting हिन्दी changes the visible navbar heading to the Hindi label 'व्यापारी पोर्टल'.
        # Assert-outcome: passed
        # Assert: Navbar heading contains the Hindi label 'व्यापारी पोर्टल'.
        await expect(page.locator("xpath=/html/body/div/div/header/div[2]/div/nav/button[1]").nth(0)).to_contain_text("\u0935\u094d\u092f\u093e\u092a\u093e\u0930\u0940 \u092a\u094b\u0930\u094d\u091f\u0932", timeout=15000), "Navbar heading contains the Hindi label '\u0935\u094d\u092f\u093e\u092a\u093e\u0930\u0940 \u092a\u094b\u0930\u094d\u091f\u0932'."
        
        # --> Toggling back to EN restores the navbar heading to 'Trader Portal'.
        # Assert-outcome: passed
        # Assert: Navbar heading equals 'Trader Portal' after switching back to English.
        await expect(page.locator("xpath=/html/body/div/div/header/div[2]/div/nav/button[1]").nth(0)).to_have_text("Trader Portal", timeout=15000), "Navbar heading equals 'Trader Portal' after switching back to English."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    