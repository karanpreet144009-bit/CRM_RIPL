import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { useState } from 'react';

const schema = z.object({
  email: z.string().email('Enter a valid work email'),
  password: z.string().min(1, 'Password is required'),
});
type Form = z.infer<typeof schema>;
export function LoginPage() {
  const { login } = useAuth(),
    navigate = useNavigate(),
    [error, setError] = useState(''),
    [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });
  const submit = async (v: Form) => {
    try {
      setError('');
      await login(v.email, v.password);
      navigate('/');
    } catch {
      setError('Unable to sign in. Check your credentials or contact an administrator.');
    }
  };
  return (
    <main className="min-h-screen bg-slate-100 grid place-items-center p-6">
      <form
        onSubmit={handleSubmit(submit)}
        className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm border border-slate-200"
      >
        <p className="text-sm font-semibold text-gold">RIPL</p>
        <h1 className="mt-2 text-2xl font-bold text-navy">Sign in to ERP</h1>
        <p className="mt-1 text-sm text-slate-500">Internal office access only</p>
        {error && (
          <p role="alert" className="mt-5 rounded bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <label className="mt-6 block text-sm font-medium text-slate-700">
          Work email
          <input
            autoComplete="email"
            {...register('email')}
            className="mt-1 w-full rounded border border-slate-300 p-2.5 outline-navy"
          />
        </label>
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Password
          <div className="relative mt-1">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password')}
              className="w-full rounded border border-slate-300 p-2.5 pr-12 outline-navy"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-navy"
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </label>
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
        <button
          disabled={isSubmitting}
          className="mt-6 w-full rounded bg-navy py-2.5 font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
        <a href="/forgot-password" className="mt-4 block text-center text-sm text-navy underline">
          Forgot password?
        </a>
      </form>
    </main>
  );
}
