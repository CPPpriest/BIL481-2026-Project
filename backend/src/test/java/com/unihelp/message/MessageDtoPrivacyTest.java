package com.unihelp.message;

import static org.junit.jupiter.api.Assertions.assertFalse;

import com.unihelp.message.dto.ConversationDto;
import com.unihelp.message.dto.ConversationSummaryDto;
import com.unihelp.message.dto.MessageDto;
import java.lang.reflect.RecordComponent;
import java.util.Locale;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Static part of TC-04 (QA Plan): messaging response DTOs must not have any e-mail field
 * (FR-20, NFR-04). The API-level part of TC-04 is added with the implementation in Sprint 2.
 */
class MessageDtoPrivacyTest {

    static Stream<Class<? extends Record>> responseDtos() {
        return Stream.of(ConversationDto.class, ConversationSummaryDto.class, MessageDto.class);
    }

    @ParameterizedTest
    @MethodSource("responseDtos")
    void responseDtoHasNoEmailField(Class<? extends Record> dto) {
        for (RecordComponent component : dto.getRecordComponents()) {
            String name = component.getName().toLowerCase(Locale.ROOT);
            assertFalse(name.contains("email") || name.contains("mail"),
                    dto.getSimpleName() + " must not expose an e-mail field: " + component.getName());
        }
    }
}
