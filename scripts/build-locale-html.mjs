import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { localeSeo, origin } from '../src/i18n/seo.mjs'
export function localeHtml(source, locale) {
  const meta=localeSeo[locale], url=origin+(locale==='ko'?'/ko/':'/')
  return source.replace(/<html lang="[^"]*"/, '<html lang="'+locale+'"')
    .replace(/<title>[^<]*<\/title>/, '<title>'+meta.title+'</title>')
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, '$1'+meta.description+'$2')
    .replace(/(<link rel="canonical" href=")[^"]*(")/, '$1'+url+'$2')
    .replace(/(<meta property="og:title" content=")[^"]*(")/, '$1'+meta.title+'$2')
    .replace(/(<meta property="og:description" content=")[^"]*(")/, '$1'+meta.description+'$2')
    .replace(/(<meta property="og:url" content=")[^"]*(")/, '$1'+url+'$2')
    .replace(/(<meta property="og:locale" content=")[^"]*(")/, '$1'+meta.ogLocale+'$2')
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source=readFileSync('dist/index.html','utf8')
  writeFileSync('dist/index.html',localeHtml(source,'en'))
  for(const locale of ['en','ko']){
    mkdirSync('dist/'+locale,{recursive:true})
    writeFileSync('dist/'+locale+'/index.html',localeHtml(source,locale))
  }
}
