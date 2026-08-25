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
        
        # -> Open the 'Officer Workspace' using the #officer deep link (http://127.0.0.1:5173/#officer) and verify the Officer workspace shows statutory workflow sections (e.g., scrutiny/applications, verification/testing sessions) and no crash/error...
        await page.goto("http://127.0.0.1:5173/#officer")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # --> Assertions to verify final state
        
        # --> Officer workspace shows workflow sections including 'Application Scrutiny & Scheduling Queue' and 'Guided NAWI Testing Session Execution'.
        # Assert-outcome: passed
        # Assert: Verifies the Application Scrutiny & Scheduling Queue tab is present.
        await expect(page.locator("xpath=/html/body/div/div/main/div/div[2]/button[1]").nth(0)).to_contain_text("Application Scrutiny & Scheduling Queue", timeout=15000), "Verifies the Application Scrutiny & Scheduling Queue tab is present."
        # Assert-outcome: passed
        # Assert: Verifies the Guided NAWI Testing Session Execution tab is present.
        await expect(page.locator("xpath=/html/body/div/div/main/div/div[2]/button[2]").nth(0)).to_contain_text("Guided NAWI Testing Session Execution", timeout=15000), "Verifies the Guided NAWI Testing Session Execution tab is present."
        
        # --> No crash or error overlay is visible and the applications list is rendered (example: 'APP-2026-DL-00142' row).
        # Assert-outcome: passed
        # Assert: Verifies an application row (APP-2026-DL-00142) is visible, indicating no crash/error overlay.
        await expect(page.locator("xpath=/html/body/div/div/main/div/div[3]/div[3]/div/table/tbody/tr").nth(0)).to_contain_text("APP-2026-DL-00142", timeout=15000), "Verifies an application row (APP-2026-DL-00142) is visible, indicating no crash/error overlay."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    