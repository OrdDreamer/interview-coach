import axios from 'axios'
import type { Session } from '../types/session'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export async function uploadSession(file: File): Promise<Session> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await axios.post<Session>(`${API_URL}/api/sessions`, form)
  return data
}

export async function getSession(id: string): Promise<Session> {
  const { data } = await axios.get<Session>(`${API_URL}/api/sessions/${id}`)
  return data
}
