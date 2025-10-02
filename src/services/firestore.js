import { db } from '../firebase'
import { collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from 'firebase/firestore'

export async function getCollectionOnce(collectionPath) {
  const snap = await getDocs(collection(db, collectionPath))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getDocOnce(collectionPath, id) {
  const ref = doc(db, collectionPath, id)
  const snap = await getDoc(ref)
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function addToCollection(collectionPath, data) {
  const ref = await addDoc(collection(db, collectionPath), data)
  return ref.id
}

export async function setDocument(collectionPath, id, data, merge = true) {
  const ref = doc(db, collectionPath, id)
  await setDoc(ref, data, { merge })
  return id
}

export async function updateDocument(collectionPath, id, partial) {
  const ref = doc(db, collectionPath, id)
  await updateDoc(ref, partial)
  return id
}

export async function deleteDocument(collectionPath, id) {
  const ref = doc(db, collectionPath, id)
  await deleteDoc(ref)
}

export async function queryCollection(collectionPath, { whereClauses = [], orderByField, orderDirection = 'asc', max = 50 } = {}) {
  let q = collection(db, collectionPath)
  const parts = []
  for (const [field, op, value] of whereClauses) {
    parts.push(where(field, op, value))
  }
  if (orderByField) parts.push(orderBy(orderByField, orderDirection))
  if (max) parts.push(limit(max))
  const built = query(q, ...parts)
  const snap = await getDocs(built)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}



