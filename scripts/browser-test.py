"""Production browser integration tests. Requires Python Playwright and Chromium.

Build first: npm run build
Run: python3 scripts/browser-test.py
Uses a temporary SQLite database; never writes to the development database.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)
BASE = 'http://127.0.0.1:4183'
checks = []

def passed(name):
    checks.append(name)
    print(f'PASS {name}', flush=True)

def nav(page, label):
    page.locator('.section-rail').get_by_role('button', name=label, exact=True).click()
    page.wait_for_timeout(950)

def aligned(page, id):
    return page.evaluate('(id) => Math.abs(document.querySelector("main").scrollTop - document.getElementById(id).offsetTop) < 3', id)

with tempfile.TemporaryDirectory(prefix='chauffeur-browser-') as tmp:
    env = {**os.environ, 'NODE_ENV': 'production', 'PORT': '4183', 'HOST': '127.0.0.1', 'DATABASE_PATH': str(Path(tmp) / 'requests.sqlite')}
    with open(Path(tmp) / 'server.log', 'w') as log:
        server = subprocess.Popen(['node', 'server/index.mjs'], cwd=ROOT, env=env, stdout=log, stderr=log)
        try:
            for _ in range(100):
                try:
                    with urllib.request.urlopen(BASE + '/api/health', timeout=1) as response:
                        if response.status == 200: break
                except OSError: time.sleep(.1)
            else: raise RuntimeError('Production server did not become ready')
            with sync_playwright() as p:
                executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
                browser = p.chromium.launch(**({'executable_path': executable} if executable else {}), args=['--no-sandbox'])
                errors = []
                page = browser.new_page(viewport={'width': 1440, 'height': 900})
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
                page.goto(BASE, wait_until='networkidle')
                expect(page.get_by_role('heading', name='The art of arriving.')).to_be_visible()
                before = page.locator('canvas').evaluate('(c) => c.toDataURL()')
                page.mouse.move(700, 650)
                page.mouse.wheel(0, 550)
                page.wait_for_timeout(200)
                assert page.evaluate('document.querySelector("main").scrollTop') > 200
                after = page.locator('canvas').evaluate('(c) => c.toDataURL()')
                assert before != after, 'Hero must draw a different frame as scrolling advances'
                page.mouse.wheel(0, -300)
                page.wait_for_timeout(200)
                assert after != page.locator('canvas').evaluate('(c) => c.toDataURL()'), 'Hero must scrub backwards'
                passed('Hero scrubs forward and backward with actual wheel events')
                page.evaluate('const r=document.querySelector("main");r.scrollTop=document.getElementById("welcome").offsetHeight-r.clientHeight')
                page.wait_for_timeout(250)
                page.mouse.wheel(0, 100)
                page.wait_for_timeout(1000)
                assert aligned(page, 'collection')
                page.mouse.wheel(0, 100)
                for _ in range(12):
                    page.wait_for_timeout(35)
                    page.mouse.wheel(0, 55)
                page.wait_for_timeout(900)
                assert aligned(page, 'services'), 'Trackpad momentum must not skip multiple panels'
                page.mouse.wheel(0, 100)
                page.wait_for_timeout(1000)
                assert aligned(page, 'reservation')
                passed('One wheel gesture advances one full-screen chapter; inertia cannot skip chapters')
                page.locator('main').focus()
                page.keyboard.press('ArrowUp')
                page.wait_for_timeout(1000)
                assert aligned(page, 'services')
                passed('Keyboard panel navigation')
                page.locator('#services article').first.get_by_role('button').click()
                page.wait_for_timeout(1000)
                assert aligned(page, 'reservation')
                expect(page.locator('select[name="service"]')).to_have_value('airport')
                passed('Pricing selection carries through to reservation')
                page.get_by_label('Pick-up location', exact=False).fill('Incheon Airport Terminal 2')
                page.get_by_label('Destination', exact=True).fill('Four Seasons Hotel Seoul')
                page.get_by_label('Pickup time', exact=True).select_option('09:30')
                page.get_by_label('Flight number', exact=False).fill('KE 902')
                page.get_by_role('button', name='Continue your journey', exact=True).click()
                expect(page.get_by_role('button', name='First Class Sedan', exact=False)).to_be_visible()
                page.get_by_role('button', name='First Class Sedan', exact=False).click()
                page.get_by_role('switch', name='Child seat', exact=False).click()
                page.get_by_role('switch', name='Personalised welcome', exact=False).click()
                expect(page.locator('.summary-total strong')).to_have_text('₩210,000')
                page.screenshot(path=str(OUT / 'desktop-preferences.png'))
                page.get_by_role('button', name='Continue your journey', exact=True).click()
                page.get_by_label('Full name').fill('Alex Traveller')
                page.get_by_label('Email address').fill('alex@example.com')
                page.get_by_label('Phone number').fill('+82 10 1234 5678')
                page.locator('input[name="consent"]').check()
                page.screenshot(path=str(OUT / 'desktop-contact.png'))
                with page.expect_response(lambda response: '/api/reservations' in response.url and response.request.method == 'POST') as booking:
                    page.get_by_role('button', name='Request your journey', exact=True).click()
                assert booking.value.status == 201, booking.value.text()
                result = booking.value.json()
                assert result['total'] == 210000
                expect(page.locator('.success-reference')).to_have_text(result['reference'])
                expect(page.locator('.pending-notice')).to_contain_text('not a confirmed booking')
                with page.expect_download() as download:
                    page.get_by_role('button', name='Save to calendar', exact=False).click()
                calendar = Path(download.value.path()).read_text()
                assert 'STATUS:TENTATIVE' in calendar
                assert result['reference'] in calendar
                passed('Complete three-step booking saves the server-calculated request and downloads a tentative calendar event')
                page.screenshot(path=str(OUT / 'desktop-success.png'))
                nav(page, 'The welcome')
                page.screenshot(path=str(OUT / 'desktop-hero.png'))
                for section, label in [('collection', 'The collection'), ('services', 'Our services'), ('reservation', 'Your journey')]:
                    nav(page, label)
                    assert page.locator(f'#{section}').evaluate('(e) => Math.abs(e.getBoundingClientRect().height - innerHeight) < 2')
                    page.screenshot(path=str(OUT / f'desktop-{section}.png'))
                passed('Every desktop chapter fills the viewport')
                for width, height in [(1366, 768), (1024, 768), (768, 1024), (390, 844), (360, 640)]:
                    responsive = browser.new_page(viewport={'width': width, 'height': height}, is_mobile=width < 650, has_touch=width < 650)
                    responsive.on('pageerror', lambda error: errors.append(str(error)))
                    responsive.goto(BASE, wait_until='networkidle')
                    assert not responsive.evaluate('document.documentElement.scrollWidth > innerWidth')
                    responsive.screenshot(path=str(OUT / f'{width}-hero.png'))
                    nav(responsive, 'Our services')
                    if width > 1000:
                        assert responsive.locator('#services .service-card').last.evaluate('(e)=>e.getBoundingClientRect().bottom < innerHeight - 20'), 'Pricing must fit on a laptop screen'
                    responsive.screenshot(path=str(OUT / f'{width}-services.png'))
                    nav(responsive, 'Your journey')
                    expect(responsive.get_by_label('Pick-up location', exact=False)).to_be_attached()
                    responsive.screenshot(path=str(OUT / f'{width}-reservation.png'))
                    responsive.close()
                passed('Responsive layouts: laptop, compact desktop, tablet, 390px and 360px mobile')
                mobile = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
                mobile.on('pageerror', lambda error: errors.append(str(error)))
                mobile.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
                mobile.goto(BASE, wait_until='networkidle')
                mobile.get_by_role('button', name='Open navigation').click()
                mobile.locator('#mobile-nav').get_by_role('button', name='Your journey').click()
                mobile.wait_for_timeout(950)
                mobile.get_by_label('Pick-up location', exact=False).fill('Seoul Station')
                mobile.get_by_label('Destination', exact=True).fill('Grand Hyatt Seoul')
                mobile.get_by_label('Pickup time', exact=True).select_option('15:30')
                mobile.get_by_role('button', name='Continue your journey', exact=True).click()
                mobile.get_by_role('button', name='Continue your journey', exact=True).click()
                mobile.get_by_label('Full name').fill('Mobile Guest')
                mobile.get_by_label('Email address').fill('guest@example.com')
                mobile.get_by_label('Phone number').fill('+1 202 555 0123')
                mobile.locator('input[name="consent"]').check()
                with mobile.expect_response(lambda r: '/api/reservations' in r.url and r.request.method == 'POST') as response:
                    mobile.get_by_role('button', name='Request your journey', exact=True).click()
                assert response.value.status == 201, response.value.text()
                expect(mobile.locator('.success-reference')).to_be_visible()
                passed('Complete mobile reservation via the responsive menu and internally scrolling form')
                mobile.get_by_role('button', name='Privacy & reservations', exact=False).click()
                expect(mobile.get_by_role('dialog')).to_be_visible()
                mobile.keyboard.press('Escape')
                expect(mobile.get_by_role('dialog')).not_to_be_visible()
                passed('Accessible native dialog opens and closes with Escape')
                nav(mobile, 'The collection')
                touch = mobile.context.new_cdp_session(mobile)
                touch.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 170, 'y': 620}]})
                for y in [570, 510, 450, 390, 330]:
                    touch.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': 170, 'y': y}]})
                touch.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
                mobile.wait_for_timeout(1000)
                assert aligned(mobile, 'services')
                passed('A real mobile touch swipe advances one chapter')
                reduce = browser.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
                reduce.goto(BASE, wait_until='networkidle')
                assert reduce.locator('#welcome').evaluate('(e) => e.offsetHeight === innerHeight')
                reduce.mouse.move(700, 600)
                reduce.mouse.wheel(0, 100)
                reduce.wait_for_timeout(200)
                assert aligned(reduce, 'collection')
                passed('Reduced-motion preference uses a static hero and immediate navigation')
                assert not errors, errors
                passed('No browser runtime errors')
                browser.close()
        finally:
            server.terminate()
            server.wait(timeout=10)
print(json.dumps({'passed': len(checks), 'checks': checks}, indent=2))
