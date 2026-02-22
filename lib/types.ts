// Firestore data types

export interface School {
    id: string;
    name: string;
    adminPassword: string;
    accessCode: string;
    createdAt: Date;
}

export interface SmcRecord {
    id: string;
    schoolId: string;
    softwareName: string;
    privacyUrl: string;
    approvedDate: Date;
    documentUrl?: string;
}

export interface ClassConfig {
    id: string; // {schoolId}-{year}-{class}
    schoolId: string;
    year: number;
    classNum: number;
    teacherName: string;
    pin: string;
    isActive: boolean;
    selectedSoftwares: SoftwareItem[];
    teacherNote?: string;
    registrySoftwares?: SoftwareItem[];
}

export interface SoftwareItem {
    id: string;
    name: string;
    ageRange: string;
    url: string;
    privacyUrl: string;
    hasAi?: boolean;
    hasLms?: boolean;
    isSmcApproved?: boolean;
    /** 수집·이용 동의 안내 문구 (팝업 표시) */
    collectionUseConsent?: string;
    /** 제3자 제공 동의 안내 문구 (팝업 표시) */
    thirdPartyConsent?: string;
}

/** 소프트웨어별 동의 응답 (기본 동의 + 수집이용동의 + 제3자 제공동의) */
export interface ConsentResponse {
    agree: boolean | null;
    collectionUse: boolean | null;
    thirdParty: boolean | null;
}

export interface ConsentRecord {
    id: string;
    schoolId: string;
    classId: string;
    studentNumber: number;
    studentName: string;
    parentName: string;
    pin: string;
    /** softwareId -> { agree, collectionUse, thirdParty }. 구 형식(boolean)도 호환 */
    responses: Record<string, ConsentResponse | boolean | null>;
    confirmationCode?: string;
    updatedAt: Date;
}
