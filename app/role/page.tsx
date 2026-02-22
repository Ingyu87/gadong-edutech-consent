'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RolePage() {
    const router = useRouter();
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

    const roles = [
        {
            icon: '🛡️',
            title: '관리자',
            desc: '학운위 심의 목록 관리\n소프트웨어 등록 및 현황',
            path: '/admin/login',
            badge: 'badge-admin',
        },
        {
            icon: '👩‍🏫',
            title: '교사',
            desc: '우리 반 에듀테크 설정\n학생 동의 현황 확인',
            path: '/teacher/login',
            badge: 'badge-teacher',
        },
    ];

    return (
        <div className="app-shell">
            <header className="header">
                <div className="header-logo">
                    <span>🏫</span>
                    에듀테크 개인정보 동의 시스템
                </div>
                {schoolName && <span className="header-school">{schoolName}</span>}
                <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => { sessionStorage.clear(); router.push('/'); }}
                >
                    ← 학교 선택
                </button>
            </header>
            <main className="main-content">
                <div className="hero" style={{ paddingBottom: 12 }}>
                    <h1 className="hero-title">어떤 모드로 접속하시나요?</h1>
                    <p className="hero-sub">{schoolName}</p>
                </div>
                <div className="role-grid" style={{ marginTop: 24 }}>
                    {roles.map(role => (
                        <button
                            key={role.title}
                            className="role-card"
                            onClick={() => router.push(role.path)}
                        >
                            <div className="role-icon">{role.icon}</div>
                            <div className="role-title">{role.title}</div>
                            <div className="role-desc" style={{ whiteSpace: 'pre-line' }}>{role.desc}</div>
                        </button>
                    ))}
                </div>
            </main>
        </div>
    );
}
