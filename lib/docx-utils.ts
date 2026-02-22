import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

interface DocxData {
    schoolName: string;
    year: number;
    classNum: number;
    teacherName: string;
    qrDataUrl: string; // base64
}

export async function generateFamilyLetterDocx(data: DocxData) {
    const { schoolName, year, classNum, teacherName, qrDataUrl } = data;

    // Convert base64 to Uint8Array for docx
    const response = await fetch(qrDataUrl);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const qrImageBuffer = new Uint8Array(arrayBuffer);

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({
                            text: "행복 가동 교육통신",
                            bold: true,
                            size: 40,
                        }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 200 },
                    children: [
                        new TextRun({
                            text: `${new Date().getFullYear()}학년도 ${year}학년 ${classNum}반 담임교사: ${teacherName}`,
                            size: 24,
                        }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                        new TextRun({
                            text: "http://gadong.sen.es.kr",
                            size: 20,
                            color: "0000FF",
                        }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 800, after: 400 },
                    children: [
                        new TextRun({
                            text: "학습지원 소프트웨어 개인정보 수집·이용·제공 동의 안내",
                            bold: true,
                            size: 32,
                        }),
                    ],
                }),
                new Paragraph({
                    spacing: { after: 200 },
                    children: [
                        new TextRun({
                            text: "학부모님, 안녕하십니까? \n본교에서는 학생들의 개별화된 맞춤형 학습 지원을 위해 교육적 효과가 검증된 '학습지원 소프트웨어(에듀테크)'를 교육 과정에 활용하고자 합니다.",
                            size: 22,
                        }),
                    ],
                }),
                new Paragraph({
                    spacing: { after: 200 },
                    children: [
                        new TextRun({
                            text: "「초·중등교육법」 제29조의2 신설(‘25. 8. 14. 개정, ’26. 3. 1. 시행)에 따라, 학습지원 소프트웨어 활용을 위해 학생의 개인정보 수집 및 제3자 제공에 대한 동의를 받고자 하오니 아래 내용을 확인하시고 동의 여부를 회신해주시기 바랍니다.",
                            size: 22,
                        }),
                    ],
                }),

                // QR Code section
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 400, after: 200 },
                    children: [
                        new TextRun({
                            text: "▼ 아래 QR 코드를 스캔하시면 온라인으로 즉시 동의하실 수 있습니다 ▼",
                            bold: true,
                            size: 20,
                        }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new ImageRun({
                            data: qrImageBuffer,
                            transformation: {
                                width: 140,
                                height: 140,
                            },
                            type: "png",
                        }),
                    ],
                }),

                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 800 },
                    children: [
                        new TextRun({
                            text: "-----------------------------------------------------------",
                            size: 20,
                        }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({
                            text: "개인정보 수집 및 이용 동의서 (오프라인 회신용)",
                            bold: true,
                            size: 28,
                        }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 400 },
                    children: [
                        new TextRun({
                            text: "본인은 위 내용을 충분히 이해하였으며, 각 항목의 개인정보 수집·이용 및 제3자 제공에 관하여 위와 같이 동의합니다.",
                            size: 20,
                        }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 400 },
                    children: [
                        new TextRun({
                            text: `( ${year} )학년 ( ${classNum} )반 (      )번 `,
                            size: 24,
                        }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 200 },
                    children: [
                        new TextRun({
                            text: "학생 성명 :                   (인)",
                            size: 24,
                        }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 200 },
                    children: [
                        new TextRun({
                            text: "보호자 성명 :                   (인)",
                            size: 24,
                        }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 600 },
                    children: [
                        new TextRun({
                            text: `${new Date().getFullYear()}.      .      .`,
                            size: 22,
                        }),
                    ],
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 400 },
                    children: [
                        new TextRun({
                            text: `서  울  ${schoolName}  초  등  학  교  장`,
                            bold: true,
                            size: 32,
                        }),
                    ],
                }),
            ],
        }],
    });

    const buffer = await Packer.toBlob(doc);
    saveAs(buffer, `${year}학년 ${classNum}반 가정통신문.docx`);
}
