import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { login } from '../features/auth/authSlice';
import { Field } from '../components/Field';

export function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (values) => {
    try {
      await dispatch(login(values)).unwrap();
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Login failed');
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <h1>Fix My City</h1>
        <p>Sign in to report, assign, resolve, and audit civic complaints.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="form">
          <Field label="Email" error={errors.email?.message}>
            <input type="email" {...register('email', { required: 'Email is required' })} />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <input type="password" {...register('password', { required: 'Password is required' })} />
          </Field>
          <button disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <Link to="/register">Create citizen account</Link>
      </section>
    </main>
  );
}
