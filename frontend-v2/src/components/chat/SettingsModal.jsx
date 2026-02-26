import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { userService, authService } from '../../services';
import { useAuthStore, useUIStore } from '../../stores';
import { Modal, ModalFooter, Button, Input, Avatar } from '../ui';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

export function SettingsModal({ open, onOpenChange }) {
    const { user, setUser } = useAuthStore();
    const { showAISuggestions, toggleAISuggestions } = useUIStore();
    const [isRevokingGoogle, setIsRevokingGoogle] = useState(false);
    const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false);
    const [formData, setFormData] = useState(() => ({
        username: user?.username || '',
        bio: user?.bio || '',
        avatarUrl: user?.avatarUrl || '',
        email: user?.email || '',
        phone: user?.phone || '',
    }));

    const updateProfileMutation = useMutation({
        mutationFn: (data) => userService.updateProfile(data),
        onSuccess: (updatedUser) => {
            setUser(updatedUser);
            toast.success('Profile updated');
            onOpenChange(false);
        },
        onError: (error) => {
            void error;
            toast.error('Update failed');
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = {
            ...formData,
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            username: formData.username.trim()
        };
        updateProfileMutation.mutate(payload);
    };

    const handleDisconnectGoogle = async () => {
        setIsDisconnectingGoogle(true);
        try {
            await authService.logoutGoogle();
            toast.success('Google account disconnected');
        } catch (error) {
            void error;
            toast.error('Failed to disconnect');
        } finally {
            setIsDisconnectingGoogle(false);
        }
    };

    const handleRevokeGoogle = async () => {
        setIsRevokingGoogle(true);
        try {
            await authService.revokeGoogleAccess();
            toast.success('Google access revoked');
        } catch (error) {
            void error;
            toast.error('Failed to revoke');
        } finally {
            setIsRevokingGoogle(false);
        }
    };

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="Settings"
            description="Manage your profile and preferences"
            size="md"
        >
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 py-2">

                    {/* Avatar */}
                    <div className="flex flex-col items-center py-4">
                        <div className="relative group mb-3">
                            <Avatar
                                src={formData.avatarUrl}
                                name={formData.username}
                                size="xl"
                                className="w-24 h-24 ring-2 ring-white/10 shadow-xl"
                            />
                        </div>
                        <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--color-gray-500)]">Profile photo</p>
                    </div>

                    {/* Profile */}
                    <section>
                        <h4 className="text-[10px] uppercase font-semibold tracking-wider text-[var(--color-gray-500)] mb-3 px-1">Profile</h4>
                        <div className="rounded-2xl bg-white/[0.03] border border-white/5 divide-y divide-white/5">
                            <div className="p-4">
                                <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1 block">Username</label>
                                <Input
                                    id="settings-username"
                                    name="username"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="Your display name"
                                    className="bg-transparent border-white/5 focus:border-blue-500/40 h-10"
                                    required
                                />
                            </div>
                            <div className="p-4">
                                <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1 block">Bio</label>
                                <Input
                                    id="settings-bio"
                                    name="bio"
                                    value={formData.bio}
                                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                    placeholder="A short description about you"
                                    className="bg-transparent border-white/5 focus:border-blue-500/40 h-10"
                                />
                            </div>
                            <div className="p-4">
                                <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1 block">Avatar URL</label>
                                <Input
                                    id="settings-avatar-url"
                                    name="avatarUrl"
                                    value={formData.avatarUrl}
                                    onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                                    placeholder="https://..."
                                    className="bg-transparent border-white/5 focus:border-blue-500/40 h-10"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Contact */}
                    <section>
                        <h4 className="text-[10px] uppercase font-semibold tracking-wider text-[var(--color-gray-500)] mb-3 px-1">Contact</h4>
                        <div className="rounded-2xl bg-white/[0.03] border border-white/5 divide-y divide-white/5">
                            <div className="p-4">
                                <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1 block">Email</label>
                                <Input
                                    id="settings-email"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="you@example.com"
                                    className="bg-transparent border-white/5 focus:border-blue-500/40 h-10"
                                />
                            </div>
                            <div className="p-4">
                                <label className="text-[10px] uppercase font-medium tracking-wider text-[var(--color-gray-500)] mb-1 block">Phone</label>
                                <Input
                                    id="settings-phone"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+91 00000-00000"
                                    className="bg-transparent border-white/5 focus:border-blue-500/40 h-10"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Google Account */}
                    <section>
                        <h4 className="text-[10px] uppercase font-semibold tracking-wider text-[var(--color-gray-500)] mb-3 px-1">Google Account</h4>
                        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-[var(--color-foreground)]">Google</p>
                                        <p className="text-[10px] text-[var(--color-gray-500)]">Used for email & calendar</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleDisconnectGoogle}
                                    loading={isDisconnectingGoogle}
                                    className="text-[10px] font-semibold text-[var(--color-gray-400)] h-8 px-3"
                                >
                                    Disconnect
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRevokeGoogle}
                                    loading={isRevokingGoogle}
                                    className="text-[10px] font-semibold text-red-400 hover:bg-red-500/10 h-8 px-3"
                                >
                                    Revoke Access
                                </Button>
                            </div>
                        </div>
                    </section>

                    {/* Preferences */}
                    <section>
                        <h4 className="text-[10px] uppercase font-semibold tracking-wider text-[var(--color-gray-500)] mb-3 px-1">Preferences</h4>
                        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-semibold text-[var(--color-foreground)]">AI Suggestions</p>
                                    <p className="text-[10px] text-[var(--color-gray-500)] mt-0.5">Show smart reply suggestions in chat</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={toggleAISuggestions}
                                    className={cn(
                                        "relative inline-flex h-5 w-9 cursor-pointer rounded-full transition-all duration-200",
                                        showAISuggestions ? "bg-blue-500" : "bg-white/10"
                                    )}
                                >
                                    <span className={cn(
                                        "pointer-events-none h-4 w-4 transform rounded-full bg-white shadow transition duration-200 mt-0.5",
                                        showAISuggestions ? "translate-x-[18px]" : "translate-x-0.5"
                                    )} />
                                </button>
                            </div>
                        </div>
                    </section>
                </div>

                <ModalFooter>
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="text-xs font-medium text-[var(--color-gray-400)]"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="default"
                        loading={updateProfileMutation.isPending}
                        className="text-xs font-semibold h-9 px-6"
                    >
                        Save Changes
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}
