'use client';

import { useEffect, useState } from 'react';
import { getSchools, createSchool } from '@/lib/db';
import { School } from '@/lib/types';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPass, setNewPass] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getSchools().then(s => {
      setSchools(s);
      setLoading(false);
    });
  }, []);

  const handleSelectSchool = (school: School) => {
    sessionStorage.setItem('schoolId', school.id);
    sessionStorage.setItem('schoolName', school.name);
    router.push('/role');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPass.trim()) return;
    setCreating(true);
    try {
      const id = await createSchool(newName.trim(), newPass.trim());
      sessionStorage.setItem('schoolId', id);
      sessionStorage.setItem('schoolName', newName.trim());
      router.push('/role');
    } catch {
      alert('학교 생성 중 오류가 발생했습니다.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-logo">
          <span>🏫</span>
          에듀테크 개인정보 동의 시스템
        </div>
      </header>
      <main className="main-content">
        <div className="hero" style={{ paddingBottom: 0 }}>
          <h1 className="hero-title">학교를 선택해 주세요</h1>
          <p className="hero-sub">에듀테크 학습지원 소프트웨어 개인정보 수집·이용 동의 관리 플랫폼</p>
        </div>

        <div style={{ marginTop: 32 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="spinner" />
              <p style={{ marginTop: 12, color: 'var(--gray-400)', fontSize: '0.9rem' }}>불러오는 중...</p>
            </div>
          ) : (
            <>
              {schools.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <p className="card-title">🏫 등록된 학교</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {schools.map(school => (
                      <button
                        key={school.id}
                        className="btn btn-outline btn-block"
                        style={{ justifyContent: 'flex-start', fontSize: '1rem' }}
                        onClick={() => handleSelectSchool(school)}
                      >
                        🏫 {school.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!showCreate ? (
                <div style={{ textAlign: 'center', marginTop: 20 }}>
                  <button className="btn btn-ghost" onClick={() => setShowCreate(true)}>
                    ＋ 새 학교 등록하기
                  </button>
                </div>
              ) : (
                <div className="card">
                  <p className="card-title">🆕 새 학교 등록</p>
                  <form onSubmit={handleCreate}>
                    <div className="form-group">
                      <label className="form-label">학교명 <span className="form-required">*</span></label>
                      <input
                        className="form-control"
                        placeholder="예: 서울가동초등학교"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">관리자 비밀번호 <span className="form-required">*</span></label>
                      <input
                        className="form-control"
                        type="password"
                        placeholder="관리자 비밀번호를 입력하세요"
                        value={newPass}
                        onChange={e => setNewPass(e.target.value)}
                        required
                      />
                      <p className="form-hint">설정한 비밀번호로 관리자 모드에 접근합니다.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button type="submit" className="btn btn-primary" disabled={creating}>
                        {creating ? '생성 중...' : '학교 등록'}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                        취소
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
