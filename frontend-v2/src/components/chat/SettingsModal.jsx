import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { userService } from '../../services';
import { useAuthStore, useUIStore } from '../../stores';
import { Modal, ModalFooter, Button, Input, Avatar } from '../ui';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

export function SettingsModal({ open, onOpenChange }) {
    const { user, setUser } = useAuthStore();
    const { showAISuggestions, toggleAISuggestions } = useUIStore();
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
            if (error.response?.status === 500) {
                toast.error('Server error: Possible duplicate username or data issue.');
            } else {
                toast.error(error.response?.data?.message || 'Failed to update profile');
            }
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const payload = {
            ...formData,
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            username: formData.username.trim()
        };

        updateProfileMutation.mutate(payload);
    };

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="Profile Settings"
            description="Update your profile information"
            size="md"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex justify-center mb-1">
                    <Avatar
                        src={formData.avatarUrl}
                        name={formData.username}
                        size="xl"
                        className="w-24 h-24 text-2xl"
                    />
                </div>

                <div className="space-y-2">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-[var(--color-foreground)]">
                            Name
                        </label>
                        <Input
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            placeholder="Enter Name"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-[var(--color-foreground)]">
                            Email
                        </label>
                        <Input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="your.email@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-[var(--color-foreground)]">
                            Phone
                        </label>
                        <Input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+91 98765 43210"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-[var(--color-foreground)]">
                            Bio
                        </label>
                        <Input
                            value={formData.bio}
                            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                            placeholder="Tell us about yourself"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-[var(--color-foreground)]">
                            Avatar URL
                        </label>
                        <Input
                            value={formData.avatarUrl}
                            onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                            placeholder="https://example.com/avatar.jpg"
                        />
                    </div>

                    <div className="pt-4 border-t border-[var(--color-border)]">
                        <div className="flex items-center justify-between py-2">
                            <div>
                                <h4 className="text-sm font-medium text-[var(--color-foreground)]">AI Fast-Reply</h4>
                                <p className="text-xs text-[var(--color-gray-500)]">Show AI-generated smart replies for quick responses</p>
                            </div>
                            <button
                                type="button"
                                onClick={toggleAISuggestions}
                                className={cn(
                                    "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                    showAISuggestions ? "bg-blue-600" : "bg-gray-700"
                                )}
                            >
                                <span
                                    className={cn(
                                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                        showAISuggestions ? "translate-x-5" : "translate-x-0"
                                    )}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                <ModalFooter>
                    <Button
                        variant="outline"
                        type="button"
                        onClick={() => onOpenChange(false)}
                        disabled={updateProfileMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="default"
                        disabled={updateProfileMutation.isPending}
                    >
                        {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}
