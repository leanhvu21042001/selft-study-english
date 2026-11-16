
let LESSONS = [];
let DAY_INDEX = [];
let driveMode = false;
let lessonRequestId = 0;
let progressSaveTimer = null;
let progressSaveInFlight = false;
let progressSavePending = false;
let currentDayIdx = 0;
let openYears = new Set();
let openMonths = new Set();
let openWeeks = new Set();
let fcIndex = 0;
let fcShowBack = false;
let studyCardIndex = 0;
let studyCardShowBack = false;
let learnedMap = {};
let lessonProgress = {};
let driveRecordings = [];
let mediaRecorder = null, recChunks = [], recTimerInt = null, recSeconds = 0;
let activeRecording = null;

function showTab(id, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
}

function speakText(text) {
  if (!('speechSynthesis' in window)) { alert('Trình duyệt không hỗ trợ giọng đọc.'); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = parseFloat(document.getElementById('rate').value || '1');
  window.speechSynthesis.speak(u);
}
function stopSpeech() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }

async function loadLessons() {
  await authReady;
  const savedUrl = getGasUrl();
  const gasInput = document.getElementById('gasUrl');
  if (gasInput) gasInput.value = savedUrl;
  if (savedUrl) {
    try {
      const res = await fetch(savedUrl + (savedUrl.includes('?') ? '&' : '?') + 'action=bootstrap&token=' + encodeURIComponent(getAuthToken()));
      const data = ensureAuthResponse(await res.json());
      if (data && Array.isArray(data.days) && data.days.length > 0) {
        DAY_INDEX = data.days;
        LESSONS = [];
        driveMode = true;
        const progress = data.progress || {};
        learnedMap = progress.words || progress;
        lessonProgress = progress.lessons || {};
        renderDayNav();
        selectDay(getRequestedDayIndex(DAY_INDEX));
        setGasStatus(`Đã nạp danh sách ${DAY_INDEX.length} ngày học.`);
        return;
      }
      if (Array.isArray(data) && data.length > 0) {
        LESSONS = data;
        DAY_INDEX = data;
        driveMode = false;
        renderDayNav();
        selectDay(getRequestedDayIndex(DAY_INDEX));
        return;
      }
    } catch (e) {
      setGasStatus('Không kết nối được Apps Script, đang dùng dữ liệu lessons.json cục bộ.');
    }
  }
  const res = await fetch('lessons.json');
  LESSONS = await res.json();
  DAY_INDEX = LESSONS;
  driveMode = false;
  learnedMap = {};
  lessonProgress = {};
  driveRecordings = [];
  renderDayNav();
  selectDay(getRequestedDayIndex(DAY_INDEX));
}

function renderDayNav() {
  const nav = document.getElementById('dayNav');
  const foldersToggle = document.getElementById('dayFoldersToggle');
  const q = document.getElementById('daySearch').value.trim().toLowerCase();
  const source = driveMode ? DAY_INDEX : LESSONS;
  if (foldersToggle) {
    foldersToggle.textContent = openYears.size || openMonths.size || openWeeks.size
      ? 'Thu gọn tất cả'
      : 'Mở rộng tất cả';
  }
  const filtered = source.map((lesson, idx) => ({ lesson, idx })).filter(({ lesson }) => {
    if (!q) return true;
    return `ngày ${lesson.day} ${lesson.title || ''} ${lesson.createdDate || ''}`.toLowerCase().includes(q);
  });
  if (!filtered.length) {
    nav.innerHTML = '<span class="sub" style="color:#d7dcff;">Không tìm thấy ngày học.</span>';
    return;
  }
  const years = new Map();
  filtered.forEach(item => {
    const date = getLessonDate(item.lesson);
    if (!years.has(date.year)) years.set(date.year, new Map());
    const months = years.get(date.year);
    if (!months.has(date.month)) months.set(date.month, []);
    months.get(date.month).push(item);
  });
  nav.innerHTML = Array.from(years.entries()).sort((a, b) => b[0] - a[0]).map(([year, months]) => {
    const yearOpen = openYears.has(year);
    const monthMarkup = Array.from(months.entries()).sort((a, b) => a[0] - b[0]).map(([month, days]) => {
      const monthKey = `${year}-${month}`;
      const monthOpen = openMonths.has(monthKey);
      const weeks = new Map();
      days.forEach(item => {
        const date = getLessonDate(item.lesson);
        const week = getWeekNumber(date);
        if (!weeks.has(week)) weeks.set(week, []);
        weeks.get(week).push(item);
      });
      const weekMarkup = Array.from(weeks.entries()).sort((a, b) => a[0] - b[0]).map(([week, weekDays]) => {
        const weekKey = `${monthKey}-w${week}`;
        const weekOpen = openWeeks.has(weekKey);
        return `<section class="day-week-card"><button class="day-folder ${weekOpen ? 'open' : ''}" type="button" aria-expanded="${weekOpen}" onclick="toggleDayWeek('${weekKey}')"><span>${week ? 'Tuần ' + week : 'Chưa có tuần'}</span><span class="day-folder-count">${weekDays.length} bài</span></button><div class="day-week-days ${weekOpen ? '' : 'hidden'}">${weekDays.map(({ lesson: l, idx }) =>
          `<button class="day-btn ${idx === currentDayIdx ? 'active' : ''}" title="${l.title || `Ngày ${l.day}`}" onclick="selectDay(${idx})"><span class="day-title">Ngày ${l.day} - ${l.title || 'Chưa có tiêu đề'}</span></button>`
        ).join('')}</div></section>`;
      }).join('');
      return `<section class="day-month-card"><button class="day-folder ${monthOpen ? 'open' : ''}" type="button" aria-expanded="${monthOpen}" onclick="toggleDayMonth('${monthKey}')"><span>${month ? 'Tháng ' + month : 'Chưa có tháng'}</span><span class="day-folder-count">${days.length} bài</span></button><div class="${monthOpen ? '' : 'hidden'}">${weekMarkup}</div></section>`;
    }).join('');
    return `<section class="day-year-card"><button class="day-folder ${yearOpen ? 'open' : ''}" type="button" aria-expanded="${yearOpen}" onclick="toggleDayYear(${year})"><span>${year ? 'Năm ' + year : 'Chưa có năm'}</span><span class="day-folder-count">${Array.from(months.values()).reduce((total, days) => total + days.length, 0)} bài</span></button><div class="${yearOpen ? '' : 'hidden'}">${monthMarkup}</div></section>`;
  }).join('');
}

function getLessonDate(lesson) {
  const raw = lesson.createdDate || lesson.folderName || '';
  const match = String(raw).match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  return match
    ? { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) }
    : { year: 0, month: 0, day: 0 };
}

function getWeekNumber(date) {
  if (!date.year || !date.month || !date.day) return 0;
  const current = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const firstDay = new Date(Date.UTC(date.year, 0, 1));
  return Math.ceil((((current - firstDay) / 86400000) + firstDay.getUTCDay() + 1) / 7);
}

function toggleDayYear(year) {
  if (openYears.has(year)) openYears.delete(year);
  else openYears.add(year);
  renderDayNav();
}

function toggleDayMonth(monthKey) {
  if (openMonths.has(monthKey)) openMonths.delete(monthKey);
  else openMonths.add(monthKey);
  renderDayNav();
}

function toggleDayWeek(weekKey) {
  if (openWeeks.has(weekKey)) openWeeks.delete(weekKey);
  else openWeeks.add(weekKey);
  renderDayNav();
}

function toggleAllDayFolders() {
  const shouldCollapse = openYears.size || openMonths.size || openWeeks.size;
  if (shouldCollapse) {
    openYears.clear();
    openMonths.clear();
    openWeeks.clear();
  } else {
    const source = driveMode ? DAY_INDEX : LESSONS;
    source.forEach(lesson => {
      const date = getLessonDate(lesson);
      const monthKey = `${date.year}-${date.month}`;
      openYears.add(date.year);
      openMonths.add(monthKey);
      openWeeks.add(`${monthKey}-w${getWeekNumber(date)}`);
    });
  }
  renderDayNav();
}

async function selectDay(idx) {
  const requestId = ++lessonRequestId;
  currentDayIdx = idx;
  const selectedDay = DAY_INDEX[idx] || LESSONS[idx];
  if (selectedDay) {
    const date = getLessonDate(selectedDay);
    openYears.add(date.year);
    openMonths.add(`${date.year}-${date.month}`);
    openWeeks.add(`${date.year}-${date.month}-w${getWeekNumber(date)}`);
  }
  fcIndex = 0;
  studyCardIndex = 0;
  studyCardShowBack = false;
  renderDayNav();
  if (driveMode && !LESSONS[currentDayIdx]) {
    const meta = DAY_INDEX[currentDayIdx];
    document.getElementById('lessonTitle').textContent = meta.title || `Ngày ${meta.day}`;
    document.getElementById('progressSummary').textContent = 'Đang tải bài học...';
    document.getElementById('vocabBody').innerHTML = '<tr><td colspan="8"><div class="loading-state">Đang tải bài học...</div></td></tr>';
    document.getElementById('dialogueBox').innerHTML = '<div class="loading-state">Đang tải hội thoại...</div>';
    document.getElementById('essayBox').innerHTML = '<div class="loading-state">Đang tải bài văn...</div>';
    const savedUrl = getGasUrl();
    const params = new URLSearchParams({ action: 'lesson', day: meta.day, folderName: meta.folderName || '' });
    const res = await fetch(savedUrl + (savedUrl.includes('?') ? '&' : '?') + params.toString() + '&token=' + encodeURIComponent(getAuthToken()));
    const data = ensureAuthResponse(await res.json());
    if (requestId !== lessonRequestId) return;
    if (!data.ok || !data.lesson) {
      setGasStatus(data.error || 'Không tải được bài học.');
      document.getElementById('vocabBody').innerHTML = '<tr><td colspan="8"><div class="loading-state err">Không tải được bài học.</div></td></tr>';
      return;
    }
    LESSONS[currentDayIdx] = data.lesson;
    driveRecordings = data.recordings || [];
    LESSONS[currentDayIdx].documentUrl = data.documentUrl || '';
  }
  const L = LESSONS[currentDayIdx];
  document.getElementById('lessonTitle').textContent = L.title || `Ngày ${L.day}`;
  renderLessonFileLink(L.documentUrl);
  const gf = document.getElementById('groupFilter');
  gf.innerHTML = '<option value="0">Tất cả nhóm</option>' + (L.groups || []).map((g, i) => `<option value="${i + 1}">${g}</option>`).join('');
  renderVocab();
  renderReading();
  renderQuiz();
  renderStudyCard();
  renderRecordings();
  updateSummary();
}

function renderLessonFileLink(url) {
  const container = document.getElementById('lessonFileLink');
  if (!container) return;
  if (!url) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  container.classList.remove('hidden');
  container.innerHTML = `<a class="lesson-file-btn" href="${url}" target="_blank" rel="noopener">Mở file Word bài học</a>`;
}

function renderVocab() {
  const L = LESSONS[currentDayIdx];
  const q = document.getElementById('search').value.trim().toLowerCase();
  const g = parseInt(document.getElementById('groupFilter').value || '0', 10);
  const m = getLearnedMap();
  const filtered = L.words.filter(w => {
    if (g !== 0 && w.group !== g) return false;
    if (!q) return true;
    return w.word.toLowerCase().includes(q) || w.vi.toLowerCase().includes(q);
  });
  const grouped = new Map();
  filtered.forEach(w => {
    const group = Number.isInteger(w.group) ? w.group : 0;
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(w);
  });
  const rows = [];
  Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]).forEach(([group, words]) => {
    const groupName = group > 0 && L.groups && L.groups[group - 1]
      ? L.groups[group - 1]
      : 'Chưa phân nhóm';
    rows.push(`<tr class="vocab-group-row"><th colspan="8">${groupName}</th></tr>`);
    rows.push(...words.map(w => `
        <tr>
          <td><button class="btn learn-btn ${m[`${L.day}_${w.id}`] ? 'learned' : ''}" type="button" aria-pressed="${!!m[`${L.day}_${w.id}`]}" onclick="setLearned(${L.day}, ${w.id}, !${!!m[`${L.day}_${w.id}`]})">${m[`${L.day}_${w.id}`] ? 'Đã thuộc' : 'Chưa thuộc'}</button></td>
          <td>${w.id}</td>
          <td><strong>${w.word}</strong></td>
          <td class="ipa">${w.ipa}</td>
          <td>${w.pos}</td>
          <td>${w.vi}</td>
          <td>${w.ex}</td>
          <td>
            <button class="btn" onclick="speakText(${JSON.stringify(w.word).replace(/"/g, '&quot;')})">Từ</button>
            <button class="btn" onclick="speakText(${JSON.stringify(w.ex).replace(/"/g, '&quot;')})">Câu</button>
          </td>
        </tr>
      `));
  });
  document.getElementById('vocabBody').innerHTML = rows.join('');
  renderFlashcard();
}

function toggleFlashcard() {
  document.getElementById('flashcardBox').classList.toggle('hidden');
  document.getElementById('vocabTableWrap').classList.toggle('hidden');
  renderFlashcard();
}
function renderFlashcard() {
  const L = LESSONS[currentDayIdx];
  if (!L || !L.words.length) return;
  const w = L.words[fcIndex % L.words.length];
  document.getElementById('fcFront').textContent = w.word;
  document.getElementById('fcIpa').textContent = `${w.ipa} (${w.pos})`;
  document.getElementById('fcBack').textContent = `${w.vi} — "${w.ex}"`;
  document.getElementById('fcBack').classList.toggle('hidden', !fcShowBack);
}
function flipCard() { fcShowBack = !fcShowBack; renderFlashcard(); }
function nextCard() { fcIndex = (fcIndex + 1) % LESSONS[currentDayIdx].words.length; fcShowBack = false; renderFlashcard(); }
function prevCard() { const n = LESSONS[currentDayIdx].words.length; fcIndex = (fcIndex - 1 + n) % n; fcShowBack = false; renderFlashcard(); }
function speakCard() { speakText(LESSONS[currentDayIdx].words[fcIndex].word); }
function speakCardEx() { speakText(LESSONS[currentDayIdx].words[fcIndex].ex); }
function renderStudyCard() {
  const L = LESSONS[currentDayIdx];
  if (!L || !L.words.length) return;
  const w = L.words[studyCardIndex % L.words.length];
  document.getElementById('studyCardFront').textContent = w.word;
  document.getElementById('studyCardIpa').textContent = `${w.ipa} (${w.pos})`;
  document.getElementById('studyCardBack').textContent = `${w.vi} — "${w.ex}"`;
  document.getElementById('studyCardBack').classList.toggle('hidden', !studyCardShowBack);
}
function flipStudyCard() { studyCardShowBack = !studyCardShowBack; renderStudyCard(); }
function nextStudyCard() { studyCardIndex = (studyCardIndex + 1) % LESSONS[currentDayIdx].words.length; studyCardShowBack = false; renderStudyCard(); }
function prevStudyCard() { const n = LESSONS[currentDayIdx].words.length; studyCardIndex = (studyCardIndex - 1 + n) % n; studyCardShowBack = false; renderStudyCard(); }
function speakStudyCard() { speakText(LESSONS[currentDayIdx].words[studyCardIndex].word); }
function speakStudyCardEx() { speakText(LESSONS[currentDayIdx].words[studyCardIndex].ex); }

function renderReading() {
  const L = LESSONS[currentDayIdx];
  document.getElementById('dialogueBox').innerHTML = L.dialogue.map((d, i) => `
        <div class="line-box">
          <div class="line-head">
            <div><strong>${d.speaker}:</strong> ${d.en}</div>
            <button class="btn" onclick="speakText(${JSON.stringify(d.en).replace(/"/g, '&quot;')})">Nghe câu</button>
          </div>
          <div class="sub dialogueVi hidden" style="margin-top:4px;">${d.vi}</div>
          ${recordingSlotMarkup('dialogue-' + i, 'Đoạn hội thoại ' + (i + 1))}
        </div>
      `).join('');

  document.getElementById('essayTitle').textContent = `Bài văn: ${L.essay.title}`;
  document.getElementById('essayBox').innerHTML = L.essay.paragraphs.map((p, i) => `
        <div class="line-box">
          <div class="line-head">
            <div style="flex:1;">${p.en}</div>
            <button class="btn" onclick="speakText(${JSON.stringify(p.en).replace(/"/g, '&quot;')})">Nghe đoạn</button>
          </div>
          <div class="sub essayVi hidden" style="margin-top:6px;">${p.vi}</div>
          ${recordingSlotMarkup('essay-' + i, 'Đoạn văn ' + (i + 1))}
        </div>
      `).join('');
  document.getElementById('grammarBox').innerHTML = L.essay.grammar.map(g => `<li>${g}</li>`).join('');
  renderContextRecordings();
}

function speakDialogueAll() { speakText(LESSONS[currentDayIdx].dialogue.map(d => d.en).join(' ')); }
function speakEssayAll() { const E = LESSONS[currentDayIdx].essay; speakText(E.title + '. ' + E.paragraphs.map(p => p.en).join(' ')); }
function toggleVi(cls) { document.querySelectorAll('.' + cls).forEach(el => el.classList.toggle('hidden')); }

function recordingSlotMarkup(key, label) {
  return `<div class="recording-slot" data-recording-key="${key}">
        <div class="toolbar" style="margin:0;">
          <button class="btn btn-primary" onclick="startContextRec('${key}', '${label.replace(/'/g, "\\'")}')">Ghi âm tại đây</button>
          <button class="btn btn-danger" onclick="stopContextRec()" disabled>Dừng</button>
          <span class="sub recording-msg"></span>
        </div>
        <div class="recording-list"></div>
      </div>`;
}

function getRecordingFolder() {
  const L = LESSONS[currentDayIdx];
  return L.folderName || `Ngay ${String(L.day).padStart(2, '0')}`;
}

function startRecording(key, label, slot) {
  try {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      recChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const L = LESSONS[currentDayIdx];
        const idx = Date.now();
        const fname = `${key}__day${L.day}_${idx}.webm`;
        const item = document.createElement('div');
        item.className = 'rec-item';
        item.innerHTML = `
            <strong>Bản ghi — ${label} (${recSeconds}s)</strong>
            <audio controls src="${url}"></audio>
            <div class="toolbar" style="margin:0;">
              <a class="btn" href="${url}" download="${fname}">Tải file (.webm)</a>
              <button class="btn btn-primary" onclick="uploadToDrive(this)">Lưu lên Google Drive</button>
              <span class="sub upload-msg"></span>
            </div>
          `;
        item._blob = blob;
        item._fname = fname;
        item._folder = getRecordingFolder();
        item._key = key;
        item._label = label;
        (slot ? slot.querySelector('.recording-list') : document.getElementById('recordingsList')).prepend(item);
        if (slot) {
          slot.querySelector('.recording-msg').textContent = 'Đang tự động lưu bản ghi lên Drive...';
          setSlotRecordingState(slot, false);
        }
        stream.getTracks().forEach(t => t.stop());
        uploadToDrive(item.querySelector('button.btn-primary'));
      };
      mediaRecorder.start();
      activeRecording = { key: key, label: label, slot: slot };
      recSeconds = 0;
      recTimerInt = setInterval(() => {
        recSeconds++;
        document.getElementById('recTimer').textContent =
          `${String(Math.floor(recSeconds / 60)).padStart(2, '0')}:${String(recSeconds % 60).padStart(2, '0')}`;
      }, 1000);
      if (slot) setSlotRecordingState(slot, true);
      else {
        document.getElementById('btnStartRec').disabled = true;
        document.getElementById('btnStopRec').disabled = false;
      }
    }).catch(() => alert('Không thể truy cập micro. Hãy cấp quyền micro cho trình duyệt.'));
  } catch (e) {
    alert('Không thể khởi động ghi âm.');
  }
}
function startRec() { startRecording('general', 'bản ghi chung', null); }
function startContextRec(key, label) {
  if (activeRecording) return;
  const slot = document.querySelector(`.recording-slot[data-recording-key="${key}"]`);
  startRecording(key, label, slot);
}
function setSlotRecordingState(slot, recording) {
  slot.querySelectorAll('button').forEach(button => {
    button.disabled = recording ? button.textContent.includes('Ghi âm') : button.textContent.includes('Dừng');
  });
}
function stopRec() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  clearInterval(recTimerInt);
  activeRecording = null;
  document.getElementById('btnStartRec').disabled = false;
  document.getElementById('btnStopRec').disabled = true;
}
function stopContextRec() {
  if (!activeRecording) return;
  const slot = activeRecording.slot;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  clearInterval(recTimerInt);
  activeRecording = null;
  if (slot) setSlotRecordingState(slot, false);
}

async function uploadToDrive(btn) {
  const gasUrl = getGasUrl();
  const item = btn.closest('.rec-item');
  const msg = item.querySelector('.upload-msg');
  if (!gasUrl) { msg.textContent = 'Chưa nhập URL Apps Script ở tab Kết nối Drive.'; return; }
  msg.textContent = 'Đang tải lên Drive...';
  const reader = new FileReader();
  reader.onloadend = async () => {
    try {
      const base64 = reader.result.split(',')[1];
      const res = await fetch(gasUrl, {
        method: 'POST',
        body: JSON.stringify(authRequestBody({ action: 'uploadRecording', day: LESSONS[currentDayIdx].day, folderName: item._folder, recordingKey: item._key || 'general', recordingLabel: item._label || 'bản ghi chung', fileName: item._fname, mimeType: 'audio/webm', data: base64 }))
      });
      const out = ensureAuthResponse(await res.json());
      if (!out.ok) throw new Error(out.error || 'Upload thất bại.');
      msg.textContent = `Đã lưu vào ${item._folder} trên Drive!`;
      driveRecordings.push(out);
      item.querySelector('button.btn-primary').disabled = true;
    } catch (err) {
      msg.textContent = 'Lỗi lưu Drive: ' + err.message;
    }
  };
  reader.readAsDataURL(item._blob);
}

function renderRecordingItem(record) {
  const item = document.createElement('div');
  item.className = 'rec-item';
  const accessMessage = record.publicAccess === false
    ? '<span class="sub err">Drive chưa cấp quyền phát trực tiếp. Hãy mở file bằng nút bên dưới.</span>'
    : '<span class="sub ok">Đã lưu trên Google Drive · record</span>';
  item.innerHTML = `<strong>${record.label || record.name}</strong><audio controls preload="metadata" src="${record.url}"></audio><a class="btn" href="${record.driveUrl || record.url}" target="_blank" rel="noopener">Mở file trên Drive</a>${accessMessage}`;
  item.querySelector('audio').addEventListener('error', () => {
    item.querySelector('.sub').textContent = 'Không phát trực tiếp được. Hãy bấm "Mở file trên Drive".';
    item.querySelector('.sub').className = 'sub err';
  });
  return item;
}
function renderContextRecordings() {
  document.querySelectorAll('.recording-slot').forEach(slot => {
    const key = slot.dataset.recordingKey;
    const list = slot.querySelector('.recording-list');
    list.innerHTML = '';
    driveRecordings.filter(r => r.day === LESSONS[currentDayIdx].day && r.key === key)
      .forEach(r => list.appendChild(renderRecordingItem(r)));
  });
}
function renderRecordings() {
  const list = document.getElementById('recordingsList');
  list.innerHTML = '';
  driveRecordings.filter(r => r.day === LESSONS[currentDayIdx].day && r.key === 'general')
    .forEach(r => list.appendChild(renderRecordingItem(r)));
  renderContextRecordings();
}

function renderQuiz() {
  const L = LESSONS[currentDayIdx];
  document.getElementById('quizBox').innerHTML = L.quiz.map((q, i) => `
        <div style="margin-bottom:12px;">
          <label>${i + 1}. ${q.prompt}</label><br/>
          <input id="q_${i}" type="text" style="width:100%;max-width:460px;margin-top:4px;" />
          <div id="qf_${i}" class="sub"></div>
        </div>
      `).join('');
  document.getElementById('quizStatus').textContent = '';
}

function norm(s) { return s.trim().toLowerCase().replace(/[.!?]/g, '').replace(/\s+/g, ' '); }
function gradeQuiz() {
  const L = LESSONS[currentDayIdx];
  let score = 0;
  L.quiz.forEach((q, i) => {
    const val = norm(document.getElementById(`q_${i}`).value);
    const ok = q.answers.some(a => norm(a) === val);
    const fb = document.getElementById(`qf_${i}`);
    fb.className = ok ? 'ok' : 'err';
    fb.textContent = (ok ? 'Chính xác! ' : 'Chưa đúng. ') + 'Đáp án: ' + q.answers[0];
    if (ok) score++;
  });
  document.getElementById('quizStatus').textContent = `Kết quả: ${score}/${L.quiz.length} câu đúng.`;
}

function buildQuizReport() {
  const L = LESSONS[currentDayIdx];
  return [`BÀI LÀM NGÀY ${L.day} - GỬI GEMINI`].concat(
    L.quiz.map((q, i) => `${i + 1}) ${document.getElementById(`q_${i}`).value}`)
  ).join('\n');
}
function copyQuizReport() {
  navigator.clipboard.writeText(buildQuizReport()).then(() => {
    document.getElementById('quizStatus').textContent = 'Đã sao chép kết quả bài làm.';
  }).catch(() => {
    document.getElementById('quizStatus').textContent = 'Không thể sao chép tự động. Hãy kiểm tra quyền clipboard của trình duyệt.';
  });
}
function downloadQuizReport() {
  const L = LESSONS[currentDayIdx];
  const blob = new Blob([buildQuizReport()], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bai_lam_ngay_${L.day}.txt`;
  a.click();
}

authReady.then(loadLessons);

