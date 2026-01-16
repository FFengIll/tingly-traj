import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { exportSession } from '../services/export';
import { formatDistanceToNow } from 'date-fns';
import type { SessionDetail, Message } from '../../shared/types';
import { useState } from 'react';

export default function SessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);

  // Get project from URL query parameter
  const project = searchParams.get('project') || undefined;

  const { data: session, isLoading, error } = useQuery({
    queryKey: ['session', sessionId, project],
    queryFn: () => api.getSession(sessionId!, project!),
    enabled: !!sessionId && !!project,
  });

  if (isLoading) {
    return (
      <div className="session-detail-container">
        <div className="loading">Loading session...</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="session-detail-container">
        <div className="error">Error loading session</div>
        <Link to="/" className="back-link">← Back to sessions</Link>
      </div>
    );
  }

  const getProjectName = (path: string) => {
    return path.split('/').pop() || path;
  };

  const handleExport = async () => {
    if (!sessionId || !project) return;
    setIsExporting(true);
    try {
      await exportSession(sessionId, project);
    } catch (error) {
      alert('Failed to export session');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="session-detail-container">
      <div className="session-detail-header">
        <div className="header-left">
          <button onClick={() => navigate(-1)} className="back-button">← Back</button>
        </div>
        <div className="header-right">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="export-button"
            title="Export raw session data"
          >
            {isExporting ? '⏳ Exporting...' : '⬇ Export'}
          </button>
          <div className="header-info">
            <span className="project-badge">{getProjectName(session.project)}</span>
            <span className="timestamp">
              {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>

      <div className="session-title">{session.display || 'Untitled Session'}</div>

      <div className="messages">
        {session.messages.map((message: Message, index: number) => (
          <MessageBubble key={`${message.messageId}-${index}`} message={message} />
        ))}
      </div>

      <style>{`
        .session-detail-container {
          padding: 24px;
          max-width: 900px;
          margin: 0 auto;
        }

        .loading,
        .error {
          text-align: center;
          padding: 60px 20px;
          color: #888;
        }

        .error {
          color: #f87171;
        }

        .back-link {
          display: inline-block;
          margin-top: 16px;
          color: #7c3aed;
          text-decoration: none;
        }

        .session-detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .header-left {
          display: flex;
          align-items: center;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .back-button {
          background: transparent;
          border: 1px solid #444;
          color: #ccc;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.15s ease;
        }

        .back-button:hover {
          background: #252525;
          border-color: #666;
        }

        .export-button {
          background: #1a1a1a;
          border: 1px solid #7c3aed;
          color: #7c3aed;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .export-button:hover:not(:disabled) {
          background: rgba(124, 58, 237, 0.1);
          border-color: #8b5cf6;
        }

        .export-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .header-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .project-badge {
          font-size: 0.75rem;
          font-weight: 600;
          color: #7c3aed;
          background: rgba(124, 58, 237, 0.1);
          padding: 4px 8px;
          border-radius: 4px;
        }

        .timestamp {
          font-size: 0.8rem;
          color: #666;
        }

        .session-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #fff;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #333;
        }

        .messages {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .message {
          padding: 16px;
          border-radius: 8px;
          line-height: 1.5;
        }

        .message-user {
          background: #1a1a1a;
          border: 1px solid #333;
        }

        .message-assistant {
          background: #121212;
          border: 1px solid #333;
        }

        .message-snapshot {
          background: rgba(124, 58, 237, 0.05);
          border: 1px dashed rgba(124, 58, 237, 0.3);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .snapshot-indicator {
          color: #7c3aed;
          font-size: 0.85rem;
        }

        .message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .role {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .message-user .role {
          color: #22c55e;
        }

        .message-assistant .role {
          color: #3b82f6;
        }

        .message-content {
          color: #ccc;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.type === 'file-history-snapshot') {
    return (
      <div className="message message-snapshot">
        <span className="snapshot-indicator">📁 File History Snapshot</span>
        <span className="timestamp">
          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
        </span>
      </div>
    );
  }

  const isUser = message.type === 'user';

  // Handle different content types
  let contentText: string;
  if (typeof message.content === 'string') {
    contentText = message.content;
  } else if (typeof message.content === 'object' && message.content !== null) {
    // Handle structured content (e.g., {type: 'text', text: '...'})
    if ('text' in message.content && typeof message.content.text === 'string') {
      contentText = message.content.text;
    } else {
      contentText = JSON.stringify(message.content, null, 2);
    }
  } else {
    contentText = String(message.content ?? '');
  }

  return (
    <div className={`message ${isUser ? 'message-user' : 'message-assistant'}`}>
      <div className="message-header">
        <span className="role">{isUser ? 'You' : 'Claude'}</span>
        <span className="timestamp">
          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
        </span>
      </div>
      <div className="message-content">{contentText}</div>
    </div>
  );
}
