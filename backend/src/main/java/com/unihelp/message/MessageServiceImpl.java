package com.unihelp.message;

import com.unihelp.message.dto.ConversationDto;
import com.unihelp.message.dto.ConversationSummaryDto;
import com.unihelp.message.dto.MessageDto;
import com.unihelp.message.dto.SendMessageRequest;
import com.unihelp.message.dto.StartConversationRequest;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Stub implementation for PA-2 so that the application context starts.
 * The real logic is implemented in Sprint 2 (task T3.6).
 */
@Service
public class MessageServiceImpl implements MessageService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final MessageEncryptor messageEncryptor;

    public MessageServiceImpl(ConversationRepository conversationRepository,
                              MessageRepository messageRepository,
                              MessageEncryptor messageEncryptor) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.messageEncryptor = messageEncryptor;
    }

    @Override
    public ConversationDto startConversation(Long postId, Long currentUserId, StartConversationRequest request) {
        throw new UnsupportedOperationException("Not implemented yet (Sprint 2, T3.6)");
    }

    @Override
    public List<ConversationSummaryDto> listConversations(Long currentUserId) {
        throw new UnsupportedOperationException("Not implemented yet (Sprint 2, T3.6)");
    }

    @Override
    public MessageDto sendMessage(Long conversationId, Long currentUserId, SendMessageRequest request) {
        throw new UnsupportedOperationException("Not implemented yet (Sprint 2, T3.6)");
    }
}
