import { useState, useEffect, useCallback, useRef } from "react";
import { loadData, saveData, subscribeToData, initAuth } from "./firebase";

const FAMILY_NAME = "Wallace-Hyde";
const ME_KEY = "citizenship-hub-me";

// ── Palette & type ─────────────────────────────────────────────────
const C = {
  bg: "#FAFAF7", card: "#FFFFFF", border: "#E8E4DD", borderLight: "#F0EDE8",
  accent: "#8B2500", accentPale: "#FFF5F0",
  blue: "#1A4B6E", blueLight: "#E8F0F6",
  green: "#2D6A4F", greenLight: "#E8F5EE", greenBadge: "#D4EDDA",
  yellowBadge: "#FFF3CD", redBadge: "#F8D7DA", grayBadge: "#E9ECEF",
  text: "#2C2417", textMuted: "#7A7062", textLight: "#A09888",
  maple: "#C41E3A", meBg: "#FDF2F4", meBorder: "#E8A0B0",
};
const serif = `'Source Serif 4','Georgia',serif`;
const sans = `'DM Sans','Segoe UI',sans-serif`;

const STATUS = [
  { value: "missing", label: "Missing", bg: C.redBadge, fg: "#721C24" },
  { value: "identified", label: "Identified", bg: C.yellowBadge, fg: "#856404" },
  { value: "requested", label: "Requested", bg: C.blueLight, fg: C.blue },
  { value: "in_hand", label: "In Hand", bg: C.greenBadge, fg: C.green },
];
const DOC_TYPES = ["Birth Certificate", "Death Certificate", "Marriage Certificate", "Other"];

// ── Seed data ──────────────────────────────────────────────────────
const INITIAL_DATA = {
  familyMembers: [
    { id: "bruce_wallace", parentId: null, name: "Bruce Wallace", birthDate: "January 9, 1884", birthPlace: "Beachville, Ontario, Canada", deathDate: "May 30, 1940", deathPlace: "Saginaw, Michigan", father: "Alexander Wallace (Oxford County, Ontario)", mother: "Louise Annie Cook (Beachville, Ontario)", spouse: "Margaret Kohler", isAnchor: true, notes: "Canadian citizen by birth. Ontario birth registration #026921. Lived at 1501 Farwell St, Saginaw. Warehouse Manager in furniture industry. In U.S.A. for 50 years per death cert. Informant on death cert: W.G. Wallace (same address)." },
    { id: "gen1_unknown", parentId: "bruce_wallace", name: "[Unknown — Bruce's child, Janet's parent]", birthDate: "", birthPlace: "Likely Saginaw area, MI", deathDate: "", deathPlace: "", father: "Bruce Wallace", mother: "Margaret Kohler", spouse: "", notes: "CRITICAL GAP — need to identify. W.G. Wallace (informant on Bruce's death cert) is a strong lead. Check 1940 Census for 1501 Farwell St, Saginaw. Ask Uncle Pat." },
    { id: "janet_wallace", parentId: "gen1_unknown", name: "Janet Wallace (married Garety)", birthDate: "", birthPlace: "Saginaw area, MI (estimated)", deathDate: "", deathPlace: "", father: "[See parent link]", mother: "", spouse: "Pat Garety", notes: "Need birth certificate + marriage certificate to Pat Garety. Marriage likely in Saginaw County." },
    { id: "ann_garety", parentId: "janet_wallace", name: "Ann Garety (married Hyde)", birthDate: "1954", birthPlace: "Michigan (likely)", deathDate: "", deathPlace: "", father: "Pat Garety", mother: "Janet Wallace Garety", spouse: "Mr. Hyde", notes: "Married 1973 in Caro, Michigan. Need birth certificate (as Ann Garety) + marriage certificate (Garety → Hyde). Also an applicant in her own right." },
    { id: "kevin_hyde", parentId: "ann_garety", name: "Kevin Hyde", birthDate: "", birthPlace: "", deathDate: "", deathPlace: "", father: "Mr. Hyde", mother: "Ann Garety Hyde", spouse: "", notes: "Need birth certificate." },
  ],
  documents: [
    { id: "doc_bruce_birth", personId: "bruce_wallace", type: "Birth Certificate", description: "Ontario birth registration #026921, Beachville", status: "in_hand", source: "Ontario Vital Records / FHL film #1845869", fileUrl: "", fileName: "18840109WALLACE_Bruce.PDF", notes: "Scanned copy from FamilySearch/Archives of Ontario. May need certified copy from Archives of Ontario for IRCC.", addedBy: "Kevin", addedDate: "2026-03-14" },
    { id: "doc_bruce_death", personId: "bruce_wallace", type: "Death Certificate", description: "Michigan death certificate, State File #17318718", status: "in_hand", source: "Michigan Dept. of Health", fileUrl: "", fileName: "1940_05_30_Bruce_WALLACE_Death.jpeg", notes: "Confirms Beachville Ontario birthplace, parents Alexander Wallace & Louise Cook.", addedBy: "Kevin", addedDate: "2026-03-14" },
    { id: "doc_gen1_birth", personId: "gen1_unknown", type: "Birth Certificate", description: "Birth certificate for Bruce's child (Janet's parent)", status: "missing", source: "Michigan Vital Records — need to identify person first", fileUrl: "", fileName: "", notes: "BLOCKED: Need to identify Gen 1 person first.", addedBy: "Kevin", addedDate: "2026-03-14" },
    { id: "doc_janet_birth", personId: "janet_wallace", type: "Birth Certificate", description: "Janet Wallace birth certificate", status: "missing", source: "Michigan Vital Records", fileUrl: "", fileName: "", notes: "Need approximate year and county.", addedBy: "Kevin", addedDate: "2026-03-14" },
    { id: "doc_janet_marriage", personId: "janet_wallace", type: "Marriage Certificate", description: "Janet Wallace → Garety marriage certificate", status: "missing", source: "Michigan Vital Records or Saginaw County Clerk", fileUrl: "", fileName: "", notes: "Proves name change from Wallace to Garety.", addedBy: "Kevin", addedDate: "2026-03-14" },
    { id: "doc_ann_birth", personId: "ann_garety", type: "Birth Certificate", description: "Ann Garety birth certificate", status: "identified", source: "Michigan Vital Records", fileUrl: "", fileName: "", notes: "Born 1954. Need to confirm county and order ($34).", addedBy: "Kevin", addedDate: "2026-03-14" },
    { id: "doc_ann_marriage", personId: "ann_garety", type: "Marriage Certificate", description: "Ann Garety → Hyde marriage certificate, 1973, Caro MI", status: "identified", source: "Tuscola County Clerk", fileUrl: "", fileName: "", notes: "Married 1973, Caro, Michigan. Proves name change Garety → Hyde.", addedBy: "Kevin", addedDate: "2026-03-14" },
    { id: "doc_kevin_birth", personId: "kevin_hyde", type: "Birth Certificate", description: "Kevin Hyde birth certificate", status: "missing", source: "State vital records where born", fileUrl: "", fileName: "", notes: "Order certified copy with parental information.", addedBy: "Kevin", addedDate: "2026-03-14" },
  ],
  activityLog: [{ date: "2026-03-14", user: "Kevin", action: "Created family hub with initial records from Bruce Wallace Ontario birth reg. and Michigan death cert." }],
};

// ── Helpers ────────────────────────────────────────────────────────
function getChain(members, personId) {
  const chain = []; let cur = personId; let i = 0;
  while (cur && i < 20) { const p = members.find((m) => m.id === cur); if (!p) break; chain.unshift(p); cur = p.parentId; i++; }
  return chain;
}

// ── Styles ─────────────────────────────────────────────────────────
const S = {
  input: { width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontFamily: sans, color: C.text, background: C.bg, outline: "none", boxSizing: "border-box" },
  textarea: { width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontFamily: sans, color: C.text, background: C.bg, outline: "none", boxSizing: "border-box", minHeight: 80, resize: "vertical" },
  select: { width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontFamily: sans, color: C.text, background: C.bg, outline: "none", cursor: "pointer" },
  label: { fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4, display: "block", letterSpacing: "0.4px", textTransform: "uppercase" },
  fg: { marginBottom: 14 },
  badge: (bg, fg) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: bg, color: fg, letterSpacing: "0.3px", textTransform: "uppercase" }),
  btn: (v = "primary") => ({ padding: "10px 20px", borderRadius: 6, fontSize: 13, fontWeight: 600, fontFamily: sans, cursor: "pointer", border: v === "primary" ? "none" : `1px solid ${C.border}`, background: v === "primary" ? C.accent : C.card, color: v === "primary" ? "#fff" : C.text, transition: "all 0.15s", letterSpacing: "0.3px" }),
};

// ── Small components ───────────────────────────────────────────────
function StatusBadge({ status }) { const s = STATUS.find((o) => o.value === status) || STATUS[0]; return <span style={S.badge(s.bg, s.fg)}>{s.label}</span>; }

function GenLabel({ gen, isMe, isAnchor }) {
  const colors = ["#C41E3A", "#1A4B6E", "#2D6A4F", "#8B6914", "#6B3FA0", "#4A6741", "#8B4513"];
  const bgs = ["#FDEDEF", "#E8F0F6", "#E8F5EE", "#FFF8E1", "#F3EDF7", "#E8F5EE", "#FFF5F0"];
  let label = `Gen ${gen}`; if (isAnchor) label = "Anchor"; if (isMe) label = "YOU";
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", marginRight: 8, background: isMe ? C.maple : (bgs[gen] || bgs[4]), color: isMe ? "#fff" : (colors[gen] || colors[4]) }}>{label}</span>;
}

function MeBanner({ person, onClear }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${C.meBg} 0%, #FFF0F2 100%)`, border: `1px solid ${C.meBorder}`, borderRadius: 8, padding: "14px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.maple, marginBottom: 2 }}>Your Application View</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Viewing as: <strong>{person.name}</strong></div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Showing your direct line of descent to Bruce Wallace.</div>
      </div>
      <button onClick={onClear} style={{ ...S.btn("secondary"), fontSize: 11, padding: "6px 14px" }}>Change / Clear</button>
    </div>
  );
}

function SetMePrompt({ members, allMembers, onSelect, onAddAndSelect }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", parentId: "", birthDate: "", birthPlace: "" });
  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div style={{ background: C.blueLight, border: `1px solid #B8D4E8`, borderRadius: 8, padding: 20, marginBottom: 20, textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.blue, marginBottom: 6 }}>Who are you?</div>
      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 14, lineHeight: 1.5 }}>Select yourself to see your personal chain of descent and application progress. This is saved only in your browser — it won't affect anyone else's view.</div>

      {members.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 }}>
          {members.map((m) => (
            <button key={m.id} onClick={() => onSelect(m.id)} style={{ padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, fontFamily: sans, cursor: "pointer", border: `1px solid ${C.border}`, background: C.card, color: C.text, transition: "all 0.15s" }}>{m.name}</button>
          ))}
        </div>
      )}

      {!adding ? (
        <div>
          <div style={{ height: 1, background: "#B8D4E8", margin: "12px 40px" }} />
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 10, marginTop: 12 }}>
            {members.length > 0 ? "Not listed above?" : "No family members have been added at your generation yet."}
          </div>
          <button onClick={() => setAdding(true)} style={{ ...S.btn("primary"), padding: "10px 24px" }}>
            + Add myself to the family tree
          </button>
        </div>
      ) : (
        <div style={{ background: C.card, borderRadius: 8, padding: 20, marginTop: 12, textAlign: "left", border: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, marginBottom: 14, color: C.text }}>Add yourself</div>
          <div style={S.fg}>
            <label style={S.label}>Your Full Name</label>
            <input style={S.input} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Sarah Hyde" />
          </div>
          <div style={S.fg}>
            <label style={S.label}>Your Parent (in the descent chain)</label>
            <select style={S.select} value={form.parentId} onChange={(e) => set("parentId", e.target.value)}>
              <option value="">— Select your parent —</option>
              {allMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <div style={{ fontSize: 11, color: C.textLight, marginTop: 4 }}>Which person in the tree is your parent? This links you into the Canadian descent chain.</div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ ...S.fg, flex: 1 }}>
              <label style={S.label}>Birth Date</label>
              <input style={S.input} value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} placeholder="e.g. 1985" />
            </div>
            <div style={{ ...S.fg, flex: 1 }}>
              <label style={S.label}>Birth Place</label>
              <input style={S.input} value={form.birthPlace} onChange={(e) => set("birthPlace", e.target.value)} placeholder="e.g. Saginaw, MI" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button style={S.btn("secondary")} onClick={() => setAdding(false)}>Cancel</button>
            <button style={S.btn("primary")} onClick={() => {
              if (!form.name.trim() || !form.parentId) return;
              onAddAndSelect({ ...form, id: "person_" + Date.now(), parentId: form.parentId, deathDate: "", deathPlace: "", father: "", mother: "", spouse: "", notes: "" });
            }}>Add & Continue</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressSummary({ documents, label }) {
  const total = documents.length; if (total === 0) return null;
  const inHand = documents.filter((d) => d.status === "in_hand").length;
  const requested = documents.filter((d) => d.status === "requested").length;
  const identified = documents.filter((d) => d.status === "identified").length;
  return (
    <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontFamily: serif, fontSize: 16, fontWeight: 700 }}>{label || "Document Progress"}</span>
        <span style={{ fontSize: 24, fontWeight: 800, color: C.accent, fontFamily: serif }}>{inHand}/{total}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: C.borderLight, overflow: "hidden" }}>
        <div style={{ display: "flex", height: "100%" }}>
          <div style={{ width: `${(inHand / total) * 100}%`, background: C.green, transition: "width 0.4s" }} />
          <div style={{ width: `${(requested / total) * 100}%`, background: C.blue, transition: "width 0.4s" }} />
          <div style={{ width: `${(identified / total) * 100}%`, background: "#C9A834", transition: "width 0.4s" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
        {[{ n: inHand, l: "In Hand", c: C.green }, { n: requested, l: "Requested", c: C.blue }, { n: identified, l: "Identified", c: "#C9A834" }, { n: total - inHand - requested - identified, l: "Missing", c: "#C41E3A" }].map((s) => (
          <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textMuted }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: s.c }} /><span style={{ fontWeight: 600 }}>{s.n}</span> {s.l}</div>
        ))}
      </div>
    </div>
  );
}

// ── Person Card ────────────────────────────────────────────────────
function PersonCard({ person, documents, gen, isMe, isInChain, onEdit, onEditDoc, onAddDoc, onSetMe }) {
  const [open, setOpen] = useState(false);
  const pDocs = documents.filter((d) => d.personId === person.id);
  const allGood = pDocs.length > 0 && pDocs.every((d) => d.status === "in_hand");
  const hasMissing = pDocs.some((d) => d.status === "missing");
  const bColor = isMe ? C.maple : allGood ? C.green : hasMissing ? C.maple : C.border;

  return (
    <div style={{ background: isMe ? C.meBg : isInChain ? "#FAFCFF" : C.card, borderRadius: 8, border: `1px solid ${isMe ? C.meBorder : C.border}`, borderLeft: `3px solid ${bColor}`, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }} onClick={() => setOpen(!open)}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            {gen !== undefined && <GenLabel gen={gen} isMe={isMe} isAnchor={person.isAnchor} />}
            <span style={{ fontFamily: serif, fontSize: 17, fontWeight: 700 }}>{person.name}</span>
            {isMe && <span style={{ fontSize: 11, color: C.maple, fontWeight: 600 }}>(You)</span>}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{person.birthDate && `b. ${person.birthDate}`}{person.birthDate && person.birthPlace && " · "}{person.birthPlace}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 11, color: C.textMuted }}>{pDocs.filter((d) => d.status === "in_hand").length}/{pDocs.length} docs</div>
          <span style={{ fontSize: 18, color: C.textLight, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${C.borderLight}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", marginTop: 16, marginBottom: 16 }}>
            {[["Birth Date", person.birthDate], ["Birth Place", person.birthPlace], ["Death Date", person.deathDate], ["Death Place", person.deathPlace], ["Father", person.father], ["Mother", person.mother], ["Spouse", person.spouse]].filter(([, v]) => v).map(([l, v]) => (
              <div key={l} style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}><span style={{ fontWeight: 600, color: C.text, marginRight: 4 }}>{l}:</span>{v}</div>
            ))}
          </div>
          {person.notes && <div style={{ background: C.bg, padding: 12, borderRadius: 6, fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 16, borderLeft: `3px solid ${C.border}` }}>{person.notes}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <button style={S.btn("secondary")} onClick={() => onEdit(person)}>Edit Details</button>
            {!isMe && !person.isAnchor && gen >= 3 && <button onClick={() => onSetMe(person.id)} style={{ ...S.btn("secondary"), background: C.meBg, borderColor: C.meBorder, color: C.maple }}>This is me</button>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Documents ({pDocs.length})</div>
          {pDocs.map((doc) => (
            <div key={doc.id} style={{ padding: "10px 12px", background: C.bg, borderRadius: 6, marginBottom: 6, border: `1px solid ${C.borderLight}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><StatusBadge status={doc.status} /><span style={{ fontSize: 13, fontWeight: 600 }}>{doc.type}</span></div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{doc.description}</div>
                  {doc.source && <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>Source: {doc.source}</div>}
                  {doc.notes && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, fontStyle: "italic" }}>{doc.notes}</div>}
                </div>
                <button style={{ ...S.btn("secondary"), padding: "6px 12px", fontSize: 11, marginLeft: 12, flexShrink: 0 }} onClick={() => onEditDoc(doc)}>Update</button>
              </div>
              {doc.fileUrl ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "8px 10px", background: C.greenLight, borderRadius: 5, border: `1px solid ${C.greenBadge}` }}>
                  <span style={{ fontSize: 12, color: C.green, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.fileName || "Linked document"}</span>
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" style={{ padding: "4px 12px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: C.green, color: "#fff", textDecoration: "none", fontFamily: sans }}>View / Download</a>
                </div>
              ) : doc.fileName ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "8px 10px", background: C.yellowBadge, borderRadius: 5, border: "1px solid #F0E0A0" }}>
                  <span style={{ fontSize: 12, color: "#856404", flex: 1 }}>{doc.fileName} — <em>no link added yet</em></span>
                </div>
              ) : null}
            </div>
          ))}
          <button style={{ ...S.btn("secondary"), marginTop: 8, fontSize: 12 }} onClick={() => onAddDoc(person.id)}>+ Add Document</button>
        </div>
      )}
    </div>
  );
}

// ── Modals & Forms ─────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }} onClick={onClose}>
      <div style={{ background: C.card, borderRadius: 10, width: "100%", maxWidth: 540, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: serif, fontSize: 18, fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.textMuted }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function EditPersonForm({ person, members, onSave, onCancel }) {
  const [form, setForm] = useState({ ...person });
  const set = (k, v) => setForm({ ...form, [k]: v });
  const possibleParents = members.filter((m) => m.id !== person.id);
  return (
    <div>
      <div style={S.fg}>
        <label style={S.label}>Parent in Descent Chain</label>
        <select style={S.select} value={form.parentId || ""} onChange={(e) => set("parentId", e.target.value || null)}>
          <option value="">— None (this is the anchor) —</option>
          {possibleParents.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div style={{ fontSize: 11, color: C.textLight, marginTop: 4 }}>Who is this person's parent in the Canadian descent line?</div>
      </div>
      {[["name", "Full Name"], ["birthDate", "Birth Date"], ["birthPlace", "Birth Place"], ["deathDate", "Death Date"], ["deathPlace", "Death Place"], ["father", "Father"], ["mother", "Mother"], ["spouse", "Spouse"]].map(([k, l]) => (
        <div key={k} style={S.fg}><label style={S.label}>{l}</label><input style={S.input} value={form[k] || ""} onChange={(e) => set(k, e.target.value)} /></div>
      ))}
      <div style={S.fg}><label style={S.label}>Notes</label><textarea style={S.textarea} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} /></div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button style={S.btn("secondary")} onClick={onCancel}>Cancel</button>
        <button style={S.btn("primary")} onClick={() => onSave(form)}>Save Changes</button>
      </div>
    </div>
  );
}

function AddPersonForm({ members, onSave, onCancel }) {
  const [form, setForm] = useState({ name: "", parentId: "", birthDate: "", birthPlace: "", deathDate: "", deathPlace: "", father: "", mother: "", spouse: "", notes: "" });
  const set = (k, v) => setForm({ ...form, [k]: v });
  return (
    <div>
      <div style={S.fg}><label style={S.label}>Full Name</label><input style={S.input} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Sarah Hyde" /></div>
      <div style={S.fg}>
        <label style={S.label}>Parent in Descent Chain</label>
        <select style={S.select} value={form.parentId} onChange={(e) => set("parentId", e.target.value)}>
          <option value="">— Select parent —</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div style={{ fontSize: 11, color: C.textLight, marginTop: 4 }}>Who is this person's parent in the Canadian descent chain? (e.g. for Kevin's sister, select "Ann Garety")</div>
      </div>
      {[["birthDate", "Birth Date"], ["birthPlace", "Birth Place"], ["father", "Father"], ["mother", "Mother"], ["spouse", "Spouse"]].map(([k, l]) => (
        <div key={k} style={S.fg}><label style={S.label}>{l}</label><input style={S.input} value={form[k]} onChange={(e) => set(k, e.target.value)} /></div>
      ))}
      <div style={S.fg}><label style={S.label}>Notes</label><textarea style={S.textarea} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button style={S.btn("secondary")} onClick={onCancel}>Cancel</button>
        <button style={S.btn("primary")} onClick={() => { if (!form.name.trim()) return; onSave({ ...form, id: "person_" + Date.now(), parentId: form.parentId || null }); }}>Add Person</button>
      </div>
    </div>
  );
}

function SharingInfoBox() {
  return (
    <div style={{ background: "#FFF8E8", border: "1px solid #F0DCA0", borderLeft: "4px solid #C9A834", borderRadius: 6, padding: "14px 16px", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ fontSize: 13, fontWeight: 700, color: "#6B5300" }}>Sharing a document? Check link permissions</span></div>
      <div style={{ fontSize: 12, color: "#7A6520", lineHeight: 1.7 }}>For everyone to access the file, set the link to <strong>"Anyone with the link can view"</strong>:</div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        {[["OneDrive", "Share → \"Anyone with the link\" → \"Can view\" → Copy link"], ["Google Drive", "Share → General access → \"Anyone with the link\" → Viewer → Copy link"], ["Dropbox", "Share → Link settings → \"Anyone with this link\" → Copy link"], ["iCloud", "Share → \"Anyone with the link\" → Copy link"]].map(([svc, steps]) => (
          <div key={svc} style={{ fontSize: 11, color: "#7A6520", background: "rgba(255,255,255,0.6)", padding: "6px 10px", borderRadius: 4 }}><strong>{svc}:</strong> {steps}</div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#9A8540", marginTop: 10, fontStyle: "italic" }}>Tip: Test the link in a private/incognito window to verify it works without sign-in.</div>
    </div>
  );
}

function EditDocForm({ doc, onSave, onCancel, isNew }) {
  const [form, setForm] = useState({ ...doc, fileUrl: doc.fileUrl || "" });
  const set = (k, v) => setForm({ ...form, [k]: v });
  return (
    <div>
      {isNew && <SharingInfoBox />}
      <div style={S.fg}><label style={S.label}>Document Type</label><select style={S.select} value={form.type} onChange={(e) => set("type", e.target.value)}>{DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
      <div style={S.fg}><label style={S.label}>Description</label><input style={S.input} value={form.description || ""} onChange={(e) => set("description", e.target.value)} placeholder="e.g. Janet Wallace birth certificate, Saginaw County" /></div>
      <div style={S.fg}>
        <label style={S.label}>Status</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STATUS.map((s) => (<button key={s.value} onClick={() => set("status", s.value)} style={{ ...S.badge(form.status === s.value ? s.bg : C.grayBadge, form.status === s.value ? s.fg : C.textMuted), cursor: "pointer", border: form.status === s.value ? `2px solid ${s.fg}` : "2px solid transparent", padding: "6px 14px", fontSize: 12 }}>{s.label}</button>))}
        </div>
      </div>
      <div style={{ background: form.fileUrl ? C.greenLight : C.bg, border: `1px solid ${form.fileUrl ? C.greenBadge : C.border}`, borderRadius: 8, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><span style={{ fontSize: 16 }}>{form.fileUrl ? "✅" : "📄"}</span><label style={{ ...S.label, margin: 0 }}>Document Link</label></div>
        <input style={{ ...S.input, background: "#fff", borderColor: form.fileUrl ? C.green : C.border, fontSize: 13 }} value={form.fileUrl || ""} onChange={(e) => set("fileUrl", e.target.value)} placeholder="Paste a OneDrive, Google Drive, Dropbox, or other share link…" />
        {form.fileUrl && <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}><a href={form.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.green, fontWeight: 600, textDecoration: "none" }}>Test link</a><span style={{ fontSize: 11, color: C.textLight }}>— verify access</span></div>}
        <div style={S.fg}><label style={{ ...S.label, marginTop: 10 }}>File Name (optional label)</label><input style={S.input} value={form.fileName || ""} onChange={(e) => set("fileName", e.target.value)} placeholder="e.g. Bruce_Wallace_Birth_Ontario.pdf" /></div>
        {!isNew && !form.fileUrl && <details style={{ marginTop: 8 }}><summary style={{ fontSize: 12, color: C.blue, cursor: "pointer", fontWeight: 600 }}>How to set sharing permissions</summary><div style={{ marginTop: 8 }}><SharingInfoBox /></div></details>}
      </div>
      <div style={S.fg}><label style={S.label}>Source / Where to Order</label><input style={S.input} value={form.source || ""} onChange={(e) => set("source", e.target.value)} /></div>
      <div style={S.fg}><label style={S.label}>Notes</label><textarea style={S.textarea} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} /></div>
      <div style={S.fg}><label style={S.label}>Your Name</label><input style={S.input} value={form.addedBy || ""} onChange={(e) => set("addedBy", e.target.value)} placeholder="So the family knows who added this" /></div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button style={S.btn("secondary")} onClick={onCancel}>Cancel</button>
        <button style={S.btn("primary")} onClick={() => onSave({ ...form, addedDate: new Date().toISOString().split("T")[0] })}>{isNew ? "Add Document" : "Save Changes"}</button>
      </div>
    </div>
  );
}

// ── Activity & Resources ───────────────────────────────────────────
function ActivityTab({ log, onAdd }) {
  const [note, setNote] = useState(""); const [author, setAuthor] = useState("");
  return (
    <div>
      <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, fontFamily: serif }}>Add a Note</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input style={{ ...S.input, flex: "0 0 120px", minWidth: 100 }} placeholder="Your name" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <input style={{ ...S.input, flex: 1, minWidth: 200 }} placeholder="What did you find, do, or learn?" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && note.trim() && author.trim()) { onAdd(author, note); setNote(""); } }} />
          <button style={S.btn("primary")} onClick={() => { if (note.trim() && author.trim()) { onAdd(author, note); setNote(""); } }}>Post</button>
        </div>
      </div>
      {[...log].reverse().map((e, i) => (
        <div key={i} style={{ padding: "12px 16px", borderLeft: `3px solid ${i === 0 ? C.accent : C.borderLight}`, marginBottom: 8, background: i === 0 ? C.accentPale : C.card, borderRadius: "0 6px 6px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}><span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{e.user}</span><span style={{ fontSize: 11, color: C.textLight }}>{e.date}</span></div>
          <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>{e.action}</div>
        </div>
      ))}
    </div>
  );
}

function ResourcesTab({ data, onImport }) {
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);

  const handleExport = () => {
    const exportData = { ...data, _exportedAt: new Date().toISOString(), _version: "1.0", _source: "wallace-hyde-citizenship-hub" };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `citizenship-hub-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.familyMembers || !parsed.documents) { setImportStatus("error"); return; }
        onImport(parsed);
        setImportStatus("success");
      } catch { setImportStatus("error"); }
    };
    reader.readAsText(file);
  };

  const handleTextImport = () => {
    try {
      const parsed = JSON.parse(importText);
      if (!parsed.familyMembers || !parsed.documents) { setImportStatus("error"); return; }
      onImport(parsed);
      setImportStatus("success");
      setImportText("");
    } catch { setImportStatus("error"); }
  };
  const secs = [
    { t: "Canadian Government (IRCC)", l: [["Bill C-3 overview", "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/act-changes/rules-2025.html"], ["Check if you may be a citizen", "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/become-canadian-citizen/eligibility/already-citizen.html"], ["Apply for citizenship certificate", "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship/proof-citizenship/apply.html"], ["CIT 0001 — Application form", "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/application-citizenship-certificate-adults-minors.html"], ["CIT 0014 — Document checklist", "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/cit0014.html"], ["Paper application guide", "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/guide-0001-application-citizenship-certificate-adults-minors-proof-citizenship-section-3.html"], ["Processing times", "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html"]] },
    { t: "Ontario Vital Records", l: [["Archives of Ontario (pre-1919)", "https://www.archives.gov.on.ca/topic/birth-marriage-and-death/"], ["ServiceOntario (1920+)", "https://www.ontario.ca/page/get-or-replace-ontario-birth-certificate"], ["FamilySearch Ontario (free)", "https://www.familysearch.org/en/wiki/Ontario_County,_Ontario,_Canada_Genealogy"]] },
    { t: "Michigan Vital Records", l: [["Michigan MDHHS", "https://www.michigan.gov/mdhhs/doing-business/vitalrecords"], ["VitalChek (online)", "https://www.vitalchek.com"], ["CDC — all states", "https://www.cdc.gov/nchs/w2w/index.htm"]] },
    { t: "Helpful Guides", l: [["Marin Immigration Law", "https://www.marinimmigrationlaw.ca/blog/bill-c-3-americans-with-canadian-ancestry---citizenship-by-descent-expanded"], ["Serotte Law", "https://serottelaw.com/waking-up-canadian/"], ["Immigration.ca", "https://immigration.ca/claiming-canadian-citizenship-by-descent-under-canadas-new-citizenship-act-bill-c-3/"]] },
  ];
  return (
    <div>
      {secs.map((s) => (<div key={s.t} style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}><div style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, marginBottom: 12, color: C.blue }}>{s.t}</div>{s.l.map(([n, u]) => (<div key={u} style={{ marginBottom: 8 }}><a href={u} target="_blank" rel="noopener noreferrer" style={{ color: C.accent, fontSize: 13, textDecoration: "none", fontWeight: 500 }}>{n}</a></div>))}</div>))}
      <div style={{ background: C.accentPale, borderRadius: 8, border: `1px solid ${C.border}`, padding: 20 }}>
        <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Key Reminders</div>
        <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.8 }}><strong>Apply on paper</strong> — online portal doesn't handle multigenerational Bill C-3 claims well.<br /><strong>IRCC fee:</strong> $75 CAD per applicant.<br /><strong>Submit COLOR photocopies</strong> — never originals.<br /><strong>Each applicant needs their own application</strong> — but bundle family apps in one package with a cover letter.<br /><strong>Mail to:</strong> Case Processing Centre – Sydney, P.O. Box 7000, Sydney, NS B1P 6V6, Canada.</div>
      </div>

      <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, padding: 20, marginTop: 16 }}>
        <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 700, marginBottom: 4, color: C.text }}>Backup & Restore</div>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
          Export a full snapshot of all family data, documents, and activity. Keep this file safe — if anything ever goes wrong, you can restore from it.
        </div>

        <button onClick={handleExport} style={{ ...S.btn("primary"), marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          Export Full Backup (JSON)
        </button>

        <div style={{ borderTop: `1px solid ${C.borderLight}`, paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.4px" }}>Restore from backup</div>
          <div style={{ fontSize: 12, color: C.textLight, marginBottom: 12, lineHeight: 1.5 }}>
            This will <strong>replace all current data</strong> with the backup file. Make sure you export a current backup first if you want to preserve recent changes.
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileImport}
              style={{ display: "none" }}
            />
            <button onClick={() => fileInputRef.current?.click()} style={{ ...S.btn("secondary"), fontSize: 12 }}>
              Choose backup file…
            </button>
            <span style={{ fontSize: 11, color: C.textLight }}>or paste JSON below</span>
          </div>

          <textarea
            style={{ ...S.textarea, minHeight: 60, fontSize: 12, fontFamily: "monospace" }}
            value={importText}
            onChange={(e) => { setImportText(e.target.value); setImportStatus(null); }}
            placeholder='Paste exported JSON here…'
          />
          {importText.trim() && (
            <button onClick={handleTextImport} style={{ ...S.btn("secondary"), marginTop: 8, fontSize: 12 }}>
              Restore from pasted JSON
            </button>
          )}

          {importStatus === "success" && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: C.greenBadge, borderRadius: 6, fontSize: 12, color: C.green, fontWeight: 600 }}>
              Data restored successfully. All family data has been updated.
            </div>
          )}
          {importStatus === "error" && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: C.redBadge, borderRadius: 6, fontSize: 12, color: "#721C24", fontWeight: 600 }}>
              Invalid backup file. Make sure it's a JSON file exported from this hub (must contain familyMembers and documents).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Apply Tab ──────────────────────────────────────────────────────
function ApplyTab({ myChain, myChainDocs, mePerson }) {
  const total = myChainDocs.length;
  const inHand = myChainDocs.filter((d) => d.status === "in_hand").length;
  const missing = myChainDocs.filter((d) => d.status === "missing").length;
  const allReady = total > 0 && inHand === total;
  const hasMissing = missing > 0;

  const readinessBg = allReady ? C.greenLight : hasMissing ? C.accentPale : C.yellowBadge;
  const readinessBorder = allReady ? C.greenBadge : hasMissing ? C.maple : "#F0DCA0";
  const readinessColor = allReady ? C.green : hasMissing ? C.maple : "#856404";
  const readinessText = allReady
    ? "All documents are in hand. You're ready to apply!"
    : hasMissing
    ? `${missing} document${missing > 1 ? "s" : ""} still missing. Resolve these before submitting.`
    : "Some documents are in progress. Almost there!";

  const steps = [
    {
      num: 1, title: "Gather all chain documents",
      done: allReady,
      content: "Collect certified copies of birth, death, and marriage certificates for every person in your line of descent — from Bruce Wallace down to you. See the checklist below."
    },
    {
      num: 2, title: "Complete form CIT 0001",
      done: false,
      content: "Download and fill out the Application for a Citizenship Certificate. Each applicant submits their own form.",
      link: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/application-citizenship-certificate-adults-minors.html",
      linkLabel: "Download CIT 0001"
    },
    {
      num: 3, title: "Complete form CIT 0014",
      done: false,
      content: "Use the Document Checklist to verify you have everything IRCC requires.",
      link: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/cit0014.html",
      linkLabel: "Download CIT 0014"
    },
    {
      num: 4, title: "Get citizenship photos taken",
      done: false,
      content: "Two identical photos, 50 mm × 70 mm, taken by a commercial photographer within the last 6 months. White or light background, full face, no glasses. Photographer's stamp on back of one; guarantor's signature on back of the other."
    },
    {
      num: 5, title: "Pay the $75 CAD fee",
      done: false,
      content: "Per applicant. Pay by credit card (Visa/MC/Amex) using the payment form in the application kit, or by certified cheque / money order payable to the Receiver General for Canada. Do not send cash."
    },
    {
      num: 6, title: "Write a cover letter",
      done: false,
      content: `Explain your multigenerational claim under Bill C-3. Lay out the descent chain clearly:\n\n${myChain.map((p, i) => `  ${i === 0 ? "Anchor" : `Gen ${i}`}: ${p.name}${p.birthDate ? ` (b. ${p.birthDate})` : ""}${p.birthPlace ? `, ${p.birthPlace}` : ""}`).join("\n")}\n\nInclude a document index listing every enclosed item with tab labels (Tab A, Tab B, etc.).`
    },
    {
      num: 7, title: "Prepare COLOR photocopies",
      done: false,
      content: "Submit color photocopies of all supporting documents. Never send originals — IRCC does not return them. Organize with labeled tabs matching your cover letter index."
    },
    {
      num: 8, title: "Mail the complete package",
      done: false,
      content: "Bundle all family applications together with one cover letter. Send via tracked mail (e.g. USPS Priority International or Canada Post Xpresspost).",
      address: true
    },
  ];

  return (
    <div>
      <style>{`
        @media print {
          body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          [data-no-print] { display: none !important; }
        }
      `}</style>

      {/* Print button */}
      <div data-no-print style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => window.print()} style={{ ...S.btn("secondary"), display: "flex", alignItems: "center", gap: 8 }}>
          Print this guide
        </button>
      </div>

      {/* Readiness banner */}
      <div style={{ background: readinessBg, border: `1px solid ${readinessBorder}`, borderLeft: `4px solid ${readinessColor}`, borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: readinessColor, fontFamily: serif, marginBottom: 4 }}>
          Application Readiness: {mePerson.name}
        </div>
        <div style={{ fontSize: 13, color: readinessColor, lineHeight: 1.5 }}>{readinessText}</div>
      </div>

      {/* Progress bar */}
      <ProgressSummary documents={myChainDocs} label="Your Document Progress" />

      {/* Per-person document checklist */}
      <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
        <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Document Checklist by Person</div>
        {myChain.map((person, genIdx) => {
          const pDocs = myChainDocs.filter((d) => d.personId === person.id);
          const personReady = pDocs.length > 0 && pDocs.every((d) => d.status === "in_hand");
          return (
            <div key={person.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: genIdx < myChain.length - 1 ? `1px solid ${C.borderLight}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <GenLabel gen={genIdx} isMe={person.id === mePerson.id} isAnchor={person.isAnchor} />
                <span style={{ fontFamily: serif, fontSize: 15, fontWeight: 700 }}>{person.name}</span>
                {personReady && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>All docs in hand</span>}
              </div>
              {pDocs.length === 0 ? (
                <div style={{ fontSize: 13, color: C.textLight, fontStyle: "italic", marginLeft: 8 }}>No documents tracked yet</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginLeft: 8 }}>
                  {pDocs.map((doc) => (
                    <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.textMuted }}>
                      <StatusBadge status={doc.status} />
                      <span style={{ fontWeight: 500 }}>{doc.type}</span>
                      {doc.description && <span style={{ color: C.textLight }}>— {doc.description}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step-by-step submission guide */}
      <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Step-by-Step Submission Guide</div>
      {steps.map((step) => (
        <div key={step.num} style={{ background: step.done ? C.greenLight : C.card, borderRadius: 8, border: `1px solid ${step.done ? C.greenBadge : C.border}`, padding: "16px 20px", marginBottom: 12, borderLeft: `3px solid ${step.done ? C.green : C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: step.done ? C.green : C.bg, color: step.done ? "#fff" : C.textMuted, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {step.done ? "✓" : step.num}
            </span>
            <span style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, color: step.done ? C.green : C.text }}>{step.title}</span>
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, marginLeft: 38, whiteSpace: "pre-line" }}>{step.content}</div>
          {step.link && (
            <div style={{ marginLeft: 38, marginTop: 8 }}>
              <a href={step.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.accent, fontWeight: 600, textDecoration: "none" }}>{step.linkLabel}</a>
            </div>
          )}
          {step.address && (
            <div style={{ marginLeft: 38, marginTop: 10, background: C.bg, borderRadius: 6, padding: "12px 16px", border: `1px solid ${C.borderLight}`, fontSize: 13, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>Mailing Address:</div>
              <div style={{ color: C.textMuted }}>
                Case Processing Centre – Sydney<br />
                IRCC<br />
                PO Box 7000<br />
                Sydney, NS B1P 6V6<br />
                Canada
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Helpful links */}
      <div style={{ background: C.blueLight, borderRadius: 8, padding: 16, marginTop: 20, border: `1px solid #B8D4E8`, fontSize: 13, color: C.blue, lineHeight: 1.7 }}>
        <strong>Tip:</strong> Apply on paper — the online IRCC portal doesn't handle multigenerational Bill C-3 claims well. Bundle all family applications in one package with a single cover letter. Send via tracked mail and keep copies of everything you send.
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("chain");
  const [meId, setMeId] = useState(() => localStorage.getItem(ME_KEY) || null);
  const [modal, setModal] = useState(null);
  const saveTimeout = useRef(null);

  // Normalize data to ensure it has the expected shape
  const normalize = (d) => ({
    familyMembers: d.familyMembers || [],
    documents: d.documents || [],
    activityLog: d.activityLog || [],
    ...d,
  });

  // Load from Firestore and subscribe to real-time updates
  useEffect(() => {
    let unsubscribe;
    async function init() {
      try {
        await initAuth();
        const stored = await loadData();
        if (stored && stored.familyMembers && stored.documents) {
          setData(normalize(stored));
        } else {
          // First load or incompatible schema — seed Firestore with initial data
          await saveData(INITIAL_DATA);
          setData(INITIAL_DATA);
        }
        // Subscribe to real-time updates
        unsubscribe = subscribeToData((newData) => {
          setData(normalize(newData));
        });
      } catch (err) {
        console.error("Failed to load from Firestore:", err);
        setData(INITIAL_DATA);
      }
      setLoading(false);
    }
    init();
    return () => unsubscribe && unsubscribe();
  }, []);

  // Debounced save to Firestore
  const persist = useCallback(async (nd) => {
    setData(nd);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        await saveData(nd);
      } catch (e) {
        console.error("Save failed:", e);
      }
    }, 800);
  }, []);

  const handleSetMe = useCallback((id) => {
    setMeId(id);
    localStorage.setItem(ME_KEY, id);
    setTab("chain");
  }, []);

  const handleClearMe = useCallback(() => {
    setMeId(null);
    localStorage.removeItem(ME_KEY);
  }, []);

  const handleAddAndSelect = useCallback((person) => {
    const newData = {
      ...data,
      familyMembers: [...data.familyMembers, person],
      activityLog: [...data.activityLog, { date: new Date().toISOString().split("T")[0], user: person.name, action: `Joined the family hub and added themselves to the tree` }]
    };
    persist(newData);
    setMeId(person.id);
    localStorage.setItem(ME_KEY, person.id);
  }, [data, persist]);

  const updatePerson = useCallback((u) => {
    persist({ ...data, familyMembers: data.familyMembers.map((p) => (p.id === u.id ? u : p)), activityLog: [...data.activityLog, { date: new Date().toISOString().split("T")[0], user: "Family", action: `Updated details for ${u.name}` }] });
    setModal(null);
  }, [data, persist]);

  const addPerson = useCallback((p) => {
    persist({ ...data, familyMembers: [...data.familyMembers, p], activityLog: [...data.activityLog, { date: new Date().toISOString().split("T")[0], user: "Family", action: `Added family member: ${p.name}` }] });
    setModal(null);
  }, [data, persist]);

  const updateDoc = useCallback((u) => {
    const existingDocs = data.documents || [];
    const ex = existingDocs.find((d) => d.id === u.id);
    const nd = ex ? existingDocs.map((d) => (d.id === u.id ? u : d)) : [...existingDocs, u];
    const who = data.familyMembers.find((p) => p.id === u.personId)?.name || "unknown";
    persist({ ...data, documents: nd, activityLog: [...data.activityLog, { date: new Date().toISOString().split("T")[0], user: u.addedBy || "Family", action: `${ex ? "Updated" : "Added"} document: ${u.type} for ${who}` }] });
    setModal(null);
  }, [data, persist]);

  const addLog = useCallback((user, action) => {
    persist({ ...data, activityLog: [...data.activityLog, { date: new Date().toISOString().split("T")[0], user, action }] });
  }, [data, persist]);

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: 18, color: C.textMuted, background: C.bg }}>Loading family records…</div>;

  const mePerson = meId ? data.familyMembers.find((m) => m.id === meId) : null;
  const myChain = meId ? getChain(data.familyMembers, meId) : [];
  const myChainIds = new Set(myChain.map((p) => p.id));
  const docs = data.documents || [];
  const myChainDocs = docs.filter((d) => myChainIds.has(d.personId));

  const depthMap = {};
  const calcDepth = (id, s = 0) => { if (s > 20) return 0; if (depthMap[id] !== undefined) return depthMap[id]; const p = data.familyMembers.find((m) => m.id === id); if (!p || !p.parentId) { depthMap[id] = 0; return 0; } depthMap[id] = calcDepth(p.parentId, s + 1) + 1; return depthMap[id]; };
  data.familyMembers.forEach((m) => calcDepth(m.id));
  const sorted = [...data.familyMembers].sort((a, b) => (depthMap[a.id] || 0) - (depthMap[b.id] || 0));

  const tabs = [{ id: "chain", label: "My Chain" }, { id: "apply", label: "Apply" }, { id: "all", label: "All Family" }, { id: "activity", label: "Activity" }, { id: "resources", label: "Resources" }];

  const cp = (person, gen) => ({
    person, documents: docs, gen, isMe: person.id === meId, isInChain: myChainIds.has(person.id),
    onEdit: (p) => setModal({ type: "editPerson", payload: p }),
    onEditDoc: (d) => setModal({ type: "editDoc", payload: d }),
    onAddDoc: (pid) => setModal({ type: "addDoc", payload: { id: "doc_" + Date.now(), personId: pid, type: "Birth Certificate", description: "", status: "missing", source: "", fileUrl: "", fileName: "", notes: "", addedBy: "", addedDate: new Date().toISOString().split("T")[0] } }),
    onSetMe: handleSetMe,
  });

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${C.bg} 0%, #F5F3ED 100%)`, fontFamily: sans, color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ background: "linear-gradient(135deg, #1a1a18 0%, #2C2417 60%)", padding: "28px 32px 24px", borderBottom: `3px solid ${C.maple}` }}>
        <h1 style={{ fontFamily: serif, fontSize: 28, fontWeight: 700, color: "#FAFAF7", margin: 0 }}><span style={{ color: C.maple, fontSize: 22, marginRight: 10 }}>🍁</span>{FAMILY_NAME} Citizenship Hub</h1>
        <div style={{ fontFamily: sans, fontSize: 13, color: "#A09888", marginTop: 4, letterSpacing: "0.5px", textTransform: "uppercase" }}>Canadian Citizenship by Descent · Bill C-3 · Shared Family Workspace</div>
      </div>
      <div style={{ display: "flex", gap: 0, background: C.card, borderBottom: `1px solid ${C.border}`, padding: "0 16px", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflowX: "auto" }}>
        {tabs.map((t) => (<button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "14px 16px", fontSize: 13, fontWeight: tab === t.id ? 600 : 500, color: tab === t.id ? C.accent : C.textMuted, cursor: "pointer", borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent", background: "none", border: "none", borderBottomStyle: "solid", fontFamily: sans, whiteSpace: "nowrap" }}>{t.label}</button>))}
      </div>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
        {tab === "chain" && (<>
          {!meId && <SetMePrompt members={sorted.filter((m) => (depthMap[m.id] || 0) >= 3)} allMembers={sorted} onSelect={handleSetMe} onAddAndSelect={handleAddAndSelect} />}
          {mePerson && <MeBanner person={mePerson} onClear={handleClearMe} />}
          {meId && myChain.length > 0 && (<>
            <ProgressSummary documents={myChainDocs} label="Your Application Progress" />
            <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Your Line of Descent</div>
            {myChain.map((p, i) => <PersonCard key={p.id} {...cp(p, i)} />)}
            <div style={{ background: C.blueLight, borderRadius: 8, padding: 16, marginTop: 20, border: `1px solid #B8D4E8`, fontSize: 13, color: C.blue, lineHeight: 1.7 }}>
              <strong>Your chain: {myChain.length} generations</strong> from Bruce Wallace to you. Under Bill C-3, citizenship cascades retroactively for anyone born before Dec 15, 2025.
              {myChainDocs.some((d) => d.status === "missing") && <span style={{ display: "block", marginTop: 8, color: "#C41E3A", fontWeight: 600 }}>You still have documents marked "Missing" — resolve these before submitting.</span>}
            </div>
          </>)}
          {meId && myChain.length === 0 && <div style={{ textAlign: "center", padding: 40, color: C.textLight }}>Could not trace a chain to the anchor. Check parent links in "All Family" tab.</div>}
        </>)}
        {tab === "apply" && (
          meId && mePerson
            ? <ApplyTab myChain={myChain} myChainDocs={myChainDocs} mePerson={mePerson} />
            : <SetMePrompt members={sorted.filter((m) => (depthMap[m.id] || 0) >= 3)} allMembers={sorted} onSelect={handleSetMe} onAddAndSelect={handleAddAndSelect} />
        )}
        {tab === "all" && (<>
          <ProgressSummary documents={docs} label="All Family Documents" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 700 }}>Complete Family Tree</div>
            <button style={S.btn("secondary")} onClick={() => setModal({ type: "addPerson" })}>+ Add Person</button>
          </div>
          {sorted.map((p) => <PersonCard key={p.id} {...cp(p, depthMap[p.id] || 0)} />)}
        </>)}
        {tab === "activity" && <ActivityTab log={data.activityLog} onAdd={addLog} />}
        {tab === "resources" && <ResourcesTab data={data} onImport={(imported) => { const restored = { familyMembers: imported.familyMembers, documents: imported.documents, activityLog: [...(imported.activityLog || []), { date: new Date().toISOString().split("T")[0], user: "System", action: "Data restored from backup" }] }; persist(restored); }} />}
      </div>
      {modal?.type === "editPerson" && <Modal title="Edit Family Member" onClose={() => setModal(null)}><EditPersonForm person={modal.payload} members={data.familyMembers} onSave={updatePerson} onCancel={() => setModal(null)} /></Modal>}
      {modal?.type === "addPerson" && <Modal title="Add Family Member" onClose={() => setModal(null)}><AddPersonForm members={data.familyMembers} onSave={addPerson} onCancel={() => setModal(null)} /></Modal>}
      {modal?.type === "editDoc" && <Modal title="Update Document" onClose={() => setModal(null)}><EditDocForm doc={modal.payload} isNew={false} onSave={updateDoc} onCancel={() => setModal(null)} /></Modal>}
      {modal?.type === "addDoc" && <Modal title="Add Document" onClose={() => setModal(null)}><EditDocForm doc={modal.payload} isNew={true} onSave={updateDoc} onCancel={() => setModal(null)} /></Modal>}
    </div>
  );
}
