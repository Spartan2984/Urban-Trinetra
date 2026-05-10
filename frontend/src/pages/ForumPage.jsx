import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { api, apiMessage } from '../api/client';

const staffRoles = ['officer', 'supervisor', 'admin'];

function RoleTag({ role }) {
  if (!staffRoles.includes(role)) return null;
  return <span className="role-tag">{role}</span>;
}

export function ForumPage() {
  const { user } = useSelector((state) => state.auth);
  const [topics, setTopics] = useState([]);
  const [sort, setSort] = useState('popular');
  const [form, setForm] = useState({ title: '', body: '' });

  const load = async () => {
    const { data } = await api.get(`/forum/topics?sort=${sort}`);
    setTopics(data.data.topics);
  };

  useEffect(() => { load(); }, [sort]);

  const createTopic = async (event) => {
    event.preventDefault();
    try {
      await api.post('/forum/topics', form);
      setForm({ title: '', body: '' });
      toast.success('Topic created');
      load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const vote = async (id, value) => {
    try {
      await api.post(`/forum/topics/${id}/vote`, { value });
      load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  return (
    <section className="stack">
      <div className="toolbar">
        <div>
          <h2>Forums</h2>
          <p>Discuss civic issues, support useful topics, and add context around complaints.</p>
        </div>
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="popular">Popular</option>
          <option value="new">Newest</option>
        </select>
      </div>

      <form className="panel form" onSubmit={createTopic}>
        <h3>Create Topic</h3>
        <input placeholder="Topic title" value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} />
        <textarea rows="4" placeholder="Start a discussion" value={form.body} onChange={(event) => setForm((value) => ({ ...value, body: event.target.value }))} />
        <button>Create topic</button>
      </form>

      <div className="topic-list">
        {topics.map((topic) => (
          <article className="panel topic-card" key={topic._id}>
            <div className="vote-box">
              <button type="button" onClick={() => vote(topic._id, 1)}>Approve</button>
              <strong>{topic.score}</strong>
              <button type="button" className="ghost-light" onClick={() => vote(topic._id, -1)}>Disapprove</button>
            </div>
            <div>
              <h3><Link to={`/forum/${topic._id}`}>{topic.isDeleted ? deletionText(topic) : topic.title}</Link></h3>
              <p>{topic.isDeleted ? deletionText(topic) : topic.body}</p>
              <div className="meta-row">
                <span>{topic.author?.name || 'Unknown'}</span>
                <RoleTag role={topic.author?.role} />
                {topic.relatedComplaint && <span>Complaint {topic.relatedComplaint.complaintId}</span>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function deletionText(topic) {
  return topic.deletedByRole === 'admin' ? 'Deleted by admin' : 'Deleted by author';
}
