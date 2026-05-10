import { NavLink, Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../features/auth/authSlice';

export function AppLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const location = useLocation();

  const isStaff = ['officer', 'supervisor'].includes(user.role);
  const missingPhoto = isStaff && !user.profileImage?.url;

  if (missingPhoto && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }

  const signOut = async () => {
    await dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">FMC</span>
          <div>
            <strong>Fix My City</strong>
            <small>{user.role}</small>
          </div>
        </div>
        <nav>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/complaints">Complaints</NavLink>
          <NavLink to="/forum">Forums</NavLink>
          {user.role === 'citizen' && <NavLink to="/complaints/new">New Complaint</NavLink>}
          {user.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
          <NavLink to="/profile">Profile</NavLink>
          <NavLink to="/notifications">Notifications</NavLink>
        </nav>
        <button className="ghost-button" onClick={signOut}>Logout</button>
      </aside>
      <main className="content">
        <header className="topbar">
          <div>
            <h1>Municipal Complaint Management</h1>
            <p>{user.name} · {user.email}</p>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
