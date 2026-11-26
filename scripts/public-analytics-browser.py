"""Read-only production smoke. Intercept the GA library and every external/API
request. Inspect queued client events, never send analytics or create a booking.
This does not test GA4 ingestion or server-side deduplication.
"""
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

BASE = 'https://www.jpchauffeurkorea.com'
HOST = 'www.jpchauffeurkorea.com'
MARKER = 'qa-only-not-personal'
GA_ID = 'G-8VWZ2SPG0Q'

def gate(route):
    req = route.request
    u = urlsplit(req.url)
    if u.hostname == 'www.googletagmanager.com' and u.path == '/gtag/js':
        return route.fulfill(status=200, content_type='application/javascript', body='/* analytics intentionally not loaded */')
    if u.scheme != 'https' or u.hostname != HOST or req.method != 'GET':
        return route.abort()
    if u.path.startswith('/api/'):
        return route.fulfill(json={'rate':0.000749,'country':None,'results':[]})
    return route.continue_()

def queue(page):
    return page.evaluate("() => (window.dataLayer || []).map(x => Array.from(x))")
def events(page, name):
    return [x[2] for x in queue(page) if len(x)>2 and x[0]=='event' and x[1]==name]
def config(page):
    rows = [x[2] for x in queue(page) if len(x)>2 and x[0]=='config' and x[1]==GA_ID]
    assert len(rows)==1, 'expected one GA config'
    assert rows[0]['send_page_view'] is False
    return rows[0]
def safe(page):
    import json
    assert MARKER not in json.dumps(queue(page), default=str), 'raw test query leaked to analytics queue'
    assert not events(page,'generate_lead'), 'no reservation should have been generated'
def nav(page,path):
    res=page.goto(BASE+path,wait_until='domcontentloaded')
    assert res and res.status==200, 'public navigation failed'
    page.wait_for_function("() => (window.dataLayer || []).some(x => x[0]==='event' && x[1]==='page_view')")
def check_view(page,path,lang):
    rows=events(page,'page_view')
    assert len(rows)==1, 'expected exactly one initial explicit page view'
    assert rows[0]['page_path']==path
    assert rows[0]['page_location']==BASE+path
    assert rows[0]['locale']==lang
    safe(page)

with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':900},service_workers='block',locale='ko-KR',reduced_motion='reduce')
    context.route('**/*',gate)
    page=context.new_page()
    nav(page,'/?utm_source=chatgpt.com&qa_marker='+MARKER)
    expect(page.locator('html')).to_have_attribute('lang','en')
    expect(page.locator('.hero-book-link')).to_be_visible()
    assert config(page)['campaign_source']=='chatgpt.com'
    assert config(page)['campaign_medium']=='referral'
    check_view(page,'/en/','en')
    page.locator('.language-switcher').click()
    expect(page.locator('html')).to_have_attribute('lang','ko')
    page.wait_for_function("() => (window.dataLayer || []).filter(x=>x[0]==='event'&&x[1]==='page_view').length>=2")
    rows=events(page,'page_view')
    assert [x['page_path'] for x in rows]==['/en/','/ko/']
    assert len(events(page,'language_switch'))==1
    safe(page)
    print('PASS live SPA: root English, language switch, explicit pageviews, sanitized ChatGPT source',flush=True)
    for path,lang in [('/services/seoul-chauffeur-service/','en'),('/ko/services/incheon-airport-transfer/','ko'),('/journal/','en'),('/ko/journal/','ko')]:
        nav(page,path+'?utm_source=chatgpt.com&qa_marker='+MARKER)
        assert config(page)['campaign_source']=='chatgpt.com'
        check_view(page,path,lang)
        print('PASS live standalone analytics: '+path,flush=True)
    context.close()
    browser.close()
