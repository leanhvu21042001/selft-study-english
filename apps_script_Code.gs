// Desc: Learn English With Gemini - v007
// Dán mã này vào script.google.com rồi Deploy -> Web App (Execute as: Me, Who has access: Anyone)
const ROOT_FOLDER_ID = '1zgWMKCy_xl893Il7rkRXyIC8YADUKx2q'; // Thư mục 'Hoc Tieng Anh 1 Nam'
const MAX_USERS = 1000;
const USER_FOLDER_NAME = 'users';

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getRootFolder() {
  return DriveApp.getFolderById(ROOT_FOLDER_ID);
}

function getUsersFolder(root) {
  const folders = root.getFoldersByName(USER_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : root.createFolder(USER_FOLDER_NAME);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function emailKey(email) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalizeEmail(email));
  return bytes.map(function(byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function hashValue(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''));
  return bytes.map(function(byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function createToken() {
  return Utilities.getUuid() + Utilities.getUuid();
}

function readUser(root, email) {
  const files = getUsersFolder(root).getFilesByName(emailKey(email) + '.json');
  if (!files.hasNext()) return null;
  try {
    const file = files.next();
    const user = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
    user._fileId = file.getId();
    return user;
  } catch (e) {
    return null;
  }
}

function saveUser(root, user) {
  const folder = getUsersFolder(root);
  const name = emailKey(user.email) + '.json';
  const files = folder.getFilesByName(name);
  delete user._fileId;
  const content = JSON.stringify(user);
  if (files.hasNext()) files.next().setContent(content);
  else folder.createFile(name, content, MimeType.PLAIN_TEXT);
}

function countUsers(root) {
  const files = getUsersFolder(root).getFiles();
  let count = 0;
  while (files.hasNext()) {
    if (/^[a-f0-9]{64}\.json$/.test(files.next().getName())) count++;
  }
  return count;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function requireAuth(root, token) {
  const tokenHash = hashValue(token);
  const files = getUsersFolder(root).getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (!/^[a-f0-9]{64}\.json$/.test(file.getName())) continue;
    try {
      const user = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
      const session = (user.sessions || []).find(item => item.hash === tokenHash);
      if (session) {
        session.lastSeenAt = new Date().toISOString();
        file.setContent(JSON.stringify(user));
        return user;
      }
    } catch (e) {}
  }
  throw new Error('AUTH_REQUIRED');
}

function appendUserLog(user, action, details) {
  user.logs = user.logs || [];
  user.logs.push({
    at: new Date().toISOString(),
    action: action,
    details: details || {}
  });
  if (user.logs.length > 2000) user.logs = user.logs.slice(-2000);
}

function authError(message, reason) {
  return jsonOutput({ ok: false, error: message, authRequired: message === 'AUTH_REQUIRED', reason: reason || '' });
}

function authErrorForRequest(root, email, codeVersion, error) {
  const user = readUser(root, email);
  const reason = user && Number(codeVersion || 0) < Number(user.codeVersion || 1)
    ? 'CODE_CHANGED'
    : '';
  return authError(error.message, reason);
}

function readLessons(root) {
  const lessons = [];
  const folders = root.getFolders();
  while (folders.hasNext()) {
    const f = folders.next();
    const files = f.getFilesByName('lesson.json');
    if (files.hasNext()) {
      try { lessons.push(JSON.parse(files.next().getBlob().getDataAsString('UTF-8'))); } catch (e) {}
    }
  }
  lessons.sort((a, b) => (a.day || 0) - (b.day || 0));
  return lessons;
}

function readDays(root) {
  return readLessons(root).map(function(lesson) {
    return {
      day: lesson.day,
      title: lesson.title || ('Ngày ' + lesson.day),
      folderName: lesson.folderName || ('Ngay ' + String(lesson.day).padStart(2, '0')),
      createdDate: lesson.createdDate || '',
      wordCount: (lesson.words || []).length
    };
  });
}

function findLessonFolder(root, day, folderName) {
  if (folderName) {
    const namedFolders = root.getFoldersByName(folderName);
    if (namedFolders.hasNext()) return namedFolders.next();
  }
  const folders = root.getFolders();
  while (folders.hasNext()) {
    const folder = folders.next();
    const files = folder.getFilesByName('lesson.json');
    if (!files.hasNext()) continue;
    try {
      const lesson = JSON.parse(files.next().getBlob().getDataAsString('UTF-8'));
      if (String(lesson.day) === String(day)) return folder;
    } catch (e) {}
  }
  return null;
}

function findLessonDocumentUrl(dayFolder) {
  if (!dayFolder) return '';
  const files = dayFolder.getFiles();
  let fallback = '';
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName() === 'lesson.json') continue;
    if (!/\.docx?$/i.test(file.getName())) continue;
    if (/\.docx$/i.test(file.getName())) return file.getUrl();
    fallback = file.getUrl();
  }
  return fallback;
}

function findRecordFolder(dayFolder) {
  if (!dayFolder) return null;
  const folders = dayFolder.getFolders();
  while (folders.hasNext()) {
    const folder = folders.next();
    if (folder.getName().toLowerCase() === 'record') return folder;
  }
  return null;
}

function getRecordingLabel(key) {
  const dialogue = /^dialogue-(\d+)$/.exec(key || '');
  if (dialogue) return 'Đoạn hội thoại ' + (Number(dialogue[1]) + 1);
  const essay = /^essay-(\d+)$/.exec(key || '');
  if (essay) return 'Đoạn bài văn ' + (Number(essay[1]) + 1);
  return 'Bản ghi chung';
}

function getRecordingUrls(file) {
  let downloadUrl = 'https://drive.google.com/uc?export=download&id=' + file.getId();
  try {
    downloadUrl = file.getDownloadUrl() || downloadUrl;
  } catch (e) {}
  return {
    url: downloadUrl,
    driveUrl: file.getUrl()
  };
}

function readFolderRecordings(dayFolder, day) {
  const recordings = [];
  const recordFolder = findRecordFolder(dayFolder);
  if (!recordFolder) return recordings;
  const files = recordFolder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (!/\.webm$/i.test(file.getName())) continue;
    const nameParts = file.getName().split('__');
    let publicAccess = true;
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      publicAccess = false;
    }
    const urls = getRecordingUrls(file);
    recordings.push({
      day: day,
      dayFolder: dayFolder.getName(),
      folder: recordFolder.getName(),
      key: nameParts.length > 1 ? nameParts[0].replace(/^day\d+_/, '') : 'general',
      label: getRecordingLabel(nameParts[0].replace(/^day\d+_/, '')),
      name: file.getName(),
      url: urls.url,
      driveUrl: urls.driveUrl,
      publicAccess: publicAccess
    });
  }
  return recordings;
}

function readLesson(root, day, folderName) {
  const folder = findLessonFolder(root, day, folderName);
  if (!folder) return null;
  const files = folder.getFilesByName('lesson.json');
  if (!files.hasNext()) return null;
  const lesson = JSON.parse(files.next().getBlob().getDataAsString('UTF-8'));
  return {
    lesson: lesson,
    documentUrl: findLessonDocumentUrl(folder)
  };
}

function readUserRecordings(root, user, day) {
  const recordings = [];
  const folders = getUsersFolder(root).getFoldersByName(emailKey(user.email));
  if (!folders.hasNext()) return recordings;
  const recordFolders = folders.next().getFoldersByName('record');
  if (!recordFolders.hasNext()) return recordings;
  const files = recordFolders.next().getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (!/\.webm$/i.test(file.getName()) || file.getName().indexOf('__day' + day + '_') < 0) continue;
    const nameParts = file.getName().split('__');
    const key = nameParts.length > 1 ? nameParts[0].replace(/^day\d+_/, '') : 'general';
    const urls = getRecordingUrls(file);
    recordings.push({
      day: day,
      folder: 'record',
      key: key,
      label: getRecordingLabel(key),
      name: file.getName(),
      url: urls.url,
      driveUrl: urls.driveUrl,
      publicAccess: true
    });
  }
  return recordings;
}

function readProgress(root) {
  return {};
}

function readRecordings(root) {
  const recordings = [];
  const folders = root.getFolders();
  while (folders.hasNext()) {
    const folder = folders.next();
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (!/\.webm$/i.test(file.getName())) continue;
      const nameParts = file.getName().split('__');
      const key = nameParts.length > 1 ? nameParts[0].replace(/^day\d+_/, '') : 'general';
      recordings.push({
        folder: folder.getName(),
        key: key,
        name: file.getName(),
        url: 'https://drive.google.com/uc?export=download&id=' + file.getId()
      });
    }
  }
  return recordings;
}

function doGet(e) {
  const root = getRootFolder();
  const action = e && e.parameter ? e.parameter.action : '';
  if (action === 'authStatus') {
    try {
      const user = requireAuth(root, e.parameter.token);
      return jsonOutput({ ok: true, email: user.email, codeVersion: user.codeVersion });
    } catch (err) {
      return authErrorForRequest(root, e.parameter.email, e.parameter.codeVersion, err);
    }
  }
  let user;
  try {
    user = requireAuth(root, e.parameter.token);
  } catch (err) {
    return authErrorForRequest(root, e.parameter.email, e.parameter.codeVersion, err);
  }
  if (action === 'bootstrap') {
    return jsonOutput({
      days: readDays(root),
      progress: user.progress || {}
    });
  }
  if (action === 'lesson') {
    const result = readLesson(root, e.parameter.day, e.parameter.folderName);
    if (!result) return jsonOutput({ ok: false, error: 'Không tìm thấy bài học hoặc folder ngày.' });
    return jsonOutput({
      ok: true,
      lesson: result.lesson,
      recordings: readUserRecordings(root, user, result.lesson.day),
      documentUrl: result.documentUrl
    });
  }
  return jsonOutput(readLessons(root));
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const root = getRootFolder();
    const action = body.action;
    if (action === 'login') {
      const email = normalizeEmail(body.email);
      const code = String(body.code || '').trim();
      if (!validateEmail(email) || code.length < 4 || code.length > 128) {
        return jsonOutput({ ok: false, error: 'Email hoặc mã khóa không hợp lệ.' });
      }
      let user = readUser(root, email);
      if (!user) {
        if (countUsers(root) >= MAX_USERS) return jsonOutput({ ok: false, error: 'Hệ thống đã đủ 1000 người học.' });
        user = { email: email, salt: createToken(), codeVersion: 1, sessions: [], progress: {}, logs: [] };
        user.codeHash = hashValue(user.salt + code);
      } else if (user.codeHash !== hashValue(user.salt + code)) {
        return jsonOutput({ ok: false, error: 'Email hoặc mã khóa không đúng.', canReset: true });
      }
      const token = createToken();
      user.sessions = (user.sessions || []).filter(item => item.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      user.sessions.push({ hash: hashValue(token), createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() });
      appendUserLog(user, 'login', { codeVersion: user.codeVersion });
      saveUser(root, user);
      return jsonOutput({ ok: true, token: token, email: user.email, codeVersion: user.codeVersion });
    }
    if (action === 'requestReset') {
      const email = normalizeEmail(body.email);
      const user = readUser(root, email);
      if (user && validateEmail(email)) {
        const token = createToken();
        user.reset = { hash: hashValue(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() };
        saveUser(root, user);
        const resetUrl = String(body.resetUrl || '').split('#')[0];
        const separator = resetUrl.indexOf('?') >= 0 ? '&' : '?';
        MailApp.sendEmail(email, 'Cập nhật mã khóa học tiếng Anh', 'Mở đường link này để đặt mã khóa mới (có hiệu lực 30 phút):\n\n' + resetUrl + separator + 'reset=' + encodeURIComponent(token) + '&email=' + encodeURIComponent(email));
      }
      return jsonOutput({ ok: true, message: 'Nếu email tồn tại, đường link cập nhật mã đã được gửi.' });
    }
    if (action === 'resetCode') {
      const email = normalizeEmail(body.email);
      const code = String(body.code || '').trim();
      const user = readUser(root, email);
      if (!user || code.length < 4 || code.length > 128 || !user.reset || user.reset.expiresAt < new Date().toISOString() || user.reset.hash !== hashValue(body.token)) {
        return jsonOutput({ ok: false, error: 'Đường link cập nhật không hợp lệ hoặc đã hết hạn.' });
      }
      user.salt = createToken();
      user.codeHash = hashValue(user.salt + code);
      user.codeVersion = (user.codeVersion || 1) + 1;
      user.sessions = [];
      delete user.reset;
      appendUserLog(user, 'resetCode', { codeVersion: user.codeVersion });
      saveUser(root, user);
      return jsonOutput({ ok: true, message: 'Đã cập nhật mã khóa. Các phiên học cũ đã bị thu hồi.' });
    }
    const user = requireAuth(root, body.token);
    if (action === 'saveProgress') {
      user.progress = body.progress || {};
      appendUserLog(user, 'saveProgress', { lessonCount: Object.keys(user.progress.lessons || {}).length });
      saveUser(root, user);
      return jsonOutput({ ok: true });
    }

    const dayFolder = findLessonFolder(root, body.day, body.folderName);
    if (!dayFolder) {
      throw new Error('Không tìm thấy folder bài học của ngày ' + body.day + '. File chưa được lưu.');
    }
    const userFolder = getUsersFolder(root);
    const personalFolders = userFolder.getFoldersByName(emailKey(user.email));
    const personalFolder = personalFolders.hasNext() ? personalFolders.next() : userFolder.createFolder(emailKey(user.email));
    const targetFolder = personalFolder.getFoldersByName('record').hasNext()
      ? personalFolder.getFoldersByName('record').next()
      : personalFolder.createFolder('record');
    if (!body.recordingKey || !body.recordingLabel) {
      throw new Error('Thiếu thông tin phần ghi âm. File chưa được lưu.');
    }
    const bytes = Utilities.base64Decode(body.data);
    const blob = Utilities.newBlob(bytes, body.mimeType || 'audio/webm', body.fileName);
    const file = targetFolder.createFile(blob);
    let publicAccess = true;
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sharingError) {
      publicAccess = false;
    }
    const urls = getRecordingUrls(file);
    appendUserLog(user, 'uploadRecording', { day: body.day, recordingKey: body.recordingKey });
    saveUser(root, user);
    return jsonOutput({
      ok: true,
      day: body.day,
      id: file.getId(),
      folder: body.folderName,
      key: body.recordingKey || 'general',
      label: body.recordingLabel,
      name: file.getName(),
      url: urls.url,
      driveUrl: urls.driveUrl,
      publicAccess: publicAccess
    });
  } catch (err) {
    if (err.message === 'AUTH_REQUIRED') {
      const requestUser = body ? readUser(getRootFolder(), body.email) : null;
      const reason = requestUser && Number(body.codeVersion || 0) < Number(requestUser.codeVersion || 1)
        ? 'CODE_CHANGED'
        : '';
      return authError(err.message, reason);
    }
    return jsonOutput({ ok: false, error: err.message, authRequired: false });
  }
}
