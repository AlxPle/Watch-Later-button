---
layout: page
title: Updates
permalink: /updates/
---

<ul>
{% for post in site.posts %}
  <li>
    <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
    <time datetime="{{ post.date | date_to_xmlschema }}">
      — {{ post.date | date: "%d.%m.%Y" }}
    </time>
  </li>
{% endfor %}
</ul>