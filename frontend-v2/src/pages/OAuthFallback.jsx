import { BlinkingFace } from './BlinkingFace';
import { Button } from '../components/ui/Button';
import { AppShell } from '../components/layout/AppShell';

const OAuthFallback = () => (
  <AppShell>
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6">
      <div className="flex flex-col items-center gap-6">
        <BlinkingFace className="w-24 h-24" />
        <h1 className="text-3xl font-bold tracking-tight">Google Login Failed</h1>
        <p className="text-lg text-gray-400 max-w-md text-center">
          Oops! Something went wrong while signing in with Google. This may be due to a network issue, denied permissions, or an expired session.<br />
          Please try again or use another login method.
        </p>
        <Button
          className="mt-4 px-6 py-3 text-lg font-semibold bg-blue-500 hover:bg-blue-400 transition rounded-full"
          onClick={() => window.location.href = '/auth?mode=login'}
        >
          Go to Login Page
        </Button>
      </div>
      <div className="mt-12 text-sm text-gray-300 text-center">
        <p>Blinx AI Assistant is a college academic project. No Google data is stored except email/calendar for chatbot features.</p>
        <p className="mt-2">For privacy, terms, or data deletion, see links below.</p>
        <div className="flex justify-center gap-4 mt-2">
          <a href="/privacy-policy" className="hover:text-blue-400 underline">Privacy Policy</a>
          <a href="/terms" className="hover:text-blue-400 underline">Terms</a>
          <a href="/data-deletion" className="hover:text-blue-400 underline">Data Deletion</a>
        </div>
      </div>
    </div>
  </AppShell>
);

export default OAuthFallback;
