import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { categories, statuses } from '../utils/options';

export function ComplaintsPage() {
  const { user } = useSelector((state) => state.auth);
  const [complaints, setComplaints] = useState([]);
  const [filters, setFilters] = useState({ status: '', category: '' });

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.category) params.set('category', filters.category);
    api.get(`/complaints?${params.toString()}`).then(({ data }) => setComplaints(data.data.items));
  }, [filters]);

  return (
    <section className="stack">
      <div className="toolbar">
        <div>
          <h2>Complaints</h2>
          <p>Filtered by your role and permissions.</p>
        </div>
        {user.role === 'citizen' && <Link className="button-link" to="/complaints/new">New complaint</Link>}
      </div>
      <div className="filter-row">
        <select value={filters.status} onChange={(e) => setFilters((value) => ({ ...value, status: e.target.value }))}>
          <option value="">All statuses</option>
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select value={filters.category} onChange={(e) => setFilters((value) => ({ ...value, category: e.target.value }))}>
          <option value="">All categories</option>
          {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((complaint) => (
              <tr key={complaint._id}>
                <td><Link to={`/complaints/${complaint._id}`}>{complaint.complaintId}</Link></td>
                <td>{complaint.title}</td>
                <td>{complaint.category}</td>
                <td><StatusBadge status={complaint.status} /></td>
                <td className={new Date(complaint.dueAt) < new Date() && !['CLOSED', 'VERIFIED'].includes(complaint.status) ? 'error-text font-bold' : ''}>
                  {new Date(complaint.dueAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
