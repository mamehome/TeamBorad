/*
TeamBoard Google Drive同期用 Apps Script

1. script.google.com で新しいプロジェクトを作成
2. このコードを貼り付け
3. TEAM_KEY をチーム用の合言葉に変更
4. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
5. 実行するユーザー：自分
6. アクセスできるユーザー：全員、またはリンクを知っている全員
7. 発行URLをTeamBoard右上の「同期」に設定
*/

const TEAM_KEY = "ここをチーム用の合言葉に変更";
const FOLDER_NAME = "TeamBoard";
const DATA_FILE_NAME = "teamboard-data.json";

function doGet(e) {
  try {
    const action = e.parameter.action || "load";
    const teamKey = e.parameter.teamKey || "";
    if (teamKey !== TEAM_KEY) return jsonOutput({ ok: false, error: "チームキーが違います" });

    if (action === "load") {
      const file = getOrCreateDataFile();
      const text = file.getBlob().getDataAsString("UTF-8");
      const data = text ? JSON.parse(text) : { version: 5, sessions: [], masters: {} };
      return jsonOutput({ ok: true, data });
    }
    return jsonOutput({ ok: false, error: "Unknown action" });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    if (body.teamKey !== TEAM_KEY) return jsonOutput({ ok: false, error: "チームキーが違います" });

    if (body.action === "save") {
      const file = getOrCreateDataFile();
      const data = body.data || { version: 5, sessions: [], masters: {} };
      data.updatedAt = new Date().toISOString();
      file.setContent(JSON.stringify(data, null, 2));
      return jsonOutput({ ok: true, updatedAt: data.updatedAt, fileUrl: file.getUrl() });
    }
    return jsonOutput({ ok: false, error: "Unknown action" });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  }
}

function getOrCreateDataFile() {
  const folder = getOrCreateFolder();
  const files = folder.getFilesByName(DATA_FILE_NAME);
  if (files.hasNext()) return files.next();
  return folder.createFile(DATA_FILE_NAME, JSON.stringify({ version: 5, sessions: [], masters: {} }, null, 2), MimeType.PLAIN_TEXT);
}

function getOrCreateFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(FOLDER_NAME);
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
