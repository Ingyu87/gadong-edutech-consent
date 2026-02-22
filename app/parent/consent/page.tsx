'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClass, upsertConsent, getConsentById, getSmcRecords } from '@/lib/db';
import { ClassConfig, SoftwareItem, ConsentRecord, SmcRecord } from '@/lib/types';

export default function ParentConsentPage() {
    const router = useRouter();
    const [classConfig, setClassConfig] = useState<ClassConfig | null>(null);
    const [responses, setResponses] = useState<Record<string, boolean | null>>({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [confirmationCode, setConfirmationCode] = useState('');
    const [existingConsent, setExistingConsent] = useState<ConsentRecord | null>(null);
    const [authError, setAuthError] = useState(false);
    const [smcList, setSmcList] = useState<SmcRecord[]>([]);
    const [showTop, setShowTop] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        loadData();
        const handleScroll = () => setShowTop(window.scrollY > 400);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const get = (key: string) => typeof window !== 'undefined' ? sessionStorage.getItem(key) || '' : '';

    const loadData = async () => {
        const classId = get('parentClassId');
        const number = get('parentNumber');
        const pin = get('parentPin');
        const schoolId = get('schoolId');
        if (!classId || !number || !pin || !schoolId) { router.replace('/parent/login'); return; }

        const { makeConsentId } = await import('@/lib/db');
        const [cls, existing, smc] = await Promise.all([
            getClass(classId),
            getConsentById(makeConsentId(classId, Number(number))),
            getSmcRecords(schoolId),
        ]);
        setClassConfig(cls);
        setSmcList(smc);

        if (existing) {
            const pinOk = existing.pin === pin;
            const studentOk = existing.studentName.trim() === get('parentStudentName').trim();
            const parentOk = existing.parentName.trim() === get('parentName').trim();

            if (!pinOk || !studentOk || !parentOk) {
                setAuthError(true);
                setLoaded(true);
                return;
            }
            setExistingConsent(existing);
            setResponses(existing.responses || {});
            if (existing.confirmationCode) setConfirmationCode(existing.confirmationCode);
        } else {
            const init: Record<string, null> = {};
            cls?.selectedSoftwares?.forEach(sw => { init[sw.id] = null; });
            setResponses(init);
        }
        setLoaded(true);
    };

    const handleAgree = (swId: string, val: boolean) => {
        setResponses(prev => ({ ...prev, [swId]: prev[swId] === val ? null : val }));
    };

    const handleAgreeAll = () => {
        const all: Record<string, boolean> = {};
        const swList = classConfig?.registrySoftwares || classConfig?.selectedSoftwares || [];
        swList.forEach(sw => { all[sw.id] = true; });
        setResponses(all);
    };

    const generateCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars like 0, O, 1, I, S, 5
        let res = '';
        for (let i = 0; i < 3; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
        return res;
    };

    const handleSave = async () => {
        setSaving(true);
        const { makeConsentId } = await import('@/lib/db');
        const classId = get('parentClassId');
        const number = get('parentNumber');
        const schoolId = get('schoolId');
        const consentId = makeConsentId(classId, Number(number));

        const newCode = confirmationCode || generateCode();
        setConfirmationCode(newCode);

        await upsertConsent({
            schoolId,
            classId,
            studentNumber: Number(number),
            studentName: get('parentStudentName'),
            parentName: get('parentName'),
            pin: get('parentPin'),
            responses,
            confirmationCode: newCode,
        }, consentId);
        setSaving(false);
        setSaved(true);
    };

    const smcMatch = (smcName: string, swName: string) =>
        smcName.trim().toLowerCase() === swName.trim().toLowerCase();

    const swList = classConfig?.registrySoftwares || classConfig?.selectedSoftwares || [];
    const totalCount = swList.length;
    const agreedCount = Object.values(responses).filter(v => v === true).length;
    const answeredCount = Object.values(responses).filter(v => v !== null).length;

    if (!loaded) return (
        <div className="app-shell">
            <header className="header"><div className="header-logo"><span>🏫</span>에듀테크 개인정보 동의 시스템</div></header>
            <main className="main-content"><div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div></main>
        </div>
    );

    if (authError) return (
        <div className="app-shell">
            <header className="header"><div className="header-logo"><span>🏫</span>에듀테크 개인정보 동의 시스템</div></header>
            <main className="main-content" style={{ maxWidth: 440 }}>
                <div className="card" style={{ marginTop: 40, textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
                    <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>비밀번호가 일치하지 않습니다</p>
                    <p style={{ color: 'var(--gray-400)', fontSize: '0.88rem', marginBottom: 24 }}>처음 입력하신 4자리 비밀번호를 확인해 주세요.</p>
                    <button className="btn btn-primary" onClick={() => router.push('/parent/login')}>다시 시도</button>
                </div>
            </main>
        </div>
    );

    if (saved) return (
        <div className="app-shell">
            <header className="header"><div className="header-logo"><span>🏫</span>에듀테크 개인정보 동의 시스템</div></header>
            <main className="main-content" style={{ maxWidth: 480 }}>
                <div className="card" style={{ marginTop: 40, textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
                    <p style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 8 }}>동의가 제출되었습니다!</p>
                    <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem', marginBottom: 4 }}>
                        {get('parentStudentName')} 학생 ({get('parentName')} 학부모님)
                    </p>
                    <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', marginBottom: 16 }}>
                        총 {totalCount}개 중 <strong>{agreedCount}개 동의</strong>
                    </p>
                    <div className="alert alert-warning" style={{ textAlign: 'left', marginBottom: 12 }}>
                        <span>📝</span>
                        <span>최종 서명은 배부된 <strong>종이 통신문</strong>에 직접 작성하여 제출해 주세요.</span>
                    </div>

                    <div style={{ background: 'var(--primary-light)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: 16 }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, marginBottom: 8 }}>📋 가정통신문 확인 코드</p>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: 4 }}>
                            {confirmationCode}
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--primary)', marginTop: 8, opacity: 0.8 }}>
                            위 세 글자를 종이 가정통신문의 <strong>확인 코드란</strong> 또는 <strong>여백</strong>에 적어서 보내주세요.
                        </p>
                    </div>
                    {classConfig?.teacherNote && (
                        <div className="alert alert-info" style={{ textAlign: 'left' }}>
                            <span>💬</span><span>{classConfig.teacherNote}</span>
                        </div>
                    )}
                    <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => setSaved(false)}>수정하기</button>
                </div>
            </main>
        </div>
    );

    if (!classConfig) return null;

    return (
        <div className="app-shell">
            <header className="header">
                <div className="header-logo"><span>🏫</span>에듀테크 개인정보 동의 시스템</div>
                <span className="header-mode-badge badge-parent">학부모</span>
            </header>
            <main className="main-content" style={{ maxWidth: 720 }}>
                {/* Info */}
                <div className="card" style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                            <p style={{ fontWeight: 700, fontSize: '1rem' }}>{classConfig.year}학년 {classConfig.classNum}반 개인정보 동의서</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--gray-400)' }}>
                                {get('parentNumber')}번 {get('parentStudentName')} · 학부모 {get('parentName')}
                            </p>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--gray-500)' }}>
                            {answeredCount}/{totalCount} 응답 완료
                        </div>
                    </div>
                </div>

                {/* Offline notice */}
                <div className="alert alert-warning" style={{ marginBottom: 14 }}>
                    <span>📝</span>
                    <span>이 페이지는 사전 조사용입니다. <strong>최종 서명은 반드시 종이 통신문에 작성</strong>하여 제출해 주세요.</span>
                </div>

                {classConfig.teacherNote && (
                    <div className="alert alert-info" style={{ marginBottom: 14 }}>
                        <span>💬</span><span>{classConfig.teacherNote}</span>
                    </div>
                )}

                {/* Bulk agree */}
                <div className="card" style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 700 }}>전체 동의</p>
                            <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginTop: 2 }}>전체 {totalCount}개 소프트웨어 모두 동의</p>
                        </div>
                        <button className="btn btn-success" onClick={handleAgreeAll}>✅ 전체 일괄 동의</button>
                    </div>
                </div>

                <div className="alert alert-info" style={{ marginBottom: 14, fontSize: '0.82rem', lineHeight: '1.5' }}>
                    <span>⚖️</span>
                    <span>법적으로 규정된 목적(학교생활기록부 및 건강기록부 작성 등) 이외의 수집 항목들에 대한 정보 이용 동의를 거부할 권리가 있음을 알려드리며 아울러 거부 시 해당 항목의 서비스가 제공되지 않는 제한 사항이 있을 수 있습니다.</span>
                </div>

                {/* Individual consent (Table style) */}
                <div className="card" style={{ padding: '20px 0' }}>
                    <p className="card-title" style={{ padding: '0 20px', marginBottom: 20 }}>📋 에듀테크별 개별 동의</p>
                    <div className="table-wrapper">
                        <table style={{ borderTop: '1px solid var(--gray-200)' }}>
                            <thead>
                                <tr>
                                    <th style={{ paddingLeft: 20 }}>에듀테크명</th>
                                    <th>심의여부</th>
                                    <th>사용연령</th>
                                    <th>링크</th>
                                    <th style={{ textAlign: 'center', paddingRight: 20 }}>동의 선택</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(classConfig.registrySoftwares || classConfig.selectedSoftwares || []).map((sw: SoftwareItem) => {
                                    const resp = responses[sw.id];
                                    const approved = smcList.some(sm => smcMatch(sm.softwareName, sw.name));
                                    return (
                                        <tr key={sw.id}>
                                            <td style={{ paddingLeft: 20, verticalAlign: 'middle' }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{sw.name}</div>
                                            </td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                {approved ? (
                                                    <span className="badge badge-smc">✅ 심의완료</span>
                                                ) : (
                                                    <span className="badge badge-no-smc">⚠️ 심의 확인</span>
                                                )}
                                            </td>
                                            <td style={{ verticalAlign: 'middle', fontSize: '0.82rem', color: 'var(--gray-600)' }}>
                                                {sw.ageRange || '-'}
                                            </td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <div style={{ display: 'flex', gap: 10 }}>
                                                    {sw.url && <a href={sw.url} target="_blank" rel="noopener noreferrer" className="consent-link">사이트 ↗</a>}
                                                    {sw.privacyUrl && <a href={sw.privacyUrl} target="_blank" rel="noopener noreferrer" className="consent-link">약관 ↗</a>}
                                                </div>
                                            </td>
                                            <td style={{ paddingRight: 20, textAlign: 'center', verticalAlign: 'middle' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                                                    <button
                                                        className={`consent-btn ${resp === true ? 'active' : ''}`}
                                                        style={{
                                                            padding: '4px 12px', fontSize: '0.78rem',
                                                            borderColor: resp === true ? 'var(--success)' : 'var(--gray-300)',
                                                            color: resp === true ? 'var(--white)' : 'var(--gray-400)',
                                                            background: resp === true ? 'var(--success)' : 'transparent'
                                                        }}
                                                        onClick={() => handleAgree(sw.id, true)}>동의</button>
                                                    <button
                                                        className={`consent-btn ${resp === false ? 'active' : ''}`}
                                                        style={{
                                                            padding: '4px 10px', fontSize: '0.78rem',
                                                            borderColor: resp === false ? 'var(--danger)' : 'var(--gray-300)',
                                                            color: resp === false ? 'var(--white)' : 'var(--gray-400)',
                                                            background: resp === false ? 'var(--danger)' : 'transparent'
                                                        }}
                                                        onClick={() => handleAgree(sw.id, false)}>비동의</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Submit */}
                <div style={{ marginTop: 20, paddingBottom: 40 }}>
                    <button className="btn btn-primary btn-block btn-lg" onClick={handleSave} disabled={saving} style={{ marginBottom: 10 }}>
                        {saving ? '제출 중...' : existingConsent ? '수정 제출하기' : '동의 제출하기'}
                    </button>
                    <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--gray-400)' }}>
                        제출 후 비밀번호로 다시 접속하여 수정 가능합니다.
                    </p>
                </div>
            </main>

            <button className={`btn-top ${showTop ? 'visible' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                ↑
            </button>
        </div>
    );
}
