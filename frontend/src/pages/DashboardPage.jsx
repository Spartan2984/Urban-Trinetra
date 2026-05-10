import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  ArcElement,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from 'chart.js';
import { api } from '../api/client';
import { MetricCard } from '../components/MetricCard';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, LineElement, PointElement, Tooltip, Legend);

export function DashboardPage() {
  const { user } = useSelector((state) => state.auth);
  const [metrics, setMetrics] = useState(null);
  const [staff, setStaff] = useState([]);
  const [staffId, setStaffId] = useState('');
  const [officerChart, setOfficerChart] = useState('volume');
  const [leaderboards, setLeaderboards] = useState(null);

  useEffect(() => {
    api.get('/admin/leaderboards').then(({ data }) => setLeaderboards(data.data));
  }, []);

  useEffect(() => {
    const suffix = staffId ? `?staffId=${staffId}` : '';
    api.get(`/complaints/metrics${suffix}`).then(({ data }) => setMetrics(data.data));
  }, [staffId]);

  useEffect(() => {
    if (user.role === 'admin') {
      api.get('/admin/users').then(({ data }) => setStaff(data.data.users.filter((item) => item.role !== 'citizen')));
    }
  }, [user.role]);

  if (!metrics) return <section className="panel">Loading dashboard...</section>;
  const selectedStaff = staff.find((item) => item._id === staffId);
  const analyticsRole = selectedStaff?.role || user.role;

  const categoryData = {
    labels: metrics.byCategory.map((item) => item._id),
    datasets: [{ label: 'Complaints', data: metrics.byCategory.map((item) => item.count), backgroundColor: '#2563eb' }]
  };
  const statusData = {
    labels: metrics.byStatus.map((item) => item._id),
    datasets: [{ data: metrics.byStatus.map((item) => item.count), backgroundColor: ['#2563eb', '#0891b2', '#f59e0b', '#16a34a', '#64748b', '#dc2626'] }]
  };
  const trendData = {
    labels: metrics.monthly.map((item) => `${item._id.month}/${item._id.year}`),
    datasets: [{ label: 'Monthly complaints', data: metrics.monthly.map((item) => item.count), borderColor: '#0f766e', tension: 0.25 }]
  };
  const officerVolumeData = {
    labels: ['Pending', 'Completed'],
    datasets: [{ data: [metrics.pendingComplaints.length, metrics.completedCount], backgroundColor: ['#f59e0b', '#16a34a'] }]
  };
  const timelinessData = {
    labels: ['Finished in time', 'Finished late'],
    datasets: [{ data: [metrics.onTimeCount, metrics.lateCount], backgroundColor: ['#16a34a', '#dc2626'] }]
  };

  return (
    <section className="stack">
      {user.role === 'admin' && (
        <div className="panel filter-row">
          <select value={staffId} onChange={(event) => setStaffId(event.target.value)}>
            <option value="">System-wide analytics</option>
            {staff.map((item) => <option key={item._id} value={item._id}>{item.name} - {item.role}</option>)}
          </select>
          <button type="button" className="danger-button" style={{ marginLeft: 'auto' }} onClick={async () => {
            try {
              const { data } = await api.post('/complaints/escalate-overdue');
              alert(`${data.data.modified} complaints escalated.`);
              window.location.reload();
            } catch (err) {
              alert('Failed to trigger escalation.');
            }
          }}>
            Trigger SLA Escalation
          </button>
        </div>
      )}
      <div className="metrics-grid">
        <MetricCard label="Total complaints" value={metrics.total} />
        <MetricCard label={analyticsRole === 'supervisor' ? 'Submitted' : 'Pending'} value={analyticsRole === 'supervisor' ? metrics.submittedCount : metrics.pendingCount} />
        <MetricCard label={analyticsRole === 'supervisor' ? 'Completion requests' : 'Completed'} value={analyticsRole === 'supervisor' ? metrics.completionRequestCount : metrics.completedCount} />
      </div>
      {metrics.activeComplaint && (
        <div className="panel active-work">
          <div>
            <h2>Active Complaint</h2>
            <p>{metrics.activeComplaint.complaintId} - {metrics.activeComplaint.title}</p>
          </div>
          <Link className="button-link" to={`/complaints/${metrics.activeComplaint._id}`}>Open</Link>
        </div>
      )}
      {analyticsRole === 'officer' && (
        <div className="panel">
          <div className="toolbar">
            <h2>Officer Record</h2>
            <select value={officerChart} onChange={(event) => setOfficerChart(event.target.value)}>
              <option value="volume">Pending vs completed</option>
              <option value="time">Finished in time vs late</option>
            </select>
          </div>
          <Doughnut data={officerChart === 'volume' ? officerVolumeData : timelinessData} />
        </div>
      )}
      {metrics.pendingComplaints.length > 0 && (
        <div className="panel">
          <h2>{analyticsRole === 'officer' ? 'Your Work Queue' : analyticsRole === 'citizen' ? 'My Complaints' : 'System Queue'}</h2>
          <ul className="timeline">
            {metrics.pendingComplaints.map((complaint) => (
              <li key={complaint._id}>
                <strong><Link to={`/complaints/${complaint._id}`}>{complaint.complaintId}</Link></strong>
                <span>{complaint.status} - due {new Date(complaint.dueAt).toLocaleString()}</span>
                <p>{complaint.title}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analyticsRole === 'citizen' && metrics.auditingComplaints?.length > 0 && (
        <div className="panel">
          <h2>Required Audits</h2>
          <p className="error">You have been selected as an independent auditor for these complaints.</p>
          <ul className="timeline">
            {metrics.auditingComplaints.map((complaint) => (
              <li key={complaint._id}>
                <strong><Link to={`/complaints/${complaint._id}`}>{complaint.complaintId}</Link></strong>
                <span>Audit Due: {new Date(complaint.auditors.find(a => a.auditor === user._id || a.auditor._id === user._id).dueDate).toLocaleString()}</span>
                <p>{complaint.title}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="chart-grid">
        <div className="panel"><h2>By Category</h2><Bar data={categoryData} /></div>
        <div className="panel"><h2>By Status</h2><Doughnut data={statusData} /></div>
        <div className="panel wide"><h2>Monthly Trend</h2><Line data={trendData} /></div>
      </div>

      {leaderboards && (
        <div className="leaderboards-section stack">
          <div className="toolbar">
            <h2>Civic Leaderboards</h2>
            <p className="subtext">Top contributors by reputation score</p>
          </div>
          <div className="chart-grid">
            <div className="panel">
              <h3>Top Auditors</h3>
              <ul className="timeline">
                {leaderboards.topAuditors.map((u, i) => (
                  <li key={u._id} className="row-between">
                    <div className="row-center">
                      <span className="avatar-small">{u.profileImage?.url ? <img src={u.profileImage.url} alt="" /> : (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤')}</span>
                      <span>{u.name}</span>
                    </div>
                    <strong className="success-text">{u.reputationScore}</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel">
              <h3>Top Officers</h3>
              <ul className="timeline">
                {leaderboards.topOfficers.map((u, i) => (
                  <li key={u._id} className="row-between">
                    <div className="row-center">
                      <span className="avatar-small">{u.profileImage?.url ? <img src={u.profileImage.url} alt="" /> : (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤')}</span>
                      <div>
                        <p className="font-bold">{u.name}</p>
                        <small className="subtext">{u.department?.name}</small>
                      </div>
                    </div>
                    <div className="stack-end">
                      <strong className="success-text">{u.reputationScore}</strong>
                      <div className="row-center small-gap">
                        <a href={`mailto:${u.email}`} className="ghost-button icon-only">Mail</a>
                        {u.phone && <a href={`tel:${u.phone}`} className="ghost-button icon-only">Call</a>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel">
              <h3>Top Supervisors</h3>
              <ul className="timeline">
                {leaderboards.topSupervisors.map((u, i) => (
                  <li key={u._id} className="row-between">
                    <div className="row-center">
                      <span className="avatar-small">{u.profileImage?.url ? <img src={u.profileImage.url} alt="" /> : (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤')}</span>
                      <div>
                        <p className="font-bold">{u.name}</p>
                        <small className="subtext">{u.department?.name}</small>
                      </div>
                    </div>
                    <div className="stack-end">
                      <strong className="success-text">{u.reputationScore}</strong>
                      <div className="row-center small-gap">
                        <a href={`mailto:${u.email}`} className="ghost-button icon-only">Mail</a>
                        {u.phone && <a href={`tel:${u.phone}`} className="ghost-button icon-only">Call</a>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {leaderboards && (
        <div className="leaderboards-section stack">
          <div className="toolbar">
            <h2 className="error-text">Civic Loserboards (Hall of Shame)</h2>
            <p className="subtext">Staff requiring urgent performance review</p>
          </div>
          <div className="chart-grid">
            <div className="panel">
              <h3>Bottom Officers</h3>
              <ul className="timeline">
                {leaderboards.bottomOfficers.map((u, i) => (
                  <li key={u._id} className="row-between accountability-card">
                    <div className="row-center">
                      <span className="avatar-large">{u.profileImage?.url ? <img src={u.profileImage.url} alt="" /> : '💀'}</span>
                      <div>
                        <p className="font-bold error-text">{u.name}</p>
                        <small>{u.department?.name}</small>
                        {u.status && <p className="badge danger small">{u.status.replace('_', ' ')}</p>}
                      </div>
                    </div>
                    <div className="stack-end">
                      <strong className="error-text">{u.reputationScore}</strong>
                      {u.salaryImpact && <small className="error-text font-bold">Salary: {u.salaryImpact}</small>}
                      <div className="row-center small-gap">
                        <a href={`mailto:${u.email}`} className="button small danger-border">Contact Email</a>
                        {u.phone && <a href={`tel:${u.phone}`} className="button small danger-border">Call Office</a>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel">
              <h3>Bottom Supervisors</h3>
              <ul className="timeline">
                {leaderboards.bottomSupervisors.map((u, i) => (
                  <li key={u._id} className="row-between accountability-card">
                    <div className="row-center">
                      <span className="avatar-large">{u.profileImage?.url ? <img src={u.profileImage.url} alt="" /> : '💀'}</span>
                      <div>
                        <p className="font-bold error-text">{u.name}</p>
                        <small>{u.department?.name}</small>
                        {u.status && <p className="badge danger small">{u.status.replace('_', ' ')}</p>}
                      </div>
                    </div>
                    <div className="stack-end">
                      <strong className="error-text">{u.reputationScore}</strong>
                      {u.salaryImpact && <small className="error-text font-bold">Budget: {u.salaryImpact}</small>}
                      <div className="row-center small-gap">
                        <a href={`mailto:${u.email}`} className="button small danger-border">Contact Email</a>
                        {u.phone && <a href={`tel:${u.phone}`} className="button small danger-border">Call Office</a>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
