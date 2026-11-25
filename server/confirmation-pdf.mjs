// Branded A4 confirmation: same banner asset, palette and itinerary hierarchy as the email.
// A lightweight server PDF renderer, without a browser or network dependencies.
import { readFileSync } from 'node:fs'
import catalog from '../src/catalog.json' with { type:'json' }
const W=595,H=842,M=30,R=W-M,C=100,PRICE=104,TW=R-PRICE-C-12
const palette={dark:'#171b1d',olive:'#899766',lightOlive:'#b8c6a6',ink:'#1d2422',body:'#59625d',muted:'#717b73',rule:'#e1e5df',footer:'#f7f8f6',white:'#ffffff'}
const rgb=h=>[1,3,5].map(i=>(parseInt(h.slice(i,i+2),16)/255).toFixed(4)).join(' ')
const clean=s=>String(s??'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim()
const nameOf=(items,id)=>items.find(x=>x.id===id)?.name||String(id??'')
const money=n=>n==null?'Quote on request':'KRW '+Number(n).toLocaleString('en-US')
const date=s=>{const d=new Date(s+'T00:00:00Z');return Number.isNaN(d.getTime())?clean(s):new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(d)}
const ascii=c=>/^[\x20-\x7e\xb7]$/.test(c)
const normal=s=>clean(s).replace(/[–—]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"')
const latin=s=>Buffer.from(s,'latin1').toString('hex')
const utf16=s=>Buffer.from(s,'utf16le').swap16().toString('hex')
// Standard Helvetica and Helvetica-Bold AFM advance widths, plus Symbol arrow.
// This allows word wrapping and exact right alignment without a browser.
const regular=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584]
const boldWidths=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584]
const glyph=(c,bold)=>c==='→'?987:c==='·'?278:ascii(c)?(bold?boldWidths:regular)[c.charCodeAt(0)-32]:1000
const measure=(s,size,bold=false)=>Array.from(s).reduce((n,c)=>n+glyph(c,bold)*size/1000,0)
const wrap=(value,width,size,bold=false)=>{
 const words=normal(value).split(' ').filter(Boolean),out=[];let line=''
 for(const word of words){
  const joined=line?line+' '+word:word
  if(measure(joined,size,bold)<=width){line=joined;continue}
  if(line){out.push(line);line=''}
  for(const c of word){
   if(line&&measure(line+c,size,bold)>width){out.push(line);line=''}
   line+=c
  }
 }
 if(line)out.push(line)
 return out
}
function jpegSize(buf){
 if(!buf||buf[0]!==255||buf[1]!==216)return null
 for(let p=2;p+8<buf.length;){
  if(buf[p++]!==255)return null
  while(buf[p]===255)p++
  const marker=buf[p++]
  if(marker===0xda||marker===0xd9)return null
  const n=buf.readUInt16BE(p)
  if(n<2||p+n>buf.length)return null
  if([0xc0,0xc1,0xc2].includes(marker)&&n>=8)return {height:buf.readUInt16BE(p+3),width:buf.readUInt16BE(p+5),components:buf[p+7]}
  p+=n
 }
 return null
}
let banner
try{banner=readFileSync(new URL('./assets/email-header-bg.jpg',import.meta.url))}catch{/* text fallback */}
export function buildConfirmationPdf(snapshot){
 const objects=[null],add=value=>{objects.push(Buffer.isBuffer(value)?value:Buffer.from(value,'ascii'));return objects.length-1}
 const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
 const bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
 const desc=add('<< /Type /FontDescriptor /FontName /HYSMyeongJo-Medium /Flags 6 /FontBBox [0 -160 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -160 /CapHeight 700 /StemV 80 >>')
 const cid=add('<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HYSMyeongJo-Medium /CIDSystemInfo << /Registry (Adobe) /Ordering (Korea1) /Supplement 2 >> /FontDescriptor '+desc+' 0 R /DW 1000 >>')
 const cjk=add('<< /Type /Font /Subtype /Type0 /BaseFont /HYSMyeongJo-Medium /Encoding /UniKS-UCS2-H /DescendantFonts ['+cid+' 0 R] >>')
 const dimensions=jpegSize(banner)
 const image=dimensions&&dimensions.components===3?add(Buffer.concat([Buffer.from('<< /Type /XObject /Subtype /Image /Width '+dimensions.width+' /Height '+dimensions.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+banner.length+' >>\nstream\n'),banner,Buffer.from('\nendstream')])):null
 const symbol=add('<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>')
 const pagesId=add(''),pageIds=[]
 let commands=[],y=0
 const rect=(x,b,w,h,color)=>commands.push(rgb(color)+' rg '+x+' '+b+' '+w+' '+h+' re f')
 const line=(value,x,b,size=10,color=palette.ink,heavy=false)=>{
  const t=normal(value);let cursor=x,run='',kind=''
  const flush=()=>{if(!run)return;const f=kind==='arrow'?'F4':kind==='latin'?(heavy?'F2':'F1'):'F3';const encoded=kind==='arrow'?'ae'.repeat(run.length):kind==='latin'?latin(run):utf16(run);commands.push('BT /'+f+' '+size+' Tf '+rgb(kind==='arrow'?palette.olive:color)+' rg 1 0 0 1 '+cursor.toFixed(2)+' '+b.toFixed(2)+' Tm <'+encoded+'> Tj ET');cursor+=measure(run,size,heavy);run=''}
  for(const c of t){const next=c==='→'?'arrow':ascii(c)?'latin':'cjk';if(run&&next!==kind)flush();kind=next;run+=c}flush()
 }
 const rule=(b,color=palette.rule)=>rect(M,b,R-M,.6,color)
 const footer=()=>{
  rect(0,0,W,38,palette.footer)
  line('J Production | CHAUFFEUR | '+snapshot.reference,M,16,8,palette.muted)
  line('Page '+(pageIds.length+1),R-39,16,8,palette.muted)
 }
 const finish=()=>{
  footer()
  const bytes=Buffer.from(commands.join('\n'),'ascii')
  const stream=add(Buffer.concat([Buffer.from('<< /Length '+bytes.length+' >>\nstream\n'),bytes,Buffer.from('\nendstream')]))
  pageIds.push(add('<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /Font << /F1 '+font+' 0 R /F2 '+bold+' 0 R /F3 '+cjk+' 0 R /F4 '+symbol+' 0 R >>'+(image?' /XObject << /Banner '+image+' 0 R >>':'')+' >> /Contents '+stream+' 0 R >>'))
 }
 const start=first=>{
  commands=[]
  if(first){
   const bh=image?Math.min(130,W*dimensions.height/dimensions.width):65
   const h=bh+83
   rect(0,H-h,W,h,palette.dark)
   if(image)commands.push('q '+W+' 0 0 '+bh.toFixed(2)+' 0 '+(H-bh).toFixed(2)+' cm /Banner Do Q')
   else{line('J Production',M,H-30,18,palette.white);line('Team of Premium Chauffeur Service',M,H-44,9,'#c4cbd4')}
   line('RESERVATION CONFIRMED',M,H-bh-15,9,palette.lightOlive,true)
   line('Your journey is confirmed.',M,H-bh-39,24,palette.white)
   line('Reference '+snapshot.reference+' · Confirmed',M,H-bh-62,10,'#d5dcd5')
   y=H-h-27
  }else{
   rect(0,H-64,W,64,palette.dark)
   line('J Production | RESERVATION CONFIRMED',M,H-25,11,palette.white,true)
   line('Reference '+snapshot.reference+' | Itinerary continued',M,H-44,9,palette.lightOlive)
   y=H-83
  }
 }
 const ensure=h=>{if(y-h<53){finish();start(false)}}
 const para=(value,size=10,color=palette.body,heavy=false,leading=size+4)=>{
  for(const row of wrap(value,R-M,size,heavy)){ensure(leading);line(row,M,y,size,color,heavy);y-=leading}
 }
 const heading=(s)=>{ensure(24);line(s,M,y,10,palette.olive,true);y-=20}
 start(true)
 heading('GUEST DETAILS')
 para(snapshot.name,17,palette.ink,true,20)
 para('Thank you for choosing CHAUFFEUR. We look forward to welcoming you.',10,palette.body,false,14)
 y-=12
 heading('DAILY ITINERARY · '+snapshot.journeys.length+' '+(snapshot.journeys.length===1?'DAY':'DAYS'))
 const linesFor=d=>{
  const lines=[]
  const addLines=(value,size,color,heavy=false,space=0)=>{const rows=wrap(value,TW,size,heavy);rows.forEach((t,i)=>lines.push({t,size,color,heavy,leading:size+3,space:i===0?space:0}))}
  addLines(date(d.date)+' · '+d.time+' KST',12,palette.ink,true)
  addLines(nameOf(catalog.services,d.service)+' · '+nameOf(catalog.vehicles,d.vehicle),10,palette.body,false,2)
  const pickup=d.pickupPlace?.name||d.pickup||'',destination=d.destinationPlace?.name||d.destination||''
  addLines(pickup+' → '+destination,10,palette.ink,false,5)
  if(d.pickup!==pickup||d.destination!==destination)addLines([d.pickup,d.destination].filter(Boolean).join(' → '),8.5,palette.muted,false,1)
  if(d.flight)addLines('Flight '+d.flight,9,palette.muted,false,3)
  for(const stop of d.stops||[])addLines('Via: '+(stop.place?.name||stop.location||''),9,palette.muted,false,2)
  return lines
 }
 for(const [i,d] of snapshot.journeys.entries()){
  const rows=linesFor(d),height=rows.reduce((n,r)=>n+r.leading+r.space,0)+15
  // Keep a day together whenever it fits a fresh continuation page. Long rows
  // can split across pages, with the day label repeated rather than clipping.
  ensure(Math.min(height,650))
  const label='DAY '+String(i+1).padStart(2,'0')
  line(label,M,y,9,palette.olive,true)
  const cost=money(d.total)
  line(cost,R-measure(cost,10),y,10,palette.ink)
  for(const r of rows){
   if(y-r.space-r.leading<53){finish();start(false);line(label+' CONT.',M,y,8,palette.olive,true)}
   y-=r.space;line(r.t,C,y,r.size,r.color,r.heavy);y-=r.leading
  }
  y-=3;rule(y);y-=15
 }
 const options=(snapshot.options||[]).map(id=>nameOf(catalog.options,id)).join(', ')||'None'
 const notes=[snapshot.paymentMethod==='on_site'?'Payment on the day of your service.':'Payment as agreed with our team.','We will share your chauffeur and vehicle details before your journey.','For questions or changes, please reply to your confirmation email.']
 const summaryHeight=wrap('Add-ons: '+options,R-M,9).length*13+44+notes.reduce((n,t)=>n+wrap(t,R-M,9).length*13,0)+14
 ensure(Math.min(summaryHeight,650))
 para('Add-ons: '+options,9,palette.body,false,13)
 y-=4;rule(y,'#d7ded4');y-=24
 const total=money(snapshot.total)
 line('Confirmed service total · '+(snapshot.taxIncluded?'Tax included':'Tax excluded'),M,y,10,palette.body)
 line(total,R-measure(total,17,true),y,17,palette.ink,true)
 y-=24
 for(const note of notes)para(note,9,palette.muted,false,13)
 finish()
 objects[pagesId]=Buffer.from('<< /Type /Pages /Count '+pageIds.length+' /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] >>')
 const root=add('<< /Type /Catalog /Pages '+pagesId+' 0 R >>')
 const chunks=[Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n','latin1')],offsets=[0];let len=chunks[0].length
 for(let i=1;i<objects.length;i++){offsets[i]=len;const chunk=Buffer.concat([Buffer.from(i+' 0 obj\n'),objects[i],Buffer.from('\nendobj\n')]);chunks.push(chunk);len+=chunk.length}
 chunks.push(Buffer.from('xref\n0 '+objects.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+objects.length+' /Root '+root+' 0 R >>\nstartxref\n'+len+'\n%%EOF\n'))
 return Buffer.concat(chunks)
}
