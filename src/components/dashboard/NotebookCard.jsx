import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../supabase/supabase'
import CoverPicker from './CoverPicker'

const DEFAULT_COVERS = [
  'linear-gradient(135deg,#0d1b2a,#1a3a5c)',
  'linear-gradient(135deg,#0d1a2a,#0e3a4a)',
  'linear-gradient(135deg,#120d2a,#2a1a4a)',
  'linear-gradient(135deg,#0a1a1a,#0d3a2a)',
  'linear-gradient(135deg,#1a0d2a,#3a1a4a)',
]

function getDefaultCover(id) {
  return DEFAULT_COVERS[(id?.charCodeAt(0) || 0) % DEFAULT_COVERS.length]
}

export default function NotebookCard({ notebook, index, onDelete }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [coverOpen, setCoverOpen] = useState(false)
  const [cover, setCover] = useState(notebook.cover_url || getDefaultCover(notebook.id))

  const timeAgo = formatDistanceToNow(new Date(notebook.updated_at || notebook.created_at), { addSuffix: true })

  async function handleCoverSelect(style) {
    setCover(style)
    await supabase.from('notebooks').update({ cover_url: style }).eq('id', notebook.id)
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.07, duration: 0.4, ease: 'easeOut' }}
        whileHover={{ y: -6, transition: { duration: 0.2 } }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        style={{ position: 'relative', cursor: 'pointer' }}
        onClick={() => navigate(`/notebook/${notebook.id}`)}
      >
        {/* Glow */}
        <motion.div
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'absolute', inset: -2, borderRadius: 14,
            background: 'linear-gradient(135deg,rgba(0,229,255,0.3),rgba(124,58,237,0.3))',
            filter: 'blur(8px)', zIndex: 0
          }}
        />

        <div style={{
          position: 'relative', zIndex: 1,
          background: '#0d1117',
          border: `1px solid ${hovered ? 'rgba(0,229,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s'
        }}>
          {/* Cover */}
          <div style={{ height: 130, background: cover, position: 'relative', overflow: 'hidden' }}>
            {/* Animated circuit overlay */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3 }} viewBox="0 0 220 130">
              <path d="M0 65 Q30 30 60 65 Q90 100 120 65 Q150 30 180 65 Q210 100 220 65" fill="none" stroke="rgba(0,229,255,0.5)" strokeWidth="0.5" />
              <path d="M20 20 L20 80 M60 10 L60 120 M100 30 L100 100 M140 15 L140 90 M180 25 L180 110" stroke="rgba(0,229,255,0.3)" strokeWidth="0.5" />
              <circle cx="20" cy="50" r="2" fill="rgba(0,229,255,0.8)" />
              <circle cx="60" cy="65" r="2" fill="rgba(124,58,237,0.8)" />
              <circle cx="100" cy="65" r="2" fill="rgba(0,229,255,0.8)" />
              <circle cx="140" cy="50" r="2" fill="rgba(124,58,237,0.8)" />
              <circle cx="180" cy="65" r="2" fill="rgba(0,229,255,0.8)" />
            </svg>

            <div style={{ position: 'absolute', top: 10, left: 10, fontSize: 28 }}>🤖</div>

            {/* 3-dot menu */}
            <div
              style={{ position: 'absolute', top: 8, right: 8 }}
              onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            >
              <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '3px 8px', fontSize: 16, color: 'white', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>···</div>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  style={{ position: 'absolute', top: 30, right: 0, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 0', zIndex: 10, minWidth: 140 }}
                >
                  <div onClick={e => { e.stopPropagation(); navigate(`/notebook/${notebook.id}`) }}
                    style={{ padding: '8px 14px', fontSize: 13, color: '#e0e0e0', cursor: 'pointer' }}
                    onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.target.style.background = 'transparent'}
                  >📖 Open</div>
                  <div onClick={e => { e.stopPropagation(); setCoverOpen(true); setMenuOpen(false) }}
                    style={{ padding: '8px 14px', fontSize: 13, color: '#e0e0e0', cursor: 'pointer' }}
                    onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.target.style.background = 'transparent'}
                  >🎨 Change cover</div>
                  {onDelete && (
                    <div onClick={e => { e.stopPropagation(); onDelete(notebook.id); setMenuOpen(false) }}
                      style={{ padding: '8px 14px', fontSize: 13, color: '#ff6060', cursor: 'pointer' }}
                      onMouseEnter={e => e.target.style.background = 'rgba(255,96,96,0.08)'}
                      onMouseLeave={e => e.target.style.background = 'transparent'}
                    >🗑 Delete</div>
                  )}
                </motion.div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#e0e0e0', marginBottom: 6, lineHeight: 1.4 }}>
              {notebook.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#00e5ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', fontWeight: 600 }}>
                  {(notebook.profiles?.username || 'U')[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{notebook.profiles?.username || 'Unknown'}</span>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{timeAgo}</span>
            </div>
          </div>
        </div>
      </motion.div>

      <CoverPicker open={coverOpen} onClose={() => setCoverOpen(false)} onSelect={handleCoverSelect} current={cover} />
    </>
  )
}