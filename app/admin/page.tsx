'use client';

import { useEffect, useState, useRef, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { getClasses, getConsents, getSmcRecords, addSmcRecord, deleteSmcRecord, upsertClass } from '@/lib/db';
import { ClassConfig, SmcRecord, SoftwareItem, ConsentRecord, ConsentResponse } from '@/lib/types';
import { storage, db } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import Papa from 'papaparse';

type Tab = 'dashboard' | 'smc';

const smcMatch = (smcName: string, swName: string) => {
    if (!smcName || !swName) return false;
    return smcName.trim().toLowerCase() === swName.trim().toLowerCase();
};

export default function AdminPage() {
    const router = useRouter();
    const [schoolName, setSchoolName] = useState('');
    const [schoolId, setSchoolId] = useState('');
    const [tab, setTab] = useState<Tab>('dashboard');
    const [classes, setClasses] = useState<ClassConfig[]>([]);
    const [smcList, setSmcList] = useState<SmcRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [smcInput, setSmcInput] = useState('');
    const pdfFileRef = useRef<HTMLInputElement>(null);

    const [ocrResults, setOcrResults] = useState<string[]>([]);
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrDocUrl, setOcrDocUrl] = useState('');
    const [smcSearch, setSmcSearch] = useState('');

    const [selectedClass, setSelectedClass] = useState<ClassConfig | null>(null);
    const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
    const [classConsents, setClassConsents] = useState<ConsentRecord[]>([]);
    const [classConsentsLoading, setClassConsentsLoading] = useState(false);
    const [showTop, setShowTop] = useState(false);
    const [consentModal, setConsentModal] = useState<{ title: string; body: string } | null>(null);

    const pendingSw = useMemo(() => {
        const pendingMap = new Map<string, SoftwareItem>();
        classes.forEach(cls => {
            const swList = cls.registrySoftwares || cls.selectedSoftwares || [];
            swList.forEach(sw => {
                const approved = smcList.some(sm => smcMatch(sm.softwareName, sw.name));
                if (!approved) {
                    const key = sw.name.trim().toLowerCase();
                    if (!pendingMap.has(key)) pendingMap.set(key, sw);
                }
            });
        });
        return Array.from(pendingMap.values());
    }, [classes, smcList]);

    const normalizeResp = (r: ConsentRecord['responses'][string]): ConsentResponse => {
        if (r == null) return { agree: null, collectionUse: null, thirdParty: null };
        if (typeof r === 'boolean') return { agree: r, collectionUse: null, thirdParty: null };
        return { agree: r.agree ?? null, collectionUse: r.collectionUse ?? null, thirdParty: r.thirdParty ?? null };
    };

    useEffect(() => {
        const id = sessionStorage.getItem('schoolId');
        const name = sessionStorage.getItem('schoolName');
        const auth = sessionStorage.getItem('adminAuth');
        if (!id || !name || auth !== 'true') { router.replace('/role'); return; }
        setSchoolId(id);
        setSchoolName(name);
        loadData(id);

        const handleScroll = () => setShowTop(window.scrollY > 400);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [router]);

    const loadData = async (id: string) => {
        setLoading(true);
        const [cls, smc] = await Promise.all([getClasses(id), getSmcRecords(id)]);
        setClasses(cls);
        setSmcList(smc);
        setLoading(false);
    };

    const loadClassDetail = async (cls: ClassConfig) => {
        if (selectedClass?.id === cls.id) {
            setSelectedClass(null);
            setClassConsents([]);
            return;
        }
        setSelectedClass(cls);
        setClassConsentsLoading(true);
        const consents = await getConsents(cls.id);
        setClassConsents(consents);
        setClassConsentsLoading(false);
    };


    const maskName = (name: string) => {
        if (!name || name.length < 2) return name;
        if (name.length === 2) return name[0] + '*';
        return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
    };

    const handleManualApprove = async (swName: string) => {
        if (!confirm(`'${swName}'을(를) 심의 상시 승인 처리하시겠습니까?\n(심의 완료 목록에 이 이름으로 추가됩니다.)`)) return;
        await addSmcRecord({ schoolId, softwareName: swName.trim(), privacyUrl: '', approvedDate: new Date(), documentUrl: '' });
        loadData(schoolId);
        alert('승인 처리되었습니다.');
    };

    const handleApproveAll = async (softwares: SoftwareItem[]) => {
        const pending = softwares.filter(s => !smcList.some(sm => smcMatch(sm.softwareName, s.name)));
        if (pending.length === 0) return;
        if (!confirm(`미승인 항목 ${pending.length}개를 모두 일괄 승인하시겠습니까?`)) return;

        const batch = writeBatch(db);
        pending.forEach(s => {
            const newDocRef = doc(collection(db, 'smc_records'));
            batch.set(newDocRef, {
                schoolId,
                softwareName: s.name.trim(),
                privacyUrl: s.privacyUrl || '',
                approvedDate: new Date(),
                documentUrl: '',
            });
        });
        await batch.commit();
        await loadData(schoolId);
        alert('일괄 승인 처리되었습니다.');
    };

    // ---- SMC Manual Add ----
    const handleAddSmc = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!smcInput.trim()) return;
        await addSmcRecord({ schoolId, softwareName: smcInput.trim(), privacyUrl: '', approvedDate: new Date(), documentUrl: ocrDocUrl });
        setSmcInput('');
        loadData(schoolId);
    };

    const handleDeleteSmc = async (id: string) => {
        if (!confirm('삭제하시겠습니까?')) return;
        await deleteSmcRecord(id);
        loadData(schoolId);
    };


    // ---- PDF Upload + OCR ----
    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setOcrLoading(true);
        setOcrResults([]);
        try {
            const path = `schools/${schoolId}/smc_docs/${Date.now()}_${file.name}`;
            const sRef = storageRef(storage, path);
            await uploadBytes(sRef, file);
            const downloadUrl = await getDownloadURL(sRef);
            setOcrDocUrl(downloadUrl);

            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/ocr', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.softwares?.length > 0) {
                setOcrResults(data.softwares.map((s: { name: string }) => s.name));
            } else {
                alert('소프트웨어명을 자동 추출하지 못했습니다. 수동으로 입력해 주세요.');
            }
        } catch (err) {
            console.error(err);
            alert('파일 업로드 또는 OCR 처리 중 오류가 발생했습니다.');
        } finally {
            setOcrLoading(false);
        }
    };

    const handleSaveOcrResults = async () => {
        const toSave = ocrResults.filter(n => n.trim());
        const existingNames = new Set(smcList.map(s => s.softwareName.trim()));
        const newItems = toSave.filter(n => !existingNames.has(n.trim()));
        const dupCount = toSave.length - newItems.length;
        for (const name of newItems) {
            await addSmcRecord({ schoolId, softwareName: name.trim(), privacyUrl: '', approvedDate: new Date(), documentUrl: ocrDocUrl });
        }
        setOcrResults([]);
        setOcrDocUrl('');
        if (pdfFileRef.current) pdfFileRef.current.value = '';
        loadData(schoolId);
        alert(`${newItems.length}개 등록완료.${dupCount > 0 ? ` (중복 ${dupCount}개 제외)` : ''}`);
    };

    const handleResetAllSmc = async () => {
        if (!confirm('심의 완료 목록을 모두 비울까요? 이 작업은 되돌릴 수 없습니다.')) return;
        const { query, collection, where, getDocs, writeBatch } = await import('firebase/firestore');
        const q = query(collection(db, 'smc_records'), where('schoolId', '==', schoolId));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        await loadData(schoolId);
        alert('심의 목록이 초기화되었습니다.');
    };

    const handleResetTeacherPin = async (cls: ClassConfig) => {
        const newPin = prompt('새로운 4자리 비밀번호를 입력해 주세요 (숫자만):', cls.pin);
        if (!newPin || newPin.length !== 4 || isNaN(Number(newPin))) {
            if (newPin) alert('올바른 4자리 숫자를 입력해 주세요.');
            return;
        }
        const { upsertClass } = await import('@/lib/db');
        await upsertClass({ ...cls, pin: newPin }, cls.id);
        setClasses(prev => prev.map(c => c.id === cls.id ? { ...c, pin: newPin } : c));
        setSelectedClass({ ...cls, pin: newPin });
        alert('비밀번호가 변경되었습니다.');
    };

    const handleDeleteClassAction = async (clsId: string) => {
        if (!confirm('⚠️ 경고: 이 학급 설정을 삭제하시겠습니까? \n\n삭제 시 학부모들이 동의를 새로 제출해야 할 수 있으며, 이 작업은 되돌릴 수 없습니다.')) return;
        const { deleteClass } = await import('@/lib/db');
        await deleteClass(clsId);
        setSelectedClass(null);
        setClasses(prev => prev.filter(c => c.id !== clsId));
        alert('학급이 삭제되었습니다.');
    };

    // ---- Management of Class Softwares (Teacher-like features for Admin) ----
    const handleClassCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const parseFile = (encoding: string) => {
            Papa.parse(file, {
                header: true, skipEmptyLines: true, encoding: encoding,
                transformHeader: (h) => h.trim().replace(/^\uFEFF/, '').replace(/\r?\n/g, '').trim(),
                complete: (result) => {
                    const rows = result.data as Record<string, string>[];
                    const items: SoftwareItem[] = rows.filter(r => {
                        const keys = Object.keys(r);
                        return keys.some(k => (k.includes('명') || k.toLowerCase().includes('name')) && r[k]);
                    }).map((r, i) => {
                        const keys = Object.keys(r);
                        const nameKey = keys.find(k => k.includes('명') || k.toLowerCase().includes('name')) || '';
                        const ageKey = keys.find(k => k.includes('연령') || k.toLowerCase().includes('age')) || '';
                        const urlKey = keys.find(k => k.includes('주소') || k.toLowerCase().includes('url')) || '';
                        const privacyKey = keys.find(k => k.includes('약관') || k.includes('방침') || k.toLowerCase().includes('privacy')) || '';
                        const collKey = keys.find(k => k.includes('수집') && k.includes('이용')) || keys.find(k => k.includes('수집이용')) || '';
                        const thirdKey = keys.find(k => k.includes('제3자') && k.includes('제공')) || keys.find(k => k.includes('제3자제공')) || '';

                        return {
                            id: `admin_csv_${i}_${Date.now()}`,
                            name: (r[nameKey] || '').trim(),
                            ageRange: (r[ageKey] || '').trim(),
                            url: (r[urlKey] || '').trim(),
                            privacyUrl: (r[privacyKey] || '').trim(),
                            collectionUseConsent: (r[collKey] || '').trim() || undefined,
                            thirdPartyConsent: (r[thirdKey] || '').trim() || undefined,
                        };
                    });

                    if (items.length > 0) {
                        handleBatchAddSoftwares(items);
                    } else if (encoding === 'UTF-8') {
                        parseFile('EUC-KR');
                    } else {
                        alert('CSV 파일에서 유효한 목록을 찾을 수 없습니다.');
                    }
                }
            });
        };
        parseFile('UTF-8');
    };

    const handleBatchAddSoftwares = async (newItems: SoftwareItem[]) => {
        if (!selectedClass) return;
        const current = selectedClass.registrySoftwares || [];
        const merged = [...current, ...newItems];
        // Automatically select all
        const updated = {
            ...selectedClass,
            registrySoftwares: merged,
            selectedSoftwares: merged.map(s => ({ ...s, isSmcApproved: smcList.some(sm => smcMatch(sm.softwareName, s.name)) })),
            isActive: true
        };
        await upsertClass(updated, selectedClass.id);
        setSelectedClass(updated);
        setClasses(prev => prev.map(c => c.id === selectedClass.id ? updated : c));
        alert(`${newItems.length}개 에듀테크가 해당 학급에 성공적으로 등록되었습니다.`);
    };

    const handleDeleteSoftware = async (swId: string) => {
        if (!selectedClass || !confirm('이 에듀테크를 학급 목록에서 삭제하시겠습니까?')) return;
        const newRegistry = (selectedClass.registrySoftwares || []).filter(s => s.id !== swId);
        const newSelected = (selectedClass.selectedSoftwares || []).filter(s => s.id !== swId);
        const updated = { ...selectedClass, registrySoftwares: newRegistry, selectedSoftwares: newSelected };
        await upsertClass(updated, selectedClass.id);
        setSelectedClass(updated);
        setClasses(prev => prev.map(c => c.id === selectedClass.id ? updated : c));
    };

    const logout = () => { sessionStorage.removeItem('adminAuth'); router.push('/role'); };

    return (
        <div className="app-shell">
            <header className="header">
                <div className="header-logo"><span>🏫</span>에듀테크 개인정보 동의 시스템</div>
                {schoolName && <span className="header-school">{schoolName}</span>}
                <span className="header-mode-badge badge-admin">관리자</span>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 12 }} onClick={logout}>로그아웃</button>
            </header>
            <main className="main-content" style={{ maxWidth: 960 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--gray-200)' }}>
                    {([['dashboard', '📊 현황'], ['smc', '✅ 학운위 심의']] as [Tab, string][]).map(([key, label]) => (
                        <button key={key} className="btn btn-ghost btn-sm"
                            style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', borderBottom: tab === key ? '2px solid var(--primary)' : 'none', color: tab === key ? 'var(--primary)' : 'var(--gray-600)', fontWeight: tab === key ? 700 : 400, background: tab === key ? 'var(--primary-light)' : 'transparent' }}
                            onClick={() => setTab(key as Tab)}>{label}</button>
                    ))}
                </div>

                {loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div> : (
                    <>
                        {/* DASHBOARD */}
                        {tab === 'dashboard' && (
                            <div>
                                <div className="card" style={{ marginBottom: selectedClass ? 16 : 0 }}>
                                    <p className="card-title">📊 학년/반별 현황 <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--gray-400)' }}>— 행 클릭 시 상세보기</span></p>
                                    {classes.length === 0 ? (
                                        <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px 0' }}>등록된 학급이 없습니다.</p>
                                    ) : (
                                        <div className="table-wrapper">
                                            <table>
                                                <thead><tr><th>학년</th><th>반</th><th>담임교사</th><th>활성화</th><th>SW 수</th><th>심의여부 확인</th></tr></thead>
                                                <tbody>
                                                    {classes.sort((a, b) => a.year - b.year || a.classNum - b.classNum).map(cls => {
                                                        const swList = cls.registrySoftwares || cls.selectedSoftwares || [];
                                                        const nonSmc = swList.filter(s => !smcList.some(sm => smcMatch(sm.softwareName, s.name))) || [];
                                                        const isSelected = selectedClass?.id === cls.id;
                                                        return (
                                                            <tr key={cls.id}
                                                                onClick={() => loadClassDetail(cls)}
                                                                style={{ cursor: 'pointer', background: isSelected ? 'var(--primary-light)' : undefined }}>
                                                                <td>{cls.year}학년</td><td>{cls.classNum}반</td><td>{maskName(cls.teacherName)}</td>
                                                                <td>{cls.isActive ? <span className="badge badge-smc">✅ 활성</span> : <span className="badge badge-no-smc">미설정</span>}</td>
                                                                <td>{(cls.registrySoftwares || cls.selectedSoftwares || []).length}개</td>
                                                                <td>{nonSmc.length > 0 ? <span className="badge badge-no-smc">⚠️ 미승인 {nonSmc.length}개</span> : <span className="badge badge-smc">✅ 전체 승인됨</span>}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Class Detail Panel */}
                                {selectedClass && (
                                    <div className="card">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                            <div style={{ flex: 1 }}>
                                                <p className="card-title" style={{ marginBottom: 4 }}>🔍 {selectedClass.year}학년 {selectedClass.classNum}반 — {maskName(selectedClass.teacherName)} 선생님</p>
                                                <div style={{ display: 'flex', gap: 12 }}>
                                                    <button className="btn btn-ghost" style={{ padding: '0 4px', fontSize: '0.75rem', height: 20 }}
                                                        onClick={() => handleResetTeacherPin(selectedClass)}>🔑 비번 재설정</button>
                                                    <button className="btn btn-ghost" style={{ padding: '0 4px', fontSize: '0.75rem', height: 20, color: 'var(--danger)' }}
                                                        onClick={() => handleDeleteClassAction(selectedClass.id)}>🗑️ 학급 삭제</button>
                                                </div>
                                            </div>
                                            <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedClass(null); setClassConsents([]); }}>✕ 닫기</button>
                                        </div>

                                        {/* 학부모 동의 현황 — 먼저 표시 */}
                                        <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 8 }}>📋 학부모 동의 현황 ({classConsents.length}명 제출)</p>
                                        {classConsentsLoading ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="spinner" style={{ width: 18, height: 18 }} /><span style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>불러오는 중...</span></div>
                                        ) : classConsents.length === 0 ? (
                                            <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', marginBottom: 20 }}>아직 제출된 동의서가 없습니다.</p>
                                        ) : (
                                            <div style={{ marginBottom: 24 }}>
                                                {/* Per-software summary */}
                                                <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 20, padding: 2, border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-md)', background: 'var(--gray-50)' }}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 10 }}>
                                                        {(selectedClass.registrySoftwares || selectedClass.selectedSoftwares || []).map(sw => {
                                                            const withR = classConsents.map(c => ({ c, r: normalizeResp(c.responses[sw.id]) }));
                                                            const agreeAll = withR.filter(({ r }) => r.agree === true && r.collectionUse === true && r.thirdParty === true);
                                                            const anyDisagree = withR.filter(({ r }) => r.agree === false || r.collectionUse === false || r.thirdParty === false);
                                                            const pending = withR.filter(({ r }) => r.agree == null || r.collectionUse == null || r.thirdParty == null);
                                                            return (
                                                                <div key={sw.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '10px 14px', minWidth: 180, background: 'white' }}>
                                                                    <p style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 6 }}>{sw.name}</p>
                                                                    <div style={{ fontSize: '0.8rem', lineHeight: 1.9 }}>
                                                                        <span style={{ color: '#2e7d32' }}>✅ 전체 동의 {agreeAll.length}명</span><br />
                                                                        <span style={{ color: 'var(--danger)' }}>❌ 비동의 {anyDisagree.length}명</span>
                                                                        {anyDisagree.length > 0 && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}> ({anyDisagree.slice(0, 3).map(({ c }) => maskName(c.studentName)).join(', ')}{anyDisagree.length > 3 ? '…' : ''})</span>}
                                                                        <br />
                                                                        <span style={{ color: 'var(--gray-400)' }}>— 미응답 {pending.length}명</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                {/* Student detail table */}
                                                <div className="table-wrapper">
                                                    <table>
                                                        <thead>
                                                            <tr>
                                                                <th>번호</th><th>학생</th><th>학부모</th>
                                                                <th style={{ textAlign: 'center' }}>코드</th>
                                                                <th>동의 현황</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {classConsents.sort((a, b) => a.studentNumber - b.studentNumber).map(c => {
                                                                const isExpanded = expandedStudentId === c.id;
                                                                const swList = selectedClass.registrySoftwares || selectedClass.selectedSoftwares || [];
                                                                let agreedSlots = 0, totalSlots = 0;
                                                                swList.forEach(sw => {
                                                                    const r = normalizeResp(c.responses[sw.id]);
                                                                    [r.agree, r.collectionUse, r.thirdParty].forEach(v => { totalSlots++; if (v === true) agreedSlots++; });
                                                                });
                                                                if (totalSlots === 0) totalSlots = swList.length * 3;

                                                                return (
                                                                    <Fragment key={c.id}>
                                                                        <tr
                                                                            onClick={() => setExpandedStudentId(isExpanded ? null : c.id)}
                                                                            style={{ cursor: 'pointer', background: isExpanded ? 'var(--primary-light)' : undefined }}
                                                                        >
                                                                            <td>{c.studentNumber}번</td>
                                                                            <td style={{ fontWeight: 700 }}>{maskName(c.studentName)}</td>
                                                                            <td>{maskName(c.parentName)}</td>
                                                                            <td style={{ textAlign: 'center' }}>
                                                                                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', letterSpacing: 1, fontSize: '0.82rem' }}>
                                                                                    {c.confirmationCode || '—'}
                                                                                </span>
                                                                            </td>
                                                                            <td>
                                                                                <span className="badge badge-smc" style={{ fontSize: '0.75rem' }}>
                                                                                    {agreedSlots} / {totalSlots} 동의
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                        {isExpanded && (
                                                                            <tr>
                                                                                <td colSpan={5} style={{ padding: '0 20px 20px', background: 'var(--gray-50)' }}>
                                                                                    <div className="card" style={{ marginTop: 10, border: '1px solid var(--gray-200)', padding: 16 }}>
                                                                                        <p style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                            📋 {maskName(c.studentName)} 학생의 상세 동의 내역
                                                                                        </p>
                                                                                        <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
                                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                                                                {swList.map(sw => {
                                                                                                    const r = normalizeResp(c.responses[sw.id]);
                                                                                                    return (
                                                                                                        <div key={sw.id} style={{ padding: '10px 12px', background: 'white', borderRadius: 8, border: '1px solid var(--gray-100)', fontSize: '0.82rem' }}>
                                                                                                            <div style={{ fontWeight: 600, marginBottom: 6 }}>{sw.name}</div>
                                                                                                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.78rem' }}>
                                                                                                                <span>{r.agree === true ? '✅' : r.agree === false ? '❌' : '—'} 기본</span>
                                                                                                                <span>{r.collectionUse === true ? '✅' : r.collectionUse === false ? '❌' : '—'} 수집이용</span>
                                                                                                                <span>{r.thirdParty === true ? '✅' : r.thirdParty === false ? '❌' : '—'} 제3자제공</span>
                                                                                                            </div>
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
                                            </div>
                                        )}

                                        {/* 에듀테크 목록 — 아래로 */}
                                        {(() => {
                                            const swList = selectedClass.registrySoftwares || selectedClass.selectedSoftwares || [];
                                            const hasPending = swList.some(sw => !smcList.some(sm => smcMatch(sm.softwareName, sw.name)));
                                            return (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                        <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 0 }}>📱 에듀테크 목록 ({swList.length}개)</p>
                                                        <div style={{ display: 'flex', gap: 8 }}>
                                                            <div style={{ position: 'relative' }}>
                                                                <button className="btn btn-outline btn-sm">📁 SW 목록 업로드(CSV)</button>
                                                                <input type="file" accept=".csv" onChange={handleClassCsvUpload}
                                                                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                                                            </div>
                                                            {hasPending && (
                                                                <button className="btn btn-primary btn-sm" onClick={() => handleApproveAll(swList)}>
                                                                    🚀 미승인 항목 일괄 승인
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {swList.length === 0 ? (
                                                        <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', marginBottom: 16 }}>등록된 소프트웨어 없음</p>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                                                            {swList.map(sw => {
                                                                const approved = smcList.some(sm => smcMatch(sm.softwareName, sw.name));
                                                                return (
                                                                    <div key={sw.id} style={{ border: '1px solid var(--gray-200)', borderRadius: 12, overflow: 'hidden', background: 'white' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: approved ? '#f1f8f1' : '#fff9f0' }}>
                                                                            <span style={{ fontSize: '1.1rem' }}>{approved ? '✅' : '⚠️'}</span>
                                                                            <span style={{ fontWeight: 700, flex: 1 }}>{sw.name}</span>
                                                                            <div style={{ display: 'flex', gap: 10 }}>
                                                                                {sw.url && <a href={sw.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '0.82rem' }}>사이트 ↗</a>}
                                                                                {sw.privacyUrl && <a href={sw.privacyUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontSize: '0.82rem' }}>약관 ↗</a>}
                                                                                <button className="btn btn-ghost btn-sm" style={{ height: 26, padding: '0 4px', fontSize: '0.75rem', color: 'var(--danger)' }}
                                                                                    onClick={() => handleDeleteSoftware(sw.id)}>🗑️ 삭제</button>
                                                                                {!approved && (
                                                                                    <button className="btn btn-primary btn-sm"
                                                                                        style={{ height: 26, padding: '0 8px', fontSize: '0.75rem' }}
                                                                                        onClick={(e) => { e.stopPropagation(); handleManualApprove(sw.name); }}>
                                                                                        승인 처리
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        {(sw.collectionUseConsent || sw.thirdPartyConsent) && (
                                                                            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--gray-100)', background: 'white', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                                                {sw.collectionUseConsent && (
                                                                                    <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem' }}
                                                                                        onClick={() => setConsentModal({ title: `${sw.name} – 수집·이용 동의`, body: sw.collectionUseConsent! })}>
                                                                                        📋 수집이용동의 내용
                                                                                    </button>
                                                                                )}
                                                                                {sw.thirdPartyConsent && (
                                                                                    <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem' }}
                                                                                        onClick={() => setConsentModal({ title: `${sw.name} – 제3자 제공 동의`, body: sw.thirdPartyConsent! })}>
                                                                                        📋 제3자제공동의 내용
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SMC */}
                        {tab === 'smc' && (
                            <div>
                                {/* Centralized Pending Approvals */}
                                {pendingSw.length > 0 && (
                                    <div className="card" style={{ marginBottom: 16, border: '1.5px solid var(--warning)', background: '#fffcf5' }}>
                                        <p className="card-title" style={{ color: 'var(--warning)', marginBottom: 8 }}>🚀 학교 전체 승인 대기 목록 ({pendingSw.length}개)</p>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: 14 }}>
                                            학교 내 여러 학급에서 사용 중이나 아직 심의 승인되지 않은 항목들입니다. 여기서 승인하면 학교 전체에 즉시 적용됩니다.
                                        </p>
                                        <div className="table-wrapper">
                                            <table style={{ background: 'white' }}>
                                                <thead><tr><th>소프트웨어명</th><th style={{ textAlign: 'right' }}>관리</th></tr></thead>
                                                <tbody>
                                                    {pendingSw.map((sw: SoftwareItem) => (
                                                        <tr key={sw.id}>
                                                            <td style={{ fontWeight: 600 }}>{sw.name}</td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <button className="btn btn-primary btn-sm" onClick={() => handleManualApprove(sw.name)}>
                                                                    심의 승인 처리
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* PDF OCR */}
                                <div className="card" style={{ marginBottom: 16 }}>
                                    <p className="card-title">📄 학운위 심의안 PDF 업로드 (제품명 자동 추출)</p>
                                    <div className="alert alert-info" style={{ marginBottom: 14 }}>
                                        <span>🤖</span>
                                        <span>PDF를 업로드하면 AI가 소프트웨어명만 추출합니다. 추출 후 확인하고 저장하세요.</span>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">심의안 PDF 선택</label>
                                        <input ref={pdfFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-control"
                                            style={{ padding: 8 }} onChange={handlePdfUpload} disabled={ocrLoading} />
                                    </div>
                                    {ocrLoading && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                                            <div className="spinner" style={{ width: 20, height: 20 }} />
                                            <span style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>AI가 소프트웨어명을 추출 중...</span>
                                        </div>
                                    )}
                                    {ocrResults.length > 0 && (
                                        <div style={{ marginTop: 16 }}>
                                            <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 10 }}>
                                                ✅ 추출된 소프트웨어 ({ocrResults.length}개) — 수정 후 등록하세요
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                                                {ocrResults.map((name, i) => (
                                                    <div key={i} style={{ display: 'flex', gap: 8 }}>
                                                        <input className="form-control" value={name}
                                                            onChange={e => setOcrResults(prev => prev.map((n, j) => j === i ? e.target.value : n))} />
                                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', flexShrink: 0 }}
                                                            onClick={() => setOcrResults(prev => prev.filter((_, j) => j !== i))}>✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                                                <button className="btn btn-success" onClick={handleSaveOcrResults}>💾 심의 목록에 등록</button>
                                                <button className="btn btn-ghost" onClick={() => { setOcrResults([]); if (pdfFileRef.current) pdfFileRef.current.value = ''; }}>취소</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Manual */}
                                <div className="card" style={{ marginBottom: 16 }}>
                                    <p className="card-title">✍️ 수동 등록</p>
                                    <form onSubmit={handleAddSmc}>
                                        <div style={{ display: 'flex', gap: 10 }}>
                                            <input className="form-control" placeholder="소프트웨어명" value={smcInput}
                                                onChange={e => setSmcInput(e.target.value)} required />
                                            <button type="submit" className="btn btn-success">+ 추가</button>
                                        </div>
                                    </form>
                                </div>

                                <div className="card">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <p className="card-title" style={{ marginBottom: 0 }}>심의 완료 목록 ({smcList.length}개)</p>
                                            {smcList.length > 0 && (
                                                <button className="btn btn-danger btn-sm" onClick={handleResetAllSmc}>
                                                    🗑️ 전체 초기화
                                                </button>
                                            )}
                                        </div>
                                        <input className="form-control" placeholder="제품명 검색..." value={smcSearch}
                                            onChange={e => setSmcSearch(e.target.value)} />
                                    </div>
                                    {smcList.length === 0 ? (
                                        <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '16px 0' }}>등록된 심의 소프트웨어가 없습니다.</p>
                                    ) : (
                                        <div className="table-wrapper">
                                            <table>
                                                <thead><tr><th>소프트웨어명</th><th style={{ textAlign: 'right' }}>관리</th></tr></thead>
                                                <tbody>
                                                    {smcList.filter(s => s.softwareName.toLowerCase().includes(smcSearch.toLowerCase())).map(s => (
                                                        <tr key={s.id}>
                                                            <td><span className="badge badge-smc">✅</span> {s.softwareName}</td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                                                                    onClick={() => { if (confirm('이 항목을 삭제할까요?')) deleteSmcRecord(s.id).then(() => loadData(schoolId)); }}>
                                                                    ✕
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                    </>
                )}
            </main>

            <button className={`btn-top ${showTop ? 'visible' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                ↑
            </button>

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
