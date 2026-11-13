// Desc: Learn English With Gemini - v003
// Dán mã này vào script.google.com rồi Deploy -> Web App (Execute as: Me, Who has access: Anyone)
const ROOT_FOLDER_ID = '1zgWMKCy_xl893Il7rkRXyIC8YADUKx2q'; // Thư mục 'Hoc Tieng Anh 1 Nam'

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getRootFolder() {
  return DriveApp.getFolderById(ROOT_FOLDER_ID);
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
  return { lesson: lesson, recordings: readFolderRecordings(folder, lesson.day) };
}

function readProgress(root) {
  const files = root.getFilesByName('progress.json');
  if (!files.hasNext()) return {};
  try {
    return JSON.parse(files.next().getBlob().getDataAsString('UTF-8')) || {};
  } catch (e) {
    return {};
  }
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
  if (action === 'bootstrap') {
    return jsonOutput({
      days: readDays(root),
      progress: readProgress(root)
    });
  }
  if (action === 'lesson') {
    const result = readLesson(root, e.parameter.day, e.parameter.folderName);
    if (!result) return jsonOutput({ ok: false, error: 'Không tìm thấy bài học hoặc folder ngày.' });
    return jsonOutput({ ok: true, lesson: result.lesson, recordings: result.recordings });
  }
  return jsonOutput(readLessons(root));
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const root = getRootFolder();
    if (body.action === 'saveProgress') {
      const files = root.getFilesByName('progress.json');
      const content = JSON.stringify(body.progress || {});
      if (files.hasNext()) {
        files.next().setContent(content);
      } else {
        root.createFile('progress.json', content, MimeType.PLAIN_TEXT);
      }
      return jsonOutput({ ok: true });
    }

    const dayFolder = findLessonFolder(root, body.day, body.folderName);
    if (!dayFolder) {
      throw new Error('Không tìm thấy folder bài học của ngày ' + body.day + '. File chưa được lưu.');
    }
    const targetFolder = findRecordFolder(dayFolder) || dayFolder.createFolder('record');
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
    return jsonOutput({ ok: false, error: err.message });
  }
}
