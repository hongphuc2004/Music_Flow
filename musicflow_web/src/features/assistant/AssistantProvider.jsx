import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clientAssistantApi } from '../../services/api';
import useAppToast from '../../components/common/useAppToast';

const AssistantContext = createContext(null);

export const useAssistant = () => {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
};

export const AssistantProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scope, setScope] = useState('global'); // 'global' | 'mood'
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const showToast = useAppToast();
  
  // Dynamic capabilities registry
  const capabilitiesRef = useRef({});
  const currentSongRef = useRef(null);

  // Register capabilities (e.g. PLAY_SONG, OPEN_ROUTE)
  const registerCapability = useCallback((name, handler) => {
    capabilitiesRef.current[name] = handler;
  }, []);

  const unregisterCapability = useCallback((name) => {
    delete capabilitiesRef.current[name];
  }, []);

  const executeCapability = useCallback((name, payload) => {
    if (capabilitiesRef.current[name]) {
      capabilitiesRef.current[name](payload);
      return true;
    }
    return false;
  }, []);

  // Update current path in context automatically
  const currentContext = {
    surface: location.pathname.startsWith('/admin')
      ? 'admin'
      : location.pathname.startsWith('/artist')
      ? 'artist'
      : 'client',
    route: location.pathname,
    currentSong: currentSongRef.current,
  };

  // Load list of conversations for current role
  const loadConversations = useCallback(async (filterScope = 'all') => {
    try {
      const res = await clientAssistantApi.getConversations({ scope: filterScope });
      if (res.data?.success) {
        setConversations(res.data.data || []);
      }
    } catch (err) {
      console.warn('Failed to load assistant conversations:', err);
    }
  }, []);

  // Load details and message history of a conversation
  const loadConversationDetail = useCallback(async (convId) => {
    if (!convId) return;
    setIsLoading(true);
    try {
      const res = await clientAssistantApi.getConversation(convId);
      if (res.data?.success) {
        const { conversation, messages: chatMsgs, playlists: chatPlaylists } = res.data.data;
        setActiveConversationId(conversation._id);
        setScope(conversation.scope || 'global');
        setPlaylists(chatPlaylists || []);
        
        // Map messages role format
        const mapped = (chatMsgs || []).map((m) => ({
          ...m,
          role: m.role === 'model' ? 'assistant' : 'user',
          playlistId: m.metadata?.playlistId || null,
        }));
        setMessages(mapped);
      }
    } catch (err) {
      console.warn('Failed to load conversation detail:', err);
      showToast('Không thể tải lịch sử cuộc trò chuyện.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Start a new blank conversation
  const startNewConversation = useCallback((newScope = 'global') => {
    setActiveConversationId(null);
    setMessages([]);
    setPlaylists([]);
    setScope(newScope);
  }, []);

  // Execute client-side actions returned by AI
  const executeClientActions = useCallback((actions) => {
    if (!actions || !Array.isArray(actions)) return;

    actions.forEach((action) => {
      const { type, payload } = action;
      console.log(`Executing assistant clientAction: ${type}`, payload);

      if (type === 'OPEN_ROUTE' && payload?.route) {
        navigate(payload.route);
        showToast('Đang chuyển hướng...', 'info');
      } else if (capabilitiesRef.current[type]) {
        // Run registered handler (e.g. playing a song)
        capabilitiesRef.current[type](payload);
      } else {
        console.warn(`No handler registered for clientAction: ${type}`);
      }
    });
  }, [navigate, showToast]);

  // Send a message
  const sendMessage = useCallback(async (text) => {
    if (!text || !text.trim()) return;
    
    // Check if user is logged in
    const userRole = localStorage.getItem('role');
    if (!userRole) {
      // Trigger login prompt or toast
      showToast('Vui lòng đăng nhập để sử dụng trợ lý AI.', 'warning');
      window.dispatchEvent(new Event('musicflow-trigger-login-dialog'));
      return;
    }

    const tempUserMessage = {
      _id: `temp-user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMessage]);
    setIsLoading(true);

    try {
      const payload = {
        prompt: text,
        conversationId: activeConversationId || undefined,
        scope,
        context: currentContext,
      };

      const res = await clientAssistantApi.sendMessage(payload);
      if (res.data?.success) {
        const { conversation, message, clientActions: actions, playlist } = res.data.data;
        
        setActiveConversationId(conversation._id);
        if (playlist) {
          setPlaylists((prev) => {
            const exists = prev.some((p) => p._id === playlist._id);
            return exists ? prev : [...prev, playlist];
          });
        }
        
        // Remove temp message and append official ones
        const responseMsg = {
          ...message,
          role: message.role === 'model' ? 'assistant' : 'user',
          playlistId: message.metadata?.playlistId || null,
        };

        setMessages((prev) => {
          const filtered = prev.filter((m) => !m._id.startsWith('temp-user-'));
          return [
            ...filtered,
            { _id: `user-${Date.now()}`, role: 'user', content: text, createdAt: new Date().toISOString() },
            responseMsg,
          ];
        });

        // Trigger action callbacks (e.g., play song or redirect)
        if (actions && actions.length > 0) {
          executeClientActions(actions);
        }

        // Refresh conversation history list
        loadConversations(scope);
      }
    } catch (err) {
      console.error('Failed to send message to assistant:', err);
      const errMessage = err.response?.data?.message || '';
      const isQuotaError = err.response?.status === 403 && 
        (errMessage.includes("vượt quá hạn mức") || 
         errMessage.includes("hạn mức") || 
         errMessage.includes("yêu cầu AI") ||
         errMessage.includes("nâng cấp"));

      if (isQuotaError) {
        setUpgradeDialogOpen(true);
      } else {
        showToast(errMessage || 'Có lỗi xảy ra khi trò chuyện với trợ lý.', 'error');
      }
      
      // Rollback temporary user message on failure
      setMessages((prev) => prev.filter((m) => !m._id.startsWith('temp-user-')));
    } finally {
      setIsLoading(false);
    }
  }, [activeConversationId, scope, currentContext, executeClientActions, loadConversations, showToast]);

  const deleteConversation = useCallback(async (convId) => {
    try {
      const res = await clientAssistantApi.deleteConversation(convId);
      if (res.data?.success) {
        showToast('Đã xóa cuộc hội thoại.', 'success');
        setConversations((prev) => prev.filter((c) => c._id !== convId));
        if (activeConversationId === convId) {
          startNewConversation(scope);
        }
      }
    } catch (err) {
      console.warn('Failed to delete conversation:', err);
      showToast('Không thể xóa cuộc trò chuyện.', 'error');
    }
  }, [activeConversationId, scope, startNewConversation, showToast]);

  // Load conversation lists when opening panel
  useEffect(() => {
    if (isOpen) {
      loadConversations(scope);
    }
  }, [isOpen, scope, loadConversations]);

  // Sync current playing song ref
  const setCurrentSong = useCallback((song) => {
    currentSongRef.current = song;
  }, []);

  return (
    <AssistantContext.Provider
      value={{
        isOpen,
        setIsOpen,
        conversations,
        activeConversationId,
        messages,
        playlists,
        setPlaylists,
        isLoading,
        scope,
        setScope,
        sendMessage,
        loadConversations,
        loadConversationDetail,
        startNewConversation,
        deleteConversation,
        registerCapability,
        unregisterCapability,
        executeCapability,
        setCurrentSong,
        currentContext,
        upgradeDialogOpen,
        setUpgradeDialogOpen,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
};
