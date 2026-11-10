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
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
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

def open_glass_booking(page):
    trigger = page.locator('#reservation .booking-glass-trigger')
    expect(trigger).to_be_visible()
    assert page.locator('#reservation .booking-panel').count() == 0
    trigger.click()
    expect(page.locator('#reservation .booking-panel')).to_be_visible()
    expect(page.locator('#reservation .booking-glass-stage')).to_have_class('booking-glass-stage is-expanded')

def aligned(page, id):
    return page.evaluate('(id) => Math.abs(document.querySelector("main").scrollTop - document.getElementById(id).offsetTop) < 3', id)

with tempfile.TemporaryDirectory(prefix='chauffeur-browser-') as tmp:
    env = {**os.environ, 'NODE_ENV': 'production', 'PORT': '4183', 'HOST': '127.0.0.1', 'DATABASE_PATH': str(Path(tmp) / 'requests.sqlite'), 'GOOGLE_MAPS_API_KEY': '', 'GOOGLE_PLACES_API_KEY': ''}
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
                open_glass_booking(page)
                expect(page.locator('select[name="service"]')).to_have_value('airport')
                passed('Pricing selection carries through to reservation')
                # Translucent surfaces must stay dark, legible, and deliberately restrained.
                assert page.locator('.booking-glass-surface').evaluate('(e) => getComputedStyle(e).borderRadius') != '0px'
                assert page.locator('#reservation').evaluate('(e) => getComputedStyle(e).backgroundImage') != 'none'
                assert page.locator('.booking-panel').evaluate('(e) => getComputedStyle(e).backgroundColor') in ['rgba(0, 0, 0, 0)', 'transparent']
                assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()") == '#abb8c9'
                passed('A option dark Liquid Glass surface and metallic silver controls')

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
                assert focus_style == ['none', 'none', 'rgb(197, 160, 89)'], focus_style
                passed('Multilingual address suggestions resolve to real locations and inputs use a single focus border')
                page.get_by_label('Pick-up time', exact=True).select_option('09:30')
                destination_input = page.get_by_role('combobox', name='Destination', exact=True)
                destination_input.fill('Some other street')
                page.get_by_role('button', name='Continue your journey', exact=True).click()
                expect(destination_input).to_be_focused()
                choose_place(page, 'Destination', 'Four Seasons', 'Four Seasons Hotel Seoul')
                passed('Editing a selected location requires confirming a new suggestion')
                page.get_by_label('Flight number', exact=False).fill('KE 902')
                page.get_by_role('button', name='Continue your journey', exact=True).click()
                expect(page.locator('.fleet-stage').get_by_role('button', name='Genesis G90', exact=False)).to_be_visible()
                fleet = page.get_by_role('region', name='Interactive vehicle selection')
                fleet.focus()
                page.keyboard.press('ArrowRight')
                page.keyboard.press('ArrowRight')
                expect(page.locator('.fleet-stage').get_by_role('button', name='Genesis G90', exact=False)).to_have_attribute('aria-pressed', 'true')
                page.keyboard.press('Home')
                expect(page.locator('.fleet-stage').get_by_role('button', name='Staria Lounge Limousine Hybrid', exact=False)).to_have_attribute('aria-pressed', 'true')
                fleet.get_by_role('button', name='Next vehicle', exact=True).click()
                page.locator('.booking-fields').evaluate('(e) => e.scrollTop = 0')
                page.wait_for_timeout(700)
                page.screenshot(path=str(OUT / 'desktop-vehicle-carousel.png'))
                passed('Convex vehicle carousel changes selection using keyboard and arrow controls')
                page.get_by_role('button', name='Select Genesis G90 (03)', exact=True).click()
                page.get_by_role('switch', name='Child Safety Seat', exact=False).click()
                page.get_by_role('switch', name='Fluent English Chauffeur', exact=False).click()
                expect(page.locator('.summary-total strong')).to_have_text('₩420,000')
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
                assert result['total'] == 420000
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
                    open_glass_booking(responsive)
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
                open_glass_booking(mobile)
                mobile.mouse.move(180, 450)
                mobile.mouse.wheel(0, 220)
                mobile.wait_for_timeout(300)
                assert mobile.locator('.booking-panel').evaluate('(e) => e.scrollTop > 0')
                assert aligned(mobile, 'reservation')
                passed('Wheel input scrolls the long mobile booking form internally')
                choose_place(mobile, 'Pick-up location', 'ソウル駅', 'Seoul Station', touch=True)
                choose_place(mobile, 'Destination', '그랜드 하얏트', 'Grand Hyatt Seoul', touch=True)
                mobile.get_by_label('Pick-up time', exact=True).select_option('15:30')
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
                expect(mobile.locator('.fleet-stage').get_by_role('button', name='Carnival Hi-Limousine Hybrid', exact=False)).to_have_attribute('aria-pressed', 'true')
                mobile.wait_for_timeout(700)
                mobile.screenshot(path=str(OUT / 'mobile-vehicle-carousel.png'))
                mobile.get_by_role('button', name='Select Staria Lounge Limousine Hybrid (01)', exact=True).click()
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
                for width, height in [(1440, 900), (390, 844)]:
                    daily = browser.new_page(viewport={'width': width, 'height': height}, is_mobile=width < 650, has_touch=width < 650)
                    daily.on('pageerror', lambda error: errors.append(str(error)))
                    daily.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
                    daily.goto(BASE, wait_until='networkidle')
                    nav(daily, 'Our services')
                    assert daily.locator('.service-tax-notice').count() == 3
                    expect(daily.locator('.services-footnote')).to_contain_text('TAX excluded')
                    nav(daily, 'Your journey')
                    open_glass_booking(daily)
                    start_date = datetime.now(ZoneInfo('Asia/Seoul')).date() + timedelta(days=1)
                    last_date = start_date + timedelta(days=2)
                    daily.get_by_label('Travel over multiple days').check()
                    daily.get_by_label('Last day', exact=True).fill(last_date.isoformat())
                    # Use distinct times so both viewport checks can persist their actual requests.
                    daily.get_by_label('Pick-up time', exact=True).select_option('18:00' if width > 650 else '09:00')
                    choose_place(daily, 'Pick-up location', 'Seoul Station', 'Seoul Station')
                    choose_place(daily, 'Destination', 'COEX', 'COEX')
                    daily.get_by_role('button', name='Continue your journey', exact=True).click()
                    daily.get_by_label('Choose a vehicle by date', exact=True).check()
                    expect(daily.locator('.daily-vehicle-day')).to_have_count(3)
                    daily.get_by_role('button', name='Select Mercedes Sprinter 319 (04)', exact=True).click()
                    expect(daily.locator('.fleet-selected-meta')).to_contain_text('6 guests')
                    expect(daily.locator('.summary-total strong')).to_have_text('₩990,000')
                    daily.locator('.daily-vehicle-day').nth(1).click()
                    daily.get_by_role('button', name='Select Genesis G90 (03)', exact=True).click()
                    daily.locator('.daily-vehicle-day').nth(2).click()
                    daily.get_by_role('button', name='Select Mercedes Sprinter 519 (05)', exact=True).click()
                    expect(daily.locator('.fleet-selected-meta')).to_contain_text('9 guests')
                    daily.get_by_label('Same vehicle every day', exact=True).check()
                    expect(daily.locator('.summary-total strong')).to_have_text('₩840,000')
                    daily.get_by_label('Choose a vehicle by date', exact=True).check()
                    expect(daily.locator('.daily-vehicle-day').nth(0)).to_contain_text('Mercedes Sprinter 319')
                    expect(daily.locator('.daily-vehicle-day').nth(1)).to_contain_text('Genesis G90')
                    expect(daily.locator('.daily-vehicle-day').nth(2)).to_contain_text('Mercedes Sprinter 519')
                    expect(daily.locator('.summary-total')).to_contain_text('TAX excluded')
                    daily.locator('.booking-fields').evaluate('(e) => e.scrollTop = 0')
                    daily.screenshot(path=str(OUT / f'{width}-daily-vehicles.png'))
                    daily.get_by_role('button', name='Continue your journey', exact=True).click()
                    daily.get_by_label('Full name').fill('Multi Day Traveller')
                    daily.get_by_label('Email address').fill('multi@example.com')
                    daily.get_by_label('Phone number', exact=True).fill('+82 10 9876 5432')
                    if width > 650:
                        daily.get_by_role('radio', name='LINE', exact=True).check()
                        daily.locator('input[name="consent"]').check()
                        daily.get_by_role('button', name='Request your journey', exact=True).click()
                        expect(daily.get_by_label('LINE ID', exact=True)).to_be_focused()
                        daily.get_by_label('LINE ID', exact=True).fill('traveller-line')
                    else:
                        daily.get_by_role('radio', name='WhatsApp', exact=True).check()
                        expect(daily.get_by_label('WhatsApp number', exact=False)).to_be_empty()
                        daily.locator('input[name="consent"]').check()
                    daily.screenshot(path=str(OUT / f'{width}-messenger-contact.png'))
                    with daily.expect_response(lambda r: '/api/reservations' in r.url and r.request.method == 'POST') as response:
                        daily.get_by_role('button', name='Request your journey', exact=True).click()
                    assert response.value.status == 201, response.value.text()
                    result = response.value.json()
                    assert result['total'] == 1270000
                    assert result['taxIncluded'] is False
                    assert [day['vehicle'] for day in result['journeys']] == ['Mercedes Sprinter 319', 'Genesis G90', 'Mercedes Sprinter 519']
                    expect(daily.locator('.success-details')).to_contain_text('TAX excluded')
                    expect(daily.locator('.success-details')).to_contain_text('Mercedes Sprinter 519')
                    with daily.expect_download() as download:
                        daily.get_by_role('button', name='Save to calendar', exact=False).click()
                    calendar = Path(download.value.path()).read_text()
                    assert calendar.count('BEGIN:VEVENT') == 3
                    assert calendar.count('STATUS:TENTATIVE') == 3
                    assert 'Mercedes Sprinter 319' in calendar and 'Mercedes Sprinter 519' in calendar
                    # Check persisted data, not just the request or response.
                    import sqlite3
                    with sqlite3.connect(Path(tmp) / 'requests.sqlite') as db:
                        row = db.execute('SELECT details FROM reservations WHERE id = ?', (result['reference'],)).fetchone()
                        details = json.loads(row[0])
                        assert details['contactMethod'] == ('line' if width > 650 else 'whatsapp')
                        assert details['messengerContact'] == ('traveller-line' if width > 650 else '+82 10 9876 5432')
                        assert db.execute('SELECT COUNT(*) FROM reservation_legs WHERE reservation_id = ?', (result['reference'],)).fetchone()[0] == 3
                    assert not daily.evaluate('document.documentElement.scrollWidth > innerWidth')
                    passed(f'{width}px: daily vehicles, independent selections, tax disclosure, messenger validation, SQLite persistence and three calendar events')
                    daily.close()
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
