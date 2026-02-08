import { useUIStore } from '../../../store/uiStore';
import { useAuthStore } from '../../../store/authStore';
import { useChatStore } from '../../../store/chatStore';
import {
    createGroupConversation,
    createDirectConversation
} from '../../../api/chatApi';

import UserProfile from '../../user/UserProfile';
import EditProfile from '../../user/EditProfile';
import GroupManagement from '../group/GroupManagement';
import NewChatModal from './NewChatModal';
import SummaryModal from '../SummaryModal';
import IncomingCallModal from '../../video/IncomingCallModal';

export default function ChatModals({
    incomingCall,
    callerInfo,
    onAcceptCall,
    onRejectCall,
    summaryData
}) {
    const { user, token } = useAuthStore();
    const { activeModal, modalData, closeModal, showToast } = useUIStore();
    const { conversations, setConversations, setActiveTab } = useChatStore();

    const handleCreateGroup = async (title, participantIds) => {
        try {
            const participants = participantIds && participantIds.length > 0
                ? participantIds
                : [user.id];

            const newConv = await createGroupConversation(token, title, participants);
            setConversations(prev => [newConv, ...prev]);
            setActiveTab(newConv.id);
            closeModal();
        } catch (e) {
            showToast(e.message, 'error');
        }
    };


    const handleJoinDirect = async (targetUserId) => {
        try {
            const conv = await createDirectConversation(token, targetUserId);
            if (!conversations.find(c => c.id === conv.id)) setConversations([conv, ...conversations]);
            setActiveTab(conv.id);
            closeModal();
        } catch (e) { showToast(e.message, 'error'); }
    };

    return (
        <>
            {activeModal === 'newChat' && (
                <NewChatModal
                    onClose={closeModal}
                    onCreateGroup={handleCreateGroup}
                    onJoinDirect={handleJoinDirect}
                />
            )}

            {activeModal === 'viewProfile' && modalData && (
                <UserProfile
                    userId={modalData}
                    token={token}
                    currentUserId={user?.id}
                    onClose={closeModal}
                    onStartChat={(target) => handleJoinDirect(target.id)}
                />
            )}

            {activeModal === 'editProfile' && (
                <EditProfile
                    user={user}
                    token={token}
                    onClose={closeModal}
                    onUpdate={() => window.location.reload()}
                />
            )}

            {activeModal === 'groupManagement' && modalData && (
                <GroupManagement
                    groupId={modalData}
                    token={token}
                    currentUserId={user?.id}
                    onClose={closeModal}
                    onUpdate={() => { }}
                />
            )}

            {activeModal === 'summary' && (
                <SummaryModal
                    isOpen={true}
                    onClose={closeModal}
                    summaryData={summaryData}
                />
            )}

            {/* Incoming Call Modal is slightly different as it depends on local call state */}
            {incomingCall && (
                <IncomingCallModal
                    call={incomingCall}
                    callerName={callerInfo?.username || 'Unknown'}
                    callerAvatar={callerInfo?.avatarUrl}
                    onAccept={onAcceptCall}
                    onReject={onRejectCall}
                />
            )}
        </>
    );
}
