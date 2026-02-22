import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();
        if (!url) {
            return NextResponse.json({ error: 'URL이 필요합니다.' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
        }

        // 1. Fetch site content (Best effort)
        let pageContent = '';
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
                },
                next: { revalidate: 3600 }
            });

            if (!res.ok) {
                return NextResponse.json({
                    error: `사이트 접근 실패 (${res.status}). 사이트에서 자동 접근을 차단했을 수 있습니다.`
                }, { status: 500 });
            }

            pageContent = await res.text();
            // Basic HTML cleanup to minimize tokens and noise
            pageContent = pageContent
                .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g, '')
                .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/g, '')
                .replace(/<head\b[^>]*>([\s\S]*?)<\/head>/g, '')
                .replace(/<nav\b[^>]*>([\s\S]*?)<\/nav>/g, '')
                .replace(/<footer\b[^>]*>([\s\S]*?)<\/footer>/g, '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 20000); // Take first 20k chars for analysis

        } catch (e: any) {
            console.error('Fetch error:', e);
            return NextResponse.json({
                error: '해당 URL의 내용을 읽어오는 중에 오류가 발생했습니다. 사이트 보안 정책으로 인해 직접 접속만 가능할 수 있습니다.'
            }, { status: 500 });
        }

        if (pageContent.length < 100) {
            return NextResponse.json({
                error: '사이트 내용이 너무 적거나 읽어올 수 없습니다. URL을 다시 확인해 주세요.'
            }, { status: 500 });
        }

        // 2. Prompt Gemini for summarization
        const prompt = `당신은 에듀테크 개인정보 보호 전문가입니다. 제공된 텍스트는 특정 교육용 서비스의 '개인정보 처리방침' 내용입니다.
이 내용을 바탕으로 학부모님들이 동의 여부를 결정하는 데 꼭 필요한 핵심 정보를 다음 세 가지 항목으로 요약해 주세요.

목표: 학부모님이 30초 안에 읽을 수 있도록 간결하고 명확하게 작성합니다. 불필요한 서술어는 생략합니다.

반드시 다음 형식을 엄격히 지켜서 한국어로 답변하세요:
- 목적: (수집 및 이용 목적 / 예: 계정 관리 및 서비스 제공, 학습 분석 등)
- 항목: (수집하는 개인정보 항목 / 예: 이름, 학번, 이메일, 기기 정보 등)
- 보유 기간: (파기 시점 / 예: 회원 탈퇴 시 즉시 파기, 학년 종료 시까지 등)

분석할 내용:
${pageContent}`;

        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: prompt }]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 600,
                    },
                }),
            }
        );

        if (!geminiRes.ok) {
            const err = await geminiRes.text();
            throw new Error(`Gemini API Error: ${err}`);
        }

        const data = await geminiRes.json();
        const summary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '요약 내용을 생성할 수 없습니다.';

        return NextResponse.json({ summary });

    } catch (err: any) {
        console.error('Privacy Summary API Error:', err);
        return NextResponse.json({ error: err.message || '알 수 없는 오류가 발생했습니다.' }, { status: 500 });
    }
}
