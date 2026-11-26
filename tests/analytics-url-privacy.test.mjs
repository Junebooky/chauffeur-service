import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { ga4InlineSnippet } from '../server/analytics-snippet.mjs'

function mockBrowser(script, pathname, search = '?email=private@example.com') {
  const location = { hostname: 'www.jpchauffeurkorea.com', origin: 'https://www.jpchauffeurkorea.com', pathname, search, href: 'https://www.jpchauffeurkorea.com'+pathname+search+'#secret' }
  const window = { location }
  let click
  const document = {
    referrer: 'https://example.org/private-account?phone=secret',
    title: 'Public page',
    head: { appendChild() {} },
    createElement() { return {} },
    addEventListener(name, fn) { if (name === 'click') click = fn },
  }
  runInNewContext(script, { window, document, location, URL, URLSearchParams })
  return { window, click(href) { click({ target: { closest: () => ({ getAttribute: () => href }) } }) } }
}

test('home bootstrap config excludes raw URL and referrer details', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  const { window } = mockBrowser(script, '/en/')
  const config = Array.from(window.dataLayer.find(x => x[0] === 'config'))[2]
  assert.equal(config.send_page_view, false)
  assert.equal(config.page_location, 'https://www.jpchauffeurkorea.com/en/')
  assert.equal(config.page_referrer, 'https://example.org/')
  assert.doesNotMatch(JSON.stringify(window.dataLayer), /private|secret/)
})

test('standalone page and content click use sanitized public paths', () => {
  const script = ga4InlineSnippet({pageType:'journal_article',locale:'ko',slug:'airport-guide'}).slice(8,-9)
  const browser = mockBrowser(script, '/ko/journal/airport-guide/')
  browser.click('/ko/services/incheon-airport-transfer/?email=private@example.com#secret')
  browser.click('https://example.org/journal/private-account')
  const calls = browser.window.dataLayer.map(x => Array.from(x))
  const views = calls.filter(x => x[0] === 'event' && x[1] === 'page_view')
  assert.equal(views.length, 1)
  assert.equal(views[0][2].page_location, 'https://www.jpchauffeurkorea.com/ko/journal/airport-guide/')
  assert.equal(views[0][2].page_referrer, 'https://example.org/')
  const clicks = calls.filter(x => x[0] === 'event' && x[1] === 'seo_content_click')
  assert.equal(clicks.length, 1)
  assert.equal(clicks[0][2].link_path, '/ko/services/incheon-airport-transfer/')
  assert.doesNotMatch(JSON.stringify(calls), /private|secret/)
})

test('home and standalone preserve only the exact public ChatGPT source marker', () => {
  const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
  const standalone = ga4InlineSnippet({pageType:'service_page',locale:'en',slug:'seoul-chauffeur-service'}).slice(8,-9)
  for (const [script,path] of [[home,'/en/'],[standalone,'/services/seoul-chauffeur-service/']]) {
    for (const search of ['?utm_source=chatgpt.com&email=private@example.com&utm_campaign=secret', '?utm_source=chatgpt.com&utm_medium=referral']) {
      const {window} = mockBrowser(script,path,search)
      const cfg = Array.from(window.dataLayer.find(x=>x[0]==='config'))[2]
      assert.equal(cfg.campaign_source,'chatgpt.com')
      assert.equal(cfg.campaign_medium,'referral')
      assert.equal(cfg.page_location,'https://www.jpchauffeurkorea.com'+path)
      assert.doesNotMatch(JSON.stringify(window.dataLayer),/private|secret|utm_campaign|utm_source/)
    }
    for (const search of ['?utm_source=chatgpt.com.evil.test','?utm_source=private@example.com','?utm_source=chatgpt.com&utm_source=private','?utm_source=chatgpt.com&utm_medium=cpc','?utm_source=chatgpt.com&utm_medium=referral&utm_medium=private']) {
      const {window} = mockBrowser(script,path,search)
      const cfg = Array.from(window.dataLayer.find(x=>x[0]==='config'))[2]
      assert.equal(cfg.campaign_source,undefined)
      assert.equal(cfg.campaign_medium,undefined)
      assert.doesNotMatch(JSON.stringify(window.dataLayer),/private|evil|secret/)
    }
  }
})
