import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { api, apiMessage } from '../api/client';
import { Field } from '../components/Field';
import { categories } from '../utils/options';
import { uploadToCloudinary } from '../utils/cloudinary';

export function NewComplaintPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { priorityHint: 'medium', longitude: '77.5946', latitude: '12.9716' }
  });
  const address = watch('address');
  const longitude = watch('longitude');
  const latitude = watch('latitude');

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Location access is not available in this browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValue('longitude', position.coords.longitude.toFixed(6), { shouldValidate: true });
        setValue('latitude', position.coords.latitude.toFixed(6), { shouldValidate: true });
        toast.success('Current location added');
      },
      () => toast.error('Could not access your location')
    );
  };

  const geocodeAddress = async () => {
    if (!address || address.trim().length < 5) {
      toast.error('Enter a full address first');
      return;
    }

    try {
      toast.info('Fetching coordinates...');
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setValue('longitude', parseFloat(lon).toFixed(6), { shouldValidate: true });
        setValue('latitude', parseFloat(lat).toFixed(6), { shouldValidate: true });
        toast.success(`Location verified: ${data[0].display_name}`);
      } else {
        toast.error('Could not find that address. Please try being more specific.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('Geocoding service unavailable. Using manual entry fallback.');
    }
  };

  const onSubmit = async (values) => {
    try {
      const uploadedImages = [];
      if (values.images && values.images.length > 0) {
        for (const file of Array.from(values.images)) {
          const result = await uploadToCloudinary(file);
          uploadedImages.push(result);
        }
      }

      const payload = {
        ...values,
        images: uploadedImages
      };

      const { data } = await api.post('/complaints', payload);
      toast.success(data.message);
      navigate(`/complaints/${data.data.complaint._id}`);
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  return (
    <section className="panel form-panel">
      <h2>New Complaint</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="form grid-form">
        <Field label="Category" error={errors.category?.message}>
          <select {...register('category', { required: 'Category is required' })}>
            <option value="">Select category</option>
            {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select {...register('priorityHint')}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>
        <Field label="Title" error={errors.title?.message}><input {...register('title', { required: 'Title is required' })} /></Field>
        <Field label="Address" error={errors.address?.message}><input {...register('address', { required: 'Address is required' })} /></Field>
        <div className="location-panel" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="field">
            <span>Latitude</span>
            <input type="number" step="0.000001" {...register('latitude', { required: true })} />
          </div>
          <div className="field">
            <span>Longitude</span>
            <input type="number" step="0.000001" {...register('longitude', { required: true })} />
          </div>
          <div className="action-row" style={{ gridColumn: '1 / -1' }}>
            <button type="button" onClick={useCurrentLocation}>Use current location</button>
            <button type="button" className="ghost-light" onClick={geocodeAddress}>Verify Address</button>
          </div>
        </div>
        <Field label="Contact name"><input {...register('contactName')} /></Field>
        <Field label="Contact phone"><input {...register('contactPhone')} /></Field>
        <Field label="Images"><input type="file" accept="image/jpeg,image/png,image/webp" multiple {...register('images')} /></Field>
        <Field label="Description" error={errors.description?.message}>
          <textarea rows="6" {...register('description', { required: 'Description is required', minLength: { value: 20, message: 'Use at least 20 characters' } })} />
        </Field>
        <button disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit complaint'}</button>
      </form>
    </section>
  );
}
