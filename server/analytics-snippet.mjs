import { GA4_MEASUREMENT_ID } from '../src/analytics.mjs'

const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c')

/**
 * Renders a self-contained inline Direct GA4 (`gtag.js` -> `G-8VWZ2SPG0Q`) loader
 * and interaction tracker for standalone SEO service and journal HTML pages.
 */
export function ga4InlineSnippet({ pageType, locale, slug = '' }) {
  const meta = safeJson({
    id: GA4_MEASUREMENT_ID,
    group: pageType,
    locale,
    slug,
  })

  return `<script>(function(){var m=${meta},p=location.pathname||'',q=new URLSearchParams(location.search||''),h=location.hostname,d=q.get('ga_debug')==='1',ok=h==='www.jpchauffeurkorea.com'||h==='jpchauffeurkorea.com';if(p==='/admin'||p.indexOf('/admin/')===0||q.get('glass-lab')==='1'||(!ok&&!d))return;window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};window.gtag('js',new Date());var prefix=m.locale==='ko'?'/ko':'',clean=m.group==='service_page'?prefix+'/services/'+m.slug+'/':prefix+'/journal/'+(m.slug?m.slug+'/':''),ref='';try{var u=new URL(document.referrer);if(u.protocol==='https:'||u.protocol==='http:')ref=u.origin+'/'}catch{}var cfg={send_page_view:false,page_location:location.origin+clean,page_referrer:ref,allow_google_signals:false,allow_ad_personalization_signals:false};if(d)cfg.debug_mode=true;window.gtag('config',m.id,cfg);var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(m.id);document.head.appendChild(s);var pv={page_path:clean,page_location:location.origin+clean,page_referrer:ref,page_title:document.title,locale:m.locale,content_group:m.group};if(m.slug)pv.content_slug=m.slug;if(d)pv.debug_mode=true;window.gtag('event','page_view',pv);document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a'):null;if(!a)return;var href=a.getAttribute('href')||'';var ev={page_location:location.origin+clean,page_referrer:ref};if(d)ev.debug_mode=true;if(href.indexOf('#reservation')!==-1){ev.cta_name='seo_reserve';ev.cta_location=m.group;ev.locale=m.locale;if(m.slug)ev.content_slug=m.slug;window.gtag('event','cta_click',ev)}else if(href.indexOf('mailto:')===0){ev.contact_location=m.group;ev.contact_method='email';ev.locale=m.locale;window.gtag('event','contact_click',ev)}else if(href.indexOf('/services/')!==-1||href.indexOf('/journal/')!==-1){ev.content_group=m.group;var link=href.split(/[?#]/,1)[0];if(!/^\\/(?:ko\\/)?(?:services|journal)(?:\\/[a-z0-9]+(?:-[a-z0-9]+)*)?\\/?$/.test(link))return;ev.link_path=link;ev.locale=m.locale;window.gtag('event','seo_content_click',ev)}})})();</script>`
}
