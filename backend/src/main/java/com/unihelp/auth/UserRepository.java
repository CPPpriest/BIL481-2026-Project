package com.unihelp.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Look-ups use the normalized e-mail address; aliases are checked for uniqueness (FR-04). */
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByDisplayAlias(String displayAlias);
}
