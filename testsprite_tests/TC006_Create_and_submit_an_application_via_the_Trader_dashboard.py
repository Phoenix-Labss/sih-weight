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
        
        # -> Click the '+ New Application' button in the Active Statutory Verification Applications section to start a new verification application.
        # + New Application button
        elem = page.get_by_role('button', name='+ New Application', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select the instrument 'Eagle Electronic Counter Scale Model E-30' and click the 'Proceed to Step' button to move to Mode & Schedule.
        # Eagle Electronic Counter Scale Model E-30
        elem = page.get_by_text('Eagle Electronic Counter Scale Model E-30', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select the instrument 'Eagle Electronic Counter Scale Model E-30' and click the 'Proceed to Step' button to move to Mode & Schedule.
        # Proceed to Step 2 button
        elem = page.get_by_role('button', name='Proceed to Step 2', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Proceed to Step' button to open Step 3: Statutory Declaration.
        # Proceed to Step 3 button
        elem = page.get_by_role('button', name='Proceed to Step 3', exact=True)
        await elem.click(timeout=10000)
        
        # -> Check the "I accept the statutory undertaking and agree to abide by the Legal Metrology Rules, 2011." checkbox, then click the 'Proceed to Step' button to open the Review & Submit step.
        # checkbox
        elem = page.get_by_label('I accept the statutory undertaking and agree to abide by the Legal Metrology Rules, 2011.', exact=True)
        await elem.click(timeout=10000)
        
        # -> Check the "I accept the statutory undertaking and agree to abide by the Legal Metrology Rules, 2011." checkbox, then click the 'Proceed to Step' button to open the Review & Submit step.
        # Proceed to Step 4 button
        elem = page.get_by_role('button', name='Proceed to Step 4', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Submit Application for Scrutiny' button to submit the application.
        # Submit Application for Scrutiny button
        elem = page.get_by_text('Back', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Submit Application for Scrutiny', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> A new application (APP-2026-DL-73314) appears in the Active Statutory Verification Applications list and is shown as submitted with a pending fee action.
        # Assert-outcome: passed
        # Assert: The submitted application shows a 'Pay Fees' control indicating a pending statutory fee.
        await expect(page.locator("xpath=/html/body/div[1]/div/main/div/div[4]/div[2]/div[1]/div[1]/div[2]/button").nth(0)).to_contain_text("Pay Fees", timeout=15000), "The submitted application shows a 'Pay Fees' control indicating a pending statutory fee."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    