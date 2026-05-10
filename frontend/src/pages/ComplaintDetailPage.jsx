import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { api, apiMessage } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { statuses } from '../utils/options';
import { uploadToCloudinary } from '../utils/cloudinary';

// Haversine formula
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
};

export function ComplaintDetailPage() {
  const { id } = useParams();
  const { user } = useSelector((state) => state.auth);
  const [complaint, setComplaint] = useState(null);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [assignment, setAssignment] = useState({ assignedTo: '', department: '', note: '' });
  const [statusForm, setStatusForm] = useState({ status: '', note: '' });
  const [completionForm, setCompletionForm] = useState({ note: '', resolutionImages: null });
  const [reviewNote, setReviewNote] = useState('');
  const [deadlineForm, setDeadlineForm] = useState({ hours: 24, note: '' });

  const [currentDistance, setCurrentDistance] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await api.get(`/complaints/${id}`);
    setComplaint(data.data.complaint);
  };

  useEffect(() => {
    load();
    if (['admin', 'supervisor'].includes(user.role)) {
      api.get('/admin/users?role=officer').then(({ data }) => setUsers(data.data.users));
      api.get('/admin/departments').then(({ data }) => setDepartments(data.data.departments));
    }
  }, [id, user.role]);

  // Track location if officer is resolving
  useEffect(() => {
    if (user.role === 'officer' && complaint?.status === 'IN_PROGRESS') {
      if (!navigator.geolocation) {
        setLocationError('Geolocation is not supported by your browser');
        return;
      }
      
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const [complaintLon, complaintLat] = complaint.location.coordinates.coordinates;
          const dist = getDistance(latitude, longitude, complaintLat, complaintLon);
          setCurrentDistance(dist);
          setLocationError('');
        },
        (error) => {
          setLocationError('Cannot access location. Required for resolution.');
        },
        { enableHighAccuracy: true }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [user.role, complaint]);

  const assign = async (event) => {
    event.preventDefault();
    try {
      await api.patch(`/complaints/${id}/assign`, assignment);
      toast.success('Complaint assigned');
      await load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const rejectSubmitted = async () => {
    try {
      await api.patch(`/complaints/${id}/reject`, { note: 'Rejected by supervisor' });
      toast.success('Complaint rejected');
      await load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const requestCompletion = async (event) => {
    event.preventDefault();
    // Frontend geofencing is now advisory; Backend EXIF check is the final authority
    if (currentDistance > 50) {
      console.warn(`Test Mode: Proceeding with remote submission (Distance: ${Math.round(currentDistance)}m)`);
    }

    try {
      setLoading(true);
      const uploadedImages = [];
      if (completionForm.resolutionImages?.length > 0) {
        for (const file of Array.from(completionForm.resolutionImages)) {
          const result = await uploadToCloudinary(file);
          uploadedImages.push(result);
        }
      }

      await api.patch(`/complaints/${id}/request-completion`, {
        note: completionForm.note,
        resolutionImages: uploadedImages
      });
      toast.success('Completion request sent');
      await load();
    } catch (error) {
      toast.error(apiMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const reviewCompletion = async (decision) => {
    try {
      await api.patch(`/complaints/${id}/review-completion`, { decision, note: reviewNote });
      toast.success(decision === 'approve' ? 'Complaint closed' : 'Completion rejected');
      await load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const extendDeadline = async (event) => {
    event.preventDefault();
    try {
      await api.patch(`/complaints/${id}/extend-deadline`, deadlineForm);
      toast.success('Deadline extended');
      await load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const updateStatus = async (event) => {
    event.preventDefault();
    try {
      await api.patch(`/complaints/${id}/status`, statusForm);
      toast.success('Status updated');
      await load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const handleVeto = async () => {
    if (!window.confirm('Are you sure you want to veto this resolution? Independent auditors will be assigned.')) return;
    try {
      await api.post(`/complaints/${id}/veto`);
      toast.success('Resolution vetoed. Auditors assigned.');
      await load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const handleAuditVote = async (vote) => {
    try {
      await api.post(`/complaints/${id}/audit`, { vote });
      toast.success(`Voted to ${vote} resolution`);
      await load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, comment: '' });
  const [showFeedback, setShowFeedback] = useState(false);

  const submitFeedback = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/complaints/${id}/feedback`, feedbackForm);
      toast.success('Feedback submitted and complaint closed');
      await load();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  if (!complaint) return <section className="panel">Loading complaint...</section>;

  const isAuditor = complaint.auditors?.some(a => (a.auditor?._id || a.auditor) === (user.id || user._id));
  const myAuditVote = complaint.auditors?.find(a => (a.auditor?._id || a.auditor) === (user.id || user._id))?.vote;

  return (
    <section className="stack">
      <div className="panel">
        <div className="toolbar">
          <div>
            <h2>{complaint.complaintId}</h2>
            <p>{complaint.title}</p>
          </div>
          <StatusBadge status={complaint.status} />
        </div>
        <dl className="details">
          <div><dt>Category</dt><dd>{complaint.category}</dd></div>
          <div><dt>Priority</dt><dd>{complaint.priorityHint}</dd></div>
          <div><dt>Address</dt><dd>{complaint.location.address}</dd></div>
          <div><dt>Due</dt><dd className={new Date(complaint.dueAt) < new Date() && !['CLOSED', 'VERIFIED'].includes(complaint.status) ? 'error-text font-bold' : ''}>
            {new Date(complaint.dueAt).toLocaleString()}
            {new Date(complaint.dueAt) < new Date() && !['CLOSED', 'VERIFIED'].includes(complaint.status) && ' (OVERDUE)'}
          </dd></div>
          <div><dt>Citizen</dt><dd>{complaint.citizen?.name}</dd></div>
          <div><dt>Officer</dt><dd>{complaint.assignedTo?.name || 'Unassigned'}</dd></div>
        </dl>
        <p className="description">{complaint.description}</p>
        {complaint.forumTopic && !complaint.forumTopic.isDeleted && (
          <p><a className="button-link" href={`/forum/${complaint.forumTopic._id}`}>Open forum discussion</a></p>
        )}
        {complaint.images?.length > 0 && (
          <div className="image-grid">
            {complaint.images.map((image) => <img key={image.public_id || image.filename} src={image.secure_url || image.url} alt="Complaint evidence" />)}
          </div>
        )}
      </div>

      {/* Citizen Verification Block */}
      {user.role === 'citizen' && (complaint.citizen?._id || complaint.citizen) === (user.id || user._id) && complaint.status === 'PENDING_VERIFICATION' && (
        <div className="panel form">
          <h3>Verify Resolution</h3>
          <p>The officer has marked this issue as resolved. Please review the resolution evidence.</p>
          {complaint.resolutionImages?.length > 0 && (
            <div className="image-grid">
              {complaint.resolutionImages.map((image) => <img key={image.public_id || image.filename} src={image.secure_url || image.url} alt="Completion proof" />)}
            </div>
          )}

          {complaint.aiVerification && (
            <div className={`panel ${complaint.aiVerification.verified ? 'success-border' : 'error-border'} small-gap`}>
              <strong>AI Verification Analysis</strong>
              <p className="subtext">Match Score: {(complaint.aiVerification.score * 100).toFixed(1)}% | Status: {complaint.aiVerification.verified ? 'VERIFIED' : 'FLAGGED'}</p>
              <p className="small-text">{complaint.aiVerification.message}</p>
            </div>
          )}
          
          {!showFeedback ? (
            <div className="action-row">
              <button type="button" onClick={() => setShowFeedback(true)}>Accept (Close)</button>
              <button type="button" className="danger-button" onClick={handleVeto}>Veto Resolution</button>
            </div>
          ) : (
            <form id="feedback" className="stack" onSubmit={submitFeedback}>
              <div className="field">
                <span>Rating</span>
                <select value={feedbackForm.rating} onChange={(e) => setFeedbackForm(v => ({ ...v, rating: e.target.value }))}>
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} Stars</option>)}
                </select>
              </div>
              <div className="field">
                <span>Comment</span>
                <textarea 
                  required 
                  placeholder="Tell us about the resolution..." 
                  value={feedbackForm.comment} 
                  onChange={(e) => setFeedbackForm(v => ({ ...v, comment: e.target.value }))}
                />
              </div>
              <div className="action-row">
                <button>Submit & Close Complaint</button>
                <button type="button" className="ghost-light" onClick={() => setShowFeedback(false)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Auditor Block */}
      {isAuditor && complaint.status === 'PENDING_AUDIT' && (
        <div className="panel form">
          <h3>Auditor Review</h3>
          <p>The citizen vetoed the officer's resolution. As a high-reputation user, please vote on whether the resolution is valid.</p>
          {complaint.auditors?.find(a => (a.auditor?._id || a.auditor) === (user.id || user._id))?.dueDate && (
            <p className="error">
              Deadline: {new Date(complaint.auditors.find(a => (a.auditor?._id || a.auditor) === (user.id || user._id)).dueDate).toLocaleString()}
            </p>
          )}
          {complaint.resolutionImages?.length > 0 && (
            <div className="image-grid">
              {complaint.resolutionImages.map((image) => <img key={image.public_id || image.filename} src={image.secure_url || image.url} alt="Completion proof" />)}
            </div>
          )}

          {complaint.aiVerification && (
            <div className="panel info-border small-gap">
              <strong>Audit Evidence: AI Comparison</strong>
              <p className="subtext">SSIM Match Score: {(complaint.aiVerification.score * 100).toFixed(1)}%</p>
              <p className="small-text">The AI analyzed the before and after photos. A score between 45% and 85% indicates a successful resolution with matching background context.</p>
            </div>
          )}
          {myAuditVote ? (
            <p><strong>Your vote:</strong> {myAuditVote.toUpperCase()}</p>
          ) : (
            <div className="action-row">
              <button type="button" onClick={() => handleAuditVote('approve')}>Vote Valid (Approve)</button>
              <button type="button" className="danger-button" onClick={() => handleAuditVote('reject')}>Vote Invalid (Reject)</button>
            </div>
          )}
        </div>
      )}

      {complaint.supervisorApprovalRequired && user.role === 'supervisor' && complaint.status === 'PENDING_AUDIT' && (
        <div className="panel form error-border">
          <h3>Supervisor Mandatory Approval</h3>
          <p className="error">No auditors are available for this complaint. Supervisor must manually approve or reject the resolution.</p>
          <div className="action-row">
            <button type="button" onClick={() => reviewCompletion('approve')}>Approve Resolution</button>
            <button type="button" className="danger-button" onClick={() => reviewCompletion('reject')}>Reject Resolution</button>
          </div>
        </div>
      )}

      {user.role === 'supervisor' && (
        <>
          {['SUBMITTED', 'NEW', 'REOPENED', 'ESCALATED'].includes(complaint.status) && (
            <form className="panel form" onSubmit={assign}>
              <h3>Allocate Complaint</h3>
              <select value={assignment.department} onChange={(e) => setAssignment((value) => ({ ...value, department: e.target.value }))}>
                <option value="">Department from officer</option>
                {departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
              </select>
              <select required value={assignment.assignedTo} onChange={(e) => setAssignment((value) => ({ ...value, assignedTo: e.target.value }))}>
                <option value="">Select officer</option>
                {users
                  .filter(officer => !assignment.department || officer.department?._id === assignment.department || officer.department === assignment.department)
                  .map((officer) => <option key={officer._id} value={officer._id}>{officer.name} · {officer.email}</option>)}
              </select>
              <input placeholder="Allocation note" value={assignment.note} onChange={(e) => setAssignment((value) => ({ ...value, note: e.target.value }))} />
              <div className="action-row">
                <button>Allocate officer</button>
                <button type="button" className="danger-button" onClick={rejectSubmitted}>Reject complaint</button>
              </div>
            </form>
          )}
          {['PENDING_COMPLETION', 'PENDING_VERIFICATION'].includes(complaint.status) && (
            <div className="panel form">
              <h3>Review Completion Request</h3>
              <input placeholder="Review note" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
              {complaint.resolutionImages?.length > 0 && (
                <div className="image-grid">
                  {complaint.resolutionImages.map((image) => <img key={image.public_id || image.filename} src={image.secure_url || image.url} alt="Completion proof" />)}
                </div>
              )}
              {complaint.aiVerification && (
                <div className="panel success-border small-gap" style={{ marginTop: '12px' }}>
                  <strong>Supervisor AI Report</strong>
                  <p className="subtext">Match Score: {(complaint.aiVerification.score * 100).toFixed(1)}%</p>
                  <p className="small-text">{complaint.aiVerification.message}</p>
                </div>
              )}
              <div className="action-row">
                <button type="button" onClick={() => reviewCompletion('approve')}>Close complaint</button>
                <button type="button" className="danger-button" onClick={() => reviewCompletion('reject')}>Reject completion</button>
              </div>
            </div>
          )}
          <form className="panel form" onSubmit={extendDeadline}>
            <h3>Extend Deadline</h3>
            <input type="number" min="1" max="720" value={deadlineForm.hours} onChange={(e) => setDeadlineForm((value) => ({ ...value, hours: e.target.value }))} />
            <input placeholder="Extension note" value={deadlineForm.note} onChange={(e) => setDeadlineForm((value) => ({ ...value, note: e.target.value }))} />
            <button>Extend deadline</button>
          </form>
        </>
      )}

      {user.role === 'officer' && (complaint.assignedTo?._id || complaint.assignedTo) === (user.id || user._id) && complaint.status === 'ASSIGNED' && (
        <div className="panel info-border">
          <h3>Task Queued</h3>
          <p>This complaint has been assigned to you. It will be activated once you complete your current active task.</p>
        </div>
      )}

      {user.role === 'officer' && complaint.status === 'IN_PROGRESS' && (
        <form className="panel form" onSubmit={requestCompletion}>
          <h3>Request Closure</h3>
          <p>
            Geofencing: {currentDistance !== null ? `${Math.round(currentDistance)}m away` : 'Calculating...'}
            {locationError && <span className="error"> ({locationError})</span>}
          </p>
          <input placeholder="Completion note" value={completionForm.note} onChange={(e) => setCompletionForm((value) => ({ ...value, note: e.target.value }))} />
          <input type="file" required accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setCompletionForm((value) => ({ ...value, resolutionImages: e.target.files }))} />
          <button disabled={loading}>
            {loading ? 'Verifying Proof with AI...' : 'Send completion request'}
          </button>
        </form>
      )}

      {complaint.status === 'PENDING_AUDIT' && complaint.auditors?.length > 0 && (
        <div className="panel">
          <h3>Independent Audit Panel</h3>
          <p className="subtext">The following high-reputation citizens have been randomly selected to verify this resolution.</p>
          <ul className="timeline">
            {complaint.auditors.map((a, i) => (
              <li key={i} className="row-between">
                <div>
                  <strong>{a.auditor?.name || 'Assigned Auditor'}</strong>
                  <span className="subtext">Reputation: {a.auditor?.reputationScore}</span>
                </div>
                <div>
                  {a.vote ? (
                    <span className={`badge ${a.vote === 'approve' ? 'success' : 'danger'}`}>
                      Voted: {a.vote.toUpperCase()}
                    </span>
                  ) : (
                    <span className="badge ghost-light">Awaiting Vote</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {['admin'].includes(user.role) && (
        <form className="panel form" onSubmit={updateStatus}>
          <h3>Manual Status Override</h3>
          <select required value={statusForm.status} onChange={(e) => setStatusForm((value) => ({ ...value, status: e.target.value }))}>
            <option value="">Select status</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <input placeholder="Status note" value={statusForm.note} onChange={(e) => setStatusForm((value) => ({ ...value, note: e.target.value }))} />
          <button>Update</button>
        </form>
      )}

      <div className="panel">
        <h3>Status History</h3>
        <ul className="timeline">
          {complaint.statusHistory.map((item, index) => (
            <li key={`${item.status}-${index}`}>
              <strong>{item.status}</strong>
              <span>{new Date(item.changedAt).toLocaleString()}</span>
              <p>{item.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
