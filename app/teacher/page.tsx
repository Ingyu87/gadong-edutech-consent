'use client';

import { useEffect, useState, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { getClass, getSmcRecords, getConsents, upsertClass } from '@/lib/db';
import { ClassConfig, SmcRecord, SoftwareItem, ConsentRecord } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import QRCode from 'qrcode';
import Papa from 'papaparse';

type Tab = 'csv' | 'qr' | 'monitor';

export default function TeacherPage() {
    const router = useRouter();
    const [schoolId, setSchoolId] = useState('');
    const [schoolName, setSchoolName] = useState('');
    const [classConfig, setClassConfig] = useState<ClassConfig | null>(null);
    const [smcList, setSmcList] = useState<SmcRecord[]>([]);
    const [allSoftwares, setAllSoftwares] = useState<SoftwareItem[]>([]);
    const [selected, setSelected] = useState<SoftwareItem[]>([]);
    const [consents, setConsents] = useState<ConsentRecord[]>([]);
    const [tab, setTab] = useState<Tab>('csv');
    const [teacherNote, setTeacherNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
    const [showTop, setShowTop] = useState(false);
    const [loading, setLoading] = useState(true);
    const [csvData, setCsvData] = useState<SoftwareItem[]>([]);
    const csvFileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const id = sessionStorage.getItem('schoolId');
        const name = sessionStorage.getItem('schoolName');
        const classId = sessionStorage.getItem('classId');
        const auth = sessionStorage.getItem('teacherAuth');
        if (!id || !classId || auth !== 'true') { router.replace('/role'); return; }
        setSchoolId(id);
        setSchoolName(name || '');
        loadAll(id, classId);

        const handleScroll = () => setShowTop(window.scrollY > 400);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [router]);

    const loadAll = async (sid: string, classId: string) => {
        const [cls, smc, consentList] = await Promise.all([
            getClass(classId),
            getSmcRecords(sid),
            getConsents(classId),
        ]);

        if (cls && !cls.isActive) {
            await upsertClass({ ...cls, isActive: true }, classId);
            cls.isActive = true;
        }

        setAllSoftwares(cls?.registrySoftwares || []);
        setSmcList(smc);
        setClassConfig(cls);
        setSelected(cls?.selectedSoftwares || []);
        setTeacherNote(cls?.teacherNote || '');
        setConsents(consentList);

        // Generate QR code
        const url = `${window.location.origin}/parent/login?classId=${classId}`;
        try {
            const dataUrl = await QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#1e3a5f', light: '#ffffff' } });
            setQrDataUrl(dataUrl);
        } catch (e) { console.error(e); }
    };

    const isSmcApproved = (sw: SoftwareItem) => smcList.some(s => s.softwareName.trim() === sw.name.trim());

    const maskName = (name: string) => {
        if (!name || name.length < 2) return name;
        if (name.length === 2) return name[0] + '*';
        return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
    };

    const toggleSelect = (sw: SoftwareItem) => {
        setSelected(prev => prev.find(s => s.id === sw.id)
            ? prev.filter(s => s.id !== sw.id)
            : [...prev, { ...sw, isSmcApproved: isSmcApproved(sw) }]);
    };

    const handleSave = async () => {
        if (!classConfig) return;
        setSaving(true);
        await upsertClass({
            ...classConfig,
            selectedSoftwares: selected.map(s => ({ ...s, isSmcApproved: isSmcApproved(s) })),
            teacherNote,
            isActive: true,
        }, classConfig.id);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleDeleteConsentAction = async (consentId: string) => {
        if (!confirm('이 학생의 동의 내역을 초기화하시겠습니까?\n\n초기화하면 해당 학생의 비밀번호와 동의서가 모두 삭제되며, 학부모가 처음부터 다시 작성해야 합니다.')) return;
        const { deleteConsent } = await import('@/lib/db');
        await deleteConsent(consentId);
        setConsents(prev => prev.filter(c => c.id !== consentId));
        alert('초기화되었습니다.');
    };

    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const parseFile = (encoding: string) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                encoding: encoding,
                transformHeader: (h) => h.trim().replace(/^\uFEFF/, ''),
                complete: (result) => {
                    const rows = result.data as Record<string, string>[];
                    console.log(`Parsed rows (${encoding}):`, rows);
                    const items: SoftwareItem[] = rows
                        .filter(r => {
                            const keys = Object.keys(r);
                            return keys.some(k => (k.includes('명') || k.toLowerCase().includes('name')) && r[k]);
                        })
                        .map((r, i) => {
                            const keys = Object.keys(r);
                            const nameKey = keys.find(k => k.includes('명') || k.toLowerCase().includes('name')) || '';
                            const ageKey = keys.find(k => k.includes('연령') || k.toLowerCase().includes('age')) || '';
                            const urlKey = keys.find(k => k.includes('주소') || k.toLowerCase().includes('url')) || '';
                            const privacyKey = keys.find(k => k.includes('약관') || k.includes('방침') || k.toLowerCase().includes('privacy')) || '';

                            return {
                                id: `csv_${i}_${Date.now()}`,
                                name: (r[nameKey] || '').trim(),
                                ageRange: (r[ageKey] || '').trim(),
                                url: (r[urlKey] || '').trim(),
                                privacyUrl: (r[privacyKey] || '').trim(),
                                hasAi: false,
                                hasLms: false,
                            };
                        });

                    if (items.length > 0) {
                        setCsvData(items);
                    } else if (encoding === 'UTF-8') {
                        parseFile('EUC-KR');
                    } else {
                        alert('CSV 파일에서 유효한 에듀테크 목록을 찾을 수 없습니다. 컬럼명(에듀테크명 등)을 확인해 주세요.');
                        setCsvData([]);
                    }
                }
            });
        };

        parseFile('UTF-8');
    };

    const handleSaveCsv = async () => {
        if (!csvData.length || !classConfig) return;
        const newRegistry = [...allSoftwares, ...csvData];
        // Automatically select all items and activate the class
        const newSelected = newRegistry.map(s => ({ ...s, isSmcApproved: isSmcApproved(s) }));
        await upsertClass({
            ...classConfig,
            registrySoftwares: newRegistry,
            selectedSoftwares: newSelected,
            isActive: true
        }, classConfig.id);
        alert(`${csvData.length}개 소프트웨어가 등록되었으며, 즉시 동의 가능하도록 활성화되었습니다.`);
        setCsvData([]);
        setAllSoftwares(newRegistry);
        setSelected(newSelected);
        if (csvFileRef.current) csvFileRef.current.value = '';
    };

    const handleResetClass = async () => {
        if (!classConfig) return;
        if (!confirm('반 설정을 초기화합니다. 선택된 소프트웨어가 모두 해제됩니다. 계속하시겠습니까?')) return;
        await upsertClass({ ...classConfig, selectedSoftwares: [], isActive: false }, classConfig.id);
        setSelected([]);
        alert('초기화 완료!');
    };

    const handleDeleteAllSoftwares = async () => {
        if (!classConfig) return;
        if (!confirm('우리 반의 에듀테크 등록 목록을 모두 삭제하시겠습니까?')) return;
        await upsertClass({ ...classConfig, registrySoftwares: [], selectedSoftwares: [], isActive: false }, classConfig.id);
        setAllSoftwares([]);
        setSelected([]);
        alert('우리 반 등록 목록 삭제 완료!');
    };

    const logout = () => { sessionStorage.removeItem('teacherAuth'); sessionStorage.removeItem('classId'); router.push('/role'); };

    const parentUrl = classConfig ? `${typeof window !== 'undefined' ? window.location.origin : ''}/parent/login?classId=${classConfig.id}` : '';

    if (!classConfig) return (
        <div className="app-shell">
            <header className="header"><div className="header-logo"><span>🏫</span>에듀테크 개인정보 동의 시스템</div></header>
            <main className="main-content"><div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div></main>
        </div>
    );

    return (
        <div className="app-shell">
            <header className="header">
                <div className="header-logo"><span>🏫</span>에듀테크 개인정보 동의 시스템</div>
                <span className="header-school">{schoolName} {classConfig.year}학년 {classConfig.classNum}반 — {maskName(classConfig.teacherName)} 선생님</span>
                <span className="header-mode-badge badge-teacher">교사</span>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 12 }} onClick={logout}>로그아웃</button>
            </header>
            <main className="main-content" style={{ maxWidth: 960 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--gray-200)' }}>
                    {([['csv', '📁 SW 등록(CSV)'], ['qr', '📱 QR / 링크'], ['monitor', '📋 학생 현황']] as [Tab, string][]).map(([key, label]) => (
                        <button key={key} className="btn btn-ghost btn-sm"
                            style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', borderBottom: tab === key ? '2px solid var(--primary)' : 'none', color: tab === key ? 'var(--primary)' : 'var(--gray-600)', fontWeight: tab === key ? 700 : 400, background: tab === key ? 'var(--primary-light)' : 'transparent' }}
                            onClick={() => setTab(key as Tab)}>{label}</button>
                    ))}
                </div>


                {/* CSV */}
                {tab === 'csv' && (
                    <div>
                        <div className="card" style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <p className="card-title" style={{ marginBottom: 0 }}>📁 에듀테크 목록 CSV 등록</p>
                                {allSoftwares.length > 0 && (
                                    <button className="btn btn-danger btn-sm" onClick={handleDeleteAllSoftwares}>
                                        🗑️ 등록 목록 초기화
                                    </button>
                                )}
                            </div>

                            {/* Google Sheets 안내 */}
                            <div style={{ background: '#f0f7ff', border: '1.5px solid #b3d4f5', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 14 }}>
                                <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 10 }}>📊 에듀테크 목록 작성 및 업로드 방법</p>
                                <ol style={{ paddingLeft: 18, fontSize: '0.85rem', lineHeight: 1.8, color: 'var(--gray-700)', margin: 0 }}>
                                    <li>아래 버튼을 클릭하여 양식(구글시트)을 확인합니다.</li>
                                    <li>양식을 참고하여 우리 반에서 사용할 에듀테크 목록을 작성합니다.</li>
                                    <li>작성한 시트를 <strong>[파일] → [다운로드] → [쉼표로 구분된 값(.csv)]</strong>로 저장합니다.</li>
                                    <li>저장된 CSV 파일을 아래에서 선택하여 업로드합니다.</li>
                                </ol>
                                <a
                                    href="https://docs.google.com/spreadsheets/d/1C79rrjS9XXKZZseHbIhNYxsdPlK7HkfF2uZD_cLa1tg/copy?usp=sharing"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-outline"
                                    style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
                                >
                                    📋 양식(구글시트) 열기 ↗
                                </a>
                            </div>

                            <div className="alert alert-info" style={{ marginBottom: 12 }}>
                                <span>ℹ️</span>
                                <div>
                                    <strong>CSV 컬럼명:</strong> <code>에듀테크명, 약관, 사이트주소, 사용연령</code><br />
                                    등록하면 <strong>즉시 우리 반 에듀테크로 활성화</strong>됩니다.
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label">CSV 파일 선택</label>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <input ref={csvFileRef} type="file" accept=".csv" className="form-control"
                                        style={{ padding: 8, flex: 1 }} onChange={handleCsvUpload} />
                                    {csvData.length > 0 && (
                                        <button className="btn btn-primary" style={{ flexShrink: 0, padding: '0 24px' }} onClick={handleSaveCsv}>
                                            🚀 {csvData.length}개 등록하기
                                        </button>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: 8 }}>
                                    💡 파일을 선택하면 아래에 미리보기 목록이 나타납니다. 확인 후 <b>[등록하기]</b>를 클릭하세요.
                                </p>
                            </div>
                        </div>

                        {/* Current Registry List */}
                        {allSoftwares.length > 0 && csvData.length === 0 && (
                            <div className="card">
                                <p className="card-title">✅ 현재 등록된 에듀테크 ({allSoftwares.length}개)</p>
                                <div className="table-wrapper">
                                    <table>
                                        <thead><tr><th>에듀테크명</th><th>심의여부</th><th>사용연령</th><th>링크</th></tr></thead>
                                        <tbody>
                                            {allSoftwares.map(item => (
                                                <tr key={item.id}>
                                                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                                                    <td>{isSmcApproved(item) ? <span className="badge badge-smc">✅ 심의완료</span> : <span className="badge badge-no-smc">⚠️ 심의 확인</span>}</td>
                                                    <td>{item.ageRange || '-'}</td>
                                                    <td>
                                                        {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '0.82rem', marginRight: 8 }}>사이트 ↗</a>}
                                                        {item.privacyUrl && <a href={item.privacyUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '0.82rem' }}>약관 ↗</a>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* CSV Preview */}
                        {csvData.length > 0 && (
                            <div className="card">
                                <p className="card-title">📋 등록 예정 목록 미리보기</p>
                                <div className="table-wrapper">
                                    <table>
                                        <thead><tr><th>에듀테크명</th><th>사용연령</th><th>사이트</th><th>약관</th></tr></thead>
                                        <tbody>
                                            {csvData.map(item => (
                                                <tr key={item.id}>
                                                    <td>{item.name}</td>
                                                    <td>{item.ageRange || '-'}</td>
                                                    <td>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '0.82rem' }}>링크 ↗</a> : <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>미입력</span>}</td>
                                                    <td>{item.privacyUrl ? <a href={item.privacyUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '0.82rem' }}>약관 ↗</a> : <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>미입력</span>}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* MONITOR */}
                {tab === 'monitor' && (
                    <div className="card">
                        <p className="card-title">📋 학생별 동의 현황</p>

                        {/* Per-software summary */}
                        {(() => {
                            const swList = classConfig.registrySoftwares || classConfig.selectedSoftwares || [];
                            if (swList.length === 0 || consents.length === 0) return null;
                            return (
                                <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 20, padding: 2, border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-md)', background: 'var(--gray-50)' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 10 }}>
                                        {swList.map(sw => {
                                            const agree = consents.filter(c => c.responses[sw.id] === true);
                                            const disagree = consents.filter(c => c.responses[sw.id] === false);
                                            const pending = consents.filter(c => c.responses[sw.id] == null);
                                            return (
                                                <div key={sw.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '10px 14px', minWidth: 160 }}>
                                                    <p style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 6 }}>{sw.name}</p>
                                                    <div style={{ fontSize: '0.8rem', lineHeight: 1.9 }}>
                                                        <span style={{ color: '#2e7d32' }}>✅ 동의 {agree.length}명</span><br />
                                                        <span style={{ color: 'var(--danger)' }}>❌ 비동의 {disagree.length}명</span>
                                                        {disagree.length > 0 && <span style={{ color: 'var(--danger)', fontSize: '0.72rem' }}> ({disagree.map(c => maskName(c.studentName)).join(', ')})</span>}
                                                        <br />
                                                        <span style={{ color: 'var(--gray-400)' }}>— 미응답 {pending.length}명</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}

                        {consents.length === 0 ? (
                            <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px 0' }}>아직 동의를 제출한 학부모가 없습니다.</p>
                        ) : (
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>번호</th><th>학생</th><th>학부모</th>
                                            <th style={{ textAlign: 'center' }}>코드</th>
                                            <th>동의 현황</th>
                                            <th style={{ textAlign: 'center' }}>제출일</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {consents.sort((a, b) => a.studentNumber - b.studentNumber).map(c => {
                                            const isExpanded = expandedStudentId === c.id;
                                            const swList = classConfig.registrySoftwares || classConfig.selectedSoftwares || [];
                                            const total = swList.length;
                                            const agreed = Object.values(c.responses).filter(v => v === true).length;

                                            return (
                                                <Fragment key={c.id}>
                                                    <tr
                                                        onClick={() => setExpandedStudentId(isExpanded ? null : c.id)}
                                                        style={{ cursor: 'pointer', background: isExpanded ? 'var(--primary-light)' : undefined }}
                                                    >
                                                        <td>{c.studentNumber}번</td>
                                                        <td style={{ fontWeight: 700 }}>{maskName(c.studentName)}</td>
                                                        <td style={{ textAlign: 'center' }}>{maskName(c.parentName)}</td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', letterSpacing: 1, fontSize: '0.82rem' }}>
                                                                {c.confirmationCode || '—'}
                                                            </span>
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <span className="badge badge-smc" style={{ fontSize: '0.75rem' }}>
                                                                {agreed} / {total} 동의
                                                            </span>
                                                        </td>
                                                        <td style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--gray-400)' }}>
                                                            {c.updatedAt ? new Date((c.updatedAt as unknown as { seconds: number }).seconds * 1000).toLocaleDateString('ko-KR') : '-'}
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={6} style={{ padding: '0 20px 20px', background: 'var(--gray-50)' }}>
                                                                <div className="card" style={{ marginTop: 10, border: '1px solid var(--gray-200)', padding: 16 }}>
                                                                    <p style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                                                                        <span>📋 {maskName(c.studentName)} 학생의 상세 동의 내역</span>
                                                                        <button className="btn btn-ghost" style={{ fontSize: '0.72rem', color: 'var(--danger)', padding: '0 4px', height: 20 }}
                                                                            onClick={(e) => { e.stopPropagation(); handleDeleteConsentAction(c.id); }}>
                                                                            🗑️ 기록 초기화
                                                                        </button>
                                                                    </p>
                                                                    <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
                                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                                                                            {swList.map(sw => {
                                                                                const resp = c.responses[sw.id];
                                                                                return (
                                                                                    <div key={sw.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'white', borderRadius: 8, border: '1px solid var(--gray-100)', fontSize: '0.82rem' }}>
                                                                                        <span>{resp === true ? '✅' : resp === false ? '❌' : '—'}</span>
                                                                                        <span style={{ fontWeight: 600, flex: 1 }}>{sw.name}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )
                }

                {/* QR */}
                {tab === 'qr' && (
                    <div className="card" style={{ textAlign: 'center' }}>
                        <div className="card" style={{ marginBottom: 16 }}>
                            <p className="card-title">💬 학부모 안내 메시지</p>
                            <p style={{ fontSize: '0.82rem', color: 'var(--gray-400)', marginBottom: 10 }}>동의서 페이지 하단에 표시될 메시지입니다.</p>
                            <textarea className="form-control" rows={3}
                                placeholder="예: 종이 통신문은 금주 금요일까지 제출해 주세요."
                                value={teacherNote} onChange={e => setTeacherNote(e.target.value)} />
                            <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={handleSave} disabled={saving}>
                                {saving ? '저장 중...' : saved ? '✅ 저장되었습니다!' : '💾 메시지 저장'}
                            </button>
                        </div>

                        <p className="card-title" style={{ justifyContent: 'center' }}>📱 학부모용 QR 코드 / 링크</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--gray-400)', marginBottom: 20 }}>
                            아래 QR 코드 또는 링크를 학부모에게 공유하세요.
                        </p>
                        {qrDataUrl ? (
                            <div style={{ display: 'inline-block', padding: 16, background: 'white', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.1)', marginBottom: 20 }}>
                                <img src={qrDataUrl} alt="QR Code" style={{ display: 'block', width: 240, height: 240 }} />
                            </div>
                        ) : (
                            <div style={{ width: 240, height: 240, background: 'var(--gray-100)', borderRadius: 12, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div className="spinner" />
                            </div>
                        )}
                        <div style={{ background: 'var(--gray-100)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 16, wordBreak: 'break-all', fontSize: '0.82rem', color: 'var(--gray-700)' }}>
                            {parentUrl}
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <button className="btn btn-outline" onClick={() => { navigator.clipboard.writeText(parentUrl); alert('링크가 복사되었습니다!'); }}>
                                📋 링크 복사
                            </button>
                            {qrDataUrl && (
                                <a href={qrDataUrl} download={`QR_${classConfig.year}학년${classConfig.classNum}반.png`} className="btn btn-primary">
                                    ⬇️ QR 저장
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </main>

            <button className={`btn-top ${showTop ? 'visible' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                ↑
            </button>
        </div>
    );
}
