import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ProjectSummary } from '../../shared/types';

interface LayoutProps {
  onProjectChange: (project: string | undefined) => void;
  onSearchChange: (search: string) => void;
}

export default function Layout({ onProjectChange, onSearchChange }: LayoutProps) {
  const navigate = useNavigate();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  });

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onProjectChange(value === 'all' ? undefined : value);
    navigate('/');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
    navigate('/');
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>cc-pick</h1>
          <p className="subtitle">Claude Code Session Viewer</p>
        </div>

        <div className="filters">
          <div className="filter-group">
            <label htmlFor="search">Search</label>
            <input
              id="search"
              type="text"
              placeholder="Search sessions..."
              onChange={handleSearchChange}
              className="search-input"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="project">Project</label>
            <select id="project" onChange={handleProjectChange} className="project-select">
              <option value="all">All Projects</option>
              {projects?.map((project: ProjectSummary) => (
                <option key={project.path} value={project.path}>
                  {project.name} ({project.sessionCount})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="sidebar-footer">
          <Link to="/" className="nav-link">Sessions</Link>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .app-container {
          display: flex;
          height: 100vh;
          overflow: hidden;
        }

        .sidebar {
          width: 280px;
          background: #1a1a1a;
          color: #fff;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #333;
          flex-shrink: 0;
        }

        .sidebar-header {
          padding: 20px;
          border-bottom: 1px solid #333;
        }

        .sidebar-header h1 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .subtitle {
          font-size: 0.8rem;
          color: #888;
        }

        .filters {
          padding: 20px;
          flex: 1;
          overflow-y: auto;
        }

        .filter-group {
          margin-bottom: 16px;
        }

        .filter-group label {
          display: block;
          font-size: 0.85rem;
          font-weight: 500;
          margin-bottom: 6px;
          color: #ccc;
        }

        .search-input,
        .project-select {
          width: 100%;
          padding: 10px 12px;
          background: #2a2a2a;
          border: 1px solid #444;
          border-radius: 6px;
          color: #fff;
          font-size: 0.9rem;
        }

        .search-input:focus,
        .project-select:focus {
          outline: none;
          border-color: #666;
        }

        .project-select {
          cursor: pointer;
        }

        .sidebar-footer {
          padding: 16px 20px;
          border-top: 1px solid #333;
        }

        .nav-link {
          color: #fff;
          text-decoration: none;
          font-weight: 500;
          padding: 8px 0;
          display: block;
        }

        .nav-link:hover {
          color: #ccc;
        }

        .main-content {
          flex: 1;
          overflow-y: auto;
          background: #0d0d0d;
        }
      `}</style>
    </div>
  );
}
