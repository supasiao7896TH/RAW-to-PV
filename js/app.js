'use strict';

/* ============================================================
   RAW → PV Calculator – DCS Yokogawa
   Formula: PV = SVL + (RAW% / 100) × (SVH − SVL)
   ============================================================ */

// ──────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────
const STORAGE_KEY = 'dcs_tag_library';

let tags = loadTags();
let editingId = null;

// ──────────────────────────────────────────────
// PERSISTENCE
// ──────────────────────────────────────────────
function loadTags() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTags() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
}

function nextId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ──────────────────────────────────────────────
// CORE CALCULATION
// ──────────────────────────────────────────────
function calcPV(rawPct, svh, svl) {
  return svl + (rawPct / 100) * (svh - svl);
}

// Parse SVL from text input — allows negative like -600
function parseSVL(val) {
  if (val === '' || val === null || val === undefined) return 0;
  const n = parseFloat(String(val).trim());
  return isNaN(n) ? NaN : n;
}

// ──────────────────────────────────────────────
// ± SIGN TOGGLE (for SVL on Samsung keyboard)
// ──────────────────────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-sign');
  if (!btn) return;
  const input = document.getElementById(btn.dataset.target);
  if (!input) return;
  const val = input.value.trim();
  if (val === '' || val === '-') {
    input.value = val === '-' ? '' : '-';
  } else {
    const n = parseFloat(val);
    if (!isNaN(n)) input.value = (-n).toString();
    else input.value = val.startsWith('-') ? val.slice(1) : '-' + val;
  }
  input.focus();
});

// ──────────────────────────────────────────────
// TABS
// ──────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(target).classList.add('active');
  });
});

// ──────────────────────────────────────────────
// TAG SEARCH DROPDOWN (shared helper)
// ──────────────────────────────────────────────
function setupTagSearch(inputId, dropdownId, onSelect) {
  const input    = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);

  function render(query) {
    const q = query.toLowerCase().trim();
    const filtered = tags.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );

    dropdown.innerHTML = '';

    if (filtered.length === 0) {
      dropdown.innerHTML = '<div class="dropdown-empty">ไม่พบ tag ที่ตรงกัน</div>';
    } else {
      filtered.slice(0, 20).forEach(t => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.innerHTML = `
          <span class="dropdown-tag-name">${escHtml(t.name)}</span>
          <span class="dropdown-tag-info">
            SVH: ${t.svh} / SVL: ${t.svl}<br>
            <small>${escHtml(t.unit || '')} ${t.description ? '· ' + escHtml(t.description) : ''}</small>
          </span>`;
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          onSelect(t);
          input.value = t.name;
          dropdown.classList.remove('open');
        });
        dropdown.appendChild(item);
      });
    }
    dropdown.classList.add('open');
  }

  input.addEventListener('focus', () => {
    if (tags.length > 0) render(input.value);
  });

  input.addEventListener('input', () => render(input.value));

  document.addEventListener('click', e => {
    if (!input.closest('.tag-search-wrapper').contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });
}

// ──────────────────────────────────────────────
// CALCULATOR TAB
// ──────────────────────────────────────────────
setupTagSearch('calc-tag-search', 'calc-tag-dropdown', tag => {
  document.getElementById('calc-tag-name').value = tag.name;
  document.getElementById('calc-svh').value       = tag.svh;
  document.getElementById('calc-svl').value       = tag.svl;
  document.getElementById('calc-unit').value      = tag.unit || '';
});

document.getElementById('calc-btn').addEventListener('click', runCalc);
document.getElementById('calc-raw').addEventListener('keydown', e => {
  if (e.key === 'Enter') runCalc();
});

function runCalc() {
  const rawPct   = parseFloat(document.getElementById('calc-raw').value);
  const svh      = parseFloat(document.getElementById('calc-svh').value);
  const svl      = parseSVL(document.getElementById('calc-svl').value);
  const unit     = document.getElementById('calc-unit').value.trim();
  const tagName  = document.getElementById('calc-tag-name').value.trim();

  const resultDisplay = document.getElementById('result-display');
  const resultEmpty   = document.getElementById('result-empty');

  if (isNaN(rawPct) || isNaN(svh)) {
    toast('กรุณากรอกค่า RAW% และ SVH', 'error');
    return;
  }

  if (isNaN(svl)) {
    toast('ค่า SVL ไม่ถูกต้อง (ตัวอย่าง: 0 หรือ -600)', 'error');
    return;
  }

  if (rawPct < 0 || rawPct > 100) {
    toast('ค่า RAW% ต้องอยู่ระหว่าง 0 – 100', 'error');
    return;
  }

  const pv   = calcPV(rawPct, svh, svl);
  const span = svh - svl;

  resultEmpty.style.display   = 'none';
  resultDisplay.style.display = 'block';

  document.getElementById('result-tag-name').textContent =
    tagName ? tagName : 'Custom Calculation';

  document.getElementById('result-pv-number').textContent = formatNum(pv);
  document.getElementById('result-pv-unit').textContent   = unit;

  document.getElementById('result-breakdown').textContent =
    `RAW = ${rawPct}%  |  SVH = ${svh}  |  SVL = ${svl}  |  Span = ${span}`;

  document.getElementById('result-formula').textContent =
    `PV = ${svl} + (${rawPct}/100) × (${svh}−${svl}) = ${formatNum(pv)}`;

  renderQuickRef(svh, svl, unit);
}

function renderQuickRef(svh, svl, unit) {
  const wrapper = document.getElementById('quick-ref');
  const rows    = document.getElementById('quick-ref-rows');

  const pcts = [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];
  rows.innerHTML = pcts.map(p => {
    const pv = calcPV(p, svh, svl);
    return `<div class="qr-row">
      <span class="qr-raw">${p}%</span>
      <span class="qr-pv">${formatNum(pv)} ${unit || ''}</span>
    </div>`;
  }).join('');

  wrapper.style.display = 'block';
}

// ──────────────────────────────────────────────
// TAG LIBRARY TAB
// ──────────────────────────────────────────────
function renderLibrary(query = '') {
  const q      = query.toLowerCase();
  const tbody  = document.getElementById('library-tbody');
  const empty  = document.getElementById('library-empty');
  const filtered = tags.filter(t =>
    t.name.toLowerCase().includes(q) ||
    (t.description || '').toLowerCase().includes(q)
  );

  tbody.querySelectorAll('tr:not(#library-empty)').forEach(r => r.remove());

  empty.style.display = filtered.length === 0 ? '' : 'none';

  filtered.forEach(tag => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-tag-name">${escHtml(tag.name)}</td>
      <td class="td-desc">${escHtml(tag.description || '—')}</td>
      <td class="td-number text-right">${tag.svh}</td>
      <td class="td-number text-right">${tag.svl}</td>
      <td class="td-unit">${escHtml(tag.unit || '—')}</td>
      <td>
        <div class="td-actions">
          <button class="btn-icon use"   data-id="${tag.id}" title="ใช้ใน Calculator">▶ ใช้</button>
          <button class="btn-icon edit"  data-id="${tag.id}" title="แก้ไข">✏</button>
          <button class="btn-icon delete" data-id="${tag.id}" title="ลบ">✕</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });

  updateTagCount();
}

document.getElementById('lib-search').addEventListener('input', e => {
  renderLibrary(e.target.value);
});

document.getElementById('library-tbody').addEventListener('click', e => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;
  const id  = btn.dataset.id;
  const tag = tags.find(t => t.id === id);
  if (!tag) return;

  if (btn.classList.contains('delete')) {
    if (confirm(`ลบ Tag "${tag.name}" ?`)) {
      tags = tags.filter(t => t.id !== id);
      saveTags();
      renderLibrary(document.getElementById('lib-search').value);
      toast(`ลบ ${tag.name} แล้ว`, 'success');
    }
  } else if (btn.classList.contains('edit')) {
    openModal(tag);
  } else if (btn.classList.contains('use')) {
    switchToCalcWith(tag);
  }
});

function switchToCalcWith(tag) {
  document.querySelector('[data-tab="calculator"]').click();
  document.getElementById('calc-tag-search').value = tag.name;
  document.getElementById('calc-tag-name').value   = tag.name;
  document.getElementById('calc-svh').value        = tag.svh;
  document.getElementById('calc-svl').value        = tag.svl;
  document.getElementById('calc-unit').value       = tag.unit || '';
  document.getElementById('calc-raw').focus();
}

// ===== MODAL =====
document.getElementById('add-tag-btn').addEventListener('click', () => openModal(null));
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

document.getElementById('modal-save').addEventListener('click', saveModal);

function openModal(tag) {
  editingId = tag ? tag.id : null;
  document.getElementById('modal-title').textContent = tag ? 'แก้ไข Tag' : 'เพิ่ม Tag';
  document.getElementById('modal-tag-name').value  = tag ? tag.name : '';
  document.getElementById('modal-unit').value       = tag ? (tag.unit || '') : '';
  document.getElementById('modal-description').value = tag ? (tag.description || '') : '';
  document.getElementById('modal-svh').value        = tag ? tag.svh : '';
  document.getElementById('modal-svl').value        = tag ? tag.svl : 0;
  document.getElementById('modal-error').style.display = 'none';
  document.getElementById('modal-overlay').style.display = '';
  document.getElementById('modal-tag-name').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

function saveModal() {
  const name  = document.getElementById('modal-tag-name').value.trim().toUpperCase();
  const unit  = document.getElementById('modal-unit').value.trim();
  const desc  = document.getElementById('modal-description').value.trim();
  const svhRaw = document.getElementById('modal-svh').value;
  const svh   = parseFloat(svhRaw);
  const svl   = parseSVL(document.getElementById('modal-svl').value);
  const errEl = document.getElementById('modal-error');

  if (!name) { showModalError('กรุณากรอก Tag Name'); return; }
  if (svhRaw === '' || isNaN(svh)) { showModalError('กรุณากรอกค่า SVH'); return; }
  if (isNaN(svl)) { showModalError('ค่า SVL ไม่ถูกต้อง (ตัวอย่าง: 0 หรือ -600)'); return; }
  if (svh <= svl) { showModalError('SVH ต้องมากกว่า SVL'); return; }

  const duplicate = tags.find(t => t.name === name && t.id !== editingId);
  if (duplicate) { showModalError(`Tag "${name}" มีในระบบแล้ว`); return; }

  errEl.style.display = 'none';

  if (editingId) {
    const idx = tags.findIndex(t => t.id === editingId);
    tags[idx] = { ...tags[idx], name, unit, description: desc, svh, svl };
  } else {
    tags.push({ id: nextId(), name, unit, description: desc, svh, svl });
  }

  saveTags();
  renderLibrary(document.getElementById('lib-search').value);
  closeModal();
  toast(editingId ? `อัปเดต ${name} แล้ว` : `เพิ่ม ${name} แล้ว`, 'success');
}

function showModalError(msg) {
  const el = document.getElementById('modal-error');
  el.textContent = msg;
  el.style.display = '';
}

// ===== EXPORT / IMPORT CSV =====
document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
document.getElementById('import-csv-btn').addEventListener('click', () => {
  document.getElementById('import-file-input').click();
});
document.getElementById('import-file-input').addEventListener('change', importCSV);
document.getElementById('clear-all-btn').addEventListener('click', () => {
  if (tags.length === 0) { toast('ไม่มี tag ในระบบ', 'error'); return; }
  if (confirm(`ลบ Tag ทั้งหมด ${tags.length} รายการ?`)) {
    tags = [];
    saveTags();
    renderLibrary();
    toast('ล้างข้อมูลทั้งหมดแล้ว', 'success');
  }
});

function exportCSV() {
  if (tags.length === 0) { toast('ไม่มีข้อมูลให้ export', 'error'); return; }
  const header = 'Tag Name,Description,SVH,SVL,Unit';
  const rows   = tags.map(t =>
    [t.name, t.description || '', t.svh, t.svl, t.unit || '']
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  downloadFile([header, ...rows].join('\n'), 'dcs_tag_library.csv', 'text/csv');
  toast('Export สำเร็จ', 'success');
}

function importCSV(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim());
    let added = 0, skipped = 0;
    lines.slice(1).forEach(line => {
      const cols = parseCSVLine(line);
      if (cols.length < 4) { skipped++; return; }
      const name = cols[0].trim().toUpperCase();
      const svh  = parseFloat(cols[2]);
      const svl  = parseFloat(cols[3]) || 0;
      if (!name || isNaN(svh)) { skipped++; return; }
      if (tags.find(t => t.name === name)) { skipped++; return; }
      tags.push({ id: nextId(), name, description: cols[1] || '', svh, svl, unit: cols[4] || '' });
      added++;
    });
    saveTags();
    renderLibrary();
    toast(`Import สำเร็จ: เพิ่ม ${added} tag, ข้าม ${skipped}`, 'success');
  };
  reader.readAsText(file);
  e.target.value = '';
}

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      result.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

// ──────────────────────────────────────────────
// BATCH MODE TAB
// ──────────────────────────────────────────────
setupTagSearch('batch-tag-search', 'batch-tag-dropdown', tag => {
  document.getElementById('batch-svh').value  = tag.svh;
  document.getElementById('batch-svl').value  = tag.svl;
  document.getElementById('batch-unit').value = tag.unit || '';
});

document.getElementById('batch-calc-btn').addEventListener('click', runBatch);

function runBatch() {
  const svhVal  = document.getElementById('batch-svh').value;
  const svh     = parseFloat(svhVal);
  const svl     = parseSVL(document.getElementById('batch-svl').value);
  const unit    = document.getElementById('batch-unit').value.trim();
  const rawText = document.getElementById('batch-raw-input').value;

  if (svhVal === '' || isNaN(svh)) {
    toast('กรุณากรอกค่า SVH', 'error');
    return;
  }

  if (isNaN(svl)) {
    toast('ค่า SVL ไม่ถูกต้อง (ตัวอย่าง: 0 หรือ -600)', 'error');
    return;
  }

  if (svh <= svl) {
    toast('SVH ต้องมากกว่า SVL', 'error');
    return;
  }

  const rawValues = rawText
    .split(/[\n,]+/)
    .map(v => v.trim())
    .filter(v => v !== '')
    .map(v => parseFloat(v))
    .filter(v => !isNaN(v));

  if (rawValues.length === 0) {
    toast('ไม่พบค่า RAW% ที่ถูกต้อง', 'error');
    return;
  }

  const span = svh - svl;
  const tbody = document.getElementById('batch-tbody');
  tbody.innerHTML = '';

  rawValues.forEach((rawPct, i) => {
    const pv       = calcPV(rawPct, svh, svl);
    const barWidth = Math.min(100, Math.max(0, rawPct));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--text-dim);font-size:0.8rem">${i + 1}</td>
      <td class="td-raw text-right">${rawPct}</td>
      <td class="td-pv text-right">${formatNum(pv)}</td>
      <td class="td-unit">${escHtml(unit)}</td>
      <td>
        <div class="span-bar-wrapper">
          <div class="span-bar" style="width:${barWidth}px;max-width:80px"></div>
          <span class="span-pct">${rawPct}%</span>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });

  document.getElementById('batch-empty').style.display         = 'none';
  document.getElementById('batch-results-wrapper').style.display = '';
  document.getElementById('batch-result-count').textContent    = `${rawValues.length} รายการ`;

  toast(`คำนวณ ${rawValues.length} ค่าแล้ว`, 'success');
}

// ===== BATCH COPY & EXPORT =====
document.getElementById('batch-copy-btn').addEventListener('click', () => {
  const rows = document.querySelectorAll('#batch-tbody tr');
  if (rows.length === 0) return;
  const unit = document.getElementById('batch-unit').value.trim();
  const lines = ['#\tRAW(%)\tPV\tUnit'];
  rows.forEach((tr, i) => {
    const tds = tr.querySelectorAll('td');
    lines.push(`${i+1}\t${tds[1].textContent.trim()}\t${tds[2].textContent.trim()}\t${unit}`);
  });
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    toast('คัดลอกแล้ว', 'success');
  });
});

document.getElementById('batch-export-btn').addEventListener('click', () => {
  const rows = document.querySelectorAll('#batch-tbody tr');
  if (rows.length === 0) return;
  const unit = document.getElementById('batch-unit').value.trim();
  const tagName = document.getElementById('batch-tag-search').value.trim();
  const header = '#,Tag,RAW(%),PV,Unit';
  const csvRows = Array.from(rows).map((tr, i) => {
    const tds = tr.querySelectorAll('td');
    return `${i+1},"${tagName}",${tds[1].textContent.trim()},${tds[2].textContent.trim()},"${unit}"`;
  });
  downloadFile([header, ...csvRows].join('\n'), 'batch_result.csv', 'text/csv');
  toast('Export สำเร็จ', 'success');
});

// ──────────────────────────────────────────────
// UTILITY
// ──────────────────────────────────────────────
function formatNum(n) {
  if (Number.isInteger(n)) return n.toString();
  return parseFloat(n.toFixed(4)).toString();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function downloadFile(content, filename, type) {
  const blob = new Blob(['﻿' + content], { type: type + ';charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast show ' + type;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.classList.remove('show'); }, 2800);
}

function updateTagCount() {
  document.getElementById('tag-count').textContent = tags.length;
}

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
(function init() {
  renderLibrary();

  // Pre-load sample tags if library is empty
  if (tags.length === 0) {
    const samples = [
      { id: nextId(), name: 'PC-2731', description: 'Pressure Controller Loop 2731', svh: 60,  svl: 0,   unit: 'bar' },
      { id: nextId(), name: 'TC-1101', description: 'Temperature Controller Feed',   svh: 300, svl: 0,   unit: '°C'  },
      { id: nextId(), name: 'FC-3205', description: 'Flow Controller Outlet',        svh: 500, svl: 0,   unit: 'm³/h'},
      { id: nextId(), name: 'LC-4401', description: 'Level Controller Tank A',       svh: 100, svl: 0,   unit: '%'   },
      { id: nextId(), name: 'TT-0502', description: 'Temperature Transmitter Cold',  svh: 100, svl: -20, unit: '°C'  },
    ];
    tags.push(...samples);
    saveTags();
    renderLibrary();
  }
})();
