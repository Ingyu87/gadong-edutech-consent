import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'No API key' }, { status: 500 });
        }

        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString('base64');

        let mimeType = file.type;
        if (!mimeType || mimeType === 'application/octet-stream') {
            if (file.name.endsWith('.pdf')) mimeType = 'application/pdf';
            else if (file.name.endsWith('.png')) mimeType = 'image/png';
            else mimeType = 'image/jpeg';
        }

        const prompt = `이 문서는 한국 초등학교의 학교운영위원회(학운위) 심의 자료입니다.

문서 안의 칸(셀, 네모칸) 안에 소프트웨어명들이 쉼표(,)로 구분되어 나열되어 있습니다.
예: "클래스팅, 패들렛, 구글 클래스룸, e학습터"

다음 조건으로 에듀테크/학습지원 소프트웨어 프로그램명을 모두 추출해 주세요:
- 쉼표로 구분된 각 항목을 개별 소프트웨어명으로 분리
- 소프트웨어/앱/서비스 이름만 추출
- 번호, 설명문, 조건, 회사명 등은 제외
- 표, 목록, 네모칸 어디서든 찾아주세요
- 중복 제거

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 없이):
{"softwares":[{"name":"소프트웨어명1"},{"name":"소프트웨어명2"}]}

소프트웨어를 찾지 못한 경우: {"softwares":[]}`;

        // Use Gemini REST API directly (v1beta supports gemini-2.0-flash)
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    inline_data: {
                                        mime_type: mimeType,
                                        data: base64,
                                    },
                                },
                                { text: prompt },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 8192,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error('Gemini API error:', response.status, errText);
            return NextResponse.json({ error: errText, softwares: [] }, { status: 500 });
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        console.log('Gemini OCR response:', text);

        // Robust parsing: try full JSON first, then extract names individually
        let softwares: { name: string }[] = [];

        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const raw: { name?: string }[] = parsed.softwares || [];
                softwares = raw.filter((s): s is { name: string } => typeof s?.name === 'string' && s.name.trim().length > 0)
                    .map(s => ({ name: s.name.trim() }));
            }
        } catch {
            // Fallback: extract all "name":"value" pairs individually
            const matches = [...text.matchAll(/"name"\s*:\s*"([^"]+)"/g)];
            softwares = matches
                .map(m => ({ name: m[1].trim() }))
                .filter(s => s.name.length > 0);
        }

        console.log('Parsed softwares:', softwares);
        return NextResponse.json({ softwares });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('OCR error:', msg);
        return NextResponse.json({ error: msg, softwares: [] }, { status: 500 });
    }
}
