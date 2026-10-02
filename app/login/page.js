import { Suspense } from 'react';
import LoginClient from './LoginClient';

export const metadata = {
  title: 'Sign In',
  description: 'Sign in to OrangeHub to save favorites, history and playlists.',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
