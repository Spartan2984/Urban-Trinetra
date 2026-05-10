import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { registerCitizen } from '../features/auth/authSlice';
import { Field } from '../components/Field';

export function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (values) => {
    try {
      await dispatch(registerCitizen(values)).unwrap();
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Registration failed');
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <h1>Create Account</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="form">
          <Field label="Name" error={errors.name?.message}><input {...register('name', { required: 'Name is required' })} /></Field>
          <Field label="Email" error={errors.email?.message}><input type="email" {...register('email', { required: 'Email is required' })} /></Field>
          <Field label="Phone"><input {...register('phone')} /></Field>
          <Field label="Password" error={errors.password?.message}>
            <input type="password" {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Use at least 8 characters' } })} />
          </Field>
          <button disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create account'}</button>
        </form>
        <Link to="/login">Back to sign in</Link>
      </section>
    </main>
  );
}
