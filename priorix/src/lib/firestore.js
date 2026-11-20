import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { db } from './firebase.js';

/**
 * Real Firestore User-Isolated Collection Services
 * All documents reside under /users/{uid}/... ensuring strict isolation and compliance with firestore.rules
 */

// ========================
// 1. TASKS CRUD
// ========================
export function subscribeToTasks(uid, callback, errorCallback) {
  if (!uid) return () => {};
  const tasksRef = collection(db, 'users', uid, 'tasks');
  const q = query(tasksRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Normalize timestamp fields to ISO strings for consistent UI handling
      due_date: doc.data().due_date || null,
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : (doc.data().createdAt || new Date().toISOString()),
      updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate().toISOString() : (doc.data().updatedAt || new Date().toISOString()),
      last_touched_at: doc.data().last_touched_at || new Date().toISOString(),
    }));
    callback(tasks);
  }, errorCallback);
}

export async function createTaskInFirestore(uid, taskData) {
  if (!uid) throw new Error('User not authenticated');
  const tasksRef = collection(db, 'users', uid, 'tasks');
  const docRef = await addDoc(tasksRef, {
    title: taskData.title,
    description: taskData.description || '',
    goal_id: taskData.goal_id || null,
    status: taskData.status || 'pending',
    priority: taskData.priority || 'medium',
    due_date: taskData.due_date || null,
    estimated_minutes: Number(taskData.estimated_minutes) || 60,
    last_touched_at: new Date().toISOString(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateTaskInFirestore(uid, taskId, updates) {
  if (!uid) throw new Error('User not authenticated');
  const taskRef = doc(db, 'users', uid, 'tasks', taskId);
  await updateDoc(taskRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTaskFromFirestore(uid, taskId) {
  if (!uid) throw new Error('User not authenticated');
  const taskRef = doc(db, 'users', uid, 'tasks', taskId);
  await deleteDoc(taskRef);
}

// ========================
// 2. GOALS CRUD
// ========================
export function subscribeToGoals(uid, callback, errorCallback) {
  if (!uid) return () => {};
  const goalsRef = collection(db, 'users', uid, 'goals');
  const q = query(goalsRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const goals = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      target_date: doc.data().target_date || null,
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : (doc.data().createdAt || new Date().toISOString()),
      updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate().toISOString() : (doc.data().updatedAt || new Date().toISOString()),
      last_progress_date: doc.data().last_progress_date || new Date().toISOString(),
    }));
    callback(goals);
  }, errorCallback);
}

export async function createGoalInFirestore(uid, goalData) {
  if (!uid) throw new Error('User not authenticated');
  const goalsRef = collection(db, 'users', uid, 'goals');
  const docRef = await addDoc(goalsRef, {
    title: goalData.title,
    description: goalData.description || '',
    category: goalData.category || 'career',
    status: goalData.status || 'active',
    priority: goalData.priority || 'high',
    progress_percentage: Number(goalData.progress_percentage) || 0,
    target_date: goalData.target_date || null,
    last_progress_date: new Date().toISOString(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateGoalInFirestore(uid, goalId, updates) {
  if (!uid) throw new Error('User not authenticated');
  const goalRef = doc(db, 'users', uid, 'goals', goalId);
  await updateDoc(goalRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGoalFromFirestore(uid, goalId) {
  if (!uid) throw new Error('User not authenticated');
  const goalRef = doc(db, 'users', uid, 'goals', goalId);
  await deleteDoc(goalRef);
}

// ========================
// 3. COMMITMENTS CRUD
// ========================
export function subscribeToCommitments(uid, callback, errorCallback) {
  if (!uid) return () => {};
  const commitmentsRef = collection(db, 'users', uid, 'commitments');
  const q = query(commitmentsRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const commitments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      due_date: doc.data().due_date || null,
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : (doc.data().createdAt || new Date().toISOString()),
      updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate().toISOString() : (doc.data().updatedAt || new Date().toISOString()),
    }));
    callback(commitments);
  }, errorCallback);
}

export async function createCommitmentInFirestore(uid, commData) {
  if (!uid) throw new Error('User not authenticated');
  const commitmentsRef = collection(db, 'users', uid, 'commitments');
  const docRef = await addDoc(commitmentsRef, {
    title: commData.title,
    recipient: commData.recipient || 'Personal / Internal',
    source: commData.source || 'manual',
    status: commData.status || 'open',
    importance: commData.importance || 'high',
    due_date: commData.due_date || new Date().toISOString(),
    notes: commData.notes || '',
    fulfilled_at: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCommitmentInFirestore(uid, commId, updates) {
  if (!uid) throw new Error('User not authenticated');
  const commitmentRef = doc(db, 'users', uid, 'commitments', commId);
  await updateDoc(commitmentRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCommitmentFromFirestore(uid, commId) {
  if (!uid) throw new Error('User not authenticated');
  const commitmentRef = doc(db, 'users', uid, 'commitments', commId);
  await deleteDoc(commitmentRef);
}

// ========================
// 4. FOLLOW-UPS CRUD
// ========================
export function subscribeToFollowUps(uid, callback, errorCallback) {
  if (!uid) return () => {};
  const followUpsRef = collection(db, 'users', uid, 'followUps');
  const q = query(followUpsRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const followUps = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      sent_date: doc.data().sent_date || null,
      follow_up_due_date: doc.data().follow_up_due_date || null,
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : (doc.data().createdAt || new Date().toISOString()),
      updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate().toISOString() : (doc.data().updatedAt || new Date().toISOString()),
    }));
    callback(followUps);
  }, errorCallback);
}

export async function createFollowUpInFirestore(uid, fData) {
  if (!uid) throw new Error('User not authenticated');
  const followUpsRef = collection(db, 'users', uid, 'followUps');
  const docRef = await addDoc(followUpsRef, {
    title: fData.title,
    contact_person: fData.contact_person || 'Unknown Contact',
    contact_channel: fData.contact_channel || 'email',
    context: fData.context || '',
    status: fData.status || 'waiting',
    sent_date: fData.sent_date || new Date().toISOString(),
    follow_up_due_date: fData.follow_up_due_date || new Date().toISOString(),
    last_ping_date: new Date().toISOString(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateFollowUpInFirestore(uid, fId, updates) {
  if (!uid) throw new Error('User not authenticated');
  const followUpRef = doc(db, 'users', uid, 'followUps', fId);
  await updateDoc(followUpRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFollowUpFromFirestore(uid, fId) {
  if (!uid) throw new Error('User not authenticated');
  const followUpRef = doc(db, 'users', uid, 'followUps', fId);
  await deleteDoc(followUpRef);
}

// ========================
// 5. ACTIVITY LOGS
// ========================
export function subscribeToActivityLogs(uid, callback, errorCallback) {
  if (!uid) return () => {};
  const activityRef = collection(db, 'users', uid, 'activity');
  const q = query(activityRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.slice(0, 30).map(doc => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : (doc.data().createdAt || new Date().toISOString()),
    }));
    callback(logs);
  }, errorCallback);
}

export async function logActivityInFirestore(uid, action_type, entity_type, summary) {
  if (!uid) return;
  try {
    const activityRef = collection(db, 'users', uid, 'activity');
    await addDoc(activityRef, {
      action_type,
      entity_type,
      summary,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Could not write activity log:', err);
  }
}

// ========================
// 6. GOOGLE INTEGRATION METADATA
// ========================
export function subscribeToGoogleIntegration(uid, callback, errorCallback) {
  if (!uid) return () => {};
  const integrationRef = doc(db, 'users', uid, 'integrations', 'google');
  return onSnapshot(integrationRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({
        id: docSnap.id,
        ...docSnap.data(),
        connectedAt: docSnap.data().connectedAt?.toDate ? docSnap.data().connectedAt.toDate().toISOString() : docSnap.data().connectedAt,
        updatedAt: docSnap.data().updatedAt?.toDate ? docSnap.data().updatedAt.toDate().toISOString() : docSnap.data().updatedAt,
      });
    } else {
      callback(null);
    }
  }, errorCallback);
}

export async function saveGoogleIntegrationInFirestore(uid, integrationData) {
  if (!uid) throw new Error('User not authenticated');
  const integrationRef = doc(db, 'users', uid, 'integrations', 'google');
  await setDoc(integrationRef, {
    provider: 'google',
    connected: true,
    email: integrationData.email || '',
    scopes: integrationData.scopes || [],
    calendarSyncEnabled: integrationData.calendarSyncEnabled ?? true,
    gmailSyncEnabled: integrationData.gmailSyncEnabled ?? true,
    connectedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function updateGoogleIntegrationSettingsInFirestore(uid, settings) {
  if (!uid) throw new Error('User not authenticated');
  const integrationRef = doc(db, 'users', uid, 'integrations', 'google');
  await updateDoc(integrationRef, {
    ...settings,
    updatedAt: serverTimestamp(),
  });
}

export async function removeGoogleIntegrationFromFirestore(uid) {
  if (!uid) throw new Error('User not authenticated');
  const integrationRef = doc(db, 'users', uid, 'integrations', 'google');
  await setDoc(integrationRef, {
    provider: 'google',
    connected: false,
    disconnectedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ========================
// 7. EMAIL ANALYSIS PERSISTENCE
// ========================
export function subscribeToEmailAnalyses(uid, callback, errorCallback) {
  if (!uid) return () => {};
  const ref = collection(db, 'users', uid, 'email_analysis');
  const q = query(ref, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : (doc.data().createdAt || new Date().toISOString()),
    }));
    callback(list);
  }, errorCallback);
}

export async function saveEmailAnalysisInFirestore(uid, messageId, data) {
  if (!uid || !messageId) return;
  const ref = doc(db, 'users', uid, 'email_analysis', messageId);
  await setDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });
}

// ========================
// 8. DEADLINES
// ========================
export function subscribeToDeadlines(uid, callback, errorCallback) {
  if (!uid) return () => {};
  const ref = collection(db, 'users', uid, 'deadlines');
  const q = query(ref, orderBy('deadlineDate', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(list);
  }, errorCallback);
}

export async function saveDeadlineToFirestore(uid, deadlineId, data) {
  if (!uid || !deadlineId) return;
  const ref = doc(db, 'users', uid, 'deadlines', deadlineId);
  await setDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });
}

export async function updateDeadlineToFirestore(uid, deadlineId, updates) {
  if (!uid || !deadlineId) return;
  const ref = doc(db, 'users', uid, 'deadlines', deadlineId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function updateEmailAnalysisInFirestore(uid, messageId, updates) {
  if (!uid || !messageId) return;
  const ref = doc(db, 'users', uid, 'email_analysis', messageId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// ========================
// 9. SYSTEM NOTIFICATIONS & ESCALATION CENTER
// ========================
export function subscribeToSystemNotifications(uid, callback, errorCallback) {
  if (!uid) return () => {};
  const ref = collection(db, 'users', uid, 'notifications');
  const q = query(ref, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.slice(0, 50).map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : (doc.data().createdAt || new Date().toISOString()),
    }));
    callback(list);
  }, errorCallback);
}

export async function createSystemNotificationInFirestore(uid, notificationData) {
  if (!uid) return;
  const ref = collection(db, 'users', uid, 'notifications');
  const docRef = await addDoc(ref, {
    ...notificationData,
    read: false,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function markNotificationReadInFirestore(uid, notificationId) {
  if (!uid || !notificationId) return;
  const ref = doc(db, 'users', uid, 'notifications', notificationId);
  await updateDoc(ref, {
    read: true,
    readAt: serverTimestamp(),
  });
}

// ========================
// 10. NOTIFICATION SETTINGS & AWAY MODE
// ========================
export function subscribeToNotificationSettings(uid, callback, errorCallback) {
  if (!uid) return () => {};
  const ref = doc(db, 'users', uid, 'notification_settings', 'config');
  return onSnapshot(ref, (docSnap) => {
    if (docSnap.exists()) {
      callback({
        id: docSnap.id,
        ...docSnap.data(),
      });
    } else {
      callback({
        browserNotificationsEnabled: true,
        calendarAlertsEnabled: true,
        minimumPriority: 'CRITICAL',
        deadlineAlerts: true,
        jobAlerts: true,
        examAlerts: true,
        followUpAlerts: true,
        awayMode: false,
        notificationIntensity: 'Normal',
        autoCalendarSync: true,
      });
    }
  }, errorCallback);
}

export async function saveNotificationSettingsInFirestore(uid, settings) {
  if (!uid) return;
  const ref = doc(db, 'users', uid, 'notification_settings', 'config');
  await setDoc(ref, {
    ...settings,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}


