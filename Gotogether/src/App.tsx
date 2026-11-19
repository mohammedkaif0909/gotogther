import { AuthProvider } from './context/AuthContext';
import { RoleProvider } from './context/RoleContext';
import HomePage from './components/HomePage';

export default function App() {
  return (
    <AuthProvider>
      <RoleProvider>
        <HomePage />
      </RoleProvider>
    </AuthProvider>
  );
}
