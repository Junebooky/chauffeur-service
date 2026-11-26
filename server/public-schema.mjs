// Shared public entity identifiers. No unverified addresses, reviews, prices or availability.
export const siteOrigin = 'https://www.jpchauffeurkorea.com'
export const organizationId = siteOrigin + '/#organization'
export const websiteId = siteOrigin + '/#website'
const ref = id => ({ '@id': id })
const organization = () => ({ '@type': 'Organization', '@id': organizationId, name: 'JP Chauffeur Korea', url: siteOrigin + '/' })
const website = () => ({ '@type': 'WebSite', '@id': websiteId, name: 'JP Chauffeur Korea', url: siteOrigin + '/', publisher: ref(organizationId), inLanguage: ['en', 'ko'] })
const page = ({url, lang, title, description, type='WebPage'}) => ({
  '@type': type, '@id': url+'#webpage', url, name: title, description, inLanguage: lang, isPartOf: ref(websiteId), publisher: ref(organizationId),
})
const graph = (...nodes) => ({'@context':'https://schema.org', '@graph':[organization(), website(), ...nodes]})

export function homeSchema({url,lang,title,description}) {
  return graph({...page({url,lang,title,description}),about:ref(organizationId)})
}

export function serviceSchema({url,lang,title,description}) {
  const serviceId = url+'#service'
  return graph(
    {...page({url,lang,title,description}),mainEntity:ref(serviceId)},
    {'@type':'Service','@id':serviceId,name:title,description,url,provider:ref(organizationId),areaServed:{'@type':'Country',name:'South Korea'},mainEntityOfPage:ref(url+'#webpage')},
  )
}

export function journalSchema({url,lang,title,description,item}) {
  if (!item) return graph(page({url,lang,title,description,type:'CollectionPage'}))
  const articleId=url+'#article'
  return graph(
    {...page({url,lang,title,description}),mainEntity:ref(articleId)},
    {'@type':'Article','@id':articleId,headline:title,description,url,inLanguage:lang,datePublished:item.publish_at,author:ref(organizationId),publisher:ref(organizationId),mainEntityOfPage:ref(url+'#webpage')},
  )
}

// Escape markup-significant characters even when an approved article contains HTML-like text.
export function jsonLdScript(data) {
  return '<script type="application/ld+json" data-public-schema>'+JSON.stringify(data).replace(/</g,'\\u003c')+'</script>'
}
