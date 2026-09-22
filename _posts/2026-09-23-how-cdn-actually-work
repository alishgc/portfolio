---
layout: post
title: "How CDNs Actually Work (and what I learned building a tiny one)"
date: 2026-09-22 12:00:00 +0545
thumbnail: /assets/img/thumbnail-placeholder.svg
excerpt: "A plain-language look at how CDNs work, origin servers, edge caching, TTL, load balancing, plus what I learned building a small CDN simulator in Node.js."
---


You've probably used a CDN today without knowing it. Load a website, and there's a decent chance the images, scripts, and video didn't come from some server in a data center thousands of miles away. They came from a server much closer to you, one that already had a copy sitting around ready to go. That's the whole idea behind a Content Delivery Network.

## The problem CDNs solve

Say your website is hosted on a single server in Virginia. Someone in Tokyo requests a page. That request has to physically travel across the ocean, get processed, and travel all the way back. Every hop adds latency. Now multiply that by thousands of users hitting the same server at once, and you've also got a load problem on top of a distance problem.

A CDN fixes both. It puts copies of your content on servers spread across different regions (these are called edge servers, because they sit at the "edge" of the network, closer to users) and it spreads traffic across multiple machines instead of hammering one.

## Origin, edge, and caching

There are three pieces worth understanding.

The origin server is the source of truth. It's where your actual content lives, the real database, the real files.

Edge servers sit between users and the origin. When a user makes a request, it hits an edge server first, not the origin directly. The edge server checks if it already has a copy of what's being asked for. If it does, it just hands that back. That's a cache hit. If it doesn't, it goes and fetches the content from the origin, saves a copy for next time, and then returns it. That's a cache miss.

This is where caching becomes the real engine of the whole system. Without it, an edge server is just a pointless middleman adding an extra hop. With it, most requests never have to touch the origin at all.

Of course, cached content can't sit there forever unchecked. That's what TTL (time to live) is for. Every cached item gets a timer. Once that timer runs out, the item is considered expired, and the next request for it triggers a fresh fetch from the origin, even if the old cached version was never technically deleted.

## Load balancing

Most real CDNs don't route you to just one edge server. They have several, and something needs to decide which one handles which request. That's the load balancer's job. One of the simplest strategies is round robin: request one goes to edge server A, request two goes to edge server B, request three goes back to A, and so on. It doesn't account for how busy each server actually is, but it's dead simple to reason about and it's a fine starting point before you get into fancier strategies like least-connections or geographic routing.

## How I implemented a small piece of this

Reading about origin servers and edge caching is one thing. Actually watching a cache HIT turn into an EXPIRED and then a MISS in your own terminal is another. That gap is why I built [mini-cdn-simulator](https://github.com/alishgc/mini-cdn-simulator), a small Node.js and Express project that walks through origin, edge, caching, TTL, and round-robin load balancing, in that order, one piece at a time.

**The origin server** came first, and it's intentionally boring. Just an Express app that responds with some data when asked, standing in for "the real backend." No cache, no logic, just answers when someone knocks.

**The edge server** came next, and the first version was just as plain: request comes in, forward it straight to origin, send back whatever comes back. No caching yet. The point of building it in this order was to feel the difference once caching actually got added.

**Caching with TTL** is where things got interesting. I used a plain in-memory `Map` on each edge server to store responses, keyed by the request URL. On top of that I added a TTL so cached items expire after a set time instead of sticking around forever getting stale.

```javascript
const cache = new Map()
const TTL = 5000

app.get("/{*splat}", async (req, res) => {
    const url = req.url
    const cached = cache.get(url)

    if (cached) {
      const isExpired = Date.now() - cached.cachedAt > TTL
      if (!isExpired) {
        console.log(`[EDGE] Cache HIT: ${url}`)
        return res.send(cached.data)
      }
      console.log(`[EDGE] Cache EXPIRED: ${url}`)
    } else {
      console.log(`[EDGE] Cache MISS: ${url}`)
    }

    const response = await fetchFromOrigin(url)
    return res.send(response.data)
})
```

Watching the log go from `HIT` to `EXPIRED` to `MISS` and back to `HIT` again was honestly a little satisfying. It's a small thing, but it's the exact behavior people are talking about when they throw around terms like cache hit ratio.

**A second edge server** came after the first one worked. Now there were two edges, each keeping its own separate cache, which matters for the next part.

**The load balancer** is its own small Express app, and its only job is to alternate incoming requests between Edge 1 and Edge 2, round robin style. It doesn't know anything about caching or TTL or the origin. It just hands off traffic and gets out of the way.

```javascript
const selectedEdge = edges[currentEdge];

currentEdge = (currentEdge + 1) % edges.length;

try {
    const response = await axios.get(selectedEdge + req.url);
    res.send(response.data);
} catch (error) {
    console.log(error.response);
    res.sendStatus(error.response.status)
}
```

I want to be upfront that this is a learning project, not a production system. The cache lives in Node process memory, so it means everything resets if the server restarts, and it obviously doesn't share state across multiple instances the way a real CDN's edge network would. There's no geo routing, no real invalidation API, no HTTPS at the edge. I'm still learning how production systems handle cache invalidation across nodes and smarter routing decisions, and I'm sure there's a lot I'd do differently with more experience. But building even this small a version, and specifically separating "load balancing" from "caching" into two things that don't know about each other, made those concepts click in a way that reading articles never quite did for me.

Full code is on [GitHub](https://github.com/alishgc/mini-cdn-simulator) if you want to clone it and break it yourself.

## Why this matters beyond CDNs specifically

The caching and origin/edge pattern shows up everywhere, not just in CDNs. Database query caching, API response caching, browser caching, they're all the same basic tradeoff: keep a copy close to where it's needed, decide how long that copy stays trustworthy, and have a fallback plan for when it's stale or missing. Once you've built a small version of this pattern yourself, you start noticing it in almost every system you look at afterward.
