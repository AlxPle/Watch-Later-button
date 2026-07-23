---
layout: page
title: Updates
permalink: /updates/
description: Official release notes and website changes for Watch Later Button.
image: /assets/social_poster.png
---

<p class="text-on-surface-variant mb-8">Latest changes to the extension website and release notes.</p>

<div class="grid gap-4">
{% for post in site.posts %}
  <article class="group rounded-xl border border-outline-variant bg-surface-container-lowest p-3 sm:p-6 transition-all hover:border-[#bc0100] hover:shadow-md">
    <a class="block" href="{{ post.url | relative_url }}">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 class="m-0 text-lg md:text-xl font-bold tracking-tight text-on-surface group-hover:text-[#bc0100]">{{ post.title }}</h2>
        <time class="shrink-0 text-xs uppercase tracking-wide text-on-surface-variant" datetime="{{ post.date | date_to_xmlschema }}">
          {{ post.date | date: "%d.%m.%Y" }}
        </time>
      </div>
      <p class="mt-2 mb-0 text-sm text-on-surface-variant">Open this update</p>
    </a>
  </article>
{% endfor %}
</div>
