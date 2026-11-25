// Server-side A4 confirmation. No browser, paid renderer, or external network.
// Standard PDF fonts keep files small. Korean/CJK use predefined CID CMaps;
// the complete Unicode itinerary is also present in the email body.
import catalog from '../src/catalog.json' with { type:'json' }
const W=595,H=842
const latin = s => Buffer.from(String(s).replace(/[–—]/g,'-').replace(/→/g,'>'),'latin1').toString('hex')
const unicode = s => Buffer.from(String(s),'utf16le').swap16().toString('hex')
const isAscii = s => /^[\x20-\x7e]*$/.test(s)
const clean = s => String(s??'').replace(/[\x00-\x1f\x7f]/g,' ').trim()
const money = n => n==null?'Price as agreed':'KRW '+Number(n).toLocaleString('en-US')
const nameOf=(items,id)=>items.find(x=>x.id===id)?.name||String(id??'')
const wrap=(text,max)=>{
  const rows=[];let line='',width=0
  for(const c of clean(text)){
    const w=c.charCodeAt(0)>127?1.1:1
    if(width+w>max&&line){rows.push(line.trim());line='';width=0}
    line+=c;width+=w
  }
  if(line)rows.push(line.trim())
  return rows
}
export function buildConfirmationPdf(snapshot){
  const objects=[null]
  const add=value=>{objects.push(Buffer.isBuffer(value)?value:Buffer.from(value,'ascii'));return objects.length-1}
  const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  const descriptor=add('<< /Type /FontDescriptor /FontName /HYSMyeongJo-Medium /Flags 6 /FontBBox [0 -160 1000 880] /ItalicAngle 0 /Ascent 880 /Descent -160 /CapHeight 700 /StemV 80 >>')
  const cid=add('<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HYSMyeongJo-Medium /CIDSystemInfo << /Registry (Adobe) /Ordering (Korea1) /Supplement 2 >> /FontDescriptor '+descriptor+' 0 R /DW 1000 >>')
  const cjk=add('<< /Type /Font /Subtype /Type0 /BaseFont /HYSMyeongJo-Medium /Encoding /UniKS-UCS2-H /DescendantFonts ['+cid+' 0 R] >>')
  const pagesId=add('');const pageIds=[]
  let commands=[],y=0
  const rect=(x,b,w,h,color)=>commands.push(color+' rg '+x+' '+b+' '+w+' '+h+' re f')
  const line=(str,x,b,size=11,color='0.17 0.20 0.18',heavy=false)=>{
    const t=clean(str).replace(/→/g,' > ').replace(/[–—]/g,'-')
    const f=isAscii(t)?(heavy?'F2':'F1'):'F3'
    commands.push('BT /'+f+' '+size+' Tf '+color+' rg 1 0 0 1 '+x+' '+b+' Tm <'+(f==='F3'?unicode(t):latin(t))+'> Tj ET')
  }
  const finish=()=>{
    line('J Production | CHAUFFEUR | '+snapshot.reference,36,26,8,'0.40 0.45 0.41')
    line('Page '+(pageIds.length+1),505,26,8,'0.40 0.45 0.41')
    const bytes=Buffer.from(commands.join('\n'),'ascii')
    const stream=add(Buffer.concat([Buffer.from('<< /Length '+bytes.length+' >>\nstream\n'),bytes,Buffer.from('\nendstream')]))
    pageIds.push(add('<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /Font << /F1 '+font+' 0 R /F2 '+bold+' 0 R /F3 '+cjk+' 0 R >> >> /Contents '+stream+' 0 R >>'))
  }
  const start=()=>{
    commands=[]
    rect(0,700,W,142,'0.09 0.11 0.12')
    line('J Production',36,807,22,'0.95 0.96 0.95')
    line('Team of Premium Chauffeur Service',36,785,10,'0.78 0.81 0.79')
    line('RESERVATION CONFIRMED',36,752,10,'0.72 0.79 0.65',true)
    line('Your journey is confirmed.',36,723,21,'1 1 1')
    line('Reference: '+snapshot.reference,36,675,12,'0.22 0.29 0.24',true)
    y=650
  }
  const ensure=height=>{if(y-height<55){finish();start()}}
  const paragraph=(text,size=11,heavy=false)=>{
    for(const row of wrap(text,Math.floor(500/size))){
      ensure(size+5);line(row,36,y,size,'0.17 0.20 0.18',heavy);y-=size+5
    }
  }
  start()
  paragraph('Guest: '+snapshot.name,12,true)
  paragraph('Confirmed service total: '+money(snapshot.total)+' | '+(snapshot.taxIncluded?'Tax included':'Tax excluded'),12,true)
  paragraph(snapshot.paymentMethod==='on_site'?'Payment on the day of service.':'Payment as agreed with our team.')
  y-=13
  for(const [i,d] of snapshot.journeys.entries()){
    ensure(104)
    rect(36,y-8,W-72,1,'0.88 0.90 0.86')
    y-=23
    paragraph('DAY '+String(i+1).padStart(2,'0')+' | '+d.date+' | '+d.time+' KST (UTC+9)',12,true)
    paragraph(nameOf(catalog.services,d.service)+' | '+nameOf(catalog.vehicles,d.vehicle),11,true)
    paragraph('Pickup: '+(d.pickupPlace?.name?d.pickupPlace.name+' | ':'')+d.pickup)
    for(const stop of d.stops||[])paragraph('Via: '+(stop.place?.name?stop.place.name+' | ':'')+String(stop.location||''))
    paragraph('Destination: '+(d.destinationPlace?.name?d.destinationPlace.name+' | ':'')+d.destination)
    if(d.flight)paragraph('Flight: '+d.flight)
    paragraph(money(d.total),11,true)
    y-=13
  }
  if(snapshot.options?.length)paragraph('Add-ons: '+snapshot.options.map(id=>nameOf(catalog.options,id)).join(', '))
  y-=8
  paragraph('We will share your chauffeur and vehicle details before your journey.')
  paragraph('For changes or questions, please reply to your confirmation email.')
  finish()
  objects[pagesId]=Buffer.from('<< /Type /Pages /Count '+pageIds.length+' /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] >>')
  const root=add('<< /Type /Catalog /Pages '+pagesId+' 0 R >>')
  const chunks=[Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n','latin1')],offsets=[0]
  let len=chunks[0].length
  for(let i=1;i<objects.length;i++){
    offsets[i]=len
    const chunk=Buffer.concat([Buffer.from(i+' 0 obj\n'),objects[i],Buffer.from('\nendobj\n')])
    chunks.push(chunk);len+=chunk.length
  }
  chunks.push(Buffer.from('xref\n0 '+objects.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+objects.length+' /Root '+root+' 0 R >>\nstartxref\n'+len+'\n%%EOF\n'))
  return Buffer.concat(chunks)
}
