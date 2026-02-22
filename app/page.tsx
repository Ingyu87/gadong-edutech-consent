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
  const [showGuide, setShowGuide] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newAccessCode, setNewAccessCode] = useState('2026');
  const [creating, setCreating] = useState(false);

  // 접속 코드 확인용 상태
  const [selectedSchoolForCode, setSelectedSchoolForCode] = useState<School | null>(null);
  const [verificationCode, setVerificationCode] = useState('');

  useEffect(() => {
    getSchools().then(async (s) => {
      setSchools(s);
      setLoading(false);

      // 미이그레이션: accessCode가 없는 학교들에 대해 기본값(2026) 부여
      const missingCode = s.filter(sch => !sch.accessCode);
      if (missingCode.length > 0) {
        const { updateSchoolAccessCode } = await import('@/lib/db');
        for (const sch of missingCode) {
          await updateSchoolAccessCode(sch.id, '2026');
        }
      }
    });
  }, []);

  const handleSelectSchool = (school: School) => {
    setSelectedSchoolForCode(school);
    setVerificationCode('');
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolForCode) return;

    const correctCode = selectedSchoolForCode.accessCode || '2026';
    if (verificationCode === correctCode) {
      sessionStorage.setItem('schoolId', selectedSchoolForCode.id);
      sessionStorage.setItem('schoolName', selectedSchoolForCode.name);
      router.push('/role');
    } else {
      alert('접속 코드가 일치하지 않습니다.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPass.trim() || !newAccessCode.trim()) return;
    setCreating(true);
    try {
      const id = await createSchool(newName.trim(), newPass.trim(), newAccessCode.trim());
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

        {/* 사용방법(프로세스) 안내 */}
        <div className="card" style={{ marginTop: 24, marginBottom: 8 }}>
          <button
            type="button"
            className="card-title"
            onClick={() => setShowGuide(!showGuide)}
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            📖 사용방법 (운영 절차)
            <span style={{ fontSize: '1rem', color: 'var(--gray-400)' }}>{showGuide ? '▼' : '▶'}</span>
          </button>
          {showGuide && (
            <div style={{ paddingTop: 12, borderTop: '1px solid var(--gray-100)', fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--gray-700)' }}>
              <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li><strong>담당자(관리자)</strong> — 학운위 심의 파일을 올려 학운위 심의를 받은 에듀테크 목록을 등록합니다.</li>
                <li><strong>교사</strong> — 그중 우리 반에서 쓸 에듀테크를 양식에 맞춰 작성한 뒤 CSV 파일로 올립니다.</li>
                <li><strong>담당자</strong> — 올라온 목록을 보고 학운위 심의 여부를 확인합니다. 명칭만 다르고 실제로 같은 제품이면 「심의 확인」으로 체크합니다.</li>
                <li><strong>심의 모두 확인된 후</strong> — 교사는 QR 코드를 가정통신문에 넣어 출력해 학부모에게 배부합니다.</li>
                <li><strong>학부모</strong> — QR 코드를 스캔해 휴대폰으로 접속한 뒤, 에듀테크별로 <strong>수집·이용 동의</strong>, <strong>제3자 제공 동의</strong>를 체크하고 제출합니다.</li>
                <li><strong>학부모</strong> — 제출 후 가정통신문에 <strong>자필 서명</strong>하여 담임 선생님께 제출합니다.</li>
              </ol>
            </div>
          )}
        </div>

        <div style={{ marginTop: 32 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="spinner" />
              <p style={{ marginTop: 12, color: 'var(--gray-400)', fontSize: '0.9rem' }}>불러오는 중...</p>
            </div>
          ) : (
            <>
              {/* 접속 코드 입력 팝업 스타일 모달 */}
              {selectedSchoolForCode && (
                <div className="card" style={{ border: '2px solid var(--primary)', marginBottom: 24 }}>
                  <p className="card-title">🔐 {selectedSchoolForCode.name} 접속 코드 입력</p>
                  <form onSubmit={handleVerifyCode}>
                    <div className="form-group">
                      <label className="form-label">학교 접속 코드를 입력해 주세요</label>
                      <input
                        className="form-control"
                        placeholder="접속 코드 입력"
                        value={verificationCode}
                        onChange={e => setVerificationCode(e.target.value)}
                        autoFocus
                        required
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button type="submit" className="btn btn-primary">확인</button>
                      <button type="button" className="btn btn-ghost" onClick={() => setSelectedSchoolForCode(null)}>
                        취소
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {schools.length > 0 && !selectedSchoolForCode && (
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
                    <div className="form-group">
                      <label className="form-label">학교 접속 코드 <span className="form-required">*</span></label>
                      <input
                        className="form-control"
                        placeholder="예: 2026"
                        value={newAccessCode}
                        onChange={e => setNewAccessCode(e.target.value)}
                        required
                      />
                      <p className="form-hint">교사 및 학부모가 학교 페이지에 접속할 때 입력할 코드입니다.</p>
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
