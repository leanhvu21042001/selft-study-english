function getLearnedMap() { return learnedMap; }
function setLearned(day, wordId, val) {
  learnedMap[`${day}_${wordId}`] = val;
  updateSummary();
  renderVocab();
  clearTimeout(progressSaveTimer);
  progressSaveTimer = setTimeout(saveProgressToDrive, 650);
}


function updateSummary() {
  const L = LESSONS[currentDayIdx] || DAY_INDEX[currentDayIdx];
  const m = getLearnedMap();
  const total = L.words ? L.words.length : (L.wordCount || 0);
  const done = L.words
    ? L.words.filter(w => m[`${L.day}_${w.id}`]).length
    : Object.keys(m).filter(key => key.indexOf(`${L.day}_`) === 0 && m[key]).length;
  document.getElementById('progressSummary').textContent = `Ngày ${L.day}: Đã đánh dấu thuộc ${done}/${total} từ.`;
  document.getElementById('progressBar').style.width = `${total ? (done / total) * 100 : 0}%`;
  renderStats();
}

function buildLessonProgress() {
  const progress = {};
  const source = driveMode ? DAY_INDEX : LESSONS;
  source.forEach(lesson => {
    const total = lesson.words ? lesson.words.length : (lesson.wordCount || 0);
    const learned = Object.keys(learnedMap).filter(key =>
      key.indexOf(`${lesson.day}_`) === 0 && learnedMap[key]
    ).length;
    progress[lesson.day] = {
      title: lesson.title || `Ngày ${lesson.day}`,
      learnedWords: learned,
      totalWords: total,
      percent: total ? Math.round((learned / total) * 100) : 0,
      status: learned === 0 ? 'unlearned' : (learned >= total ? 'completed' : 'learning')
    };
  });
  lessonProgress = progress;
  return progress;
}

function renderStats() {
  const source = driveMode ? DAY_INDEX : LESSONS;
  if (!source.length || !document.getElementById('statsTotalLessons')) return;
  const progress = buildLessonProgress();
  const entries = source.map(lesson => ({
    lesson,
    progress: progress[lesson.day]
  }));
  const started = entries.filter(item => item.progress.status !== 'unlearned');
  const completed = entries.filter(item => item.progress.status === 'completed');
  const learnedWords = entries.reduce((sum, item) => sum + item.progress.learnedWords, 0);
  const totalWords = entries.reduce((sum, item) => sum + item.progress.totalWords, 0);
  document.getElementById('statsTotalLessons').textContent = entries.length;
  document.getElementById('statsStartedLessons').textContent = started.length;
  document.getElementById('statsCompletedLessons').textContent = completed.length;
  document.getElementById('statsLearnedWords').textContent = `${learnedWords}/${totalWords}`;
  document.getElementById('statsLearnedList').innerHTML = started.length
    ? started.map(({ lesson, progress: p }) => `<li>Ngày ${lesson.day}: ${p.percent}% (${p.learnedWords}/${p.totalWords} từ)</li>`).join('')
    : '<li>Chưa bắt đầu bài nào.</li>';
  const unlearned = entries.filter(item => item.progress.status === 'unlearned');
  document.getElementById('statsUnlearnedList').innerHTML = unlearned.length
    ? unlearned.map(({ lesson }) => `<li>Ngày ${lesson.day}: ${lesson.title || 'Chưa có tiêu đề'}</li>`).join('')
    : '<li>Đã bắt đầu tất cả các bài.</li>';
}

async function saveProgressToDrive() {
  const gasUrl = getGasUrl();
  if (!gasUrl) {
    setGasStatus('Hãy kết nối Google Drive để lưu tiến độ trên Drive.');
    return;
  }
  if (progressSaveInFlight) {
    progressSavePending = true;
    return;
  }
  progressSaveInFlight = true;
  try {
    const res = await fetch(gasUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: 'saveProgress',
        progress: { words: learnedMap, lessons: buildLessonProgress() }
      })
    });
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || 'Không thể lưu tiến độ.');
    setGasStatus('Tiến độ đã được lưu lên Google Drive.');
  } catch (e) {
    setGasStatus('Không thể lưu tiến độ lên Google Drive: ' + e.message);
  } finally {
    progressSaveInFlight = false;
    if (progressSavePending) {
      progressSavePending = false;
      saveProgressToDrive();
    }
  }
}


function saveGasUrl() {
  const u = document.getElementById('gasUrl').value.trim();
  localStorage.setItem('eng_gas_url', u);
  loadLessons();
}

function setGasStatus(message) {
  const status = document.getElementById('gasStatus');
  if (status) status.textContent = message;
}


