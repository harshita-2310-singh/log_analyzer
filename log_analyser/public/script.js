
const zone = document.getElementById('uploadZone');

zone.addEventListener('dragover', e => {
  e.preventDefault();
  zone.classList.add('dragover');
});

zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

zone.addEventListener('drop', e => {
  e.preventDefault();
  zone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f) uploadFile(f);
});

document.getElementById('fileInput').addEventListener('change', e => {
  if (e.target.files[0]) uploadFile(e.target.files[0]);
});

let allEntries = [];
let currentFilter = 'ALL';


function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}


function uploadFile(file) {

  const bar = document.getElementById('filenameBar');
  bar.classList.add('visible');
  document.getElementById('filenameText').textContent = file.name;
  document.getElementById('filesizeText').textContent = formatBytes(file.size);

  const progress = document.getElementById('analyzeProgress');
  const fill = document.getElementById('progressFill');
  progress.classList.add('visible');
  fill.style.width = '20%';

  const formData = new FormData();
  formData.append("logfile", file);

  fetch("/analyze", {
    method: "POST",
    body: formData
  })
  .then(res => res.json())
  .then(data => {

    if (data.error) {
      showToast(data.error);
      return;
    }

    fill.style.width = '100%';

    setTimeout(() => {
      progress.classList.remove('visible');
      fill.style.width = '0%';
      renderAnalysis(data);
    }, 400);

  })
  .catch(err => {
    console.error(err);
    showToast("Server error while analyzing file.");
  });
}


function renderAnalysis(data) {

  allEntries = data.entries;

  const errors = data.counts.ERROR || 0;
  const warnings = data.counts.WARNING || 0;
  const info = data.counts.INFO || 0;
  const debug = data.counts.DEBUG || 0;

  animateCounter('countErrors', errors);
  animateCounter('countWarnings', warnings);
  animateCounter('countInfo', info);
  animateCounter('countDebug', debug);

  document.getElementById('statsRow').classList.add('visible');
  document.getElementById('chartsRow').classList.add('visible');
  document.getElementById('toolbar').classList.add('visible');
  document.getElementById('logPanel').classList.add('visible');

  const maxVal = Math.max(errors, warnings, info, debug, 1);

  setTimeout(() => {
    document.getElementById('vbarError').style.height = (errors/maxVal*100) + '%';
    document.getElementById('vbarWarning').style.height = (warnings/maxVal*100) + '%';
    document.getElementById('vbarInfo').style.height = (info/maxVal*100) + '%';
    document.getElementById('vbarDebug').style.height = (debug/maxVal*100) + '%';
  }, 300);

  document.getElementById('vbarValError').textContent = errors;
  document.getElementById('vbarValWarning').textContent = warnings;
  document.getElementById('vbarValInfo').textContent = info;
  document.getElementById('vbarValDebug').textContent = debug;

  document.getElementById('ytick100').textContent = maxVal;
  document.getElementById('ytick75').textContent = Math.round(maxVal * 0.75);
  document.getElementById('ytick50').textContent = Math.round(maxVal * 0.5);
  document.getElementById('ytick25').textContent = Math.round(maxVal * 0.25);

  renderEntries(allEntries);

  document.getElementById('logMeta').textContent =
    `${data.totalLogs} entries · ${errors} errors · ${data.filename}`;

  showToast(`${data.totalLogs} log entries analyzed`);
}


function animateCounter(id, target) {
  const el = document.getElementById(id);
  let val = 0;
  const step = Math.max(1, Math.ceil(target / 40));

  const timer = setInterval(() => {
    val = Math.min(val + step, target);
    el.textContent = val;
    if (val >= target) clearInterval(timer);
  }, 20);
}


function renderEntries(entries) {
  const list = document.getElementById('logList');
  list.innerHTML = '';

  const search = document.getElementById('searchInput').value.toLowerCase();

  const filtered = entries.filter(entry => {
    if (currentFilter !== 'ALL' && entry.level !== currentFilter) return false;
    if (search && !entry.msg.toLowerCase().includes(search)) return false;
    return true;
  });

  if (filtered.length === 0) {
    list.innerHTML =
      '<div class="empty-state"><h3>No Matches</h3><p>No entries match your filter/search</p></div>';
    return;
  }

  const frag = document.createDocumentFragment();

  filtered.forEach(entry => {
    const div = document.createElement('div');
    div.className = `log-entry ${entry.level}`;
    div.innerHTML = `
      <div class="log-timestamp">${entry.ts || '—'}</div>
      <div class="log-badge ${entry.level}">${entry.level}</div>
      <div class="log-msg">${escapeHtml(entry.msg)}</div>
      <div class="log-line">L${entry.line}</div>
    `;
    frag.appendChild(div);
  });

  list.appendChild(frag);

  document.getElementById('logMeta').textContent =
    `Showing ${filtered.length} of ${allEntries.length} entries`;
}

function filterLogs(level, btn) {
  currentFilter = level;
  document.querySelectorAll('.filter-btn')
    .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderEntries(allEntries);
}

document.getElementById('searchInput')
  .addEventListener('input', () => renderEntries(allEntries));


document.querySelectorAll('.nav-pill').forEach(p => {
  p.addEventListener('click', () => {
    document.querySelectorAll('.nav-pill').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
  });
});


function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(2) + ' MB';
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;')
          .replace(/</g,'&lt;')
          .replace(/>/g,'&gt;');
}
