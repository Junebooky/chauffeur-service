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

def choose_place(page, label, query, result, touch=False):
    field = page.get_by_role('combobox', name=label, exact=True)
    field.fill(query)
    choice = page.get_by_role('option', name=result, exact=False)
    choice.tap() if touch else choice.click()
    expect(field).to_have_attribute('aria-expanded', 'false')

def aligned(page, id):
    return page.evaluate('(id) => Math.abs(document.querySelector("main").scrollTop - document.getElementById(id).offsetTop) < 3', id)

with tempfile.TemporaryDirectory(prefix='chauffeur-browser-') as tmp:
    env = {**os.environ, 'NODE_ENV': 'production', 'PORT': '4183', 'HOST': '127.0.0.1', 'DATABASE_PATH': str(Path(tmp) / 'requests.sqlite'), 'GOOGLE_MAPS_API_KEY': ''}
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
                video = page.locator('#welcome video')
                expect(video).to_be_visible()
                assert video.evaluate('(v) => v.muted && v.playsInline && !v.loop')
                page.wait_for_function('document.querySelector("#welcome video").ended')
                assert video.evaluate('(v) => v.currentTime > 1.5 && v.duration < 3')
                ended_at = video.evaluate('(v) => v.currentTime')
                page.wait_for_timeout(250)
                assert video.evaluate('(v) => v.currentTime') == ended_at
                assert page.locator('.discover-button').count() == 0
                assert page.locator('#welcome').evaluate('(e) => e.offsetHeight === innerHeight')
                passed('Welcome video autoplays once, holds its last frame, and has no down-arrow button or extra scroll track')
                page.mouse.move(700, 650)
                page.mouse.wheel(0, 100)
                page.wait_for_timeout(1000)
                assert aligned(page, 'collection')
                # Small continuous trackpad deltas previously got cancelled forever.
                for _ in range(30):
                    page.mouse.wheel(0, 3)
                    page.wait_for_timeout(15)
                page.wait_for_timeout(1000)
                assert aligned(page, 'services'), 'Small continuous wheel deltas must advance the next chapter'
                page.mouse.wheel(0, 100)
                page.wait_for_timeout(1000)
                assert aligned(page, 'reservation')
                passed('Wheel navigation works from the finished video through all chapters, including small continuous trackpad deltas')
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
                colours = page.evaluate("""() => {
                    const style = (selector) => {
                        const s = getComputedStyle(document.querySelector(selector));
                        return { background: s.backgroundColor, image: s.backgroundImage };
                    };
                    return { page: style('#reservation'), panel: style('.booking-panel'), card: style('.service-card'), featured: style('.service-card.featured'), gold: getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() };
                }""")
                assert colours['page']['background'] == 'rgb(8, 9, 11)'
                assert colours['panel']['background'] == 'rgb(17, 19, 22)'
                assert colours['card']['background'] == 'rgb(17, 19, 22)'
                assert colours['featured']['background'] == 'rgb(21, 23, 27)'
                assert all(colours[key]['image'] == 'none' for key in ['page', 'panel', 'card', 'featured'])
                assert colours['gold'] == '#d4af37'
                passed('Page and card backgrounds are dark neutral charcoal; gold accents remain unchanged')

                pickup_input = page.get_by_role('combobox', name='Pick-up location', exact=True)
                pickup_input.fill('Unconfirmed text')
                page.get_by_role('button', name='Continue your journey', exact=True).click()
                expect(pickup_input).to_be_focused()
                passed('Unselected address text cannot advance the booking')
                choose_place(page, 'Pick-up location', '인천공항 2터미널', 'Incheon Airport — Terminal 2')
                choose_place(page, 'Destination', '首尔四季', 'Four Seasons Hotel Seoul')
                pickup_input.focus()
                page.wait_for_timeout(250)
                focus_style = pickup_input.evaluate('(e) => { const s = getComputedStyle(e); return [s.outlineStyle, s.boxShadow, s.borderColor] }')
                assert focus_style == ['none', 'none', 'rgb(199, 174, 123)'], focus_style
                passed('Multilingual address suggestions resolve to real locations and inputs use a single focus border')
                page.get_by_label('Pickup time', exact=True).select_option('09:30')
                destination_input = page.get_by_role('combobox', name='Destination', exact=True)
                destination_input.fill('Some other street')
                page.get_by_role('button', name='Continue your journey', exact=True).click()
                expect(destination_input).to_be_focused()
                choose_place(page, 'Destination', 'Four Seasons', 'Four Seasons Hotel Seoul')
                passed('Editing a selected location requires confirming a new suggestion')
                page.get_by_label('Flight number', exact=False).fill('KE 902')
                page.get_by_role('button', name='Continue your journey', exact=True).click()
                expect(page.locator('.fleet-stage').get_by_role('button', name='First Class Sedan', exact=False)).to_be_visible()
                fleet = page.get_by_role('region', name='Interactive vehicle selection')
                fleet.focus()
                page.keyboard.press('ArrowRight')
                expect(page.locator('.fleet-stage').get_by_role('button', name='First Class Sedan', exact=False)).to_have_attribute('aria-pressed', 'true')
                page.keyboard.press('ArrowLeft')
                expect(page.locator('.fleet-stage').get_by_role('button', name='Executive Sedan', exact=False)).to_have_attribute('aria-pressed', 'true')
                fleet.get_by_role('button', name='Next vehicle', exact=True).click()
                page.locator('.booking-fields').evaluate('(e) => e.scrollTop = 0')
                page.wait_for_timeout(700)
                page.screenshot(path=str(OUT / 'desktop-vehicle-carousel.png'))
                passed('Convex vehicle carousel changes selection using keyboard and arrow controls')
                page.locator('.fleet-stage').get_by_role('button', name='First Class Sedan', exact=False).click()
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
                mobile.mouse.move(180, 450)
                mobile.mouse.wheel(0, 220)
                mobile.wait_for_timeout(300)
                assert mobile.locator('.booking-panel').evaluate('(e) => e.scrollTop > 0')
                assert aligned(mobile, 'reservation')
                passed('Wheel input scrolls the long mobile booking form internally')
                choose_place(mobile, 'Pick-up location', 'ソウル駅', 'Seoul Station', touch=True)
                choose_place(mobile, 'Destination', '그랜드 하얏트', 'Grand Hyatt Seoul', touch=True)
                mobile.get_by_label('Pickup time', exact=True).select_option('15:30')
                mobile.get_by_role('button', name='Continue your journey', exact=True).click()
                stage = mobile.locator('.fleet-stage')
                stage.scroll_into_view_if_needed()
                rect = stage.bounding_box()
                gesture = mobile.context.new_cdp_session(mobile)
                cy = rect['y'] + rect['height'] * .5
                gesture.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': rect['x'] + rect['width'] * .8, 'y': cy}]})
                for portion in [.7, .55, .4, .2]:
                    gesture.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': rect['x'] + rect['width'] * portion, 'y': cy}]})
                    mobile.wait_for_timeout(25)
                gesture.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
                expect(mobile.locator('.fleet-stage').get_by_role('button', name='First Class Sedan', exact=False)).to_have_attribute('aria-pressed', 'true')
                mobile.wait_for_timeout(700)
                mobile.screenshot(path=str(OUT / 'mobile-vehicle-carousel.png'))
                mobile.get_by_role('button', name='Select Executive Sedan', exact=True).click()
                passed('A horizontal mobile swipe changes the selected vehicle')
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
                assert reduce.locator('#welcome video').count() == 0
                expect(reduce.locator('#welcome .hero-visual img')).to_be_visible()
                reduce.mouse.move(700, 600)
                reduce.mouse.wheel(0, 100)
                reduce.wait_for_timeout(200)
                assert aligned(reduce, 'collection')
                passed('Reduced-motion preference uses a static hero and working native scrolling')
                blocked = browser.new_page(viewport={'width': 1440, 'height': 900})
                blocked.on('pageerror', lambda error: errors.append(str(error)))
                blocked.add_init_script("""window.originalMediaPlay = HTMLMediaElement.prototype.play;
                    HTMLMediaElement.prototype.play = function() { return Promise.reject(new DOMException('Autoplay declined', 'NotAllowedError')); };""")
                blocked.goto(BASE, wait_until='networkidle')
                expect(blocked.get_by_role('button', name='Play welcome film')).to_be_visible()
                blocked.mouse.move(700, 600)
                blocked.mouse.wheel(0, 100)
                blocked.wait_for_timeout(1000)
                assert aligned(blocked, 'collection')
                passed('Autoplay refusal offers a play button and never locks scrolling')
                unavailable = browser.new_page(viewport={'width': 1440, 'height': 900})
                unavailable.on('pageerror', lambda error: errors.append(str(error)))
                unavailable.route('**/media/welcome.mp4', lambda route: route.fulfill(status=404, body=''))
                unavailable.goto(BASE, wait_until='networkidle')
                expect(unavailable.locator('#welcome .hero-visual img')).to_be_visible()
                unavailable.mouse.move(700, 600)
                unavailable.mouse.wheel(0, 100)
                unavailable.wait_for_timeout(1000)
                assert aligned(unavailable, 'collection')
                passed('A failed video request falls back to the still image without locking scrolling')
                assert not errors, errors
                passed('No browser runtime errors')
                browser.close()
        finally:
            server.terminate()
            server.wait(timeout=10)
print(json.dumps({'passed': len(checks), 'checks': checks}, indent=2))
