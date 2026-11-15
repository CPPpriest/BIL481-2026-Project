package com.unihelp.message;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    /** Used to reuse an existing conversation instead of opening a duplicate one. */
    Optional<Conversation> findByPostIdAndInitiatorId(Long postId, Long initiatorId);

    /** All conversations the user takes part in, most recent activity first. */
    @Query("select c from Conversation c "
            + "where c.initiatorId = :userId or c.authorId = :userId "
            + "order by c.lastMessageAt desc")
    List<Conversation> findAllForParticipant(@Param("userId") Long userId);
}
