// Firestore data types

export interface School {
    id: string;
    name: string;
    adminPassword: string;
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
    privacySummary?: string;
}

export interface ConsentRecord {
    id: string;
    schoolId: string;
    classId: string;
    studentNumber: number;
    studentName: string;
    parentName: string;
    pin: string;
    responses: Record<string, boolean | null>; // softwareId -> true/false/null
    confirmationCode?: string;
    updatedAt: Date;
}
