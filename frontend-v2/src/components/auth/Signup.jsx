import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion as Motion } from 'framer-motion';
import { authApi } from '../../api';
import { useAuthStore } from '../../stores';
import { Button, Input } from '../ui';
import toast from 'react-hot-toast';

export function Signup({ onSwitchToLogin }) {
    const [step, setStep] = useState('phone');
    const [identifier, setIdentifier] = useState('');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [profile, setProfile] = useState({
        username: '',
        bio: '',
        avatarUrl: '',
    });
    const { setUser, setTokens } = useAuthStore();

    const requestOtpMutation = useMutation({
        mutationFn: () => authApi.requestOtp(identifier, email || null),
        onSuccess: (data) => {
            toast.success(data.message || 'OTP sent successfully');
            setStep('otp');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to send OTP');
        },
    });

    const verifyOtpMutation = useMutation({
        mutationFn: () => authApi.verifyOtp(identifier, otp),
        onSuccess: (data) => {
            if (data.valid) {
                toast.success('OTP verified');
                setStep('profile');
            } else {
                toast.error('Invalid OTP');
            }
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'OTP verification failed');
        },
    });

    const signupMutation = useMutation({
        mutationFn: (data) => authApi.signup(data),
        onSuccess: async (data) => {
            if (data.accessToken) {
                setTokens(data.accessToken, data.refreshToken);

                const userApi = await import('../../api/user');
                const userData = await userApi.userApi.getMe();
                setUser(userData);

                toast.success('Account created successfully!');
            }
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Signup failed');
        },
    });

    const handleRequestOtp = (e) => {
        e.preventDefault();
        if (!identifier.trim()) {
            toast.error('Please enter your phone number');
            return;
        }
        requestOtpMutation.mutate();
    };

    const handleVerifyOtp = (e) => {
        e.preventDefault();
        if (!otp.trim()) {
            toast.error('Please enter the OTP');
            return;
        }
        verifyOtpMutation.mutate();
    };

    const handleSignup = (e) => {
        e.preventDefault();
        if (!profile.username.trim()) {
            toast.error('Please enter a username');
            return;
        }

        signupMutation.mutate({
            identifier,
            username: profile.username,
            email: email || identifier,
            phone: identifier,
            bio: profile.bio || undefined,
            avatarUrl: profile.avatarUrl || undefined,
        });
    };

    const handleBack = () => {
        if (step === 'otp') {
            setStep('phone');
            setOtp('');
        } else if (step === 'profile') {
            setStep('otp');
        }
    };

    return (
        <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl p-8 space-y-6"
        >
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold">Create Account</h2>
                <p className="text-gray-400">Join Blink today</p>
            </div>

            {step === 'phone' && (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Phone Number *
                        </label>
                        <Input
                            type="text"
                            placeholder="+1234567890"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            disabled={requestOtpMutation.isPending}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Email (Optional)
                        </label>
                        <Input
                            type="email"
                            placeholder="email@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={requestOtpMutation.isPending}
                        />
                    </div>

                    <Button
                        type="submit"
                        variant="default"
                        className="w-full"
                        loading={requestOtpMutation.isPending}
                    >
                        Continue
                    </Button>
                </form>
            )}

            {step === 'otp' && (
                <Motion.form
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onSubmit={handleVerifyOtp}
                    className="space-y-4"
                >
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Enter OTP
                        </label>
                        <Input
                            type="text"
                            placeholder="000000"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            maxLength={6}
                            disabled={verifyOtpMutation.isPending}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            OTP sent to {identifier}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleBack}
                            disabled={verifyOtpMutation.isPending}
                        >
                            Back
                        </Button>
                        <Button
                            type="submit"
                            variant="default"
                            className="flex-1"
                            loading={verifyOtpMutation.isPending}
                        >
                            Verify OTP
                        </Button>
                    </div>

                    <button
                        type="button"
                        onClick={() => requestOtpMutation.mutate()}
                        disabled={requestOtpMutation.isPending}
                        className="w-full text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        Resend OTP
                    </button>
                </Motion.form>
            )}

            {step === 'profile' && (
                <Motion.form
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onSubmit={handleSignup}
                    className="space-y-4"
                >
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Username *
                        </label>
                        <Input
                            type="text"
                            placeholder="johndoe"
                            value={profile.username}
                            onChange={(e) =>
                                setProfile({ ...profile, username: e.target.value })
                            }
                            disabled={signupMutation.isPending}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Bio (Optional)
                        </label>
                        <Input
                            type="text"
                            placeholder="Tell us about yourself"
                            value={profile.bio}
                            onChange={(e) =>
                                setProfile({ ...profile, bio: e.target.value })
                            }
                            disabled={signupMutation.isPending}
                        />
                    </div>

                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleBack}
                            disabled={signupMutation.isPending}
                        >
                            Back
                        </Button>
                        <Button
                            type="submit"
                            variant="default"
                            className="flex-1"
                            loading={signupMutation.isPending}
                        >
                            Create Account
                        </Button>
                    </div>
                </Motion.form>
            )}

            <div className="text-center pt-4 border-t border-gray-800">
                <p className="text-sm text-gray-400">
                    Already have an account?{' '}
                    <button
                        onClick={onSwitchToLogin}
                        className="text-white font-medium hover:underline"
                    >
                        Sign in
                    </button>
                </p>
            </div>
        </Motion.div>
    );
}
