---
layout: post
title: "How CDNs Actually Work and what I learned building a tiny one"
date: 2026-09-23 10:05:43 +0545
thumbnail: /assets/img/post_img/how-cdn-works.svg
excerpt: "A plain-language look at how CDNs work, origin servers, edge caching, TTL, load balancing, plus what I learned building a small CDN simulator in Node.js."
---

A CDN is one of those things you hear about all the time when learning web development. Websites use Cloudflare, CloudFront, Fastly, and other CDNs to serve content faster, reduce load on their servers, and handle large numbers of requests.

But knowing that "CDNs make websites faster" is not the same as understanding how they actually work.

I wanted to understand what happens between a client requesting a resource and that resource being served from somewhere closer to the client. So instead of just reading about CDNs, I built a small CDN simulator using Node.js, Express, and Axios.

Before getting into my implementation, it helps to understand what a CDN actually does.

## What is a CDN?

CDN stands for **Content Delivery Network**.

A CDN is a distributed network of servers that sits between users and an application's main server. These servers are placed in different geographic locations and can cache content so that users do not always have to request it directly from the original server.

A simplified setup looks like this:

```text
                  Client
                     |
                     v
                CDN / Edge
                     |
                     v
                Origin Server
```

In a real CDN, there are many edge locations.

For example, imagine an application whose main server is running in the United States while a user is accessing it from Nepal.

Without a CDN:

```text
User in Nepal
      |
      | request
      v
Server in USA
      |
      | response
      v
User in Nepal
```

Every request has to travel to the origin server.

With a CDN, the request can potentially be handled by an edge server located closer to the user:

```text
                         Origin Server
                              |
                              |
                    ---------------------
                    |         |          |
                    v         v          v
                 Edge      Edge       Edge
                 USA       Europe     Asia
                                      |
                                      |
                                      v
                                  User
                                  Nepal
```

The exact routing is more complicated in real CDN systems, but the basic idea is that users can be served from infrastructure closer to them.

## Why does a CDN help?

One major reason is **caching**.

Suppose thousands of users request the same image, JavaScript file, CSS file, or other cacheable content.

Without caching, the origin might receive every request:

```text
User 1 ----\
User 2 -----\
User 3 ------> Origin Server
User 4 -----/
User 5 ----/
```

With a CDN, the first request can retrieve the content from the origin and store it at an edge server.

Later requests can be served directly from the edge:

```text
User 1 ----\
User 2 -----\
User 3 ------> Edge Cache
User 4 -----/
User 5 ----/
                  |
                  | only when needed
                  v
             Origin Server
```

The origin does not need to generate or send the same content for every request.

This can reduce traffic to the origin and reduce the distance a request has to travel.

## Origin Server

The **origin server** is the server where the original content comes from.

It is usually the application's actual backend or infrastructure that owns the content.

For example:

```text
Client
   |
   v
CDN
   |
   v
Origin
   |
   v
Database / Application / Files
```

If an edge server does not have the requested content in its cache, it can request the content from the origin.

The origin then sends the response back.

## Edge Servers

An **edge server** is a server located closer to users than the origin, usually as part of the CDN's distributed infrastructure.

The important thing about an edge server for this project is that it can store cached responses.

For example:

```text
             Origin
                |
        ----------------
        |              |
        v              v
     Edge 1          Edge 2
     Cache           Cache
```

If Edge 1 already has `/about` cached, it can respond without contacting the origin again.

## How CDN caching works

Imagine a user requests:

```text
GET /about
```

The edge server checks its cache.

There are three important cases.

### Cache MISS

The requested resource is not in the cache.

```text
Client
  |
  v
Edge
  |
  | Not cached
  v
Origin
```

The edge asks the origin for the resource.

The response can then be stored in the edge cache.

### Cache HIT

The resource is already cached and the cached copy is still valid.

```text
Client
  |
  v
Edge
  |
  | Cache HIT
  v
Cached response
```

The edge can immediately return the cached response.

The origin does not need to be contacted for that request.

### Cache expiration

Cached content usually should not live forever.

A CDN can use different caching rules to determine how long content remains valid.

One simple approach is a **TTL**, or Time To Live.

For example:

```text
TTL = 5 seconds
```

If the resource was cached at 12:00:00, it can be considered valid until roughly 12:00:05.

After that, the cache entry is expired and the edge needs to retrieve fresh content.

The basic flow becomes:

```text
             Request
                |
                v
             Edge
                |
          Is it cached?
           /          \
         No            Yes
         |              |
       MISS         Is it expired?
         |           /        \
         |         Yes         No
         |          |           |
         v          v           v
      Origin      Origin       HIT
         |          |
         -----------|
               |
               v
          Update cache
               |
               v
             Client
```

That is the basic caching model I wanted to reproduce in my project.

# Building the Mini CDN Simulator

Once I understood the basic flow, I built a small local system that reproduces some of these concepts.

The project uses:

- Node.js
- Express.js
- Axios

The architecture is:

```text
                  Client
                     |
                     v
              Load Balancer
                /         \
               v           v
            Edge 1       Edge 2
               \           /
                \         /
                     v
                Origin Server
```

The components run on different ports:

```text
Origin        -> 3000
Edge 1        -> 3001
Edge 2        -> 3002
Load Balancer -> 8080
```

The client only needs to communicate with the load balancer.

## Project structure

```text
mini-cdn-simulator/
├── edge/
├── origin/
├── load-balancer/
├── package.json
└── README.md
```

I intentionally kept the project small. Each part has one main responsibility.

## Building the Origin Server

I started with the origin server.

The origin is just an Express server that serves some content.

```js
const express = require('express');
const app = express()
const PORT = process.env.PORT || 3000;

app.use(express.static("public"))

app.use((req, res, next) => {
    console.log(`[ORIGIN] ${req.method} ${req.url}`);
    next();
});

app.get('/about', (req, res) => {
  res.send('<h1>Hello From origin to About page!</h1>')
})

app.listen(PORT, () => {
  console.log(`Origin Server running on http://localhost:3000`)
})
```

The important part is that this server represents the source of the content.

For example:

```text
GET /about
```

returns:

```html
<h1>Hello From origin to About page!</h1>
```

I also added logging so I could see when the origin was actually receiving a request.

That became useful later when testing whether the edge server was serving cached content or contacting the origin.

# Building the Edge Server

The edge server is where the interesting part starts.

I needed somewhere to store cached responses.

For this project, I used JavaScript's built-in `Map`.

```js
const cache = new Map()
```

This is an in-memory cache.

For example, the cache can conceptually contain:

```text
/about -> {
    data: "...",
    cachedAt: 123456789
}
```

The important thing to understand is that this `Map` belongs to the Node.js process.

It is not a shared database.

If I run one edge server, there is one cache.

If I run the same edge server code as two separate Node.js processes, each process gets its own `Map`.

So:

```text
Edge 1 process
    |
    └── Map A

Edge 2 process
    |
    └── Map B
```

They do not share cache entries.

That actually made the project more interesting because it showed me one of the problems that appears when moving from a simple local process to distributed systems.

## Adding a TTL

I wanted cached responses to expire after a certain amount of time.

I used:

```js
const TTL = 5000
```

Since JavaScript's `Date.now()` returns milliseconds, `5000` means five seconds.

When storing a response, I saved both the response data and the time it was cached.

```js
cache.set(url, {
    data: response.data,
    cachedAt: Date.now()
})
```

Now I had enough information to determine whether an entry was still valid.

The calculation is:

```js
Date.now() - cached.cachedAt
```

If that value is greater than the TTL, the cache entry has expired.

```js
const isExpired = Date.now() - cached.cachedAt > TTL
```

So the logic becomes:

```text
Current time
     |
     v
Current time - cached time
     |
     v
Is it greater than TTL?
     |
   /   \
 Yes    No
  |      |
Expired  Valid
```

## Cache HIT, MISS, and EXPIRED

The edge server first gets the requested URL.

```js
const url = req.url
```

Then it checks the cache:

```js
const cached = cache.get(url)
```

If the cache contains something, I check whether it has expired.

```js
if (cached) {
    const isExpired = Date.now() - cached.cachedAt > TTL

    if (!isExpired) {
        console.log(`[EDGE] Cache HIT: ${url}`)
        return res.send(cached.data)
    }

    console.log(`[EDGE] Cache EXPIRED: ${url}`)
}
```

If there is no cached entry:

```js
else {
    console.log(`[EDGE] Cache MISS: ${url}`)
}
```

So a request can produce logs such as:

```text
[EDGE] Cache MISS: /about
```

Then, if I request it again within five seconds:

```text
[EDGE] Cache HIT: /about
```

After waiting longer than five seconds:

```text
[EDGE] Cache EXPIRED: /about
```

That made the caching behavior visible instead of just having the cache work silently in the background.

# Fetching From the Origin

When the edge doesn't have a valid cached response, it needs to contact the origin.

I put that logic into a separate function:

```js
async function fetchFromOrigin(url) {
    const response = await axios.get(originUrl + url)

    cache.set(url, {
        data: response.data,
        cachedAt: Date.now()
    })

    return response
}
```

There are two things happening here.

First, Axios requests the content from the origin:

```js
const response = await axios.get(originUrl + url)
```

Then the response is stored in the cache:

```js
cache.set(url, {
    data: response.data,
    cachedAt: Date.now()
})
```

Finally, the response is returned.

This means a cache MISS or an expired entry follows this path:

```text
Edge
 |
 | request
 v
Origin
 |
 | response
 v
Edge
 |
 | store response
 v
Cache
 |
 v
Client
```

# Putting the Edge Logic Together

The complete edge route became:

```js
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
    }
    else {
        console.log(`[EDGE] Cache MISS: ${url}`)
    }

    try {
        const response = await fetchFromOrigin(url)
        return res.send(response.data)
    } catch (error) {
        console.log(error)
        res.sendStatus(error.response.status)
    }
})
```

This is basically the core of the simulator.

The edge checks the cache, decides whether the cached data can be used, and contacts the origin when necessary.

# Running Two Edge Servers

I didn't create two copies of the edge server.

Instead, I used the same `server.js` file and ran it as two separate Node.js processes.

The port comes from an environment variable:

```js
const PORT = process.env.PORT || 3001;
```

That means the same code can run as:

```text
Edge 1 -> PORT 3001
Edge 2 -> PORT 3002
```

The important part here is that these are two different processes.

So even though the code is identical:

```text
edge/server.js
       |
       +---- Node process -> port 3001 -> Map A
       |
       +---- Node process -> port 3002 -> Map B
```

Each process has its own memory.

If `/about` is cached by Edge 1, that does not automatically mean Edge 2 has `/about`.

For example:

```text
Edge 1
Cache:
    /about

Edge 2
Cache:
    empty
```

This is different from using one shared cache.

# Adding the Load Balancer

At this point I had:

```text
Origin
  |
  +--- Edge 1
  |
  +--- Edge 2
```

But the client shouldn't have to manually choose an edge server.

So I added a simple load balancer.

The load balancer knows about both edge servers:

```js
const edges = [
    "http://localhost:3001",
    "http://localhost:3002"
]
```

Then I used a variable to track which edge should receive the next request:

```js
let currentEdge = 0
```

For each request:

```js
const selectedEdge = edges[currentEdge];
currentEdge = (currentEdge + 1) % edges.length;
```

The `%` operator gives the remainder.

With two edges, the value cycles like this:

```text
currentEdge = 0
    |
    v
Edge 1
    |
    v
currentEdge = 1
    |
    v
Edge 2
    |
    v
currentEdge = 0
    |
    v
Edge 1
    |
   ...
```

This is called **round-robin load balancing**.

The load balancer then forwards the request:

```js
const response = await axios.get(selectedEdge + req.url);
res.send(response.data);
```

So the client only talks to:

```text
localhost:8080
```

The load balancer decides which edge gets the request.

# The Complete Request Flow

Now the complete architecture looks like this:

```text
                         Client
                            |
                            v
                    Load Balancer
                       :8080
                      /      \
                     /        \
                    v          v
                 Edge 1      Edge 2
                 :3001       :3002
                    \          /
                     \        /
                      v      v
                     Origin
                      :3000
```

Let's walk through an actual request.

Suppose the client requests:

```text
GET /about
```

### Step 1: Client

The client sends the request to:

```text
http://localhost:8080/about
```

### Step 2: Load Balancer

The load balancer selects an edge.

For example:

```text
Edge 1
```

and forwards the request.

### Step 3: Edge

Edge 1 checks:

```js
cache.get("/about")
```

If nothing exists:

```text
Cache MISS
```

### Step 4: Origin

Edge 1 requests:

```text
http://localhost:3000/about
```

The origin sends the response.

### Step 5: Edge Cache

Edge 1 stores the response:

```text
/about -> {
    data: "...",
    cachedAt: ...
}
```

### Step 6: Client

The response travels back:

```text
Origin
   |
   v
Edge 1
   |
   v
Load Balancer
   |
   v
Client
```

Now suppose another request goes to Edge 1 within five seconds.

The edge finds:

```text
/about
```

in its cache.

The result is:

```text
Cache HIT
```

The origin isn't contacted.

The response comes directly from the edge.

# What Happens When the Request Goes to Edge 2?

This is where the separate process caches become visible.

Suppose the next request goes to Edge 2.

Edge 2 has its own `Map`.

It may not have `/about` cached.

So even though Edge 1 already cached it, Edge 2 can produce:

```text
Cache MISS
```

Then Edge 2 contacts the origin and creates its own cached copy.

Now the system can look like:

```text
Edge 1 Cache
    |
    +-- /about

Edge 2 Cache
    |
    +-- /about
```

The content is duplicated because each edge maintains its own local cache.

That is a simplified representation of why real distributed systems need more sophisticated cache infrastructure.

# A Bug I Ran Into

While implementing the cache expiration logic, I initially made a simple mistake.

I had a cached object:

```js
const cached = cache.get(url)
```

but accidentally tried to access:

```js
cache.cachedAt
```

instead of:

```js
cached.cachedAt
```

The timestamp belongs to the object retrieved from the cache.

```text
cache
 |
 +-- Map

cached
 |
 +-- data
 +-- cachedAt
```

So the correct expression is:

```js
Date.now() - cached.cachedAt
```

It was a small bug, but it made sense once I looked at what `cache.get(url)` actually returned.

# Another Thing I Found While Testing

When testing the project in a browser, I noticed requests for:

```text
/favicon.ico
```

showing up in the logs.

I hadn't created a favicon route.

The browser was making another request automatically, separate from the `/about` request I was testing.

That request reached the origin and returned a 404.

This was useful because it showed that the CDN doesn't know or care why a request exists. It just receives a request and processes it according to its rules.

# Error Handling

The edge and load balancer use Axios to communicate with the next server.

If the origin returns an error, Axios rejects the request.

I handled that with:

```js
try {
    const response = await fetchFromOrigin(url)
    return res.send(response.data)
} catch (error) {
    console.log(error)
    res.sendStatus(error.response.status)
}
```

I intentionally return the status received from the upstream server.

For example, if the origin returns:

```text
404
```

the edge doesn't turn that into an unrelated `500`.

It can propagate the `404` response.

# What This Simulator Actually Represents

This project is not a production CDN.

It is a small local model that helped me understand several important CDN concepts.

It demonstrates:

- Origin server
- Multiple edge servers
- Edge caching
- Cache HIT
- Cache MISS
- Cache expiration
- TTL
- Round-robin load balancing
- Separate in-memory caches
- Requests moving through multiple layers

The architecture is intentionally simplified.

A real CDN has many things that this project does not attempt to implement, such as geographic routing, distributed cache infrastructure, cache invalidation systems, health checks, failover, TLS handling, compression, DDoS protection, HTTP caching headers, and a much larger network of servers.

The goal wasn't to recreate Cloudflare in a few Node.js files.

The goal was to understand what happens behind the basic idea of "a CDN caches content closer to users."

# What I Learned From Building It

The biggest thing I got from this project was understanding the difference between knowing a concept and actually seeing it work.

Before building it, I could explain that a CDN uses edge servers and caching.

After building it, I could actually trace a request:

```text
Client
  |
  v
Load Balancer
  |
  v
Edge
  |
  +---- Cache HIT ----> Client
  |
  +---- Cache MISS
          |
          v
        Origin
          |
          v
        Cache
          |
          v
        Client
```

I also understood something that isn't obvious when you only look at a single Node.js application.

When I ran two edge servers, they were two separate processes. Their `Map` objects were completely independent.

That led naturally to another question:

**What happens when multiple servers need to share cached data?**

That's where technologies such as Redis become relevant.

My simulator uses:

```js
const cache = new Map()
```

which is only local process memory.

A shared cache would be a completely different setup.

That was one of the more useful parts of the project for me because the implementation raised another system design question instead of just giving me a working application.

## Source Code

The complete project is available on GitHub:

[Mini CDN Simulator](https://github.com/alishgc/mini-cdn-simulator)

I built this project mainly to understand the mechanics rather than to create a production-ready CDN. The implementation is small, but it gave me a much clearer picture of how origin servers, edge servers, caching, TTLs, and load balancing fit together.