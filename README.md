# 콩놀이터 (grok-kong-playground)

하루콩 세계관 미니게임 놀이터. Grok과 함께 만든 해커톤 빌드입니다.

- 로비에서 오늘 콩을 고르고, 테마를 달력에 입혀요
- **쑥쑥 콩나무** — 잎을 밟고 올라가는 점프
- **데굴데굴 콩볼링** — 콩을 굴려 기분 핀을 쓰러뜨려요
- 클로버와 광고로 테마를 열고, 로비에 바로 적용돼요

## 실행

Node 22+ / npm

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:8080` 을 열면 됩니다.

- `/` 로비
- `/climb` 쑥쑥 콩나무
- `/bowl` 데굴데굴 콩볼링
- `/present` 발표용 한 장

저장은 브라우저 `localStorage` (`kong-playground-v1`)를 씁니다. 서버 DB는 필요 없습니다.

## 에셋

공식 하루콩 콩/테마/클로버 이미지는 `public/beans`, `public/themes`, `public/icons` 에 있습니다.

Made with Grok.
