# GA4 예약 전환 분석 설정

대상: JP Chauffeur Korea / G-8VWZ2SPG0Q. GA4 관리 > 데이터 표시 > 맞춤 정의 > 맞춤 측정기준 만들기. 아래 8개는 이벤트 범위(Event)로 각각 등록한다. 기존 동일 이벤트 매개변수가 등록되어 있다면 중복 생성하지 않는다.

| 측정기준 이름 | 이벤트 매개변수 | 목적 |
|---|---|---|
| Service ID | service_id | 서비스별 요청 (mixed = 여러 서비스) |
| Vehicle ID | vehicle_id | 차량별 요청 (mixed = 여러 차량) |
| Site locale | locale | en / ko |
| Trip mode | trip_mode | single_day / multi_day |
| Booking step | step_name | daily_schedule / vehicle / details |
| Contact method | contact_method | 문의 수단 |
| CTA location | cta_location | 예약 유도 버튼 위치 |
| Content slug | content_slug | 공개 서비스/Journal 콘텐츠 구분 |

- GA4 향상된 측정의 페이지 조회는 유지하되 브라우저 기록 이벤트에 따른 페이지 변경만 비활성화하고 저장한다. form interactions, site search, outbound clicks는 OFF 유지.
- generate_lead가 주요 이벤트인지 확인. purchase, qualify_lead, close_convert_lead를 임의 삭제하거나 예약 요청으로 집계하지 않는다. generate_lead의 기본값 1 USD는 실제 견적 KRW 이벤트 값과 구별하며 기본값 사용 여부는 운영자가 검토한다.
- 등록 후 보고서에 반영되는지 확인하고 DebugView로 실제 이벤트 매개변수를 검증한다. 개발 중에는 mock API/테스트 속성만 이용하고 실예약이나 고객 개인정보는 생성/전송하지 않는다.
- 맞춤 측정기준은 과거 데이터가 자동으로 채워진다고 가정하지 않는다. GA4는 웹사이트 요청 분석이며 실제 계약/결제/매출은 운영 데이터로 따로 확인한다.
