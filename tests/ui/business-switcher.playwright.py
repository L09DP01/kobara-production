from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright, expect

output = Path(tempfile.gettempdir()) / "kobara-business-ui"
output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width, height in [(1440, 960), (390, 844), (320, 740)]:
        page = browser.new_page(viewport={"width": width, "height": height})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto("http://127.0.0.1:3029", wait_until="networkidle")
        page.get_by_role("button", name="Choisir un business").click()
        expect(page.get_by_text("Mes business", exact=True)).to_be_visible()
        expect(page.locator("#business-switcher button[aria-current='true']")).to_have_count(1)
        expect(page.locator("#business-switcher").get_by_text("Production", exact=True)).to_have_count(2)
        expect(page.locator("#business-switcher").get_by_text("Test", exact=True)).to_have_count(1)
        box = page.locator("#business-switcher").bounding_box()
        assert box["x"] >= 0 and box["x"] + box["width"] <= width
        page.screenshot(path=str(output / f"menu-{width}.png"), full_page=True)
        page.keyboard.press("Escape")
        expect(page.locator("#business-switcher")).to_have_count(0)
        page.get_by_role("button", name="Choisir un business").click()
        page.get_by_role("button", name="Ajouter un business", exact=True).click()
        dialog = page.get_by_role("dialog")
        try:
            expect(dialog).to_be_visible()
        except Exception:
            print("Browser errors:", errors)
            print("Page:", page.locator("body").inner_text()[:1500])
            page.screenshot(path=str(output / f"failure-{width}.png"), full_page=True)
            raise
        page.screenshot(path=str(output / f"dialog-{width}.png"), full_page=True)
        dialog.get_by_label("Nom du business").fill("Academie Express")
        dialog.get_by_label("Activité", exact=True).select_option("services")
        dialog.get_by_label("Téléphone professionnel").fill("+50940000000")
        dialog.get_by_label("Adresse professionnelle").fill("Adresse fictive en Haiti")
        dialog.get_by_label("Produits ou services proposés").fill("Formation et services numeriques professionnels")
        dialog.get_by_role("button", name="Créer le business").click()
        expect(dialog.get_by_role("alert")).to_contain_text("test local")
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        assert not errors, errors
        page.close()
    browser.close()
print(f"3 viewports verified. Screenshots: {output}")
