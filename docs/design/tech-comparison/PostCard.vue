<script setup>
/**
 * Documentation-only REJECTED frontend alternative: Vue 3 Single-File Component.
 * Renders the identical alias-only PostCardDto contract (FR-14, FR-20, NFR-04).
 */
defineProps({
  post: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['open', 'report']);
</script>

<template>
  <article class="post-card" :aria-label="post.title">
    <header class="post-card-meta">
      <span class="badge">{{ post.category }} · {{ post.subtype }}</span>
      <span v-if="post.status === 'RESOLVED'" class="badge">Resolved</span>
    </header>

    <h3>
      <button type="button" class="link-button" @click="emit('open', post.id)">
        {{ post.title }}
      </button>
    </h3>

    <p>{{ post.descriptionSnippet }}</p>

    <footer>
      <span>
        By <strong>{{ post.authorAlias }}</strong> · {{ post.createdAt }}
      </span>
      <button
        v-if="post.status === 'ACTIVE'"
        type="button"
        @click="emit('report', post.id)"
      >
        Report
      </button>
    </footer>
  </article>
</template>