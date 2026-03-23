import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import { motion, AnimatePresence } from 'framer-motion'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'
import { supabase } from '../../supabase/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export default function NotebookEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [notebook, setNotebook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [onlineUsers, setOnlineUsers] = useState([])
  const saveTimer = useRef()
  const channelRef = useRef()

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder: 'Start writing your notes… use / for commands' }),
      Highlight,
      Link.configure({ openOnClick: false }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => saveContent(editor.getJSON()), 1200)

      // broadcast to collaborators
      channelRef.current?.send({
        type: 'broadcast', event: 'content',
        payload: { content: editor.getJSON(), userId: user?.id }
      })
    },
  })

  useEffect(() => {
    fetchNotebook()
    setupRealtime()
    return () => { channelRef.current?.unsubscribe() }
  }, [id])

  async function fetchNotebook() {
    const { data, error } = await supabase
      .from('notebooks')
      .select('*, profiles(username, avatar_url)')
      .eq('id', id)
      .single()
    if (error || !data) { toast.error('Notebook not found'); navigate('/dashboard'); return }
    setNotebook(data)
    if (data.content && editor) editor.commands.setContent(data.content)
    setLoading(false)
  }

  useEffect(() => {
    if (notebook?.content && editor && !editor.isDestroyed) {
      editor.commands.setContent(notebook.content)
    }
  }, [notebook, editor])

  function setupRealtime() {
    const channel = supabase.channel(`notebook:${id}`, {
      config: { presence: { key: user?.id } }
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineUsers(Object.values(state).flat())
      })
      .on('broadcast', { event: 'content' }, ({ payload }) => {
        if (payload.userId !== user?.id && editor && !editor.isDestroyed) {
          const pos = editor.state.selection
          editor.commands.setContent(payload.content, false)
          editor.commands.setTextSelection(pos)
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ username: profile?.username, userId: user?.id })
        }
      })

    channelRef.current = channel
  }

  async function saveContent(content) {
    setSaving(true)
    await supabase.from('notebooks').update({ content, updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(false)
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('notebook-images').upload(path, file)
    if (error) { toast.error('Image upload failed'); return }
    const { data } = supabase.storage.from('notebook-images').getPublicUrl(path)
    editor.chain().focus().setImage({ src: data.publicUrl }).run()
    toast.success('Image added!')
  }

  function insertEmoji(emoji) {
    editor?.chain().focus().insertContent(emoji.native).run()
    setShowEmoji(false)
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    try {
      // find user by email in profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
      // match by email prefix
      const found = profiles?.find(p => p.username === inviteEmail.split('@')[0])
      if (!found) throw new Error('User not found. They need to sign up first.')
      await supabase.from('notebook_collaborators').insert({ notebook_id: id, user_id: found.id })
      toast.success(`${found.username} added as collaborator!`)
      setInviteEmail('')
      setShowInvite(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080810', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        style={{ width: 32, height: 32, border: '2px solid rgba(124,58,237,0.3)', borderTopColor: '#7c3aed', borderRadius: '50%' }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#080810', fontFamily: 'Space Grotesk, sans-serif', color: 'white' }}>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(8,8,16,0.9)', backdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 40
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 20, padding: 0 }}
          >←</button>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{notebook?.title}</div>
          <div style={{ fontSize: 11, color: saving ? '#a78bfa' : 'rgba(255,255,255,0.3)' }}>
            {saving ? 'Saving…' : 'Saved'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Online avatars */}
          <div style={{ display: 'flex', gap: -4 }}>
            {onlineUsers.slice(0, 4).map((u, i) => (
              <div key={i} title={u.username} style={{
                width: 28, height: 28, borderRadius: '50%',
                background: `hsl(${(i * 60) % 360},70%,60%)`,
                border: '2px solid #080810', marginLeft: i > 0 ? -8 : 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'white'
              }}>
                {(u.username || 'U')[0].toUpperCase()}
              </div>
            ))}
          </div>

          {/* Invite button */}
          <button
            onClick={() => setShowInvite(true)}
            style={{
              padding: '7px 16px', borderRadius: 8,
              border: '1px solid rgba(124,58,237,0.4)',
              background: 'rgba(124,58,237,0.1)',
              color: '#a78bfa', fontSize: 12, cursor: 'pointer',
              fontFamily: 'Space Grotesk, sans-serif'
            }}
          >+ Invite</button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 4, padding: '10px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexWrap: 'wrap', alignItems: 'center'
      }}>
        {[
          { label: 'B', action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
          { label: 'I', action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
          { label: 'S', action: () => editor?.chain().focus().toggleStrike().run(), active: editor?.isActive('strike') },
          { label: 'H1', action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), active: editor?.isActive('heading', { level: 1 }) },
          { label: 'H2', action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive('heading', { level: 2 }) },
          { label: '• List', action: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
          { label: '1. List', action: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList') },
          { label: '</>', action: () => editor?.chain().focus().toggleCodeBlock().run(), active: editor?.isActive('codeBlock') },
          { label: '❝', action: () => editor?.chain().focus().toggleBlockquote().run(), active: editor?.isActive('blockquote') },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action} style={{
            padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
            background: btn.active ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)',
            color: btn.active ? '#a78bfa' : 'rgba(255,255,255,0.6)',
            fontWeight: btn.label === 'B' ? 700 : btn.label === 'I' ? undefined : 500,
            fontStyle: btn.label === 'I' ? 'italic' : 'normal',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>{btn.label}</button>
        ))}

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        {/* Image upload */}
        <label style={{
          padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)'
        }}>
          🖼 Image
          <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
        </label>

        {/* Emoji picker */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            style={{
              padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
              background: showEmoji ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)',
              color: showEmoji ? '#a78bfa' : 'rgba(255,255,255,0.6)',
              fontFamily: 'Space Grotesk, sans-serif'
            }}
          >😊 Emoji</button>
          {showEmoji && (
            <div style={{ position: 'absolute', top: 40, left: 0, zIndex: 50 }}>
              <Picker data={data} onEmojiSelect={insertEmoji} theme="dark" />
            </div>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px' }}>
        <EditorContent editor={editor} />
      </div>

      {/* Invite modal */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(6px)' }}
            onClick={() => setShowInvite(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: '#0f0f1a', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 16, padding: '2rem', width: 400 }}
            >
              <h3 style={{ marginBottom: 6, fontFamily: 'Syne, sans-serif', fontSize: 18 }}>Invite collaborator</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>Enter their email address (they must have an account)</p>
              <input
                autoFocus value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
                placeholder="email@example.com"
                style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'white', fontSize: 14, fontFamily: 'Space Grotesk, sans-serif', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowInvite(false)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button onClick={handleInvite} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#00e5ff)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Invite</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .ProseMirror { outline: none; min-height: 60vh; font-size: 16px; line-height: 1.8; color: rgba(255,255,255,0.85); }
        .ProseMirror h1 { font-size: 2rem; font-weight: 800; font-family: Syne, sans-serif; margin: 1.5rem 0 0.75rem; color: white; }
        .ProseMirror h2 { font-size: 1.4rem; font-weight: 700; font-family: Syne, sans-serif; margin: 1.25rem 0 0.5rem; color: rgba(255,255,255,0.9); }
        .ProseMirror p { margin: 0.5rem 0; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; }
        .ProseMirror li { margin: 0.25rem 0; }
        .ProseMirror code { background: rgba(124,58,237,0.2); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; color: #a78bfa; }
        .ProseMirror pre { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 1rem; margin: 1rem 0; overflow-x: auto; }
        .ProseMirror pre code { background: none; padding: 0; color: #e0e0e0; }
        .ProseMirror blockquote { border-left: 3px solid #7c3aed; padding-left: 1rem; margin: 1rem 0; color: rgba(255,255,255,0.5); }
        .ProseMirror img { max-width: 100%; border-radius: 8px; margin: 1rem 0; border: 1px solid rgba(255,255,255,0.1); }
        .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: rgba(255,255,255,0.2); pointer-events: none; position: absolute; }
        .ProseMirror mark { background: rgba(124,58,237,0.3); color: white; border-radius: 3px; padding: 1px 3px; }
      `}</style>
    </div>
  )
}