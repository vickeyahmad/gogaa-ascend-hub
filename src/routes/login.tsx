import { useState, useEffect } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLockup } from '@/components/gogaa/brand';
import { ButtonLoader } from '@/components/gogaa/loaders';
import { useAuth } from '@/lib/auth-context';
import { ApiClientError } from '@/lib/api-client';
import orbit from '@/assets/digital-orbit.jpg';

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [
      { title: 'Sign In · Gogaa Byte Admin' },
      {
        name: 'description',
        content: 'Sign in to your Gogaa Byte administrator Control Center.',
      },
      { property: 'og:title', content: 'Sign In · Gogaa Byte Admin' },
      {
        property: 'og:description',
        content: 'Welcome to your Gogaa Byte Control Center.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: Login,
});

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // If already authenticated with a valid administrator session, redirect to the dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void navigate({ to: '/' });
    }
  }, [isLoading, isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setLoginError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLoginError('Please enter your administrator email address.');
      return;
    }
    if (!password) {
      setLoginError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(trimmedEmail, password);
      void navigate({ to: '/' });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setLoginError(err.message);
      } else if (err instanceof Error) {
        setLoginError(err.message);
      } else {
        setLoginError('Authentication failed. Please verify your credentials and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-brand">
        <img
          src={orbit}
          className="hero-art"
          width={1536}
          height={768}
          alt="Luminous glass orbital sculpture in orange, violet, and pink"
        />
        <div className="hero-shade" />
        <BrandLockup />
        <div className="login-brand-copy">
          <div className="hero-eyebrow">
            <Sparkles />
            WELCOME TO YOUR NEXT CHAPTER
          </div>
          <h1>
            Power your
            <br />
            digital universe.
          </h1>
          <p>One powerful space to manage your digital business.</p>
        </div>
        <div className="login-brand-footer">
          <span>gogaabyte.com</span>
          <span>Made for what's next.</span>
        </div>
      </section>

      <section className="login-form-side">
        <div className="login-top">
          <Link to="/">
            <ArrowLeft size={13} />
            Dashboard
          </Link>
          <span className="preview-badge">Admin Sign In</span>
        </div>

        <div className="login-form-wrap">
          <div className="login-form-symbol">
            <LockKeyhole size={22} />
          </div>
          <h2>Welcome back</h2>
          <p>Sign in to your Gogaa Byte Control Center.</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="email">Email address</label>
              <div className="field-input">
                <Mail />
                <input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="password">Password</label>
              <div className="field-input">
                <LockKeyhole />
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={show ? 'Hide password' : 'Show password'}
                  onClick={() => setShow(!show)}
                  disabled={submitting}
                >
                  {show ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              variant="brand"
              className="login-submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <ButtonLoader />
                  <span className="ml-2">Signing in...</span>
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight />
                </>
              )}
            </Button>

            {loginError && (
              <p className="login-error" role="alert">
                {loginError}
              </p>
            )}
          </form>

          <div className="login-notice">
            <ShieldCheck />
            <span>
              Protected by central ASP.NET Core Identity authentication, lockout defenses, and CSRF validation.
            </span>
          </div>

          <Link to="/" className="login-preview-link">
            Open dashboard
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="login-bottom">
          <ShieldCheck className="inline mr-1" size={12} />
          Gogaa Byte Admin · Control Center
        </div>
      </section>
    </main>
  );
}
