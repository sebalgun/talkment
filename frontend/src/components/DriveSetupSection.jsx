import { useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  getDriveFolderId,
  setDriveFolderId,
  parseDriveFolderId,
  isDriveConfigured,
} from '../utils/driveConfig';
import { getActiveSheet } from '../utils/sheetConfig';

export default function DriveSetupSection({ defaultExpanded = false, embedded = false }) {
  const [folderInput, setFolderInput] = useState(getDriveFolderId());
  const [savedId, setSavedId] = useState(getDriveFolderId());
  const [serviceEmail, setServiceEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState('loading');
  const [expanded, setExpanded] = useState(embedded || defaultExpanded || !isDriveConfigured());

  const loadServiceEmail = () => {
    setEmailStatus('loading');
    api
      .getPublicConfig()
      .then((c) => {
        if (c.serviceAccountEmail) {
          setServiceEmail(c.serviceAccountEmail);
          setEmailStatus('ok');
        } else {
          setServiceEmail('');
          setEmailStatus('error');
        }
      })
      .catch(() => {
        setServiceEmail('');
        setEmailStatus('error');
      });
  };

  useEffect(() => {
    loadServiceEmail();
  }, []);

  const parsedId = parseDriveFolderId(folderInput);

  const syncDriveToServer = async (driveFolderId) => {
    const sheet = getActiveSheet();
    if (!sheet?.spreadsheetId) return;
    try {
      await api.saveAppConfig({
        sheet: {
          spreadsheetId: sheet.spreadsheetId,
          url: sheet.url,
          title: sheet.title,
          alias: sheet.alias,
        },
        driveFolderId: driveFolderId || null,
      });
    } catch {
      /* ignore */
    }
  };

  const handleSave = () => {
    if (!parsedId) return;
    setDriveFolderId(parsedId);
    setSavedId(parsedId);
    setFolderInput(parsedId);
    syncDriveToServer(parsedId);
  };

  const handleClear = () => {
    setDriveFolderId('');
    setSavedId('');
    setFolderInput('');
    syncDriveToServer(null);
  };

  return (
    <section className={`card drive-setup-section${embedded ? ' drive-setup-section-embedded' : ''}`}>
      {!embedded && (
        <button
          type="button"
          className="drive-setup-toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          <span>📝 서명 이미지 — Google Drive 연결</span>
          <span className="drive-setup-badge">
            {savedId ? '연결됨' : '선택 (미설정 시 텍스트만 저장)'}
          </span>
        </button>
      )}

      {embedded && (
        <div className="drive-setup-embedded-header">
          <p className="setup-desc">
            출고·반납 서명 이미지를 Google Drive에 저장합니다.
            <strong> PC(서버)당 한 번</strong>만 설정하면 됩니다.
            {savedId ? (
              <span className="badge badge-ok" style={{ marginLeft: 8 }}>연결됨</span>
            ) : (
              <span className="drive-setup-badge" style={{ marginLeft: 8 }}>선택 (미설정 시 텍스트만 저장)</span>
            )}
          </p>
        </div>
      )}

      {expanded && (
        <div className="drive-setup-body">
          {!embedded && (
            <p className="setup-desc">
              출고·반납 서명 이미지를 Google Drive에 저장합니다.
              <strong> PC(서버)당 한 번</strong>만 설정하면 됩니다.
            </p>
          )}

          <ol className="drive-setup-steps">
            <li>
              <a href="https://drive.google.com" target="_blank" rel="noreferrer">
                Google Drive
              </a>
              에서 <strong>서명</strong> 폴더를 만듭니다.
            </li>
            <li>
              폴더 <strong>공유</strong> → 아래 이메일을 <strong>편집자</strong>로 추가합니다.
              <code className={`service-email${emailStatus === 'error' ? ' service-email-error' : ''}`}>
                {emailStatus === 'loading' && '이메일 불러오는 중…'}
                {emailStatus === 'ok' && serviceEmail}
                {emailStatus === 'error' && (
                  <>
                    이메일을 불러오지 못했습니다.{' '}
                    <button type="button" className="link-btn" onClick={loadServiceEmail}>
                      다시 시도
                    </button>
                    {' '}또는 시작.bat으로 서버를 재시작해 주세요.
                  </>
                )}
              </code>
            </li>
            <li>폴더를 연 뒤 주소창 URL을 아래에 붙여넣고 저장합니다.</li>
          </ol>

          <div className="form-group">
            <label>Drive 폴더 URL 또는 ID</label>
            <input
              type="text"
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
            />
            {parsedId && <span className="parsed-id">폴더 ID: {parsedId}</span>}
          </div>

          <div className="btn-row">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={!parsedId}
            >
              Drive 연결 저장
            </button>
            {savedId && (
              <button className="btn btn-outline btn-sm" onClick={handleClear}>
                연결 해제
              </button>
            )}
          </div>

          {savedId && (
            <div className="status-msg success">
              서명 이미지가 Drive 폴더에 저장됩니다.
            </div>
          )}
          {!savedId && (
            <div className="status-msg info">
              Drive 미연결 시 시트에 「서명완료」 텍스트만 기록됩니다.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
