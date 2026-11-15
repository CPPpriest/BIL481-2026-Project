package com.unihelp.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;

import com.unihelp.admin.dto.AccountStatusDto;
import com.unihelp.admin.dto.ReportEntryDto;
import com.unihelp.admin.dto.ReportedPostDto;
import com.unihelp.auth.dto.MessageResponse;
import com.unihelp.report.dto.ReportResponse;
import java.lang.reflect.RecordComponent;
import java.util.Locale;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * NFR-04: auth, report and admin responses must not carry an e-mail field.
 * AccountDto is excluded on purpose: it is only returned as the caller's own profile.
 */
class AuthDtoPrivacyTest {

    static Stream<Class<? extends Record>> responseDtos() {
        return Stream.of(MessageResponse.class, ReportResponse.class, ReportedPostDto.class,
                ReportEntryDto.class, AccountStatusDto.class);
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
