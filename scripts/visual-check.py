"""Run with Python + Playwright against an already running development server.

  python3 scripts/visual-check.py

Browser artifacts go into the ignored test-results directory.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path('test-results')
out.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for name, width, height in [('desktop', 1440, 900), ('laptop', 1366, 768), ('mobile', 390, 844), ('small-mobile', 360, 640)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:5173', wait_until='networkidle')
        page.screenshot(path=str(out / f'{name}-hero.png'))
        for section in ['collection', 'services', 'reservation']:
            page.evaluate('(id) => { const root = document.querySelector("main"); root.scrollTo({top:document.getElementById(id).offsetTop,behavior:"instant"}) }', section)
            page.wait_for_timeout(150)
            page.screenshot(path=str(out / f'{name}-{section}.png'))
        print(json.dumps({'viewport': name, 'errors': errors, 'bodyOverflow': page.evaluate('document.documentElement.scrollWidth > innerWidth')}))
        page.close()
    browser.close()
