
let days = [];
let learnedMap = {};

function configureDriveVisibility() {
  const enabled = localStorage.getItem('openDrive') === 'true';
  document.getElementById('driveNav').hidden = !enabled;
  document.getElementById('drive').hidden = !enabled;
}

function showPanel(id, button) {
  document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(item => item.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  button.classList.add('active');
}

function renderStats() {
  const entries = days.map(lesson => {
    const total = lesson.words ? lesson.words.length : (lesson.wordCount || 0);
    const learned = Object.keys(learnedMap).filter(key =>
      key.indexOf(`${lesson.day}_`) === 0 && learnedMap[key]
    ).length;
    return { lesson, total, learned };
  });
  const started = entries.filter(item => item.learned > 0);
  const completed = entries.filter(item => item.total > 0 && item.learned >= item.total);
  const learnedWords = entries.reduce((sum, item) => sum + item.learned, 0);
  const totalWords = entries.reduce((sum, item) => sum + item.total, 0);
  document.getElementById('totalLessons').textContent = entries.length;
  document.getElementById('startedLessons').textContent = started.length;
  document.getElementById('completedLessons').textContent = completed.length;
  document.getElementById('learnedWords').textContent = `${learnedWords}/${totalWords}`;
  document.getElementById('learnedList').innerHTML = started.length
    ? started.map(({ lesson, learned, total }) => `<li><a class="lesson-link" href="index.html?day=${encodeURIComponent(lesson.day)}">Ngày ${lesson.day}: ${Math.round((learned / total) * 100)}% (${learned}/${total} từ) · Học tiếp</a></li>`).join('')
    : '<li>Chưa bắt đầu bài nào.</li>';
  const unlearned = entries.filter(item => item.learned === 0);
  document.getElementById('unlearnedList').innerHTML = unlearned.length
    ? unlearned.map(({ lesson }) => `<li><a class="lesson-link" href="index.html?day=${encodeURIComponent(lesson.day)}">Ngày ${lesson.day}: ${lesson.title || 'Chưa có tiêu đề'} · Học ngay</a></li>`).join('')
    : '<li>Đã bắt đầu tất cả các bài.</li>';
}

async function loadData() {
  await authReady;
  document.getElementById('gasUrl').value = getGasUrl();
  try {
    const response = await fetch(getGasUrl() + (getGasUrl().includes('?') ? '&' : '?') + 'action=bootstrap&token=' + encodeURIComponent(getAuthToken()));
    const data = ensureAuthResponse(await response.json());
    if (!data || !Array.isArray(data.days)) throw new Error('Dữ liệu Drive không hợp lệ.');
    days = data.days;
    const progress = data.progress || {};
    learnedMap = progress.words || progress;
    document.getElementById('statsStatus').textContent = 'Đã đồng bộ dữ liệu từ Google Drive.';
    document.getElementById('statsStatus').className = 'sub ok';
  } catch (error) {
    const response = await fetch('lessons.json');
    days = await response.json();
    learnedMap = {};
    document.getElementById('statsStatus').textContent = 'Không kết nối được Drive, đang hiển thị dữ liệu cục bộ.';
  }
  renderStats();
}

function saveGasUrl() {
  const value = document.getElementById('gasUrl').value.trim();
  localStorage.setItem('eng_gas_url', value);
  document.getElementById('driveStatus').textContent = 'Đã lưu kết nối. Hãy mở lại tab Thống kê để đồng bộ.';
  configureDriveVisibility();
  loadData();
}

configureDriveVisibility();
loadData();

