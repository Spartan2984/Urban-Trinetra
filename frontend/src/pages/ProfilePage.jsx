import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { api, apiMessage } from '../api/client';
import { uploadToCloudinary } from '../utils/cloudinary';
import { setCredentials } from '../features/auth/authSlice';

export function ProfilePage() {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState(user.phone || '');

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const imageData = await uploadToCloudinary(file);
      const { data } = await api.patch('/auth/profile', { 
        profileImage: { url: imageData.secure_url, public_id: imageData.public_id } 
      });
      dispatch(setCredentials({ user: { ...user, profileImage: data.data.user.profileImage }, token: localStorage.getItem('token') }));
      toast.success('Profile photo updated');
    } catch (err) {
      toast.error(apiMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.patch('/auth/profile', { phone });
      dispatch(setCredentials({ user: { ...user, phone: data.data.user.phone }, token: localStorage.getItem('token') }));
      toast.success('Profile updated');
    } catch (err) {
      toast.error(apiMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="stack">
      <div className="panel form">
        <h2>My Identity</h2>
        <p className="subtext">Staff are required to maintain a professional profile photo for public accountability.</p>
        
        <div className="row-center" style={{ margin: '20px 0' }}>
          <div className="avatar-large" style={{ width: '120px', height: '120px' }}>
            {user.profileImage?.url ? <img src={user.profileImage.url} alt="" /> : '👤'}
          </div>
          <div className="stack">
            <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={loading} />
            <small>JPG or PNG, max 2MB</small>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="stack">
          <div className="field">
            <span>Name</span>
            <input value={user.name} disabled />
          </div>
          <div className="field">
            <span>Email</span>
            <input value={user.email} disabled />
          </div>
          <div className="field">
            <span>Phone (Public)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Office phone number" />
          </div>
          <button disabled={loading}>Save Profile</button>
        </form>
      </div>
    </section>
  );
}
