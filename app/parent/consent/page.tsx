'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClass, upsertConsent, getConsentById, getSmcRecords } from '@/lib/db';
import { ClassConfig, SoftwareItem, ConsentRecord, SmcRecord, ConsentResponse } from '@/lib/types';

function normalizeResp(r: ConsentRecord['responses'][string]): ConsentResponse {
    if (r == null) return { agree: null, collectionUse: null, thirdParty: null };
    if (typeof r === 'boolean') return { agree: r, collectionUse: null, thirdParty: null };
    return { agree: r.agree ?? null, collectionUse: r.collectionUse ?? null, thirdParty: r.thirdParty ?? null };
}

export default function ParentConsentPage() {
    const router = useRouter();
    const [classConfig, setClassConfig] = useState<ClassConfig | null>(null);
    const [responses, setResponses] = useState<Record<string, ConsentResponse>>({});
    const [consentModal, setConsentModal] = useState<{ title: string; body: string } | null>(null);
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

        const regList = Array.isArray(cls?.registrySoftwares) ? cls.registrySoftwares : [];
        const selList = Array.isArray(cls?.selectedSoftwares) ? cls.selectedSoftwares : [];
        const softList = regList.length > 0 ? regList : selList;

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
            const raw = existing.responses || {};
            const normalized: Record<string, ConsentResponse> = {};
            softList.forEach(sw => {
                normalized[sw.id] = normalizeResp(raw[sw.id]);
            });
            setResponses(normalized);
            if (existing.confirmationCode) setConfirmationCode(existing.confirmationCode);
        } else {
            const init: Record<string, ConsentResponse> = {};
            softList.forEach(sw => {
                init[sw.id] = { agree: null, collectionUse: null, thirdParty: null };
            });
            setResponses(init);
        }
        setLoaded(true);
    };

    type ConsentKey = keyof ConsentResponse;
    const handleAgree = (swId: string, key: ConsentKey, val: boolean) => {
        setResponses(prev => {
            const cur = prev[swId] || { agree: null, collectionUse: null, thirdParty: null };
            const currentVal = cur[key];
            const nextVal = currentVal === val ? null : val;
            return { ...prev, [swId]: { ...cur, [key]: nextVal } };
        });
    };

    const handleAgreeAll = () => {
        const all: Record<string, ConsentResponse> = {};
        const reg = Array.isArray(classConfig?.registrySoftwares) ? classConfig.registrySoftwares : [];
        const sel = Array.isArray(classConfig?.selectedSoftwares) ? classConfig.selectedSoftwares : [];
        (reg.length > 0 ? reg : sel).forEach(sw => {
            all[sw.id] = { agree: true, collectionUse: true, thirdParty: true };
        });
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

        const responsesToSave: Record<string, ConsentResponse> = {};
        Object.keys(responses).forEach(swId => {
            const r = responses[swId] || { agree: null, collectionUse: null, thirdParty: null };
            responsesToSave[swId] = { agree: true, collectionUse: r.collectionUse ?? null, thirdParty: r.thirdParty ?? null };
        });

        await upsertConsent({
            schoolId,
            classId,
            studentNumber: Number(number),
            studentName: get('parentStudentName'),
            parentName: get('parentName'),
            pin: get('parentPin'),
            responses: responsesToSave,
            confirmationCode: newCode,
        }, consentId);
        setSaving(false);
        setSaved(true);
    };

    const smcMatch = (smcName: string, swName: string) =>
        smcName.trim().toLowerCase() === swName.trim().toLowerCase();

    const reg = Array.isArray(classConfig?.registrySoftwares) ? classConfig!.registrySoftwares : [];
    const sel = Array.isArray(classConfig?.selectedSoftwares) ? classConfig!.selectedSoftwares : [];
    const swList = reg.length > 0 ? reg : sel;
    let totalSlots = 0;
    let answeredSlots = 0;
    let agreedSlots = 0;
    swList.forEach(sw => {
        const r = responses[sw.id] || { agree: null, collectionUse: null, thirdParty: null };
        [r.collectionUse, r.thirdParty].forEach(v => {
            totalSlots++;
            if (v !== null) answeredSlots++;
            if (v === true) agreedSlots++;
        });
    });
    const totalCount = totalSlots;
    const answeredCount = answeredSlots;
    const agreedCount = agreedSlots;

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
                        총 {totalCount}개 항목 중 <strong>{agreedCount}개 동의</strong>
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
                {/* Progress Bar */}
                <div className="progress-bar-sticky" style={{ position: 'sticky', top: 60, zIndex: 90, background: 'var(--gray-50)', padding: '12px 0 20px', margin: '0 -4px' }}>
                    <div className="progress-bar-wrap" style={{ position: 'relative' }}>
                        <div className="progress-bar" style={{ width: `${(answeredCount / (totalCount || 1)) * 100}%` }} />
                        <span className="progress-text">에듀테크 {swList.length}개 · {answeredCount}/{totalCount} 항목 완료</span>
                    </div>
                </div>

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
                            {swList.length}개 중 {answeredCount}/{totalCount} 항목 응답
                        </div>
                    </div>
                </div>

                {classConfig.teacherNote && (
                    <div className="alert alert-info" style={{ marginBottom: 14 }}>
                        <span>💬</span><span>{classConfig.teacherNote}</span>
                    </div>
                )}

                <div className="alert alert-info" style={{ marginBottom: 14, fontSize: '0.82rem', lineHeight: '1.5' }}>
                    <span>⚖️</span>
                    <span>법적으로 규정된 목적(학교생활기록부 및 건강기록부 작성 등) 이외의 수집 항목들에 대한 정보 이용 동의를 거부할 권리가 있음을 알려드리며 아울러 거부 시 해당 항목의 서비스가 제공되지 않는 제한 사항이 있을 수 있습니다.</span>
                </div>

                {/* Individual consent (Mobile Cards) - 기본/수집이용/제3자제공 각각 체크 */}
                <div className="consent-list-container">
                    {swList.length === 0 ? (
                        <div className="card" style={{ marginBottom: 14, background: 'var(--gray-50)', textAlign: 'center', padding: 24 }}>
                            <p style={{ fontWeight: 600, color: 'var(--gray-600)', marginBottom: 8 }}>등록된 에듀테크 목록이 없습니다</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>담임 선생님께 에듀테크 목록 등록 여부를 확인해 주세요. 등록 후 다시 접속하면 동의할 목록이 표시됩니다.</p>
                        </div>
                    ) : null}
                    {swList.map((sw: SoftwareItem) => {
                        const r = responses[sw.id] || { agree: null, collectionUse: null, thirdParty: null };
                        const isNew = !responses[sw.id] && existingConsent;
                        const approved = smcList.some(sm => smcMatch(sm.softwareName, sw.name));
                        return (
                            <div key={sw.id} className="consent-card" style={{ border: isNew ? '2px solid var(--primary)' : undefined }}>
                                <div className="consent-card-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div className="consent-card-title">{sw.name}</div>
                                        {isNew && <span className="badge" style={{ background: 'var(--primary)', color: 'white', fontSize: '0.65rem', animation: 'pulse 2s infinite' }}>✨ 신규 추가</span>}
                                    </div>
                                    {approved ? (
                                        <span className="badge badge-smc">✅ 심의완료</span>
                                    ) : (
                                        <span className="badge badge-no-smc">⚠️ 심의 확인</span>
                                    )}
                                </div>
                                <div className="consent-card-body">
                                    <div className="consent-card-meta">
                                        <span>연령: {sw.ageRange || '정보 없음'}</span>
                                        <div className="consent-card-links">
                                            {sw.url && <a href={sw.url} target="_blank" rel="noopener noreferrer" className="consent-link">사이트 ↗</a>}
                                            {sw.privacyUrl && <a href={sw.privacyUrl} target="_blank" rel="noopener noreferrer" className="consent-link">약관 ↗</a>}
                                        </div>
                                    </div>

                                    {/* 수집·이용 동의 (내용 팝업 + 동의/비동의) */}
                                    <div className="consent-row" style={{ marginTop: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>수집·이용 동의</span>
                                            {sw.collectionUseConsent && (
                                                <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem', padding: '2px 8px', color: 'var(--primary)' }}
                                                    onClick={() => setConsentModal({ title: `${sw.name} – 수집·이용 동의`, body: sw.collectionUseConsent! })}>
                                                    내용 보기
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <button type="button" className={`consent-btn consent-btn-agree ${r.collectionUse === true ? 'active' : ''}`} onClick={() => handleAgree(sw.id, 'collectionUse', true)}>동의</button>
                                            <button type="button" className={`consent-btn consent-btn-disagree ${r.collectionUse === false ? 'active' : ''}`} onClick={() => handleAgree(sw.id, 'collectionUse', false)}>비동의</button>
                                        </div>
                                    </div>

                                    {/* 제3자 제공 동의 (내용 팝업 + 동의/비동의) */}
                                    <div className="consent-row" style={{ marginTop: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>제3자 제공 동의</span>
                                            {sw.thirdPartyConsent && (
                                                <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem', padding: '2px 8px', color: 'var(--primary)' }}
                                                    onClick={() => setConsentModal({ title: `${sw.name} – 제3자 제공 동의`, body: sw.thirdPartyConsent! })}>
                                                    내용 보기
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <button type="button" className={`consent-btn consent-btn-agree ${r.thirdParty === true ? 'active' : ''}`} onClick={() => handleAgree(sw.id, 'thirdParty', true)}>동의</button>
                                            <button type="button" className={`consent-btn consent-btn-disagree ${r.thirdParty === false ? 'active' : ''}`} onClick={() => handleAgree(sw.id, 'thirdParty', false)}>비동의</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bulk agree Move to Bottom */}
                <div className="card" style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 700 }}>전체 일괄 동의</p>
                            <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginTop: 2 }}>위 항목들을 모두 동의하시겠습니까?</p>
                        </div>
                        <button className="btn btn-success" onClick={handleAgreeAll}>✅ 전체 일괄 동의</button>
                    </div>
                </div>

                {/* Offline notice Move to Bottom */}
                <div className="alert alert-warning" style={{ marginTop: 20 }}>
                    <span>📝</span>
                    <span><strong>최종 서명은 반드시 종이 통신문에 작성</strong>하여 제출해 주세요. (확인 코드가 생성됩니다)</span>
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

            {/* 동의 내용 팝업 (폰에서 보기 쉬움) */}
            {consentModal && (
                <div className="consent-popup-overlay" onClick={() => setConsentModal(null)}>
                    <div className="consent-popup" onClick={e => e.stopPropagation()}>
                        <div className="consent-popup-header">
                            <h3>{consentModal.title}</h3>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConsentModal(null)} aria-label="닫기">✕</button>
                        </div>
                        <div className="consent-popup-body">{consentModal.body}</div>
                        <div className="consent-popup-footer">
                            <button type="button" className="btn btn-primary" onClick={() => setConsentModal(null)}>확인</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
