import { Link } from 'react-router-dom';
import { BlinkingFace } from './BlinkingFace';
import { Button } from '../components/ui/Button';

const OAuthFallback = () => (
  <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6">
    <div className="flex flex-col items-center gap-6">
      <BlinkingFace className="w-24 h-24" />
      <h1 className="text-3xl font-bold tracking-tight">Google Login Failed</h1>
      <p className="text-lg text-gray-400 max-w-md text-center">
        Oops! Something went wrong while signing in with Google. This may be due to a network issue, denied permissions, or an expired session.<br />
        Please try again or use another login method.
      </p>
      <Link to="/auth?mode=login">
        <Button className="mt-4 px-6 py-3 text-lg font-semibold bg-blue-500 hover:bg-blue-400 transition rounded-full">
          Go to Login Page
        </Button>
      </Link>
    </div>
    <div className="mt-12 text-sm text-gray-300 text-center">
      <p>Blinx AI Assistant is a college academic project. No Google data is stored except email/calendar for chatbot features.</p>
      <p className="mt-2">For privacy, terms, or data deletion, see links below.</p>
      <div className="flex justify-center gap-4 mt-2">
        <Link to="/privacy-policy" className="hover:text-blue-400 underline">Privacy Policy</Link>
        <Link to="/terms" className="hover:text-blue-400 underline">Terms</Link>
        <Link to="/data-deletion" className="hover:text-blue-400 underline">Data Deletion</Link>
      </div>
    </div>
  </main>
);

export default OAuthFallback;
