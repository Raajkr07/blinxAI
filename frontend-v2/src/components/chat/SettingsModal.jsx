import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { userApi } from '../../api';
import { useAuthStore } from '../../stores';
import { Modal, ModalFooter, Button, Input, Avatar } from '../ui';
import toast from 'react-hot-toast';

export function SettingsModal({ open, onOpenChange }) {
    const { user, setUser } = useAuthStore();
    const [formData, setFormData] = useState(() => ({
        username: user?.username || '',
        bio: user?.bio || '',
        avatarUrl: user?.avatarUrl || '',
        email: user?.email || '',
        phone: user?.phone || '',
    }));

    const updateProfileMutation = useMutation({
        mutationFn: (data) => userApi.updateProfile(data),
        onSuccess: (updatedUser) => {
            setUser(updatedUser);
            toast.success('Profile updated');
            onOpenChange(false);
        },
        onError: (error) => {
            console.error('[SettingsModal] Update failed:', error);
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
                <div className="flex justify-center mb-6">
                    <Avatar
                        src={formData.avatarUrl}
                        name={formData.username}
                        size="xl"
                        className="w-24 h-24 text-2xl"
                    />
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-[var(--color-foreground)]">
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
                        <label className="block text-sm font-medium mb-1.5 text-[var(--color-foreground)]">
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
                        <label className="block text-sm font-medium mb-1.5 text-[var(--color-foreground)]">
                            Phone
                        </label>
                        <Input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+1 234 567 8900"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-[var(--color-foreground)]">
                            Bio
                        </label>
                        <Input
                            value={formData.bio}
                            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                            placeholder="Tell us about yourself"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-[var(--color-foreground)]">
                            Avatar URL
                        </label>
                        <Input
                            value={formData.avatarUrl}
                            onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                            placeholder="https://example.com/avatar.jpg"
                        />
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
