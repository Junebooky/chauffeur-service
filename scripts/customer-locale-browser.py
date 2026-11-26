"""Customer locale smoke and responsive layout checks against the built Vite app.
Run after npm run build: python scripts/customer-locale-browser.py
No production API or reservation write is used.
"""
from pathlib import Path
import subprocess
import json
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results' / 'customer-locale'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'http://127.0.0.1:4188'
POPULAR = json.loads((ROOT / 'server' / 'popular-places.json').read_text())
def api_route(route):
    url = route.request.url
    if '/api/places/' in url:
        body = route.request.post_data_json or {}
        ko = body.get('locale') == 'ko'
        def localized(place):
            name = place['nameKo'] if ko else place['name']
            address = place['addressKo'] if ko else place['address']
            return {'id':place['id'],'name':name,'address':address,'displayAddress':address,'latitude':place['latitude'],'longitude':place['longitude'],'source':'popular'}
        if url.endswith('/resolve'):
            return route.fulfill(json=localized(next(p for p in POPULAR if p['id']==body['id'])))
        return route.fulfill(json={'mode':'popular','results':[localized(p) for p in POPULAR[:6]],'notice':None})
    return route.fulfill(json={'rate':0.000749,'country':None,'results':[]})
def check_controls(page):
    # Only visible text in the booking panel; carousel and scroll containers may intentionally extend offscreen.
    problems = page.locator('.booking-stepper-label, .booking-time-heading, .address-field > label, .booking-outer-buttons button').evaluate_all("""nodes => nodes.filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (el.scrollWidth > el.clientWidth + 2 || r.left < -2 || r.right > innerWidth + 2);
    }).map(el => el.textContent.trim())""")
    assert not problems, f'Overflow in booking controls: {problems}'
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), 'Horizontal page overflow'

def switch_locale(page):
    button = page.locator('.language-switcher')
    if button.is_visible():
        button.click()
    else:
        page.locator('.mobile-menu-toggle').click()
        page.locator('.mobile-language-switch').click()

def open_booking(page):
    nav = page.locator('.desktop-nav button').nth(2)
    if nav.is_visible():
        nav.click()
    else:
        page.locator('.mobile-menu-toggle').click()
        page.locator('#mobile-nav button').nth(3).click()
    page.locator('.booking-glass-trigger').click()
    expect(page.locator('.booking-panel')).to_be_visible()

server = subprocess.Popen(['node', 'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4188', '--strictPort'], cwd=ROOT)
try:
    for _ in range(100):
        try:
            with urllib.request.urlopen(BASE + '/en/', timeout=1) as r:
                if r.status == 200: break
        except OSError: time.sleep(.1)
    else: raise RuntimeError('Preview server not ready')
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--no-sandbox'])
        for width, height in [(1440,900),(1024,768),(390,844),(360,800)]:
            page = browser.new_page(viewport={'width':width,'height':height}, locale='en-US', reduced_motion='reduce', is_mobile=width<500, has_touch=width<500)
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.route('**/api/**', api_route)
            page.goto(BASE+'/en/', wait_until='domcontentloaded')
            expect(page).to_have_title('JP Chauffeur Korea | Private Chauffeur Service in Seoul')
            expect(page.locator('html')).to_have_attribute('lang','en')
            expect(page.locator('.hero-heading h1')).to_contain_text('Chauffeur Service')
            expect(page.locator('.hero-book-link')).to_contain_text('Book Now')
            page.screenshot(path=str(OUT/f'{width}-en-hero.png'))
            open_booking(page)
            pickup = page.locator('input[name="pickup"]')
            expect(pickup).to_be_visible()
            pickup.fill('Incheon Airport')
            expect(page.locator('.booking-stepper-label').nth(1)).to_have_text('Vehicle')
            check_controls(page)
            page.screenshot(path=str(OUT/f'{width}-en-booking.png'))
            switch_locale(page)
            expect(page.locator('html')).to_have_attribute('lang','ko')
            expect(page).to_have_title('JP Chauffeur Korea | 프리미엄 의전 차량 서비스')
            expect(page.locator('.booking-stepper-label').nth(1)).to_have_text('차량 선택')
            expect(pickup).to_have_value('Incheon Airport')
            expect(pickup).to_have_attribute('placeholder','승차 장소를 입력하세요')
            assert '/ko/' in page.url
            check_controls(page)
            page.screenshot(path=str(OUT/f'{width}-ko-booking.png'))
            switch_locale(page)
            expect(page.locator('html')).to_have_attribute('lang','en')
            expect(pickup).to_have_value('Incheon Airport')
            check_controls(page)
            assert not errors, errors
            pickup.fill('')
            pickup.click()
            expect(page.get_by_role('option', name='Incheon Airport — Terminal 1', exact=False)).to_be_visible()
            switch_locale(page)
            pickup.click()
            option = page.get_by_role('option', name='인천국제공항 제1여객터미널', exact=False)
            expect(option).to_be_visible()
            expect(option).to_contain_text('인천광역시 중구 공항로 272')
            assert page.locator('.address-popup').evaluate("(el) => { const r=el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth+2 && el.scrollWidth <= el.clientWidth+2 }")
            page.screenshot(path=str(OUT/f'{width}-ko-popular-places.png'))
            option.click()
            expect(pickup).to_have_value('인천국제공항 제1여객터미널')
            expect(page.locator('.address-help.resolved').first).to_contain_text('인천광역시 중구 공항로 272')
            switch_locale(page)
            expect(pickup).to_have_value('Incheon Airport — Terminal 1')
            switch_locale(page)
            expect(pickup).to_have_value('인천국제공항 제1여객터미널')
            page.close()
            print(f'PASS {width}x{height}: EN/KO, booking state and visible controls', flush=True)
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=10)
