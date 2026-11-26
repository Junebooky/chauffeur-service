# 검색 유입 자동화 — 1단계

- OpenSEO 2026-11-26 조사: US Google 영어 chauffeur service Seoul 50/월, KD 0, CPC USD 18.76; private driver Seoul 70/월; Incheon airport transfer 90/월. 한국 Google 공항 픽업 서비스 210/월, 인천공항 픽업 140/월. 검색량 추정치, KD 0은 상위 노출 보장 아님. 네이버 공식 검색량 미확보.
- seo/service-pages.json 단일 데이터 파일로 영어/한국어 HTML 6개를 생성한다. 가격/언어 서비스 포함 여부는 카탈로그 내 상충 정보가 있어 임의로 표시하지 않는다. 차량은 bookable=false 제외. 실제 제공 범위와 문구는 공개 전 검토한다.
- 빌드 때 scripts/build-search-pages.mjs 실행. 기존 React 화면과 언어 전환 코드는 수정하지 않는다. 배포된 HTML 주소는 /services/{slug}/, /ko/services/{slug}/. 한국어 메인 페이지의 확정 URL 및 예약 CTA 딥링크는 병합 전 다른 에이전트와 조율한다. 현재 CTA는 기존 /#reservation 앵커. 기존 사이트맵 URL은 같은 공식 호스트만 유지. 홈에서 서비스 페이지로의 링크는 언어 작업 병합 후 연결해야 한다.
- 자동 배포 방지를 위해 이 작업 브랜치에서만 vercel git.deploymentEnabled=false. main에 병합하지 않는다. Vercel 프로젝트 설정은 변경하지 않는다. 병합 전 기존 정책과 합의한다.
- 다음: Search Console 도메인 등록/인증 및 OpenSEO 연결. 네이버 서치어드바이저 등록, RSS와 사이트맵 제출. Bing Webmaster Tools 연결. 무료 데이터 우선. AI 초안 생성과 승인된 글의 자동 공개를 분리하고, Supabase CMS는 별도 마이그레이션 및 관리자 UI로 개발한다. 예약/메일 데이터 접근 금지. 외부 채널은 공식 API와 승인만. 비용이 드는 API, 반복 순위 추적, 자동 게시, 실제 배포는 별도 확인.
