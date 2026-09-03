# work-ledger-app

개인용 작업 장부 — 50분 작업 + 10분 휴식 블록으로 포인트를 적립하고, 게임/웹서핑 같은 소비에 쓰거나
저축해서 휴무권으로 바꾸는 개인용 트래커입니다. 할일(프로젝트) 진행률과 업데이트, 포인트와는
분리된 수익/목표 트래킹도 함께 관리합니다. 순수 HTML/JS로 만들어져 있어 빌드 과정이 없고,
GitHub Pages로 그대로 배포할 수 있습니다.

데이터는 이 저장소가 아니라 별도의 프라이빗 저장소(`work-ledger-data`)에 `state.json` 파일로
저장되며, 브라우저에서 GitHub Contents API를 통해 직접 읽고 씁니다. 서버나 백엔드는 없습니다.

## 처음 실행하기

1. GitHub Pages로 배포된 주소(또는 로컬에서 정적 서버로 띄운 `index.html`)에 접속하면
   설정 화면이 먼저 뜹니다. (ES 모듈을 쓰기 때문에 `file://`로 직접 열면 동작하지 않아요 —
   `python3 -m http.server` 같은 로컬 서버나 GitHub Pages를 통해 접속하세요.)
2. [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)을
   새로 만듭니다.
   - **Resource owner**: 데이터 저장소가 속한 계정/조직
   - **Repository access**: `work-ledger-data` 저장소만 선택 (Only select repositories)
   - **Permissions → Repository permissions → Contents**: Read and write
   - 그 외 권한은 필요 없습니다.
3. 설정 화면에 토큰과 저장소 소유자(owner)/이름(repo)/브랜치/파일 경로를 입력하고
   "연결 테스트"로 확인한 뒤 "저장하고 시작"을 누릅니다.
4. 이 정보는 브라우저의 `localStorage`에만 저장됩니다. 코드에는 어떤 토큰도 들어있지 않습니다.
   기기를 바꾸면 그 브라우저에서 다시 설정해야 합니다.

우측 상단의 톱니바퀴 아이콘으로 언제든 설정을 다시 열어 토큰을 바꾸거나 로그아웃할 수 있습니다.

## GitHub Pages 배포

1. 저장소 **Settings → Pages**에서 **Deploy from a branch**를 선택하고, 배포할 브랜치(예: `main`)와
   루트(`/`)를 지정합니다.
2. 빌드 과정이 없으므로 별도 워크플로 설정 없이 정적 파일이 그대로 서빙됩니다.

## 파일 구성

- `index.html` — 진입점
- `css/style.css` — 다크 테마 스타일 (Space Grotesk + IBM Plex Mono)
- `js/github-api.js` — PAT 저장/조회, GitHub Contents API 읽기·쓰기
- `js/app.js` — 상태, 비즈니스 로직, 렌더링, 이벤트 처리

## 알아두면 좋은 점

- GitHub Contents API는 파일 하나당 약 1MB 제한이 있습니다. 업데이트에 첨부하는 이미지는
  자동으로 리사이즈(최대 420px, JPEG 저압축)되지만, 이미지가 아주 많아지면 저장이 실패할 수 있고
  화면에 경고가 뜹니다. 이 경우 오래된 업데이트의 이미지를 정리해주세요.
- 여러 기기/탭에서 동시에 저장하면 마지막에 쓴 내용이 이깁니다(개인용 도구 기준의 단순한 처리).
