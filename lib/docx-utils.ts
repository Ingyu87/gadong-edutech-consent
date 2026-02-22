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
                            text: "학부모님 안녕하십니까?\n  본교는 미래 사회를 살아갈 학생들의 디지털 역량을 강화하고, 개별 맞춤형 교육을 실현하기 위해 다양한 AI·디지털 학습지원 소프트웨어를 교육과정에 도입하고 있습니다.\n  최근 「초·중등교육법」 제29조의2 신설(‘25. 8. 14. 개정, ‘26. 3. 1. 시행)에 따라, 학교에서 사용하는 모든 학습지원 소프트웨어는 개인정보 보호와 교육적 효과성을 사전에 검토하여 학교운영위원회의 심의를 거치도록 규정되었습니다. 이에 본교는 교육부와 개인정보 보호위원회가 협의하여 정한 5가지 필수 기준(개인정보 최소 처리, 안전조치 의무, 이용자 권리 보장, 아동 개인정보 보호 등)을 철저히 확인하고 있습니다. 이에 「개인정보 보호법」 제15조, 제17조, 제22조, 제22조의2에 따라 학생의 개인정보가 ①어떤 목적으로, ②어떤 기업에, ③어떤 정보가 제공되는지 상세히 안내드리고 동의를 받고자 합니다. 항목이 많아 복잡해 보이실 수 있으나, 이는 정보주체(학부모님)의 소중한 권리를 보장하기 위함입니다.\n  아래 학습지원 소프트웨어는 본교에서 학운위 심의에 통과한 프로그램이며 각 소프트웨어 별로 개인정보 수집내용이 상이할 수 있습니다. 학생의 개인정보는 최소 수집의 원칙에 따라 교육활동에 필요한 경우, 최소한의 항목만을 수집하며, 이용 목적에 맞게 취급 처리할 수 있도록 철저히 관리하겠습니다. 또한 개인정보 수집 목적이 종료되는 즉시 파기하도록 하겠습니다. 수집 항목들에 대한 정보 이용 동의를 거부할 권리가 있음을 알려드리며 아울러 거부 시 해당 항목의 서비스가 제공되지 않는 제한 사항이 있음을 인지하시고, 빠짐없이 확인하신 후 서명해 주시기 바랍니다. 학생들이 안전한 디지털 환경에서 학습권을 보장받으며 유익한 교육 자료를 활용할 수 있도록, 개인정보 수집 및 이용 동의서를 3월 6일(금)까지 회신해주시기 바랍니다. 감사합니다.",
                            size: 20,
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
                            text: `(   ${year}   )학년 (   ${classNum}   )반 (       )번 코드(         )`,
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
