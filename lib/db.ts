import { db } from './firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    query,
    where,
    serverTimestamp,
    deleteDoc,
} from 'firebase/firestore';
import { School, SmcRecord, ClassConfig, ConsentRecord, SoftwareItem } from './types';

// --- Schools ---
export async function getSchools(): Promise<School[]> {
    const snap = await getDocs(collection(db, 'schools'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as School));
}

export async function createSchool(name: string, password: string): Promise<string> {
    const ref = await addDoc(collection(db, 'schools'), {
        name,
        adminPassword: password,
        createdAt: serverTimestamp(),
    });
    return ref.id;
}

export async function getSchool(schoolId: string): Promise<School | null> {
    const snap = await getDoc(doc(db, 'schools', schoolId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as School;
}

// --- SMC Records ---
export async function getSmcRecords(schoolId: string): Promise<SmcRecord[]> {
    const q = query(collection(db, 'smc_records'), where('schoolId', '==', schoolId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SmcRecord));
}

export async function addSmcRecord(record: Omit<SmcRecord, 'id'>): Promise<void> {
    await addDoc(collection(db, 'smc_records'), { ...record, approvedDate: serverTimestamp() });
}

export async function deleteSmcRecord(id: string): Promise<void> {
    await deleteDoc(doc(db, 'smc_records', id));
}

// --- Class Configs ---
export async function getClasses(schoolId: string): Promise<ClassConfig[]> {
    const q = query(collection(db, 'classes'), where('schoolId', '==', schoolId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ClassConfig));
}

export async function getClass(classId: string): Promise<ClassConfig | null> {
    const snap = await getDoc(doc(db, 'classes', classId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ClassConfig;
}

export async function upsertClass(classData: Omit<ClassConfig, 'id'>, classId: string): Promise<void> {
    await setDoc(doc(db, 'classes', classId), classData, { merge: true });
}

// --- Consent Records ---
export async function getConsents(classId: string): Promise<ConsentRecord[]> {
    const q = query(collection(db, 'consents'), where('classId', '==', classId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ConsentRecord));
}

export async function getConsentById(consentId: string): Promise<ConsentRecord | null> {
    const snap = await getDoc(doc(db, 'consents', consentId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ConsentRecord;
}

export async function upsertConsent(data: Omit<ConsentRecord, 'id' | 'updatedAt'>, consentId: string): Promise<void> {
    await setDoc(doc(db, 'consents', consentId), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteConsent(consentId: string): Promise<void> {
    await deleteDoc(doc(db, 'consents', consentId));
}

export async function deleteClass(classId: string): Promise<void> {
    await deleteDoc(doc(db, 'classes', classId));
}

export function makeClassId(schoolId: string, year: number, classNum: number): string {
    return `${schoolId}-${year}-${classNum}`;
}

export function makeConsentId(classId: string, studentNumber: number): string {
    return `${classId}-${studentNumber}`;
}
