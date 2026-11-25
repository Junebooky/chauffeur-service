# 예약 승인 및 확정 이메일 (P0)
- 관리자 UI: 새 예약 / 확인 중 / 확정된 예약. 기존 입금·결제·공급업체·기사 데이터 및 API는 삭제하지 않지만, 현재 업무 화면에서는 숨긴다.
- 확정 시 실제 고객 이메일, 세금 조건, 서비스 금액과 일정 확인. 현장결제(기본) 또는 별도 협의. 차량·기사 배정 불필요.
- 기존 관리자 SMTP 이메일의 브랜딩과 HTML 레이아웃 재사용. 고객에게는 확정 상태, 일정, 금액, 결제 안내, PDF만 제공한다. 고객이 답장하면 SMTP 발신자에게 전달된다.
- `docs/sql/confirmation-deliveries-v1.sql`을 Chauffeur Supabase 프로젝트에 먼저 적용한다. 이 SQL은 기존 예약/결제 데이터를 삭제하거나 변경하지 않는다. 새 테이블/RPC는 service_role 전용이며 RLS를 켠다.
- `confirmation_preview`는 서버에서 정본 예약 정보로 미리보기를 생성한다. `confirm_and_send`는 예약 상태 변경과 전송 대기열을 원자적으로 기록하며 `expected_updated_at`으로 오래된 미리보기를 거부한다.
- SMTP 수락 시 sent, 명백한 실패 시 failed, 네트워크 결과 불명 시 uncertain. 처리 중 중단되면 sending. failed/pending만 관리자 재시도 가능하다. uncertain/sending은 Gmail 보낸편지함을 확인하기 전 중복 발송 금지. 자동 백그라운드 재시도와 자동 불확실 상태 조정은 아직 없다.
- PDF는 서버에서 A4 다중 페이지로 생성하며 발송 시 생성본을 private DB에 저장한다. 기존 브라우저 내보내기와는 별도 구현이다. 표준 PDF CID 글꼴을 사용하므로 일부 비라틴 문자/뷰어의 표시 호환성은 추가 확인이 필요하며, 이메일에는 전체 유니코드 일정이 들어간다.
- Gmail 수신함/답장 UI (P1)는 별도의 Google OAuth 연결과 권한 동의가 필요하다. 기존 SMTP 발송은 유지한다.
- 테스트: `npm run check && npm test && npm run build`. 실제 고객에게 테스트 메일을 발송하지 않는다. 배포는 명시 요청 시에만 한다.
