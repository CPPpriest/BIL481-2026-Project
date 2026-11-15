package com.unihelp.admin;

/** Administrator decision on a reported/hidden post (FR-27). */
public enum ModerationAction {
    /** Status back to ACTIVE; all reports of the post marked reviewed. */
    RESTORE,
    /** Permanent removal of the post and its dependent data. */
    REMOVE
}
