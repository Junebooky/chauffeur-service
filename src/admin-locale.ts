export const bookingStatusKo: Record<string,string> = {
  requested:'새 예약', reviewing:'확인 중', quoted:'확인 중', awaiting_deposit:'확인 중',
  confirmed:'예약 확정', in_progress:'서비스 진행 중', completed:'서비스 완료',
  cancelled:'예약 취소', declined:'예약 거절',
}
export const serviceKo = (id:string|null|undefined) =>
  ({ airport:'픽업 서비스', pickup:'픽업 서비스', hourly:'시간제 서비스',
     day:'일정 서비스', schedule:'일정 서비스' } as Record<string,string>)[id??''] || '맞춤 이동 서비스'
export const vehicleKo = (id:string|null|undefined) =>
  ({g90:'제네시스 G90',staria:'스타리아',carnival_limousine:'카니발 하이리무진',
  sprinter_319:'벤츠 스프린터 319',sprinter_519:'벤츠 스프린터 519',
  s580:'벤츠 S클래스'} as Record<string,string>)[id??''] || id || '차량 유형 확인 중'
export const moneyKo = (value:number|null|undefined) => value==null
  ? '견적 확인 필요' : Number(value).toLocaleString('ko-KR')+'원'
export const dateKo = (value:string) => {
  const d=new Date(value)
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('ko-KR',
    {timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(d)
}
export const dayKo = (value:string) => value.replace(/-/g,'. ')
export const nextActions: Record<string,Array<{to:string;label:string;hint:string;style:'primary'|'secondary'|'danger'}>> = {
  requested:[
    {to:'reviewing',label:'요청 확인했어요',hint:'예약을 검토 중으로 바꿔요.',style:'secondary'},
    {to:'confirmed',label:'예약 확정하기',hint:'차량·기사 배정 없이 확정할 수 있어요.',style:'primary'},
    {to:'declined',label:'예약 거절',hint:'진행할 수 없는 요청일 때 선택해요.',style:'danger'}
  ],
  reviewing:[
    {to:'confirmed',label:'예약 확정하기',hint:'실제 차량과 기사는 나중에 배정해도 돼요.',style:'primary'},
    {to:'declined',label:'예약 거절',hint:'진행할 수 없는 요청일 때 선택해요.',style:'danger'}
  ],
  quoted:[
    {to:'confirmed',label:'예약 확정하기',hint:'차량·기사 배정은 필수가 아니에요.',style:'primary'},
    {to:'declined',label:'예약 거절',hint:'진행할 수 없는 요청일 때 선택해요.',style:'danger'}
  ],
  awaiting_deposit:[
    {to:'confirmed',label:'예약 확정하기',hint:'고객에게 확정 이메일을 보내요.',style:'primary'},
    {to:'declined',label:'예약 거절',hint:'진행할 수 없는 요청일 때 선택해요.',style:'danger'}
  ],
  confirmed:[
    {to:'in_progress',label:'서비스 시작',hint:'실제 운행이 시작되었을 때 선택해요.',style:'primary'},
    {to:'cancelled',label:'예약 취소',hint:'예약이 취소될 때 선택해요.',style:'danger'}
  ],
  in_progress:[
    {to:'completed',label:'서비스 완료',hint:'일정이 모두 끝났을 때 선택해요.',style:'primary'},
    {to:'cancelled',label:'예약 취소',hint:'운행 중단 시 선택해요.',style:'danger'}
  ]
}
