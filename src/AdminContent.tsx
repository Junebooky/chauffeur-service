import { useEffect,useState } from 'react'
import type { FormEvent } from 'react'
import { FileText, Plus, RefreshCw } from 'lucide-react'
import DisplayHeading from './components/ui/DisplayHeading'
import SectionEyebrow from './components/ui/SectionEyebrow'

type Section={heading:string;body:string}
type Draft={slug:string;lang:'en'|'ko';title:string;description:string;intro:string;sections:Section[]}
type Article=Draft&{id:string;status:'draft'|'approved'|'archived';publish_at:string|null;updated_at:string;approved_at:string|null;revision_draft?:Draft|null;revision_token?:string|null}
type Api=(body:Record<string,unknown>)=>Promise<{data:Article[]}>
const blank=():Draft=>({slug:'',lang:'en',title:'',description:'',intro:'',sections:[{heading:'',body:''},{heading:'',body:''}]})
const edit=(a:Article):Draft=>({slug:a.slug,lang:a.lang,title:a.title,description:a.description,intro:a.intro,sections:a.sections.map(s=>({...s}))})
const kst=(s:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'short'}).format(new Date(s))
const initialDate=()=>new Date(Date.now()+86400000+9*3600000).toISOString().slice(0,10)+'T09:00'
const status=(a:Article)=>a.status==='draft'?'초안':a.status==='archived'?'비공개':a.publish_at&&Date.parse(a.publish_at)<=Date.now()?'게시 완료':'발행 예정'

export default function AdminContent({api,role}:{api:Api;role?:string}){
 const [rows,setRows]=useState<Article[]>([]),[selected,setSelected]=useState<Article|null>(null)
 const [draft,setDraft]=useState<Draft>(blank),[publishAt,setPublishAt]=useState(initialDate)
 const [review,setReview]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const [importText,setImportText]=useState(''),[importOpen,setImportOpen]=useState(false)
 const [filter,setFilter]=useState<'all'|'draft'|'approved'|'archived'>('all')
 const [revising,setRevising]=useState(false)
 const isLive=Boolean(selected?.status==='approved'&&selected.publish_at&&Date.parse(selected.publish_at)<=Date.now())
 const savedDraft=selected?(revising&&selected.revision_draft?selected.revision_draft:edit(selected)):blank()
 const dirty=JSON.stringify(savedDraft)!==JSON.stringify(draft)
 const readonly=Boolean(selected&&selected.status!=='draft'&&!revising)
 const refresh=async()=>{const result=await api({action:'list'});setRows(result.data||[])}
 useEffect(()=>{
  if(role!=='owner')return
  let active=true
  api({action:'list'}).then(r=>{if(active)setRows(r.data||[])}).catch(e=>{if(active)setError(e instanceof Error?e.message:'콘텐츠를 불러오지 못했어요.')})
  return()=>{active=false}
 },[api,role])
 const run=async(fn:()=>Promise<void>)=>{
  setBusy(true);setError('');setNotice('')
  try{await fn()}catch(e){setError(e instanceof Error?e.message:'다시 시도해 주세요.')}finally{setBusy(false)}
 }
 const choose=(a:Article|null)=>{
  if(dirty&&!window.confirm('저장하지 않은 변경 사항을 버릴까요?'))return
  setSelected(a);setRevising(Boolean(a?.revision_draft&&a.status==='approved'));setDraft(a?(a.revision_draft&&a.status==='approved'?a.revision_draft:edit(a)):blank());setReview(false);setNotice('');setError('');setImportOpen(false)
 }
 const update=<K extends keyof Draft>(key:K,value:Draft[K])=>{setDraft(d=>({...d,[key]:value}));setReview(false)}
 const section=(i:number,key:keyof Section,value:string)=>update('sections',draft.sections.map((s,j)=>i===j?{...s,[key]:value}:s))
 const save=(e:FormEvent)=>{
  e.preventDefault();if(readonly||busy)return
  void run(async()=>{
   const r=await api({action:revising?'save_revision':'save_draft',...draft,...(selected?{id:selected.id,expected_updated_at:selected.updated_at}:{}),...(revising?{expected_revision_token:selected?.revision_token??null}:{})})
   const a=r.data?.[0];if(!a)throw Error('저장 결과를 확인할 수 없어요.')
   setSelected(a);setDraft(revising&&a.revision_draft?a.revision_draft:edit(a));setReview(false);setNotice(revising?'개정 초안을 저장했어요. 기존 게시물은 그대로 공개돼요.':'초안을 저장했어요. 아직 공개되지 않았어요.');await refresh()
  })
 }
 const approve=()=>{
  if(!selected||selected.status!=='draft'||dirty||!review||busy)return
  const date=new Date(publishAt+':00+09:00')
  if(!Number.isFinite(date.getTime())){setError('발행 날짜와 시간을 확인해 주세요.');return}
  if(!window.confirm(kst(date.toISOString())+' (KST)에 공개할까요? 공개 후 수정은 별도의 개정 초안으로 검토해야 해요.'))return
  void run(async()=>{
   const r=await api({action:'approve',id:selected.id,expected_updated_at:selected.updated_at,publish_at:date.toISOString(),confirm:true})
   if(!r.data?.[0])throw Error('승인 결과를 확인할 수 없어요.')
   setSelected(r.data[0]);setDraft(edit(r.data[0]));setReview(false);setNotice('발행을 승인했어요. 설정한 시각부터 자동 공개돼요.');await refresh()
  })
 }
 const finishRevision=(approveRevision:boolean)=>{
  if(!selected||!isLive||!selected.revision_token||busy||(approveRevision&&(dirty||!review)))return
  if(!window.confirm(approveRevision?'검토한 개정본을 지금 공개할까요? 기존 URL은 유지돼요.':'저장한 개정 초안을 폐기할까요? 기존 게시물은 유지돼요.'))return
  void run(async()=>{
   const r=await api({action:approveRevision?'approve_revision':'discard_revision',id:selected.id,expected_updated_at:selected.updated_at,expected_revision_token:selected.revision_token,...(approveRevision?{confirm:true}:{})})
   const a=r.data?.[0];if(!a)throw Error('처리 결과를 확인할 수 없어요.')
   setSelected(a);setDraft(edit(a));setRevising(false);setReview(false);setNotice(approveRevision?'개정본을 공개했어요.':'개정 초안을 폐기했어요.');await refresh()
  })
 }
 const archive=()=>{
  if(!selected||selected.status==='archived'||selected.revision_token||revising||busy||!window.confirm('이 글을 비공개 처리할까요?'))return
  void run(async()=>{
   const r=await api({action:'archive',id:selected.id,expected_updated_at:selected.updated_at})
   if(!r.data?.[0])throw Error('처리 결과를 확인할 수 없어요.')
   setSelected(r.data[0]);setDraft(edit(r.data[0]));setReview(false);setNotice('비공개 처리했어요.');await refresh()
  })
 }
 const importDraft=()=>{
  try{
   const v=JSON.parse(importText)
   if(!v||typeof v.slug!=='string'||!['en','ko'].includes(v.lang)||!['title','description','intro'].every(k=>typeof v[k]==='string')||!Array.isArray(v.sections)||v.sections.length<2||v.sections.length>12||v.sections.some((s:Section)=>typeof s?.heading!=='string'||typeof s?.body!=='string'))throw Error()
   setDraft({slug:v.slug,lang:v.lang,title:v.title,description:v.description,intro:v.intro,sections:v.sections.map((s:Section)=>({heading:s.heading,body:s.body}))});setReview(false);setImportText('');setImportOpen(false);setError('')
  }catch{setError('초안 JSON 형식을 확인해 주세요.')}
 }
 if(role!=='owner')return <p className="admin-ko-caption">소유자만 콘텐츠를 관리할 수 있어요.</p>
 const publicPath=selected?'/'+(selected.lang==='ko'?'ko/':'')+'journal/'+selected.slug+'/':''
 return <>
  <div className="admin-heading"><div><SectionEyebrow>검색 유입</SectionEyebrow><DisplayHeading as="h1">콘텐츠 관리</DisplayHeading><p>초안을 검토하고 발행 시간을 지정하세요. 승인되지 않은 글은 공개되지 않아요.</p></div></div>
  {error&&<div className="admin-error admin-banner" role="alert">{error}<button onClick={()=>setError('')}>닫기</button></div>}
  {notice&&<div className="admin-success admin-banner" role="status">{notice}<button onClick={()=>setNotice('')}>닫기</button></div>}
  <section className="admin-ops-panel">
   <div className="admin-mail-heading"><h2><FileText size={17}/> Journal</h2><div className="admin-ko-actions"><button className="admin-secondary" disabled={busy} onClick={()=>void run(refresh)}><RefreshCw size={14}/> 새로고침</button><button className="admin-primary" disabled={busy} onClick={()=>choose(null)}><Plus size={14}/> 새 초안</button></div></div>
   <div className="admin-ko-actions">{([['all','전체'],['draft','초안'],['approved','승인·발행'],['archived','비공개']] as const).map(([id,label])=><button key={id} type="button" className={filter===id?'admin-primary':'admin-secondary'} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>
   {rows.filter(a=>filter==='all'||a.status===filter).map(a=><button key={a.id} type="button" className="admin-task-row" disabled={busy} onClick={()=>choose(a)}><FileText size={15}/><span><strong>{a.title}</strong><small>{a.lang.toUpperCase()} · {status(a)}{a.revision_token?' · 개정 초안':''}{a.publish_at?' · '+kst(a.publish_at):''}</small></span></button>)}
   {!rows.length&&<p className="admin-ko-caption">등록된 초안이 없어요.</p>}
  </section>
  <section className="admin-ops-panel">
   <div className="admin-mail-heading"><h2>{revising?'개정 초안':selected?status(selected):'새 초안'}</h2>{!readonly&&!revising&&<button className="admin-secondary" disabled={busy} onClick={()=>setImportOpen(!importOpen)}>AI 초안 JSON 가져오기</button>}</div>
   {isLive&&!revising&&<button className="admin-secondary" disabled={busy} onClick={()=>{setRevising(true);setReview(false);setImportOpen(false)}}>개정 초안 작성</button>}
   {revising&&<p className="admin-ko-caption">개정 초안은 비공개입니다. 기존 게시물과 URL은 승인 전까지 변경되지 않아요.</p>}
   {importOpen&&!readonly&&!revising&&<div className="admin-edit-form"><label>초안 JSON<textarea rows={6} value={importText} onChange={e=>setImportText(e.target.value)} placeholder={'{"slug":"airport-guide","lang":"en","title":"...","description":"...","intro":"...","sections":[{"heading":"...","body":"..."},{"heading":"...","body":"..."}]}'}/></label><button className="admin-secondary" disabled={busy} onClick={importDraft}>가져오기 (아직 저장 안 함)</button></div>}
   <form className="admin-edit-form" onSubmit={save}>
    <label>언어<select disabled={readonly||revising||busy} value={draft.lang} onChange={e=>update('lang',e.target.value as Draft['lang'])}><option value="en">English</option><option value="ko">한국어</option></select></label>
    <label>URL 슬러그<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={100} readOnly={readonly||revising} value={draft.slug} onChange={e=>update('slug',e.target.value)}/></label>
    <label>제목<input required minLength={5} maxLength={160} readOnly={readonly} value={draft.title} onChange={e=>update('title',e.target.value)}/></label>
    <label>검색 설명<textarea required minLength={10} maxLength={320} rows={2} readOnly={readonly} value={draft.description} onChange={e=>update('description',e.target.value)}/></label>
    <label>핵심 답변<textarea required minLength={20} maxLength={1200} rows={4} readOnly={readonly} value={draft.intro} onChange={e=>update('intro',e.target.value)}/></label>
    {draft.sections.map((s,i)=><div key={i} className="admin-edit-form"><label>섹션 {i+1} 제목<input required minLength={2} maxLength={140} readOnly={readonly} value={s.heading} onChange={e=>section(i,'heading',e.target.value)}/></label><label>본문<textarea required minLength={20} maxLength={4000} rows={5} readOnly={readonly} value={s.body} onChange={e=>section(i,'body',e.target.value)}/></label>{!readonly&&draft.sections.length>2&&<button className="admin-secondary" type="button" onClick={()=>update('sections',draft.sections.filter((_,j)=>i!==j))}>섹션 삭제</button>}</div>)}
    {!readonly&&<div className="admin-ko-actions"><button className="admin-secondary" type="button" disabled={busy||draft.sections.length>=12} onClick={()=>update('sections',[...draft.sections,{heading:'',body:''}])}>섹션 추가</button><button className="admin-primary" disabled={busy}>{revising?'개정 초안 저장':'초안 저장'}</button></div>}
   </form>
   {selected?.status==='draft'&&<div className="admin-edit-form"><h3>검토 및 예약 발행</h3><p className="admin-ko-caption">차량·요금·서비스 조건 및 출처를 실제 정보와 대조해 주세요. 초안 저장 후 승인할 수 있어요.</p><label>발행 날짜 및 시각 (한국 시간)<input type="datetime-local" value={publishAt} onChange={e=>setPublishAt(e.target.value)}/></label><label><input type="checkbox" checked={review} disabled={dirty||busy} onChange={e=>setReview(e.target.checked)}/> 내용과 출처를 검토했고 공개를 승인해요.</label><button className="admin-primary" disabled={dirty||busy||!review||!publishAt} onClick={approve}>발행 승인</button></div>}
   {revising&&<div className="admin-edit-form"><h3>개정본 검토 및 공개</h3><label><input type="checkbox" checked={review} disabled={dirty||busy||!selected?.revision_token} onChange={e=>setReview(e.target.checked)}/> 내용과 출처를 검토했고 개정본 공개를 승인해요.</label><div className="admin-ko-actions"><button className="admin-primary" disabled={dirty||busy||!review||!selected?.revision_token} onClick={()=>finishRevision(true)}>개정본 공개</button>{selected?.revision_token?<button className="admin-secondary" disabled={busy} onClick={()=>finishRevision(false)}>개정 초안 폐기</button>:<button className="admin-secondary" disabled={busy} onClick={()=>{if(!dirty||window.confirm('저장하지 않은 개정 초안을 버릴까요?')){setRevising(false);setDraft(selected?edit(selected):blank());setReview(false)}}}>취소</button>}</div></div>}
   {selected?.status==='approved'&&selected.publish_at&&<p className="admin-ko-caption">{kst(selected.publish_at)} KST · {Date.parse(selected.publish_at)<=Date.now()?<a href={publicPath} target="_blank" rel="noopener noreferrer">게시물 열기</a>:publicPath}</p>}
   {selected&&selected.status!=='archived'&&!revising&&!selected.revision_token&&<button type="button" className="admin-secondary" disabled={busy} onClick={archive}>비공개 처리</button>}
  </section>
 </>
}
