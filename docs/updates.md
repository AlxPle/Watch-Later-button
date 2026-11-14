---
layout: page
title: Updates
permalink: /updates/
description: Official release notes and website changes for Watch Later Button.
image: /assets/banner/social_poster.png
---

<p class="text-on-surface-variant text-sm mb-8">Official changelog, compatibility improvements, and release notes.</p>

{% assign latest_post = site.posts.first %}
{% assign posts_by_year = site.posts | group_by_exp: "post", "post.date | date: '%Y'" %}

<div class="space-y-3">
{% for year in posts_by_year %}
  <h2 class="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant {% unless forloop.first %}mt-8{% endunless %} mb-1">
    <span>{{ year.name }}</span>
    <span class="h-px flex-1 bg-outline-variant" aria-hidden="true"></span>
  </h2>

  <div class="space-y-4">
  {% for post in year.items %}
    {% assign category_label = post.category | default: 'Release' %}
    {% case category_label %}
      {% when 'Firefox' %}{% assign category_class = 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20' %}
      {% when 'Privacy' %}{% assign category_class = 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20' %}
      {% when 'Announcement' %}{% assign category_class = 'bg-sky-500/10 text-sky-800 dark:text-sky-400 border border-sky-500/20' %}
      {% else %}{% assign category_class = 'bg-[color:color-mix(in_srgb,var(--wl-link-color)_10%,transparent)] text-link border border-[color:color-mix(in_srgb,var(--wl-link-color)_20%,transparent)]' %}
    {% endcase %}
    {% assign card_summary = post.summary | default: post.description | default: 'Read the full update for details.' %}

    <article class="group rounded-xl border border-outline-variant bg-surface-container-lowest p-5 sm:p-6 transition-all hover:border-[color:color-mix(in_srgb,var(--wl-link-color)_40%,transparent)] hover:shadow-sm">
      <a class="release-card block rounded-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest focus:outline-none"
         href="{{ post.url | relative_url }}">
        <div class="flex flex-wrap items-center gap-2 mb-2">
          {% if post.url == latest_post.url %}
            <span class="inline-flex items-center rounded-full bg-red-700 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Latest</span>
          {% endif %}
          <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold {{ category_class }}">{{ category_label }}</span>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
          <h3 class="text-base sm:text-lg font-bold tracking-tight text-on-surface group-hover:text-primary transition-colors m-0">{{ post.title }}</h3>
          <time class="w-fit self-start sm:self-auto shrink-0 whitespace-nowrap text-xs font-medium text-on-surface-variant bg-surface-container-low px-2.5 py-1 rounded-md" datetime="{{ post.date | date_to_xmlschema }}">
            {{ post.date | date: "%B %d, %Y" }}
          </time>
        </div>

        <div class="mt-2 flex items-start justify-between gap-4">
          <div class="release-summary text-xs text-on-surface-variant leading-relaxed">{{ card_summary | escape }}</div>
          <span class="shrink-0 text-base leading-5 text-on-surface-variant/70 transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true">→</span>
        </div>
      </a>
    </article>
  {% endfor %}
  </div>
{% endfor %}
</div>
