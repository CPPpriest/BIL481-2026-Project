package com.unihelp.message;

import com.unihelp.message.dto.ConversationDto;
import com.unihelp.message.dto.ConversationSummaryDto;
import com.unihelp.message.dto.MessageDto;
import com.unihelp.message.dto.SendMessageRequest;
import com.unihelp.message.dto.StartConversationRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST endpoints of the messaging module (UC3).
 */
@RestController
@RequestMapping("/api")
public class MessageController {

    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    /** Starts a conversation with the author of a post from the post detail page (FR-17, FR-19). */
    @PostMapping("/posts/{id}/conversations")
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationDto startConversation(@PathVariable("id") Long postId,
                                             @Valid @RequestBody StartConversationRequest request) {
        return messageService.startConversation(postId, currentUserId(), request);
    }

    /** Lists the current user's conversations with unread counters (FR-21). */
    @GetMapping("/conversations")
    public List<ConversationSummaryDto> listConversations() {
        return messageService.listConversations(currentUserId());
    }

    /** Sends a message into a conversation the current user takes part in (FR-19). */
    @PostMapping("/conversations/{id}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageDto sendMessage(@PathVariable("id") Long conversationId,
                                  @Valid @RequestBody SendMessageRequest request) {
        return messageService.sendMessage(conversationId, currentUserId(), request);
    }

    /**
     * The authenticated user's id. It will be read from the security context once the
     * auth module (UC1) is in place.
     */
    private Long currentUserId() {
        throw new UnsupportedOperationException("Authentication is not implemented yet (Sprint 1, T3.1)");
    }
}
