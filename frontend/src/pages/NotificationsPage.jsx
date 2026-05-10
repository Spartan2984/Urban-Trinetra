import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    api.get('/notifications').then(({ data }) => setNotifications(data.data.notifications));
  }, []);

  return (
    <section className="panel">
      <h2>Notifications</h2>
      <ul className="timeline">
        {notifications.map((notification) => (
          <li key={notification._id} className={notification.readAt ? 'read' : 'unread'}>
            <strong>{notification.title}</strong>
            <span>{new Date(notification.createdAt).toLocaleString()}</span>
            <p>{notification.message}</p>
            {notification.relatedComplaint && notification.relatedComplaint.status !== 'CLOSED' && (
              <a href={`/complaints/${notification.relatedComplaint._id || notification.relatedComplaint}`} className="button-link small">View Complaint</a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
