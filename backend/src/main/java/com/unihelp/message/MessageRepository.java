package com.unihelp.message;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByConversationIdOrderBySentAtAsc(Long conversationId);

    Message findFirstByConversationIdOrderBySentAtDesc(Long conversationId);

    /** Unread messages in a conversation that were sent by the other participant (FR-21). */
    @Query("select count(m) from Message m "
            + "where m.conversation.id = :conversationId "
            + "and m.senderId <> :userId and m.readAt is null")
    long countUnread(@Param("conversationId") Long conversationId, @Param("userId") Long userId);
}
