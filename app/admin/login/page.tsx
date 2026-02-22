'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSchool } from '@/lib/db';

export default function AdminLoginPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [schoolName, setSchoolName] = useState('');

    useEffect(() => {
        const name = sessionStorage.getItem('schoolName');
        const id = sessionStorage.getItem('schoolId');
        if (!name || !id) {
            router.replace('/');
        } else {
            setSchoolName(name);
        }
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const schoolId = sessionStorage.getItem('schoolId');
        if (!schoolId) return;
        const school = await getSchool(schoolId);
        if (school && school.adminPassword === password.trim()) {
            sessionStorage.setItem('adminAuth', 'true');
            router.push('/admin');
        } else {
            setError('비밀번호가 올바르지 않습니다.');
        }
    };

    return (
        <div className="app-shell">
            <header className="header">
                <div className="header-logo"><span>🏫</span>에듀테크 개인정보 동의 시스템</div>
                {schoolName && <span className="header-school">{schoolName}</span>}
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => router.push('/role')}>← 뒤로</button>
            </header>
            <main className="main-content" style={{ maxWidth: 440 }}>
                <div className="card" style={{ marginTop: 40 }}>
                    <p className="card-title" style={{ justifyContent: 'center' }}>🛡️ 관리자 로그인</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--gray-400)', textAlign: 'center', marginBottom: 24 }}>
                        {schoolName}
                    </p>
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label">관리자 비밀번호</label>
                            <input
                                className="form-control"
                                type="password"
                                placeholder="비밀번호 입력"
                                value={password}
                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                autoFocus
                            />
                            {error && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 6 }}>{error}</p>}
                        </div>
                        <button type="submit" className="btn btn-primary btn-block btn-lg">로그인</button>
                    </form>
                </div>
            </main>
        </div>
    );
}
