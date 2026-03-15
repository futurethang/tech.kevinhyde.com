import React, { useState, useEffect, useCallback, useRef } from 'react'
import { loadData, saveData, subscribeToData } from './firebase'

// ============================================================
// INITIAL SEED DATA - Used on first load if Firestore is empty
// This is the Wallace-Hyde family tree for Canadian citizenship
// by descent applications under Bill C-3
// ============================================================
const INITIAL_DATA = {
  familyMembers: [
    {
      id: 'gp-paternal-gf',
      name: 'Grandfather (Paternal)',
      relationship: 'Grandfather',
      generation: 0,
      born: '',
      birthPlace: '',
      citizenshipStatus: 'born-in-canada',
      documents: {
        birthCertificate: { status: 'not-started', link: '', notes: '' },
        marriageCertificate: { status: 'not-started', link: '', notes: '' },
        proofOfCitizenship: { status: 'not-started', link: '', notes: '' },
        deathCertificate: { status: 'not-started', link: '', notes: '' },
        other: []
      },
      notes: ''
    },
    {
      id: 'gp-paternal-gm',
      name: 'Grandmother (Paternal)',
      relationship: 'Grandmother',
      generation: 0,
      born: '',
      birthPlace: '',
      citizenshipStatus: 'unknown',
      documents: {
        birthCertificate: { status: 'not-started', link: '', notes: '' },
        marriageCertificate: { status: 'not-started', link: '', notes: '' },
        proofOfCitizenship: { status: 'not-started', link: '', notes: '' },
        deathCertificate: { status: 'not-started', link: '', notes: '' },
        other: []
      },
      notes: ''
    },
    {
      id: 'parent-father',
      name: 'Father',
      relationship: 'Father',
      generation: 1,
      born: '',
      birthPlace: '',
      citizenshipStatus: 'by-descent',
      parentIds: ['gp-paternal-gf', 'gp-paternal-gm'],
      documents: {
        birthCertificate: { status: 'not-started', link: '', notes: '' },
        marriageCertificate: { status: 'not-started', link: '', notes: '' },
        proofOfCitizenship: { status: 'not-started', link: '', notes: '' },
        other: []
      },
      notes: ''
    },
    {
      id: 'parent-mother',
      name: 'Mother',
      relationship: 'Mother',
      generation: 1,
      born: '',
      birthPlace: '',
      citizenshipStatus: 'not-applicable',
      documents: {
        birthCertificate: { status: 'not-started', link: '', notes: '' },
        marriageCertificate: { status: 'not-started', link: '', notes: '' },
        other: []
      },
      notes: ''
    },
    {
      id: 'child-1',
      name: 'Child 1',
      relationship: 'Self/Sibling',
      generation: 2,
      born: '',
      birthPlace: '',
      citizenshipStatus: 'applying',
      parentIds: ['parent-father', 'parent-mother'],
      documents: {
        birthCertificate: { status: 'not-started', link: '', notes: '' },
        proofOfCitizenship: { status: 'not-started', link: '', notes: '' },
        applicationForm: { status: 'not-started', link: '', notes: '' },
        photos: { status: 'not-started', link: '', notes: '' },
        other: []
      },
      notes: ''
    },
    {
      id: 'child-2',
      name: 'Child 2',
      relationship: 'Self/Sibling',
      generation: 2,
      born: '',
      birthPlace: '',
      citizenshipStatus: 'applying',
      parentIds: ['parent-father', 'parent-mother'],
      documents: {
        birthCertificate: { status: 'not-started', link: '', notes: '' },
        proofOfCitizenship: { status: 'not-started', link: '', notes: '' },
        applicationForm: { status: 'not-started', link: '', notes: '' },
        photos: { status: 'not-started', link: '', notes: '' },
        other: []
      },
      notes: ''
    }
  ],
  activityLog: [],
  lastUpdated: null
}

const STATUS_OPTIONS = [
  { value: 'not-started', label: 'Not Started', color: '#9ca3af' },
  { value: 'in-progress', label: 'In Progress', color: '#f59e0b' },
  { value: 'requested', label: 'Requested', color: '#3b82f6' },
  { value: 'received', label: 'Received', color: '#10b981' },
  { value: 'not-needed', label: 'Not Needed', color: '#6b7280' }
]

const CITIZENSHIP_OPTIONS = [
  { value: 'born-in-canada', label: 'Born in Canada', color: '#dc2626' },
  { value: 'by-descent', label: 'By Descent (proven)', color: '#10b981' },
  { value: 'applying', label: 'Applying', color: '#f59e0b' },
  { value: 'not-applicable', label: 'Not Applicable', color: '#6b7280' },
  { value: 'unknown', label: 'Unknown', color: '#9ca3af' }
]

const TABS = ['Family Tree', 'My Chain', 'Resources']

const DOC_LABELS = {
  birthCertificate: 'Birth Certificate',
  marriageCertificate: 'Marriage Certificate',
  proofOfCitizenship: 'Proof of Citizenship',
  deathCertificate: 'Death Certificate',
  applicationForm: 'Application Form (CIT 0001)',
  photos: 'Photos (2 passport-style)',
  other: 'Other Documents'
}

function getStatusColor(status) {
  return STATUS_OPTIONS.find(s => s.value === status)?.color || '#9ca3af'
}

function getCitizenshipColor(status) {
  return CITIZENSHIP_OPTIONS.find(s => s.value === status)?.color || '#9ca3af'
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function App() {
  const [data, setData] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  const [meId, setMeId] = useState(() => localStorage.getItem('citizenship-hub-me') || '')
  const [saving, setSaving] = useState(false)
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)
  const saveTimeout = useRef(null)

  // Load data from Firestore on mount, subscribe to real-time updates
  useEffect(() => {
    let unsubscribe
    async function init() {
      try {
        const stored = await loadData()
        if (stored) {
          setData(stored)
        } else {
          // First load — seed Firestore with initial data
          const seed = { ...INITIAL_DATA, lastUpdated: new Date().toISOString() }
          await saveData(seed)
          setData(seed)
        }
        // Subscribe to real-time updates
        unsubscribe = subscribeToData((newData) => {
          setData(newData)
        })
      } catch (err) {
        console.error('Failed to load from Firestore:', err)
        // Fall back to initial data so the app isn't stuck on loading
        setData({ ...INITIAL_DATA, lastUpdated: new Date().toISOString() })
      }
    }
    init()
    return () => unsubscribe && unsubscribe()
  }, [])

  // Debounced save to Firestore
  const persistData = useCallback((newData) => {
    setData(newData)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      setSaving(true)
      try {
        await saveData({ ...newData, lastUpdated: new Date().toISOString() })
      } catch (e) {
        console.error('Save failed:', e)
      }
      setSaving(false)
    }, 800)
  }, [])

  const addLogEntry = useCallback((message) => {
    setData(prev => {
      const who = prev.familyMembers.find(m => m.id === meId)?.name || 'Someone'
      const updated = {
        ...prev,
        activityLog: [
          { timestamp: new Date().toISOString(), who, message },
          ...(prev.activityLog || []).slice(0, 49)
        ]
      }
      persistData(updated)
      return updated
    })
  }, [meId, persistData])

  const updateMember = useCallback((memberId, updates) => {
    setData(prev => {
      const updated = {
        ...prev,
        familyMembers: prev.familyMembers.map(m =>
          m.id === memberId ? { ...m, ...updates } : m
        )
      }
      persistData(updated)
      return updated
    })
  }, [persistData])

  const updateDocument = useCallback((memberId, docKey, updates) => {
    setData(prev => {
      const updated = {
        ...prev,
        familyMembers: prev.familyMembers.map(m =>
          m.id === memberId
            ? { ...m, documents: { ...m.documents, [docKey]: { ...m.documents[docKey], ...updates } } }
            : m
        )
      }
      persistData(updated)
      return updated
    })
  }, [persistData])

  const setMe = (id) => {
    setMeId(id)
    localStorage.setItem('citizenship-hub-me', id)
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `citizenship-hub-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText)
      if (parsed.familyMembers) {
        persistData({ ...parsed, lastUpdated: new Date().toISOString() })
        addLogEntry('Restored data from backup')
        setShowImport(false)
        setImportText('')
      } else {
        alert('Invalid backup format — missing familyMembers')
      }
    } catch {
      alert('Invalid JSON — please paste the full backup file contents')
    }
  }

  if (!data) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingText}>Loading...</div>
      </div>
    )
  }

  const selectedMember = data.familyMembers.find(m => m.id === selectedMemberId)
  const meMember = data.familyMembers.find(m => m.id === meId)

  // Build the chain from me back to the Canadian ancestor
  const getMyChain = () => {
    if (!meId) return []
    const chain = []
    let current = data.familyMembers.find(m => m.id === meId)
    const visited = new Set()
    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      chain.push(current)
      if (current.parentIds && current.parentIds.length > 0) {
        // Follow the first parent (paternal line for citizenship by descent)
        current = data.familyMembers.find(m => m.id === current.parentIds[0])
      } else {
        break
      }
    }
    return chain.reverse()
  }

  return (
    <div style={styles.app}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>🍁 Citizenship Hub</h1>
          <div style={styles.headerRight}>
            {saving && <span style={styles.savingBadge}>Saving...</span>}
            <select
              value={meId}
              onChange={e => setMe(e.target.value)}
              style={styles.meSelect}
            >
              <option value="">Select "ME"</option>
              {data.familyMembers
                .filter(m => m.generation === Math.max(...data.familyMembers.map(f => f.generation)))
                .map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))
              }
            </select>
          </div>
        </div>
        <p style={styles.subtitle}>Canadian Citizenship by Descent — Bill C-3 Family Tracker</p>
      </header>

      {/* Tab Bar */}
      <nav style={styles.tabBar}>
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(i); setSelectedMemberId(null) }}
            style={{
              ...styles.tab,
              ...(activeTab === i ? styles.tabActive : {})
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {/* FAMILY TREE TAB */}
        {activeTab === 0 && !selectedMember && (
          <div>
            <h2 style={styles.sectionTitle}>Family Members</h2>
            <div style={styles.generationsContainer}>
              {[0, 1, 2].map(gen => {
                const members = data.familyMembers.filter(m => m.generation === gen)
                const genLabel = gen === 0 ? 'Grandparents' : gen === 1 ? 'Parents' : 'Applicants'
                return (
                  <div key={gen} style={styles.generation}>
                    <h3 style={styles.genLabel}>{genLabel}</h3>
                    <div style={styles.memberGrid}>
                      {members.map(m => {
                        const totalDocs = Object.keys(m.documents).filter(k => k !== 'other').length
                        const doneDocs = Object.entries(m.documents)
                          .filter(([k]) => k !== 'other')
                          .filter(([, v]) => v.status === 'received' || v.status === 'not-needed').length
                        return (
                          <button
                            key={m.id}
                            onClick={() => setSelectedMemberId(m.id)}
                            style={styles.memberCard}
                          >
                            <div style={styles.memberName}>{m.name}</div>
                            <div style={{
                              ...styles.citizenshipBadge,
                              backgroundColor: getCitizenshipColor(m.citizenshipStatus) + '22',
                              color: getCitizenshipColor(m.citizenshipStatus),
                              borderColor: getCitizenshipColor(m.citizenshipStatus)
                            }}>
                              {CITIZENSHIP_OPTIONS.find(o => o.value === m.citizenshipStatus)?.label}
                            </div>
                            <div style={styles.docProgress}>
                              {doneDocs}/{totalDocs} docs ready
                            </div>
                            <div style={styles.progressBar}>
                              <div style={{
                                ...styles.progressFill,
                                width: `${totalDocs > 0 ? (doneDocs / totalDocs * 100) : 0}%`
                              }} />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* MEMBER DETAIL VIEW */}
        {activeTab === 0 && selectedMember && (
          <div>
            <button onClick={() => setSelectedMemberId(null)} style={styles.backBtn}>
              &larr; Back to Family Tree
            </button>
            <h2 style={styles.sectionTitle}>{selectedMember.name}</h2>

            <div style={styles.detailGrid}>
              <div style={styles.detailSection}>
                <h3 style={styles.detailLabel}>Basic Info</h3>
                <label style={styles.fieldLabel}>Name</label>
                <input
                  style={styles.input}
                  value={selectedMember.name}
                  onChange={e => {
                    updateMember(selectedMember.id, { name: e.target.value })
                  }}
                  onBlur={() => addLogEntry(`Updated name for ${selectedMember.name}`)}
                />
                <label style={styles.fieldLabel}>Born</label>
                <input
                  style={styles.input}
                  value={selectedMember.born}
                  onChange={e => updateMember(selectedMember.id, { born: e.target.value })}
                  placeholder="e.g. 1945"
                />
                <label style={styles.fieldLabel}>Birth Place</label>
                <input
                  style={styles.input}
                  value={selectedMember.birthPlace}
                  onChange={e => updateMember(selectedMember.id, { birthPlace: e.target.value })}
                  placeholder="e.g. Toronto, ON, Canada"
                />
                <label style={styles.fieldLabel}>Citizenship Status</label>
                <select
                  style={styles.input}
                  value={selectedMember.citizenshipStatus}
                  onChange={e => {
                    updateMember(selectedMember.id, { citizenshipStatus: e.target.value })
                    addLogEntry(`Changed citizenship status for ${selectedMember.name} to ${e.target.value}`)
                  }}
                >
                  {CITIZENSHIP_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <label style={styles.fieldLabel}>Notes</label>
                <textarea
                  style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
                  value={selectedMember.notes}
                  onChange={e => updateMember(selectedMember.id, { notes: e.target.value })}
                  placeholder="Any notes about this person's application..."
                />
              </div>

              <div style={styles.detailSection}>
                <h3 style={styles.detailLabel}>Documents</h3>
                {Object.entries(selectedMember.documents)
                  .filter(([key]) => key !== 'other')
                  .map(([key, doc]) => (
                    <div key={key} style={styles.docRow}>
                      <div style={styles.docHeader}>
                        <span style={styles.docName}>{DOC_LABELS[key] || key}</span>
                        <select
                          style={{
                            ...styles.statusSelect,
                            color: getStatusColor(doc.status),
                            borderColor: getStatusColor(doc.status)
                          }}
                          value={doc.status}
                          onChange={e => {
                            updateDocument(selectedMember.id, key, { status: e.target.value })
                            addLogEntry(`${selectedMember.name}: ${DOC_LABELS[key]} → ${e.target.value}`)
                          }}
                        >
                          {STATUS_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <input
                        style={styles.linkInput}
                        value={doc.link}
                        onChange={e => updateDocument(selectedMember.id, key, { link: e.target.value })}
                        placeholder="Paste share link (OneDrive, Google Drive, etc.)"
                      />
                      {doc.link && (
                        <a href={doc.link} target="_blank" rel="noopener noreferrer" style={styles.linkPreview}>
                          Open document &rarr;
                        </a>
                      )}
                      <input
                        style={styles.linkInput}
                        value={doc.notes}
                        onChange={e => updateDocument(selectedMember.id, key, { notes: e.target.value })}
                        placeholder="Notes about this document..."
                      />
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* MY CHAIN TAB */}
        {activeTab === 1 && (
          <div>
            <h2 style={styles.sectionTitle}>My Chain of Descent</h2>
            {!meId ? (
              <div style={styles.emptyState}>
                <p>Select yourself using the "ME" dropdown in the header to see your chain of descent.</p>
              </div>
            ) : (
              <div>
                <p style={styles.chainExplainer}>
                  Your citizenship claim traces through these family members. Each link in the chain
                  must have their documents in order for your application to succeed.
                </p>
                <div style={styles.chainContainer}>
                  {getMyChain().map((member, i, arr) => {
                    const totalDocs = Object.keys(member.documents).filter(k => k !== 'other').length
                    const doneDocs = Object.entries(member.documents)
                      .filter(([k]) => k !== 'other')
                      .filter(([, v]) => v.status === 'received' || v.status === 'not-needed').length
                    const isMe = member.id === meId
                    return (
                      <div key={member.id}>
                        <div style={{
                          ...styles.chainCard,
                          ...(isMe ? styles.chainCardMe : {})
                        }}>
                          <div style={styles.chainCardHeader}>
                            <span style={styles.chainName}>
                              {member.name} {isMe && '(YOU)'}
                            </span>
                            <span style={{
                              ...styles.citizenshipBadge,
                              backgroundColor: getCitizenshipColor(member.citizenshipStatus) + '22',
                              color: getCitizenshipColor(member.citizenshipStatus),
                              borderColor: getCitizenshipColor(member.citizenshipStatus),
                              fontSize: 11
                            }}>
                              {CITIZENSHIP_OPTIONS.find(o => o.value === member.citizenshipStatus)?.label}
                            </span>
                          </div>
                          <div style={styles.docProgress}>{doneDocs}/{totalDocs} documents ready</div>
                          <div style={styles.progressBar}>
                            <div style={{
                              ...styles.progressFill,
                              width: `${totalDocs > 0 ? (doneDocs / totalDocs * 100) : 0}%`
                            }} />
                          </div>
                          <button
                            onClick={() => { setActiveTab(0); setSelectedMemberId(member.id) }}
                            style={styles.viewDetailsBtn}
                          >
                            View Details
                          </button>
                        </div>
                        {i < arr.length - 1 && (
                          <div style={styles.chainArrow}>&#8595;</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* RESOURCES TAB */}
        {activeTab === 2 && (
          <div>
            <h2 style={styles.sectionTitle}>Resources & Activity</h2>

            {/* Backup & Restore */}
            <div style={styles.resourceSection}>
              <h3 style={styles.detailLabel}>Backup & Restore</h3>
              <div style={styles.btnRow}>
                <button onClick={handleExport} style={styles.primaryBtn}>
                  Export Backup (JSON)
                </button>
                <button onClick={() => setShowImport(!showImport)} style={styles.secondaryBtn}>
                  {showImport ? 'Cancel' : 'Import Backup'}
                </button>
              </div>
              {showImport && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    style={{ ...styles.input, minHeight: 120, fontFamily: 'monospace', fontSize: 12 }}
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder="Paste the full JSON backup here..."
                  />
                  <button onClick={handleImport} style={{ ...styles.primaryBtn, marginTop: 8 }}>
                    Restore from Backup
                  </button>
                </div>
              )}
            </div>

            {/* Useful Links */}
            <div style={styles.resourceSection}>
              <h3 style={styles.detailLabel}>Useful Links</h3>
              <ul style={styles.linkList}>
                <li><a href="https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/become-canadian-citizen/eligibility/already-citizen.html" target="_blank" rel="noopener noreferrer" style={styles.resourceLink}>IRCC — Am I already a citizen?</a></li>
                <li><a href="https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/application-citizenship-certificate-adults-minors.html" target="_blank" rel="noopener noreferrer" style={styles.resourceLink}>Citizenship Certificate Application (CIT 0001)</a></li>
                <li><a href="https://www.parl.ca/legisinfo/en/bill/40-2/c-3" target="_blank" rel="noopener noreferrer" style={styles.resourceLink}>Bill C-3 (Citizenship Act amendments)</a></li>
              </ul>
            </div>

            {/* Activity Log */}
            <div style={styles.resourceSection}>
              <h3 style={styles.detailLabel}>Recent Activity</h3>
              {(!data.activityLog || data.activityLog.length === 0) ? (
                <p style={styles.emptyState}>No activity yet. Changes will appear here as family members update documents.</p>
              ) : (
                <div style={styles.logContainer}>
                  {data.activityLog.map((entry, i) => (
                    <div key={i} style={styles.logEntry}>
                      <span style={styles.logTime}>{formatDate(entry.timestamp)}</span>
                      <span style={styles.logWho}>{entry.who}</span>
                      <span style={styles.logMessage}>{entry.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <p>Wallace-Hyde Family — Canadian Citizenship Tracker</p>
        {data.lastUpdated && (
          <p style={styles.footerDate}>Last synced: {formatDate(data.lastUpdated)}</p>
        )}
      </footer>
    </div>
  )
}

// ============================================================
// STYLES — All inline, no external CSS needed
// ============================================================
const styles = {
  app: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    maxWidth: 900,
    margin: '0 auto',
    padding: '0 16px',
    minHeight: '100vh',
    backgroundColor: '#fafafa',
    color: '#1f2937'
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#fafafa'
  },
  loadingText: {
    fontSize: 18,
    color: '#6b7280'
  },
  header: {
    padding: '24px 0 16px',
    borderBottom: '2px solid #dc2626'
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
    color: '#dc2626'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  savingBadge: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: 500
  },
  meSelect: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    fontSize: 14,
    backgroundColor: 'white'
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    margin: '8px 0 0'
  },
  tabBar: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid #e5e7eb',
    marginBottom: 24
  },
  tab: {
    padding: '12px 20px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: '#6b7280',
    borderBottom: '2px solid transparent',
    transition: 'all 0.15s'
  },
  tabActive: {
    color: '#dc2626',
    borderBottomColor: '#dc2626'
  },
  main: {
    minHeight: 400,
    paddingBottom: 40
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 20
  },
  generationsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 32
  },
  generation: {},
  genLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12
  },
  memberGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 12
  },
  memberCard: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 16,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'box-shadow 0.15s, border-color 0.15s',
    width: '100%'
  },
  memberName: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 8
  },
  citizenshipBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
    border: '1px solid',
    marginBottom: 8
  },
  docProgress: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 2,
    transition: 'width 0.3s'
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    padding: '4px 0',
    marginBottom: 12
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 24
  },
  detailSection: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 20
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: 600,
    marginTop: 0,
    marginBottom: 16
  },
  fieldLabel: {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: '#6b7280',
    marginBottom: 4,
    marginTop: 12
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    fontSize: 14,
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  },
  docRow: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: '1px solid #f3f4f6'
  },
  docHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  docName: {
    fontSize: 14,
    fontWeight: 500
  },
  statusSelect: {
    padding: '2px 8px',
    borderRadius: 12,
    border: '1px solid',
    fontSize: 12,
    fontWeight: 500,
    background: 'white',
    cursor: 'pointer'
  },
  linkInput: {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 4,
    border: '1px solid #e5e7eb',
    fontSize: 12,
    marginTop: 4,
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  },
  linkPreview: {
    display: 'inline-block',
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 4,
    textDecoration: 'none'
  },
  chainExplainer: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    lineHeight: 1.5
  },
  chainContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0
  },
  chainCard: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 20,
    width: 340,
    maxWidth: '100%'
  },
  chainCardMe: {
    borderColor: '#dc2626',
    boxShadow: '0 0 0 2px #dc262622'
  },
  chainCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  chainName: {
    fontSize: 16,
    fontWeight: 600
  },
  chainArrow: {
    fontSize: 24,
    color: '#d1d5db',
    textAlign: 'center',
    lineHeight: '36px'
  },
  viewDetailsBtn: {
    marginTop: 12,
    padding: '6px 16px',
    borderRadius: 6,
    border: '1px solid #dc2626',
    background: 'white',
    color: '#dc2626',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer'
  },
  resourceSection: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20
  },
  btnRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap'
  },
  primaryBtn: {
    padding: '8px 20px',
    borderRadius: 6,
    border: 'none',
    background: '#dc2626',
    color: 'white',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer'
  },
  secondaryBtn: {
    padding: '8px 20px',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    background: 'white',
    color: '#374151',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer'
  },
  linkList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  resourceLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontSize: 14
  },
  logContainer: {
    maxHeight: 400,
    overflowY: 'auto'
  },
  logEntry: {
    display: 'flex',
    gap: 12,
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
    fontSize: 13,
    flexWrap: 'wrap'
  },
  logTime: {
    color: '#9ca3af',
    whiteSpace: 'nowrap',
    minWidth: 120
  },
  logWho: {
    fontWeight: 600,
    color: '#374151',
    minWidth: 80
  },
  logMessage: {
    color: '#6b7280',
    flex: 1
  },
  emptyState: {
    color: '#9ca3af',
    textAlign: 'center',
    padding: '40px 20px',
    fontSize: 14
  },
  footer: {
    textAlign: 'center',
    padding: '20px 0',
    borderTop: '1px solid #e5e7eb',
    color: '#9ca3af',
    fontSize: 12
  },
  footerDate: {
    marginTop: 4,
    fontSize: 11
  }
}

// Responsive: on narrow screens, stack the detail grid
if (typeof window !== 'undefined' && window.innerWidth < 700) {
  styles.detailGrid.gridTemplateColumns = '1fr'
}
