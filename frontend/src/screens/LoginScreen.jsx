import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext.jsx';

export function LoginScreen() {
  const { login } = useAuth();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleSuccess(credentialResponse) {
    setError(null);
    setLoading(true);
    try {
      await login(credentialResponse.credential);
    } catch (e) {
      setError(e.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="setup-screen">
      <div className="setup-card login-card">
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '52px', lineHeight: 1.1 }}>📦</div>
          <h1 className="setup-app-name" style={{ marginTop: '8px' }}>Talkment</h1>
          <p className="setup-app-tagline">말로하는 관리 프로그램</p>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />

        {loading ? (
          <p className="setup-desc" style={{ textAlign: 'center' }}>로그인 확인 중...</p>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.')}
              useOneTap
              text="signin_with"
              locale="ko"
              shape="rectangular"
              width="280"
            />
          </div>
        )}

        {error && (
          <div className="form-error" style={{ marginTop: '12px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <p className="setup-desc" style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px' }}>
          스프레드시트 공유 권한이 있는 구글 계정으로 로그인하세요.
        </p>
      </div>
    </div>
  );
}
