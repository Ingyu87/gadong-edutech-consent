This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## ⚠️ API 키·비밀값 보안 (필수)

- **API 키(GEMINI_API_KEY 등)와 비밀값은 절대 GitHub에 푸시하지 마세요.**
- `.env`, `.env.local` 및 기타 `.env*` 파일은 `.gitignore`에 포함되어 있습니다. 이 파일들을 커밋하거나 푸시하지 마세요.
- 배포 시에는 Vercel/호스팅의 환경 변수 설정만 사용하세요. `.env.local.example`을 복사해 값을 채운 뒤, 해당 파일은 로컬에서만 사용하고 저장소에는 올리지 마세요.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 에듀테크 CSV 양식 (교사용 업로드)

교사 페이지에서 등록하는 CSV는 아래 컬럼을 사용합니다.  
(예: `0학년0반 학습지원소프트웨어 개인정보 수집·이용·제공 고지 안내` 시트 양식)

| 컬럼명 | 설명 |
|--------|------|
| 에듀테크명 | 소프트웨어 이름 |
| 약관 | 약관/개인정보처리방침 URL |
| 사이트주소 | 서비스 URL |
| 사용연령 | 사용 연령 안내 (예: 13세 미만 동의) |
| 수집이용동의 | 수집·이용 동의 안내 문구 (학부모 팝업에 표시) |
| 제3자 제공동의 | 제3자 제공 동의 안내 문구 (학부모 팝업에 표시) |

UTF-8 또는 EUC-KR로 저장한 CSV를 업로드하면 됩니다.
