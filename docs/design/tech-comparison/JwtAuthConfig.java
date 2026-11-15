package comparison.auth.jwt;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.time.Duration;
import java.time.Instant;
import javax.crypto.SecretKey;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Documentation-only REJECTED alternative: stateless JWT bearer tokens.
 * Not part of the application build. Needs spring-boot-starter-security and
 * spring-boot-starter-oauth2-resource-server; the HMAC key would come from an environment variable.
 */
@Configuration
public class JwtAuthConfig {
    private static final Duration ACCESS_TOKEN_TTL = Duration.ofMinutes(15);

    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        http
            // Token travels in the Authorization header, not a cookie, so CSRF is not needed.
            // The SPA must keep the token in JavaScript-readable storage instead (XSS exposure).
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/auth/verify").permitAll()
                .requestMatchers("/api/admin/**").hasAuthority("SCOPE_ADMIN")
                .anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()));
        return http.build();
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey key) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(key));
    }

    @Bean
    JwtDecoder jwtDecoder(SecretKey key) {
        return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
    }

    /** Called by the login endpoint after the BCrypt password check. */
    static String issueToken(JwtEncoder encoder, Long userId, String role) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(userId.toString())          // never the e-mail: the payload is only Base64 (NFR-04)
                .issuedAt(now)
                .expiresAt(now.plus(ACCESS_TOKEN_TTL))
                .claim("scope", role)
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    // Gaps for UniHelp that need extra server-side state anyway:
    // - logout (FR-05) and suspension (FR-28): an issued token stays valid until "exp"
    //   unless every request checks a token denylist or the user's current status;
    // - 60-minute inactivity timeout (FR-07): needs short access tokens plus a rotating
    //   refresh token to emulate a sliding idle timeout.
}
