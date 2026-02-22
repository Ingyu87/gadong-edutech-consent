'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClasses, upsertClass, makeClassId } from '@/lib/db';
import { ClassConfig } from '@/lib/types';

export default function TeacherLoginPage() {
    const router = useRouter();
    const [schoolName, setSchoolName] = useState('');
    const [schoolId, setSchoolId] = useState('');
    const [form, setForm] = useState({ year: '', classNum: '', teacherName: '', pin: '' });
    const [isNew, setIsNew] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'check' | 'pin' | 'newpin'>('check');
    const [existingClass, setExistingClass] = useState<ClassConfig | null>(null);

    useEffect(() => {
        const id = sessionStorage.getItem('schoolId');
        const name = sessionStorage.getItem('schoolName');
        if (!id || !name) { router.replace('/'); return; }
        setSchoolId(id);
        setSchoolName(name);
    }, [router]);

    const handleCheckClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.year || !form.classNum || !form.teacherName.trim()) return;
        const classes = await getClasses(schoolId);
        const classId = makeClassId(schoolId, Number(form.year), Number(form.classNum));
        const found = classes.find(c => c.id === classId);
        if (found) {
            setExistingClass(found);
            setIsNew(false);
            setStep('pin');
        } else {
            setIsNew(true);
            setStep('newpin');
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.pin || form.pin.length !== 4) { setError('4자리 비밀번호를 입력하세요.'); return; }
        if (isNew) {
            // Register new class
            const classId = makeClassId(schoolId, Number(form.year), Number(form.classNum));
            await upsertClass({
                schoolId,
                year: Number(form.year),
                classNum: Number(form.classNum),
                teacherName: form.teacherName.trim(),
                pin: form.pin,
                isActive: true,
                selectedSoftwares: [],
            }, classId);
            sessionStorage.setItem('classId', classId);
            sessionStorage.setItem('teacherAuth', 'true');
            router.push('/teacher');
        } else {
            // Existing class - verify Name and PIN
            if (!existingClass) return;

            const nameMatch = existingClass.teacherName.trim() === form.teacherName.trim();
            const pinMatch = existingClass.pin === form.pin;

            if (nameMatch && pinMatch) {
                sessionStorage.setItem('classId', existingClass.id);
                sessionStorage.setItem('teacherAuth', 'true');
                router.push('/teacher');
            } else if (!nameMatch) {
                setError('입력하신 선생님 성함이 등록된 정보와 일치하지 않습니다.');
            } else {
                setError('비밀번호가 올바르지 않습니다.');
            }
        }
    };

    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [k]: e.target.value }));

    return (
        <div className="app-shell">
            <header className="header">
                <div className="header-logo"><span>🏫</span>에듀테크 개인정보 동의 시스템</div>
                {schoolName && <span className="header-school">{schoolName}</span>}
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => step !== 'check' ? setStep('check') : router.push('/role')}>← 뒤로</button>
            </header>
            <main className="main-content" style={{ maxWidth: 480 }}>
                <div className="card" style={{ marginTop: 32 }}>
                    <p className="card-title" style={{ justifyContent: 'center' }}>👩‍🏫 교사 로그인 / 등록</p>

                    {step === 'check' && (
                        <form onSubmit={handleCheckClass}>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">학년 <span className="form-required">*</span></label>
                                    <select className="form-control form-select" value={form.year} onChange={set('year')} required>
                                        <option value="">선택</option>
                                        {[1, 2, 3, 4, 5, 6].map(y => <option key={y} value={y}>{y}학년</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">반 <span className="form-required">*</span></label>
                                    <select className="form-control form-select" value={form.classNum} onChange={set('classNum')} required>
                                        <option value="">선택</option>
                                        {Array.from({ length: 15 }, (_, i) => i + 1).map(c => <option key={c} value={c}>{c}반</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">교사 이름 <span className="form-required">*</span></label>
                                <input className="form-control" placeholder="홍길동" value={form.teacherName} onChange={set('teacherName')} required />
                            </div>
                            <button type="submit" className="btn btn-primary btn-block">확인</button>
                        </form>
                    )}

                    {(step === 'pin' || step === 'newpin') && (
                        <form onSubmit={handleLogin}>
                            {isNew ? (
                                <div className="alert alert-info" style={{ marginBottom: 16 }}>
                                    <span>🆕</span>
                                    <span><strong>{form.year}학년 {form.classNum}반</strong>을 새로 등록합니다. 사용할 4자리 비밀번호를 설정하세요.</span>
                                </div>
                            ) : (
                                <div className="alert alert-success" style={{ marginBottom: 16 }}>
                                    <span>✅</span>
                                    <span><strong>{form.year}학년 {form.classNum}반</strong> ({existingClass?.teacherName}) 학급이 확인되었습니다.</span>
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label">{isNew ? '새 비밀번호 4자리 설정' : '비밀번호 4자리'}</label>
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '12px 0' }}>
                                    {[0, 1, 2, 3].map(i => (
                                        <input
                                            key={i}
                                            id={`pin-t-${i}`}
                                            className="pin-digit"
                                            type="password"
                                            maxLength={1}
                                            inputMode="numeric"
                                            value={form.pin[i] || ''}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                const arr = form.pin.split('');
                                                arr[i] = val;
                                                const newPin = arr.join('').slice(0, 4);
                                                setForm(f => ({ ...f, pin: newPin }));
                                                setError('');
                                                if (val && i < 3) document.getElementById(`pin-t-${i + 1}`)?.focus();
                                            }}
                                        />
                                    ))}
                                </div>
                                {error && <p style={{ color: 'var(--danger)', textAlign: 'center', fontSize: '0.85rem' }}>{error}</p>}
                            </div>
                            <button type="submit" className="btn btn-primary btn-block">{isNew ? '학급 등록 및 입장' : '로그인'}</button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}
