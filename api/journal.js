import { requireStaff, ApiError, fail } from '../server/chauffeur-supabase.mjs'
import { publicArticles, journalAdmin, journalSitemap, journalRss, renderJournal } from '../server/journal.mjs'
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 res.setHeader('X-Content-Type-Options','nosniff')
 try{
  if(req.method==='POST'){
   const staff=await requireStaff(req)
   const b=typeof req.body==='string'?JSON.parse(req.body):req.body
   if(!b||typeof b!=='object'||JSON.stringify(b).length>60000)throw new ApiError(400,'Invalid article request.')
   return res.status(200).json({data:await journalAdmin(staff,b)})
  }
  if(req.method!=='GET')throw new ApiError(405,'Method not allowed.')
  const q=new URL(req.url,'http://localhost').searchParams
  if(q.get('format')==='sitemap'){
   res.setHeader('Content-Type','application/xml; charset=utf-8')
   return res.status(200).send(await journalSitemap())
  }
  const lang=q.get('lang')||'en'
  if(q.get('format')==='rss'){
   const xml=await journalRss(lang)
   res.setHeader('Content-Type','application/rss+xml; charset=utf-8')
   return res.status(200).send(xml)
  }
  const slug=q.get('slug')||'',rows=await publicArticles(lang,slug)
  if(slug&&!rows.length)throw new ApiError(404,'Page not found.')
  const alternate=slug?Boolean((await publicArticles(lang==='en'?'ko':'en',slug)).length):true
  res.setHeader('Content-Type','text/html; charset=utf-8')
  return res.status(200).send(renderJournal(lang,rows,slug,alternate))
 }catch(error){return fail(res,error)}
}
