import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { api, apiMessage } from '../api/client';

export function AdminPage() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [departmentForm, setDepartmentForm] = useState({ name: '', code: '', description: '' });
  const [staffForm, setStaffForm] = useState({ name: '', email: '', phone: '', password: '', role: 'officer', department: '' });

  const load = async () => {
    const [userRes, deptRes] = await Promise.all([api.get('/admin/users'), api.get('/admin/departments')]);
    setUsers(userRes.data.data.users);
    setDepartments(deptRes.data.data.departments);
    try {
      const auditRes = await api.get('/admin/audit-logs?limit=20');
      setLogs(auditRes.data.data.logs);
    } catch {
      setLogs([]);
    }
  };

  useEffect(() => { load(); }, []);

  const createDepartment = async (event) => {
    event.preventDefault();
    try {
      await api.post('/admin/departments', departmentForm);
      setDepartmentForm({ name: '', code: '', description: '' });
      toast.success('Department created');
      load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const createStaff = async (event) => {
    event.preventDefault();
    try {
      const payload = { ...staffForm };
      if (!payload.department) delete payload.department;
      await api.post('/admin/users', payload);
      setStaffForm({ name: '', email: '', phone: '', password: '', role: 'officer', department: '' });
      toast.success('Staff user created');
      load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  return (
    <section className="stack">
      <div className="split">
        <form className="panel form" onSubmit={createDepartment}>
          <h2>Departments</h2>
          <input placeholder="Name" value={departmentForm.name} onChange={(e) => setDepartmentForm((v) => ({ ...v, name: e.target.value }))} />
          <input placeholder="Code" value={departmentForm.code} onChange={(e) => setDepartmentForm((v) => ({ ...v, code: e.target.value }))} />
          <textarea placeholder="Description" value={departmentForm.description} onChange={(e) => setDepartmentForm((v) => ({ ...v, description: e.target.value }))} />
          <button>Create department</button>
        </form>
        <form className="panel form" onSubmit={createStaff}>
          <h2>Staff Users</h2>
          <input placeholder="Name" value={staffForm.name} onChange={(e) => setStaffForm((v) => ({ ...v, name: e.target.value }))} />
          <input placeholder="Email" type="email" value={staffForm.email} onChange={(e) => setStaffForm((v) => ({ ...v, email: e.target.value }))} />
          <input placeholder="Phone" value={staffForm.phone} onChange={(e) => setStaffForm((v) => ({ ...v, phone: e.target.value }))} />
          <input placeholder="Password" type="password" value={staffForm.password} onChange={(e) => setStaffForm((v) => ({ ...v, password: e.target.value }))} />
          <select value={staffForm.role} onChange={(e) => setStaffForm((v) => ({ ...v, role: e.target.value }))}>
            <option value="officer">Officer</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Admin</option>
          </select>
          <select value={staffForm.department} onChange={(e) => setStaffForm((v) => ({ ...v, department: e.target.value }))}>
            <option value="">No department</option>
            {departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
          </select>
          <button>Create staff user</button>
        </form>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user._id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>{user.department?.name || '-'}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="panel">
        <h2>Recent Audit Logs</h2>
        <ul className="timeline">{logs.map((log) => <li key={log._id}><strong>{log.action}</strong><span>{log.actor?.email}</span><p>{new Date(log.createdAt).toLocaleString()}</p></li>)}</ul>
      </div>
    </section>
  );
}
