import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { api, apiMessage } from '../api/client';

const staffRoles = ['officer', 'supervisor', 'admin'];

function RoleTag({ role }) {
  if (!staffRoles.includes(role)) return null;
  return <span className="role-tag">{role}</span>;
}

function deletedText(item) {
  return item.deletedByRole === 'admin' ? 'Deleted by admin' : 'Deleted by author';
}

export function ForumTopicPage() {
  const { id } = useParams();
  const { user } = useSelector((state) => state.auth);
  const [topic, setTopic] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [editingTopic, setEditingTopic] = useState(false);
  const [topicForm, setTopicForm] = useState({ title: '', body: '' });
  const [editingComment, setEditingComment] = useState(null);
  const [commentEditBody, setCommentEditBody] = useState('');

  const load = async () => {
    const { data } = await api.get(`/forum/topics/${id}`);
    setTopic(data.data.topic);
    setTopicForm({ title: data.data.topic.title, body: data.data.topic.body });
    setComments(data.data.comments);
  };

  useEffect(() => { load(); }, [id]);

  const voteTopic = async (value) => {
    await api.post(`/forum/topics/${id}/vote`, { value });
    load();
  };

  const voteComment = async (commentId, value) => {
    await api.post(`/forum/comments/${commentId}/vote`, { value });
    load();
  };

  const createComment = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/forum/topics/${id}/comments`, { body: commentBody });
      setCommentBody('');
      load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const saveTopic = async (event) => {
    event.preventDefault();
    try {
      await api.patch(`/forum/topics/${id}`, topicForm);
      setEditingTopic(false);
      load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const deleteTopic = async () => {
    try {
      await api.delete(`/forum/topics/${id}`, { data: { reason: user.role === 'admin' ? 'Deleted by admin' : 'Deleted by author' } });
      load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const saveComment = async (commentId) => {
    try {
      await api.patch(`/forum/comments/${commentId}`, { body: commentEditBody });
      setEditingComment(null);
      setCommentEditBody('');
      load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const deleteComment = async (commentId) => {
    try {
      await api.delete(`/forum/comments/${commentId}`, { data: { reason: user.role === 'admin' ? 'Deleted by admin' : 'Deleted by author' } });
      load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  if (!topic) return <section className="panel">Loading topic...</section>;

  const canEditTopic = topic.author?._id === user.id && !topic.isDeleted;
  const canDeleteTopic = (canEditTopic || user.role === 'admin') && !topic.isDeleted;
  const complaintLinkId = topic.relatedComplaint?._id || topic.relatedComplaint;

  return (
    <section className="stack">
      <article className="panel topic-detail">
        <div className="vote-box">
          <button type="button" onClick={() => voteTopic(1)} disabled={topic.isDeleted}>Approve</button>
          <strong>{topic.score}</strong>
          <button type="button" className="ghost-light" onClick={() => voteTopic(-1)} disabled={topic.isDeleted}>Disapprove</button>
        </div>
        <div>
          {editingTopic ? (
            <form className="form" onSubmit={saveTopic}>
              <input value={topicForm.title} onChange={(event) => setTopicForm((value) => ({ ...value, title: event.target.value }))} />
              <textarea rows="5" value={topicForm.body} onChange={(event) => setTopicForm((value) => ({ ...value, body: event.target.value }))} />
              <div className="action-row"><button>Save</button><button type="button" className="ghost-light" onClick={() => setEditingTopic(false)}>Cancel</button></div>
            </form>
          ) : (
            <>
              <h2>{topic.isDeleted ? deletedText(topic) : topic.title}</h2>
              <p>{topic.isDeleted ? deletedText(topic) : topic.body}</p>
            </>
          )}
          <div className="meta-row">
            <span>{topic.author?.name || 'Unknown'}</span>
            <RoleTag role={topic.author?.role} />
            {topic.relatedComplaint && <Link to={`/complaints/${complaintLinkId}`}>Complaint {topic.relatedComplaint.complaintId || 'details'}</Link>}
          </div>
          <div className="action-row">
            {canEditTopic && <button type="button" className="ghost-light" onClick={() => setEditingTopic(true)}>Edit</button>}
            {canDeleteTopic && <button type="button" className="danger-button" onClick={deleteTopic}>Delete</button>}
          </div>
        </div>
      </article>

      {!topic.isDeleted && (
        <form className="panel form" onSubmit={createComment}>
          <h3>Add Comment</h3>
          <textarea rows="3" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} />
          <button>Comment</button>
        </form>
      )}

      <div className="stack">
        {comments.map((comment) => {
          const canEditComment = comment.author?._id === user.id && !comment.isDeleted;
          const canDeleteComment = (canEditComment || user.role === 'admin') && !comment.isDeleted;
          return (
            <article className="panel comment-card" key={comment._id}>
              <div className="vote-box compact">
                <button type="button" onClick={() => voteComment(comment._id, 1)} disabled={comment.isDeleted}>Approve</button>
                <strong>{comment.score}</strong>
                <button type="button" className="ghost-light" onClick={() => voteComment(comment._id, -1)} disabled={comment.isDeleted}>Disapprove</button>
              </div>
              <div>
                {editingComment === comment._id ? (
                  <div className="form">
                    <textarea rows="3" value={commentEditBody} onChange={(event) => setCommentEditBody(event.target.value)} />
                    <div className="action-row"><button type="button" onClick={() => saveComment(comment._id)}>Save</button><button type="button" className="ghost-light" onClick={() => setEditingComment(null)}>Cancel</button></div>
                  </div>
                ) : (
                  <p>{comment.isDeleted ? deletedText(comment) : comment.body}</p>
                )}
                <div className="meta-row">
                  <span>{comment.author?.name || 'Unknown'}</span>
                  <RoleTag role={comment.author?.role} />
                </div>
                <div className="action-row">
                  {canEditComment && <button type="button" className="ghost-light" onClick={() => { setEditingComment(comment._id); setCommentEditBody(comment.body); }}>Edit</button>}
                  {canDeleteComment && <button type="button" className="danger-button" onClick={() => deleteComment(comment._id)}>Delete</button>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
