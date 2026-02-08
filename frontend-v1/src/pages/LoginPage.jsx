import LoginForm from '../components/auth/LoginForm';

export default function LoginPage({ onLogin }) {
  return <LoginForm onLogin={onLogin} />;
}