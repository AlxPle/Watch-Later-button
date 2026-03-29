---
layout: page
title: Updates
permalink: /updates/
---

<p class="text-zinc-600 mb-8">Latest changes to the extension website and release notes.</p>

<div class="grid gap-4">
{% for post in site.posts %}
  <article class="group rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-[#bc0100] hover:shadow-md">
    <a class="block" href="{{ post.url | relative_url }}">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 class="m-0 text-lg md:text-xl font-bold tracking-tight text-zinc-900 group-hover:text-[#bc0100]">{{ post.title }}</h2>
        <time class="shrink-0 text-xs uppercase tracking-wide text-zinc-500" datetime="{{ post.date | date_to_xmlschema }}">
          {{ post.date | date: "%d.%m.%Y" }}
        </time>
      </div>
      <p class="mt-2 mb-0 text-sm text-zinc-600">Open this update</p>
    </a>
  </article>
{% endfor %}
</div>
