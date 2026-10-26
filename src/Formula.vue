<script setup lang="ts">
import { computed } from 'vue'
import katex from 'katex'

const props = defineProps<{ tex: string; label: string }>()
const html = computed(() => katex.renderToString(props.tex, {
  displayMode: true, throwOnError: false, trust: false, strict: 'ignore', maxExpand: 100,
}))
</script>

<template>
  <!-- KaTeX 在 trust:false 下生成经过转义的 HTML/MathML，不插入用户原始 HTML。 -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="formula" role="math" :aria-label="label" v-html="html"></div>
</template>
