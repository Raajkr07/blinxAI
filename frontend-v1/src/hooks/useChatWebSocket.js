import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { WS_BASE_URL } from '../config';

export function useChatWebSocket({
  token,
  userId,
  onMessage,
  onPresence,
  onTyping,
  onConnectionChange,
  onConversationCreated,
  conversationIds = []
}) {
  const clientRef = useRef(null);
  const subscriptionsRef = useRef(new Map());
  const typingSubscriptionsRef = useRef(new Map());
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  const onPresenceRef = useRef(onPresence);
  const onTypingRef = useRef(onTyping);
  const onConversationCreatedRef = useRef(onConversationCreated);
  const onConnectionChangeRef = useRef(onConnectionChange);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onPresenceRef.current = onPresence;
  }, [onPresence]);

  useEffect(() => {
    onTypingRef.current = onTyping;
  }, [onTyping]);

  useEffect(() => {
    onConnectionChangeRef.current = onConnectionChange;
  }, [onConnectionChange]);

  useEffect(() => {
    onConversationCreatedRef.current = onConversationCreated;
  }, [onConversationCreated]);

  // Subscribe/unsubscribe to conversation topics when conversationIds change
  useEffect(() => {
    if (!clientRef.current || !connected) return;

    // Double-check that the STOMP client is actually connected
    const client = clientRef.current;
    if (!client || !client.connected) {
      return;
    }

    const currentSubs = subscriptionsRef.current;

    // Subscribe to new conversations
    conversationIds.forEach((convId) => {
      const topic = `/topic/conversations/${convId}`;
      if (convId && !currentSubs.has(topic)) {
        try {
          if (!client.connected) return;

          const sub = client.subscribe(topic, (frame) => {
            try {
              const payload = JSON.parse(frame.body);
              if (onMessageRef.current) {
                onMessageRef.current(payload);
              }
            } catch (error) {
              console.error(`Error parsing WebSocket message for topic ${topic}:`, error);
            }
          });
          currentSubs.set(topic, sub);
        } catch (error) {
          console.error(`Failed to subscribe to conversation ${convId}:`, error);
        }
      }
    });

    // Unsubscribe from removed conversations
    const requiredTopics = new Set(conversationIds.map(id => `/topic/conversations/${id}`));
    currentSubs.forEach((sub, topic) => {
      if (!requiredTopics.has(topic)) {
        try {
          sub.unsubscribe();
          currentSubs.delete(topic);
        } catch (error) {
          console.error(`Failed to unsubscribe from conversation topic ${topic}:`, error);
        }
      }
    });

    // Manage typing subscriptions
    const currentTypingSubs = typingSubscriptionsRef.current;

    // Subscribe to typing topics for new conversations
    conversationIds.forEach((convId) => {
      const typingTopic = `/topic/conversations/${convId}/typing`;
      if (convId && !currentTypingSubs.has(typingTopic)) {
        try {
          if (!client.connected) return;

          const typingSub = client.subscribe(typingTopic, (frame) => {
            if (!onTypingRef.current) return;
            try {
              const payload = JSON.parse(frame.body);
              onTypingRef.current(payload);
            } catch (error) {
              console.error(`Error parsing typing event for topic ${typingTopic}:`, error);
            }
          });
          currentTypingSubs.set(typingTopic, typingSub);
        } catch (error) {
          console.error(`Failed to subscribe to typing topic for ${convId}:`, error);
        }
      }
    });

    // Unsubscribe from typing topics for removed conversations
    const requiredTypingTopics = new Set(conversationIds.map(id => `/topic/conversations/${id}/typing`));
    currentTypingSubs.forEach((sub, topic) => {
      if (!requiredTypingTopics.has(topic)) {
        try {
          sub.unsubscribe();
          currentTypingSubs.delete(topic);
        } catch (error) {
          console.error(`Failed to unsubscribe from typing topic ${topic}:`, error);
        }
      }
    });
  }, [conversationIds, connected]);

  useEffect(() => {
    if (!userId || !token) return;

    const socketFactory = () => new SockJS(WS_BASE_URL);
    const client = new Client({
      webSocketFactory: socketFactory,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        setConnected(true);
        if (onConnectionChangeRef.current) onConnectionChangeRef.current(true);

        // Direct messages from /user/queue/messages
        client.subscribe('/user/queue/messages', (frame) => {
          try {
            const payload = JSON.parse(frame.body);
            if (onMessageRef.current) {
              onMessageRef.current(payload);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message from /user/queue/messages:', error, frame.body);
          }
        });

        // Presence updates from /topic/presence
        client.subscribe('/topic/presence', (frame) => {
          if (!onPresenceRef.current) return;
          try {
            const payload = JSON.parse(frame.body);
            onPresenceRef.current(payload);
          } catch (error) {
            console.error('Error parsing presence event:', error);
          }
        });

        // New conversation updates from /user/queue/conversations/new
        client.subscribe('/user/queue/conversations/new', (frame) => {
          if (!onConversationCreatedRef.current) return;
          try {
            const payload = JSON.parse(frame.body);
            onConversationCreatedRef.current(payload);
          } catch (error) {
            console.error('Error parsing conversation created event:', error);
          }
        });

        // Note: Conversation topic subscriptions are handled by the other useEffect
        // whenever 'connected' becomes true or 'conversationIds' changes.
      },
      onDisconnect: () => {
        setConnected(false);
        if (onConnectionChangeRef.current) onConnectionChangeRef.current(false);
        subscriptionsRef.current.clear();
        typingSubscriptionsRef.current.clear();
      },
      onStompError: (frame) => {
        console.error('STOMP error', frame);
        setConnected(false);
        if (onConnectionChangeRef.current) onConnectionChangeRef.current(false);
      },
      onWebSocketClose: () => {
        setConnected(false);
        if (onConnectionChangeRef.current) onConnectionChangeRef.current(false);
        subscriptionsRef.current.clear();
        typingSubscriptionsRef.current.clear();
      },
    });

    client.connectHeaders = {
      Authorization: `Bearer ${token}`,
    };

    client.activate();
    clientRef.current = client;

    return () => {
      setConnected(false);
      if (onConnectionChangeRef.current) onConnectionChangeRef.current(false);
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current.clear();
      typingSubscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      typingSubscriptionsRef.current.clear();
      if (client && client.connected) {
        client.deactivate();
      }
      clientRef.current = null;
    };
  }, [userId, token]);

  const sendMessage = useCallback(
    (convId, body) => {
      if (!clientRef.current || !connected) {
        console.warn('Cannot send message: WebSocket not connected');
        return false;
      }
      try {
        clientRef.current.publish({
          destination: '/app/chat.sendMessage',
          body: JSON.stringify({ conversationId: convId, body }),
        });
        return true;
      } catch (error) {
        console.error('Error sending message:', error);
        return false;
      }
    },
    [connected]
  );

  const sendTyping = useCallback(
    (convId, isTyping) => {
      if (!clientRef.current || !connected) return false;
      try {
        clientRef.current.publish({
          destination: '/app/chat.typing',
          body: JSON.stringify({ conversationId: convId, typing: isTyping }),
        });
        return true;
      } catch (error) {
        console.error('Error sending typing indicator:', error);
        return false;
      }
    },
    [connected]
  );

  return { connected, sendMessage, sendTyping };
}
