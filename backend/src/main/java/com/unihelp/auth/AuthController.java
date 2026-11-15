package com.unihelp.auth;

import com.unihelp.auth.dto.AccountDto;
import com.unihelp.auth.dto.LoginRequest;
import com.unihelp.auth.dto.MessageResponse;
import com.unihelp.auth.dto.RegisterRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * REST contract for UC1 (Design Document §2.3.1); PA-2 stubs only.
 * Session creation, session-id rotation, CSRF and logout are configured with Spring Security in T3.1.
 */
@RestController
@RequestMapping("/api/auth")
@Validated
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) { this.authService = authService; }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @GetMapping("/verify")
    public MessageResponse verify(@RequestParam("token") @NotBlank String token) {
        return authService.verify(token);
    }

    /** On success T3.1 stores the security context in a new HTTP session (HttpOnly cookie). */
    @PostMapping("/login")
    public AccountDto login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    /** T3.1: invalidates the server-side session and clears the cookie; always 204. */
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout() {
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "PA-2 stub; session handling in T3.1");
    }
}
