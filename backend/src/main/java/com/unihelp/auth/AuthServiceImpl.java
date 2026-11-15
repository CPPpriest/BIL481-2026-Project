package com.unihelp.auth;

import com.unihelp.auth.dto.AccountDto;
import com.unihelp.auth.dto.LoginRequest;
import com.unihelp.auth.dto.MessageResponse;
import com.unihelp.auth.dto.RegisterRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Wiring-only PA-2 stub; no operation writes data or claims to enforce business rules. */
@Service
public class AuthServiceImpl implements AuthService {
    private final UserRepository userRepository;

    public AuthServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public MessageResponse register(RegisterRequest request) { throw pending(); }

    @Override
    public MessageResponse verify(String token) { throw pending(); }

    @Override
    public AccountDto login(LoginRequest request) { throw pending(); }

    @Override
    public AccountDto getOwnAccount(Long currentUserId) { throw pending(); }

    @Override
    public AccountStatus setSuspended(Long userId, boolean suspended) { throw pending(); }

    @Override
    public String getDisplayAlias(Long userId) { throw pending(); }

    private ResponseStatusException pending() {
        return new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "PA-2 stub; implementation in T3.1");
    }
}
