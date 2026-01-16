import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { exportSession } from '../services/export';
import { formatDistanceToNow } from 'date-fns';
import type { SessionInfo } from '../../shared/types';
import { useState } from 'react';

interface SessionListProps {
  selectedProject?: string;
  searchQuery?: string;
}

export default function SessionList({ selectedProject, searchQuery }: SessionListProps) {
  const [exportingSession, setExportingSession] = useState<string | null>(null);

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['sessions', selectedProject, searchQuery],
    queryFn: () => api.getSessions({
      project: selectedProject,
      search: searchQuery,
      limit: 100,
    }),
  });

  const getProjectName = (path: string) => {
    return path.split('/').pop() || path;
  };

  const handleExport = async (e: React.MouseEvent, sessionId: string, project: string) => {
    e.preventDefault();
    e.stopPropagation();
    setExportingSession(sessionId);
    try {
      await exportSession(sessionId, project);
    } catch (error) {
      alert('Failed to export session');
    } finally {
      setExportingSession(null);
    }
  };

  if (isLoading) {
    return (
      <div className="session-list-container">
        <div className="loading">Loading sessions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="session-list-container">
        <div className="error">Error loading sessions: {(error as Error).message}</div>
      </div>
    );
  }

  return (
    <div className="session-list-container">
      <div className="session-list-header">
        <h2>Sessions</h2>
        <span className="count">{sessions?.length || 0} sessions</span>
      </div>

      <div className="session-list">
        {sessions?.map((session: SessionInfo) => (
          <Link
            key={session.sessionId}
            to={`/session/${session.sessionId}?project=${encodeURIComponent(session.project)}`}
            className="session-item"
          >
            <div className="session-content">
              <div className="session-header">
                <span className="project-badge">{getProjectName(session.project)}</span>
                <span className="timestamp">
                  {formatDistanceToNow(new Date(session.timestamp), { addSuffix: true })}
                </span>
              </div>
              <div className="session-display">{session.display || 'No description'}</div>
            </div>
            <button
              className="export-icon-btn"
              onClick={(e) => handleExport(e, session.sessionId, session.project)}
              disabled={exportingSession === session.sessionId}
              title="Export session data"
            >
              {exportingSession === session.sessionId ? '⏳' : '⬇'}
            </button>
          </Link>
        ))}

        {sessions?.length === 0 && (
          <div className="empty-state">No sessions found</div>
        )}
      </div>

      <style>{`
        .session-list-container {
          padding: 24px;
          max-width: 900px;
          margin: 0 auto;
        }

        .session-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .session-list-header h2 {
          font-size: 1.5rem;
          font-weight: 600;
          color: #fff;
        }

        .count {
          color: #888;
          font-size: 0.9rem;
        }

        .loading,
        .error,
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #888;
          font-size: 1rem;
        }

        .error {
          color: #f87171;
        }

        .session-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .session-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          text-decoration: none;
          transition: all 0.15s ease;
          cursor: pointer;
          gap: 12px;
        }

        .session-item:hover {
          background: #252525;
          border-color: #444;
          transform: translateY(-1px);
        }

        .session-content {
          flex: 1;
          min-width: 0;
        }

        .session-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
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
          font-size: 0.75rem;
          color: #666;
        }

        .session-display {
          color: #ccc;
          font-size: 0.9rem;
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .export-icon-btn {
          background: transparent;
          border: none;
          color: #666;
          padding: 8px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.15s ease;
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .export-icon-btn:hover:not(:disabled) {
          background: rgba(124, 58, 237, 0.1);
          color: #7c3aed;
        }

        .export-icon-btn:disabled {
          opacity: 0.6;
          cursor: wait;
        }
      `}</style>
    </div>
  );
}
