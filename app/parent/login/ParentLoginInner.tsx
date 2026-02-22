'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSchools, getClasses, getClass } from '@/lib/db';
import { School, ClassConfig } from '@/lib/types';

export default function ParentLoginInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const presetClassId = searchParams.get('classId');

    const [schools, setSchools] = useState<School[]>([]);
    const [selectedSchoolId, setSelectedSchoolId] = useState('');
    const [classes, setClasses] = useState<ClassConfig[]>([]);
    const [selectedClassId, setSelectedClassId] = useState(presetClassId || '');
    const [form, setForm] = useState({ number: '', studentName: '', parentName: '', pin: '' });
    const [step, setStep] = useState<'school' | 'class' | 'info'>(presetClassId ? 'info' : 'school');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const init = async () => {
            const [sList] = await Promise.all([getSchools()]);
            setSchools(sList);

            if (presetClassId) {
                const cls = await getClass(presetClassId);
                if (cls) {
                    setSelectedClassId(cls.id);
                    sessionStorage.setItem('schoolId', cls.schoolId);
                    const s = sList.find(sch => sch.id === cls.schoolId);
                    if (s) sessionStorage.setItem('schoolName', s.name);

                    // Allow direct link even if isActive is false, or we can force it
                    setStep('info');
                } else {
                    setStep('school');
                }
            }
            setLoading(false);
        };
        init();
    }, [presetClassId]);

    const handleSelectSchool = async (id: string, name: string) => {
        setSelectedSchoolId(id);
        sessionStorage.setItem('schoolId', id);
        sessionStorage.setItem('schoolName', name);
        const cls = await getClasses(id);
        setClasses(cls.filter(c => c.isActive));
        setStep('class');
    };

    const handleSelectClass = (classId: string) => {
        setSelectedClassId(classId);
        setStep('info');
    };

    const byYear = classes.reduce<Record<number, ClassConfig[]>>((acc, c) => {
        (acc[c.year] = acc[c.year] || []).push(c);
        return acc;
    }, {});

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.number || !form.studentName.trim() || !form.parentName.trim() || form.pin.length !== 4) {
            setError('모든 항목을 입력해 주세요 (비밀번호 4자리 포함).');
            return;
        }
        sessionStorage.setItem('parentClassId', selectedClassId);
        sessionStorage.setItem('parentNumber', form.number);
        sessionStorage.setItem('parentStudentName', form.studentName);
        sessionStorage.setItem('parentName', form.parentName);
        sessionStorage.setItem('parentPin', form.pin);
        router.push('/parent/consent');
    };

    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm(f => ({ ...f, [k]: e.target.value }));
        setError('');
    };

    return (
        <div className="app-shell">
            <header className="header">
                <div className="header-logo"><span>🏫</span>에듀테크 개인정보 동의 시스템</div>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                    onClick={() => step === 'info' && !presetClassId ? setStep('class') : step === 'class' ? setStep('school') : router.push('/')}>
                    ← 뒤로
                </button>
            </header>

            <main className="main-content" style={{ maxWidth: 480 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
                ) : (
                    <>
                        {step === 'school' && (
                            <div className="card" style={{ marginTop: 32 }}>
                                <p className="card-title" style={{ justifyContent: 'center' }}>🏫 학교 선택</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {schools.map(s => (
                                        <button key={s.id} className="btn btn-outline btn-block" style={{ fontSize: '1rem', justifyContent: 'flex-start' }}
                                            onClick={() => handleSelectSchool(s.id, s.name)}>
                                            🏫 {s.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {step === 'class' && (
                            <div className="card" style={{ marginTop: 32 }}>
                                <p className="card-title" style={{ justifyContent: 'center' }}>📚 학년/반 선택</p>
                                {Object.keys(byYear).sort().map(year => (
                                    <div key={year} style={{ marginBottom: 16 }}>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gray-500)', marginBottom: 8 }}>{year}학년</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {byYear[Number(year)].sort((a, b) => a.classNum - b.classNum).map(cls => (
                                                <button key={cls.id} className="btn btn-ghost"
                                                    style={{ minWidth: 60, fontWeight: 600 }}
                                                    onClick={() => handleSelectClass(cls.id)}>
                                                    {cls.classNum}반
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {classes.length === 0 && (
                                    <p style={{ color: 'var(--gray-400)', textAlign: 'center' }}>활성화된 학급이 없습니다. 담임 선생님께 문의해 주세요.</p>
                                )}
                            </div>
                        )}

                        {step === 'info' && (
                            <div className="card" style={{ marginTop: 32 }}>
                                <p className="card-title" style={{ justifyContent: 'center' }}>👨‍👩‍👧 정보 입력</p>

                                {/* Global Privacy Notice (PIPA Compliance) */}
                                <div className="alert alert-info" style={{ marginBottom: 20, fontSize: '0.82rem', display: 'block' }}>
                                    <p style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.9rem', borderBottom: '1px solid rgba(30, 58, 138, 0.2)', paddingBottom: 4 }}>
                                        ⚖️ 개인정보 수집 및 이용 안내
                                    </p>
                                    <ul style={{ paddingLeft: 18, listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <li><strong>목적</strong>: 학급 에듀테크 활용을 위한 사전 동의 현황 파악 및 확인 코드 생성</li>
                                        <li><strong>항목</strong>: 학생 이름, 학번, 학부모 이름, 설정 비밀번호(4자리)</li>
                                        <li><strong>보유 기간</strong>: 당해 학년도 종료 시(또는 목적 달성 시) 즉시 파기</li>
                                        <li><strong>거부권</strong>: 본 동의를 거부할 수 있으나, 거부 시 확인 코드 생성이 불가하여 종이 서면 제출 시 처리가 지연될 수 있습니다.</li>
                                    </ul>
                                </div>

                                <form onSubmit={handleSubmit}>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <div className="form-group" style={{ flex: 1 }}>
                                            <label className="form-label">번호 <span className="form-required">*</span></label>
                                            <select className="form-control form-select" style={{ height: 48 }} value={form.number} onChange={set('number')} required>
                                                <option value="">선택</option>
                                                {Array.from({ length: 35 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}번</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ flex: 2 }}>
                                            <label className="form-label">학생 이름 <span className="form-required">*</span></label>
                                            <input className="form-control" style={{ height: 48 }} placeholder="홍길동" value={form.studentName} onChange={set('studentName')} required />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">학부모 이름 <span className="form-required">*</span></label>
                                        <input className="form-control" style={{ height: 48 }} placeholder="홍부모" value={form.parentName} onChange={set('parentName')} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">비밀번호 4자리 설정 <span className="form-required">*</span></label>
                                        <div className="pin-input-wrap">
                                            {[0, 1, 2, 3].map(i => (
                                                <input key={i} id={`pin-p-${i}`} className="pin-digit" type="password"
                                                    maxLength={1} inputMode="numeric" value={form.pin[i] || ''}
                                                    style={{ width: 60, height: 70, fontSize: '1.8rem' }}
                                                    onChange={e => {
                                                        const val = e.target.value.replace(/\D/g, '');
                                                        const arr = form.pin.split('');
                                                        arr[i] = val;
                                                        setForm(f => ({ ...f, pin: arr.join('').slice(0, 4) }));
                                                        setError('');
                                                        if (val && i < 3) document.getElementById(`pin-p-${i + 1}`)?.focus();
                                                    }} />
                                            ))}
                                        </div>
                                        <p className="form-hint" style={{ textAlign: 'center' }}>나중에 수정할 때 필요합니다.</p>
                                    </div>
                                    {error && <div className="alert alert-danger">{error}</div>}
                                    <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ height: 56, fontSize: '1.1rem' }}>동의서 작성하기</button>
                                </form>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
