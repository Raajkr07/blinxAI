import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion as Motion } from 'framer-motion';
import { authApi } from '../../api';
import { useAuthStore } from '../../stores';
import { Button, Input } from '../ui';
import toast from 'react-hot-toast';

export function Login({ onSwitchToSignup }) {
    const [step, setStep] = useState('phone');
    const [identifier, setIdentifier] = useState('');
    const [otp, setOtp] = useState('');
    const { setUser, setTokens } = useAuthStore();

    const requestOtpMutation = useMutation({
        mutationFn: () => authApi.requestOtp(identifier),
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
        onSuccess: async (data) => {
            if (data.valid) {
                try {

                    const loginData = await authApi.login({ identifier });

                    if (loginData.accessToken) {
                        setTokens(loginData.accessToken, loginData.refreshToken);

                        const userApi = await import('../../api/user');
                        const userData = await userApi.userApi.getMe();
                        setUser(userData);

                        toast.success('Welcome back!');
                    } else if (loginData.error === 'USER_NOT_FOUND') {
                        toast.error('Account not found. Please sign up.');
                        onSwitchToSignup?.();
                    }
                } catch (error) {
                    toast.error(error.response?.data?.message || 'Login failed');
                }
            } else {
                toast.error('Invalid OTP');
            }
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'OTP verification failed');
        },
    });

    const handleRequestOtp = (e) => {
        e.preventDefault();
        if (!identifier.trim()) {
            toast.error('Please enter your phone number or email');
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

    const handleBack = () => {
        setStep('phone');
        setOtp('');
    };

    return (
        <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl p-8 space-y-6"
        >
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold">Welcome Back</h2>
                <p className="text-gray-400">Sign in to continue to Blink</p>
            </div>

            {step === 'phone' && (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Phone Number or Email
                        </label>
                        <Input
                            type="text"
                            placeholder="+1234567890 or email@example.com"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
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
                            Verify & Login
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

            <div className="text-center pt-4 border-t border-gray-800">
                <p className="text-sm text-gray-400">
                    Don't have an account?{' '}
                    <button
                        onClick={onSwitchToSignup}
                        className="text-white font-medium hover:underline"
                    >
                        Sign up
                    </button>
                </p>
            </div>
        </Motion.div>
    );
}
