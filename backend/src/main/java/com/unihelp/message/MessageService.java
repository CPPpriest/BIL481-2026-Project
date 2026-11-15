package com.unihelp.message;

import com.unihelp.message.dto.ConversationDto;
import com.unihelp.message.dto.ConversationSummaryDto;
import com.unihelp.message.dto.MessageDto;
import com.unihelp.message.dto.SendMessageRequest;
import com.unihelp.message.dto.StartConversationRequest;
import java.util.List;

/**
 * Business operations of the messaging module (UC3, FR-19 - FR-21, FR-24).
 * All returned DTOs carry display aliases only, never e-mail addresses (FR-20, NFR-04).
 */
public interface MessageService {

    /**
     * Starts (or reuses) a conversation between the current user and the author of the post
     * and stores the first message.
     *
     * @throws IllegalArgumentException if the post does not exist or is not Active
     * @throws IllegalStateException    if the post is Resolved (FR-12), the user is the author,
     *                                  or the user is blocked by the author (FR-24)
     */
    ConversationDto startConversation(Long postId, Long currentUserId, StartConversationRequest request);

    /** Lists the current user's conversations with the unread counter, newest activity first (FR-21). */
    List<ConversationSummaryDto> listConversations(Long currentUserId);

    /**
     * Sends a text message (1 - 1,000 characters) into an existing conversation.
     *
     * @throws SecurityException     if the current user is not a participant (FR-19, HTTP 403)
     * @throws IllegalStateException if the post is Resolved (FR-12) or the sender is blocked (FR-24)
     */
    MessageDto sendMessage(Long conversationId, Long currentUserId, SendMessageRequest request);
}
