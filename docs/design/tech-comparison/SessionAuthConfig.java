package comparison.auth.session;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;

/**
 * Documentation-only SELECTED approach: server-side session (Spring Security + Spring Session JDBC).
 * Not part of the application build. Needs spring-boot-starter-security and spring-session-jdbc;
 * application.yml: server.servlet.session.timeout=60m, cookie http-only/secure/same-site=lax.
 */
@Configuration
public class SessionAuthConfig {

    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        http
            // Session cookie is sent automatically by the browser, so CSRF protection is required.
            // The SPA reads XSRF-TOKEN and sends it back as the X-XSRF-TOKEN header.
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
            // New session id after login: protects against session fixation.
            .sessionManagement(s -> s.sessionFixation(f -> f.changeSessionId()))
            .authorizeHttpRequests(a -> a
                .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/auth/verify").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            // Logout = delete the server-side session; the old cookie is useless immediately.
            .logout(l -> l
                .logoutUrl("/api/auth/logout")
                .deleteCookies("SESSION")
                .logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)));
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12); // salted BCrypt (NFR-02)
    }

    /** FR-28: suspension ends every open session of the user at once. */
    static final class SessionRevocation {
        private final FindByIndexNameSessionRepository<? extends Session> sessions;

        SessionRevocation(FindByIndexNameSessionRepository<? extends Session> sessions) {
            this.sessions = sessions;
        }

        void revokeAll(String principalName) {
            sessions.findByPrincipalName(principalName).keySet().forEach(sessions::deleteById);
        }
    }
}
