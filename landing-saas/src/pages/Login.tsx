import LoginForm from '../components/LoginForm';

export default function Login() {
  const handleLoginSuccess = (data: any) => {
    // Login successful, redirect will be handled by LoginForm
    console.log('Login successful:', data);
  };

  return <LoginForm onSuccess={handleLoginSuccess} />;
}