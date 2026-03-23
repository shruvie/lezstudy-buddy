import { useState, useEffect } from 'react'
import { supabase } from '../../supabase/supabase'
import { useAuth } from './useAuth'

export function useNotebooks() {
  const { user } = useAuth()
  const [notebooks, setNotebooks] = useState([])
  const [collaborated, setCollaborated] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchAll()
  }, [user])

  async function fetchAll() {
    setLoading(true)
    // own notebooks
    const { data: own } = await supabase
      .from('notebooks')
      .select('*, profiles(username, avatar_url)')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })

    // collaborated notebooks
    const { data: collabIds } = await supabase
      .from('notebook_collaborators')
      .select('notebook_id')
      .eq('user_id', user.id)

    let collabData = []
    if (collabIds?.length) {
      const ids = collabIds.map(c => c.notebook_id)
      const { data } = await supabase
        .from('notebooks')
        .select('*, profiles(username, avatar_url)')
        .in('id', ids)
        .order('updated_at', { ascending: false })
      collabData = data || []
    }

    setNotebooks(own || [])
    setCollaborated(collabData)
    setLoading(false)
  }

  async function createNotebook(title) {
    const { data, error } = await supabase
      .from('notebooks')
      .insert({ title, owner_id: user.id, content: { type: 'doc', content: [] } })
      .select('*, profiles(username, avatar_url)')
      .single()
    if (error) throw error
    setNotebooks(prev => [data, ...prev])
    return data
  }

  async function deleteNotebook(id) {
    await supabase.from('notebooks').delete().eq('id', id)
    setNotebooks(prev => prev.filter(n => n.id !== id))
  }

  async function inviteCollaborator(notebookId, email) {
    // find user by email via profiles join
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', email.split('@')[0])
      .single()

    // try auth user lookup
    if (!profile) throw new Error('User not found. They must sign up first.')

    const { error } = await supabase
      .from('notebook_collaborators')
      .insert({ notebook_id: notebookId, user_id: profile.id })
    if (error) throw error
  }

  return { notebooks, collaborated, loading, createNotebook, deleteNotebook, inviteCollaborator, refetch: fetchAll }
}