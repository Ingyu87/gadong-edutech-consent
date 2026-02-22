'use client';

import { Suspense } from 'react';
import ParentLoginInner from './ParentLoginInner';

export default function ParentLoginPage() {
    return (
        <Suspense fallback={
            <div className="app-shell">
                <header className="header">
                    <div className="header-logo"><span>🏫</span>에듀테크 개인정보 동의 시스템</div>
                </header>
                <main className="main-content">
                    <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
                </main>
            </div>
        }>
            <ParentLoginInner />
        </Suspense>
    );
}
