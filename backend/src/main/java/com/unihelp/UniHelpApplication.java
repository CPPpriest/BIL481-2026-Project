package com.unihelp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point of the UniHelp monolith (controller - service - repository layers, NFR-10).
 */
@SpringBootApplication
public class UniHelpApplication {

    public static void main(String[] args) {
        SpringApplication.run(UniHelpApplication.class, args);
    }
}
