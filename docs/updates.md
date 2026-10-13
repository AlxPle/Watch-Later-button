---
layout: page
title: Updates
permalink: /updates/
description: Official release notes and website changes for Watch Later Button.
image: /assets/social_poster.png
---

<p class="text-on-surface-variant text-sm mb-8">Official changelog, compatibility improvements, and release notes.</p>

<div class="space-y-4">
{% for post in site.posts %}
  <article class="group rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-5 sm:p-6 transition-all hover:border-primary/40 hover:shadow-sm">
    <a class="block" href="{{ post.url | relative_url }}">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <h2 class="text-base sm:text-lg font-bold tracking-tight text-on-surface group-hover:text-primary transition-colors m-0">{{ post.title }}</h2>
        <time class="shrink-0 text-xs font-medium text-on-surface-variant bg-surface-container-low px-2.5 py-1 rounded-md" datetime="{{ post.date | date_to_xmlschema }}">
          {{ post.date | date: "%B %d, %Y" }}
        </time>
      </div>
      <div class="text-xs text-on-surface-variant line-clamp-2 leading-relaxed mt-1">
        {{ post.excerpt | strip_html | truncatewords: 24 }}
      </div>
    </a>
  </article>
{% endfor %}
</div>
