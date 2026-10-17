# 인생네컷 만들기

카메라로 찍거나 사진 4장을 올려 세로 4컷을 만들고, 프레임·스티커·문구로 꾸민 뒤 PNG(1200×3600)로 저장하는 웹앱이다.
사진은 브라우저 메모리에서만 처리하며 서버로 보내지 않는다.

## 실행 방법

1. 이 폴더에서 `python3 -m http.server 8000` 을 실행한다.
2. 브라우저에서 `http://localhost:8000` 을 연다.
3. 카메라는 `localhost` 또는 `https://` 주소에서만 켜진다. 휴대폰에서 쓰려면 아래처럼 배포한 https 주소로 연다.

## 정적 배포

**GitHub Pages**
1. 이 폴더의 파일(`index.html`, `style.css`, `app.js`, `vendor/`)을 GitHub 저장소에 올린다.
2. 저장소 Settings → Pages → Source를 `Deploy from a branch`, 브랜치 `main` / 폴더 `/ (root)`로 정한다.
3. 몇 분 뒤 표시되는 `https://<아이디>.github.io/<저장소>/` 주소로 접속한다.

**Render**
1. Render 대시보드에서 New → Static Site를 고르고 위 저장소를 연결한다.
2. Build Command는 비워 두고, Publish Directory를 이 폴더(저장소 루트라면 `.`)로 정한다.
3. 배포가 끝나면 나오는 `https://<이름>.onrender.com` 주소로 접속한다.

## 파일

- `index.html` 화면 구조 · `style.css` 스타일 · `app.js` 동작 전체
- `vendor/qrcode.js` QR 생성 라이브러리 [qrcode-generator 1.4.4](https://github.com/kazuhikoarase/qrcode-generator) (MIT, Kazuhiko Arase)
- 손글씨체: Google Fonts Gaegu (불러오지 못하면 기본 고딕체로 표시)
